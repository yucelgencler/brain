'use strict';
/* ------------------------------------------------------------------
   SEVİYE 17 görünümü: Okumak
   Solda yazı kutusu ve hazır denemeler; ortada gözün gördüğü piksel
   resmi ve eğitim; sağda ağın cevabı; altta son sorular.
   Model: js/levels/17-read.js
------------------------------------------------------------------- */
let rdNet = null,
  rdRaf = 0,
  rdProg = 0;
function readStop() {
  cancelAnimationFrame(rdRaf);
  rdRaf = 0;
}
function readResetView() {
  readStop();
  rdNet = null;
}
function readGridHTML(lv) {
  const tries = ['elme', 'mavy', 'ankra', 'kediler', 'elmalar'];
  return `<section class="bench rd-bench">
    <div class="panel rd-left">
      <div class="ph"><h3>Yaz ve sor</h3><span class="pc">bilinen 14 kelime</span></div>
      <div class="wd-row"><input id="rdText" maxlength="8" autocomplete="off" aria-label="Kelime" /><button class="btn primary" id="rdAsk">Sor</button></div>
      <div class="rd-shift"><span class="hint">Kaydır:</span><button class="btn small" id="rdL" aria-label="Bir harf sola">←</button><output id="rdShiftOut"></output><button class="btn small" id="rdR" aria-label="Bir harf sağa">→</button></div>
      <span class="hint">Dene:</span>
      <div class="rd-tries">${tries.map(t => `<button class="btn small" data-t="${t}">${t}</button>`).join('')}</div>
      <span class="hint">Bildiği kelimeler:</span>
      <div class="rd-known" id="rdKnown"></div>
    </div>
    <div class="panel rd-eye">
      <div class="ph"><h3>Gözün gördüğü</h3><span class="pc">6 × 31 = 186 göz nöronu</span></div>
      <canvas id="rdCanvas" role="img" aria-label="Kelimenin piksel resmi"></canvas>
      <div class="rd-train">
        <button class="btn primary" id="rdTrain">▶ Eğit</button>
        <label class="ctl" id="rdAugL"><input type="checkbox" id="rdAug" /> Farklı yerlerde de göster</label>
        <span class="rd-prog"><i id="rdProg"></i></span>
      </div>
      <p class="hint" id="rdStatus"></p>
    </div>
    <div class="panel rd-ans" id="rdAns" aria-live="polite"></div>
  </section>
  <section class="panel rd-logp"><div class="ph"><h3>Son sorular</h3></div><div class="llog-wrap"><table class="tt" id="rdLog"></table></div></section>`;
}
function wireRead(lv) {
  const st = R().st;
  rdNet = readNet();
  st.trained = 0;
  $('#rdText').value = st.text;
  $('#rdText').addEventListener('input', e => {
    st.text = e.target.value;
    refresh();
  });
  $('#rdText').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#rdAsk').click();
  });
  $('#rdAsk').onclick = () => {
    if (!st.text.trim()) return toast('Önce bir kelime yaz.');
    if (!st.trained) return toast('Önce Eğit’e bas: ağ henüz okumayı bilmiyor.');
    readAsk(st, rdNet, st.text, st.shift);
    refresh();
  };
  $('#rdL').onclick = () => {
    st.shift = Math.max(-4, st.shift - 4);
    refresh();
  };
  $('#rdR').onclick = () => {
    st.shift = Math.min(8, st.shift + 4);
    refresh();
  };
  $('.rd-tries').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    st.text = b.dataset.t;
    st.shift = 0;
    $('#rdText').value = st.text;
    refresh();
  });
  $('#rdKnown').addEventListener('click', e => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    st.text = b.dataset.t;
    $('#rdText').value = st.text;
    refresh();
  });
  $('#rdAug').checked = st.aug;
  $('#rdAug').onchange = e => {
    st.aug = e.target.checked;
    refresh();
  };
  $('#rdTrain').onclick = () => {
    if (rdRaf) return;
    rdNet = readNet();
    const aug = st.aug,
      data = readData(aug, 5),
      total = aug ? READ.aug : READ.plain,
      rnd = mulberry32(5);
    let done = 0;
    const loop = () => {
      const n = Math.min(20, total - done);
      readTrain(rdNet, data, n, rnd);
      done += n;
      rdProg = done / total;
      $('#rdProg').style.width = Math.round(rdProg * 100) + '%';
      if (done >= total) {
        rdRaf = 0;
        st.trained = aug ? 2 : 1;
        st.log = [];
        st.last = null;
        toast(
          aug
            ? 'Kelimeleri farklı yerlerde de görerek öğrendi.'
            : 'Kelimeleri hep aynı yerde görerek öğrendi.'
        );
        refresh();
        return;
      }
      rdRaf = requestAnimationFrame(loop);
    };
    rdRaf = requestAnimationFrame(loop);
    refresh();
  };
}
function drawRead(st) {
  const cv = document.getElementById('rdCanvas');
  if (!cv) return;
  const bits = readBits(st.text || '', st.shift),
    dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth || 400,
    c = Math.min(16, (W - 4) / READ.cols),
    H = c * READ.rows + 4;
  cv.style.height = H + 'px';
  cv.width = W * dpr;
  cv.height = H * dpr;
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const ox = (W - c * READ.cols) / 2;
  for (let r = 0; r < READ.rows; r++)
    for (let k = 0; k < READ.cols; k++) {
      x.fillStyle = bits[r * READ.cols + k] ? shCss('--node-on') : shCss('--surface-2');
      x.fillRect(ox + k * c + 1, 2 + r * c + 1, c - 2, c - 2);
    }
}
function rdSuggest(lv, rec) {
  const st = rec.st,
    act = rec.done.length === lv.missions.length ? null : rec.active,
    L = readList(),
    w = (st.text || '').toLocaleLowerCase('tr-TR').trim(),
    known = L.some(p => p.w === w),
    asked = st.last && st.last.w === w && st.last.shift === st.shift;
  if (rdRaf) return [];
  if (act === 'train') return ['rdTrain'];
  if (!st.trained) return ['rdTrain'];
  if (act === 'typo')
    return w === 'elme' || w === 'mavy' || w === 'ankra' ? (asked ? [] : ['rdAsk']) : ['try-elme'];
  if (act === 'suffix')
    return w === 'kediler' || w === 'elmalar' ? (asked ? [] : ['rdAsk']) : ['try-kediler'];
  if (act === 'shift') {
    if (!known) return ['known'];
    if (st.shift === 0) return ['rdR'];
    return asked ? ['rdR'] : ['rdAsk'];
  }
  if (act === 'fix') {
    if (!st.aug) return ['rdAugL'];
    if (st.trained !== 2) return ['rdTrain'];
    if (!known) return ['known'];
    if (st.shift === 0) return ['rdR'];
    return ['rdAsk'];
  }
  return [];
}
function updateRead(lv, rec) {
  const st = rec.st,
    sug = rdSuggest(lv, rec);
  if (!rdNet) rdNet = readNet();
  $('#rdShiftOut').textContent =
    st.shift === 0 ? 'yerinde' : `${st.shift > 0 ? '+' : ''}${st.shift / 4} harf`;
  $('#rdKnown').innerHTML = readList()
    .map(
      p =>
        `<button class="wd-chip ${sug.includes('known') && p.w === 'kedi' ? 'psug' : ''}" data-t="${p.w}">${p.w}</button>`
    )
    .join('');
  document
    .querySelectorAll('.rd-tries [data-t]')
    .forEach(b => b.classList.toggle('psug', sug.includes('try-' + b.dataset.t)));
  for (const id of ['rdTrain', 'rdAsk', 'rdR', 'rdAugL'])
    $('#' + id).classList.toggle('psug', sug.includes(id));
  $('#rdTrain').disabled = !!rdRaf;
  $('#rdAug').disabled = !!rdRaf;
  if (!rdRaf) $('#rdProg').style.width = st.trained ? '100%' : '0%';
  $('#rdStatus').textContent = !st.trained
    ? 'Ağ henüz okumayı bilmiyor.'
    : `Bildiği kelimeler: yerinde %${Math.round(readAccuracy(rdNet, 0) * 100)} · bir harf kayınca %${Math.round(readAccuracy(rdNet, 4) * 100)}${st.trained === 2 ? ' (farklı yerlerde de görerek öğrendi)' : ''}`;
  drawRead(st);
  // cevap: yazılan kelimeye şu an ne derdi?
  const box = $('#rdAns'),
    w = (st.text || '').trim();
  if (!st.trained || !w) {
    box.innerHTML = `<div class="ans-l">Ağın cevabı</div><div class="sh-verdict">${!w ? 'Bir kelime yaz.' : 'Önce eğit.'}</div>`;
  } else {
    const out = Array.from(rdNet.predict(readBits(w, st.shift))),
      g = out.indexOf(Math.max(...out));
    const L =
      st.last && st.last.w === w.toLocaleLowerCase('tr-TR') && st.last.shift === st.shift
        ? st.last
        : null;
    box.innerHTML = `<div class="ans-l">Ağın cevabı</div><div class="sh-verdict">“${esc(w)}” bir ${READ.cats[g]}${out[g] < 0.6 ? ' mi?' : '.'}</div>
      <div class="sh-bars">${READ.cats.map((c, i) => `<div class="sh-bar ${i === g ? 'top' : ''}"><span class="sh-bl">${c}</span><span class="sh-bt"><i style="width:${Math.round(out[i] * 100)}%"></i></span><span class="sh-bv">%${Math.round(out[i] * 100)}</span></div>`).join('')}</div>
      ${L && L.truth ? `<p class="sh-res ${L.cat === L.truth ? 'ok' : 'bad'}">${L.cat === L.truth ? '✓ Doğru' : `✗ Aslında ${L.truth}`}${L.twin ? ` (“${L.twin}” yanlış yazılmış)` : L.stem ? ` (“${L.stem}” + ek)` : L.shift ? ' (kaydırılmış)' : ''}</p>` : ''}`;
  }
  $('#rdLog').innerHTML = st.log.length
    ? `<thead><tr><th>yazılan</th><th>kayma</th><th>ağın cevabı</th><th>aslında</th></tr></thead><tbody>${st.log
        .map(
          r =>
            `<tr><td>${esc(r.w)}</td><td>${r.shift ? r.shift / 4 + ' harf' : '–'}</td><td class="${r.truth ? (r.cat === r.truth ? 'ok' : 'bad') : ''}">${r.cat} (%${Math.round(r.p * 100)})</td><td>${r.truth || 'bilinmiyor'}</td></tr>`
        )
        .join('')}</tbody>`
    : `<tbody><tr><td class="hint">Sor’a bastıkça her deneme buraya yazılır.</td></tr></tbody>`;
}
