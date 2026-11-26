'use strict';
/* ------------------------------------------------------------------
   SEVİYE 13: Hafıza nerede?
   36 nöronluk bir hafıza ağı (6×6), her nöron ötekilerin hepsine bağlı.
   Üç resim (Pamuk, ev, şemsiye) aynı bağlantılara “birlikte yanan
   bağlanır” kuralıyla yazılır. Yarım bir ipucundan bütün resim geri gelir.
   Nöron silince ya da bağlantı kopartınca anı birden kaybolmaz:
   yavaş yavaş bulanıklaşır (Lashley, dağıtılmış hafıza).
   Durumlar: +1 yanık, −1 sönük, 0 bilinmiyor (ipucunda boş kalan yer).
   Görünüm: js/views/where.js
------------------------------------------------------------------- */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Lv = isNode ? require('../levels.js') : { registerLevel };

  const N = 36;
  const pic = rows =>
    rows
      .join('')
      .split('')
      .map(c => (c === '#' ? 1 : -1));
  const MEM = {
    N,
    side: 6,
    names: ['Pamuk', 'Ev', 'Şemsiye'],
    icons: ['🐈', '🏠', '☂️'],
    pats: [
      pic(['#....#', '##..##', '######', '#.##.#', '######', '.####.']),
      pic(['..##..', '.####.', '######', '.#..#.', '.#..#.', '.####.']),
      pic(['.####.', '######', '#.##.#', '..#...', '..#...', '.##...'])
    ]
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Birlikte yanan bağlanır: her resim bütün bağlantılara üst üste yazılır
  function memWeights() {
    const W = new Float64Array(N * N);
    for (const p of MEM.pats)
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) if (i !== j) W[i * N + j] += (p[i] * p[j]) / N;
    return W;
  }
  const W0 = memWeights();
  // Kopan bağlantılar: iki yönde birden, aynı tohumla hep aynı bağlantılar
  function memMask(cut, seed) {
    const r = rng(seed || 1),
      M = new Uint8Array(N * N).fill(1);
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++)
        if (r() < cut) {
          M[i * N + j] = 0;
          M[j * N + i] = 0;
        }
    return M;
  }
  // Hatırlama: her turda nöronlar rastgele sırayla, bağlantılarından gelen desteğe göre yanar ya da söner
  function memRecall(cue, dead, mask, seed) {
    const r = rng(seed || 7),
      s = cue.map((v, i) => (dead[i] ? -1 : v)),
      steps = [s.slice()];
    for (let sweep = 0; sweep < 8; sweep++) {
      let ch = 0;
      const ord = [...Array(N).keys()].sort(() => r() - 0.5);
      for (const i of ord) {
        if (dead[i]) continue;
        let h = 0;
        for (let j = 0; j < N; j++) if (!dead[j] && mask[i * N + j]) h += W0[i * N + j] * s[j];
        const v = h >= 0 ? 1 : -1;
        if (v !== s[i]) {
          s[i] = v;
          ch++;
        }
      }
      steps.push(s.slice());
      if (!ch) break;
    }
    return steps;
  }
  function memSim(s, p, dead) {
    let m = 0,
      n = 0;
    for (let i = 0; i < N; i++) {
      if (dead[i]) continue;
      n++;
      if (s[i] === p[i]) m++;
    }
    return n ? m / n : 0;
  }
  function memBest(s, dead) {
    const sims = MEM.pats.map(p => memSim(s, p, dead));
    let k = 0;
    sims.forEach((v, i) => {
      if (v > sims[k]) k = i;
    });
    return { k, sim: sims[k], sims };
  }
  function deadMask(st) {
    const d = new Uint8Array(N);
    for (const i of st.dead) d[i] = 1;
    return d;
  }
  // İpuçları
  function memHalf(k) {
    return MEM.pats[k].map((v, i) => (i < N / 2 ? v : 0));
  }
  function memNoisy(k, flips, seed) {
    const r = rng(seed || 3),
      c = MEM.pats[k].slice();
    for (let f = 0; f < flips; f++) {
      const i = Math.floor(r() * N);
      c[i] = -c[i];
    }
    return c;
  }
  // Bir hatırlama denemesi: sonucu kaydet, görev bayraklarını güncelle
  function memRun(st) {
    const dead = deadMask(st),
      mask = memMask(st.cut, st.seed),
      steps = memRecall(st.cue, dead, mask, 7 + st.runs),
      fin = steps[steps.length - 1],
      best = memBest(fin, dead);
    st.runs++;
    const intended = st.cueOf;
    const ok = intended != null && best.k === intended && best.sim >= 0.9;
    st.last = {
      state: fin,
      k: best.k,
      sim: best.sim,
      sims: best.sims,
      steps: steps.length - 1,
      ok,
      intended
    };
    st.log.unshift({
      dead: st.dead.length,
      cut: st.cut,
      cue: st.cueKind,
      k: best.k,
      sim: Math.round(best.sim * 100),
      ok
    });
    st.log.length = Math.min(st.log.length, 8);
    const f = st.flags;
    if (ok && st.cueKind === 'half') f.recalled = true;
    if (ok && st.dead.length >= 1) f.oneDead = true;
    if (ok && st.dead.length >= 6) {
      f.many = f.many || [];
      if (!f.many.includes(intended)) f.many.push(intended);
    }
    if (ok && st.cut >= 0.5) f.cutHalf = true;
    if (st.cut >= 0.85 && intended != null) f.cutLost = true;
    return { steps, best };
  }

  const level = Lv.registerLevel({
    key: 'where',
    layered: true,
    brainShort:
      'Bir anı beyninde tek bir hücrede değil, birçok nöronun arasındaki bağlantılara dağılmış olarak durur. Bu yüzden her gün nöron kaybetsen de anıların yerinde kalır; ağır hasarda bile anı bir anda değil, yavaş yavaş bulanıklaşarak zayıflar.',
    ver: 1,
    part: 'D',
    kind: 'where',
    title: 'Hafıza nerede?',
    question: 'Bir anı beynin neresinde durur? Bir parçası zarar görse o anı da mı gider?',
    goal: 'Bir anının tek bir hücrede değil, birçok bağlantıya dağılmış olduğunu ve hasarın anıyı birden değil yavaş yavaş bozduğunu görmek.',
    todo: [
      'Bir anının yarısını ipucu olarak ver ve ağa hatırlat.',
      'Nöron sil ya da bağlantı kopar; aynı anıyı yeniden hatırlat.',
      'Hasar büyüdükçe anıya ne olduğunu günlükten izle.'
    ],
    init() {
      return {
        cue: memHalf(0),
        cueOf: 0,
        cueKind: 'half',
        dead: [],
        cut: 0,
        seed: 1,
        runs: 0,
        last: null,
        log: [],
        kill: false
      };
    },
    missions: [
      {
        id: 'recall',
        shows: [],
        text: '<b>Pamuk’un yarısını</b> ipucu olarak ver ve <b>Hatırla</b>’ya bas.',
        check: st => !!st.flags.recalled,
        aha: 'Yarım bir resimden bütünü geri getirdi. Her nöron ötekilerden gelen bağlantılara bakıp “ben de bu resimde yanmalıyım” ya da “sönmeliyim” diye karar verdi. 12. seviyedeki [[örüntü tamamlama]], bu kez 36 nöronla.'
      },
      {
        id: 'one',
        shows: ['kill'],
        text: '<b>Nöron sil</b>’i aç, ağdan bir nöronu sil ve yeniden hatırlat. Pamuk o nöronla birlikte gitti mi?',
        check: st => !!st.flags.oneDead,
        aha: 'Gitmedi. Pamuk tek bir nöronda değil, 630 bağlantının hepsine biraz biraz yazılmış. Tek bir nöronun kaybı resmi bozmuyor. Senin beyninde de her gün nöronlar ölür ama anıların yerinde durur.'
      },
      {
        id: 'many',
        shows: ['kill', 'more'],
        text: 'En az <b>6 nöron</b> sil ve üç anıyı da (Pamuk, ev, şemsiye) sırayla hatırlat.',
        check: st => !!(st.flags.many && st.flags.many.length >= 3),
        aha: 'Ağın altıda biri gitti, üç anı hâlâ yerinde. Aynı nöronlar üç anıyı birden taşıyor: bir anı bir hücre değil, birçok hücrenin birlikte yanma deseni.'
      },
      {
        id: 'cut',
        shows: ['kill', 'more', 'cut'],
        text: 'Nöronları <b>onar</b>, sonra bağlantıların <b>yarısını kopar</b> (%50) ve hatırlat.',
        check: st => !!st.flags.cutHalf,
        aha: 'Bağlantıların yarısı gitti, anı hâlâ tam. Karl Lashley fareler üzerinde yıllarca öğrenilmiş bir yolun beyindeki yerini aradı; kabuğun hangi parçasını çıkarırsa çıkarsın tek bir yerden silinmedi. Anı her yere biraz biraz yazılmıştı.'
      },
      {
        id: 'lost',
        extra: true,
        shows: ['kill', 'more', 'cut', 'noisy', 'self', 'log'],
        text: 'Hasarı <b>%85</b>’e çıkar ve üç anıyı hatırlat. Anı birden mi kayboluyor, yoksa bulanıklaşıp başka anılarla mı karışıyor?',
        check: st => !!st.flags.cutLost,
        aha: 'Çok ağır hasarda bile anı birden yok olmuyor: önce bulanıklaşıyor, sonra benzer bir anıyla karışmaya başlıyor. Beyin hasarında ve yaşlanmada da hafıza çoğu zaman böyle, yavaş yavaş zayıflar.'
      }
    ],
    cards: {
      brain:
        'Bir anı beyinde tek bir yerde değil, birlikte yanan nöron gruplarının bağlantılarında saklanır; buna hafıza izi (engram) denir. 1953’te H.M. adlı hastanın iki yandaki hipokampusu alınınca eski anılarının çoğu kaldı ama yeni anı oluşturamadı: hipokampus yeni anıları kaydetmek için gerekli, ama anının tamamı orada durmuyor. 2012’de farelerde bir anıyı taşıyan hücreler ışıkla uyarılınca hayvan o anıyı “hatırladı”.',
      model:
        '36 nöron, her biri ötekilerin hepsine bağlı: 630 bağlantı. Üç resim 12. seviyedeki “birlikte yanan bağlanır” kuralıyla aynı bağlantılara üst üste yazıldı. Hatırlarken her nöron sırayla, bağlantılarından gelen desteğe bakıp yanar ya da söner; birkaç turda ağ en yakın anıya oturur.',
      limit:
        'Gerçek hafıza tek bir ağda değil; hipokampus, kabuğun farklı bölgeleri ve zamanla değişen bağlantılar birlikte çalışır. Bu ağda bağlantılar iki yönde eşit güçte, beyinde öyle değil. Ayrıca burada yalnız üç resim var; aynı ağa çok fazla resim yazılırsa anılar birbirine karışmaya başlar.'
    },
    deeper: `<p><b>Destek:</b> Bir nöronun desteği, yanan komşularından gelen bağlantıların toplamı eksi sönük komşulardan gelenler. Destek artıdaysa yanar, eksideyse söner.</p>
    <p><b>Neden yarım resim yetiyor?</b> Pamuk’un üst yarısındaki nöronlar, Pamuk’ta birlikte yandıkları alt yarıdaki nöronlara güçlü bağlı. Üst yarı yanınca alt yarıya “sen de yan” diye çok sayıda küçük destek gider.</p>
    <p><b>Neden hasar yavaş bozuyor?</b> Her nöron 35 bağlantıdan destek alır. Bir kısmı kopsa da kalanların çoğunluğu aynı yönü gösterdiği sürece karar değişmez. Bu fikir 1982’de John Hopfield’ın hafıza ağı olarak bilinir; bir ağ kabaca nöron sayısının yedide biri kadar resmi karıştırmadan saklayabilir.</p>`
  });

  const api = {
    MEM,
    memWeights,
    memMask,
    memRecall,
    memSim,
    memBest,
    memHalf,
    memNoisy,
    memRun,
    deadMask,
    level
  };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
