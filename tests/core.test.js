// Çekirdek testleri. Çalıştırmak için: node tests/core.test.js
// Bağımlılık yok; sadece Node.js gerekir.
'use strict';
const assert = require('assert');
const C = require('../js/core.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓ ' + name);
}
function train(task, cfg, steps, seed) {
  const sizes = [
    task.inputLabels(cfg).length,
    ...Array(cfg.layers).fill(cfg.hidden),
    task.outputLabels(cfg).length
  ];
  const net = new C.Net(sizes, seed, C.outActOf(task, cfg)),
    ds = task.dataset(cfg),
    rnd = C.mulberry32(seed + 99);
  for (let s = 0; s < steps; s++) {
    const b = [];
    for (let i = 0; i < 32; i++) b.push(ds.train[(rnd() * ds.train.length) | 0]);
    net.trainBatch(b, cfg.lr);
  }
  const acc = set => set.filter(e => C.taskAnswer(task, cfg, net.predict(e.x)).idx === e.y).length;
  return { net, ds, trainAcc: acc(ds.train), testAcc: acc(ds.test) };
}

test('rakam şablonları 5×7', () => {
  for (const k in C.DIGIT_ROWS) {
    assert.strictEqual(C.DIGIT_ROWS[k].length, 7);
    C.DIGIT_ROWS[k].forEach(r => assert.strictEqual(r.length, 5));
  }
});
test('harf şablonları 3×6', () => {
  for (const k in C.GLYPHS) {
    assert.strictEqual(C.GLYPHS[k].length, 6, k);
    C.GLYPHS[k].forEach(r => assert.strictEqual(r.length, 3, k));
  }
});
test('olasılıklar toplamı 1', () => {
  const n = new C.Net([5, 4, 3], 1);
  const p = n.predict([1, 0, 1, 0, 1]);
  assert.ok(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
test('rakamlar öğreniliyor', () => {
  const r = train(C.digitTask, C.digitTask.defaults(), 400, 1);
  assert.strictEqual(r.trainAcc, r.ds.train.length);
});
test('2 gizli nöron rakamlara yetmiyor', () => {
  const r = train(C.digitTask, { ...C.digitTask.defaults(), hidden: 2 }, 1500, 3);
  assert.ok(r.trainAcc < r.ds.train.length);
});
test('kelimeler (duyarak) öğreniliyor', () => {
  const r = train(C.wordTask, C.wordTask.defaults(), 300, 1);
  assert.strictEqual(r.trainAcc, r.ds.train.length);
});
test('okuma öğreniliyor', () => {
  const r = train(C.readTask, C.readTask.defaults(), 800, 1);
  assert.strictEqual(r.trainAcc, r.ds.train.length);
});
test('toplamada miktar kodlaması genelliyor, ezber genellemiyor', () => {
  const th = train(C.addTask, { ...C.addTask.defaults(), encoding: 'thermo' }, 2000, 1);
  const oh = train(C.addTask, C.addTask.defaults(), 2000, 1);
  assert.ok(th.testAcc > oh.testAcc, `thermo ${th.testAcc} onehot ${oh.testAcc}`);
});
test('yeni kelime eklenince eski bağlantılar korunuyor', () => {
  const cfg = C.wordTask.defaults(),
    r = train(C.wordTask, cfg, 300, 2);
  const cfg2 = { ...cfg, text: C.setPair(cfg.text, 'aslan', 'hayvan') };
  const n2 = r.net.resized(
    C.wordTask.inputLabels(cfg),
    C.wordTask.inputLabels(cfg2),
    C.wordTask.outputLabels(cfg),
    C.wordTask.outputLabels(cfg2),
    5
  );
  const p = n2.predict(C.wordTask.encode({ w: 'kedi' }, cfg2));
  assert.strictEqual(C.wordTask.outputLabels(cfg2)[C.argmax(p)], 'hayvan');
});
test('soru sadeleştirme', () => {
  assert.strictEqual(C.normalizeQ('3 artı 4 kaç eder?'), '3+4');
  assert.strictEqual(C.normalizeQ('7 kere 8'), '7×8');
  assert.strictEqual(C.normalizeQ('kedi ne?'), 'kedi');
  assert.strictEqual(C.normalizeQ('kene'), 'kene');
});
console.log(`\n${passed} test geçti.`);
