/* Durak 2: kabuktan kesilmiş bir parça (1 birim = 1 mm).
   Üstte kıvrımlı yüzey ve damarlar; ön ve yan kesitlerde gri madde (yüzeyden ~2,6 mm) ve beyaz madde. */
(function () {
  'use strict';
  const B3 = window.B3,
    { smooth, clamp, lerp } = B3;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const HALF = 10,
    BOT = -13,
    T = 2.6;

  B3.makeRegionStage = function (ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ctx.bg);
    const st = {
      id: 'region',
      name: 'Bölge',
      scene,
      far: 48,
      near: 4.2,
      unit: 0.001,
      center: V(0, -4.5, 0),
      focus: V(),
      focusDir: V(0.05, 0.12, 1).normalize(),
      home: { yaw: 0.62, pitch: 0.42 },
      labels: []
    };
    st.yaw = st.home.yaw;
    st.pitch = st.home.pitch;
    scene.add(new THREE.HemisphereLight(0xfff3ef, 0x40243a, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(6, 12, 10);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa9bcff, 0.4);
    rim.position.set(-8, 3, -6);
    scene.add(rim);

    const nz = B3.makeNoise(515);
    const w = z => 0.9 * Math.sin(z * 0.21 + 0.6) + 0.25 * nz(0, z * 0.15, 3);
    function h(x, z) {
      const a = Math.abs(x - w(z));
      let y = -8.2 * Math.pow(1 - smooth(0, 2.3, a), 1.25);
      const b = Math.abs(x + 7.3 + 0.4 * Math.sin(z * 0.3));
      y += -3.6 * Math.pow(1 - smooth(0, 1.8, b), 1.4);
      const c = Math.abs(x - 7.6 - 0.5 * Math.cos(z * 0.25));
      y += -2.8 * Math.pow(1 - smooth(0, 1.6, c), 1.4);
      y += -0.55 * Math.pow(a / 10, 2) + 0.18 * nz(x * 0.25, z * 0.25, 1.7);
      return y;
    }
    st.h = h;

    /* üst yüzey */
    const R = 200;
    {
      const g = new THREE.PlaneGeometry(HALF * 2, HALF * 2, R, R);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position.array,
        n = p.length / 3,
        col = new Float32Array(n * 3);
      const GY = B3.rgb('#e7bdb4'),
        SU = B3.rgb('#6b3442');
      for (let i = 0; i < n; i++) {
        const x = p[i * 3],
          z = p[i * 3 + 2],
          y = h(x, z);
        p[i * 3 + 1] = y;
        const k = clamp((y + 5) / 5, 0, 1);
        const v = 0.95 + 0.05 * nz(x * 1.3, z * 1.3, 9);
        col[i * 3] = lerp(SU[0], GY[0], k) * v;
        col[i * 3 + 1] = lerp(SU[1], GY[1], k) * v;
        col[i * 3 + 2] = lerp(SU[2], GY[2], k) * v;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      scene.add(
        new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }))
      );
    }

    /* kesit yüzü üretici: u yatay koordinat, top(u) yüzey yüksekliği, depth(u,y) yüzeye uzaklık */
    const GM = B3.rgb('#a27378'),
      GM1 = B3.rgb('#c49b9b'),
      WM = B3.rgb('#efe5d6'),
      GEN = B3.rgb('#efe0d2');
    let gennari = false;
    const faces = [];
    function face(place, top, depth) {
      const NU = 220,
        NV = 120,
        P = [],
        C = [],
        I = [],
        U = [];
      for (let j = 0; j <= NV; j++)
        for (let i = 0; i <= NU; i++) {
          const u = -HALF + (2 * HALF * i) / NU,
            t = top(u),
            y = lerp(BOT, t, Math.pow(j / NV, 0.8));
          const q = place(u, y);
          P.push(q[0], q[1], q[2]);
          U.push(u, y);
          C.push(0, 0, 0);
        }
      for (let j = 0; j < NV; j++)
        for (let i = 0; i < NU; i++) {
          const a = j * (NU + 1) + i,
            b = a + NU + 1;
          I.push(a, a + 1, b, b, a + 1, b + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setIndex(I);
      g.computeVertexNormals();
      const f = { g, U, depth };
      faces.push(f);
      paintFace(f);
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })
      );
      scene.add(m);
      return m;
    }
    function paintFace(f) {
      const col = f.g.attributes.color.array;
      for (let k = 0; k < f.U.length / 2; k++) {
        const d = f.depth(f.U[k * 2], f.U[k * 2 + 1]);
        let c;
        if (d < T) {
          const s = d / T;
          c = [
            lerp(GM1[0], GM[0], smooth(0, 0.15, s)),
            lerp(GM1[1], GM[1], smooth(0, 0.15, s)),
            lerp(GM1[2], GM[2], smooth(0, 0.15, s))
          ];
          if (gennari) {
            const gk = Math.exp(-(((s - 0.52) / 0.05) ** 2)) * 0.8;
            c = [lerp(c[0], GEN[0], gk), lerp(c[1], GEN[1], gk), lerp(c[2], GEN[2], gk)];
          }
        } else {
          const e = smooth(T, T + 0.35, d);
          c = [lerp(GM[0], WM[0], e), lerp(GM[1], WM[1], e), lerp(GM[2], WM[2], e)];
        }
        const v = 0.96 + 0.04 * nz(f.U[k * 2] * 2, f.U[k * 2 + 1] * 2, 4);
        col[k * 3] = c[0] * v;
        col[k * 3 + 1] = c[1] * v;
        col[k * 3 + 2] = c[2] * v;
      }
      f.g.attributes.color.needsUpdate = true;
    }
    /* ön kesit z=+HALF: oluk z boyunca uzandığı için bu düzlemde 2B uzaklık doğru kalınlığı verir */
    const ZF = HALF,
      samp = [];
    for (let x = -HALF - 2; x <= HALF + 2; x += 0.05) samp.push([x, h(x, ZF)]);
    face(
      (u, y) => [u, y, ZF],
      u => h(u, ZF),
      (u, y) => {
        let m = 1e9;
        for (const s of samp) {
          if (Math.abs(s[0] - u) > m) continue;
          const d = Math.hypot(s[0] - u, s[1] - y);
          if (d < m) m = d;
        }
        return m;
      }
    );
    /* yan kesit x=+HALF: yüzey eğimine göre dik uzaklık */
    const XF = HALF;
    face(
      (u, y) => [XF, y, -u],
      u => h(XF, -u),
      (u, y) => {
        const z = -u,
          e = 0.05;
        const hx = (h(XF + e, z) - h(XF - e, z)) / (2 * e),
          hz = (h(XF, z + e) - h(XF, z - e)) / (2 * e);
        return Math.max(0, h(XF, z) - y) / Math.sqrt(1 + hx * hx + hz * hz);
      }
    );
    /* alt ve arka yüzler (düz beyaz madde) */
    const wm = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(WM[0] * 0.9, WM[1] * 0.9, WM[2] * 0.9),
      roughness: 0.8
    });
    const bot = new THREE.Mesh(new THREE.PlaneGeometry(2 * HALF, 2 * HALF), wm);
    bot.rotation.x = Math.PI / 2;
    bot.position.y = BOT;
    scene.add(bot);

    /* kesitte nöron gövdeleri (Nissl boyası gibi küçük koyu noktalar) */
    {
      const r = B3.rng(9),
        P = [];
      let tries = 0;
      while (P.length < 5200 * 3 && tries < 60000) {
        tries++;
        const x = -HALF + r() * 2 * HALF,
          y = BOT + r() * (0 - BOT + 0.5);
        const top = h(x, ZF);
        if (y > top) continue;
        let m = 1e9;
        for (const s of samp) {
          if (Math.abs(s[0] - x) > m) continue;
          const d = Math.hypot(s[0] - x, s[1] - y);
          if (d < m) m = d;
        }
        if (m > T || m < 0.12) continue;
        P.push(x, y, ZF + 0.03);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      scene.add(
        new THREE.Points(
          g,
          new THREE.PointsMaterial({ color: 0x4a2547, size: 0.07, sizeAttenuation: true })
        )
      );
    }
    /* beyaz maddede lif çizgileri */
    {
      const r = B3.rng(4),
        P = [];
      for (let k = 0; k < 90; k++) {
        let x = -HALF + r() * 2 * HALF;
        let y = h(x, ZF) - T - 0.3;
        if (y < BOT + 0.5) continue;
        let dx = (r() - 0.5) * 0.3;
        for (let s = 0; s < 30 && y > BOT + 0.2; s++) {
          const nx = x + dx,
            ny = y - 0.4;
          P.push(x, y, ZF + 0.02, nx, ny, ZF + 0.02);
          x = nx;
          y = ny;
          dx += (r() - 0.5) * 0.08;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      scene.add(
        new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({ color: 0xd6c9b6, transparent: true, opacity: 0.55 })
        )
      );
    }
    /* yüzey damarları */
    {
      const r = B3.rng(21),
        list = [];
      const vessel = (x, z, dir, rad, len) => {
        const pts = [];
        for (let s = 0; s < len; s++) {
          pts.push(V(x, h(x, z) + rad * 0.8, z));
          dir += (r() - 0.5) * 0.5;
          const nx = x + Math.cos(dir) * 0.6,
            nzv = z + Math.sin(dir) * 0.6;
          if (Math.abs(nx) > HALF - 0.2 || Math.abs(nzv) > HALF - 0.2) break;
          if (h(nx, nzv) < -1.4) {
            dir += Math.PI * 0.5;
            continue;
          }
          x = nx;
          z = nzv;
          if (rad > 0.12 && r() < 0.07)
            vessel(x, z, dir + (r() < 0.5 ? 1 : -1) * 1.1, rad * 0.6, Math.floor(len * 0.5));
        }
        if (pts.length > 2)
          list.push(
            B3.taperTube(
              new THREE.CatmullRomCurve3(pts),
              pts.length * 3,
              rad,
              rad * 0.5,
              6,
              B3.rgb('#8a2f3d')
            )
          );
      };
      vessel(-9, -6, 0.3, 0.28, 40);
      vessel(4.5, -9.5, 1.7, 0.24, 36);
      vessel(9.5, 4, 3.2, 0.22, 30);
      vessel(-4.5, 9, -1.5, 0.2, 30);
      if (list.length)
        scene.add(
          new THREE.Mesh(
            B3.merge(list),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 })
          )
        );
    }

    /* odak: ön kesitte, sağ kıvrımın tepesinin altında gri madde */
    const fx = w(ZF) + 4.3;
    st.focus.set(fx, h(fx, ZF) - 1.25, ZF);

    /* etiketler */
    const L = (t, p, cls) => {
      const l = B3.label(ctx.layer, t, cls || 'tag');
      l.pos.copy(p);
      st.labels.push(l);
      return l;
    };
    L('kıvrım (girus)', V(fx, h(fx, ZF) + 0.9, ZF - 2));
    L('oluk (sulkus)', V(w(0), 1.2, 0));
    L(
      'gri madde: nöron gövdeleri<br><small>2–3 mm kalınlık</small>',
      V(-4.2, h(-4.2, ZF) - 1.0, ZF + 0.2),
      'side'
    );
    L(
      'beyaz madde: aksonlar<br><small>yağlı kılıf (miyelin) beyaz gösterir</small>',
      V(-1.5, -11, ZF + 0.2),
      'side'
    );
    L('damar', V(-8.4, h(-8.4, -5.6) + 0.6, -5.6));
    const gl = L(
      'Gennari çizgisi<br><small>yalnız görme alanında, gözle görülür</small>',
      V(fx + 2.4, h(fx + 2.4, ZF) - 1.35, ZF + 0.2),
      'side'
    );
    gl.on = false;
    st.setLobe = function (lobe) {
      gennari = lobe === 'occipital';
      gl.on = gennari;
      faces.forEach(paintFace);
      st.lobeName = lobe;
    };
    st.update = function () {};
    st.card = function () {
      const nm = st.lobeName && ctx.lobeName ? ctx.lobeName(st.lobeName) : '';
      return {
        title: 'Kabuktan bir parça' + (nm ? ' · ' + nm : ''),
        scale: '≈ 1 cm',
        body: 'Beyin kabuğu (gri madde) sadece 2–3 mm kalınlığında; nöronların gövdeleri burada. Altındaki beyaz madde, bölgeleri birbirine bağlayan aksonlardır; miyelin denen yağlı kılıf onları beyaz gösterir ve sinyali hızlandırır.'
      };
    };
    return st;
  };
})();
