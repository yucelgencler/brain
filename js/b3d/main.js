/* Beyne yolculuk: sahne yığını, sürekli yakınlaştırma, kartlar ve “gözden kelimeye” yolculuğu (limon, çilek ya da dondurma).
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
  // Sahnelerin saati: Duraklat’a basınca durur (darbeler, dalgalar, film birlikte donar)
  let clockT = 0;
  const ctx = { bg: BG, layer, clock: () => clockT };
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
  const st = { journey: null, arrive: null, cardLobe: null, tried: {} };

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
    ['Katlar', '1 mm'],
    ['Nöronlar', '100 µm'],
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
  // Ölçek şeridindeki bir durağa git (takibi bırakır)
  function goStop(i) {
    stopFollow();
    zoomTo(STOPS[i]);
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
    if (st.journey) key = 'j' + st.journey.phase + ':' + st.journey.scene + ':' + (paused ? 1 : 0);
    else if (a === brain && st.cardLobe) key = 'lobe:' + st.cardLobe;
    else
      key =
        's:' +
        a.id +
        ':' +
        (a.mode || '') +
        ':' +
        (a.type || '') +
        ':' +
        (st.arrive ? 1 : 0) +
        ':' +
        (a._tried ? 1 : 0) +
        ':' +
        (a.cardRev || 0);
    if (key === cardKey && !force) return;
    cardKey = key;
    let html = '',
      acts = [],
      nav = [];
    if (st.journey) {
      const J = st.journey,
        O = JO();
      if (J.phase === 'choose') {
        html = `<div class="ct"><span class="chip">Gözden kelimeye</span><h2>Neye bakalım?</h2></div><p>Gözlerinin önüne bir şey koyacağız. Kamera ışığı göze girdiği andan itibaren takip edecek: sinirden talamusa, görme alanındaki nöronlara, şakak lobundaki kavrama ve ağzından çıkan kelimeye kadar. Sonra başka bir şeyle tekrarlayıp farkı görebilirsin.</p>`;
        Object.keys(JOBJ).forEach((k, n) =>
          acts.push({
            label: `${JOBJ[k].icon} ${cap(JOBJ[k].dat)} bak${st.tried[k] ? ' ✓' : ''}`,
            fn: () => jChoose(k),
            psug: !Object.keys(st.tried).length
              ? n === 0
              : !st.tried[k] && Object.keys(JOBJ).find(x => !st.tried[x]) === k
          })
        );
      } else if (J.phase === 'film') {
        const S = FILM[J.scene];
        html = `<div class="ct"><span class="chip">${O.icon} Gözden kelimeye · ${J.scene + 1}/${FILM.length}</span><h2>${S.title(O)}</h2></div>
          <div class="jbar" aria-hidden="true">${FILM.map((x, k) => `<i class="${k < J.scene ? 'done' : k === J.scene ? 'now' : ''}"></i>`).join('')}</div>
          <p>${S.cap(O)}</p><p class="cap" id="jLive" aria-live="polite"></p>
          <p class="jms">⏱ Gerçekte buraya kadar ≈ ${S.ms} ms${S.ms ? '' : ' (ışık bir anda gelir)'} · burada çok yavaşlatıldı</p>`;
        acts.push({
          label: paused ? '▶ Devam' : '⏸ Duraklat',
          fn: () => (setPaused(!paused), renderCard(true))
        });
        acts.push({ label: '⏭ Sonraki sahne', fn: () => jSkip(), ghost: true });
      } else {
        html = `<div class="ct"><span class="chip">${O.icon} Gözden kelimeye</span><h2>Ne oldu?</h2></div><p>${summaryHTML(O)}</p>`;
        acts.push({ label: '🔁 Başka bir şeye bak', fn: () => jStart(), psug: true });
        acts.push({ label: 'Serbest gez', fn: () => jEnd() });
      }
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
      const c = a.card(),
        i = stages.indexOf(a);
      html = `<div class="ct"><span class="chip">${c.scale}</span><h2>${c.title}</h2></div><p>${c.body}</p>${c.caption ? '<p class="cap" id="stageCap" aria-live="polite"></p>' : ''}`;
      // önce durağın kendi denemesi parlar; bir kez denenince “Daha yakına”
      const tried = a._tried || !(c.action || c.actions);
      if (a === micro && st.arrive)
        acts.push({ label: '🔬 Bu sinapsa yaklaş', fn: () => intoSynapse(st.arrive), psug: true });
      else
        (c.actions || (c.action ? [c.action] : [])).forEach((x, k) =>
          acts.push(
            Object.assign({}, x, {
              psug: !tried && k === 0,
              fn: () => {
                x.fn();
                a._tried = true;
                renderCard(true);
              }
            })
          )
        );
      if (c.action2) acts.push(Object.assign({ ghost: true }, c.action2));
      if (a === brain) acts.push({ label: '🍋🍓🍦 Gözden kelimeye yolculuk', fn: () => jStart() });
      // gezinme: geri ve daha yakına
      const prev = stages[i - 1],
        next = stages[i + 1];
      if (prev)
        nav.push({ label: `← Geri: ${NAMES[i - 1][0]}`, fn: () => goStop(i - 1), ghost: true });
      if (next)
        nav.push({
          label:
            a === brain
              ? `🔬 İçeri gir: ${lobeName(brain.focusLobe || 'occipital').toLocaleLowerCase('tr-TR')}`
              : `🔬 Daha yakına: ${NAMES[i + 1][0]} (${NAMES[i + 1][1]})`,
          fn: () => (a === brain ? diveInto(brain.focusLobe || 'occipital') : goStop(i + 1)),
          psug: tried && !(a === micro && st.arrive),
          next: true
        });
    }
    card.innerHTML =
      html + '<div class="acts"></div>' + (nav.length ? '<div class="acts navrow"></div>' : '');
    const box = card.querySelector('.acts');
    const navBox = card.querySelector('.navrow');
    nav.forEach(x => {
      const b = document.createElement('button');
      b.className = 'btn' + (x.psug ? ' primary psug' : x.next ? ' primary' : ' ghost');
      b.textContent = x.label;
      b.addEventListener('click', x.fn);
      navBox.appendChild(b);
    });
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

  /* ---------- gözden kelimeye yolculuk (limon, çilek ya da dondurma) ---------- */
  const JZ = -0.1;
  const C_VIS = [1, 0.95, 0.55],
    C_VEN = [0.6, 1, 0.7],
    C_SM = [1, 0.8, 0.4],
    C_SP = [0.75, 0.8, 1];
  // Yolculukta bakılabilecek nesneler (devre tarifleri B3.sim.OBJECTS ile aynı anahtarlar)
  const JOBJ = {
    lemon: {
      icon: '🍋',
      name: 'limon',
      dat: 'limona',
      abl: 'limondan',
      word: 'LİMON',
      say: '“Limon!”',
      v1: ['curve', 'yellow'],
      v1txt: 'kıvrık kenarı ve sarı rengi için <b>eğri kenar</b> ve <b>sarı</b> nöronları',
      smell: 'ekşi kokusu',
      feats: 'sarı, oval, ekşi koku',
      rival: 'Hiçbir rakip bu üç özelliği birden taşımıyor; öbür kavram nöronları sessiz kalır.',
      smellCol: [1, 0.95, 0.4]
    },
    straw: {
      icon: '🍓',
      name: 'çilek',
      dat: 'çileğe',
      abl: 'çilekten',
      word: 'ÇİLEK',
      say: '“Çilek!”',
      v1: ['curve', 'tip', 'red', 'dots'],
      v1txt:
        'kıvrık kenarı, sivri ucu, kırmızı rengi ve benekli yüzeyi için <b>eğri kenar</b>, <b>sivri uç</b>, <b>kırmızı</b> ve <b>benekli doku</b> nöronları',
      smell: 'tatlı kokusu',
      feats: 'kırmızı, benekli, tatlı koku',
      rival:
        'Dondurma da tatlı kokar: DONDURMA nöronu biraz destek alır ama kazanamaz, susturan onu bastırır.',
      smellCol: [1, 0.55, 0.7]
    },
    icecream: {
      icon: '🍦',
      name: 'dondurma',
      dat: 'dondurmaya',
      abl: 'dondurmadan',
      word: 'DONDURMA',
      say: '“Dondurma!”',
      v1: ['curve', 'tip', 'light'],
      v1txt:
        'yuvarlak topu, sivri külahı ve açık rengi için <b>eğri kenar</b>, <b>sivri uç</b> ve <b>açık renk</b> nöronları',
      smell: 'vanilyalı tatlı kokusu',
      feats: 'krem rengi, külah, tatlı koku',
      rival:
        'Çilek de tatlı kokar: ÇİLEK nöronu biraz destek alır ama kazanamaz, susturan onu bastırır.',
      smellCol: [1, 0.92, 0.75]
    }
  };
  const V1NAMES = {
    curve: 'eğri kenar',
    tip: 'sivri uç',
    yellow: 'sarı',
    red: 'kırmızı',
    light: 'açık renk',
    dots: 'benekli doku'
  };
  const JO = () => JOBJ[(st.journey && st.journey.obj) || 'lemon'];
  const cap = t => t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1);
  // Yolculuğun sonundaki karşılaştırma
  function summaryHTML(O) {
    const rows = Object.keys(JOBJ)
      .filter(k => st.tried[k])
      .map(
        k =>
          `<tr><td>${JOBJ[k].icon} ${cap(JOBJ[k].name)}</td><td>${(st.tried[k].v1 || []).join(', ') || '–'}</td><td><b>${st.tried[k].word || '–'}</b></td></tr>`
      )
      .join('');
    const left = Object.keys(JOBJ).filter(k => !st.tried[k]);
    return `<span class="chain">${O.icon} ışık → göz → talamus → görme alanı <small>(özellikler)</small> → şakak lobu <small>(kavram: ${O.word})</small> → Broca → hareket kabuğu → ${O.say}</span>
      <table class="jcmp"><thead><tr><th>baktığın</th><th>görme alanında ateşleyenler</th><th>kazanan kavram</th></tr></thead><tbody>${rows}</tbody></table>
      ${left.length ? `Yol hep aynı ama her nesnede farklı nöronlar ateşliyor. Bir de ${left.map(k => JOBJ[k].dat).join(' ya da ')} bakıp karşılaştır.` : 'Yol her seferinde aynıydı; değişen, hangi nöronların ateşlediğiydi. Beyin bir şeyi, onun özelliklerine tepki veren nöronların birlikte yanma deseniyle tanır.'}`;
  }

  /* --- film: kamera girdiyi, sinyali, etkiyi ve sonucu kesintisiz takip eder --- */
  let waiters = [],
    chaseS = null;
  // Duraklatılabilir saate göre bekle; sahne atlanınca hemen geçer, yolculuk bitince iptal olur
  function fWait(tok, sec, cond) {
    return new Promise((res, rej) => waiters.push({ t: ctx.clock() + sec, cond, res, rej, tok }));
  }
  function tickWaiters() {
    waiters = waiters.filter(w => {
      if (w.tok.dead) {
        w.rej('dead');
        return false;
      }
      if (w.tok.skip || ctx.clock() >= w.t || (w.cond && w.cond())) {
        w.res();
        return false;
      }
      return true;
    });
  }
  // Kamera bir yolu, üzerindeki öncü darbenin hemen arkasından izler
  function chase(tok, key, sec, dist, col) {
    brain.send(key, sec, col || C_VIS, 3, 0.18);
    chaseS = { c: brain.curves[key], t0: ctx.clock(), dur: sec, dist };
    brain._alignTo = null;
    return fWait(tok, sec);
  }
  function release() {
    chaseS = null;
    brain.override = null;
  }
  // Kamerayı bir noktanın yakınında tut (lobun yüzeyine dalarken ve oradan çıkarken)
  function holdAt(p) {
    chaseS = null;
    brain.override = { target: p.clone(), dist: 3.8 };
  }
  function updateChase(dt) {
    if (!chaseS) return;
    const u = clamp((ctx.clock() - chaseS.t0) / chaseS.dur, 0, 1),
      p = chaseS.c.getPointAt(u),
      tg = chaseS.c.getTangentAt(u);
    // sinyalin arkasından ve biraz yukarısından bak
    const dir = tg
      .clone()
      .negate()
      .add(new THREE.Vector3(0, 0.95, 0))
      .normalize();
    brain.yaw = angTo(brain.yaw, Math.atan2(dir.x, dir.z), Math.min(1, dt * 3));
    brain.pitch = lerp(brain.pitch, Math.asin(clamp(dir.y, -1, 1)), Math.min(1, dt * 3));
    brain.override = { target: p, dist: chaseS.dist };
  }
  const C_LIGHT = [1, 0.97, 0.7];
  const FILM = [
    {
      title: O => `${cap(O.dat)} bakıyorsun`,
      cap: O =>
        `Gözlerinin önünde bir ${O.name} var. Beyni yarı saydam yaptık. Şimdi ışığın ve sinyalin izini kamerayla adım adım takip edeceğiz.`,
      ms: 0,
      async run(t, O) {
        brain._alignTo = { yaw: -1.05, pitch: 0.16 };
        zoomTo(JZ, 1.6);
        await fWait(t, 3);
      }
    },
    {
      title: () => 'Işık gözüne giriyor',
      cap: O =>
        `${cap(O.abl)} yansıyan ışık gözüne giriyor. Gözün arkasındaki retinada ışığa duyarlı hücreler onu elektrik sinyaline çeviriyor.`,
      ms: 0,
      async run(t) {
        // ışığı yandan izle: nesneden göze
        brain._alignTo = { yaw: -1.4, pitch: 0.12 };
        holdAt(new THREE.Vector3(0, -1.8, 12.4));
        brain.override.dist = 9;
        brain.send('lightL', 2.4, C_LIGHT, 3, 0.2);
        brain.send('lightR', 2.4, C_LIGHT, 3, 0.2);
        await fWait(t, 2.4);
        brain.spot('eye', brain.P.eyeR, C_LIGHT, 1.6, 'eye');
        await fWait(t, 0.6);
      }
    },
    {
      title: () => 'Görme sinirinde',
      cap: () =>
        'Sinyal görme siniri boyunca beynin içine ilerliyor. İki sinirin buluştuğu yerde (çaprazlaşma) yarısı karşı tarafa geçiyor ve beynin ortasındaki talamusa varıyor.',
      ms: 30,
      async run(t) {
        brain.send('vis1L', 3.6, C_VIS);
        await chase(t, 'vis1R', 3.6, 4.5);
        brain.spot('lgnL', brain.P.lgnL, C_VIS, 1e9, 'lgn');
        brain.spot('lgnR', brain.P.lgnR, C_VIS, 1e9);
      }
    },
    {
      title: () => 'Talamustan görme alanına',
      cap: () =>
        'Talamus sinyali beynin arkasına, ense lobundaki birincil görme alanına (V1) iletiyor.',
      ms: 50,
      async run(t) {
        brain.send('vis2R', 3.0, C_VIS);
        await chase(t, 'vis2L', 3.0, 4.5);
        brain.spot('v1L', brain.P.v1L, C_VIS, 1e9, 'v1');
        brain.spot('v1R', brain.P.v1R, C_VIS, 1e9);
      }
    },
    {
      title: () => 'Nöronların arasına',
      cap: () => 'Görme alanının kabuğuna, sinyali karşılayan nöronların arasına iniyoruz.',
      ms: 55,
      async run(t, O) {
        fastSim();
        micro.setMode('v1');
        micro.setStim(st.journey.obj);
        micro.resetCounts();
        diveInto('occipital', 'v1');
        holdAt(brain.focus);
        zoomTo(STOPS[3] - 0.08, 3.6);
        await fWait(t, 3.8);
      }
    },
    {
      title: () => 'Görme alanı: özellikler',
      cap: O =>
        `Burada her nöron gözün gördüğü küçük bir parçaya bakıp belli bir özelliğe tepki veriyor. ${cap(O.name)} için ${O.v1txt} ateşliyor; ötekiler sessiz kalıyor.`,
      ms: 80,
      live: O =>
        'Ateşleyenler: ' +
        (Object.keys(V1NAMES)
          .filter(id => micro.count(id) >= 1)
          .map(id => `${V1NAMES[id]} (${micro.count(id)})`)
          .join(', ') || 'bekleniyor…'),
      async run(t, O) {
        await fWait(t, 9, () => O.v1.every(id => micro.count(id) >= 2));
        st.tried[st.journey.obj] = {
          v1: Object.keys(V1NAMES)
            .filter(id => micro.count(id) >= 2)
            .map(id => V1NAMES[id])
        };
        st.journey.note =
          'Şimdi bu nöronlardan birinin çıkış sinyalini takip ediyoruz: şakak lobuna gidiyor…';
        micro.arrivedOut = false;
        micro.followOut(O.v1);
        await fWait(t, 8, () => micro.arrivedOut);
        st.journey.note = '';
      }
    },
    {
      title: () => '“Ne” yolu: şakak lobuna',
      cap: O =>
        `Kenar ve renk bilgisi beynin alt yüzünden şakak lobuna akıyor. Burnuna gelen ${O.smell} da (turuncu iz) buraya katılıyor: duyular tek bir kavramda birleşecek.`,
      ms: 150,
      async run(t, O) {
        micro.stopFollow();
        micro.setStim(null);
        holdAt(brain.focus);
        zoomTo(JZ, 2.4);
        await fWait(t, 2.5);
        brain.send('smell', 3.0, O.smellCol, 4);
        brain.spot('nose', brain.P.bulb, O.smellCol, 3.2, 'smell');
        brain.send('venR', 3.0, C_VEN);
        await chase(t, 'venL', 3.0, 4.5, C_VEN);
        brain.spot('itL', brain.P.itL, C_VEN, 1e9, 'it');
      }
    },
    {
      title: O => `Kavram nöronu: ${O.word}`,
      cap: O =>
        `Şakak lobunda ${O.feats} birlikte geliyor. Hepsini birden alan ${O.word} nöronu eşiği geçiyor; susturan nöron rakipleri bastırıyor. ${O.rival}`,
      ms: 200,
      live: () =>
        ['lemon', 'straw', 'icecream']
          .map(
            k => `${{ lemon: 'LİMON', straw: 'ÇİLEK', icecream: 'DONDURMA' }[k]}: ${micro.count(k)}`
          )
          .join(' · '),
      async run(t, O) {
        fastSim();
        micro.setMode('it');
        micro.setStim(st.journey.obj);
        micro.resetCounts();
        diveInto('temporal', 'it');
        holdAt(brain.focus);
        zoomTo(STOPS[3] - 0.08, 3.6);
        await fWait(t, 3.8);
        const concept = B3.sim.OBJECTS[st.journey.obj].concept;
        await fWait(t, 9, () => micro.count(concept) >= 2);
        (st.tried[st.journey.obj] || (st.tried[st.journey.obj] = { v1: [] })).word = O.word;
        st.journey.note = `Şimdi ${O.word} nöronunun çıkış sinyalini takip ediyoruz: konuşma alanına gidiyor…`;
        micro.arrivedOut = false;
        micro.followOut([concept]);
        await fWait(t, 8, () => micro.arrivedOut);
        st.journey.note = '';
      }
    },
    {
      title: O => `Kelimeye dönüşüyor: ${O.say}`,
      cap: () =>
        'Kavram sol alın lobundaki konuşma alanına (Broca) gidiyor; orada kelimenin sesleri sıraya konuyor. Hemen arkadaki hareket kabuğu dil, dudak ve gırtlak kaslarına komut gönderiyor.',
      ms: 600,
      async run(t, O) {
        micro.stopFollow();
        micro.setStim(null);
        brain.sayLbl.el.textContent = O.say;
        holdAt(brain.focus);
        zoomTo(JZ, 2.4);
        await fWait(t, 2.5);
        await chase(t, 'speech', 2.0, 5, C_SP);
        brain.spot('broca', brain.P.broca, C_SP, 1e9, 'broca');
        await chase(t, 'motor', 1.4, 5, C_SP);
        brain.spot('motor', brain.P.motor, C_SP, 1e9, 'motor');
        await chase(t, 'out', 2.4, 6, C_SP);
        brain.sayLbl.on = true;
        release();
        brain._alignTo = { yaw: -1.05, pitch: 0.16 };
        await fWait(t, 3);
      }
    }
  ];
  function fastSim() {
    if (+speedIn.value < 3) {
      speedIn.value = 3;
      setSpeed();
    }
  }
  async function filmRun() {
    const J = st.journey;
    for (let k = 0; k < FILM.length; k++) {
      if (st.journey !== J) return;
      J.scene = k;
      J.note = '';
      J.tok = {};
      renderCard(true);
      try {
        await FILM[k].run(J.tok, JO());
      } catch (e) {
        if (e === 'dead') return;
        console.error(e);
      }
    }
    if (st.journey !== J) return;
    release();
    J.phase = 'done';
    renderCard(true);
  }
  function jChoose(k) {
    const J = st.journey;
    if (!J) return;
    J.obj = k;
    J.phase = 'film';
    brain.showObject(k);
    setPaused(false);
    filmRun();
  }
  function jStart() {
    stopFollow();
    st.cardLobe = null;
    brain.select(null);
    st.tried = st.tried || {};
    if (st.journey && st.journey.tok) st.journey.tok.dead = true;
    tickWaiters();
    release();
    brain.setJourney(true);
    brain.setXray(true);
    brain.setInside(true);
    brain.setSeeThrough(true);
    brain.showObject(null);
    brain._alignTo = { yaw: -1.22, pitch: 0.16 };
    micro.setMode('generic');
    zoomTo(JZ, 1.8);
    st.journey = { phase: 'choose', obj: null, scene: 0, note: '' };
    renderCard(true);
  }
  function jSkip() {
    const J = st.journey;
    if (J && J.tok) J.tok.skip = true;
  }
  function jEnd(keep) {
    if (st.journey && st.journey.tok) st.journey.tok.dead = true;
    tickWaiters();
    release();
    st.journey = null;
    brain.setJourney(false);
    brain.setXray(false);
    brain.setInside(false);
    brain.setSeeThrough(false);
    micro.stopFollow();
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
    const dtc = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;
    if (!paused) clockT += dtc;
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
    tickWaiters();
    updateChase(dtc);
    const jl = document.getElementById('jLive');
    if (jl && st.journey && st.journey.phase === 'film') {
      const S = FILM[st.journey.scene],
        t = st.journey.note || (S.live ? S.live(JO()) : '');
      if (jl.textContent !== t) jl.textContent = t;
      jl.hidden = !t;
    }
    renderCard();
    const cap = document.getElementById('stageCap');
    if (cap) {
      const t = A.caption || '';
      if (cap.textContent !== t) cap.textContent = t;
      cap.hidden = !t;
    }
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
      const Q = new URLSearchParams(location.search);
      if (Q.get('yolculuk') != null) jStart();
      // seviyelerden gelen bağlantılar: ?lob=occipital (o loba dal) ya da ?durak=noronlar
      const lob = Q.get('lob'),
        durak = { beyin: 0, bolge: 1, katlar: 2, noronlar: 3, sinaps: 4 }[Q.get('durak')];
      if (lob && brain.LOBES[lob]) {
        // önce bütün beyinde lobu göster; kartta “Buraya yaklaş”
        brain.setFocus(lob);
        const f = brain.focusDir;
        brain._alignTo = {
          yaw: Math.atan2(f.x, f.z),
          pitch: Math.max(-0.2, Math.min(0.6, Math.asin(f.y)))
        };
        st.cardLobe = lob;
        brain.select(lob);
        renderCard(true);
      } else if (durak != null) setTimeout(() => zoomTo(STOPS[durak], 2.4), 600);
      window.B3dbg = {
        get Z() {
          return Z;
        },
        zoomTo,
        stages: () => stages,
        jStart,
        jSkip,
        jChoose,
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
