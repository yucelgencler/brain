'use strict';
/* ------------------------------------------------------------------
   SEVİYE 16: Kelimelerin anlamı
   Her kelime bir girdi nöronu, her anlam türü (hayvan, meyve, renk,
   şehir) bir cevap nöronu; arada 8 ara nöron. Eğitim ilerledikçe aynı
   türden kelimeler ara nöronlarda benzer desenler bırakır: “anlam
   haritasında” kümelenir. Hiç duymadığı bir kelime için nöron yoktur.
   Görünüm: js/views/words.js
------------------------------------------------------------------- */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const C = isNode ? require('../core.js') : { Net, mulberry32, parsePairs, DEFAULT_WORDS, pca2 };
  const Lv = isNode ? require('../levels.js') : { registerLevel };

  const WORDS = {
    hidden: 8,
    lr: 0.03,
    cats: ['hayvan', 'meyve', 'renk', 'şehir'],
    icons: ['🐾', '🍎', '🎨', '🏙️']
  };
  const low = s => String(s).toLocaleLowerCase('tr-TR').trim();

  function wordsList(st) {
    return C.parsePairs(C.DEFAULT_WORDS).concat(st.custom);
  }
  function wordsNet(n) {
    return new C.Net([n, WORDS.hidden, WORDS.cats.length], 3, 'softmax');
  }
  const oneHot = (i, n) => {
    const x = new Array(n).fill(0);
    x[i] = 1;
    return x;
  };
  function wordsTrain(net, list, steps) {
    const batch = list.map((p, i) => ({ x: oneHot(i, list.length), y: WORDS.cats.indexOf(p.c) }));
    let loss = 0;
    for (let s = 0; s < steps; s++) loss = net.trainBatch(batch, WORDS.lr);
    return loss;
  }
  // Ara nöronlardaki iç desen (her kelime için)
  function wordsHidden(net, list) {
    return list.map((p, i) => Array.from(net.forward(oneHot(i, list.length))[1]));
  }
  function cos(a, b) {
    let d = 0,
      na = 0,
      nb = 0;
    for (let k = 0; k < a.length; k++) {
      d += a[k] * b[k];
      na += a[k] * a[k];
      nb += b[k] * b[k];
    }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  }
  function wordsNeighbors(net, list, i, k) {
    const H = wordsHidden(net, list);
    return list
      .map((p, j) => ({ j, w: p.w, c: p.c, sim: cos(H[i], H[j]) }))
      .filter(o => o.j !== i)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, k || 3);
  }
  // Kümelenme: aynı türden çiftlerin ortalama benzerliği − farklı türden çiftlerinki
  function wordsClustering(net, list) {
    const H = wordsHidden(net, list);
    let s = 0,
      ns = 0,
      d = 0,
      nd = 0;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const v = cos(H[i], H[j]);
        if (list[i].c === list[j].c) {
          s += v;
          ns++;
        } else {
          d += v;
          nd++;
        }
      }
    return { same: s / ns, diff: d / nd, gap: s / ns - d / nd };
  }
  function wordsAccuracy(net, list) {
    let ok = 0;
    list.forEach((p, i) => {
      const out = net.predict(oneHot(i, list.length));
      if (out.indexOf(Math.max(...out)) === WORDS.cats.indexOf(p.c)) ok++;
    });
    return ok / list.length;
  }
  function wordsAsk(st, net, word) {
    const list = wordsList(st),
      i = list.findIndex(p => p.w === low(word));
    if (i < 0) {
      st.flags.unknown = true;
      return { known: false, w: low(word) };
    }
    const out = Array.from(net.predict(oneHot(i, list.length))),
      g = out.indexOf(Math.max(...out));
    return { known: true, i, w: list[i].w, cat: WORDS.cats[g], p: out[g], truth: list[i].c };
  }
  // Görev bayrakları (eğitimden ya da seçimden sonra)
  function wordsRecord(st, net, sel) {
    const list = wordsList(st),
      acc = wordsAccuracy(net, list),
      cl = wordsClustering(net, list);
    st.acc = acc;
    st.gap = cl.gap;
    if (acc === 1 && cl.gap > 0.3) st.flags.trained = true;
    if (sel != null && st.flags.trained) {
      const nb = wordsNeighbors(net, list, sel, 1)[0];
      if (nb && nb.c === list[sel].c) st.flags.near = true;
      if (st.custom.some(c => c.w === list[sel].w) && acc === 1 && nb && nb.c === list[sel].c)
        st.flags.newPlaced = true;
    }
  }

  const level = Lv.registerLevel({
    key: 'words',
    ver: 1,
    part: 'E',
    kind: 'words',
    title: 'Kelimelerin anlamı',
    question:
      '“Kedi” ile “köpek” sana neden “kedi” ile “mavi”den daha yakın geliyor? Anlam beyinde nerede?',
    goal: 'Aynı türden kelimelerin, öğrendikçe ara nöronlarda birbirine benzeyen desenler bıraktığını görmek: anlam, bir nöronda değil, bu desenlerin benzerliğinde.',
    todo: [
      'Eğit’e bas ve anlam haritasında kelimelerin nasıl kümelendiğini izle.',
      'Haritadan bir kelime seç: en yakın komşularına ve iç desenine bak.',
      'Yeni bir kelime öğret, sonra hiç duymadığı bir kelimeyi sor.'
    ],
    init() {
      return { custom: [], steps: 0, sel: null, acc: 0, gap: 0, ask: null };
    },
    missions: [
      {
        id: 'train',
        text: '<b>Eğit</b>’e bas: ağ 14 kelimeyi türleriyle (hayvan, meyve, renk, şehir) öğrensin. Anlam haritasında ne oluyor?',
        check: st => !!st.flags.trained,
        aha: 'Başta dağınık duran kelimeler türlerine göre öbeklendi. Kimse ağa “kedi ile köpek benzer” demedi; yalnız ikisinin de hayvan olduğunu öğrendi. Aynı cevaba giden kelimeler ara nöronlarda benzer desenler bırakmaya başladı.'
      },
      {
        id: 'near',
        text: 'Haritadan bir kelimeye tıkla: <b>en yakın komşuları</b> kimler?',
        check: st => !!st.flags.near,
        aha: 'En yakın komşuları kendi türünden. Beyinde de böyle: “doktor” kelimesini duyunca “hemşire”yi daha hızlı tanırsın, çünkü anlamca yakın kavramlar birbirine benzeyen nöron gruplarını yakar (anlamsal hazırlama).'
      },
      {
        id: 'new',
        text: 'Yeni bir kelime öğret (ör. <b>zürafa = hayvan</b>), yeniden eğit ve haritada ona tıkla: nereye yerleşti?',
        check: st => !!st.flags.newPlaced,
        aha: 'Yeni kelime için yeni bir nöron eklendi ve kendi türünün yanına yerleşti. Yeni bir kelime öğrendiğinde beynin de onu bildiğin kavramların arasına bağlar.'
      },
      {
        id: 'unknown',
        text: 'Hiç öğretmediğin bir kelimeyi sor (ör. <b>kaplan</b>). Ne diyor?',
        check: st => !!st.flags.unknown,
        aha: 'Bilmiyor: o kelime için ağda hiçbir nöron yok. Sen ise hiç duymadığın bir kelimenin anlamını çoğu zaman çıkarabilirsin; yazılışından, eklerinden, cümleden. Kelimenin harflerine bakarak tahmin etmek 17. seviyenin konusu.'
      }
    ],
    cards: {
      brain:
        'Kelimelerin anlamı beynin tek bir köşesinde durmaz; şakak lobunun ön ve alt kısımları kavramları toplayan bir merkez gibi çalışır, ama bir kelime aynı zamanda ona ait görüntü, ses, hareket ve duygu bölgelerini de yakar. 2016’da Huth ve arkadaşları, insanlar hikâye dinlerken çekilen beyin taramalarından bir “anlam atlası” çıkardı: benzer anlamlı kelimeler kabukta benzer yerleri harekete geçiriyordu.',
      model:
        'Her kelime bir girdi nöronu, her tür bir cevap nöronu, arada 8 ara nöron. Anlam haritası, her kelimenin ara nöronlarda bıraktığı 8 sayılık deseni iki boyuta indirip çiziyor. Komşuluk yüzdesi, iki kelimenin iç desenlerinin ne kadar benzediği.',
      limit:
        'Gerçek beyinde bir kelimenin anlamı yalnız “türünden” gelmez; tadı, sesi, kullanıldığı cümleler, hatıralar da onun parçasıdır. Burada ağ yalnız dört türü öğreniyor ve kelimeler birbirinden bağımsız birer nöron; benzerlik sadece aynı cevaba gitmekten doğuyor.'
    },
    deeper: `<p><b>Harita nasıl çiziliyor?</b> Her kelimenin ara nöronlardaki deseni 8 sayıdır. Bu 8 boyutlu noktaları en çok yayıldıkları iki yöne bakarak düzleme indiriyoruz (temel bileşenler). Yakın duran noktalar benzer desenler demek.</p>
    <p><b>Benzerlik yüzdesi:</b> İki desenin aynı yönü gösterme derecesi (kosinüs benzerliği). %100 aynı yön, %0 alakasız, eksi değerler zıt yön.</p>`
  });

  const api = {
    WORDS,
    wordsList,
    wordsNet,
    wordsTrain,
    wordsHidden,
    wordsNeighbors,
    wordsClustering,
    wordsAccuracy,
    wordsAsk,
    wordsRecord,
    wordsOneHot: oneHot,
    level
  };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
