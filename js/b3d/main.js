/* Beyne yolculuk: sahne yığını, sürekli yakınlaştırma, kartlar ve “limonun yolculuğu”.
   Z sürekli bir yakınlık değeri: 0 bütün beyin … 5 sinaps. Her durak kendi sahnesi ve ölçeğiyle çizilir;
   duraklar arasında iki sahne üst üste karıştırılarak geçilir. */
(function () {
  'use strict';
  const B3 = window.B3,
    { smooth, clamp, lerp } = B3;
  const $ = s => document.querySelector(s);
  const BG = '#070918';
  const ZMIN = -0.12,
    ZMAX = 4.98;
  const STOPS = [0.06, 1.08, 2.1, 3.1, 4.14];

  const canvas = $('#gl'),
    layer = $('#labels');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch (e) {
    $('#loading').innerHTML = '<p>Bu tarayıcı 3B çizimi (WebGL) desteklemiyor.</p>';
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const t0 = performance.now();
  const ctx = { bg: BG, layer, clock: () => (performance.now() - t0) / 1000 };
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  const ray = new THREE.Raycaster();

  let stages = [],
    brain,
    region,
    column,
    micro,
    synapse;
  let Z = 0.06,
    Zt = 0.06,
    anim = null,
    paused = false,
    speed = 4,
    lastUser = 0,
    dragging = false;
  const st = { journey: null, arrive: null, cardLobe: null };

  /* ---------- birleştirme (iki sahne arası geçiş) ---------- */
  let rtA, rtB;
  const comp = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { a: { value: null }, b: { value: null }, k: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:
        'uniform sampler2D a,b;uniform float k;varying vec2 vUv;void main(){vec2 c=vUv-0.5;vec4 A=texture2D(a,0.5+c*(1.0-0.08*k));vec4 B=texture2D(b,0.5+c*(1.0+0.25*(1.0-k)));gl_FragColor=mix(A,B,k);}',
      depthTest: false,
      depthWrite: false
    })
  );
  const compScene = new THREE.Scene();
  compScene.add(comp);
  const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    const w = window.innerWidth,
      h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (w < 700) camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    else camera.clearViewOffset(); // dar ekranda sahne kartın üstünde kalsın
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    const opt = { samples: 4 };
    if (rtA) {
      rtA.dispose();
      rtB.dispose();
    }
    rtA = new THREE.WebGLRenderTarget(w * pr, h * pr, opt);
    rtB = new THREE.WebGLRenderTarget(w * pr, h * pr, opt);
  }
  window.addEventListener('resize', resize);

  /* ---------- kamera ---------- */
  const tmpV = new THREE.Vector3();
  function dirOf(s) {
    const cp = Math.cos(s.pitch);
    return new THREE.Vector3(cp * Math.sin(s.yaw), Math.sin(s.pitch), cp * Math.cos(s.yaw));
  }
  function placeCamera(s, t) {
    let d = s.far * Math.pow(s.near / s.far, t);
    if (camera.aspect < 1) d *= Math.min(2, 0.95 / camera.aspect); // dik ekranda sığsın
    const w = smooth(0.22, 0.93, t);
    const target = s.center.clone().lerp(s.focus, w);
    if (s.ovw == null) s.ovw = 0;
    if (s.override) {
      s.ovTarget = s.ovTarget || s.override.target.clone();
      s.ovTarget.lerp(s.override.target, 0.18);
      s.ovDist = s.override.dist;
    }
    if (s.ovw > 0.001 && s.ovTarget) {
      target.lerp(s.ovTarget, s.ovw);
      d = lerp(d, Math.min(d, s.ovDist), s.ovw);
    }
    const pos = target.clone().addScaledVector(dirOf(s), d);
    camera.position.copy(pos);
    camera.lookAt(target);
    camera.near = Math.max(0.01, d * 0.02);
    camera.far = d * 12 + s.far * 3;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    s.camDist = d;
  }
  function angTo(a, b, k) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * k;
  }

  /* ---------- etiketler ---------- */
  const pv = new THREE.Vector3();
  function projectLabels(s, weight, t) {
    const W = window.innerWidth,
      H = window.innerHeight;
    for (const l of s.labels) {
      if (!l.on || weight < 0.02 || (l.maxT != null && t > l.maxT)) {
        if (l.shown) {
          l.el.style.display = 'none';
          l.shown = false;
        }
        continue;
      }
      pv.copy(l.pos).project(camera);
      if (pv.z > 1 || pv.z < -1 || Math.abs(pv.x) > 1.2 || Math.abs(pv.y) > 1.2) {
        if (l.shown) {
          l.el.style.display = 'none';
          l.shown = false;
        }
        continue;
      }
      const x = ((pv.x + 1) / 2) * W,
        y = ((1 - pv.y) / 2) * H;
      if (!l.shown) {
        l.el.style.display = 'block';
        l.shown = true;
      }
      l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      l.el.style.opacity = (weight * (l.alpha == null ? 1 : l.alpha)).toFixed(3);
    }
  }
  function hideLabels(s) {
    for (const l of s.labels)
      if (l.shown) {
        l.el.style.display = 'none';
        l.shown = false;
      }
  }

  /* ---------- arayüz ---------- */
  const card = $('#card'),
    stripEl = $('#strip'),
    marker = $('#marker'),
    fovEl = $('#fov'),
    clockEl = $('#simclock');
  const NAMES = [
    ['Beyin', '15 cm'],
    ['Bölge', '1 cm'],
    ['Kolon', '1 mm'],
    ['Devre', '100 µm'],
    ['Sinaps', '1 µm']
  ];
  NAMES.forEach((n, i) => {
    const b = document.createElement('button');
    b.className = 'stop';
    b.innerHTML = `<b>${n[0]}</b><small>${n[1]}</small>`;
    b.style.left = (STOPS[i] / ZMAX) * 100 + '%';
    b.addEventListener('click', () => {
      stopFollow();
      zoomTo(STOPS[i]);
    });
    stripEl.appendChild(b);
  });
  const stopBtns = [...stripEl.querySelectorAll('.stop')];

  function zoomTo(z, dur, done) {
    anim = {
      from: Z,
      to: clamp(z, ZMIN, ZMAX),
      t0: ctx.clock(),
      dur: dur || Math.min(5, 0.9 + Math.abs(z - Z) * 0.9),
      done
    };
    Zt = anim.to;
  }
  function fmtLen(m) {
    if (m >= 0.01) return B3.fmt(m * 100, m >= 0.1 ? 0 : 1) + ' cm';
    if (m >= 0.001) return B3.fmt(m * 1000, 1) + ' mm';
    if (m >= 1e-6) return B3.fmt(m * 1e6, m >= 1e-4 ? 0 : 1) + ' µm';
    return B3.fmt(m * 1e9, 0) + ' nm';
  }
  let cardKey = '';
  function renderCard(force) {
    const a = activeStage();
    let key;
    if (st.journey) key = 'j' + st.journey.i + ':' + (st.journey.ready ? 1 : 0);
    else if (a === brain && st.cardLobe) key = 'lobe:' + st.cardLobe;
    else
      key = 's:' + a.id + ':' + (a.mode || '') + ':' + (a.type || '') + ':' + (st.arrive ? 1 : 0);
    if (key === cardKey && !force) return;
    cardKey = key;
    let html = '',
      acts = [];
    if (st.journey) {
      const J = st.journey,
        S = JSTEPS[J.i];
      html = `<div class="ct"><span class="chip">Limonun yolculuğu · ${J.i + 1}/${JSTEPS.length}</span><h2>${S.title}</h2></div><p>${S.text}</p>`;
      if (S.btn) acts.push({ label: S.btn, fn: () => jNext(), psug: J.ready, disabled: !J.ready });
      if (S.btn2) acts.push({ label: S.btn2[0], fn: S.btn2[1] });
      acts.push({ label: 'Yolculuktan çık', fn: () => jEnd(), ghost: true });
    } else if (a === brain && st.cardLobe) {
      const L = brain.LOBES[st.cardLobe];
      html = `<div class="ct"><span class="chip" style="--c:${L.color}">Lob</span><h2>${L.name}</h2></div><p>${L.text}</p>`;
      acts.push({ label: '🔬 Buraya yaklaş', fn: () => diveInto(st.cardLobe), psug: true });
      acts.push({
        label: 'Kapat',
        fn: () => {
          st.cardLobe = null;
          brain.select(null);
          renderCard();
        },
        ghost: true
      });
    } else {
      const c = a.card();
      html = `<div class="ct"><span class="chip">${c.scale}</span><h2>${c.title}</h2></div><p>${c.body}</p>${c.ai ? `<p class="ai"><b>Yapay zekâda:</b> ${c.ai}</p>` : ''}`;
      if (a === micro && st.arrive)
        acts.push({ label: '🔬 Bu sinapsa yaklaş', fn: () => intoSynapse(st.arrive), psug: true });
      if (c.action)
        acts.push(Object.assign({ psug: !(a === micro && st.arrive) && a !== brain }, c.action));
      if (c.action2) acts.push(Object.assign({ ghost: true }, c.action2));
      if (a === brain) acts.push({ label: '🍋 Limonun yolculuğu', fn: () => jStart(), psug: true });
    }
    card.innerHTML = html + '<div class="acts"></div>';
    const box = card.querySelector('.acts');
    acts.forEach(x => {
      const b = document.createElement('button');
      b.className = 'btn' + (x.psug ? ' primary psug' : x.ghost ? ' ghost' : '');
      b.textContent = x.label;
      if (x.disabled) b.disabled = true;
      b.addEventListener('click', x.fn);
      box.appendChild(b);
    });
  }
  function activeStage() {
    let best = stages[0],
      bw = -1;
    for (const s of stages)
      if (s._w > bw) {
        bw = s._w;
        best = s;
      }
    return best;
  }

  /* duraklat ve hız */
  const pauseBtn = $('#pause'),
    speedIn = $('#speed'),
    speedOut = $('#speedOut');
  const SPEEDS = [1, 2, 4, 8, 16];
  function setPaused(p) {
    paused = p;
    pauseBtn.textContent = p ? '▶ Devam' : '⏸ Duraklat';
    pauseBtn.setAttribute('aria-pressed', p);
  }
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  function setSpeed() {
    speed = SPEEDS[+speedIn.value];
    speedOut.textContent = 'gerçeğin 1/' + B3.fmt(1000 / speed, 0) + '’i';
  }
  speedIn.addEventListener('input', setSpeed);
  const xrayBtn = $('#xray');
  xrayBtn.addEventListener('click', () => {
    brain.setXray(!brain.xray);
    xrayBtn.setAttribute('aria-pressed', brain.xray);
  });

  /* ---------- girdi: sürükle, kaydır, iki parmak ---------- */
  const ptrs = new Map();
  let pinch0 = 0,
    downAt = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    dragging = true;
    lastUser = ctx.clock();
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) {
      hover(e);
      return;
    }
    if (ptrs.size === 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) {
        Zt = clamp(Zt + Math.log(d / pinch0) * 0.9, ZMIN, ZMAX);
        anim = null;
      }
      pinch0 = d;
      return;
    }
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const s = activeStage();
    s.yaw -= dx * 0.006;
    s.pitch = clamp(s.pitch + dy * 0.005, -1.35, 1.35);
    lastUser = ctx.clock();
  });
  function endPtr(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch0 = 0;
    if (ptrs.size === 0) {
      dragging = false;
      if (
        downAt &&
        Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 &&
        performance.now() - downAt.t < 500
      )
        click(e);
      downAt = null;
    }
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 0.05 : e.deltaMode === 2 ? 1 : 0.0016;
      Zt = clamp(Zt - e.deltaY * k, ZMIN, ZMAX);
      anim = null;
      lastUser = ctx.clock();
    },
    { passive: false }
  );
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea')) return;
    if (e.key === '+' || e.key === '=') {
      Zt = clamp(Zt + 0.25, ZMIN, ZMAX);
      anim = null;
    } else if (e.key === '-' || e.key === '_') {
      Zt = clamp(Zt - 0.25, ZMIN, ZMAX);
      anim = null;
    } else if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      setPaused(!paused);
    } else if (e.key === 'ArrowLeft') {
      activeStage().yaw += 0.12;
    } else if (e.key === 'ArrowRight') {
      activeStage().yaw -= 0.12;
    } else return;
    lastUser = ctx.clock();
  });
  function setRay(e) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(
      { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: (-(e.clientY - r.top) / r.height) * 2 + 1 },
      camera
    );
  }
  function hover(e) {
    const a = activeStage();
    if (a === brain && Z < 0.45 && !brain.xray) {
      placeCamera(brain, Z);
      setRay(e);
      const L = brain.hover(ray);
      canvas.style.cursor = L ? 'pointer' : 'grab';
    } else if (a === micro) {
      placeCamera(micro, Z - 3);
      setRay(e);
      canvas.style.cursor = micro.pick(ray) != null ? 'pointer' : 'grab';
    } else canvas.style.cursor = 'grab';
  }
  function click(e) {
    const a = activeStage();
    if (a === brain && Z < 0.45 && !brain.xray && !st.journey) {
      placeCamera(brain, Z);
      setRay(e);
      const L = brain.hover(ray);
      st.cardLobe = L;
      brain.select(L);
      renderCard();
    } else if (a === micro) {
      placeCamera(micro, Z - 3);
      setRay(e);
      const vi = micro.pick(ray);
      micro.select(vi);
    }
  }

  /* ---------- akışlar ---------- */
  function lobeName(k) {
    return brain.LOBES[k] ? brain.LOBES[k].name : '';
  }
  ctx.lobeName = lobeName;
  function diveInto(lobe, mode) {
    brain.setFocus(lobe);
    region.setLobe(lobe);
    if (mode) micro.setMode(mode);
    const f = brain.focusDir;
    brain._alignTo = { yaw: Math.atan2(f.x, f.z), pitch: Math.asin(clamp(f.y, -1, 1)) };
    st.cardLobe = null;
    brain.select(null);
    zoomTo(STOPS[1], 2.6);
  }
  function stopFollow() {
    micro.stopFollow();
    st.arrive = null;
  }
  ctx.onArrive = function (c, from, to) {
    st.arrive = c;
    renderCard(true);
  };
  ctx.onFollowEnd = function () {
    setTimeout(() => {
      if (!micro.following) {
        st.arrive = null;
        renderCard(true);
      }
    }, 4000);
  };
  function intoSynapse(c) {
    synapse.setType(c && c.w < 0 ? 'inh' : 'exc');
    micro.focus.copy(c.tgt);
    micro.stopFollow();
    zoomTo(STOPS[4], 2.4, () => synapse.release());
    st.arrive = null;
  }

  /* ---------- limonun yolculuğu ---------- */
  const JZ = -0.1;
  const C_VIS = [1, 0.95, 0.55],
    C_VEN = [0.6, 1, 0.7],
    C_SM = [1, 0.8, 0.4],
    C_SP = [0.75, 0.8, 1];
  const JSTEPS = [
    {
      title: 'Bir limona bak',
      text: 'Beyni yarı saydam yaptık; önde iki göz var. Bir limonu gözlerin önüne koyalım ve ışığın beyinde nereye gittiğini izleyelim.',
      btn: '🍋 Limona bak',
      enter() {
        brain.setJourney(true);
        brain.setXray(true);
        brain.lemon.visible = true;
        brain._alignTo = { yaw: -1.22, pitch: 0.16 };
        micro.setMode('generic');
        zoomTo(JZ, 1.8);
        ready(true);
      }
    },
    {
      title: 'Gözden talamusa',
      text: 'Işık, retinadaki hücreleri uyarır. Sinyal görme siniriyle ilerler; iki sinirin buluştuğu yerde yarısı karşı tarafa geçer ve beynin ortasındaki talamusa (LGN) ulaşır. Buraya kadar ≈ 30 ms.',
      btn: 'Görme alanına gönder',
      enter() {
        brain.send('vis1L', 1.5, C_VIS);
        brain.send('vis1R', 1.5, C_VIS);
        brain.spot('eye', brain.P.eyeL, C_VIS, 1.4, 'eye');
        setTimeout(() => {
          brain.spot('lgnL', brain.P.lgnL, C_VIS, 1e9, 'lgn');
          brain.spot('lgnR', brain.P.lgnR, C_VIS, 1e9);
        }, 1500);
        ready(false, 2.0);
      }
    },
    {
      title: 'Görme alanı',
      text: 'Talamus sinyali ensedeki birincil görme alanına (V1) iletir. ≈ 50 ms. Şimdi oraya, nöronların arasına inelim.',
      btn: '🔬 Görme alanına yaklaş',
      enter() {
        brain.send('vis2L', 1.3, C_VIS);
        brain.send('vis2R', 1.3, C_VIS);
        setTimeout(() => {
          brain.spot('v1L', brain.P.v1L, C_VIS, 1e9, 'v1');
          brain.spot('v1R', brain.P.v1R, C_VIS, 1e9);
        }, 1300);
        ready(false, 1.6);
      }
    },
    {
      title: 'V1: kenarlar ve renk',
      text: 'Burada her nöron gözün gördüğü küçük bir parçaya bakar ve belli bir şekle tepki verir (9. seviyedeki yavru kedinin gözü gibi). Limonun kıvrık kenarı ve sarı rengi için <b>eğri kenar</b> ve <b>sarı leke</b> nöronları ateşler; yatay ve dikey kenar nöronları sessiz kalır. Etiketlerdeki çubuk, nöronun eşiğe ne kadar yakın olduğunu gösterir.',
      btn: 'Sonra? Şakak lobuna',
      enter() {
        brain.setXray(false);
        fastSim();
        micro.setMode('v1');
        micro.setStim('lemon');
        micro.resetCounts();
        diveInto('occipital', 'v1');
        zoomTo(STOPS[3] - 0.08, 4.2);
        ready(false, 0, () => micro.count('curve') >= 2 && micro.count('yellow') >= 1);
      }
    },
    {
      title: '“Ne” yolu: şakak lobuna',
      text: 'Kenar ve renk bilgisi beynin alt yüzünden şakak lobuna akar. Burnundan gelen ekşi koku da buraya katılır: 10. seviyede yaptığımız gibi duyular tek bir kavramda birleşir. ≈ 150 ms.',
      btn: '🔬 Şakak lobuna yaklaş',
      enter() {
        micro.setStim(null);
        zoomTo(JZ, 3.2, () => {
          brain.setXray(true);
          brain._alignTo = { yaw: -1.3, pitch: 0.02 };
          brain.send('venL', 1.6, C_VEN);
          brain.send('venR', 1.6, C_VEN);
          brain.send('smell', 2.0, C_SM, 4);
          brain.spot('nose', brain.P.bulb, C_SM, 2.2, 'smell');
          setTimeout(() => brain.spot('itL', brain.P.itL, C_VEN, 1e9, 'it'), 1700);
          ready(false, 2.2);
        });
        ready(false, 99);
      }
    },
    {
      title: 'Kavram nöronu: LİMON',
      text: 'Şakak lobunda özellik nöronları (sarı renk, oval biçim, pürüzlü kabuk, ekşi koku) kavram nöronlarına bağlanır. Hepsini birden alan <b>LİMON</b> nöronu eşiği geçer; susturan nöron rakipleri bastırır. Portakal da oval ve pürüzlüdür, biraz kıpırdar ama kazanamaz. İnsanda tek bir kavrama seçici tepki veren nöronlar gerçekten bulundu (Quiroga, 2005).',
      btn: 'Ve cevap…',
      enter() {
        brain.setXray(false);
        fastSim();
        micro.setMode('it');
        micro.setStim('lemon');
        micro.resetCounts();
        diveInto('temporal', 'it');
        zoomTo(STOPS[3] - 0.08, 4.2);
        ready(false, 0, () => micro.count('lemon') >= 3);
      }
    },
    {
      title: '“Limon!”',
      text: 'Kavram, sol alın lobundaki konuşma alanına (Broca) gider; orada kelimenin sesleri sıraya konur. Hemen arkadaki hareket kabuğu dil, dudak ve gırtlak kaslarına komut gönderir. Bir resme bakıp adını söylemek toplam ≈ 0,6 saniye sürer.',
      btn: 'Özeti gör',
      enter() {
        micro.setStim(null);
        zoomTo(JZ, 3.2, () => {
          brain.setXray(true);
          brain._alignTo = { yaw: -1.25, pitch: 0.12 };
          brain.send('speech', 1.2, C_SP, 4);
          setTimeout(() => {
            brain.spot('broca', brain.P.broca, C_SP, 1e9, 'broca');
            brain.send('motor', 0.9, C_SP, 4);
          }, 1200);
          setTimeout(() => {
            brain.spot('motor', brain.P.motor, C_SP, 1e9, 'motor');
            brain.send('out', 1.6, C_SP, 5);
          }, 2200);
          setTimeout(() => {
            brain.sayLbl.on = true;
            ready(true);
          }, 3900);
        });
        ready(false, 99);
      }
    },
    {
      title: 'Ne oldu?',
      text: '<span class="chain">göz → talamus → görme alanı <small>(kenar, renk)</small> → şakak lobu <small>(kavram: LİMON)</small> → Broca → hareket kabuğu → “Limon!”</span>Her okun arkasında aynı şey var: nöronlar girdilerini topluyor, eşiği geçen ateşliyor, sinaps sinyali bir sonrakine taşıyor. Önceki seviyelerde tek tek kurduğun parçalar, burada bir beynin içinde birlikte çalıştı.',
      btn: '↺ Baştan',
      btn2: ['Serbest gez', () => jEnd()],
      enter() {
        ready(true);
      }
    }
  ];
  function fastSim() {
    if (+speedIn.value < 3) {
      speedIn.value = 3;
      setSpeed();
    }
  }
  function ready(on, after, cond) {
    const J = st.journey;
    if (!J) return;
    J.ready = !!on;
    J.cond = cond || null;
    if (after && after < 90) {
      const i = J.i;
      setTimeout(() => {
        if (st.journey && st.journey.i === i) {
          st.journey.ready = true;
          renderCard(true);
        }
      }, after * 1000);
    }
    renderCard(true);
  }
  function jStart() {
    stopFollow();
    st.cardLobe = null;
    brain.select(null);
    st.journey = { i: 0, ready: false };
    JSTEPS[0].enter();
    renderCard(true);
  }
  function jNext() {
    const J = st.journey;
    if (!J) return;
    if (J.i === JSTEPS.length - 1) {
      jEnd(true);
      jStart();
      return;
    }
    J.i++;
    J.ready = false;
    JSTEPS[J.i].enter();
    renderCard(true);
  }
  function jEnd(keep) {
    st.journey = null;
    brain.setJourney(false);
    brain.setXray(false);
    micro.setStim(null);
    if (!keep) {
      micro.setMode('generic');
      zoomTo(STOPS[0]);
    }
    renderCard(true);
  }

  /* ---------- döngü ---------- */
  let last = performance.now(),
    frames = 0,
    fpsT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (anim) {
      const u = clamp((ctx.clock() - anim.t0) / anim.dur, 0, 1);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      Z = lerp(anim.from, anim.to, e);
      if (u >= 1) {
        const d = anim.done;
        anim = null;
        Z = Zt;
        if (d) d();
      }
    } else Z += (Zt - Z) * Math.min(1, dt * 7);
    const pr = renderer.getPixelRatio(),
      H = window.innerHeight;
    const pxScale = (H * pr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const info = { paused, speed, pxScale };
    const vis = [];
    stages.forEach((s, i) => {
      const t = Z - i;
      const wIn = i === 0 ? 1 : smooth(-0.12, 0, t),
        wOut = i === stages.length - 1 ? 1 : 1 - smooth(0.88, 1, t);
      s._w = Math.max(0, Math.min(wIn, wOut));
      if (t < -0.12 || (i < stages.length - 1 && t > 1)) {
        s._w = 0;
      }
      // kendiliğinden hizalanma: dalarken hedefe doğru dön
      if (!dragging) {
        const w = smooth(0.25, 0.85, t);
        if ((s.focusDir && w > 0 && s !== brain) || (s === brain && w > 0)) {
          const f = s.focusDir;
          s.yaw = angTo(s.yaw, Math.atan2(f.x, f.z), Math.min(1, dt * 1.6 * w));
          s.pitch = lerp(s.pitch, Math.asin(clamp(f.y, -1, 1)), Math.min(1, dt * 1.6 * w));
        }
        if (s._alignTo) {
          s.yaw = angTo(s.yaw, s._alignTo.yaw, Math.min(1, dt * 2.2));
          s.pitch = lerp(s.pitch, s._alignTo.pitch, Math.min(1, dt * 2.2));
          if (
            Math.abs(s.pitch - s._alignTo.pitch) < 0.01 &&
            Math.abs(angTo(s.yaw, s._alignTo.yaw, 1) - s.yaw) < 0.01
          )
            s._alignTo = null;
        }
      }
      s.ovw = lerp(s.ovw || 0, s.override ? 1 : 0, Math.min(1, dt * 2.5));
      if (s._w > 0.001 || (s === micro && micro.following)) s.update(dt, info);
      if (s._w > 0.001) vis.push({ s, t, w: s._w });
      else hideLabels(s);
    });
    if (!st.journey && Z < 0.4 && ctx.clock() - lastUser > 7 && !st.cardLobe)
      brain.yaw += dt * 0.07;
    // çiz
    if (vis.length === 1) {
      const v = vis[0];
      placeCamera(v.s, v.t);
      renderer.setRenderTarget(null);
      renderer.render(v.s.scene, camera);
      projectLabels(v.s, 1, v.t);
    } else if (vis.length >= 2) {
      const a = vis[0],
        b = vis[1];
      placeCamera(a.s, a.t);
      renderer.setRenderTarget(rtA);
      renderer.render(a.s.scene, camera);
      projectLabels(a.s, a.w * a.w, a.t);
      placeCamera(b.s, b.t);
      renderer.setRenderTarget(rtB);
      renderer.render(b.s.scene, camera);
      projectLabels(b.s, b.w * b.w, b.t);
      renderer.setRenderTarget(null);
      comp.material.uniforms.a.value = rtA.texture;
      comp.material.uniforms.b.value = rtB.texture;
      comp.material.uniforms.k.value = b.w / (a.w + b.w);
      renderer.render(compScene, compCam);
    }
    // gösterge
    const A = activeStage();
    marker.style.left = (clamp(Z, 0, ZMAX) / ZMAX) * 100 + '%';
    stopBtns.forEach((b, i) => b.classList.toggle('on', stages[i] === A));
    const width = 2 * (A.camDist || A.far) * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    fovEl.textContent = 'görüş genişliği ≈ ' + fmtLen(width * A.unit);
    const showClock = A === micro || A === synapse;
    clockEl.hidden = !showClock;
    if (A === micro) clockEl.textContent = 'devre saati ' + B3.fmt(micro.simTime(), 1) + ' ms';
    else if (A === synapse) clockEl.textContent = '≈ 2.000 kat yavaş';
    xrayBtn.hidden = !(A === brain);
    document.body.classList.toggle('slowctl', showClock);
    if (st.journey && !st.journey.ready && st.journey.cond && st.journey.cond()) {
      st.journey.ready = true;
      renderCard(true);
    }
    renderCard();
  }

  /* ---------- kurulum ---------- */
  function build() {
    const steps = [
      [
        'Beyin kıvrımları oluşturuluyor…',
        () => {
          brain = B3.makeBrainStage(ctx);
        }
      ],
      [
        'Kabuk kesiti hazırlanıyor…',
        () => {
          region = B3.makeRegionStage(ctx);
        }
      ],
      [
        'Katmanlar ve nöronlar yerleştiriliyor…',
        () => {
          column = B3.makeColumnStage(ctx);
        }
      ],
      [
        'Devre kuruluyor…',
        () => {
          micro = B3.makeMicroStage(ctx);
        }
      ],
      [
        'Sinaps hazırlanıyor…',
        () => {
          synapse = B3.makeSynapseStage(ctx);
        }
      ]
    ];
    const msg = $('#loadmsg');
    let k = 0;
    (function next() {
      if (k < steps.length) {
        msg.textContent = steps[k][0];
        setTimeout(() => {
          try {
            steps[k][1]();
          } catch (err) {
            msg.textContent = 'Hata: ' + err.message;
            console.error(err);
            return;
          }
          k++;
          next();
        }, 30);
        return;
      }
      stages = [brain, region, column, micro, synapse];
      region.setLobe('occipital');
      resize();
      setSpeed();
      const startZ = parseFloat(new URLSearchParams(location.search).get('z'));
      if (!isNaN(startZ)) {
        Z = Zt = clamp(startZ, ZMIN, ZMAX);
      }
      $('#loading').hidden = true;
      document.body.classList.add('ready');
      requestAnimationFrame(frame);
      if (new URLSearchParams(location.search).get('yolculuk') != null) jStart();
      window.B3dbg = {
        get Z() {
          return Z;
        },
        zoomTo,
        stages: () => stages,
        jStart,
        jNext,
        micro: () => micro,
        synapse: () => synapse,
        brain: () => brain,
        state: st,
        setPaused
      };
    })();
  }
  build();
})();
