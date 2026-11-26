'use strict';
/* ------------------------------------------------------------------
   SEVİYE 10: Şekil tanıma (basit) ve SEVİYE 11: Rakam tanıma (gelişmiş)

   Şekil tanıma: üç şekil (artı, çarpı, kare). Kullanıcı 5×7 göze çizer,
   adını seçip öğretir ya da öğretmeden sınar. Nöron ağı:
   35 göz nöronu → 6 ara nöron → 3 cevap nöronu.
   Rakam tanıma: 0–9 rakamları (+ kendi şekillerin), ağ büyüklüğü,
   bozukluk, öğrenme eğrisi, gördüklerini / hiç görmediklerini bilme.
   İki seviye aynı modeli ve aynı görünümü paylaşır (st.mode).

   Ağ: core.js'teki Net (ileri hesap, geri yayılım, Adam).
   Bu dosya arayüzden bağımsız; görünüm js/views/shapes.js.
------------------------------------------------------------------- */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  // Tarayıcıda core.js ve levels.js klasik betik olarak önce yüklenir; adları ortak kapsamda.
  const C = isNode ? require('../core.js') : { Net, noisyBits, mulberry32, DIGIT_BITS };
  const Lv = isNode ? require('../levels.js') : { registerLevel };

  const rowsToBits = rows =>
    rows
      .join('')
      .split('')
      .map(c => (c === '#' ? 1 : 0));

  const SHAPES = {
    names: ['Artı', 'Çarpı', 'Kare'],
    protos: [
      rowsToBits(['  #  ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '  #  ']),
      rowsToBits(['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #']),
      rowsToBits(['#####', '#   #', '#   #', '#   #', '#   #', '#   #', '#####'])
    ],
    hidden: 6,
    lr: 0.05,
    stepsPerTeach: 60,
    // gelişmiş mod
    adv: { hidden: 16, noise: 2, lr: 0.002, batch: 16, maxSteps: 600 }
  };

  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const dist = (a, b) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0);
  const argmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);

  /* ---------- Basit mod ---------- */
  function shapesNet() {
    return new C.Net([35, SHAPES.hidden, SHAPES.names.length], 7, 'softmax');
  }
  // Her adımda öğretilen örnekler ve birer pikseli oynamış kopyaları birlikte tekrar edilir
  function shapesFit(net, examples, steps, rnd) {
    if (!examples.length) return;
    for (let s = 0; s < steps; s++) {
      const batch = [];
      for (const e of examples) {
        batch.push({ x: e.bits, y: e.y });
        batch.push({ x: C.noisyBits(e.bits, 1, rnd), y: e.y });
      }
      net.trainBatch(batch, SHAPES.lr);
    }
  }
  // Kayıttaki örneklerden beyni baştan, aynı sırayla yeniden kur (sayfa yenilense de aynı sonuç)
  function shapesReplay(st) {
    const net = shapesNet(),
      rnd = C.mulberry32(11),
      seen = [];
    for (const e of st.examples) {
      seen.push(e);
      shapesFit(net, seen, SHAPES.stepsPerTeach, rnd);
    }
    net._rnd = rnd;
    return net;
  }
  function shapesPredict(net, bits) {
    return Array.from(net.predict(bits));
  }
  function shapesTeach(st, net, bits, y) {
    st.examples.push({ bits: bits.slice(), y });
    st.counts[y] = (st.counts[y] || 0) + 1;
    shapesFit(net, st.examples, SHAPES.stepsPerTeach, net._rnd || (net._rnd = C.mulberry32(11)));
    // yanlış bildiği bir çizim doğrusuyla öğretildiyse işaretle
    if (st.wrong.some(w => same(w.bits, bits) && w.y === y)) st.flags.taughtWrong = true;
  }
  function shapesTest(st, net, bits, y) {
    const p = shapesPredict(net, bits),
      guess = argmax(p),
      ok = guess === y;
    const fresh = !st.examples.some(e => same(e.bits, bits));
    st.tests.unshift({ bits: bits.slice(), y, guess, ok, p: Math.round(p[guess] * 100) });
    st.tests.length = Math.min(st.tests.length, 8);
    if (ok && fresh && st.examples.length >= 4) st.flags.newRight = true;
    if (!ok) {
      if (!st.wrong.some(w => same(w.bits, bits))) st.wrong.push({ bits: bits.slice(), y });
    } else if (st.wrong.some(w => same(w.bits, bits) && w.y === y) && st.flags.taughtWrong)
      st.flags.fixed = true;
    return { guess, ok, p };
  }

  /* ---------- Gelişmiş mod: rakamlar ---------- */
  function advLabels(adv) {
    return Object.keys(C.DIGIT_BITS).concat(adv.custom.map(c => c.label));
  }
  function advDataset(adv) {
    const labels = advLabels(adv),
      rnd = C.mulberry32(97 + adv.noise * 31 + adv.custom.length * 7),
      train = [],
      test = [];
    const sources = Object.keys(C.DIGIT_BITS)
      .map(k => ({ label: k, bits: C.DIGIT_BITS[k] }))
      .concat(adv.custom);
    for (const s of sources) {
      const y = labels.indexOf(s.label);
      train.push({ x: s.bits.slice(), y });
      for (let k = 0; k < 23; k++)
        train.push({ x: C.noisyBits(s.bits, Math.floor(rnd() * (adv.noise + 1)), rnd), y });
      for (let k = 0; k < 8; k++)
        test.push({ x: C.noisyBits(s.bits, Math.max(1, adv.noise), rnd), y });
    }
    return { labels, train, test };
  }
  function advNet(adv, n) {
    return new C.Net([35, adv.hidden, n], 1, 'softmax');
  }
  function advAccuracy(net, set) {
    let ok = 0;
    for (const e of set) if (argmax(net.predict(e.x)) === e.y) ok++;
    return set.length ? ok / set.length : 0;
  }
  function advTrain(net, ds, steps, rnd) {
    let loss = 0;
    for (let s = 0; s < steps; s++) {
      const b = [];
      for (let i = 0; i < SHAPES.adv.batch; i++)
        b.push(ds.train[Math.floor(rnd() * ds.train.length)]);
      loss = net.trainBatch(b, SHAPES.adv.lr);
    }
    return loss;
  }
  // Sınav kartlarında en çok karıştırılanlar
  function advConfusions(net, ds, max) {
    const out = [];
    for (const e of ds.test) {
      const g = argmax(net.predict(e.x));
      if (g !== e.y) out.push({ bits: e.x, truth: ds.labels[e.y], guess: ds.labels[g] });
      if (out.length >= (max || 6)) break;
    }
    return out;
  }
  // Eğitimden sonra görev bayraklarını güncelle
  function advRecord(st, stats) {
    const a = st.adv;
    a.steps = stats.steps;
    a.trainAcc = stats.trainAcc;
    a.testAcc = stats.testAcc;
    if (stats.trainAcc >= 0.9 && a.hidden >= 8) st.flags.adv90 = true;
    if (a.hidden === 2 && stats.steps >= 300) st.flags.smallDone = true;
    if (a.noise >= 6 && a.hidden >= 8 && stats.steps >= 300) st.flags.noiseDone = true;
    if (a.custom.length && a.hidden >= 8 && stats.trainAcc >= 0.9) st.flags.ownDone = true;
  }
  function shapesInit(mode) {
    return {
      mode,
      bits: mode === 'adv' ? C.DIGIT_BITS[3].slice() : SHAPES.protos[0].slice(),
      label: 0,
      drawnFor: 0,
      examples: [],
      counts: [0, 0, 0],
      tests: [],
      wrong: [],
      adv: { hidden: SHAPES.adv.hidden, noise: SHAPES.adv.noise, custom: [], steps: 0 }
    };
  }

  const level = Lv.registerLevel({
    key: 'shapes',
    q: 'Hiç görmediğin bir el yazısını nasıl tanırsın?',
    ver: 1,
    layered: true,
    brainShort:
      'Beynin bir şekli tanırken önce kenarları ve çizgileri, sonra onların birleşimlerini yakalar. Hiçbir yerde “artının resmi” saklanmaz; artı, belli nöronların birlikte ateşleme desenidir. Bu yüzden hiç görmediğin bir el yazısını da tanırsın.',
    part: 'C',
    kind: 'shapes',
    title: 'Şekil tanıma',
    question:
      'Daha önce hiç görmediğin bir el yazısını nasıl tanırsın? Birkaç örnek görmek neden yetiyor?',
    goal: 'Birkaç örnekten öğrenen bir nöron ağının, hiç görmediği çizimleri nasıl tanıdığını (genelleme) ve nerede yanıldığını görmek.',
    todo: [
      'Gözdeki piksellere dokunarak bir şekil çiz.',
      'Ne olduğunu seç ve “Öğret”e bas; birkaç örnekten sonra yeni bir çizimi “Sına”.',
      'Yanıldığı bir çizimi doğrusunu öğreterek düzelt.'
    ],
    init: () => shapesInit('simple'),
    missions: [
      {
        id: 'teach',
        do: '<b>Öğret:</b> bu bir artı.',
        shows: [],
        text: 'Göze bir şekil çiz (hazır bir <b>artı</b> var), adını seç ve <b>Öğret</b>’e bas.',
        check: st => st.examples.length >= 1,
        aha: 'İlk örnek. Ağ bu çizimi seçtiğin cevap nöronuna bağlayan bağlantıları güçlendirdi. Tek bir örnekle henüz her çizimi aynı şey sanar; bunu cevap çubuklarında görebilirsin.'
      },
      {
        id: 'all',
        do: '<b>Her şekilden 2 örnek öğret.</b>',
        shows: ['tray'],
        text: 'Her şekilden en az <b>2 örnek</b> öğret: artı, çarpı, kare. “Örnek çiz” düğmesi sana biraz bozuk birer çizim verir.',
        check: st => st.counts.every(c => c >= 2),
        aha: 'Her şekil için birkaç örnek gördü. Ara nöronlar artık çizginin nerede olduğuna göre ayrışıyor: ortadaki dikey çizgi artıyı, dört köşe kareyi, çapraz çizgiler çarpıyı ele veriyor.'
      },
      {
        id: 'test',
        do: '<b>Yeni bir çizim çiz ve sına.</b>',
        shows: ['tray'],
        text: 'Öğretmediğin, biraz yamuk yeni bir çizim yap, ne olduğunu seç ve <b>Sına</b>. Doğru bilsin.',
        check: st => !!st.flags.newRight,
        aha: 'Hiç görmediği bir çizimi doğru tanıdı. Buna [[genelleme]] denir. Sen de bir harfin yüzlerce farklı el yazısını, her birini ayrı ayrı ezberlemeden tanırsın.'
      },
      {
        id: 'fix',
        do: '<b>Yanıldığı çizimi düzelt.</b>',
        extra: true,
        shows: ['tray'],
        text: 'Yanıldığı bir çizim bul (ör. iki şeklin arasında bir şey çiz). Ona doğrusunu <b>öğret</b>, sonra aynı çizimi yeniden <b>sına</b>.',
        check: st => !!st.flags.fixed,
        aha: 'Yanlıştan öğrendi: hata, bağlantıları tam o çizimi düzeltecek yönde değiştirdi. Beynin en çok yanıldığı ya da şaşırdığı yerde öğrendiğini 5. seviyede görmüştün.'
      }
    ],
    cards: {
      brain:
        'Görme kabuğunda nöronlar önce kenar ve çizgi gibi küçük parçalara tepki verir; daha ileri bölgeler, özellikle şakak lobunun alt yüzü, bu parçaları harf, rakam, yüz gibi bütünlere bağlar. Okumayı öğrenen bir çocukta sol tarafta harflere ve rakamlara özelleşen küçük bir alan gelişir. Bir rakamı birkaç farklı el yazısında görmek, hiç görmediğin yazıları tanımaya yeter.',
      model:
        '35 piksellik göz → ara nöronlar → her şekil için bir cevap nöronu. Her öğrettiğin örnekte doğru cevaba giden bağlantılar biraz güçlenir, yanlışa gidenler zayıflar; hata, 8. seviyedeki gibi ara nöronlara geri paylaştırılır. Ağ her örneği birkaç pikseli oynamış kopyalarıyla birlikte tekrar eder.',
      limit:
        'Gerçek beyin bir rakamı tanırken yüz milyonlarca nöron ve yıllar içinde görülmüş binlerce yazı kullanır; öğrenmesi de büyük olasılıkla bu modeldeki geri paylaştırmadan farklıdır. 5×7 piksel, retinanın milyonlarca hücresinin yanında çok kaba bir göz.'
    },
    deeper: `<p><b>Ne kadar emin?</b> Cevap nöronlarının çubukları toplamda %100 eder: biri güçlenirse ötekiler küçülür. Beyin de rakip yorumlar arasında bir tanesini seçer; buna yarışan nöronlar arasında susturmayla varılır (3. seviye).</p>
    <p><b>Yanılma payı:</b> Doğru cevabın çubuğu ne kadar kısaysa o kadar büyür. Eğitim, her adımda bu payı biraz küçültecek yönde bağlantıları düzeltir.</p>`
  });

  const digitsLevel = Lv.registerLevel({
    key: 'digits',
    q: 'On rakamı ayırmaya kaç nöron yeter?',
    ver: 1,
    layered: true,
    brainShort:
      'Beyninde hiçbir yerde “3’ün resmi” saklanmaz; 3, belli nöronların birlikte ateşleme desenidir. Ayırt etmen gereken şey çoğaldıkça daha çok nörona ve bağlantıya ihtiyaç olur. Bozuk yazılmış bir rakamı tanıman, beynin eksik bir deseni tamamlamasıdır.',
    part: 'C',
    kind: 'shapes',
    title: 'Rakam tanıma',
    question:
      'On rakamı birbirinden ayırmak için kaç nöron gerekir? Çok bozuk yazılmış bir rakamı nasıl tanırsın?',
    goal: 'Daha büyük bir ağın on rakamı nasıl öğrendiğini; ağ küçülünce ve çizimler bozulunca neyin değiştiğini görmek.',
    todo: [
      '“Eğit”e bas ve öğrenme eğrisini izle.',
      'Ağı 2 nörona indir: hangi rakamlar karışıyor?',
      'Bozukluğu artır: gördükleri ile hiç görmedikleri ayrışıyor mu?'
    ],
    init: () => shapesInit('adv'),
    missions: [
      {
        id: 'ten',
        do: '<b>Eğit:</b> on rakamı öğrensin.',
        shows: [],
        text: '<b>Eğit</b>’e bas ve öğrenme eğrisini izle: gördüklerini %90’ın üstünde bilsin.',
        check: st => !!st.flags.adv90,
        aha: 'On rakam, yüzlerce örnek. Hiçbir yerde “3’ün resmi” saklanmıyor: 3, belli bağlantıların birlikte ateşlenme deseni. Bozuk bir 3’ü yine tanıması, beynin de eksik bir deseni tamamlamasına benzer.'
      },
      {
        id: 'small',
        do: '<b>Ağı 2 nörona indir.</b>',
        shows: ['size'],
        text: 'Ağ büyüklüğünü <b>2 nörona</b> indir ve yeniden eğit. Ne kadarını bilebiliyor, hangi rakamları karıştırıyor?',
        check: st => !!st.flags.smallDone,
        aha: 'İki ara nöron on rakamı birbirinden ayırmaya yetmiyor; benzer rakamlar (3 ile 8, 5 ile 6 gibi) karışıyor. Bir beyin bölgesinin kaç şeyi ayırt edebileceği oradaki nöron ve bağlantı sayısına bağlı.'
      },
      {
        id: 'noise',
        do: '<b>Bozukluğu 6’ya çıkar.</b>',
        shows: ['size', 'noise'],
        text: 'Ağı yeniden 16 nörona çıkar, <b>bozukluğu 6 piksele</b> getir ve eğit. Gördüklerini ve hiç görmediklerini bilme oranlarını karşılaştır.',
        check: st => !!st.flags.noiseDone,
        aha: 'Bu kez hiç görmediklerini bilme, gördüklerini bilmenin gerisinde kaldı: çok bozuk bir çizimde rakamın kendisi kaybolmaya başlıyor ve ağ gördüklerini bir ölçüde ezberliyor. Yine de çeşitli örnek görmek, hiç görmediği bozuk çizimlerin çoğunu tanımasını sağladı. Ezber ile genelleme arasındaki bu fark 15. seviyenin konusu.'
      },
      {
        id: 'own',
        do: '<b>Kendi şeklini ekle</b> ve yeniden eğit.',
        extra: true,
        shows: ['size', 'noise', 'custom'],
        text: 'Göze kendi şeklini çiz (ör. bir kalp), ona bir ad ver ve <b>Ekle</b>’ye bas. Sonra yeniden <b>eğit</b>: ağ yeni şekli de öğrensin.',
        check: st => !!st.flags.ownDone,
        aha: 'Ağa yeni bir cevap nöronu eklendi ve onu da öğrendi. Beynin de yeni bir şekli öğrenmek için yeni bir bölgeye ihtiyacı yok; var olan bağlantılar yeniden ayarlanır.'
      }
    ],
    cards: {
      brain:
        'Görme kabuğundan şakak lobunun alt yüzüne doğru nöronlar giderek daha büyük parçalara tepki verir: önce kenar, sonra köşe ve kıvrım, en sonda harf ve rakam. Okumayı öğrenen bir çocukta sol tarafta harflere ve rakamlara özelleşen küçük bir alan gelişir. Bir bölgenin kaç şeyi ayırt edebildiği oradaki nöron ve bağlantı sayısına bağlıdır.',
      model:
        '35 piksellik göz → ayarlanabilir sayıda ara nöron → her rakam için bir cevap nöronu. Her rakamın biraz bozuk 24 eğitim kopyası var; ağ her adımda bunlardan rastgele 16’sını görüp bağlantılarını düzeltir. Kendi çizdiğin bir şekli ekleyince ağa yeni bir cevap nöronu eklenir.',
      limit:
        'Gerçek beyin bir rakamı tanırken yüz milyonlarca nöron ve yıllar içinde görülmüş binlerce yazı kullanır; öğrenmesi de büyük olasılıkla bu modeldeki geri paylaştırmadan farklıdır. 5×7 piksel, retinanın milyonlarca hücresinin yanında çok kaba bir göz.'
    },
    deeper: `<p><b>Gördükleri ve hiç görmedikleri:</b> Her rakamın 24 eğitim kartı ve 8 sınav kartı var; her eğitim adımında rastgele 16 kart tekrar edilir. Sınav kartları eğitimde hiç gösterilmez. Gördüklerini çok iyi bilip hiç görmediklerini bilemiyorsa ezberlemiştir; ikisi yakınsa genellemiştir.</p>
    <p><b>Kaç nöron?</b> İki ara nöron ancak birkaç kaba deseni ayırabilir; benzer rakamlar (3 ile 8, 5 ile 6) aynı desene düşer. Nöron sayısı arttıkça ağ ince farkları da yakalar, ama bir noktadan sonra fazlası yalnız ezberi kolaylaştırır.</p>`
  });

  const api = {
    SHAPES,
    shapesNet,
    shapesFit,
    shapesReplay,
    shapesPredict,
    shapesTeach,
    shapesTest,
    advLabels,
    advDataset,
    advNet,
    advAccuracy,
    advTrain,
    advConfusions,
    advRecord,
    shapesInit,
    level,
    digitsLevel
  };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
