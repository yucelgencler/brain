'use strict';
/* ------------------------------------------------------------------
   SEVİYE 15 görünümü: Unutma ve uyku
   Solda günler ve uyku ayarı; ortada üç şeklin hatırlanma oranı
   (gündüz açık, gece koyu zeminde canlı çizgi); sağda şu anki hafıza.
   Model: js/levels/15-sleep.js
------------------------------------------------------------------- */
let slN = null,
  slD = null,
  slRnd = null,
  slRaf = 0,
  slHist = [], // [{s, acc:[a0,a1,a2], kind}]
  slPhase = null, // canlandırılan evre
  slStepN = 0;
const SL_COL = ['--pos', '--neg', '--held'];
function sleepStop() {
  cancelAnimationFrame(slRaf);
  slRaf = 0;
  slPhase = null;
}
function sleepResetView() {
  sleepStop();
  slN = null;
  slHist = [];
  slStepN = 0;
}
function slFresh(st) {
  sleepStop();
  slN = slNet();
  slD = slData(9);
  slRnd = mulberry32(1 + st.results.length);
  slHist = [{ s: 0, acc: slAcc(slN, slD), kind: 'start' }];
  slStepN = 0;
  st.stage = 0;
  st.acc = slHist[0].acc;
}
function sleepGridHTML(lv) {
  return `<section class="bench sl-bench">
    <div class="panel sl-ctl">
      <div class="ph"><h3>Günler</h3><span class="pc" id="slStage"></span></div>
      <button class="btn primary" id="slDay1">☀ 1. günü yaşa <small>artı ve çarpı</small></button>
      <button class="btn primary" id="slDay2" data-lay="day2">☀ 2. günü yaşa <small>yalnız kare</small></button>
      <div class="sl-sleep" data-lay="sleep">
        <button class="btn" id="slSleep" aria-pressed="false"></button>
        <label class="ctl" id="slRepL" data-lay="rep">Gece tekrarı <input type="range" id="slRep" min="1" max="12" step="1" /><output id="slRepOut"></output></label>
      </div>
      <button class="btn ghost" id="slReset" data-lay="sleep">↺ Baştan al</button>
      <p class="hint" id="slNow" aria-live="polite"></p>
    </div>
    <div class="panel sl-chart">
      <div class="ph"><h3>Hangi şekli ne kadar hatırlıyor?</h3><span class="pc">açık zemin gündüz, koyu zemin gece</span></div>
      <canvas id="slCanvas" role="img" aria-label="Eğitim boyunca artı, çarpı ve kareyi doğru tanıma oranları"></canvas>
      <p class="hint sh-leg">${SLEEP.names.map((n, i) => `<span style="color:var(${SL_COL[i]})">━ ${n}</span>`).join(' ')}</p>
    </div>
    <div class="panel sl-memp" id="slMem"></div>
  </section>
  <section class="panel sl-res" data-lay="log"><div class="ph"><h3>Denemelerin</h3><span class="pc">2. günün sonunda</span></div><div class="llog-wrap"><table class="tt" id="slLog"></table></div></section>`;
}
function wireSleep(lv) {
  const st = R().st;
  slFresh(st);
  $('#slRep').value = st.replay;
  $('#slRep').oninput = e => {
    st.replay = +e.target.value;
    refresh();
  };
  $('#slSleep').onclick = () => {
    if (slRaf) return;
    st.sleep = !st.sleep;
    refresh();
  };
  $('#slReset').onclick = () => {
    slFresh(st);
    refresh();
  };
  const run = day => {
    if (slRaf) return;
    if (day === 2 && st.stage < 1) return toast('Önce 1. günü yaşa.');
    if (day === 1 && st.stage > 0) slFresh(st);
    if (day === 2 && st.stage === 2)
      return toast('2. gün bitti. Yeniden denemek için “Baştan al”.');
    const plan = slPlan(day, st.sleep);
    let pi = 0,
      k = 0,
      tick = 0;
    const loop = () => {
      const ph = plan[pi];
      slPhase = ph;
      // her iki karede bir öğrenme adımı: göz takip edebilsin
      if (++tick % 2 === 0 || reducedMotion) {
        if (ph.kind === 'day1') slStep(slN, slD.d1, slRnd);
        else if (ph.kind === 'day') slStep(slN, slD.d2, slRnd);
        else slStep(slN, slD.d2, slRnd, slD.d1, st.replay);
        k++;
        slStepN++;
        if (slStepN % 3 === 0) {
          slHist.push({ s: slStepN, acc: slAcc(slN, slD), kind: ph.kind });
          st.acc = slHist[slHist.length - 1].acc;
          drawSleep();
          updateSleepNow(st);
        }
      }
      if (k >= ph.n) {
        k = 0;
        pi++;
      }
      if (pi >= plan.length) {
        slRaf = 0;
        slPhase = null;
        const acc = slAcc(slN, slD);
        slHist.push({ s: slStepN, acc, kind: 'end' });
        slRecord(st, day, acc);
        refresh();
        return;
      }
      slRaf = requestAnimationFrame(loop);
    };
    slRaf = requestAnimationFrame(loop);
    refresh();
  };
  $('#slDay1').onclick = () => run(1);
  $('#slDay2').onclick = () => run(2);
}
function drawSleep() {
  const cv = document.getElementById('slCanvas');
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth || 400,
    H = 230;
  cv.style.height = H + 'px';
  cv.width = W * dpr;
  cv.height = H * dpr;
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const total = SLEEP.day1 + SLEEP.cycles * (SLEEP.day + SLEEP.night),
    L = 34,
    T = 10,
    B = 22,
    X = s => L + ((W - L - 8) * s) / total,
    Y = v => T + (H - T - B) * (1 - v);
  // zemin: gündüz / gece şeritleri (geçmişteki evrelere göre)
  let prev = slHist[0];
  for (const h of slHist.slice(1)) {
    x.fillStyle = h.kind === 'night' ? 'rgba(20,24,60,.16)' : 'rgba(255,210,122,.16)';
    x.fillRect(X(prev.s), T, X(h.s) - X(prev.s), H - T - B);
    prev = h;
  }
  x.strokeStyle = shCss('--line');
  x.fillStyle = shCss('--ink-2');
  x.font = '11px "IBM Plex Sans", system-ui, sans-serif';
  [0, 0.5, 1].forEach(v => {
    x.beginPath();
    x.moveTo(L, Y(v));
    x.lineTo(W - 8, Y(v));
    x.stroke();
    x.fillText('%' + v * 100, 2, Y(v) + 4);
  });
  x.fillText('1. gün', X(SLEEP.day1 / 2) - 14, H - 6);
  x.fillText('2. gün', X(SLEEP.day1 + (total - SLEEP.day1) / 2) - 14, H - 6);
  x.beginPath();
  x.moveTo(X(SLEEP.day1), T);
  x.lineTo(X(SLEEP.day1), H - B);
  x.stroke();
  SLEEP.names.forEach((n, i) => {
    x.strokeStyle = shCss(SL_COL[i]);
    x.lineWidth = 2.4;
    x.beginPath();
    slHist.forEach((h, k) => (k ? x.lineTo(X(h.s), Y(h.acc[i])) : x.moveTo(X(h.s), Y(h.acc[i]))));
    x.stroke();
  });
}
function updateSleepNow(st) {
  const el = document.getElementById('slNow');
  if (!el) return;
  el.textContent = slPhase
    ? {
        day1: '☀ 1. gün: artı ve çarpı görülüyor.',
        day: '☀ Gündüz: yalnız kare görülüyor.',
        night: `🌙 Gece: hipokampus günün karelerini eski artı ve çarpılarla karıştırıp tekrar oynatıyor (her 12 yeniye ${st.replay} eski).`
      }[slPhase.kind]
    : st.stage === 0
      ? 'Ağ henüz hiçbir şey görmedi.'
      : st.stage === 1
        ? '1. gün bitti. Uykuyu seç ve 2. günü yaşa.'
        : '2. gün bitti. Sağdaki hafızaya bak; yeniden denemek için “Baştan al”.';
  const mem = document.getElementById('slMem');
  if (mem)
    mem.innerHTML = `<div class="ph"><h3>Şu an hatırladığı</h3></div>${SLEEP.names
      .map(
        (n, i) =>
          `<div class="sl-mem">${shMini(SLEEP.protos[i], 6)}<b>${n}</b><span class="sh-bt"><i style="width:${Math.round(st.acc[i] * 100)}%;background:var(${SL_COL[i]})"></i></span><span class="wh-mv">%${Math.round(st.acc[i] * 100)}</span></div>`
      )
      .join(
        ''
      )}<p class="hint">Her şekilden hiç görmediği 20 çizimin yüzde kaçını doğru tanıyor.</p>`;
}
function slSuggest(lv, rec) {
  const st = rec.st,
    act = curMission(lv, rec);
  if (slRaf) return [];
  if (act === 'day1') return [st.stage === 0 ? 'slDay1' : 'slReset'];
  if (act === 'forget')
    return st.stage === 2
      ? ['slReset']
      : st.sleep
        ? ['slSleep']
        : st.stage === 0
          ? ['slDay1']
          : ['slDay2'];
  if (act === 'sleep' || act === 'little') {
    if (act === 'little' && st.replay > 1) return ['slRepL'];
    if (st.stage === 2) return ['slReset'];
    if (!st.sleep) return ['slSleep'];
    return [st.stage === 0 ? 'slDay1' : 'slDay2'];
  }
  return [];
}
function updateSleep(lv, rec) {
  const st = rec.st,
    sug = slSuggest(lv, rec),
    busy = !!slRaf;
  if (!slN) slFresh(st);
  $('#slStage').textContent = ['başlamadı', '1. gün bitti', '2. gün bitti'][st.stage];
  $('#slDay1').disabled = busy;
  $('#slDay2').disabled = busy || st.stage !== 1;
  $('#slSleep').disabled = busy;
  $('#slSleep').textContent = st.sleep ? '🌙 Uyku: açık' : '🚫 Uyku: kapalı';
  $('#slSleep').setAttribute('aria-pressed', String(st.sleep));
  $('#slRep').disabled = busy || !st.sleep;
  $('#slRepOut').textContent = `her 12 yeniye ${st.replay} eski`;
  for (const id of ['slDay1', 'slDay2', 'slSleep', 'slReset', 'slRepL'])
    $('#' + id).classList.toggle('psug', sug.includes(id));
  drawSleep();
  updateSleepNow(st);
  $('#slLog').innerHTML = st.results.length
    ? `<thead><tr><th>uyku</th><th>gece tekrarı</th>${SLEEP.names.map(n => `<th>${n}</th>`).join('')}</tr></thead><tbody>${st.results
        .map(
          r =>
            `<tr><td>${r.sleep ? '🌙 açık' : '🚫 kapalı'}</td><td>${r.sleep ? r.replay + ' / 12' : '–'}</td>${r.acc.map(a => `<td class="${a >= 0.8 ? 'ok' : a < 0.5 ? 'bad' : ''}">%${Math.round(a * 100)}</td>`).join('')}</tr>`
        )
        .join('')}</tbody>`
    : `<tbody><tr><td class="hint">Her denemenin sonucu buraya yazılır: uykulu ve uykusuz günleri karşılaştır.</td></tr></tbody>`;
}
