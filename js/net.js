'use strict';
/* ------------------------------------------------------------------
   SEVİYE 8: duvarı aşmak (iki ara nöron + lamba nöronu)
   "Elle kur": ya hep ya hiç nöronlar, kaydırıcılarla.
   "Makine öğrensin": yumuşak eşik ve geri yayılım (js/neuron.js netLearnStep).
   path.js'teki yardımcıları ($, esc, L, R, refresh, toast, cardHTML, stripHTML…) kullanır.
------------------------------------------------------------------- */
let nAuto = 0,
  nLastCard = '';
const XOR = GATES.xor.target;
const NP = {
  a: { x: 75, y: 80 },
  b: { x: 75, y: 220 },
  h: [
    { x: 330, y: 80 },
    { x: 330, y: 220 }
  ],
  o: { x: 565, y: 150 },
  hr: 34,
  or: 38
};
const netOf = st => (st.mode === 'learn' ? st.lrn : st.man);
const softOf = st => st.mode === 'learn';
const pct = v => '%' + Math.round(v * 100);
const pn = v => (v < -1e-9 ? `(${num(v)})` : num(v));

function netStop() {
  if (!nAuto) return;
  clearInterval(nAuto);
  nAuto = 0;
  const b = document.querySelector('#nAuto');
  if (b) {
    b.textContent = 'Otomatik ▶';
    b.setAttribute('aria-pressed', 'false');
  }
}
function multiNetReset() {
  nLastCard = '';
}

function netGridHTML(lv) {
  const sliders = [
    [
      'Ara nöron 1',
      [
        ['w00', 'A bağlantısı'],
        ['w01', 'B bağlantısı'],
        ['t0', 'eşik']
      ]
    ],
    [
      'Ara nöron 2',
      [
        ['w10', 'A bağlantısı'],
        ['w11', 'B bağlantısı'],
        ['t1', 'eşik']
      ]
    ],
    [
      'Lamba nöronu',
      [
        ['v0', 'Ara 1 bağlantısı'],
        ['v1', 'Ara 2 bağlantısı'],
        ['tO', 'eşik']
      ]
    ]
  ];
  return `<section class="bench has-card">
      <div class="bench-card">
        <div class="seg modesel" id="nMode" role="group" aria-label="Mod" data-lay="mode" data-glow="mode"><button data-m="manual">Elle kur</button><button data-m="learn">Makine öğrensin</button></div>
        <div class="nm-manual">
          <p class="hint">Bir durum seç: nörona o durum gösterilir.</p>
          <div class="ncombos" id="nCombos"></div>
        </div>
        <div class="nm-learn">
          <div class="tcard-wrap" id="ncard"></div>
          <button class="btn primary big" id="nOne" data-glow="one">Bir kart göster</button>
          <div class="bench-more"><button class="btn small" id="nRound">Bir tur</button><button class="btn small" id="nAuto" aria-pressed="false" data-glow="auto">Otomatik ▶</button></div>
          <div class="bench-more"><button class="btn ghost small" id="nRand">Rastgele başlat</button><button class="btn ghost small" id="nZero">Tamamen sıfırla</button></div>
          <p class="hint" id="nInfo"></p>
        </div>
      </div>
      <div class="bench-scene">
        <div class="stage scene-wrap"><svg id="nscene" viewBox="0 0 680 300" role="img" aria-label="Anahtarlar, ara nöronlar ve lamba nöronu"></svg></div>
        <div class="nsliders nm-manual">${sliders
          .map(
            ([t, items]) =>
              `<div class="nsg" data-lay="${['h1', 'h2', 'out'][sliders.findIndex(g => g[0] === t)]}" data-glow="${['h1', 'h2', 'out'][sliders.findIndex(g => g[0] === t)]}"><h4>${t}</h4>${items
                .map(
                  ([k, l]) => `<label class="sl"><span class="sl-l">${l}</span>
          <input type="range" id="ns-${k}" min="-2" max="2" step="0.1"><output id="no-${k}" data-fl="no-${k}"></output></label>`
                )
                .join('')}</div>`
          )
          .join('')}</div>
      </div>
      <div class="bench-answer panel" id="nanswer" aria-live="polite"></div>
    </section>
    <section class="strip nm-learn" id="nstep" aria-live="polite" data-lay="strip"></section>
    <section class="bench-bottom three">
      <div class="panel" data-lay="table"><div class="ph"><h3>Dört durum</h3><span class="pc" id="nScore"></span></div>
        <p class="hint">Her satırda ara nöronların ve lambanın cevabı. Bir satıra tıklarsan o durum gösterilir.</p><table class="tt" id="ntt"></table></div>
      <div class="panel" data-lay="map"><h3>Karar haritası</h3>
        <svg id="nmap" class="map2" viewBox="0 0 260 250" role="img" aria-label="Ağın karar haritası"></svg>
        <p class="hint">Boyalı bölgede lamba yanar. Kesikli çizgiler iki ara nöronun kendi sınırları: tek nöron tek çizgi çizebiliyordu, şimdi iki çizgi birleşiyor.</p></div>
      <div class="panel" data-lay="hid"><h3>Ara nöronlar ne yakalıyor?</h3>
        <div id="nhid"></div>
        <button class="btn small" id="nCmp">Benim çözümümle karşılaştır</button>
        <div id="ncmp"></div>
        <div class="lrounds nm-learn"><div class="ph"><h3>Tur başına ortalama hata</h3><span class="pc" id="nRoundsN"></span></div>
          <svg id="nrounds" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true"></svg><p class="hint" id="nRoundsHint"></p></div>
      </div>
    </section>`;
}

function wireNet(lv) {
  const svg = $('#nscene'),
    E = [
      ['a', 0, 0],
      ['b', 0, 1],
      ['a', 1, 0],
      ['b', 1, 1]
    ];
  let h = `<defs><marker id="narrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>
    <text class="coltitle" x="${NP.a.x}" y="18">Anahtarlar</text><text class="coltitle" x="${NP.h[0].x}" y="18">Ara (gizli) nöronlar</text><text class="coltitle" x="${NP.o.x}" y="18">Lamba nöronu</text>`;
  const seg = (p, q, r1, r2) => {
    const dx = q.x - p.x,
      dy = q.y - p.y,
      d = Math.hypot(dx, dy);
    return [p.x + (dx / d) * r1, p.y + (dy / d) * r1, q.x - (dx / d) * r2, q.y - (dy / d) * r2];
  };
  // girdi → ara
  E.forEach(([inp, j, i]) => {
    const [x1, y1, x2, y2] = seg(NP[inp], NP.h[j], 40, NP.hr + 4),
      id = `w${j}${i}`;
    const t = i === j ? 0.45 : 0.72,
      lx = x1 + (x2 - x1) * t,
      ly = y1 + (y2 - y1) * t + (i === j ? -9 : j === 0 ? -6 : 16);
    h += `<line class="syn" id="ne-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="flow" id="nf-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <text class="wtext" id="nw-${id}" data-fl="nw-${id}" x="${lx}" y="${ly}"></text><g class="delta-layer" id="nd-${id}" data-x="${lx}" data-y="${ly - 16}"></g>`;
  });
  // ara → lamba
  [0, 1].forEach(j => {
    const [x1, y1, x2, y2] = seg(NP.h[j], NP.o, NP.hr + 2, NP.or + 6),
      id = `v${j}`,
      lx = (x1 + x2) / 2,
      ly = (y1 + y2) / 2 + (j ? 16 : -9);
    h += `<line class="syn" id="ne-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><line class="flow" id="nf-${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
      <text class="wtext" id="nw-${id}" data-fl="nw-${id}" x="${lx}" y="${ly}"></text><g class="delta-layer" id="nd-${id}" data-x="${lx}" data-y="${ly - 16}"></g>`;
  });
  // anahtarlar
  ['a', 'b'].forEach((k, i) => {
    const p = NP[k];
    h += `<g class="inpx" id="nin${i}" tabindex="0" role="button" data-i="${i}"><rect class="px-cell" id="ninc${i}" x="${p.x - 35}" y="${p.y - 35}" width="70" height="70" rx="12"/>
      <text class="px-state emo" id="nins${i}" x="${p.x}" y="${p.y + 13}"></text></g><text class="px-name" x="${p.x}" y="${p.y + 53}">${i ? 'B: üst anahtar' : 'A: alt anahtar'}</text>`;
  });
  // ara nöronlar
  [0, 1].forEach(j => {
    const p = NP.h[j];
    h += `<circle class="soma" id="nh${j}" cx="${p.x}" cy="${p.y}" r="${NP.hr}"/><text class="nn-l" id="nhl${j}" x="${p.x}" y="${p.y - 6}">Ara ${j + 1}</text>
      <text class="nn-v" id="nhv${j}" x="${p.x}" y="${p.y + 13}"></text>
      <text class="soma-sub" id="nht${j}" data-fl="nht${j}" x="${p.x}" y="${p.y + NP.hr + 18}"></text><g class="delta-layer" id="nd-t${j}" data-x="${p.x + 58}" data-y="${p.y + NP.hr + 18}"></g>`;
  });
  // lamba
  h += `<circle class="soma lamp" id="no" cx="${NP.o.x}" cy="${NP.o.y}" r="${NP.or}"/><text class="lamp-i" id="noi" x="${NP.o.x}" y="${NP.o.y + 13}">💡</text>
    <text class="nn-v out" id="nov" x="${NP.o.x}" y="${NP.o.y + NP.or + 20}"></text>
    <text class="soma-sub" id="not" data-fl="not" x="${NP.o.x}" y="${NP.o.y + NP.or + 38}"></text><g class="delta-layer" id="nd-tO" data-x="${NP.o.x + 60}" data-y="${NP.o.y + NP.or + 38}"></g>`;
  svg.innerHTML = h;
  svg.querySelectorAll('.inpx').forEach(g => {
    const tog = () => {
      const st = R().st,
        i = +g.dataset.i;
      st.x = st.x.slice();
      st.x[i] = st.x[i] ? 0 : 1;
      refresh();
    };
    g.addEventListener('click', tog);
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tog();
      }
    });
  });
  // mod
  document.querySelectorAll('#nMode button').forEach(
    b =>
      (b.onclick = () => {
        const st = R().st;
        if (st.mode === b.dataset.m) return;
        netStop();
        st.mode = b.dataset.m;
        if (st.mode === 'learn' && !st.lrn) {
          st.lrn = netRandom(st.seed);
          st.fromZero = false;
        }
        refresh();
      })
  );
  // kaydırıcılar
  const keys = {
    w00: ['W', 0, 0],
    w01: ['W', 0, 1],
    w10: ['W', 1, 0],
    w11: ['W', 1, 1],
    t0: ['th', 0],
    t1: ['th', 1],
    v0: ['V', 0],
    v1: ['V', 1],
    tO: ['thO']
  };
  Object.entries(keys).forEach(([k, path]) => {
    $('#ns-' + k).addEventListener('input', e => {
      const m = R().st.man,
        v = tidy(+e.target.value);
      if (path[0] === 'W') m.W[path[1]][path[2]] = v;
      else if (path[0] === 'thO') m.thO = v;
      else m[path[0]][path[1]] = v;
      refresh();
    });
  });
  // öğrenme
  $('#nOne').onclick = () => netLearnOne();
  $('#nRound').onclick = () => {
    for (let k = 0; k < 4; k++) netLearnOne(true);
    refresh();
  };
  $('#nAuto').onclick = () => {
    if (nAuto) {
      netStop();
      return;
    }
    const b = $('#nAuto');
    b.textContent = 'Durdur ⏸';
    b.setAttribute('aria-pressed', 'true');
    nAuto = setInterval(
      () => {
        for (let k = 0; k < 8; k++) {
          if (!nAuto) break;
          netLearnOne(true);
        }
        refresh();
      },
      reducedMotion ? 200 : 90
    );
  };
  $('#nRand').onclick = () => {
    netStop();
    const st = R().st,
      i = (NET_SEEDS.indexOf(st.seed) + 1) % NET_SEEDS.length;
    st.seed = NET_SEEDS[i];
    st.lrn = netRandom(st.seed);
    st.fromZero = false;
    st.zeroRounds = 0;
    st.flags.learnedNow = false;
    netResetRounds();
    refresh();
    toast('Yeni rastgele başlangıç: bağlantılar düzensiz, ağ henüz bir şey bilmiyor.');
  };
  $('#nZero').onclick = () => {
    netStop();
    const st = R().st;
    st.lrn = netZero();
    st.fromZero = true;
    st.zeroRounds = 0;
    st.flags.learnedNow = false;
    netResetRounds();
    refresh();
    toast('Bütün bağlantılar ve eşikler 0. İki ara nöron şu an birebir aynı.');
  };
  $('#nCmp').onclick = () => {
    R().st.flags.compared = true;
    refresh();
  };
}
function netResetRounds() {
  Object.assign(R(), { cursor: 0, steps: 0, rounds: [], roundErr: 0, last: null });
}

function netLearnOne(silent) {
  const rec = R(),
    st = rec.st;
  if (!st.lrn) st.lrn = netRandom(st.seed);
  const i = rec.cursor % 4,
    x = COMBOS[i],
    r = netLearnStep(x, XOR[i], st.lrn, st.rate);
  st.lrn = r.after;
  st.x = x.slice();
  rec.cursor++;
  rec.steps++;
  rec.cardSeq = (rec.cardSeq || 0) + 1;
  rec.last = r;
  rec.roundErr = (rec.roundErr || 0) + Math.abs(r.err);
  if (rec.cursor % 4 === 0) {
    rec.rounds = (rec.rounds || []).concat([rec.roundErr / 4]).slice(-150);
    rec.roundErr = 0;
    if (st.fromZero) {
      st.zeroRounds = (st.zeroRounds || 0) + 1;
      if (st.zeroRounds >= 200 && !netSolves(st.lrn, true, XOR) && !st.flags.symmetry) {
        st.flags.symmetry = true;
        netStop();
        setTimeout(() => toast('200 tur geçti, hâlâ öğrenemedi: iki ara nöron ikiz kaldı.'), 0);
      }
    }
  }
  if (!st.fromZero && !st.flags.learnedNow && netSolves(st.lrn, true, XOR, 0.4)) {
    st.flags.learned = true;
    st.flags.learnedNow = true;
    netStop();
    setTimeout(
      () => toast(`Öğrendi! ${rec.rounds.length} turda dört durumun dördünü de doğru biliyor.`),
      0
    );
  }
  if (!silent) {
    netShowDeltas(r);
    refresh();
  }
}

function netShowDeltas(r) {
  if (reducedMotion) return;
  const put = (id, d) => {
    if (Math.abs(d) < 0.005) return;
    const g = $('#nd-' + id);
    if (!g) return;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', g.dataset.x);
    t.setAttribute('y', g.dataset.y);
    t.setAttribute('class', 'delta small ' + (d > 0 ? 'pos' : 'neg'));
    t.textContent = (d > 0 ? '+' : '−') + Math.abs(d).toFixed(2).replace('.', ',');
    g.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  };
  const b = r.before,
    a = r.after;
  [0, 1].forEach(j => {
    [0, 1].forEach(i => put(`w${j}${i}`, a.W[j][i] - b.W[j][i]));
    put('v' + j, a.V[j] - b.V[j]);
    put('t' + j, a.th[j] - b.th[j]);
  });
  put('tO', a.thO - b.thO);
}

function fmt2(v, soft) {
  return soft ? num(v, 2) : num(v);
}
function updateNet(lv, rec) {
  const st = rec.st,
    soft = softOf(st),
    n = netOf(st),
    f = netForward(st.x, n, soft),
    sc = SCENARIOS.xor;
  // mod görünümü
  $('#lv').classList.toggle('mode-learn', soft);
  document
    .querySelectorAll('#nMode button')
    .forEach(b => b.setAttribute('aria-pressed', st.mode === b.dataset.m ? 'true' : 'false'));
  // sahne
  [0, 1].forEach(i => {
    const v = st.x[i],
      fe = sc['ab'[i]][v ? 'on' : 'off'];
    $('#ninc' + i).style.fill =
      `color-mix(in srgb, var(--light) ${v ? 100 : 0}%, var(--surface-2))`;
    $('#nins' + i).textContent = fe.icon;
    $('#nin' + i).setAttribute('aria-pressed', v ? 'true' : 'false');
    $('#nin' + i).setAttribute('aria-label', `${fe.text}. Değiştir`);
  });
  const edge = (id, w, srcAct) => {
    const aw = Math.min(Math.abs(w), soft ? 6 : 2) / (soft ? 6 : 2),
      kind = Math.abs(w) < 1e-9 ? 'zero' : w > 0 ? 'pos' : 'neg';
    const e = $('#ne-' + id);
    e.setAttribute('class', 'syn ' + kind);
    e.style.strokeWidth = kind === 'zero' ? 1.2 : 1.2 + 3.4 * aw;
    const fl = $('#nf-' + id);
    fl.setAttribute('class', 'flow ' + kind);
    fl.style.opacity = kind === 'zero' ? 0 : clamp(srcAct * (0.35 + aw * 0.65), 0, 1);
    fl.style.strokeWidth = 1.2 + 3.4 * aw;
    const t = $('#nw-' + id);
    t.setAttribute('class', 'wtext ' + kind);
    t.textContent = fmt2(w, soft).replace(/^(?!−)/, w > 1e-9 ? '+' : '');
  };
  [0, 1].forEach(j => {
    [0, 1].forEach(i => edge(`w${j}${i}`, n.W[j][i], st.x[i]));
    edge('v' + j, n.V[j], f.h[j]);
  });
  [0, 1].forEach(j => {
    const v = f.h[j],
      on = v >= 0.5;
    const c = $('#nh' + j);
    c.style.fill = soft
      ? `color-mix(in srgb, var(--node-on) ${Math.round(v * 100)}%, var(--node-off))`
      : '';
    c.classList.toggle('on', !soft && on);
    $('#nhl' + j).classList.toggle('on', on);
    const hv = $('#nhv' + j);
    hv.textContent = soft ? pct(v) : on ? 'ateş' : '—';
    hv.classList.toggle('on', on);
    $('#nht' + j).textContent = `eşik ${fmt2(n.th[j], soft)}`;
  });
  const lampOn = f.o >= 0.5;
  const lc = $('#no');
  lc.style.fill = soft
    ? `color-mix(in srgb, var(--light) ${Math.round(f.o * 100)}%, var(--node-off))`
    : '';
  lc.classList.toggle('lit', !soft && lampOn);
  $('#noi').style.opacity = soft ? 0.25 + 0.75 * f.o : lampOn ? 1 : 0.25;
  $('#nov').textContent = soft ? `${pct(f.o)} yanık` : lampOn ? 'yanıyor' : 'sönük';
  $('#not').textContent = `eşik ${fmt2(n.thO, soft)}`;
  // cevap kutusu
  const i = COMBOS.findIndex(c => c[0] === st.x[0] && c[1] === st.x[1]),
    ok = (lampOn ? 1 : 0) === XOR[i];
  const calc =
    [0, 1]
      .map(j =>
        soft
          ? `<div class="cl">Ara ${j + 1}: toplam ${num(f.hs[j], 2)} − eşik ${num(n.th[j], 2)} → <b>${pct(f.h[j])}</b></div>`
          : `<div class="cl">Ara ${j + 1}: ${st.x[0]} × ${pn(n.W[j][0])} + ${st.x[1]} × ${pn(n.W[j][1])} = ${num(f.hs[j])} ${f.h[j] ? '≥' : '<'} eşik ${num(n.th[j])} → <b>${f.h[j] ? 'ateşler' : 'susar'}</b></div>`
      )
      .join('') +
    (soft
      ? `<div class="cl sum">Lamba: toplam ${num(f.os, 2)} − eşik ${num(n.thO, 2)} → <b>${pct(f.o)}</b></div>`
      : `<div class="cl sum">Lamba: ${f.h[0]} × ${pn(n.V[0])} + ${f.h[1]} × ${pn(n.V[1])} = ${num(f.os)} ${lampOn ? '≥' : '<'} eşik ${num(n.thO)} → <b>${lampOn ? 'yanar' : 'söner'}</b></div>`);
  $('#nanswer').innerHTML =
    `<div class="ans-l">${soft ? 'Lambanın şimdiki cevabı' : 'Lambanın cevabı'}</div>
    <div class="ans-big ${lampOn ? 'on' : ''}" data-fl="ans">${lampOn ? 'YANSIN' : 'SÖNSÜN'}${soft ? ` <small>${pct(f.o)}</small>` : ''}</div>
    <div class="ans-sub">${esc(featTxt(sc, st.x))}</div>
    <div class="ans-v ${ok ? 'ok' : 'bad'}">doğru cevap: <b>${XOR[i] ? 'yansın' : 'sönsün'}</b> ${ok ? '✓' : '✗'}</div>
    <div class="calc">${calc}</div>`;
  // elle kur: durum seçici ve kaydırıcılar
  const cb = $('#nCombos');
  cb.innerHTML = COMBOS.map((x, k) => {
    const o = netForward(x, n, soft).o >= 0.5 ? 1 : 0,
      good = o === XOR[k],
      cur = x[0] === st.x[0] && x[1] === st.x[1];
    return `<button class="ncombo ${cur ? 'cur' : ''} ${good ? 'ok' : 'bad'}" data-k="${k}"><span>${sc.a[x[0] ? 'on' : 'off'].icon}${sc.b[x[1] ? 'on' : 'off'].icon}</span><small>${good ? '✓' : '✗'} ${o ? 'yanar' : 'söner'}</small></button>`;
  }).join('');
  cb.querySelectorAll('.ncombo').forEach(
    b =>
      (b.onclick = () => {
        R().st.x = COMBOS[+b.dataset.k].slice();
        refresh();
      })
  );
  const m = st.man,
    vals = {
      w00: m.W[0][0],
      w01: m.W[0][1],
      w10: m.W[1][0],
      w11: m.W[1][1],
      t0: m.th[0],
      t1: m.th[1],
      v0: m.V[0],
      v1: m.V[1],
      tO: m.thO
    };
  Object.entries(vals).forEach(([k, v]) => {
    const s = $('#ns-' + k);
    if (document.activeElement !== s) s.value = v;
    $('#no-' + k).textContent = num(v);
  });
  // tablo
  const outs = COMBOS.map(x => netForward(x, n, soft));
  const cell = v =>
    soft
      ? `<span class="fire ${v >= 0.5 ? 'on' : ''}">${pct(v)}</span>`
      : `<span class="fire ${v ? 'on' : ''}">${v ? 'ateş' : '—'}</span>`;
  $('#ntt').innerHTML =
    `<thead><tr><th>A</th><th>B</th><th>Ara 1</th><th>Ara 2</th><th>lamba</th><th>doğru</th><th></th></tr></thead><tbody>${COMBOS.map(
      (x, k) => {
        const o = outs[k],
          lo = o.o >= 0.5 ? 1 : 0,
          good = lo === XOR[k],
          cur = x[0] === st.x[0] && x[1] === st.x[1];
        return `<tr class="${cur ? 'cur' : ''}" data-k="${k}" tabindex="0"><td class="fcell">${sc.a[x[0] ? 'on' : 'off'].icon}</td><td class="fcell">${sc.b[x[1] ? 'on' : 'off'].icon}</td>
      <td data-fl="nh0${k}">${cell(o.h[0])}</td><td data-fl="nh1${k}">${cell(o.h[1])}</td><td data-fl="nl${k}">${cell(o.o)}</td><td>${XOR[k] ? 'yansın' : 'sönsün'}</td><td class="${good ? 'mk-ok' : 'mk-bad'}">${good ? '✓' : '✗'}</td></tr>`;
      }
    ).join('')}</tbody>`;
  $('#ntt')
    .querySelectorAll('tbody tr')
    .forEach(
      tr =>
        (tr.onclick = () => {
          R().st.x = COMBOS[+tr.dataset.k].slice();
          refresh();
        })
    );
  const nOk = outs.filter((o, k) => (o.o >= 0.5 ? 1 : 0) === XOR[k]).length;
  $('#nScore').textContent = `${nOk}/4 doğru`;
  renderNetMap(st, n, soft);
  renderHidden(st, n, soft);
  if (soft) updateNetLearn(lv, rec, st, n);
}

function renderNetMap(st, n, soft) {
  const svg = $('#nmap'),
    d0 = -0.45,
    d1 = 1.45,
    X0 = 34,
    Y0 = 10,
    S = 200,
    G = 40,
    cs = S / G;
  const px = v => X0 + ((v - d0) / (d1 - d0)) * S,
    py = v => Y0 + S - ((v - d0) / (d1 - d0)) * S;
  let h = `<rect class="m-bg" x="${X0}" y="${Y0}" width="${S}" height="${S}"/><g shape-rendering="crispEdges">`;
  for (let a = 0; a < G; a++)
    for (let b = 0; b < G; b++) {
      const xa = d0 + ((a + 0.5) / G) * (d1 - d0),
        xb = d0 + ((b + 0.5) / G) * (d1 - d0),
        o = netForward([xa, xb], n, soft).o,
        op = soft ? o * 0.45 : o >= 0.5 ? 0.3 : 0;
      if (op > 0.02)
        h += `<rect class="m-fire2" x="${(X0 + a * cs).toFixed(1)}" y="${(Y0 + S - (b + 1) * cs).toFixed(1)}" width="${cs}" height="${cs}" fill-opacity="${op.toFixed(2)}"/>`;
    }
  h += '</g>';
  // her ara nöronun kendi sınır çizgisi
  [0, 1].forEach(j => {
    const [wa, wb] = n.W[j],
      th = n.th[j],
      pts = [];
    if (Math.abs(wb) > 1e-9)
      for (const a of [d0, d1]) {
        const b = (th - wa * a) / wb;
        if (b >= d0 - 1e-9 && b <= d1 + 1e-9) pts.push([a, b]);
      }
    if (Math.abs(wa) > 1e-9)
      for (const b of [d0, d1]) {
        const a = (th - wb * b) / wa;
        if (a >= d0 - 1e-9 && a <= d1 + 1e-9) pts.push([a, b]);
      }
    if (pts.length >= 2) {
      pts.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      const p = pts[0],
        q = pts[pts.length - 1];
      h += `<line class="m-hline h${j}" x1="${px(p[0])}" y1="${py(p[1])}" x2="${px(q[0])}" y2="${py(q[1])}"/>`;
    }
  });
  h += `<text class="m-ax" x="${px(0)}" y="${Y0 + S + 16}">0</text><text class="m-ax" x="${px(1)}" y="${Y0 + S + 16}">1</text><text class="m-ax" x="${X0 + S / 2}" y="${Y0 + S + 34}">A (alt) →</text>
    <text class="m-ax" x="${X0 - 12}" y="${py(0) + 4}">0</text><text class="m-ax" x="${X0 - 12}" y="${py(1) + 4}">1</text>
    <text class="m-ax" x="${X0 - 24}" y="${Y0 + S / 2}" transform="rotate(-90 ${X0 - 24} ${Y0 + S / 2})">B (üst) →</text>`;
  COMBOS.forEach((x, i) => {
    const o = netForward(x, n, soft).o >= 0.5 ? 1 : 0,
      ok = o === XOR[i],
      cur = x[0] === st.x[0] && x[1] === st.x[1];
    if (cur) h += `<circle class="m-cur" cx="${px(x[0])}" cy="${py(x[1])}" r="17"/>`;
    h += `<circle class="m-ring ${ok ? 'ok' : 'bad'}" cx="${px(x[0])}" cy="${py(x[1])}" r="13"/><circle class="m-pt ${XOR[i] ? 'want' : 'nowant'}" cx="${px(x[0])}" cy="${py(x[1])}" r="8"/>`;
  });
  svg.innerHTML = h;
}

const patName = p => NET_PATTERNS[p] || p;
function hiddenDesc(n, soft) {
  return [0, 1].map(j => ({
    p: netPattern(n, soft, j),
    vals: COMBOS.map(x => netForward(x, n, soft).h[j])
  }));
}
function renderHidden(st, n, soft) {
  const sc = SCENARIOS.xor,
    hd = hiddenDesc(n, soft);
  $('#nhid').innerHTML =
    hd
      .map(
        (d, j) => `<div class="hid-row"><span class="hid-n h${j}">Ara ${j + 1}</span>
      <span class="hid-grid">${COMBOS.map((x, k) => {
        const v = d.vals[k];
        return `<span class="hg ${v >= 0.5 ? 'on' : ''}" style="--v:${v.toFixed(2)}" title="${esc(featTxt(sc, x))}: ${soft ? pct(v) : v ? 'ateşler' : 'susar'}">${sc.a[x[0] ? 'on' : 'off'].icon}${sc.b[x[1] ? 'on' : 'off'].icon}</span>`;
      }).join('')}</span>
      <span class="hid-t">${esc(patName(d.p))}</span></div>`
      )
      .join('') +
    `<p class="hint">Lamba: Ara 1’den ${sgn(n.V[0])}, Ara 2’den ${sgn(n.V[1])} alıyor, eşiği ${num(n.thO, soft ? 2 : 1)}.</p>`;
  const box = $('#ncmp');
  if (!st.flags.compared) {
    box.innerHTML = '';
    return;
  }
  const man = hiddenDesc(st.man, false),
    lrnOk = st.lrn && netSolves(st.lrn, true, XOR),
    manOk = netSolves(st.man, false, XOR);
  const lr = st.lrn ? hiddenDesc(st.lrn, true) : null;
  const set = a =>
      a
        .map(d => d.p)
        .sort()
        .join('|'),
    same = lr && set(man) === set(lr);
  box.innerHTML = `<table class="tt cmpnet"><thead><tr><th></th><th>Senin elle kurduğun</th><th>Makinenin öğrendiği</th></tr></thead><tbody>
    ${[0, 1].map(j => `<tr><td>Ara ${j + 1}</td><td>${esc(patName(man[j].p))}</td><td>${lr ? esc(patName(lr[j].p)) : '—'}</td></tr>`).join('')}
    <tr><td>Lamba doğru mu?</td><td>${manOk ? '✓ 4/4' : '✗'}</td><td>${lrnOk ? '✓ 4/4' : st.lrn ? '✗ henüz değil' : '—'}</td></tr></tbody></table>
    <p class="cmp-sum">${!lr ? 'Makine henüz öğrenmedi; “Makine öğrensin”e geç.' : !lrnOk ? 'Makine henüz öğrenmedi; öğretmeye devam et.' : !manOk ? 'Senin elle kurduğun ağ henüz lambayı doğru yakmıyor.' : same ? 'Makine senin bulduğun çözümün aynısını buldu: problemi aynı iki parçaya böldünüz.' : 'Makine başka bir yoldan gitti: ara nöronları senin seçtiğin parçaları değil, başka parçaları yakalıyor. İkisi de doğru; doğru cevaba giden tek bir yol yok.'}</p>`;
}

function netStepHTML(r) {
  const sc = SCENARIOS.xor,
    f = r.f,
    said = f.o >= 0.5 ? 'yansın' : 'sönsün',
    right = r.t ? 'yansın' : 'sönsün',
    b = r.before,
    a = r.after;
  const ch = [];
  [0, 1].forEach(j => {
    [0, 1].forEach(i => ch.push([`Ara ${j + 1} ← ${'AB'[i]}`, b.W[j][i], a.W[j][i]]));
    ch.push([`Ara ${j + 1} eşiği`, b.th[j], a.th[j]]);
    ch.push([`lamba ← Ara ${j + 1}`, b.V[j], a.V[j]]);
  });
  ch.push(['lamba eşiği', b.thO, a.thO]);
  const top = ch
    .filter(c => Math.abs(c[2] - c[1]) >= 0.005)
    .sort((p, q) => Math.abs(q[2] - q[1]) - Math.abs(p[2] - p[1]))
    .slice(0, 4);
  const big = Math.abs(r.err) >= 0.5,
    tiny = Math.abs(r.err) < 0.1;
  return stripHTML([
    {
      t: '1 · Tahmin',
      h: `${esc(featTxt(sc, r.x))}<br>Ara 1 ${pct(f.h[0])}, Ara 2 ${pct(f.h[1])}<br>→ lamba <b>${pct(f.o)}</b>: “${said}”`
    },
    {
      t: '2 · Karşılaştır',
      cls: big ? 'bad' : tiny ? 'ok' : '',
      h: `Doğrusu “${right}” (${r.t ? '%100' : '%0'}).<br>Hata <b>${r.err > 0 ? '+' : '−'}${num(Math.abs(r.err), 2)}</b>${tiny ? ': neredeyse doğru, küçük düzeltme' : big ? ': büyük yanılgı' : ''}.`
    },
    {
      t: '3 · Suçu paylaştır',
      h:
        [0, 1]
          .map(
            j =>
              `<div class="chg">Ara ${j + 1} payı: hata × bağlantı ${num(b.V[j], 1)} × eğim ${num(f.h[j] * (1 - f.h[j]), 2)} = <b>${r.blame[j] >= 0 ? '+' : '−'}${num(Math.abs(r.blame[j]), 3)}</b></div>`
          )
          .join('') +
        `<div class="chg same">Kararsız (%50’ye yakın) ara nöron daha çok pay alır.</div>`
    },
    {
      t: '4 · Düzelt',
      h: top.length
        ? top
            .map(
              c =>
                `<div class="chg ${c[2] > c[1] ? 'up' : 'down'}">${c[0]} <b>${num(c[1], 2)} → ${num(c[2], 2)}</b></div>`
            )
            .join('')
        : 'Değişiklikler çok küçük.'
    }
  ]);
}

function updateNetLearn(lv, rec, st, n) {
  const sc = SCENARIOS.xor,
    i = rec.cursor % 4,
    wrap = $('#ncard');
  let key;
  if (rec.last) {
    const r = rec.last;
    wrap.innerHTML = cardHTML(sc, r.x, r.t, r.f.o >= 0.5 ? 1 : 0, 'Öğretmenin kartı');
    key = 'c' + rec.cardSeq;
    if (key !== nLastCard) $('#nstep').innerHTML = netStepHTML(r);
  } else {
    wrap.innerHTML = cardHTML(sc, COMBOS[i], XOR[i], null, 'Sıradaki kart');
    key = 'n' + i;
    $('#nstep').innerHTML =
      `<div class="ph-box empty"><div class="ph-b">Henüz kart gösterilmedi. <b>“Bir kart göster”</b>e bas: lamba tahmin eder, hatası ara nöronlara bağlantıları oranında paylaştırılır ve herkes kendi payına göre düzeltilir. Birkaç yüz kart gerekebilir; o zaman <b>“Otomatik”</b>e bas.</div></div>`;
  }
  if (key !== nLastCard && !nAuto && !reducedMotion) wrap.firstElementChild.classList.add('deal');
  nLastCard = key;
  $('#nInfo').textContent =
    `${st.fromZero ? 'Tamamen sıfırdan' : 'Rastgele başlangıç ' + (NET_SEEDS.indexOf(st.seed) + 1)}, ${rec.rounds ? rec.rounds.length : 0} tur. Sıradaki kart: ${featTxt(sc, COMBOS[i])}.`;
  const rs = rec.rounds || [],
    svg = $('#nrounds'),
    cnt = Math.max(40, rs.length),
    dx = 400 / (cnt - 1 || 1);
  let h = '';
  for (const y of [0.25, 0.5, 0.75])
    h += `<line class="r-grid" x1="0" x2="400" y1="${60 - y * 56}" y2="${60 - y * 56}"/>`;
  if (rs.length > 1)
    h += `<polyline class="r-line" points="${rs.map((v, k) => `${(k * dx).toFixed(1)},${(60 - v * 56).toFixed(1)}`).join(' ')}"/>`;
  svg.innerHTML = h;
  $('#nRoundsN').textContent = rs.length ? `${rs.length} tur` : '';
  const last = rs[rs.length - 1];
  $('#nRoundsHint').textContent = !rs.length
    ? 'Her tur dört kart: lambanın doğru cevaptan ortalama ne kadar uzak olduğu (0 = kusursuz).'
    : st.fromZero && rs.length >= 50
      ? `Ortalama hata ${num(last, 2)} civarında takılı kaldı: iki ara nöron ikiz.`
      : `Son turda ortalama hata ${num(last, 2)}.`;
}
