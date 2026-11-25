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

console.log(`\n${passed} test geçti.`);
