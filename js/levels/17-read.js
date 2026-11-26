'use strict';
/* ------------------------------------------------------------------
   SEVİYE 17: Okumak
   Kelime 3×6 piksellik harflerle bir resim olarak çizilir (6 satır ×
   31 sütun = 186 göz nöronu) → 24 ara nöron → 4 tür. Ağ kelimeyi harflerin
   yerine bağlı bütün bir şekil olarak okur: bir harf yanlışına dayanır,
   ama ek alınca ya da kelime kayınca şaşırır. Farklı konumlarda da
   gösterilerek eğitilince kaymaya dayanıklı olur.
   Görünüm: js/views/read.js
------------------------------------------------------------------- */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const C = isNode
    ? require('../core.js')
    : { Net, mulberry32, parsePairs, DEFAULT_WORDS, renderWord, shiftBits, noisyBits };
  const Lv = isNode ? require('../levels.js') : { registerLevel };

  const READ = {
    cols: 31,
    rows: 6,
    hidden: 24,
    lr: 0.01,
    batch: 24,
    plain: 300,
    aug: 800,
    cats: ['hayvan', 'meyve', 'renk', 'şehir']
  };
  const low = s => String(s).toLocaleLowerCase('tr-TR').trim();
  const argmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);
  const list = () => C.parsePairs(C.DEFAULT_WORDS);

  function readBits(text, shift) {
    let b = C.renderWord(low(text), READ.cols);
    if (shift) b = C.shiftBits(b, READ.cols, shift);
    return b;
  }
  function readNet() {
    return new C.Net([READ.rows * READ.cols, READ.hidden, READ.cats.length], 1, 'softmax');
  }
  // Eğitim kartları: her kelimeden birkaç pikseli oynamış kopyalar; aug açıksa yarısı da kaydırılmış
  function readData(aug, seed) {
    const rnd = C.mulberry32(seed || 5),
      tr = [];
    for (const p of list()) {
      const b = readBits(p.w),
        y = READ.cats.indexOf(p.c);
      for (let k = 0; k < (aug ? 24 : 12); k++) {
        let x = C.noisyBits(b, Math.floor(rnd() * 3), rnd);
        if (aug && k % 2) x = C.shiftBits(x, READ.cols, Math.floor(rnd() * 9) - 4);
        tr.push({ x, y });
      }
    }
    return tr;
  }
  function readTrain(net, data, steps, rnd) {
    for (let s = 0; s < steps; s++) {
      const b = [];
      for (let k = 0; k < READ.batch; k++) b.push(data[Math.floor(rnd() * data.length)]);
      net.trainBatch(b, READ.lr);
    }
  }
  function readAccuracy(net, shift) {
    const L = list();
    return (
      L.filter(p => argmax(net.predict(readBits(p.w, shift))) === READ.cats.indexOf(p.c)).length /
      L.length
    );
  }
  // Bir kelimeyi sor; görev bayraklarını güncelle
  function readAsk(st, net, text, shift) {
    const w = low(text),
      L = list(),
      known = L.find(p => p.w === w),
      out = Array.from(net.predict(readBits(w, shift))),
      g = argmax(out);
    const r = { w, shift: shift || 0, cat: READ.cats[g], p: out[g], truth: known ? known.c : null };
    const f = st.flags;
    if (st.trained) {
      // bir harfi yanlış yazılmış bilinen kelime
      const twin = L.find(
        p =>
          !known &&
          [...p.w].length === [...w].length &&
          [...p.w].filter((ch, i) => ch !== [...w][i]).length === 1
      );
      if (twin && !shift) {
        r.twin = twin.w;
        r.truth = twin.c;
        if (READ.cats[g] === twin.c) f.typo = true;
      }
      const stem = L.find(p => !known && (w === p.w + 'ler' || w === p.w + 'lar'));
      if (stem && !shift) {
        r.stem = stem.w;
        r.truth = stem.c;
        f.suffix = true;
      }
      if (known && shift) {
        const base = Array.from(net.predict(readBits(w))),
          drop = base[READ.cats.indexOf(known.c)] - out[READ.cats.indexOf(known.c)];
        if (st.trained === 1 && (READ.cats[g] !== known.c || drop >= 0.3)) f.shiftFail = true;
        if (st.trained === 2 && READ.cats[g] === known.c) f.shiftFixed = true;
      }
    }
    st.last = r;
    st.log.unshift(r);
    st.log.length = Math.min(st.log.length, 8);
    return r;
  }

  const level = Lv.registerLevel({
    key: 'read',
    q: 'Okurken harfleri mi görürsün, kelimeyi mi?',
    layered: true,
    brainShort:
      'Okumayı öğrendiğinde beyninin sol arka tarafında kelimelere özelleşen bir alan gelişir. Deneyimli bir okur kelimeyi bütün olarak, yerinden ve yazı tipinden bağımsız tanır; bu yüzden yanlış yazılmış bir kelimeyi çoğu zaman fark etmeden okursun.',
    ver: 1,
    part: 'E',
    kind: 'read',
    title: 'Okumak',
    question:
      'Okurken gözün harfleri mi görüyor, kelimenin şeklini mi? Yanlış yazılmış bir kelimeyi nasıl yine de anlıyorsun?',
    goal: 'Kelimeyi bir resim olarak okuyan bir ağın nerede güçlü (yanlış harf), nerede zayıf (ek, kayma) olduğunu ve farklı yerlerde görerek nasıl güçlendiğini görmek.',
    todo: [
      'Eğit’e bas: ağ 14 kelimeyi piksel resmi olarak okumayı öğrensin.',
      'Kutuya bir kelime yaz ve sor; yanlış yaz, ek getir, kaydır.',
      '“Farklı yerlerde de göster”i açıp yeniden eğit, kaymış kelimeyi yine sor.'
    ],
    init() {
      return { trained: 0, aug: false, text: 'kedi', shift: 0, last: null, log: [] };
    },
    missions: [
      {
        id: 'train',
        do: '<b>Eğit.</b>',
        shows: [],
        text: '<b>Eğit</b>’e bas: ağ 14 kelimeyi piksel resmi olarak okumayı öğrensin.',
        check: st => st.trained >= 1,
        aha: 'Ağ artık 14 kelimenin resmini türüne bağlıyor. Hiçbir yerde “k harfi” diye bir nöron yok; ağ kelimenin bütün şeklini görüyor.'
      },
      {
        id: 'typo',
        do: '<b>Yanlış yaz:</b> elme. Sor.',
        shows: ['typo'],
        text: 'Bir harfi <b>yanlış yaz</b> (ör. <b>elme</b> ya da <b>mavy</b>) ve sor. Yine anlıyor mu?',
        check: st => !!st.flags.typo,
        aha: 'Anladı: kelimenin şeklinin büyük kısmı aynı kaldı. Sen de yanlış yazılmış bir kelimeyi çoğu zaman fark etmeden okursun; beyin kelimeyi harf harf hecelemek yerine bütün olarak tanır.'
      },
      {
        id: 'suffix',
        do: '<b>Ek getir:</b> kediler. Sor.',
        extra: true,
        shows: ['typo', 'suffix'],
        text: 'Bilinen bir kelimeye <b>ek getir</b> (ör. <b>kediler</b>, <b>elmalar</b>) ve sor. Ne diyor?',
        check: st => !!st.flags.suffix,
        aha: 'Ek, kelimenin şeklini uzattı ve resmin daha önce yalnız uzun kelimelerde (ör. renk adlarında) dolu olan yerlerine mürekkep koydu. Bu ağ harfleri yerlerine bağlı bir bütün olarak gördüğü için şaşırabiliyor. Sen ise “kediler”de “kedi” kökünü ve “-ler” ekini ayrı parçalar olarak tanırsın; çocuklar ekleri okumayı yıllar içinde öğrenir.'
      },
      {
        id: 'shift',
        do: '<b>Kelimeyi bir harf kaydır.</b>',
        shows: ['typo', 'shift'],
        text: 'Bilinen bir kelimeyi yaz ve <b>→</b> ile bir harf <b>sağa kaydır</b>. Tanıyor mu?',
        check: st => !!st.flags.shiftFail,
        aha: 'Kelime aynı, yalnız yeri değişti; ama ağ şaşırdı. Her ara nöron resmin belli yerlerine bakmayı öğrendi: “kedi” hep solda göründü. Senin için kelimenin sayfanın neresinde durduğu fark etmez.'
      },
      {
        id: 'fix',
        do: '<b>Farklı yerlerde göstererek eğit.</b>',
        shows: ['typo', 'shift', 'aug'],
        text: '<b>Farklı yerlerde de göster</b>’i aç, yeniden <b>eğit</b> ve kaydırılmış kelimeyi yine sor.',
        check: st => !!st.flags.shiftFixed,
        aha: 'Kelimeleri farklı yerlerde de görerek eğitilince kaymaya dayanıklı oldu. Sen de okumayı öğrenirken kelimeleri her yerde, her boyutta gördün; beynindeki okuma alanı kelimeyi nerede olursa olsun tanır.'
      }
    ],
    cards: {
      brain:
        'Okumayı öğrendiğinde beynin sol tarafında, ense ile şakak lobunun birleştiği yerde, harflere ve kelimelere özelleşen bir alan gelişir (görsel kelime biçimi alanı; Dehaene ve Cohen). Bu alan aslında yüzleri ve nesneleri tanıyan devrelerin bir parçası: okuma, bu devreleri yeni bir işe “geri dönüştürür”. Burada önce harfler, sonra harf çiftleri, sonra kelimeler tanınır; deneyimli bir okur kelimeyi yerinden, boyutundan ve yazı tipinden bağımsız tanır.',
      model:
        'Kelime 3×6 piksellik harflerle çizilir: 186 göz nöronu → 24 ara nöron → 4 tür (hayvan, meyve, renk, şehir). Ağ her kelimeyi birkaç pikseli oynamış kopyalarıyla görür. “Farklı yerlerde de göster” açıkken kopyaların yarısı da birkaç piksel sağa ya da sola kaydırılır.',
      limit:
        'Gerçek okuma harf, hece ve ek gibi parçaları ayrı ayrı tanıyan katmanlarla yürür; burada tek bir ara katman kelimenin bütün resmine bakıyor. Anlam da yalnız dört türden ibaret değil (16. seviye).'
    },
    deeper: `<p><b>Neden kayınca şaşırıyor?</b> Bir ara nöronun bağlantıları resmin belli piksellerine bağlı. “kedi” bir harf sağa kayınca ateşlenen pikseller bambaşka bağlantılara denk gelir; ağın gözünde başka bir resimdir.</p>
    <p><b>Beynin çözümü:</b> Görme yolunda alt katmanlarda aynı küçük şekle (bir çizgi, bir köşe) her yerde tepki veren dedektörler vardır; üst katmanlar bunları toplayarak yere daha az bağlı hâle gelir. Burada bu, kelimeleri farklı yerlerde göstererek taklit ediliyor.</p>`
  });

  const api = {
    READ,
    readBits,
    readNet,
    readData,
    readTrain,
    readAccuracy,
    readAsk,
    readList: list,
    level
  };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
