/* Beyne yolculuk: küçük devrenin nöron simülasyonu (sızdıran topla-ateşle).
   Arayüzden bağımsız; Node testleri için module.exports.
   Birimler: zaman ms, gerilim mV, uzunluk µm. */
(function (root) {
  'use strict';

  const LIF = {
    rest: -70,
    thr: -55,
    reset: -75,
    tau: 15,
    refr: 2.5,
    speed: 150 /* µm/ms ≈ 0,15 m/s */,
    syn: 0.8 /* sinaps gecikmesi ms */,
    h: 0.1
  };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- devre tarifleri ----------
   neuron: {id, kind:'pyr'|'int'|'in'|'out', label, pos:[x,y,z], bg:Hz (arka plan girdisi)}
   conn:   {from, to, w (mV), len (µm, yol uzunluğu)} */
  function dist(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  function finish(spec) {
    const byId = {};
    spec.neurons.forEach((n, i) => {
      n.i = i;
      byId[n.id] = n;
    });
    spec.conns.forEach(c => {
      c.a = byId[c.from].i;
      c.b = byId[c.to].i;
      if (!c.len) c.len = dist(byId[c.from].pos, byId[c.to].pos) * 1.35 + 30;
    });
    return spec;
  }

  function specGeneric(seed) {
    const r = rng(seed || 7),
      N = [],
      C = [];
    const P = (x, y, z) => [x, y, z];
    for (let i = 0; i < 9; i++)
      N.push({
        id: 'p' + i,
        kind: 'pyr',
        label: '',
        pos: P(-130 + r() * 260, 40 + r() * 70, -70 + r() * 140),
        bg: 150
      });
    for (let i = 0; i < 6; i++)
      N.push({
        id: 'q' + i,
        kind: 'pyr',
        label: '',
        pos: P(-120 + r() * 240, -110 + r() * 60, -60 + r() * 120),
        bg: 150
      });
    for (let i = 0; i < 4; i++)
      N.push({
        id: 'i' + i,
        kind: 'int',
        label: '',
        pos: P(-110 + r() * 220, -30 + r() * 80, -60 + r() * 120),
        bg: 110
      });
    for (let i = 0; i < 3; i++)
      N.push({
        id: 't' + i,
        kind: 'in',
        label: 'talamustan',
        pos: P(-80 + i * 80, -230, -30 + r() * 60),
        rate: 18
      });
    const ex = N.filter(n => n.kind === 'pyr'),
      inh = N.filter(n => n.kind === 'int'),
      inp = N.filter(n => n.kind === 'in');
    const pick = (arr, k, not) => {
      const a = arr.filter(n => n !== not).slice();
      const o = [];
      while (o.length < k && a.length) {
        o.push(a.splice(Math.floor(r() * a.length), 1)[0]);
      }
      return o;
    };
    ex.forEach(n => {
      pick(ex, 3, n).forEach(t => C.push({ from: n.id, to: t.id, w: (5 + r() * 3) * 1.45 }));
      pick(inh, 1).forEach(t => C.push({ from: n.id, to: t.id, w: 7 }));
    });
    // uyarı ile susturma birbirini dengeler; susturma kalkınca etkinlik taşar
    inh.forEach(n =>
      pick(ex, 4).forEach(t => C.push({ from: n.id, to: t.id, w: -(7 + r() * 3) * 1.9 }))
    );
    inp.forEach(n => pick(ex, 4).forEach(t => C.push({ from: n.id, to: t.id, w: 8 })));
    return finish({ mode: 'generic', neurons: N, conns: C });
  }

  /* Yolculukta bakılabilecek nesneler: görme alanında hangi özellikler, şakak lobunda hangi kavram */
  const OBJECTS = {
    lemon: {
      v1: ['curve', 'yellow'],
      v1weak: ['tip'],
      it: ['f_yel', 'f_oval', 'f_sour'],
      concept: 'lemon'
    },
    straw: {
      v1: ['curve', 'tip', 'red', 'dots'],
      v1weak: [],
      it: ['f_red', 'f_dots', 'f_sweet'],
      concept: 'straw'
    },
    icecream: {
      v1: ['curve', 'tip', 'light'],
      v1weak: [],
      it: ['f_cream', 'f_cone', 'f_sweet'],
      concept: 'icecream'
    }
  };

  /* Görme alanı (V1): talamustan gelen 6 lif → 6 özellik nöronu (bire bir), susturan hafif dengeler. */
  function specV1() {
    const N = [],
      C = [];
    const feats = [
      ['curve', 'eğri kenar ◠'],
      ['tip', 'sivri uç ⋀'],
      ['yellow', 'sarı'],
      ['red', 'kırmızı'],
      ['light', 'açık renk'],
      ['dots', 'benekli doku']
    ];
    feats.forEach((f, i) => {
      N.push({
        id: 'g' + i,
        kind: 'in',
        label: i === 0 ? 'talamustan (LGN)' : '',
        pos: [-125 + i * 50, -230, 0],
        rate: 5
      });
      N.push({
        id: f[0],
        kind: 'pyr',
        label: f[1],
        pos: [-140 + i * 56, 40 + (i % 2 ? 34 : 0), i % 2 ? -18 : 14],
        bg: 30
      });
    });
    N.push({ id: 'inh', kind: 'int', label: 'susturan', pos: [5, -40, 40], bg: 30 });
    N.push({ id: 'out', kind: 'out', label: '→ şakak lobuna', pos: [20, 240, -30] });
    const w = (a, b, v) => C.push({ from: a, to: b, w: v });
    feats.forEach((f, i) => {
      w('g' + i, f[0], 11);
      w(f[0], 'inh', 5);
      w('inh', f[0], -4);
      w(f[0], 'out', 0);
    });
    const rest = {},
      stim = {};
    feats.forEach((f, i) => (rest['g' + i] = 5));
    for (const k in OBJECTS) {
      stim[k] = {};
      feats.forEach((f, i) => {
        const o = OBJECTS[k];
        stim[k]['g' + i] = o.v1.includes(f[0]) ? 70 : o.v1weak.includes(f[0]) ? 30 : 5;
      });
    }
    return finish({ mode: 'v1', neurons: N, conns: C, stim, rest });
  }

  /* Şakak lobu (nesne tanıma): 8 özellik → 3 kavram nöronu; susturan, kazanan tek kalsın diye. */
  function specIT() {
    const N = [],
      C = [];
    const feats = [
      ['f_yel', 'sarı'],
      ['f_red', 'kırmızı'],
      ['f_cream', 'krem rengi'],
      ['f_oval', 'oval'],
      ['f_cone', 'külah'],
      ['f_dots', 'benekli'],
      ['f_sour', 'ekşi koku'],
      ['f_sweet', 'tatlı koku']
    ];
    feats.forEach((f, i) =>
      N.push({
        id: f[0],
        kind: 'in',
        label: f[1],
        pos: [-196 + i * 56, -230, i % 2 ? 30 : -30],
        rate: 3
      })
    );
    N.push({ id: 'lemon', kind: 'pyr', label: 'LİMON', pos: [-110, 70, 0], bg: 30, concept: true });
    N.push({ id: 'straw', kind: 'pyr', label: 'ÇİLEK', pos: [0, 95, -30], bg: 30, concept: true });
    N.push({
      id: 'icecream',
      kind: 'pyr',
      label: 'DONDURMA',
      pos: [110, 70, 20],
      bg: 30,
      concept: true
    });
    N.push({ id: 'inh', kind: 'int', label: 'susturan', pos: [0, -30, 45], bg: 20 });
    N.push({ id: 'out', kind: 'out', label: '→ konuşma alanına', pos: [-40, 250, -20] });
    const w = (a, b, v) => C.push({ from: a, to: b, w: v });
    for (const k in OBJECTS) OBJECTS[k].it.forEach(f => w(f, OBJECTS[k].concept, 6.5));
    ['lemon', 'straw', 'icecream'].forEach(c => {
      w(c, 'inh', 16);
      w('inh', c, -9);
      w(c, 'out', 0);
    });
    const stim = {};
    for (const k in OBJECTS) {
      stim[k] = {};
      feats.forEach(f => (stim[k][f[0]] = OBJECTS[k].it.includes(f[0]) ? 65 : 3));
    }
    return finish({ mode: 'it', neurons: N, conns: C, stim, rest: {} });
  }

  /* Karşılaştırma: limon ve karpuz aynı büyüklükte, kartta aynı yerde. Görme alanında bu ikisinin
     aynı küçük noktasına bakan aynı 6 nöron (her biri en çok başka bir şeyi sever) iki kez, yan yana:
     solda limona, sağda karpuza bakarken. Bakan aynı, ateşleyen farklı. */
  const CMP_FEATS = [
    ['curve', 'eğri kenar ◠'],
    ['yb', 'sarı ↔ mavi'],
    ['rg', 'kırmızı ↔ yeşil'],
    ['vert', 'dik kenar |'],
    ['hor', 'yatay kenar —'],
    ['stripe', 'çizgili desen ≡']
  ];
  // o noktadan gelen sinyallerin sıklığı (Hz): güçlü 70, zayıf 30–35, yok 5
  const CMP_OBJ = {
    L: { name: 'limon', rates: { curve: 70, yb: 70, rg: 5, vert: 5, hor: 5, stripe: 5 } },
    W: { name: 'karpuz', rates: { curve: 70, yb: 5, rg: 70, vert: 35, hor: 5, stripe: 70 } }
  };
  function specCompare() {
    const N = [],
      C = [],
      rest = {};
    const w = (a, b, v) => C.push({ from: a, to: b, w: v });
    ['L', 'W'].forEach((g, gi) => {
      const gx = gi ? 125 : -125;
      CMP_FEATS.forEach((f, k) => {
        const x = gx + ((k % 3) - 1) * 56,
          row = k < 3 ? 0 : 1;
        N.push({
          id: g + 'g_' + f[0],
          kind: 'in',
          label: '',
          pos: [x + 6, -230, row ? -20 : 20],
          rate: 5
        });
        N.push({
          id: g + '_' + f[0],
          kind: 'pyr',
          label: f[1],
          feat: f[0],
          group: g,
          pos: [x, row ? -20 : 70, row ? -24 : 16],
          bg: 30
        });
        rest[g + 'g_' + f[0]] = CMP_OBJ[g].rates[f[0]];
      });
      N.push({ id: g + '_inh', kind: 'int', label: '', group: g, pos: [gx, 20, 60], bg: 30 });
      CMP_FEATS.forEach(f => {
        w(g + 'g_' + f[0], g + '_' + f[0], 11);
        w(g + '_' + f[0], g + '_inh', 5);
        w(g + '_inh', g + '_' + f[0], -4);
      });
    });
    return finish({ mode: 'compare', neurons: N, conns: C, rest, stim: {} });
  }

  /* ---------- simülasyon ---------- */
  function Sim(spec, seed) {
    this.spec = spec;
    this.r = rng(seed || 11);
    this.t = 0;
    const n = spec.neurons.length;
    this.v = new Float64Array(n).fill(LIF.rest);
    this.refr = new Float64Array(n);
    this.last = new Float64Array(n).fill(-1e9);
    this.count = new Uint32Array(n);
    this.rate = spec.neurons.map(x => (x.kind === 'in' ? x.rate || 0 : 0));
    this.next = spec.neurons.map(() => this.r() * 60);
    this.out = spec.neurons.map(() => []);
    spec.conns.forEach((c, k) => {
      c.k = k;
      c.travel = c.len / LIF.speed;
      this.out[c.a].push(c);
    });
    this.q = []; // bekleyen varışlar {t,c}
    this.TR = 160;
    this.trace = spec.neurons.map(() => new Float32Array(this.TR).fill(LIF.rest));
    this.tp = 0;
    this.tAcc = 0;
    this.bgOn = true;
    this.inhGain = 1; // susturan bağlantıların etkisi (0: kapalı)
    this.drive = 1; // dışarıdan gelen girdinin çarpanı
  }
  // Bir nöronu hemen ateşlet (deney: “bu nöron ateşlerse ne olur?”)
  Sim.prototype.kick = function (i) {
    this.refr[i] = 0;
    this.v[i] = LIF.thr + 1;
  };
  Sim.prototype.setRates = function (map) {
    this.spec.neurons.forEach((x, i) => {
      if (x.kind === 'in' && map && map[x.id] != null) this.rate[i] = map[x.id];
    });
  };
  Sim.prototype.fire = function (i, spikes) {
    this.v[i] = LIF.reset;
    this.refr[i] = LIF.refr;
    this.last[i] = this.t;
    this.count[i]++;
    spikes.push({ i, t: this.t });
    for (const c of this.out[i]) {
      if (this.spec.neurons[c.b].kind === 'out') continue;
      this.q.push({ t: this.t + c.travel + LIF.syn, c });
    }
  };
  /* dt ms ilerlet; o aralıktaki ateşlemeleri ve varışları döndür. */
  Sim.prototype.step = function (dt) {
    const spikes = [],
      arrivals = [],
      N = this.spec.neurons,
      h = LIF.h,
      decay = Math.exp(-h / LIF.tau);
    let steps = Math.max(1, Math.round(dt / h));
    for (let s = 0; s < steps; s++) {
      this.t += h;
      // varışlar
      if (this.q.length) {
        let keep = [];
        for (const e of this.q) {
          if (e.t <= this.t) {
            const b = e.c.b;
            arrivals.push(e.c);
            if (this.refr[b] <= 0) this.v[b] += e.c.w < 0 ? e.c.w * this.inhGain : e.c.w;
          } else keep.push(e);
        }
        this.q = keep;
      }
      for (let i = 0; i < N.length; i++) {
        const nn = N[i];
        if (nn.kind === 'out') continue;
        if (nn.kind === 'in') {
          const rate = this.rate[i] * this.drive;
          if (rate > 0 && this.t >= this.next[i]) {
            this.fire(i, spikes);
            const per = 1000 / rate;
            this.next[i] = this.t + per * (0.75 + 0.5 * this.r());
          } else if (rate <= 0) this.next[i] = this.t + this.r() * 50;
          continue;
        }
        if (this.refr[i] > 0) {
          this.refr[i] -= h;
          continue;
        }
        if (this.v[i] >= LIF.thr) {
          this.fire(i, spikes);
          continue;
        } // gelen sinyal eşiği geçirdiyse hemen ateşle
        this.v[i] = LIF.rest + (this.v[i] - LIF.rest) * decay;
        if (this.bgOn && nn.bg && this.r() < (nn.bg * this.drive * h) / 1000) this.v[i] += 3;
        if (this.v[i] >= LIF.thr) this.fire(i, spikes);
      }
      this.tAcc += h;
      if (this.tAcc >= 0.5) {
        this.tAcc -= 0.5;
        this.tp = (this.tp + 1) % this.TR;
        for (let i = 0; i < N.length; i++)
          this.trace[i][this.tp] = this.refr[i] > LIF.refr - 0.6 ? 20 : this.v[i];
      }
    }
    return { spikes, arrivals };
  };
  /* Eşiğe ne kadar yakın: 0 dinlenme, 1 eşik. */
  Sim.prototype.charge = function (i) {
    return Math.max(0, Math.min(1, (this.v[i] - LIF.rest) / (LIF.thr - LIF.rest)));
  };

  const api = {
    LIF,
    Sim,
    specGeneric,
    specV1,
    specIT,
    specCompare,
    rng,
    OBJECTS,
    CMP_FEATS,
    CMP_OBJ
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.B3 = root.B3 || {};
    root.B3.sim = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
