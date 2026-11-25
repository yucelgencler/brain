'use strict';
/* ------------------------------------------------------------------
   SEVİYE 15: Unutma ve uyku
   1. gün: ağ artı ve çarpıyı öğrenir. 2. gün: yalnız kare görülür.
   Uykusuz: yeni şeyi öğrenirken eskiler silinir (yıkıcı karışma).
   Uykulu: 2. gün üç “gündüz + gece” turuna bölünür; geceleri hipokampus
   günün anılarını eskilerle karıştırıp kabuğa tekrar oynatır → hepsi kalır.
   Görünüm: js/views/sleep.js
------------------------------------------------------------------- */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const C = isNode ? require('../core.js') : { Net, noisyBits, mulberry32 };
  const Lv = isNode ? require('../levels.js') : { registerLevel };
  const Sh = isNode ? require('./10-shapes.js') : { SHAPES };

  const SLEEP = {
    names: Sh.SHAPES.names,
    protos: Sh.SHAPES.protos,
    lr: 0.02,
    batch: 12,
    day1: 150,
    cycles: 3,
    day: 25,
    night: 25,
    testN: 20
  };
  const argmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

  function slNet() {
    return new C.Net([35, 8, 3], 5, 'softmax');
  }
  // Günün örnekleri: 1. gün artı ve çarpı, 2. gün kare (her birinden 4 çizim)
  function slData(seed) {
    const rnd = C.mulberry32(seed || 9);
    const mk = ys =>
      ys.flatMap(y =>
        [0, 1, 2, 3].map(k => ({ bits: C.noisyBits(SLEEP.protos[y], k ? 1 : 0, rnd), y }))
      );
    const test = [0, 1, 2].map(y => {
      const r = C.mulberry32(500 + y);
      return Array.from({ length: SLEEP.testN }, () => C.noisyBits(SLEEP.protos[y], 2, r));
    });
    return { d1: mk([0, 1]), d2: mk([2]), test };
  }
  // Bir öğrenme adımı: bugünün anılarından 12 kart; gece ise araya eski anılardan nOld kart
  function slStep(net, today, rnd, old, nOld) {
    const b = [];
    const pick = ex => {
      const e = ex[Math.floor(rnd() * ex.length)];
      b.push({ x: C.noisyBits(e.bits, Math.floor(rnd() * 2), rnd), y: e.y });
    };
    for (let k = 0; k < SLEEP.batch; k++) pick(today);
    if (old) for (let k = 0; k < nOld; k++) pick(old);
    net.trainBatch(b, SLEEP.lr);
  }
  function slAcc(net, data) {
    return data.test.map(
      (set, y) => set.filter(x => argmax(net.predict(x)) === y).length / set.length
    );
  }
  // Bir günün evreleri: [{kind: 'day1'|'day'|'night', n}]
  function slPlan(day, sleep) {
    if (day === 1) return [{ kind: 'day1', n: SLEEP.day1 }];
    const P = [];
    for (let c = 0; c < SLEEP.cycles; c++) {
      P.push({ kind: 'day', n: SLEEP.day });
      if (sleep) P.push({ kind: 'night', n: SLEEP.night });
    }
    return P;
  }
  // Bir evreyi baştan sona koştur (testler ve “hızlı” mod için)
  function slRunPhase(net, data, ph, rnd, nOld) {
    for (let s = 0; s < ph.n; s++) {
      if (ph.kind === 'day1') slStep(net, data.d1, rnd);
      else if (ph.kind === 'day') slStep(net, data.d2, rnd);
      else slStep(net, data.d2, rnd, data.d1, nOld);
    }
  }
  // Gün bitince görev bayrakları
  function slRecord(st, day, acc) {
    const f = st.flags;
    st.acc = acc;
    if (day === 1) {
      st.stage = 1;
      if (acc[0] >= 0.8 && acc[1] >= 0.8) f.day1 = true;
      return;
    }
    st.stage = 2;
    const old = (acc[0] + acc[1]) / 2;
    st.results.unshift({ sleep: st.sleep, replay: st.replay, acc: acc.slice() });
    st.results.length = Math.min(st.results.length, 6);
    if (!st.sleep && old <= 0.4 && acc[2] >= 0.8) f.forgot = true;
    if (st.sleep && acc.every(a => a >= 0.85)) f.slept = true;
    if (st.sleep && st.replay <= 1 && acc.every(a => a >= 0.8)) f.little = true;
  }

  const level = Lv.registerLevel({
    key: 'sleep',
    ver: 1,
    part: 'D',
    kind: 'sleep',
    title: 'Unutma ve uyku',
    question: 'Yeni bir şey öğrenince eskiler neden silinmiyor? Uykunun öğrenmeyle ne ilgisi var?',
    goal: 'Yalnız yeni şeyi tekrar etmenin eskileri sildiğini, uykuda eski ve yeni anıların birlikte tekrar oynatılmasının ise hepsini koruduğunu görmek.',
    todo: [
      '1. günü yaşa: ağ artı ve çarpıyı öğrenir.',
      '2. günü yaşa: yalnız kare görülür. Uyku açık ya da kapalı.',
      'Çizgilerden üç şeklin hatırlanma oranını izle.'
    ],
    init() {
      return { stage: 0, sleep: false, replay: 4, acc: null, results: [] };
    },
    missions: [
      {
        id: 'day1',
        text: '<b>1. günü yaşa</b>: ağ artı ve çarpıyı öğrensin.',
        check: st => !!st.flags.day1,
        aha: 'Bir gün boyunca artı ve çarpı gördü, ikisini de tanıyor. Kare hiç görmediği için onu bilmiyor.'
      },
      {
        id: 'forget',
        text: 'Uyku <b>kapalıyken</b> <b>2. günü yaşa</b>: bu gün yalnız kare görülüyor. Artı ile çarpıya ne oluyor?',
        check: st => !!st.flags.forgot,
        aha: 'Kareyi öğrendi ama artıyı ve çarpıyı unuttu: yeni şeyi öğrenmek için değişen bağlantılar, eskileri taşıyan bağlantıların üstüne yazıldı. Yapay ağlarda buna yıkıcı karışma denir (McCloskey ve Cohen, 1989). Beyin bunu nasıl önlüyor?'
      },
      {
        id: 'sleep',
        text: '<b>Baştan al</b>, uykuyu <b>aç</b> ve iki günü yeniden yaşa. Gece eski anılar tekrar oynatılacak.',
        check: st => !!st.flags.slept,
        aha: 'Bu kez üçünü de hatırlıyor. Her gece hipokampus günün yeni anılarını eski anılarla karıştırıp kabuğa tekrar oynattı; kabuk yeniyi öğrenirken eskiyi de tazeledi. İlk gündüz eskiler biraz unutuldu, ama ilk gece geri geldi; çizgide gördün.'
      },
      {
        id: 'little',
        text: 'Gece tekrarını <b>en aza</b> indir (her 12 yeni anıya 1 eski) ve iki günü yeniden yaşa. Bu kadarı yetiyor mu?',
        check: st => !!st.flags.little,
        aha: 'Çok az tekrar bile yetti: eski anıların ara sıra yeniden oynatılması onları korumaya yeter. Biraz daha yavaş toparlandılar, o kadar. Uykudan sonra hatırlamanın iyileşmesi insanlarda birçok deneyde gösterildi.'
      }
    ],
    cards: {
      brain:
        'Uyurken beyin boş durmaz. 1994’te Wilson ve McNaughton, gündüz bir labirentte koşan farelerin hipokampusundaki yer hücrelerinin, uykuda aynı sırayla yeniden ateşlendiğini gösterdi: gün tekrar oynatılıyordu. Bu tekrarlar sırasında hipokampus ile kabuk birlikte çalışır ve yeni anılar yavaş yavaş kabuğa yerleşir. Uykusuz kalan insanlar ertesi gün öğrendiklerini daha kötü hatırlar.',
      model:
        '35 → 8 → 3 nöronluk bir ağ. Her öğrenme adımında 12 kart görür ve bağlantılarını düzeltir. Uykusuz 2. günde yalnız kare kartları görür. Uykulu 2. gün üç gündüz–gece turuna bölünür: gündüz yalnız kare, gece kareyle birlikte eski artı ve çarpı kartları da (ayarladığın sayıda) tekrar edilir.',
      limit:
        'Gerçek beyinde yeni anılar önce hipokampusta tutulur ve kabuk onları yavaş yavaş öğrenir; burada tek bir ağ var ve “hipokampus” yalnızca gece tekrar ettiği kartlarla temsil ediliyor. Ayrıca uyku tek bir tekrar işlemi değil; farklı uyku evrelerinde farklı şeyler oluyor.'
    },
    deeper: `<p><b>Neden unutuyor?</b> Ağdaki her bağlantı birçok şeyi birden taşır. Yalnız kare görülünce her düzeltme “kare de” yönünde yapılır; artı ve çarpı için önemli olan bağlantılar da bu yöne çekilir.</p>
    <p><b>Neden tekrar koruyor?</b> Eski kartlar araya karışınca her düzeltme hem kareyi hem eskileri birlikte doğru tutmaya çalışır. Ağ hepsine birden uyan bağlantıları bulur.</p>
    <p><b>Kaç tekrar?</b> Kaydırıcı, gece her 12 yeni kartın arasına kaç eski kart karıştırılacağını belirler. Bir tane bile eskileri birkaç gecede geri getirir.</p>`
  });

  const api = { SLEEP, slNet, slData, slStep, slAcc, slPlan, slRunPhase, slRecord, level };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
