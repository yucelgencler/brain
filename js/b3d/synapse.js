/* Durak 5: bir sinaps (1 birim = 10 nm).
   Akson ucu (üstte) → sinaps aralığı → dendrit dikeni (altta). Bir sinyal gelince:
   kalsiyum girer → kesecikler zara kaynaşır → taşıyıcı molekül aralığa dökülür → alıcılara bağlanır → iyonlar dikene akar. */
(function () {
  'use strict';
  const B3 = window.B3,
    { smooth, clamp, lerp } = B3;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const CLEFT = 7; // aralığın kalınlığı (gerçekte ~2 birim = 20 nm; görünsün diye kalın)

  B3.makeSynapseStage = function (ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ctx.bg);
    const st = {
      id: 'synapse',
      name: 'Sinaps',
      scene,
      far: 440,
      near: 72,
      unit: 1e-8,
      center: V(0, -8, 0),
      focus: V(0, 0, 0),
      focusDir: V(0, 0, 1),
      home: { yaw: 0.45, pitch: 0.14 },
      labels: [],
      type: 'exc'
    };
    st.yaw = st.home.yaw;
    st.pitch = st.home.pitch;
    scene.add(new THREE.HemisphereLight(0xeef1ff, 0x2b1f35, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(120, 200, 180);
    scene.add(key);
    const back = new THREE.DirectionalLight(0x9fb6ff, 0.4);
    back.position.set(-100, -50, -150);
    scene.add(back);
    const r = B3.rng(44);

    const preMat = new THREE.MeshStandardMaterial({
      color: 0x7da2ff,
      roughness: 0.35,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: new THREE.Color(0, 0, 0)
    });
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xa58ce0,
      roughness: 0.35,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: new THREE.Color(0, 0, 0)
    });
    /* akson ve akson ucu */
    {
      const g = B3.shapedGeometry(5, function (dx, dy, dz, o) {
        let x = dx * 56,
          y = dy * 52 + 62,
          z = dz * 56;
        if (y < CLEFT + 2) {
          const k = smooth(CLEFT + 2, -20, y);
          y = CLEFT + 2 - k * 1.5;
          x *= 1 - 0.1 * k;
          z *= 1 - 0.1 * k;
        }
        o[0] = x;
        o[1] = y;
        o[2] = z;
      });
      scene.add(new THREE.Mesh(g, preMat));
      const ax = new THREE.Mesh(new THREE.CylinderGeometry(15, 19, 200, 24, 1, true), preMat);
      ax.position.y = 200;
      scene.add(ax);
    }
    /* dendrit dikeni, boynu ve dendrit gövdesi */
    {
      const g = B3.shapedGeometry(5, function (dx, dy, dz, o) {
        let x = dx * 48,
          y = dy * 40 - 40,
          z = dz * 48;
        if (y > -2) {
          const k = smooth(-2, 25, y);
          y = -2 + k * 0.8;
        }
        o[0] = x;
        o[1] = y;
        o[2] = z;
      });
      scene.add(new THREE.Mesh(g, postMat));
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 70, 20, 1, true), postMat);
      neck.position.y = -105;
      scene.add(neck);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 420, 32, 1, true), postMat);
      shaft.rotation.z = Math.PI / 2;
      shaft.position.y = -180;
      scene.add(shaft);
      const psd = new THREE.Mesh(
        new THREE.CylinderGeometry(24, 24, 1.6, 40),
        new THREE.MeshStandardMaterial({ color: 0x3b2556, roughness: 0.8 })
      );
      psd.position.y = -2.6;
      scene.add(psd);
      const az = new THREE.Mesh(
        new THREE.CylinderGeometry(22, 22, 1.2, 40),
        new THREE.MeshStandardMaterial({ color: 0x2b3a6e, roughness: 0.8 })
      );
      az.position.y = CLEFT + 2.6;
      scene.add(az);
    }
    /* mitokondri */
    {
      const m = new THREE.Mesh(
        new THREE.CapsuleGeometry(9, 30, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0xd98a5c, roughness: 0.55 })
      );
      m.position.set(24, 84, -8);
      m.rotation.z = 1.1;
      m.rotation.y = 0.4;
      scene.add(m);
    }
    /* alıcılar */
    const RN = 28,
      receptors = [];
    const recMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1.5, 1.5, 4.2, 8),
      new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      RN
    );
    const dummy = new THREE.Object3D(),
      RC = new THREE.Color('#6a5a9c'),
      RO_E = new THREE.Color('#7ff0ff'),
      RO_I = new THREE.Color('#9dffb0'),
      tc = new THREE.Color();
    for (let i = 0; i < RN; i++) {
      const a = r() * Math.PI * 2,
        rr = Math.sqrt(r()) * 20;
      const p = V(Math.cos(a) * rr, -0.2, Math.sin(a) * rr);
      receptors.push({ p, open: 0 });
      dummy.position.copy(p);
      dummy.updateMatrix();
      recMesh.setMatrixAt(i, dummy.matrix);
      recMesh.setColorAt(i, RC);
    }
    scene.add(recMesh);
    /* kalsiyum kanalları */
    const caCh = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      caCh.push(V(Math.cos(a) * 27, CLEFT + 5, Math.sin(a) * 27));
    }
    const caMat = new THREE.MeshStandardMaterial({
      color: 0xc9a63a,
      roughness: 0.5,
      emissive: new THREE.Color(0, 0, 0)
    });
    caCh.forEach(p => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 6, 8), caMat);
      m.position.copy(p);
      scene.add(m);
    });
    /* kesecikler */
    const VN = 46,
      ves = [];
    const vesMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(2.4, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0xbfe3ff,
        roughness: 0.3,
        emissive: new THREE.Color(0x10202a)
      }),
      VN
    );
    function poolPos() {
      for (;;) {
        const p = V((r() - 0.5) * 84, CLEFT + 14 + r() * 70, (r() - 0.5) * 84);
        if (
          Math.hypot(p.x, (p.y - 62) * 1.0, p.z) < 46 &&
          !(Math.hypot(p.x - 24, p.z + 8) < 14 && Math.abs(p.y - 84) < 22)
        )
          return p;
      }
    }
    for (let i = 0; i < VN; i++) {
      const dock = i < 7;
      const p = dock
        ? V(Math.cos((i / 7) * Math.PI * 2) * 13, CLEFT + 5.5, Math.sin((i / 7) * Math.PI * 2) * 13)
        : poolPos();
      ves.push({ p, home: p.clone(), dock, state: 'idle', t: 0, s: 1 });
    }
    scene.add(vesMesh);
    function drawVes() {
      ves.forEach((v, i) => {
        dummy.position.copy(v.p);
        dummy.scale.setScalar(Math.max(0.001, v.s));
        dummy.updateMatrix();
        vesMesh.setMatrixAt(i, dummy.matrix);
      });
      vesMesh.instanceMatrix.needsUpdate = true;
    }
    drawVes();

    const glow = new B3.GlowPoints(2600);
    scene.add(glow.mesh);
    let parts = []; // {p,v,kind,age,life,bound}
    let T = 0,
      seq = null,
      nextAuto = 2.5;
    const TYPES = {
      exc: {
        nt: 'glutamat',
        ntc: [0.75, 1, 0.7],
        ion: 'Na⁺',
        ionc: [0.45, 0.95, 1],
        ro: RO_E,
        sign: 1
      },
      inh: { nt: 'GABA', ntc: [1, 0.6, 0.85], ion: 'Cl⁻', ionc: [0.6, 1, 0.6], ro: RO_I, sign: -1 }
    };

    st.release = function (type) {
      if (type) st.type = type;
      seq = { t0: T, fused: false, ca: false };
      nextAuto = T + 7.5;
    };
    st.setType = function (t) {
      st.type = t;
    };

    /* etiketler */
    const L = (t, p, cls) => {
      const l = B3.label(ctx.layer, t, cls || 'side');
      l.pos.copy(p);
      st.labels.push(l);
      return l;
    };
    L('akson: sinyal buradan gelir', V(18, 250, 0));
    L('akson ucu', V(56, 64, 0));
    L('kesecikler<br><small>içleri taşıyıcı molekül dolu</small>', V(-38, 56, 30));
    L('mitokondri: enerji', V(44, 100, -8));
    L('sinaps aralığı<br><small>gerçekte ~20 nm</small>', V(-78, 3, 0));
    L('alıcılar (reseptör)', V(30, -4, 22));
    L('dendrit dikeni<br><small>öbür nöronun girişi</small>', V(50, -50, 0));
    const lCa = L('Ca²⁺ girer', V(-34, CLEFT + 12, 20), 'live');
    lCa.on = false;
    const lNt = L('glutamat', V(26, CLEFT + 2, -40), 'live');
    lNt.on = false;
    const lIon = L('Na⁺ dikene akar', V(-26, -24, 26), 'live');
    lIon.on = false;
    const lV = L('', V(-50, -48, 40), 'live big');
    lV.on = false;

    let spineV = 0;
    st.update = function (dt, info) {
      const k = info.paused ? 0 : dt * Math.max(0.15, info.speed / 4);
      T += k;
      if (!info.paused && T > nextAuto && !seq) st.release();
      const TY = TYPES[st.type];
      glow.clear();
      let caOpen = 0,
        bout = 0;
      if (seq) {
        const s = T - seq.t0;
        // 1) akson boyunca sinyal (0–0.7)
        if (s < 0.75) {
          const u = s / 0.7,
            y = lerp(300, 80, u);
          glow.add(0, y, 0, 0.85, 0.95, 1, 40, 0.9);
          for (let j = 1; j < 6; j++)
            glow.add(0, y + j * 9, 0, 0.85, 0.95, 1, 30 - j * 4, 0.5 - j * 0.08);
        }
        bout = Math.exp(-(((s - 0.75) / 0.35) ** 2));
        // 2) kalsiyum (0.7–)
        if (s > 0.7 && !seq.ca) {
          seq.ca = true;
          caCh.forEach(c => {
            for (let j = 0; j < 7; j++)
              parts.push({
                p: c.clone(),
                v: V(-c.x * 0.6 + (r() - 0.5) * 20, 14 + r() * 20, -c.z * 0.6 + (r() - 0.5) * 20),
                kind: 'ca',
                age: 0,
                life: 1.6 + r() * 0.6
              });
          });
        }
        caOpen = smooth(0.6, 0.75, s) * (1 - smooth(1.2, 1.6, s));
        // 3) kaynaşma (1.0–1.5)
        if (s > 1.0 && !seq.fused) {
          seq.fused = true;
          ves
            .filter(v => v.dock && v.state === 'idle')
            .slice(0, 4)
            .forEach((v, j) => {
              v.state = 'fuse';
              v.t = T + j * 0.08;
            });
        }
        if (s > 4.4) {
          ves.forEach(v => {
            if (v.state === 'gone') {
              v.state = 'refill';
              v.t = T;
              v.p.copy(poolPos());
            }
          });
        }
        if (s > 6.2) seq = null;
        lCa.on = s > 0.7 && s < 2.2;
        lNt.on = s > 1.15 && s < 3.6;
        lIon.on = s > 1.5 && s < 3.8;
      } else {
        lCa.on = lNt.on = lIon.on = false;
      }
      lNt.el.textContent = TY.nt + (st.type === 'exc' ? ' (uyarıcı)' : ' (susturan)');
      lIon.el.textContent = TY.ion + ' dikene akar';
      caMat.emissive.setRGB(0.8 * caOpen, 0.6 * caOpen, 0.1 * caOpen);
      preMat.emissive.setRGB(0.25 * bout, 0.35 * bout, 0.6 * bout);
      // kesecikler
      ves.forEach(v => {
        if (v.state === 'fuse' && T >= v.t) {
          const u = clamp((T - v.t) / 0.45, 0, 1);
          v.p.y = lerp(v.home.y, CLEFT + 2.6, u);
          v.s = 1 - u * 0.7;
          if (u >= 1) {
            v.state = 'gone';
            v.s = 0;
            for (let j = 0; j < 36; j++)
              parts.push({
                p: V(v.p.x + (r() - 0.5) * 3, CLEFT + 1.5, v.p.z + (r() - 0.5) * 3),
                v: V((r() - 0.5) * 26, -(8 + r() * 14), (r() - 0.5) * 26),
                kind: 'nt',
                age: 0,
                life: 3.2 + r() * 0.8
              });
          }
        } else if (v.state === 'refill') {
          const u = clamp((T - v.t) / 1.2, 0, 1);
          v.s = u;
          if (v.dock) v.p.lerp(v.home, u * 0.2);
          if (u >= 1) {
            v.state = 'idle';
            v.p.copy(v.home);
            v.s = 1;
          }
        }
      });
      drawVes();
      // parçacıklar
      let bound = 0;
      parts = parts.filter(p => {
        p.age += k;
        if (p.age > p.life) return false;
        const fade = 1 - smooth(p.life * 0.7, p.life, p.age);
        if (p.kind === 'ca') {
          p.p.addScaledVector(p.v, k);
          p.v.multiplyScalar(Math.pow(0.15, k));
          p.v.add(V((r() - 0.5) * 60 * k, (r() - 0.5) * 60 * k, (r() - 0.5) * 60 * k));
          glow.add(p.p.x, p.p.y, p.p.z, 1, 0.85, 0.3, 3.2, 0.9 * fade);
        } else if (p.kind === 'nt') {
          if (p.rec != null) {
            const R = receptors[p.rec];
            R.open = Math.min(1, R.open + k * 6);
            bound++;
            p.p.lerp(V(R.p.x, 2.4, R.p.z), Math.min(1, k * 8));
            if (p.age > p.bindUntil) {
              p.rec = null;
              p.v.set((r() - 0.5) * 40, 6 + r() * 6, (r() - 0.5) * 40);
            }
          } else {
            p.p.addScaledVector(p.v, k);
            p.v.add(V((r() - 0.5) * 160 * k, (r() - 0.5) * 90 * k, (r() - 0.5) * 160 * k));
            p.v.multiplyScalar(Math.pow(0.4, k));
            if (p.p.y < 1.2) {
              p.p.y = 1.2;
              p.v.y = Math.abs(p.v.y) * 0.4;
              if (!p.used && p.age < p.life * 0.6) {
                let best = -1,
                  bd = 5;
                receptors.forEach((R, i) => {
                  const d = Math.hypot(R.p.x - p.p.x, R.p.z - p.p.z);
                  if (d < bd) {
                    bd = d;
                    best = i;
                  }
                });
                if (best >= 0) {
                  p.rec = best;
                  p.used = true;
                  p.bindUntil = p.age + 0.35 + r() * 0.4;
                  for (let j = 0; j < 3; j++)
                    parts.push({
                      p: V(receptors[best].p.x, 1, receptors[best].p.z),
                      v: V((r() - 0.5) * 8, -(22 + r() * 18), (r() - 0.5) * 8),
                      kind: 'ion',
                      age: 0,
                      life: 1.3
                    });
                }
              }
            }
            if (p.p.y > CLEFT + 1.6) {
              p.p.y = CLEFT + 1.6;
              p.v.y = -Math.abs(p.v.y);
            }
            const rad = Math.hypot(p.p.x, p.p.z);
            if (rad > 58 && p.age > p.life * 0.5) return false;
          }
          glow.add(p.p.x, p.p.y, p.p.z, TY.ntc[0], TY.ntc[1], TY.ntc[2], 2.2, 0.95 * fade);
        } else if (p.kind === 'ion') {
          p.p.addScaledVector(p.v, k);
          p.v.x += (r() - 0.5) * 80 * k;
          p.v.z += (r() - 0.5) * 80 * k;
          glow.add(p.p.x, p.p.y, p.p.z, TY.ionc[0], TY.ionc[1], TY.ionc[2], 3, 0.9 * fade);
        }
        return true;
      });
      receptors.forEach((R, i) => {
        R.open = Math.max(0, R.open - k * 1.1);
        tc.copy(RC).lerp(TY.ro, Math.min(1, R.open));
        recMesh.setColorAt(i, tc);
        if (R.open > 0.15)
          glow.add(R.p.x, 1, R.p.z, TY.ro.r, TY.ro.g, TY.ro.b, 7 * R.open, 0.6 * R.open);
      });
      recMesh.instanceColor.needsUpdate = true;
      const openSum = receptors.reduce((a, R) => a + R.open, 0) / RN;
      spineV = lerp(spineV, openSum, Math.min(1, k * 3));
      const sv = Math.min(1, spineV * 3);
      if (TY.sign > 0) postMat.emissive.setRGB(0.15 * sv, 0.35 * sv, 0.5 * sv);
      else postMat.emissive.setRGB(0.02 * sv, 0.05 * sv, 0.12 * sv);
      postMat.opacity = 0.24 + (TY.sign > 0 ? 0.12 : -0.06) * sv;
      lV.on = sv > 0.05;
      lV.el.textContent =
        TY.sign > 0
          ? `dikende gerilim yükseliyor  +${B3.fmt(sv * 4, 1)} mV`
          : `dikende gerilim düşüyor  −${B3.fmt(sv * 2, 1)} mV`;
      glow.commit(info.pxScale);
    };
    st.card = function () {
      const exc = st.type === 'exc';
      return {
        title: 'Bir sinaps',
        scale: '≈ 1 µm',
        body:
          'Elektrik sinyali akson ucuna gelince kalsiyum kapıları açılır. Kalsiyum, keseciklerin zara kaynaşmasını tetikler; içlerindeki taşıyıcı molekül (' +
          (exc ? 'glutamat' : 'GABA') +
          ') aralığa dökülür ve karşı taraftaki alıcılara oturur. Alıcılar açılınca iyonlar dikene akar ve öbür nöronun gerilimi ' +
          (exc ? 'biraz yükselir' : 'biraz düşer') +
          '. Gerçekte hepsi ~1 ms; burada ~2.000 kat yavaş.',
        action: { label: '⚡ Sinyal gönder', fn: () => st.release() },
        action2: {
          label: exc ? 'Susturan sinapsa çevir' : 'Uyarıcı sinapsa çevir',
          fn: () => {
            st.setType(exc ? 'inh' : 'exc');
            st.release();
          }
        }
      };
    };
    return st;
  };
})();
