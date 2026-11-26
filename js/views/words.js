'use strict';
/* ------------------------------------------------------------------
   SEVİYE 16 görünümü: Kelimelerin anlamı
   Solda kelimeler, yeni kelime ve soru; ortada anlam haritası (ara nöron
   desenlerinin iki boyuta inmiş hâli); sağda seçili kelimenin iç deseni
   ve komşuları. Model: js/levels/16-words.js
------------------------------------------------------------------- */
let wdNet = null,
  wdList = null,
  wdRaf = 0,
  wdComps = null,
  wdPts = [];
const WD_COL = ['--pos', '--ok', '--neg', '--held'];
function wordsStop() {
  cancelAnimationFrame(wdRaf);
  wdRaf = 0;
}
function wordsResetView() {
  wordsStop();
  wdNet = null;
  wdComps = null;
}
function wdBuild(st, keep) {
  const list = wordsList(st);
  if (keep && wdNet && wdList)
    wdNet = wdNet.resized(
      wdList.map(p => p.w),
      list.map(p => p.w),
      WORDS.cats,
      WORDS.cats,
      3
    );
  else {
    wdNet = wordsNet(list.length);
    st.steps = 0;
  }
  wdList = list;
}
function wordsGridHTML(lv) {
  return `<section class="bench wd-bench">
    <div class="panel wd-left">
      <div class="ph"><h3>Kelimeler</h3><span class="pc" id="wdN"></span></div>
      <div class="wd-chips" id="wdChips"></div>
      <div class="wd-form">
        <label for="wdNewW">Yeni kelime öğret</label>
        <div class="wd-row"><input id="wdNewW" placeholder="ör. zürafa" maxlength="14" autocomplete="off" />
          <select id="wdNewC" aria-label="Türü">${WORDS.cats.map(c => `<option>${c}</option>`).join('')}</select>
          <button class="btn small" id="wdAdd">Öğret</button></div>
      </div>
      <div class="wd-form">
        <label for="wdAskW">Bir kelime sor</label>
        <div class="wd-row"><input id="wdAskW" placeholder="ör. kaplan" maxlength="14" autocomplete="off" /><button class="btn small" id="wdAsk">Sor</button></div>
        <p class="wd-askres" id="wdAskRes" aria-live="polite"></p>
      </div>
    </div>
    <div class="panel wd-map">
      <div class="ph"><h3>Anlam haritası</h3><span class="pc" id="wdSub"></span></div>
      <canvas id="wdCanvas" role="img" aria-label="Kelimelerin ara nöron desenlerine göre yerleştiği harita; yakın duranlar benzer"></canvas>
      <div class="wd-ctl"><button class="btn primary" id="wdTrain">▶ Eğit</button><button class="btn ghost" id="wdReset">↺ Boş ağla başla</button>
        <span class="hint wd-leg">${WORDS.cats.map((c, i) => `<span style="color:var(${WD_COL[i]})">● ${c}</span>`).join(' ')}</span></div>
    </div>
    <div class="panel wd-sel" id="wdSel" aria-live="polite"></div>
  </section>`;
}
function wireWords(lv) {
  const st = R().st;
  wdBuild(st);
  $('#wdTrain').onclick = () => {
    if (wdRaf) return;
    let k = 0;
    const loop = () => {
      wordsTrain(wdNet, wdList, 1);
      st.steps++;
      k++;
      if (k % 3 === 0) drawWords(st);
      if (k >= 150) {
        wdRaf = 0;
        wordsRecord(st, wdNet, st.sel);
        refresh();
        return;
      }
      wdRaf = requestAnimationFrame(loop);
    };
    wdRaf = requestAnimationFrame(loop);
    refresh();
  };
  $('#wdReset').onclick = () => {
    wordsStop();
    wdBuild(st);
    wdComps = null;
    st.sel = null;
    toast('Boş ağ: hiçbir kelimenin anlamını bilmiyor.');
    refresh();
  };
  $('#wdAdd').onclick = () => {
    const w = $('#wdNewW').value.trim().toLocaleLowerCase('tr-TR'),
      c = $('#wdNewC').value;
    if (!w) return toast('Önce bir kelime yaz.');
    if (wordsList(st).some(p => p.w === w)) return toast('Bu kelimeyi zaten biliyor.');
    st.custom.push({ w, c });
    $('#wdNewW').value = '';
    wdBuild(st, true);
    st.sel = wdList.length - 1;
    toast(`“${w}” için yeni bir nöron eklendi. Şimdi yeniden eğit.`);
    refresh();
  };
  $('#wdAsk').onclick = () => {
    const w = $('#wdAskW').value.trim();
    if (!w) return toast('Önce bir kelime yaz.');
    st.ask = wordsAsk(st, wdNet, w);
    if (st.ask.known) st.sel = st.ask.i;
    refresh();
  };
  $('#wdAskW').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#wdAsk').click();
  });
  $('#wdNewW').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#wdAdd').click();
  });
  $('#wdChips').addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (b) wdSelect(st, +b.dataset.i);
  });
  $('#wdCanvas').addEventListener('click', e => {
    const r = e.target.getBoundingClientRect(),
      x = e.clientX - r.left,
      y = e.clientY - r.top;
    let best = -1,
      bd = 22;
    wdPts.forEach((p, i) => {
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) wdSelect(st, best);
  });
}
function wdSelect(st, i) {
  st.sel = i;
  wordsRecord(st, wdNet, i);
  refresh();
}
function drawWords(st) {
  const cv = document.getElementById('wdCanvas');
  if (!cv || !wdNet) return;
  const dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth || 400,
    H = 340;
  cv.style.height = H + 'px';
  cv.width = W * dpr;
  cv.height = H * dpr;
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const Hd = wordsHidden(wdNet, wdList),
    pc = pca2(Hd, wdComps);
  wdComps = pc.comps;
  const P = pc.proj;
  let mx = 1e-6;
  for (const p of P) mx = Math.max(mx, Math.abs(p[0]), Math.abs(p[1]));
  wdPts = P.map(p => [W / 2 + (p[0] / mx) * (W / 2 - 60), H / 2 - (p[1] / mx) * (H / 2 - 28)]);
  x.font = '13px "IBM Plex Sans", system-ui, sans-serif';
  x.textBaseline = 'middle';
  // etiketler üst üste binmesin: yakın noktaların adlarını alt alta diz
  const placed = [],
    ly = wdPts.map(() => 0);
  wdPts
    .map((p, i) => i)
    .sort((a, b) => wdPts[a][1] - wdPts[b][1])
    .forEach(i => {
      let y = wdPts[i][1];
      const w = x.measureText(wdList[i].w).width + 14;
      for (let guard = 0; guard < 40; guard++) {
        const hit = placed.find(
          q => Math.abs(q.x - wdPts[i][0]) < Math.max(w, q.w) && Math.abs(q.y - y) < 15
        );
        if (!hit) break;
        y = hit.y + 15;
      }
      placed.push({ x: wdPts[i][0], y, w });
      ly[i] = y;
    });
  wdList.forEach((p, i) => {
    const [px, py] = wdPts[i],
      ci = WORDS.cats.indexOf(p.c),
      sel = i === st.sel;
    x.fillStyle = shCss(WD_COL[ci]);
    x.beginPath();
    x.arc(px, py, sel ? 8 : 6, 0, 7);
    x.fill();
    if (sel) {
      x.strokeStyle = shCss('--ink');
      x.lineWidth = 2;
      x.stroke();
    }
    x.fillStyle = shCss(sel ? '--ink' : '--ink-2');
    x.font = `${sel ? 600 : 400} 13px "IBM Plex Sans", system-ui, sans-serif`;
    if (Math.abs(ly[i] - py) > 1) {
      x.strokeStyle = shCss('--line');
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(px + 6, py);
      x.lineTo(px + 10, ly[i]);
      x.stroke();
    }
    x.fillText(p.w, px + 12, ly[i]);
  });
}
function wdSuggest(lv, rec) {
  const st = rec.st,
    act = curMission(lv, rec);
  if (wdRaf) return [];
  if (act === 'train') return ['wdTrain'];
  if (act === 'near') return st.flags.trained ? ['wdCanvas'] : ['wdTrain'];
  if (act === 'new') {
    if (!st.custom.length) return ['wdNewW'];
    if (wordsAccuracy(wdNet, wdList) < 1) return ['wdTrain'];
    return ['wdCanvas'];
  }
  if (act === 'unknown') return ['wdAskW'];
  return [];
}
function updateWords(lv, rec) {
  const st = rec.st;
  if (!wdNet) wdBuild(st);
  if (wdList.length !== wordsList(st).length) wdBuild(st, true);
  const sug = wdSuggest(lv, rec);
  $('#wdN').textContent = `${wdList.length} kelime`;
  $('#wdChips').innerHTML = wdList
    .map(
      (p, i) =>
        `<button class="wd-chip ${i === st.sel ? 'on' : ''}" data-i="${i}" style="--c:var(${WD_COL[WORDS.cats.indexOf(p.c)]})">${esc(p.w)}</button>`
    )
    .join('');
  $('#wdTrain').classList.toggle('psug', sug.includes('wdTrain'));
  $('#wdTrain').disabled = !!wdRaf;
  $('#wdCanvas').classList.toggle('psugc', sug.includes('wdCanvas'));
  $('#wdNewW').closest('.wd-form').classList.toggle('psugc', sug.includes('wdNewW'));
  $('#wdAskW').closest('.wd-form').classList.toggle('psugc', sug.includes('wdAskW'));
  const acc = wordsAccuracy(wdNet, wdList),
    cl = wordsClustering(wdNet, wdList);
  $('#wdSub').textContent = `${st.steps} eğitim adımı · doğru bilinen %${Math.round(acc * 100)}`;
  drawWords(st);
  // sor sonucu
  const A = st.ask;
  $('#wdAskRes').innerHTML = !A
    ? ''
    : A.known
      ? `“${esc(A.w)}” → <b>${A.cat}</b> (%${Math.round(A.p * 100)})${A.cat === A.truth ? ' ✓' : ` ✗ (aslında ${A.truth})`}`
      : `“${esc(A.w)}” → <b>Bu kelimeyi hiç duymadım.</b> Onun için ağda bir nöron yok.`;
  // seçili kelime
  const box = $('#wdSel');
  if (st.sel == null || !wdList[st.sel]) {
    box.innerHTML = `<div class="ph"><h3>Seçili kelime</h3></div><p class="hint">Haritadan ya da listeden bir kelimeye tıkla: ağın ona ne dediğini, ara nöronlardaki desenini ve en yakın komşularını görürsün.</p>
      <p class="hint">Aynı türden kelimelerin ortalama benzerliği: <b>%${Math.round(cl.same * 100)}</b> · farklı türden: <b>%${Math.round(cl.diff * 100)}</b></p>`;
    return;
  }
  const p = wdList[st.sel],
    out = Array.from(wdNet.predict(wordsOneHot(st.sel, wdList.length))),
    g = out.indexOf(Math.max(...out)),
    hid = wordsHidden(wdNet, wdList)[st.sel],
    nb = wordsNeighbors(wdNet, wdList, st.sel, wdList.length - 1);
  box.innerHTML = `<div class="ph"><h3>“${esc(p.w)}”</h3><span class="pc">${WORDS.icons[WORDS.cats.indexOf(p.c)]} ${p.c}</span></div>
    <div class="ans-l">Ağın cevabı</div><div class="wd-ans">${WORDS.icons[g]} ${WORDS.cats[g]} <small>%${Math.round(out[g] * 100)}</small></div>
    <div class="ans-l">Ara nöronlardaki iç deseni</div>
    <div class="wd-pat">${hid.map(v => `<span title="${num(v, 2)}" style="background:color-mix(in srgb, var(${v >= 0 ? '--pos' : '--neg'}) ${Math.round(Math.abs(v) * 100)}%, var(--surface-2))"></span>`).join('')}</div>
    <div class="ans-l">En yakın komşuları</div>
    <ol class="wd-nb">${nb
      .slice(0, 3)
      .map(
        o =>
          `<li><span style="color:var(${WD_COL[WORDS.cats.indexOf(o.c)]})">●</span> ${esc(o.w)} <b>%${Math.round(o.sim * 100)}</b></li>`
      )
      .join('')}</ol>
    <p class="hint">En uzağı: ${esc(nb[nb.length - 1].w)} (%${Math.round(nb[nb.length - 1].sim * 100)})</p>`;
}
