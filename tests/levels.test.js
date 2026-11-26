// Ayrı dosyada duran seviyelerin (js/levels/*.js) testleri. Çalıştırmak için: node tests/levels.test.js
'use strict';
const assert = require('assert');
const C = require('../js/core.js');
const Lv = require('../js/levels.js');
const S = require('../js/levels/10-shapes.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓ ' + name);
}
const fresh = lv => Object.assign(lv.init(), { flags: {} });
const check = (lv, st) => lv.missions.filter(m => m.check(st)).map(m => m.id);

test('seviye 10 yol haritasında yerinde ve hazır', () => {
  const r = Lv.ROADMAP.find(x => x.key === 'shapes');
  assert.strictEqual(r.id, 10);
  assert.strictEqual(r.level, S.level);
  assert.strictEqual(S.level.id, 10);
  assert.ok(!r.note && !r.lab);
  assert.deepStrictEqual(Object.keys(S.level.cards).sort(), ['brain', 'limit', 'model']);
});
test('basit mod: her şekilden 2 örnekle, hiç görmediği bozuk çizimleri tanır', () => {
  const st = fresh(S.level),
    net = S.shapesNet(),
    rnd = C.mulberry32(5);
  for (let y = 0; y < 3; y++)
    for (let k = 0; k < 2; k++) S.shapesTeach(st, net, C.noisyBits(S.SHAPES.protos[y], k, rnd), y);
  assert.deepStrictEqual(check(S.level, st), ['teach', 'all']);
  let ok = 0;
  for (let y = 0; y < 3; y++)
    for (let k = 0; k < 10; k++)
      ok += S.shapesTest(st, net, C.noisyBits(S.SHAPES.protos[y], 2, rnd), y).ok;
  assert.ok(ok >= 27, 'doğru: ' + ok + '/30');
  assert.ok(st.flags.newRight);
});
test('basit mod: yanıldığı çizim öğretilince aynı çizimi doğru bilir', () => {
  const st = fresh(S.level),
    net = S.shapesNet();
  for (let y = 0; y < 3; y++) S.shapesTeach(st, net, S.SHAPES.protos[y], y);
  // artı ile çarpının karışımı; kullanıcı “kare” diyor (beklenmedik bir cevap)
  const odd = S.SHAPES.protos[1].map((v, i) => v | S.SHAPES.protos[0][i]);
  let r = S.shapesTest(st, net, odd, 2);
  assert.ok(!r.ok, 'önce yanılmalı');
  S.shapesTeach(st, net, odd, 2);
  r = S.shapesTest(st, net, odd, 2);
  assert.ok(r.ok);
  assert.ok(st.flags.fixed);
});
test('basit mod: yeniden kurulan beyin aynı cevapları verir', () => {
  const st = fresh(S.level),
    net = S.shapesNet();
  for (let y = 0; y < 3; y++) S.shapesTeach(st, net, S.SHAPES.protos[y], y);
  const again = S.shapesReplay(st);
  const a = S.shapesPredict(net, S.SHAPES.protos[1]),
    b = S.shapesPredict(again, S.SHAPES.protos[1]);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9));
});
test('gelişmiş mod: 16 nöron on rakamı öğrenir, 2 nöron öğrenemez', () => {
  const run = (hidden, noise) => {
    const adv = { hidden, noise, custom: [] },
      ds = S.advDataset(adv),
      net = S.advNet(adv, ds.labels.length);
    S.advTrain(net, ds, 400, C.mulberry32(3));
    return { tr: S.advAccuracy(net, ds.train), te: S.advAccuracy(net, ds.test) };
  };
  const big = run(16, 2),
    small = run(2, 2);
  assert.ok(big.tr >= 0.95 && big.te >= 0.9, JSON.stringify(big));
  assert.ok(small.tr < 0.75, JSON.stringify(small));
});
test('gelişmiş mod: görev bayrakları ve kendi şeklin', () => {
  const st = fresh(S.level);
  st.adv.hidden = 2;
  S.advRecord(st, { steps: 300, trainAcc: 0.5, testAcc: 0.5 });
  assert.ok(st.flags.smallDone && !st.flags.adv90);
  st.adv.hidden = 16;
  st.adv.noise = 6;
  S.advRecord(st, { steps: 300, trainAcc: 1, testAcc: 0.95 });
  assert.ok(st.flags.adv90 && st.flags.noiseDone);
  const heart = S.SHAPES.protos[2].slice();
  st.adv.custom.push({ label: 'kalp', bits: heart });
  const ds = S.advDataset(st.adv);
  assert.strictEqual(ds.labels.length, 11);
  assert.strictEqual(ds.labels[10], 'kalp');
  assert.strictEqual(ds.train.length, 11 * 24);
});

const W13 = require('../js/levels/13-where.js');
test('seviye 13: yarım ipucundan anı geri gelir; nöron ve bağlantı kaybına dayanıklı', () => {
  const st = fresh(W13.level);
  assert.strictEqual(W13.level.id, 13);
  W13.memRun(st);
  assert.ok(st.flags.recalled, 'Pamuk’un yarısından Pamuk');
  st.dead = [3, 9, 14, 20, 27, 33];
  for (const k of [0, 1, 2]) {
    st.cue = W13.memHalf(k);
    st.cueOf = k;
    W13.memRun(st);
  }
  assert.ok(st.flags.oneDead);
  assert.deepStrictEqual(st.flags.many.slice().sort(), [0, 1, 2]);
  st.dead = [];
  st.cut = 0.5;
  st.cue = W13.memHalf(1);
  st.cueOf = 1;
  W13.memRun(st);
  assert.ok(st.flags.cutHalf, 'bağlantıların yarısı kopsa da hatırlar');
  assert.deepStrictEqual(check(W13.level, st), ['recall', 'one', 'many', 'cut']);
});
test('seviye 13: ağır hasar anıyı birden değil, yavaş yavaş bozar', () => {
  const avg = cut => {
    let s = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const mask = W13.memMask(cut, seed),
        dead = new Uint8Array(36);
      for (let k = 0; k < 3; k++) {
        const steps = W13.memRecall(W13.memHalf(k), dead, mask, seed);
        s += W13.memSim(steps[steps.length - 1], W13.MEM.pats[k], dead);
      }
    }
    return s / 18;
  };
  const a = avg(0),
    b = avg(0.7),
    c = avg(0.9);
  assert.ok(a === 1, 'hasarsız tam: ' + a);
  assert.ok(b < a && c < b, `azalıyor: ${a} ${b} ${c}`);
  assert.ok(c > 0.6, 'ağır hasarda bile tamamen kaybolmuyor: ' + c);
});
const G14 = require('../js/levels/14-general.js');
const S15 = require('../js/levels/15-sleep.js');
test('seviye 14: tek örnekte ezberci "hatırlamıyorum", kavrayan aşırı genelliyor; sınavı kavrayan kazanır', () => {
  const st = fresh(G14.level),
    net = G14.genNet();
  assert.strictEqual(G14.level.id, 14);
  G14.genTeach(st, net, G14.GEN.protos[0], 0);
  const r = G14.genAsk(st, net, G14.GEN.protos[2], 2);
  assert.strictEqual(r.memo, null);
  assert.strictEqual(r.cortex, 0, 'kareye de artı der');
  assert.ok(st.flags.over);
  const rnd = C.mulberry32(4);
  for (let y = 0; y < 3; y++)
    for (let k = 0; k < 2; k++)
      if (y || k) G14.genTeach(st, net, C.noisyBits(G14.GEN.protos[y], k, rnd), y);
  G14.genAsk(st, net, C.noisyBits(G14.GEN.protos[1], 3, rnd), 1);
  assert.ok(st.flags.newGen);
  const e = G14.genExam(st, net, 99);
  assert.ok(e.cortex >= 27 && e.memo <= 3, `ezberci ${e.memo}, kavrayan ${e.cortex}`);
  assert.deepStrictEqual(check(G14.level, st), ['one', 'over', 'all', 'new', 'exam']);
});
test('seviye 15: uykusuz unutur, uykulu (az tekrarla bile) hepsini hatırlar', () => {
  assert.strictEqual(S15.level.id, 15);
  const live = (sleep, replay, seed) => {
    const st = fresh(S15.level);
    st.sleep = sleep;
    st.replay = replay;
    const net = S15.slNet(),
      data = S15.slData(9),
      rnd = C.mulberry32(seed);
    for (const ph of S15.slPlan(1)) S15.slRunPhase(net, data, ph, rnd, replay);
    S15.slRecord(st, 1, S15.slAcc(net, data));
    for (const ph of S15.slPlan(2, sleep)) S15.slRunPhase(net, data, ph, rnd, replay);
    S15.slRecord(st, 2, S15.slAcc(net, data));
    return st;
  };
  for (const seed of [1, 2, 3]) {
    const a = live(false, 4, seed),
      b = live(true, 4, seed),
      c = live(true, 1, seed);
    assert.ok(a.flags.day1 && a.flags.forgot, 'uykusuz unutmalı: ' + a.acc);
    assert.ok(b.flags.slept, 'uykulu hatırlamalı: ' + b.acc);
    assert.ok(c.flags.little, 'az tekrar yetmeli: ' + c.acc);
  }
});
const W16 = require('../js/levels/16-words.js');
const R17 = require('../js/levels/17-read.js');
test('seviye 16: eğitimle aynı türden kelimeler kümelenir; komşu kendi türünden; bilinmeyen kelime', () => {
  const st = fresh(W16.level);
  assert.strictEqual(W16.level.id, 16);
  let list = W16.wordsList(st);
  const net = W16.wordsNet(list.length);
  const before = W16.wordsClustering(net, list);
  W16.wordsTrain(net, list, 150);
  const after = W16.wordsClustering(net, list);
  assert.ok(after.gap > before.gap + 0.5, `kümelenme ${before.gap} → ${after.gap}`);
  W16.wordsRecord(st, net, 0);
  assert.ok(st.flags.trained && st.flags.near);
  st.custom.push({ w: 'zürafa', c: 'hayvan' });
  const list2 = W16.wordsList(st),
    net2 = net.resized(
      list.map(p => p.w),
      list2.map(p => p.w),
      W16.WORDS.cats,
      W16.WORDS.cats,
      3
    );
  W16.wordsTrain(net2, list2, 150);
  W16.wordsRecord(st, net2, list2.length - 1);
  assert.ok(st.flags.newPlaced, 'zürafa hayvanların yanında');
  assert.strictEqual(W16.wordsAsk(st, net2, 'kaplan').known, false);
  assert.deepStrictEqual(check(W16.level, st), ['train', 'near', 'new', 'unknown']);
});
test('seviye 17: yanlış harfe dayanır, kayınca şaşırır, farklı yerlerde görerek düzelir', () => {
  const st = fresh(R17.level);
  assert.strictEqual(R17.level.id, 17);
  let net = R17.readNet();
  R17.readTrain(net, R17.readData(false, 5), R17.READ.plain, C.mulberry32(5));
  st.trained = 1;
  assert.strictEqual(R17.readAccuracy(net, 0), 1);
  assert.ok(R17.readAccuracy(net, 4) < 0.5, 'kayınca çoğunu bilemez');
  R17.readAsk(st, net, 'elme', 0);
  R17.readAsk(st, net, 'kediler', 0);
  R17.readAsk(st, net, 'kedi', 4);
  assert.ok(st.flags.typo && st.flags.suffix && st.flags.shiftFail);
  net = R17.readNet();
  R17.readTrain(net, R17.readData(true, 5), R17.READ.aug, C.mulberry32(5));
  st.trained = 2;
  assert.ok(R17.readAccuracy(net, 4) >= 0.85, 'kaymaya dayanıklı');
  R17.readAsk(st, net, 'kedi', 4);
  assert.ok(st.flags.shiftFixed);
});
test('yol haritasında “yakında” ya da “serbest deney” kalmadı: her durak gerçek bir seviye', () => {
  for (const r of Lv.ROADMAP) assert.ok(r.level, 'hazır değil: ' + r.key);
  assert.deepStrictEqual(
    Lv.LEVELS.map(l => l.id),
    Lv.ROADMAP.map(r => r.id)
  );
});
test('model hiçbir yerde “küçük beyin” diye anılmaz (Türkçede beyincik demek)', () => {
  const fs = require('fs'),
    path = require('path');
  const files = [];
  const walk = d =>
    fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|html)$/.test(e.name)) files.push(p);
    });
  walk(path.join(__dirname, '..', 'js'));
  files.push(path.join(__dirname, '..', 'index.html'));
  for (const f of files)
    assert.ok(!/küçük (bir )?beyin|küçük beyn/i.test(fs.readFileSync(f, 'utf8')), f);
});

test('bütün seviyeler katmanlı: kısa beyin kartı, en az iki temel görev, açılan paneller tanımlı', () => {
  const fs = require('fs'),
    path = require('path');
  const views = ['js', 'js/views']
    .flatMap(d =>
      fs
        .readdirSync(path.join(__dirname, '..', d))
        .filter(f => f.endsWith('.js'))
        .map(f => fs.readFileSync(path.join(__dirname, '..', d, f), 'utf8'))
    )
    .join('\n');
  const bench = ['b', 'w', 'theta', 'gauge', 'table'];
  for (const r of Lv.ROADMAP) {
    const l = r.level;
    if (!l) continue;
    assert.ok(l.layered, l.key + ' katmanlı');
    assert.ok(l.brainShort && l.brainShort.length <= 320, l.key + ' brainShort');
    const core = l.missions.filter(m => !m.extra);
    assert.ok(core.length >= 2, l.key + ' temel görev');
    // her “shows” anahtarı ya tezgâh kontrolü ya da görünümde bir data-lay
    for (const m of l.missions)
      for (const k of m.shows || [])
        assert.ok(
          bench.includes(k) ||
            new RegExp(`data-lay="[^"]*\\b${k}\\b`).test(views) ||
            views.includes(`'${k}'`),
          `${l.key}/${m.id}: ${k}`
        );
  }
});
console.log(`\n${passed} test geçti.`);
