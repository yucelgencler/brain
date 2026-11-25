/* Durak 3: kabuğun altı katmanı ve bir kolon (1 birim = 10 µm).
   Her nokta bir nöron; gerçekte bu hacimde yüz binlerce nöron var, burada temsilî ~4.700 tane. */
(function () {
  'use strict';
  const B3 = window.B3,
    { smooth, clamp, lerp } = B3;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const W = 80;
  const LAYERS = [
    {
      id: 'I',
      top: 0,
      bot: -25,
      n: 40,
      pyr: 0,
      size: 0.9,
      name: 'I',
      text: 'neredeyse yalnız lifler'
    },
    {
      id: 'II',
      top: -25,
      bot: -55,
      n: 420,
      pyr: 0.75,
      size: 1.0,
      name: 'II',
      text: 'komşu kolonlarla konuşur'
    },
    {
      id: 'III',
      top: -55,
      bot: -110,
      n: 620,
      pyr: 0.8,
      size: 1.2,
      name: 'III',
      text: 'komşu kolonlarla, öbür yarım küreyle'
    },
    {
      id: 'IV',
      top: -110,
      bot: -140,
      n: 950,
      pyr: 0.05,
      size: 0.8,
      name: 'IV',
      text: 'talamustan gelen girdi buraya iner'
    },
    {
      id: 'V',
      top: -140,
      bot: -195,
      n: 300,
      pyr: 0.85,
      size: 1.8,
      name: 'V',
      text: 'büyük piramitler: çıktı (kas, omurilik)'
    },
    {
      id: 'VI',
      top: -195,
      bot: -250,
      n: 560,
      pyr: 0.6,
      size: 1.1,
      name: 'VI',
      text: 'talamusa geri bildirim'
    }
  ];

  B3.makeColumnStage = function (ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ctx.bg);
    scene.fog = new THREE.FogExp2(ctx.bg, 0.0011);
    const st = {
      id: 'column',
      name: 'Kolon',
      scene,
      far: 540,
      near: 42,
      unit: 1e-5,
      center: V(0, -125, 0),
      focus: V(0, -82, 0),
      focusDir: V(0.08, 0.1, 1).normalize(),
      home: { yaw: 0.5, pitch: 0.2 },
      labels: []
    };
    st.yaw = st.home.yaw;
    st.pitch = st.home.pitch;
    scene.add(new THREE.HemisphereLight(0xe9ecff, 0x251a33, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(100, 200, 160);
    scene.add(key);

    const r = B3.rng(31);
    const cells = []; // {x,y,z,layer,pyr,inCol}
    LAYERS.forEach((L, li) => {
      for (let k = 0; k < L.n; k++) {
        const x = -W + r() * 2 * W,
          z = -W + r() * 2 * W,
          y = L.bot + r() * (L.top - L.bot);
        cells.push({
          x,
          y,
          z,
          li,
          pyr: r() < L.pyr,
          size: L.size * (0.8 + r() * 0.45),
          inCol: Math.hypot(x, z) < 30,
          act: 0,
          due: -1
        });
      }
    });
    const pyrs = cells.filter(c => c.pyr),
      rounds = cells.filter(c => !c.pyr);
    const dummy = new THREE.Object3D();
    const sphere = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      rounds.length
    );
    const cone = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 2.6, 5),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      pyrs.length
    );
    const BASE_P = new THREE.Color('#8b7fd8'),
      BASE_R = new THREE.Color('#b79acb'),
      HOT = new THREE.Color('#fff6c8'),
      tmpC = new THREE.Color();
    rounds.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.setScalar(c.size * 0.85);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      sphere.setMatrixAt(i, dummy.matrix);
      sphere.setColorAt(i, BASE_R);
      c.mi = i;
      c.mesh = sphere;
    });
    pyrs.forEach((c, i) => {
      dummy.position.set(c.x, c.y, c.z);
      dummy.scale.setScalar(c.size * 0.8);
      dummy.rotation.set(0, r() * 6, 0);
      dummy.updateMatrix();
      cone.setMatrixAt(i, dummy.matrix);
      cone.setColorAt(i, BASE_P);
      c.mi = i;
      c.mesh = cone;
    });
    scene.add(sphere, cone);
    /* piramitlerin tepe dendritleri: I. katmana doğru */
    {
      const P = [];
      pyrs.forEach(c => {
        if (r() > 0.55 && c.li !== 4) return;
        const top = c.li === 4 ? -6 - r() * 10 : Math.max(-20, c.y + 30 + r() * 40);
        let x = c.x,
          z = c.z,
          y = c.y + c.size * 1.3;
        const steps = 6;
        for (let s = 0; s < steps; s++) {
          const ny = lerp(c.y, top, (s + 1) / steps),
            nx = x + (r() - 0.5) * 1.5,
            nzz = z + (r() - 0.5) * 1.5;
          P.push(x, y, z, nx, ny, nzz);
          x = nx;
          y = ny;
          z = nzz;
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      scene.add(
        new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({
            color: 0x7d72c4,
            transparent: true,
            opacity: 0.32,
            depthWrite: false
          })
        )
      );
    }
    /* talamustan gelen lifler: aşağıdan IV. katmana */
    const fibers = [];
    {
      const P = [];
      for (let k = 0; k < 26; k++) {
        const a = r() * Math.PI * 2,
          rr = r() * 26;
        let x = Math.cos(a) * rr,
          z = Math.sin(a) * rr,
          y = -330;
        const pts = [];
        while (y < -118) {
          pts.push(V(x, y, z));
          y += 14;
          x += (r() - 0.5) * 2;
          z += (r() - 0.5) * 2;
        }
        for (let i = 0; i + 1 < pts.length; i++)
          P.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        fibers.push(pts);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      st.fiberMat = new THREE.LineBasicMaterial({
        color: 0x8fd3ff,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      scene.add(new THREE.LineSegments(g, st.fiberMat));
    }
    /* kutu ve katman sınırları */
    {
      const P = [];
      const box = y => {
        P.push(-W, y, -W, W, y, -W, W, y, -W, W, y, W, W, y, W, -W, y, W, -W, y, W, -W, y, -W);
      };
      LAYERS.forEach(L => box(L.top));
      box(-250);
      [
        [-W, -W],
        [W, -W],
        [W, W],
        [-W, W]
      ].forEach(([x, z]) => P.push(x, 0, z, x, -250, z));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      scene.add(
        new THREE.LineSegments(
          g,
          new THREE.LineBasicMaterial({ color: 0x5a5f95, transparent: true, opacity: 0.45 })
        )
      );
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(30, 30, 250, 40, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x9fb6ff,
          transparent: true,
          opacity: 0.06,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      cyl.position.y = -125;
      scene.add(cyl);
      const ring = [];
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        ring.push(V(Math.cos(a) * 30, 0, Math.sin(a) * 30));
      }
      [0, -250].forEach(y => {
        const g2 = new THREE.BufferGeometry().setFromPoints(ring.map(p => V(p.x, y, p.z)));
        scene.add(
          new THREE.Line(
            g2,
            new THREE.LineBasicMaterial({ color: 0x9fb6ff, transparent: true, opacity: 0.5 })
          )
        );
      });
    }
    /* etiketler */
    LAYERS.forEach(L => {
      const l = B3.label(ctx.layer, `<b>${L.name}</b> ${L.text}`, 'layer');
      l.pos.set(-W - 4, (L.top + L.bot) / 2, W);
      st.labels.push(l);
    });
    {
      const l = B3.label(
        ctx.layer,
        'bir kolon ≈ 0,5 mm<br><small>altta talamustan gelen lifler</small>',
        'side'
      );
      l.pos.set(32, 6, 30);
      st.labels.push(l);
    }

    const glow = new B3.GlowPoints(600);
    scene.add(glow.mesh);
    let wave = null,
      nextAuto = ctx.clock() + 3;
    st.stimulate = function () {
      const now = ctx.clock();
      wave = { t0: now };
      const D = [1.0, 0.55, 0.55, 0.25, 0.85, 1.15]; // katmana göre gecikme (s, yavaşlatılmış): IV önce
      cells.forEach(c => {
        const near = Math.hypot(c.x, c.z);
        const p = c.inCol
          ? c.li === 3
            ? 0.9
            : 0.6
          : c.li === 1 || c.li === 2
            ? 0.18 * Math.exp(-(near - 30) / 40)
            : 0.02;
        if (r() < p) c.due = now + D[c.li] + r() * 0.35 + (c.inCol ? 0 : 0.35);
      });
    };
    st.update = function (dt, info) {
      const now = ctx.clock();
      if (!info.paused && now > nextAuto) {
        st.stimulate();
        nextAuto = now + 7;
      }
      // kendiliğinden ateşleme
      if (!info.paused)
        for (let k = 0; k < Math.round(40 * dt) + (r() < (40 * dt) % 1 ? 1 : 0); k++) {
          const c = cells[Math.floor(r() * cells.length)];
          c.act = 1;
        }
      let dirtyS = false,
        dirtyC = false;
      glow.clear();
      const fa = wave ? Math.max(0, 1 - (now - wave.t0) / 0.6) : 0;
      st.fiberMat.opacity = 0.22 + 0.6 * fa;
      if (wave && now - wave.t0 < 0.45) {
        const u = (now - wave.t0) / 0.45;
        fibers.forEach(pts => {
          const k = Math.max(0, Math.min(pts.length - 1, Math.floor(u * pts.length)));
          const p = pts[k];
          glow.add(p.x, p.y, p.z, 0.6, 0.9, 1, 9, 0.9);
        });
      }
      for (const c of cells) {
        if (c.due > 0 && now >= c.due) {
          c.act = 1;
          c.due = -1;
        }
        if (c.act > 0.002) {
          c.act *= Math.exp(-dt / 0.28);
          tmpC.copy(c.pyr ? BASE_P : BASE_R).lerp(HOT, Math.min(1, c.act * 1.2));
          c.mesh.setColorAt(c.mi, tmpC);
          if (c.pyr) dirtyC = true;
          else dirtyS = true;
          if (c.act > 0.25) glow.add(c.x, c.y, c.z, 1, 0.92, 0.6, c.size * 7 * c.act, 0.7 * c.act);
          if (c.act <= 0.002) {
            c.act = 0;
            c.mesh.setColorAt(c.mi, c.pyr ? BASE_P : BASE_R);
          }
        }
      }
      if (dirtyS) sphere.instanceColor.needsUpdate = true;
      if (dirtyC) cone.instanceColor.needsUpdate = true;
      glow.commit(info.pxScale);
    };
    st.card = function () {
      return {
        title: 'Altı katman, bir kolon',
        scale: '≈ 1 mm',
        body: 'Kabuk altı katmandır. Talamustan gelen girdi IV. katmana iner, oradan II–III’e, sonra V’e (çıkış) ve VI’ya geçer: hemen her bölgede tekrarlanan aynı devre. Bu küpte gerçekte ~300.000 nöron ve milyarlarca sinaps var; burada her nokta bir nöron, ama yalnız yaklaşık %1’ini gösteriyoruz.',
        ai: 'Katmanlı yapay ağlarda da girdi önce bir katmana gelir, sonra sırayla sonrakilere aktarılır.',
        action: { label: '⚡ Girdi gönder', fn: () => st.stimulate() }
      };
    };
    return st;
  };
})();
