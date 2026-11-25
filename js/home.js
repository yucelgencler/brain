'use strict';
/* ------------------------------------------------------------------
   ANA SAYFA ve SÖZLÜK (index.html).
   Ana sayfada açılış: karanlıkta tek bir nöron ateşler, 3B beyin dönerek
   gelir, yana kayar, başlık belirir. Tıklama ya da tuş girişi atlar;
   “hareketi azalt” açıksa beyin doğrudan son hâliyle durur.
   Sayfa seçimi (routeOf/showView) path.js'te.
------------------------------------------------------------------- */

/* ---------- Bölüm kartları ve “Başla” ---------- */
function levelProgress(r) {
  if (!r.level) return null;
  const rec = P.rec[r.level.key];
  return { done: rec.done.length, total: r.level.missions.length };
}
function chapterStats(part) {
  const items = ROADMAP.filter(r => r.part === part.id);
  let done = 0,
    total = 0;
  for (const r of items) {
    const p = levelProgress(r);
    if (p) {
      done += p.done;
      total += p.total;
    }
  }
  const next = items.find(r => {
    const p = levelProgress(r);
    return p ? p.done < p.total : true;
  });
  return { items, done, total, next: next || items[0] };
}
function anyProgress() {
  return ROADMAP.some(r => {
    const p = levelProgress(r);
    return p && p.done > 0;
  });
}
function buildHome() {
  const started = anyProgress(),
    cur = curRoad();
  const start = $('#startBtn');
  start.textContent = started ? `Kaldığın yerden devam et →` : 'Başla →';
  start.href = started ? `#seviye-${cur.id}` : '#seviye-1';
  const note = $('#resumeNote');
  note.hidden = !started;
  if (started) note.textContent = `Son baktığın: Seviye ${cur.id} · ${cur.title}`;

  const card = (cls, kicker, title, about, body, foot) =>
    `<article class="chap ${cls}"><p class="chap-k">${kicker}</p><h3>${title}</h3><p class="chap-a">${about}</p>${body}${foot}</article>`;
  const intro = card(
    'extra',
    'Başlangıç · 5 dakika',
    'Beynin içine bir bak',
    'Bütün beyinden kabuğa, bir nörona ve iki nöronun buluştuğu sinapsa kadar yakınlaş. Sinyalin nasıl aktığını izle.',
    '',
    `<a class="btn" href="beyin3d.html">3B turu başlat →</a>`
  );
  const chapters = PARTS.map(p => {
    const c = chapterStats(p),
      pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
    const list = c.items
      .map(r => {
        const pr = levelProgress(r);
        const mark = pr
          ? pr.done === pr.total
            ? '<span class="cl-s full" aria-label="tamamlandı">✓</span>'
            : `<span class="cl-s">${pr.done}/${pr.total}</span>`
          : `<span class="cl-s soon">${esc(r.note || 'yakında')}</span>`;
        return `<li><a href="#seviye-${r.id}"><span class="cl-n">${r.id}</span><span class="cl-t">${esc(r.title)}</span>${mark}</a></li>`;
      })
      .join('');
    const verb = c.done === 0 ? 'Başla' : c.done >= c.total ? 'Yeniden bak' : 'Devam et';
    return card(
      '',
      `Bölüm ${p.no} · ${c.items.length} seviye`,
      esc(p.title),
      esc(p.about),
      `<ol class="chap-list">${list}</ol>`,
      `<div class="chap-foot"><div class="chap-bar" role="progressbar" aria-label="Bölüm ${p.no} ilerlemesi" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><a class="btn ${c.done === 0 && p.no === 1 ? 'primary' : ''}" href="#seviye-${c.next.id}">${verb} →</a></div>`
    );
  });
  const final = card(
    'extra final',
    'Final · 8 adım',
    'Hepsi bir arada: limonun yolculuğu',
    'Bir limona baktığında ışığın gözden görme alanına, oradan “limon” kavramına ve ağzından çıkan kelimeye kadar izlediği yol. Önceki bölümlerde tek tek kurduğun parçalar bir beynin içinde birlikte çalışır.',
    '',
    `<a class="btn" href="beyin3d.html?yolculuk">Yolculuğa çık →</a>`
  );
  $('#chapters').innerHTML = intro + chapters.join('') + final;
  heroStart();
}

/* ---------- Sözlük ---------- */
const glLower = s => s.toLocaleLowerCase('tr-TR');
const slug = s =>
  glLower(s)
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-');
let glossQ = '';
function buildGlossary() {
  const el = $('#glossary');
  if (!el.dataset.built) {
    el.dataset.built = '1';
    el.innerHTML = `
      <div class="gl-head">
        <p class="kicker crumb"><a href="#">Ana sayfa</a> › Sözlük</p>
        <h2>Sözlük</h2>
        <p>Seviyelerde geçen terimlerin kısa ve sade açıklamaları. Her terimin yanında onu kendin deneyebileceğin seviye var.</p>
        <label class="gl-search"><span class="sr">Terim ara</span><input id="glQ" type="search" placeholder="Terim ara: nöron, eşik, sinaps…" autocomplete="off" /></label>
      </div>
      <div class="gl-list" id="glList"></div>`;
    $('#glQ').addEventListener('input', e => {
      glossQ = glLower(e.target.value.trim());
      renderGlossary();
    });
  }
  renderGlossary();
}
function renderGlossary() {
  const items = GLOSSARY.slice()
    .sort((a, b) => a.t.localeCompare(b.t, 'tr'))
    .filter(g => !glossQ || glLower([g.t, g.d].concat(g.alt || []).join(' ')).includes(glossQ));
  $('#glList').innerHTML = items.length
    ? items
        .map(g => {
          const r = g.see ? roadByKey(g.see) : null;
          return `<article class="gl-item" id="t-${slug(g.t)}"><h3>${esc(g.t)}</h3>${g.alt ? `<p class="gl-alt">Diğer adları: ${g.alt.map(esc).join(', ')}</p>` : ''}<p>${esc(g.d)}</p>${r ? `<a href="#seviye-${r.id}">Seviye ${r.id}: ${esc(r.title)} →</a>` : ''}</article>`;
        })
        .join('')
    : `<p class="hint">“${esc(glossQ)}” için bir terim bulunamadı.</p>`;
}

/* ---------- Açılış: 3B beyin ---------- */
const hero = (() => {
  const H = { ready: false, running: false, built: false };
  const canvas = $('#heroGl');
  if (!canvas || !window.THREE || !window.B3 || !B3.makeBrainStage) return H;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer, cam, st, glow, sparks, raf, last, t0, introLen, tSkip;
  const tmp = new THREE.Vector3(),
    nrm = new THREE.Vector3();
  let px = 0,
    py = 0;

  function build() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      return false;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const t = performance.now();
    st = B3.makeBrainStage({
      bg: '#070918',
      layer: $('#heroLabels'),
      clock: () => (performance.now() - t) / 1000
    });
    st.scene.background = null;
    cam = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
    glow = new B3.GlowPoints(400);
    st.scene.add(glow.mesh);
    sparks = [];
    resize();
    window.addEventListener('resize', resize);
    canvas.closest('.hero').addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - 0.5) * 2;
      py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    return true;
  }
  function resize() {
    if (!renderer) return;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }
  const ease = u => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const T = tSkip ? 99 : (now - t0) / 1000;
    const wide = canvas.clientWidth >= 760;
    // 0–0,8 s: tek kıvılcım; 0,8–2,8 s: beyin dönerek yaklaşır; 2,6–3,6 s: yana kayar
    const come = reduce ? 1 : ease((T - 0.8) / 2.0),
      side = reduce ? 1 : ease((T - 2.6) / 1.0);
    const spin = reduce ? 0 : 7.5 * Math.pow(1 - come, 2);
    H.yaw = (H.yaw || -2.2) + dt * (0.12 + spin);
    const yaw = H.yaw + px * 0.25,
      pitch = 0.22 - py * 0.12;
    const dist = 34 + 120 * Math.pow(1 - come, 2) + (wide ? 0 : 10);
    cam.position.set(
      Math.cos(pitch) * Math.sin(yaw) * dist,
      Math.sin(pitch) * dist,
      Math.cos(pitch) * Math.cos(yaw) * dist
    );
    cam.lookAt(0, -0.2, -0.4);
    const W = canvas.clientWidth,
      Hh = canvas.clientHeight;
    if (wide) cam.setViewOffset(W, Hh, -W * 0.24 * side, 0, W, Hh);
    else cam.setViewOffset(W, Hh, 0, Hh * 0.18 * side, W, Hh);
    cam.updateProjectionMatrix();
    canvas.style.opacity = String(reduce ? 1 : Math.min(1, T / 0.4));
    // kıvılcımlar: önce tek, sonra çoğalır
    glow.clear();
    if (T < 0.95 && !reduce) {
      const k = Math.sin(Math.min(1, T / 0.9) * Math.PI);
      glow.add(0, 0.3, 0, 0.8, 0.95, 1, 2 + 8 * k, k);
    }
    const rate = reduce ? 4 : come * 9;
    if (Math.random() < rate * dt) {
      st.surfacePoint(tmp, nrm);
      tmp.addScaledVector(nrm, 0.18);
      sparks.push({
        p: tmp.clone(),
        t: now,
        c: Math.random() < 0.7 ? [0.75, 0.93, 1] : [1, 0.88, 0.45]
      });
    }
    sparks = sparks.filter(s => {
      const a = 1 - (now - s.t) / 700;
      if (a <= 0) return false;
      glow.add(s.p.x, s.p.y, s.p.z, s.c[0], s.c[1], s.c[2], 0.9 + 0.6 * a, a);
      return true;
    });
    const pr = renderer.getPixelRatio();
    glow.commit((Hh * pr) / (2 * Math.tan((cam.fov * Math.PI) / 360)));
    renderer.render(st.scene, cam);
    if (T > introLen && !H.ready) finish();
  }
  function finish() {
    H.ready = true;
    document.body.classList.add('hero-ready');
    $('#skipIntro').hidden = true;
    try {
      sessionStorage.setItem('nb-intro', '1');
    } catch (e) {}
  }
  function skip() {
    if (!H.ready) tSkip = true;
  }
  H.start = function () {
    const seen = (() => {
      try {
        return sessionStorage.getItem('nb-intro') === '1';
      } catch (e) {
        return false;
      }
    })();
    const quick = reduce || seen;
    if (quick) document.body.classList.add('hero-ready');
    else {
      document.body.classList.remove('hero-ready');
      $('#skipIntro').hidden = false;
    }
    const begin = () => {
      if (!H.built) {
        if (!build()) {
          finish();
          return;
        }
        H.built = true;
      }
      resize();
      introLen = quick ? 0 : 3.6;
      tSkip = quick;
      H.ready = quick;
      t0 = last = performance.now();
      cancelAnimationFrame(raf);
      H.running = true;
      raf = requestAnimationFrame(frame);
    };
    // Beyin kıvrımları ilk seferde yaklaşık yarım saniyede üretiliyor: önce sayfa çizilsin
    if (H.built) begin();
    else setTimeout(begin, 60);
  };
  H.stop = function () {
    cancelAnimationFrame(raf);
    H.running = false;
  };
  $('#skipIntro').addEventListener('click', skip);
  window.addEventListener('keydown', e => {
    if (document.body.dataset.view === 'home' && !H.ready && e.key !== 'Tab') skip();
  });
  $('.hero') &&
    $('.hero').addEventListener('click', e => {
      if (!H.ready && !e.target.closest('a,button')) skip();
    });
  // Ana sayfa görünmüyorken ya da kahraman alanı ekran dışındayken çizme
  window.addEventListener('nb:view', e => {
    if (e.detail !== 'home') H.stop();
  });
  if ('IntersectionObserver' in window)
    new IntersectionObserver(es => {
      for (const en of es) {
        if (!H.built || document.body.dataset.view !== 'home') continue;
        if (en.isIntersecting && !H.running) {
          H.running = true;
          last = performance.now();
          raf = requestAnimationFrame(frame);
        } else if (!en.isIntersecting && H.running) H.stop();
      }
    }).observe($('.hero'));
  return H;
})();
function heroStart() {
  if (hero.start) hero.start();
  else document.body.classList.add('hero-ready');
}
