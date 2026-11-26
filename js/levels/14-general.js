'use strict';
/* ------------------------------------------------------------------
   SEVİYE 14: Ezber mi, anlamak mı?
   Aynı örnekleri iki öğrenci görür:
   - Ezberci (hipokampus gibi): her çizimi olduğu gibi saklar; sorulan
     çizim sakladıklarından birine en fazla 1 pikselle uyuyorsa adını söyler,
     yoksa “hatırlamıyorum” der. Tek seferde öğrenir.
   - Kavrayan (kabuk gibi): 35 → 6 → 3 nöron ağı; her örnekte bağlantılarını
     biraz düzeltir, yavaş öğrenir ama ortak yanı çıkarır.
   Sınav: hiç görmedikleri 30 çizim. Görünüm: js/views/general.js
------------------------------------------------------------------- */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const C = isNode ? require('../core.js') : { Net, noisyBits, mulberry32 };
  const Lv = isNode ? require('../levels.js') : { registerLevel };
  const Sh = isNode ? require('./10-shapes.js') : { SHAPES };

  const GEN = {
    names: Sh.SHAPES.names,
    protos: Sh.SHAPES.protos,
    lr: 0.02,
    steps: 25,
    tol: 1,
    examN: 10
  };
  const dist = (a, b) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0);
  const argmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

  /* ---------- ezberci ---------- */
  function genMemo(st, bits) {
    let best = null,
      bd = 99;
    for (const e of st.examples) {
      const d = dist(e.bits, bits);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best && bd <= GEN.tol ? { y: best.y, d: bd } : { y: null, d: bd };
  }
  /* ---------- kavrayan ---------- */
  function genNet() {
    return new C.Net([35, 6, 3], 7, 'softmax');
  }
  function genFit(net, examples, rnd) {
    for (let s = 0; s < GEN.steps; s++) {
      const b = [];
      for (const e of examples) {
        b.push({ x: e.bits, y: e.y });
        b.push({ x: C.noisyBits(e.bits, 1, rnd), y: e.y });
      }
      net.trainBatch(b, GEN.lr);
    }
  }
  function genReplay(st) {
    const net = genNet(),
      rnd = C.mulberry32(11),
      seen = [];
    for (const e of st.examples) {
      seen.push(e);
      genFit(net, seen, rnd);
    }
    net._rnd = rnd;
    return net;
  }
  function genTeach(st, net, bits, y) {
    st.examples.push({ bits: bits.slice(), y });
    st.counts[y]++;
    genFit(net, st.examples, net._rnd || (net._rnd = C.mulberry32(11)));
  }
  function genAsk(st, net, bits, y) {
    const memo = genMemo(st, bits),
      p = Array.from(net.predict(bits)),
      g = argmax(p);
    const r = { y, memo: memo.y, cortex: g, p: Math.round(p[g] * 100) };
    st.asks.unshift(Object.assign({ bits: bits.slice() }, r));
    st.asks.length = Math.min(st.asks.length, 6);
    const f = st.flags,
      taught = st.counts.filter(c => c > 0).length;
    if (taught === 1 && st.counts[y] === 0 && memo.y === null && g !== y) f.over = true;
    if (st.counts.every(c => c >= 2) && memo.y === null && g === y && memo.d >= 2) f.newGen = true;
    return r;
  }
  // Sınav: her şekilden 10 yeni çizim, öğretilenlerin hiçbirine 2 pikselden yakın değil
  function genExam(st, net, seed) {
    const rnd = C.mulberry32(seed || 99),
      items = [];
    for (let y = 0; y < 3; y++) {
      let k = 0,
        guard = 0;
      while (k < GEN.examN && guard++ < 500) {
        const b = C.noisyBits(GEN.protos[y], 2 + Math.floor(rnd() * 2), rnd);
        if (st.examples.some(e => dist(e.bits, b) < 2)) continue;
        const m = genMemo(st, b).y,
          c = argmax(net.predict(b));
        items.push({ bits: b, y, m, c });
        k++;
      }
    }
    const memo = items.filter(i => i.m === i.y).length,
      cortex = items.filter(i => i.c === i.y).length;
    st.exam = { memo, cortex, n: items.length };
    if (st.counts.every(c => c >= 2)) st.flags.exam = true;
    return { items, memo, cortex };
  }

  const level = Lv.registerLevel({
    key: 'general',
    q: 'Ezberlemek ile anlamak aynı şey mi?',
    layered: true,
    brainShort:
      'Beyninde iki tür öğrenme yan yana çalışır. Hipokampus bir olayı tek seferde, ayrıntılarıyla kaydeder; beyin kabuğu ise birçok deneyimden yavaş yavaş ortak kuralı çıkarır. Ezber bildiğin soruda, anlamak yeni soruda işe yarar.',
    ver: 1,
    part: 'D',
    kind: 'general',
    title: 'Ezber mi, anlamak mı?',
    question:
      'Dün kahvaltıda ne yediğini hatırlarsın; “kahvaltı”nın ne olduğunu da bilirsin. Bunlar beyinde aynı şekilde mi öğreniliyor?',
    goal: 'Bir şeyi olduğu gibi ezberlemekle ortak yanını çıkararak anlamak arasındaki farkı ve beyinde ikisinin birlikte çalıştığını görmek.',
    todo: [
      'Göze bir şekil çiz, adını seç ve Öğret’e bas: iki öğrenci de aynı örneği görür.',
      'Sor’a bas: ezberci ve kavrayan ayrı ayrı cevap verir.',
      'Sonunda ikisini hiç görmedikleri 30 çizimle sına.'
    ],
    init() {
      return {
        bits: GEN.protos[0].slice(),
        label: 0,
        drawnFor: 0,
        examples: [],
        counts: [0, 0, 0],
        asks: [],
        exam: null
      };
    },
    missions: [
      {
        id: 'one',
        do: '<b>Öğret:</b> bu bir artı.',
        shows: [],
        text: 'Gözde hazır bir artı var. Adı “Artı” seçili; <b>Öğret</b>’e bas. İki öğrenci de aynı tek örneği görecek.',
        check: st => st.examples.length >= 1,
        aha: 'İkisi de ilk örneği aldı. Ezberci çizimi olduğu gibi bir kenara yazdı; kavrayan bağlantılarını biraz değiştirdi.'
      },
      {
        id: 'over',
        do: '<b>Bir kare çiz ve sor.</b>',
        shows: ['ask'],
        text: 'Şimdi “Kare”yi seç, <b>Örnek çiz</b> ile bir kare çiz ve <b>Sor</b>. İkisi ne diyor?',
        check: st => !!st.flags.over,
        aha: 'Ezberci “hatırlamıyorum” dedi: yalnız gördüğü o tek artıyı biliyor. Kavrayan ise kareye de “artı” dedi: tek örnekten her şeyin artı olduğu sonucunu çıkardı. Biri fazla katı, öbürü fazla aceleci.'
      },
      {
        id: 'all',
        do: '<b>Her şekilden 2 örnek öğret.</b>',
        shows: ['ask'],
        text: 'Her şekilden en az <b>2 örnek</b> öğret: artı, çarpı, kare.',
        check: st => st.counts.every(c => c >= 2),
        aha: 'Artık ikisinin de elinde her şekilden örnek var. Ezbercinin defteri doldu; kavrayanın bağlantıları üç şekli birbirinden ayırmaya başladı.'
      },
      {
        id: 'new',
        do: '<b>Yeni bir çizim sor.</b>',
        shows: ['ask'],
        text: 'Öğretmediğin, biraz yamuk yeni bir çizim yap ve <b>Sor</b>. Kavrayan bilsin, ezberci bilemesin.',
        check: st => !!st.flags.newGen,
        aha: 'Kavrayan hiç görmediği çizimi tanıdı, ezberci tanıyamadı. Ezberci her örneği olduğu gibi saklıyor; kavrayan örneklerin ortak yanını çıkarıyor. Buna [[genelleme]] denir.'
      },
      {
        id: 'exam',
        do: '<b>Sınava sok.</b>',
        shows: ['ask', 'exam'],
        text: '<b>Sınava sok</b>: ikisine de hiç görmedikleri 30 çizim. Hangisi kaçını bilecek?',
        check: st => !!st.flags.exam,
        aha: 'Sınavı kavrayan kazandı. Okulda da ezber, soruların aynısı gelince işe yarar; yeni bir soruda kuralı anlamış olan kazanır.'
      }
    ],
    cards: {
      brain:
        'Beyinde iki tür öğrenme yan yana çalışır. Hipokampus bir olayı tek bir kerede, ayrıntılarıyla kaydeder: dün kahvaltıda ne yediğini hatırlarsın. Beyin kabuğu ise binlerce deneyimden yavaş yavaş genel bilgi çıkarır: “kahvaltı”nın ne olduğunu bilirsin. Bu fikre tamamlayıcı öğrenme sistemleri denir (McClelland ve arkadaşları, 1995). Hipokampusu zarar gören hastalar yeni olayları hatırlayamaz ama yeni beceri ve alışkanlıkları yavaş yavaş öğrenebilir.',
      model:
        'Ezberci her çizimi olduğu gibi saklar. Sorduğun çizim sakladıklarından birine en fazla bir pikselle uyuyorsa onun adını söyler, uymuyorsa “hatırlamıyorum” der. Kavrayan 35 → 6 → 3 nöronluk bir ağdır. Her örnekte bağlantılarını biraz düzeltir (10. seviyedeki gibi), ama ezberciden yavaş öğrenir.',
      limit:
        'Gerçek hipokampus tam bir kopya saklamaz; eksik ipucundan tamamlar (13. ve 14. seviyeler). Kabuk da bazı şeyleri ezberleyebilir. Buradaki iki öğrenci, iki sistemin uç hâllerini karşılaştırmak için basitleştirildi.'
    },
    deeper: `<p><b>Ezber neden yeni çizimde çuvallıyor?</b> Ezberci yalnız “bu çizimi gördüm mü?” diye bakıyor. İki piksel farklı bir çizim onun için tamamen yeni bir şey.</p>
    <p><b>Kavrayan neden tek örnekte yanılıyor?</b> Tek bir artı görünce “ne görürsem artı” demek, o anki bütün bilgiyle tutarlı. Aşırı genelleme bundan doğar; küçük çocukların her dört ayaklıya “kuçu” demesi de buna benzer.</p>
    <p><b>Sınav kartları:</b> Hiçbiri öğrettiğin çizimlerin herhangi birine iki pikselden daha yakın değil. Böylece sınav gerçekten “hiç görmediği” sorulardan oluşuyor.</p>`
  });

  const api = { GEN, genMemo, genNet, genFit, genReplay, genTeach, genAsk, genExam, level };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
