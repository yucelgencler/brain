// Beyne yolculuk: devre simülasyonu testleri. Çalıştırmak için: node tests/b3d.test.js
'use strict';
const assert = require('assert');
const S = require('../js/b3d/sim.js');

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('✓ ' + name);
}
function run(spec, rates, ms, seed) {
  const s = new S.Sim(spec, seed);
  if (rates) s.setRates(rates);
  for (let t = 0; t < ms; t++) s.step(1);
  const o = {};
  spec.neurons.forEach((n, i) => {
    o[n.id] = s.count[i];
  });
  return o;
}
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

test('her bağlantının yol süresi ve gecikmesi var', () => {
  for (const spec of [S.specGeneric(7), S.specV1(), S.specIT()]) {
    const s = new S.Sim(spec, 1);
    spec.conns.forEach(c => {
      assert.ok(c.len > 0);
      assert.ok(c.travel > 0 && c.travel < 10, 'yol süresi ms cinsinden makul');
    });
    assert.ok(s.out.length === spec.neurons.length);
  }
});
test('ya hep ya hiç: eşiği geçince ateşler, sonra sıfırlanır', () => {
  const spec = { neurons: [{ id: 'a', kind: 'pyr', pos: [0, 0, 0] }], conns: [] };
  spec.neurons[0].i = 0;
  const s = new S.Sim(spec, 1);
  s.bgOn = false;
  s.v[0] = S.LIF.thr - 1;
  s.step(0.2);
  assert.strictEqual(s.count[0], 0, 'eşiğin altında ateşlemez');
  s.v[0] = S.LIF.thr + 0.1;
  const r = s.step(0.2);
  assert.strictEqual(r.spikes.length, 1);
  assert.ok(s.v[0] < S.LIF.rest, 'ateşlemeden sonra dinlenmenin altına iner');
});
test('sızıntı: girdi gelmezse gerilim dinlenmeye döner', () => {
  const spec = { neurons: [{ id: 'a', kind: 'pyr', pos: [0, 0, 0] }], conns: [] };
  spec.neurons[0].i = 0;
  const s = new S.Sim(spec, 1);
  s.bgOn = false;
  s.v[0] = -60;
  for (let i = 0; i < 200; i++) s.step(1);
  assert.ok(Math.abs(s.v[0] - S.LIF.rest) < 0.01);
});
test('sinyal hedefe yol süresi + sinaps gecikmesi sonra varır', () => {
  const spec = {
    neurons: [
      { id: 'a', kind: 'in', pos: [0, 0, 0], rate: 0 },
      { id: 'b', kind: 'pyr', pos: [100, 0, 0] }
    ],
    conns: [{ from: 'a', to: 'b', w: 5, len: 150 }]
  };
  spec.neurons.forEach((n, i) => (n.i = i));
  spec.conns[0].a = 0;
  spec.conns[0].b = 1;
  const s = new S.Sim(spec, 1);
  s.bgOn = false;
  s.fire(0, []);
  const due = s.t + 150 / S.LIF.speed + S.LIF.syn;
  let arrivedAt = null;
  while (s.t < due + 1) {
    const r = s.step(0.1);
    if (r.arrivals.length && arrivedAt == null) arrivedAt = s.t;
  }
  assert.ok(arrivedAt != null && Math.abs(arrivedAt - due) < 0.15);
});
test('serbest devre: piramitler makul sıklıkta ateşler (1–80 Hz)', () => {
  const spec = S.specGeneric(7),
    c = run(spec, null, 1000, 1);
  const pyr = spec.neurons.filter(n => n.kind === 'pyr').map(n => c[n.id]);
  const mean = pyr.reduce((a, b) => a + b, 0) / pyr.length;
  assert.ok(mean > 5 && mean < 60, 'ortalama ' + mean);
});
test('V1: limon gösterilince eğri kenar ve sarı leke ateşler, yatay ve dikey susar', () => {
  for (const seed of SEEDS) {
    const spec = S.specV1(),
      c = run(spec, spec.stim.lemon, 300, seed);
    assert.ok(c.curve >= 8, 'eğri ' + c.curve);
    assert.ok(c.yellow >= 3, 'sarı ' + c.yellow);
    assert.ok(c.horiz <= 1 && c.vert <= 1, 'yatay ' + c.horiz + ' dikey ' + c.vert);
  }
});
test('V1: limon yokken kenar nöronları neredeyse sessiz', () => {
  for (const seed of SEEDS) {
    const spec = S.specV1(),
      c = run(spec, spec.rest, 300, seed);
    assert.ok(c.curve <= 2 && c.yellow <= 2);
  }
});
test('şakak lobu: LİMON kazanır, MUZ neredeyse susar, PORTAKAL kazanamaz', () => {
  for (const seed of SEEDS) {
    const spec = S.specIT(),
      c = run(spec, spec.stim.lemon, 300, seed);
    assert.ok(c.lemon >= 6, 'limon ' + c.lemon);
    assert.ok(c.banana <= 1, 'muz ' + c.banana);
    assert.ok(c.orange * 3 <= c.lemon, 'portakal ' + c.orange + ' limon ' + c.lemon);
    assert.ok(c.inh >= 3, 'susturan devreye girer');
  }
});
test('şakak lobu: susturan olmasa portakal daha çok ateşler', () => {
  let withInh = 0,
    without = 0;
  for (const seed of SEEDS) {
    const a = S.specIT();
    withInh += run(a, a.stim.lemon, 300, seed).orange;
    const b = S.specIT();
    b.conns.forEach(c => {
      if (c.from === 'inh') c.w = 0;
    });
    without += run(b, b.stim.lemon, 300, seed).orange;
  }
  assert.ok(without > withInh, 'susturansız ' + without + ' susturanlı ' + withInh);
});
console.log(`\n${passed} test geçti.`);
