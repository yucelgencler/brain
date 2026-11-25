/* Beyne yolculuk: ortak araçlar (gürültü, geometri, parlayan noktalar, etiketler).
   Klasik betik; her şey window.B3 altında. */
(function () {
  'use strict';
  const B3 = (window.B3 = window.B3 || {});

  /* ---------- küçük matematik ---------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
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
  B3.clamp = clamp;
  B3.lerp = lerp;
  B3.smooth = smooth;
  B3.rng = rng;

  /* ---------- 3B simplex gürültü (Gustavson) ---------- */
  const G = [
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
    1, 0, 1, -1, 0, -1, -1
  ];
  B3.makeNoise = function (seed) {
    const r = rng(seed),
      p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    const perm = new Uint8Array(512),
      pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      pm[i] = perm[i] % 12;
    }
    const F3 = 1 / 3,
      G3 = 1 / 6;
    return function (xin, yin, zin) {
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s),
        j = Math.floor(yin + s),
        k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t),
        y0 = yin - (j - t),
        z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) {
          i1 = 1;
          j1 = 0;
          k1 = 0;
          i2 = 1;
          j2 = 1;
          k2 = 0;
        } else if (x0 >= z0) {
          i1 = 1;
          j1 = 0;
          k1 = 0;
          i2 = 1;
          j2 = 0;
          k2 = 1;
        } else {
          i1 = 0;
          j1 = 0;
          k1 = 1;
          i2 = 1;
          j2 = 0;
          k2 = 1;
        }
      } else {
        if (y0 < z0) {
          i1 = 0;
          j1 = 0;
          k1 = 1;
          i2 = 0;
          j2 = 1;
          k2 = 1;
        } else if (x0 < z0) {
          i1 = 0;
          j1 = 1;
          k1 = 0;
          i2 = 0;
          j2 = 1;
          k2 = 1;
        } else {
          i1 = 0;
          j1 = 1;
          k1 = 0;
          i2 = 1;
          j2 = 1;
          k2 = 0;
        }
      }
      const x1 = x0 - i1 + G3,
        y1 = y0 - j1 + G3,
        z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3,
        y2 = y0 - j2 + 2 * G3,
        z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3,
        y3 = y0 - 1 + 3 * G3,
        z3 = z0 - 1 + 3 * G3;
      const ii = i & 255,
        jj = j & 255,
        kk = k & 255;
      let n = 0,
        tt,
        g;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) {
        g = pm[ii + perm[jj + perm[kk]]] * 3;
        tt *= tt;
        n += tt * tt * (G[g] * x0 + G[g + 1] * y0 + G[g + 2] * z0);
      }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) {
        g = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
        tt *= tt;
        n += tt * tt * (G[g] * x1 + G[g + 1] * y1 + G[g + 2] * z1);
      }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) {
        g = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
        tt *= tt;
        n += tt * tt * (G[g] * x2 + G[g + 1] * y2 + G[g + 2] * z2);
      }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) {
        g = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
        tt *= tt;
        n += tt * tt * (G[g] * x3 + G[g + 1] * y3 + G[g + 2] * z3);
      }
      return 32 * n;
    };
  };

  /* ---------- indeksli ikosfer (kenar orta noktası önbellekli) ---------- */
  const icoCache = {};
  B3.icosphere = function (level) {
    if (icoCache[level]) return icoCache[level];
    const t = (1 + Math.sqrt(5)) / 2;
    let v = [
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      0,
      0,
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      t,
      0,
      -1,
      t,
      0,
      1,
      -t,
      0,
      -1,
      -t,
      0,
      1
    ];
    let f = [
      0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1,
      8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
    ];
    for (let i = 0; i < v.length; i += 3) {
      const l = Math.hypot(v[i], v[i + 1], v[i + 2]);
      v[i] /= l;
      v[i + 1] /= l;
      v[i + 2] /= l;
    }
    for (let L = 0; L < level; L++) {
      const mid = new Map(),
        nf = [];
      const m = (a, b) => {
        const key = a < b ? a * 1048576 + b : b * 1048576 + a;
        let r = mid.get(key);
        if (r !== undefined) return r;
        let x = v[a * 3] + v[b * 3],
          y = v[a * 3 + 1] + v[b * 3 + 1],
          z = v[a * 3 + 2] + v[b * 3 + 2];
        const l = Math.hypot(x, y, z);
        r = v.length / 3;
        v.push(x / l, y / l, z / l);
        mid.set(key, r);
        return r;
      };
      for (let i = 0; i < f.length; i += 3) {
        const a = f[i],
          b = f[i + 1],
          c = f[i + 2];
        const ab = m(a, b),
          bc = m(b, c),
          ca = m(c, a);
        nf.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
      }
      f = nf;
    }
    const out = {
      pos: new Float32Array(v),
      idx: v.length / 3 > 65535 ? new Uint32Array(f) : new Uint16Array(f)
    };
    icoCache[level] = out;
    return out;
  };

  /* Bir şekil fonksiyonuyla ikosferden geometri üretir.
   shape(dx,dy,dz,out) → out=[x,y,z]; sonra isteğe bağlı disp(x,y,z,nx,ny,nz) normal boyunca itme. */
  B3.shapedGeometry = function (level, shape, disp, colorFn, flip) {
    const ico = B3.icosphere(level),
      n = ico.pos.length / 3;
    let idx = ico.idx;
    if (flip) {
      idx = idx.slice();
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = t;
      }
    }
    const pos = new Float32Array(n * 3),
      o = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      shape(ico.pos[i * 3], ico.pos[i * 3 + 1], ico.pos[i * 3 + 2], o);
      pos[i * 3] = o[0];
      pos[i * 3 + 1] = o[1];
      pos[i * 3 + 2] = o[2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const extra = {};
    if (disp) {
      g.computeVertexNormals();
      const nr = g.attributes.normal.array,
        dv = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const d = disp(
          pos[i * 3],
          pos[i * 3 + 1],
          pos[i * 3 + 2],
          nr[i * 3],
          nr[i * 3 + 1],
          nr[i * 3 + 2],
          i
        );
        dv[i] = d;
        pos[i * 3] += nr[i * 3] * d;
        pos[i * 3 + 1] += nr[i * 3 + 1] * d;
        pos[i * 3 + 2] += nr[i * 3 + 2] * d;
      }
      extra.disp = dv;
    }
    g.computeVertexNormals();
    if (colorFn) {
      const col = new Float32Array(n * 3),
        c = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        colorFn(i, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], extra.disp ? extra.disp[i] : 0, c);
        col[i * 3] = c[0];
        col[i * 3 + 1] = c[1];
        col[i * 3 + 2] = c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    g.computeBoundingSphere();
    g.userData = extra;
    return g;
  };

  /* Birden çok geometriyi tek geometride birleştir (position, normal, isteğe bağlı color). */
  B3.merge = function (list) {
    let nv = 0,
      ni = 0;
    const hasCol = list.every(g => g.attributes.color);
    for (const g of list) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const P = new Float32Array(nv * 3),
      N = new Float32Array(nv * 3),
      C = hasCol ? new Float32Array(nv * 3) : null,
      I = new Uint32Array(ni);
    let ov = 0,
      oi = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      if (!g.attributes.normal) g.computeVertexNormals();
      P.set(g.attributes.position.array, ov * 3);
      N.set(g.attributes.normal.array, ov * 3);
      if (C) C.set(g.attributes.color.array, ov * 3);
      if (g.index) {
        const a = g.index.array;
        for (let k = 0; k < a.length; k++) I[oi + k] = a[k] + ov;
        oi += a.length;
      } else {
        for (let k = 0; k < c; k++) I[oi + k] = ov + k;
        oi += c;
      }
      ov += c;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (C) out.setAttribute('color', new THREE.BufferAttribute(C, 3));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    out.computeBoundingSphere();
    return out;
  };

  /* Uçlara doğru incelen tüp (TubeGeometry sabit kalınlıklı olduğu için). */
  B3.taperTube = function (curve, segs, r0, r1, radial, color) {
    radial = radial || 6;
    const frames = curve.computeFrenetFrames(segs, false);
    const P = [],
      N = [],
      C = [],
      I = [];
    const p = new THREE.Vector3(),
      nrm = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      curve.getPointAt(u, p);
      const r = lerp(r0, r1, u);
      const Nn = frames.normals[i],
        Bn = frames.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2,
          s = Math.sin(a),
          c = -Math.cos(a);
        nrm.set(c * Nn.x + s * Bn.x, c * Nn.y + s * Bn.y, c * Nn.z + s * Bn.z).normalize();
        P.push(p.x + r * nrm.x, p.y + r * nrm.y, p.z + r * nrm.z);
        N.push(nrm.x, nrm.y, nrm.z);
        if (color) C.push(color[0], color[1], color[2]);
      }
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j,
          b = (i + 1) * (radial + 1) + j;
        I.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setIndex(I);
    return g;
  };

  /* Renkli küre parçası (merge için). */
  B3.sphereGeo = function (r, x, y, z, color, ws, hs, sx, sy, sz) {
    const g = new THREE.SphereGeometry(r, ws || 12, hs || 8);
    if (sx) g.scale(sx, sy, sz);
    g.translate(x, y, z);
    if (color) {
      const n = g.attributes.position.count,
        c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        c[i * 3] = color[0];
        c[i * 3 + 1] = color[1];
        c[i * 3 + 2] = color[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    return g;
  };
  B3.rgb = function (hex) {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };

  /* ---------- parlayan nokta dokusu ---------- */
  let glowTex = null;
  B3.glowTexture = function () {
    if (glowTex) return glowTex;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const x = cv.getContext('2d'),
      g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(cv);
    return glowTex;
  };

  /* Her karede baştan doldurulan parlayan noktalar (darbeler, iyonlar, moleküller).
   Boyut dünya biriminde; ekran ölçeği uniform ile verilir. */
  B3.GlowPoints = function (cap, additive, onTop) {
    this.cap = cap;
    this.n = 0;
    this.P = new Float32Array(cap * 3);
    this.C = new Float32Array(cap * 3);
    this.S = new Float32Array(cap);
    this.A = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(this.P, 3).setUsage(THREE.DynamicDrawUsage)
    );
    g.setAttribute('gcolor', new THREE.BufferAttribute(this.C, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('gsize', new THREE.BufferAttribute(this.S, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('galpha', new THREE.BufferAttribute(this.A, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: B3.glowTexture() }, scale: { value: 600 } },
      vertexShader:
        'attribute vec3 gcolor;attribute float gsize;attribute float galpha;varying vec3 vC;varying float vA;uniform float scale;' +
        'void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp(gsize*scale/-mv.z,1.0,256.0);gl_Position=projectionMatrix*mv;vC=gcolor;vA=galpha;}',
      fragmentShader:
        'uniform sampler2D map;varying vec3 vC;varying float vA;' +
        'void main(){float a=texture2D(map,gl_PointCoord).a*vA;if(a<0.003)discard;gl_FragColor=vec4(vC,a);}',
      transparent: true,
      depthWrite: false,
      depthTest: !onTop,
      blending: additive === false ? THREE.NormalBlending : THREE.AdditiveBlending
    });
    this.mesh = new THREE.Points(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.geo = g;
  };
  B3.GlowPoints.prototype.clear = function () {
    this.n = 0;
  };
  B3.GlowPoints.prototype.add = function (x, y, z, r, g, b, size, alpha) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.P[i * 3] = x;
    this.P[i * 3 + 1] = y;
    this.P[i * 3 + 2] = z;
    this.C[i * 3] = r;
    this.C[i * 3 + 1] = g;
    this.C[i * 3 + 2] = b;
    this.S[i] = size;
    this.A[i] = alpha == null ? 1 : alpha;
  };
  B3.GlowPoints.prototype.commit = function (scale) {
    const g = this.geo;
    g.setDrawRange(0, this.n);
    for (const k of ['position', 'gcolor', 'gsize', 'galpha']) {
      const a = g.attributes[k];
      a.needsUpdate = true;
      a.updateRange.count = -1;
    }
    if (scale) this.mesh.material.uniforms.scale.value = scale;
  };

  /* ---------- HTML etiketler (3B konuma iliştirilen) ---------- */
  B3.label = function (layer, html, cls) {
    const el = document.createElement('div');
    el.className = 'b3lbl' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    layer.appendChild(el);
    return { el, pos: new THREE.Vector3(), on: true, alpha: 1 };
  };

  /* Basit yumuşak düzenli sayı biçimi (Türkçe ondalık virgül). */
  B3.fmt = function (v, d) {
    return v.toLocaleString('tr-TR', {
      minimumFractionDigits: d || 0,
      maximumFractionDigits: d || 0
    });
  };
})();
