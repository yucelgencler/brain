/* Durak 4: küçük bir devre (1 birim = 1 µm).
   Nöronların biçimi gerçek kurallara göre üretilir (piramit: tepe dendriti + taban dendritleri + aşağı inen akson;
   susturan: yuvarlak gövde, kısa dallar). Akım B3.sim ile hesaplanır; burada yalnız gösterilir. */
(function () {
  'use strict';
  const B3 = window.B3,
    { smooth, clamp, lerp } = B3;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const EXC = '#6f93f0',
    INH = '#ef6f9c',
    FIB = '#7fd0ff';

  B3.makeMicroStage = function (ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ctx.bg);
    scene.fog = new THREE.FogExp2(ctx.bg, 0.0013);
    const st = {
      id: 'micro',
      name: 'Nöronlar',
      scene,
      far: 640,
      near: 3.4,
      unit: 1e-6,
      center: V(0, -45, 0),
      focus: V(),
      focusDir: V(0.25, 0.2, 1).normalize(),
      home: { yaw: 0.3, pitch: 0.1 },
      labels: [],
      mode: null
    };
    st.yaw = st.home.yaw;
    st.pitch = st.home.pitch;
    scene.add(new THREE.HemisphereLight(0xe8eeff, 0x2a1d33, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(120, 260, 200);
    scene.add(key);
    const glow = new B3.GlowPoints(3000, true, true);
    scene.add(glow.mesh);

    let group = null,
      vis = [],
      sim = null,
      spec = null,
      pulses = [],
      flashes = [],
      pickers = [],
      ownLabels = [];
    st.sel = null;
    st.following = null;

    function clearAll() {
      if (group) {
        scene.remove(group);
        group.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
      }
      ownLabels.forEach(l => {
        l.el.remove();
        const k = st.labels.indexOf(l);
        if (k >= 0) st.labels.splice(k, 1);
      });
      ownLabels = [];
      vis = [];
      pulses = [];
      flashes = [];
      pickers = [];
      st.sel = null;
      st.following = null;
    }
    function lbl(html, cls, pos) {
      const l = B3.label(ctx.layer, html, cls);
      l.pos.copy(pos);
      st.labels.push(l);
      ownLabels.push(l);
      return l;
    }

    st.setMode = function (mode) {
      if (st.mode === mode && group) return;
      clearAll();
      st.mode = mode;
      st.inhOn = true;
      st.drive = 1;
      st.center.set(0, mode === 'generic' ? -45 : -25, 0);
      const S = B3.sim;
      spec = mode === 'v1' ? S.specV1() : mode === 'it' ? S.specIT() : S.specGeneric(7);
      const r = B3.rng(mode === 'v1' ? 5 : mode === 'it' ? 6 : 8);
      group = new THREE.Group();
      scene.add(group);
      const pickMat = new THREE.MeshBasicMaterial({ visible: false });
      const jit = s => V((r() - 0.5) * s, (r() - 0.5) * s, (r() - 0.5) * s);

      spec.neurons.forEach((n, i) => {
        const p = V(n.pos[0], n.pos[1], n.pos[2]);
        const v = { n, i, p, dend: [], axon: null, mat: null, flash: 0, end: p.clone() };
        const parts = [];
        const col = B3.rgb(n.kind === 'int' ? INH : n.kind === 'in' ? FIB : EXC);
        if (n.kind === 'pyr') {
          const big = n.concept ? 1.15 : 1;
          parts.push(B3.sphereGeo(7 * big, p.x, p.y, p.z, col, 16, 12, 1, 1.3, 1));
          const cone = new THREE.ConeGeometry(4.2 * big, 12, 10);
          cone.translate(p.x, p.y + 9 * big, p.z);
          const cc = new Float32Array(cone.attributes.position.count * 3);
          for (let k = 0; k < cc.length; k += 3) {
            cc[k] = col[0];
            cc[k + 1] = col[1];
            cc[k + 2] = col[2];
          }
          cone.setAttribute('color', new THREE.BufferAttribute(cc, 3));
          parts.push(cone);
          const topY = p.y + 150 + r() * 50;
          const ap = new THREE.CatmullRomCurve3([
            p.clone().add(V(0, 12, 0)),
            p.clone().add(V((r() - 0.5) * 14, 60, (r() - 0.5) * 14)),
            V(p.x + (r() - 0.5) * 24, topY, p.z + (r() - 0.5) * 24)
          ]);
          v.dend.push(ap);
          parts.push(B3.taperTube(ap, 24, 2.6, 1.2, 7, col));
          const top = ap.getPointAt(1);
          for (let k = 0; k < 3; k++) {
            const c = new THREE.CatmullRomCurve3([
              top,
              top.clone().add(V((r() - 0.5) * 40, 14 + r() * 10, (r() - 0.5) * 40)),
              top.clone().add(V((r() - 0.5) * 80, 30 + r() * 20, (r() - 0.5) * 80))
            ]);
            v.dend.push(c);
            parts.push(B3.taperTube(c, 12, 1.2, 0.4, 5, col));
          }
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + r(),
              d = V(Math.cos(a), 0, Math.sin(a));
            const c = new THREE.CatmullRomCurve3([
              p.clone().add(d.clone().multiplyScalar(5)),
              p
                .clone()
                .add(d.clone().multiplyScalar(26))
                .add(V(0, -6 - r() * 6, 0))
                .add(jit(8)),
              p
                .clone()
                .add(d.clone().multiplyScalar(55 + r() * 20))
                .add(V(0, -18 - r() * 16, 0))
                .add(jit(12))
            ]);
            v.dend.push(c);
            parts.push(B3.taperTube(c, 14, 2.0, 0.5, 6, col));
            if (r() < 0.6) {
              const s = c.getPointAt(0.6);
              const c2 = new THREE.CatmullRomCurve3([
                s,
                s
                  .clone()
                  .add(V(d.z * 20, -10, -d.x * 20))
                  .add(jit(10)),
                s
                  .clone()
                  .add(V(d.z * 35, -22, -d.x * 35))
                  .add(jit(14))
              ]);
              v.dend.push(c2);
              parts.push(B3.taperTube(c2, 10, 0.9, 0.35, 5, col));
            }
          }
          v.axon = new THREE.CatmullRomCurve3([
            p.clone().add(V(0, -8, 0)),
            p.clone().add(V((r() - 0.5) * 10, -60, (r() - 0.5) * 10)),
            p.clone().add(V((r() - 0.5) * 30, -150, (r() - 0.5) * 30))
          ]);
          parts.push(B3.taperTube(v.axon, 24, 1.3, 0.8, 6, col));
        } else if (n.kind === 'int') {
          parts.push(B3.sphereGeo(6, p.x, p.y, p.z, col, 16, 12));
          for (let k = 0; k < 6; k++) {
            const d = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
            const c = new THREE.CatmullRomCurve3([
              p.clone().add(d.clone().multiplyScalar(5)),
              p.clone().add(d.clone().multiplyScalar(22)).add(jit(10)),
              p.clone().add(d.clone().multiplyScalar(45)).add(jit(16))
            ]);
            v.dend.push(c);
            parts.push(B3.taperTube(c, 12, 1.6, 0.45, 6, col));
          }
          v.axon = new THREE.CatmullRomCurve3([
            p.clone().add(V(0, -5, 0)),
            p.clone().add(V(20, -15, 10)),
            p.clone().add(V(10, -40, -10))
          ]);
          parts.push(B3.taperTube(v.axon, 16, 1.0, 0.6, 5, col));
        } else if (n.kind === 'in') {
          const trunk = new THREE.CatmullRomCurve3([
            p.clone().add(V((r() - 0.5) * 20, -170, (r() - 0.5) * 20)),
            p.clone().add(V((r() - 0.5) * 14, -80, (r() - 0.5) * 14)),
            p
          ]);
          parts.push(B3.taperTube(trunk, 20, 1.2, 1.0, 5, col));
          v.trunk = trunk;
        }
        if (parts.length) {
          v.mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.45,
            emissive: new THREE.Color(0, 0, 0)
          });
          const m = new THREE.Mesh(B3.merge(parts), v.mat);
          group.add(m);
        }
        if (n.kind === 'pyr' || n.kind === 'int') {
          const pk = new THREE.Mesh(new THREE.SphereGeometry(16, 8, 6), pickMat);
          pk.position.copy(p);
          pk.userData.vi = i;
          group.add(pk);
          pickers.push(pk);
        }
        vis.push(v);
      });

      /* bağlantılar: kaynağın aksonundan hedefin bir dendritine */
      const exT = [],
        inT = [];
      spec.conns.forEach(c => {
        const s = vis[c.a],
          t = vis[c.b];
        let pts = [];
        if (s.n.kind === 'in') {
          pts.push(s.p.clone());
        } else {
          const ub = s.n.kind === 'pyr' ? 0.25 + r() * 0.5 : 0.4 + r() * 0.5;
          for (let k = 0; k <= 3; k++) pts.push(s.axon.getPointAt((ub * k) / 3));
        }
        let tgt;
        if (t.n.kind === 'out') tgt = t.p.clone().add(jit(20));
        else {
          const d = t.dend[Math.floor(r() * t.dend.length)];
          tgt = d.getPointAt(0.35 + r() * 0.5);
        }
        const from = pts[pts.length - 1];
        pts.push(
          from.clone().lerp(tgt, 0.4).add(jit(24)),
          from.clone().lerp(tgt, 0.75).add(jit(14)),
          tgt
        );
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        c.curve = curve;
        c.tgt = tgt;
        c.len = curve.getLength();
        const g = B3.taperTube(
          curve,
          Math.max(16, Math.round(c.len / 6)),
          0.85,
          0.6,
          5,
          B3.rgb(c.w < 0 ? INH : s.n.kind === 'in' ? FIB : EXC)
        );
        (c.w < 0 ? inT : exT).push(g);
      });
      if (exT.length)
        group.add(
          new THREE.Mesh(
            B3.merge(exT),
            new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.5,
              transparent: true,
              opacity: 0.7
            })
          )
        );
      if (inT.length)
        group.add(
          new THREE.Mesh(
            B3.merge(inT),
            new THREE.MeshStandardMaterial({
              vertexColors: true,
              roughness: 0.5,
              transparent: true,
              opacity: 0.7
            })
          )
        );

      sim = new S.Sim(spec, mode === 'generic' ? 3 : 9);
      if (spec.rest) sim.setRates(spec.rest);

      /* etiketler */
      vis.forEach(v => {
        const n = v.n;
        if (n.kind === 'out') {
          lbl(n.label, 'out', v.p);
          return;
        }
        if (n.kind === 'in') {
          if (n.label) v.lbl = lbl(n.label, 'inp', v.p.clone().add(V(0, -30, 0)));
          return;
        }
        if (n.label) {
          v.lbl = lbl(
            `<span class="nm">${n.label}</span><span class="bar"><i></i></span>`,
            'nrn' + (n.concept ? ' concept' : '') + (n.kind === 'int' ? ' inh' : ''),
            v.p.clone().add(V(0, n.kind === 'pyr' ? -16 : -12, 0))
          );
          v.bar = v.lbl.el.querySelector('.bar i');
        }
      });
      if (mode === 'generic') {
        const p = vis.find(v => v.n.kind === 'pyr' && v.n.pos[1] > 0),
          q = vis.find(v => v.n.kind === 'int');
        if (p)
          lbl(
            'uyarıcı nöron<br><small>piramit hücre</small>',
            'side',
            p.p.clone().add(V(14, 0, 0))
          );
        if (q) lbl('susturan nöron', 'side', q.p.clone().add(V(12, 0, 0)));
        const fi = vis.find(v => v.n.kind === 'in');
        if (fi) lbl('talamustan gelen lif', 'side', fi.p.clone().add(V(10, -60, 0)));
      }
      /* seçili nöron paneli */
      st.selLbl = lbl(
        '<div class="vt"><b class="nm"></b><canvas width="168" height="54"></canvas><span class="mv"></span></div>',
        'trace',
        V()
      );
      st.selLbl.on = false;
      st.selCanvas = st.selLbl.el.querySelector('canvas');

      /* odak: iki uyarıcı nöron arasındaki bir sinaps */
      const fc =
        spec.conns.find(c => c.w > 0 && vis[c.a].n.kind !== 'in' && vis[c.b].n.kind === 'pyr') ||
        spec.conns[0];
      st.focusConn = fc;
      st.focus.copy(fc.tgt);
    };

    st.setStim = function (name) {
      if (!sim) return;
      if (name && spec.stim && spec.stim[name]) sim.setRates(spec.stim[name]);
      else {
        const base = {};
        spec.neurons.forEach(n => {
          if (n.kind === 'in') base[n.id] = n.rate;
        });
        sim.setRates(Object.assign(base, spec.rest || {}));
      }
      st.stim = name || null;
    };
    st.simTime = () => (sim ? sim.t : 0);
    st.count = id => {
      const n = spec.neurons.find(x => x.id === id);
      return n ? sim.count[n.i] : 0;
    };
    st.resetCounts = () => {
      if (sim) sim.count.fill(0);
    };

    st.pick = function (raycaster) {
      const hit = raycaster.intersectObjects(pickers, false)[0];
      return hit ? hit.object.userData.vi : null;
    };
    st.select = function (vi) {
      st.sel = vi;
      st.selLbl.on = vi != null;
      highlight(vi);
    };
    // Seçili nöronun bağlantılarını parlat: giden kalın, gelen ince
    let hiGroup = null;
    function highlight(vi) {
      if (hiGroup) {
        if (hiGroup.parent) hiGroup.parent.remove(hiGroup);
        hiGroup.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        hiGroup = null;
      }
      if (vi == null || !spec) return;
      const out = [],
        inn = [];
      for (const c of spec.conns) {
        if (vis[c.b].n.kind === 'out') continue;
        if (c.a === vi)
          out.push(B3.taperTube(c.curve, 40, 1.6, 1.2, 6, B3.rgb(c.w < 0 ? '#ff9cc0' : '#a9c4ff')));
        else if (c.b === vi)
          inn.push(B3.taperTube(c.curve, 40, 1.1, 0.9, 6, B3.rgb(c.w < 0 ? '#ff7aa8' : '#7fa6ff')));
      }
      hiGroup = new THREE.Group();
      if (out.length)
        hiGroup.add(
          new THREE.Mesh(B3.merge(out), new THREE.MeshBasicMaterial({ vertexColors: true }))
        );
      if (inn.length)
        hiGroup.add(
          new THREE.Mesh(
            B3.merge(inn),
            new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55 })
          )
        );
      group.add(hiGroup);
    }
    /* --- deneyler: ateşlet, susturmayı kapat, girdiyi değiştir --- */
    st.inhOn = true;
    st.drive = 1;
    st.cardRev = 0;
    st.fireOne = function () {
      if (!sim) return;
      if (st.sel == null || vis[st.sel].n.kind === 'in') {
        const pyr = vis.filter(v => v.n.kind === 'pyr');
        st.select(pyr[Math.floor(Math.random() * pyr.length)].i);
      }
      sim.kick(st.sel);
    };
    st.setInhibition = function (on) {
      st.inhOn = on;
      if (sim) sim.inhGain = on ? 1 : 0;
      vis.forEach(v => {
        if (v.n.kind !== 'int' || !v.mat) return;
        v.mat.transparent = !on;
        v.mat.opacity = on ? 1 : 0.22;
        v.mat.needsUpdate = true;
      });
      st.cardRev++;
    };
    st.setDrive = function (d) {
      st.drive = d;
      if (sim) sim.drive = d;
      st.cardRev++;
    };
    // canlı etkinlik: uyarıcı nöronların son 100 ms'deki ortalama ateşleme sıklığı
    let recent = [];
    function activityCaption() {
      if (!sim) return '';
      const nPyr = vis.filter(v => v.n.kind === 'pyr').length || 1;
      recent = recent.filter(t => t > sim.t - 100);
      const hz = Math.round(recent.length / nPyr / 0.1);
      const word = hz < 8 ? 'sakin' : hz <= 60 ? 'normal' : 'aşırı';
      let s = `Etkinlik: her uyarıcı nöron saniyede ~${hz} kez ateşliyor (${word}).`;
      if (!st.inhOn && hz > 60)
        s +=
          ' ⚠ Susturma olmadan uyarı kontrolden çıktı: sara (epilepsi) nöbetinde de beyindeki uyarı–susturma dengesi bozulur.';
      else if (!st.inhOn) s += ' Susturanlar kapalı: etkinlik yükseliyor…';
      else if (st.drive < 1) s += ' Dışarıdan az girdi geliyor: ağ sessizleşiyor.';
      else if (st.drive > 1) s += ' Dışarıdan çok girdi geliyor: ağ hareketleniyor.';
      return s;
    }

    /* --- takip --- */
    st.followNext = function () {
      st.following = { phase: 'wait', chain: 0 };
    };
    // Yolculuk için: verilen nöronlardan biri ateşleyince çıkışa (→ öbür bölgeye) giden sinyalini takip et
    st.followOut = function (ids) {
      st.following = { phase: 'wait', chain: 0, ids, toOut: true };
    };
    st.stopFollow = function () {
      st.following = null;
      st.override = null;
    };
    function startRide(p) {
      st.following = { phase: 'ride', p, chain: ((st.following && st.following.chain) || 0) + 1 };
    }

    const tmp = new THREE.Vector3(),
      EXCc = new THREE.Color(EXC),
      INHc = new THREE.Color(INH),
      WHITE = new THREE.Color('#ffffff'),
      em = new THREE.Color();
    st.update = function (dt, info) {
      if (!sim) return;
      const simDt = info.paused ? 0 : Math.min(dt * info.speed, 25);
      const res = simDt > 0 ? sim.step(simDt) : { spikes: [], arrivals: [] };
      const now = sim.t;
      if (st.mode === 'generic' && simDt > 0) st.caption = activityCaption();
      for (const s of res.spikes) {
        vis[s.i].flash = now;
        if (vis[s.i].n.kind === 'pyr') recent.push(s.t);
        const outs = spec.conns.filter(c => c.a === s.i);
        const fresh = [];
        for (const c of outs) {
          const p = { c, t0: s.t };
          pulses.push(p);
          fresh.push(p);
        }
        const F = st.following;
        if (F && F.toOut) {
          // yolculuk: istenen nöron ateşleyince çıkışa giden sinyaline bin
          if (F.phase === 'wait' && F.ids.includes(vis[s.i].n.id)) {
            const pick = fresh.find(p => vis[p.c.b].n.kind === 'out');
            if (pick) st.following = { phase: 'ride', p: pick, chain: 1, toOut: true, ids: F.ids };
          }
        } else if (
          F &&
          ((F.phase === 'wait' && vis[s.i].n.kind !== 'in') ||
            (F.phase === 'arrive' && s.i === F.target))
        ) {
          const pick =
            fresh.find(p => vis[p.c.b].n.kind === 'pyr') ||
            fresh.find(p => vis[p.c.b].n.kind !== 'out') ||
            fresh[0];
          if (pick) startRide(pick);
        }
      }
      for (const c of res.arrivals) flashes.push({ c, t: now });
      glow.clear();
      // darbeler
      pulses = pulses.filter(p => {
        const u = (now - p.t0) / p.c.travel;
        if (u >= 1) {
          if (st.following && st.following.p === p) {
            if (st.following.toOut) st.arrivedOut = true;
            st.following = {
              phase: 'arrive',
              target: p.c.b,
              c: p.c,
              until: ctx.clock() + 2.6,
              chain: st.following.chain
            };
            ctx.onArrive && ctx.onArrive(p.c, vis[p.c.a].n, vis[p.c.b].n);
          }
          return false;
        }
        if (u < 0) return true;
        const inh = p.c.w < 0,
          col = inh ? [1, 0.55, 0.75] : [0.85, 0.95, 1];
        p.c.curve.getPointAt(u, tmp);
        glow.add(tmp.x, tmp.y, tmp.z, col[0], col[1], col[2], 10, 1);
        for (let k = 1; k < 6; k++) {
          const uu = u - k * 0.018;
          if (uu < 0) break;
          p.c.curve.getPointAt(uu, tmp);
          glow.add(tmp.x, tmp.y, tmp.z, col[0], col[1], col[2], 8 - k, 0.55 - k * 0.08);
        }
        return true;
      });
      // sinaps parlamaları
      flashes = flashes.filter(f => {
        const a = 1 - (now - f.t) / 1.6;
        if (a <= 0) return false;
        const inh = f.c.w < 0;
        glow.add(
          f.c.tgt.x,
          f.c.tgt.y,
          f.c.tgt.z,
          inh ? 1 : 1,
          inh ? 0.45 : 0.9,
          inh ? 0.7 : 0.5,
          16 * a,
          0.9 * a
        );
        return true;
      });
      // sinaps noktaları (sönük)
      for (const c of spec.conns) {
        if (vis[c.b].n.kind === 'out') continue;
        glow.add(
          c.tgt.x,
          c.tgt.y,
          c.tgt.z,
          c.w < 0 ? 1 : 0.7,
          c.w < 0 ? 0.5 : 0.85,
          c.w < 0 ? 0.7 : 1,
          3.2,
          0.35
        );
      }
      // gövdeler: zar gerilimi ışıltısı, ateşlenince beyaz parlama
      vis.forEach(v => {
        if (!v.mat) return;
        if (v.n.kind === 'in') {
          const fl = Math.max(0, 1 - (now - v.flash) / 2);
          em.setRGB(0.2 * fl, 0.6 * fl, 0.8 * fl);
          v.mat.emissive.copy(em);
          if (fl > 0.05) glow.add(v.p.x, v.p.y, v.p.z, 0.6, 0.9, 1, 14 * fl, 0.8 * fl);
          return;
        }
        const ch = sim.charge(v.i),
          fl = Math.max(0, 1 - (now - v.flash) / 3);
        em.copy(v.n.kind === 'int' ? INHc : EXCc)
          .multiplyScalar(0.12 + 0.55 * ch * ch)
          .lerp(WHITE, fl * 0.85);
        v.mat.emissive.copy(em);
        if (fl > 0.02) glow.add(v.p.x, v.p.y, v.p.z, 1, 0.97, 0.85, 46 * fl, 0.9 * fl);
        else if (ch > 0.3)
          glow.add(
            v.p.x,
            v.p.y,
            v.p.z,
            v.n.kind === 'int' ? 1 : 0.6,
            v.n.kind === 'int' ? 0.5 : 0.75,
            1,
            18 * ch,
            0.35 * ch
          );
        if (v.bar) {
          v.bar.style.width = Math.round(ch * 100) + '%';
          v.lbl.el.classList.toggle('fire', fl > 0.2);
        }
      });
      // seçili nöron: gerilim izi
      if (st.sel != null) {
        const v = vis[st.sel];
        st.selLbl.pos.copy(v.p).add(V(0, 24, 0));
        const el = st.selLbl.el;
        el.querySelector('.nm').textContent =
          v.n.label || (v.n.kind === 'int' ? 'susturan nöron' : 'uyarıcı nöron');
        const mv = sim.v[v.i];
        el.querySelector('.mv').textContent =
          'zar gerilimi ' + B3.fmt(Math.min(mv, -50), 0) + ' mV · eşik −55';
        drawTrace(st.selCanvas, sim.trace[v.i], sim.tp);
      }
      // takip: kamera için hedef
      const F = st.following;
      st.override = null;
      if (F) {
        if (F.phase === 'ride') {
          const u = clamp((now - F.p.t0) / F.p.c.travel, 0, 1);
          F.p.c.curve.getPointAt(u, tmp);
          st.override = { target: tmp.clone(), dist: 85 };
        } else if (F.phase === 'arrive') {
          st.override = { target: vis[F.target].p.clone(), dist: 110 };
          if (ctx.clock() > F.until) {
            st.following = null;
            ctx.onFollowEnd && ctx.onFollowEnd();
          }
        }
      }
      glow.commit(info.pxScale);
    };
    function drawTrace(cv, tr, tp) {
      const x = cv.getContext('2d'),
        W = cv.width,
        H = cv.height,
        n = tr.length;
      x.clearRect(0, 0, W, H);
      const yOf = v => H - 4 - ((Math.min(v, -45) + 80) / 40) * (H - 8);
      x.strokeStyle = 'rgba(255,93,143,.75)';
      x.setLineDash([3, 3]);
      x.beginPath();
      x.moveTo(0, yOf(-55));
      x.lineTo(W, yOf(-55));
      x.stroke();
      x.setLineDash([]);
      x.strokeStyle = '#c8f3ff';
      x.lineWidth = 1.5;
      x.beginPath();
      for (let k = 0; k < n; k++) {
        const v = tr[(tp + 1 + k) % n];
        const px = (k / (n - 1)) * W;
        const py = v > 0 ? 2 : yOf(v);
        if (k) x.lineTo(px, py);
        else x.moveTo(px, py);
      }
      x.stroke();
    }
    st.card = function () {
      st.caption = st.mode === 'generic' ? activityCaption() : '';
      if (st.mode !== 'generic')
        return {
          title: { v1: 'Görme alanında nöronlar', it: 'Şakak lobunda nöronlar' }[st.mode],
          scale: '≈ 100 µm',
          body: 'Her nöron dendritleriyle (kısa dallar) sinyal toplar; toplam eşiği (−55 mV) geçince aksonu boyunca bir sinyal ateşler: ya hep ya hiç. <b style="color:var(--b3-exc)">Mavi</b> bağlantılar uyarır, <b style="color:var(--b3-inh)">pembe</b> olanlar susturur. Bir nörona tıkla, zar gerilimini izle.',
          action: { label: '👁 Sinyali takip et', fn: () => st.followNext() }
        };
      const lvl = ['az', 'normal', 'çok'],
        di = st.drive < 1 ? 0 : st.drive > 1 ? 2 : 1;
      return {
        title: 'Nöronlar ve bağlantıları',
        scale: '≈ 100 µm',
        body: '<b>Neye bakıyorsun?</b> Kabuğun bir köşesindeki birkaç düzine nöron. Her biri dendritleriyle (kısa dallar) sinyal toplar; toplam eşiği geçince aksonu boyunca bir sinyal ateşler. <b style="color:var(--b3-exc)">Mavi</b> bağlantılar uyarır, <b style="color:var(--b3-inh)">pembe</b> olanlar susturur. <b>Dene:</b> bir nöronu ateşlet ve sinyalinin kimlere gittiğini izle; susturan nöronları kapat; girdiyi değiştir. Bir nörona tıklarsan zar gerilimini görürsün.',
        caption: true,
        actions: [
          { label: '⚡ Bir nöronu ateşlet', fn: () => st.fireOne() },
          {
            label: st.inhOn ? '🔇 Susturanları kapat' : '🔈 Susturanları aç',
            fn: () => st.setInhibition(!st.inhOn)
          },
          {
            label: `Girdi: ${lvl[di]} → ${lvl[(di + 1) % 3]}`,
            fn: () => st.setDrive([1, 2.2, 0.3][di])
          },
          { label: '👁 Sinyali takip et', fn: () => st.followNext() }
        ]
      };
    };
    st.setMode('generic');
    return st;
  };
})();
