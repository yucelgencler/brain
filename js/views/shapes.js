'use strict';
/* ------------------------------------------------------------------
   SEVİYE 10 görünümü: şekil ve rakam tanıma (basit + gelişmiş mod).
   Model ve görevler: js/levels/10-shapes.js. Ağ: core.js Net.
   Tezgâh: göz (çizilebilir 5×7) → nöron ağı (canlı çizim) → cevap.
------------------------------------------------------------------- */
let shNet = null, // basit mod ağı
  shAdv = null, // { net, ds, rnd, steps, curve: [{s, tr, te}], loss }
  shRaf = 0,
  shPaint = null,
  shResizeOn = false;

function shapesStop() {
  cancelAnimationFrame(shRaf);
  shRaf = 0;
  const b = document.getElementById('shTrain');
  if (b) {
    b.textContent = '▶ Eğit';
    b.setAttribute('aria-pressed', 'false');
  }
}
function shapesResetView() {
  shapesStop();
  shNet = null;
  shAdv = null;
}
const shPct = v => '%' + Math.round(v * 100);
const shArgmax = a => a.reduce((b, v, i) => (v > a[b] ? i : b), 0);
function shMini(bits, cell) {
  const c = cell || 6;
  let h = `<svg class="sh-mini" viewBox="0 0 ${5 * c} ${7 * c}" width="${5 * c}" height="${7 * c}" aria-hidden="true">`;
  bits.forEach((b, i) => {
    h += `<rect x="${(i % 5) * c + 0.5}" y="${Math.floor(i / 5) * c + 0.5}" width="${c - 1}" height="${c - 1}" rx="1" class="${b ? 'on' : ''}"/>`;
  });
  return h + '</svg>';
}

/* ---------- İskelet ---------- */
function shapesGridHTML(lv) {
  let cells = '';
  for (let i = 0; i < 35; i++)
    cells += `<button class="sh-cell" data-i="${i}" aria-label="Piksel ${Math.floor(i / 5) + 1}. satır ${(i % 5) + 1}. sütun" aria-pressed="false"></button>`;
  return `
  <div class="sh-mode" role="group" aria-label="Zorluk">
    <button class="sh-mbtn" id="shSimple" aria-pressed="true">Basit: 3 şekil</button>
    <button class="sh-mbtn" id="shAdvBtn" aria-pressed="false">Gelişmiş: 10 rakam</button>
  </div>
  <section class="bench sh-bench">
    <div class="panel sh-eye">
      <div class="ph"><h3>Göz</h3><span class="pc">35 piksel = 35 duyu nöronu</span></div>
      <div class="sh-grid" id="shGrid">${cells}</div>
      <div class="sh-tools"><button class="btn small" id="shClear">Temizle</button><button class="btn small" id="shSample">Örnek çiz</button></div>
      <p class="hint sh-eyehint" id="shEyeHint"></p>
      <div class="sh-add" id="shAdd" hidden>
        <label for="shNew">Bu çizimi yeni bir şekil olarak ekle</label>
        <div class="sh-add-row"><input id="shNew" placeholder="ör. kalp" maxlength="12" autocomplete="off" /><button class="btn small" id="shAddBtn">Ekle</button></div>
      </div>
    </div>
    <div class="panel sh-brain">
      <div class="ph"><h3>Nöron ağı</h3><span class="pc" id="shBrainSub"></span></div>
      <canvas id="shNet" role="img" aria-label="Göz nöronlarından ara nöronlara, oradan cevap nöronlarına giden bağlantılar"></canvas>
      <p class="hint">Koyu nokta = ateşleyen nöron. <b class="pos-t">Mavi</b> çizgi uyarır, <b class="neg-t">pembe</b> çizgi susturur; kalınlık bağlantının gücü.</p>
    </div>
    <div class="panel sh-ans" id="shAns" aria-live="polite"></div>
  </section>
  <section class="panel sh-tray" id="shTray"></section>
  <section id="shAdvBox" hidden>
    <div class="sh-ctl panel">
      <button class="btn primary" id="shTrain" aria-pressed="false">▶ Eğit</button>
      <button class="btn" id="shStep">Biraz eğit</button>
      <label class="ctl">Ağ büyüklüğü <input type="range" id="shHidden" min="2" max="32" step="1" /><output id="shHiddenOut"></output></label>
      <label class="ctl">Bozukluk <input type="range" id="shNoise" min="0" max="6" step="1" /><output id="shNoiseOut"></output></label>
      <button class="btn ghost" id="shReset">↺ Boş ağla başla</button>
    </div>
    <div class="sh-scores" id="shScores"></div>
    <div class="sh-advb">
      <div class="panel"><div class="ph"><h3>Öğrenme eğrisi</h3><span class="pc">çizgi yükseldikçe daha çok biliyor</span></div><canvas id="shCurve" role="img" aria-label="Eğitim boyunca bilme oranı"></canvas>
        <p class="hint sh-leg"><span class="lg-tr">━ gördükleri</span> <span class="lg-te">┅ hiç görmedikleri</span></p></div>
      <div class="panel"><div class="ph"><h3>Karıştırdıkları</h3><span class="pc">hiç görmediği kartlardan</span></div><div class="sh-conf" id="shConf"></div><p class="hint">Bir karta tıkla: göze gelir, sinyali yukarıda izlersin.</p></div>
    </div>
  </section>`;
}

/* ---------- Bağlantılar ---------- */
function wireShapes(lv) {
  const rec = R(),
    st = rec.st;
  shNet = shapesReplay(st);
  if (st.mode === 'adv') shAdvBuild(st);
  const grid = $('#shGrid');
  const paintAt = el => {
    if (!el || !el.classList.contains('sh-cell') || shPaint === null) return;
    const i = +el.dataset.i;
    if (st.bits[i] !== shPaint) {
      st.bits[i] = shPaint;
      st.drawnFor = st.label;
      refresh();
    }
  };
  grid.addEventListener('pointerdown', e => {
    const el = e.target.closest('.sh-cell');
    if (!el) return;
    e.preventDefault();
    shPaint = 1 - st.bits[+el.dataset.i];
    paintAt(el);
  });
  grid.addEventListener('pointermove', e => {
    if (shPaint === null) return;
    paintAt(document.elementFromPoint(e.clientX, e.clientY));
  });
  window.addEventListener('pointerup', () => (shPaint = null));
  grid.addEventListener('keydown', e => {
    const el = e.target.closest('.sh-cell');
    if (!el || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const i = +el.dataset.i;
    st.bits[i] = 1 - st.bits[i];
    st.drawnFor = st.label;
    refresh();
  });
  $('#shClear').onclick = () => {
    st.bits = new Array(35).fill(0);
    st.drawnFor = null;
    refresh();
  };
  $('#shSample').onclick = () => {
    const rnd = Math.random;
    if (st.mode === 'adv') {
      const keys = Object.keys(DIGIT_BITS),
        k = keys[Math.floor(rnd() * keys.length)];
      st.bits = noisyBits(DIGIT_BITS[k], 1 + Math.floor(rnd() * 2), rnd);
    } else {
      // seçili şeklin biraz bozuk bir örneği
      st.bits = noisyBits(SHAPES.protos[st.label], 1 + Math.floor(rnd() * 2), rnd);
      st.drawnFor = st.label;
    }
    refresh();
  };
  $('#shSimple').onclick = () => shSetMode(st, 'simple');
  $('#shAdvBtn').onclick = () => shSetMode(st, 'adv');
  // gelişmiş mod denetimleri
  $('#shHidden').value = st.adv.hidden;
  $('#shNoise').value = st.adv.noise;
  $('#shHidden').oninput = e => {
    st.adv.hidden = +e.target.value;
    shAdvBuild(st, true);
    refresh();
  };
  $('#shNoise').oninput = e => {
    st.adv.noise = +e.target.value;
    shAdvBuild(st, true);
    refresh();
  };
  $('#shReset').onclick = () => {
    shAdvBuild(st, true);
    toast('Boş ağ: bütün bağlantılar rastgele, hiçbir şey bilmiyor.');
    refresh();
  };
  $('#shStep').onclick = () => {
    shAdvRun(st, 20);
    refresh();
  };
  $('#shTrain').onclick = () => {
    if (shRaf) return shapesStop();
    const b = $('#shTrain');
    b.textContent = '⏸ Durdur';
    b.setAttribute('aria-pressed', 'true');
    let k = 0;
    const max = SHAPES.adv.maxSteps;
    const loop = () => {
      shAdvRun(st, 1);
      if (++k % 5 === 0) refresh();
      if (shAdv.steps >= max) {
        shapesStop();
        refresh();
        toast(`${max} adım: ağ bu ayarlarla öğrenebileceğinin çoğunu öğrendi.`);
        return;
      }
      shRaf = requestAnimationFrame(loop);
    };
    shRaf = requestAnimationFrame(loop);
  };
  $('#shAddBtn').onclick = () => {
    const name = $('#shNew').value.trim();
    if (!name) return toast('Önce şekline bir ad ver.');
    if (st.bits.every(b => !b)) return toast('Önce göze şeklini çiz.');
    if (
      advLabels(st.adv).some(l => l.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))
    )
      return toast('Bu adla bir şekil zaten var.');
    st.adv.custom.push({ label: name, bits: st.bits.slice() });
    $('#shNew').value = '';
    shAdvBuild(st, true);
    toast(`“${name}” eklendi. Ağ yeni bir cevap nöronu kazandı; şimdi yeniden eğit.`);
    refresh();
  };
  $('#shConf').addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (!b || !shAdv) return;
    st.bits = shAdv.conf[+b.dataset.k].bits.slice();
    refresh();
  });
  if (!shResizeOn) {
    shResizeOn = true;
    window.addEventListener('resize', () => {
      if (document.getElementById('shNet')) refresh();
    });
  }
}
function shSetMode(st, m) {
  if (st.mode === m) return;
  shapesStop();
  st.mode = m;
  if (m === 'adv') {
    shAdvBuild(st);
    if (st.bits.every(b => !b)) st.bits = DIGIT_BITS[3].slice();
  }
  refresh();
}
function shAdvBuild(st, fresh) {
  if (shAdv && !fresh) return;
  shapesStop();
  const ds = advDataset(st.adv);
  shAdv = {
    ds,
    net: advNet(st.adv, ds.labels.length),
    rnd: mulberry32(3),
    steps: 0,
    curve: [],
    loss: null,
    conf: []
  };
  shAdvEval(st);
}
function shAdvEval(st) {
  const a = shAdv,
    stats = {
      steps: a.steps,
      trainAcc: advAccuracy(a.net, a.ds.train),
      testAcc: advAccuracy(a.net, a.ds.test)
    };
  a.stats = stats;
  a.curve.push({ s: a.steps, tr: stats.trainAcc, te: stats.testAcc });
  a.conf = advConfusions(a.net, a.ds, 6);
  advRecord(st, stats);
}
function shAdvRun(st, steps) {
  if (!shAdv) shAdvBuild(st);
  for (let k = 0; k < steps; k++) {
    shAdv.loss = advTrain(shAdv.net, shAdv.ds, 1, shAdv.rnd);
    shAdv.steps++;
    if (shAdv.steps % 5 === 0) shAdvEval(st);
  }
}

/* ---------- Ağ çizimi ---------- */
function shCss(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
}
function drawShapesNet(cv, net, bits, labels) {
  const dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth || 400,
    H = Math.max(260, Math.min(360, W * 0.62));
  cv.style.height = H + 'px';
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const POS = shCss('--pos'),
    NEG = shCss('--neg'),
    INK = shCss('--ink'),
    INK2 = shCss('--ink-2'),
    LINE = shCss('--line'),
    SURF = shCss('--surface'),
    ON = shCss('--node-on');
  const acts = net.forward(bits),
    hid = acts[1],
    out = acts[2],
    nH = hid.length,
    nO = out.length;
  // girdi: 5×7 küçük kareler
  const c = Math.min(14, (H - 40) / 7 - 2),
    gx = 10,
    gy = (H - 7 * (c + 2)) / 2;
  const inPos = i => [gx + (i % 5) * (c + 2) + c / 2, gy + Math.floor(i / 5) * (c + 2) + c / 2];
  const hx = W * 0.5,
    ox = W - 96;
  const hy = j => 18 + ((H - 36) * (j + 0.5)) / nH,
    oy = k => 18 + ((H - 36) * (k + 0.5)) / nO;
  const W1 = net.W[0],
    W2 = net.W[1];
  let m1 = 1e-9,
    m2 = 1e-9;
  for (const v of W1) m1 = Math.max(m1, Math.abs(v));
  for (const v of W2) m2 = Math.max(m2, Math.abs(v));
  x.lineCap = 'round';
  // göz → ara: yalnız yanan piksellerden
  for (let j = 0; j < nH; j++)
    for (let i = 0; i < 35; i++) {
      if (!bits[i]) continue;
      const w = W1[j * 35 + i],
        a = Math.abs(w) / m1;
      if (a < 0.15) continue;
      const [px, py] = inPos(i);
      x.strokeStyle = w > 0 ? POS : NEG;
      x.globalAlpha = 0.12 + 0.5 * a;
      x.lineWidth = 0.6 + 1.8 * a;
      x.beginPath();
      x.moveTo(px + c / 2, py);
      x.lineTo(hx, hy(j));
      x.stroke();
    }
  // ara → cevap
  for (let k = 0; k < nO; k++)
    for (let j = 0; j < nH; j++) {
      const w = W2[k * nH + j],
        a = (Math.abs(w) / m2) * (0.25 + 0.75 * Math.abs(hid[j]));
      if (a < 0.08) continue;
      x.strokeStyle = w * hid[j] >= 0 ? POS : NEG;
      x.globalAlpha = 0.1 + 0.7 * a;
      x.lineWidth = 0.6 + 3 * a;
      x.beginPath();
      x.moveTo(hx, hy(j));
      x.lineTo(ox, oy(k));
      x.stroke();
    }
  x.globalAlpha = 1;
  // düğümler
  for (let i = 0; i < 35; i++) {
    const [px, py] = inPos(i);
    x.fillStyle = bits[i] ? ON : SURF;
    x.strokeStyle = LINE;
    x.lineWidth = 1;
    x.beginPath();
    x.roundRect(px - c / 2, py - c / 2, c, c, 2);
    x.fill();
    x.stroke();
  }
  const rH = Math.max(3.5, Math.min(10, (H - 40) / nH / 2.6));
  for (let j = 0; j < nH; j++) {
    const v = hid[j];
    x.fillStyle = SURF;
    x.beginPath();
    x.arc(hx, hy(j), rH, 0, 7);
    x.fill();
    x.globalAlpha = Math.min(1, Math.abs(v));
    x.fillStyle = v >= 0 ? ON : NEG;
    x.fill();
    x.globalAlpha = 1;
    x.strokeStyle = INK;
    x.lineWidth = 1.2;
    x.stroke();
  }
  const best = shArgmax(Array.from(out)),
    rO = Math.max(5, Math.min(13, (H - 40) / nO / 2.4));
  x.font = `${nO > 6 ? 12 : 14}px "IBM Plex Sans", system-ui, sans-serif`;
  x.textBaseline = 'middle';
  for (let k = 0; k < nO; k++) {
    x.fillStyle = SURF;
    x.beginPath();
    x.arc(ox, oy(k), rO, 0, 7);
    x.fill();
    x.globalAlpha = Math.min(1, out[k] * 1.3);
    x.fillStyle = ON;
    x.fill();
    x.globalAlpha = 1;
    x.strokeStyle = k === best ? INK : INK2;
    x.lineWidth = k === best ? 2 : 1;
    x.stroke();
    x.fillStyle = k === best ? INK : INK2;
    x.fillText(`${labels[k]} ${shPct(out[k])}`, ox + rO + 6, oy(k));
  }
  x.fillStyle = INK2;
  x.font = '11px "IBM Plex Sans", system-ui, sans-serif';
  x.textBaseline = 'alphabetic';
  x.fillText('göz', gx, H - 4);
  x.fillText('ara nöronlar', hx - 30, H - 4);
}
function drawShCurve(cv, curve) {
  const dpr = window.devicePixelRatio || 1,
    W = cv.clientWidth || 300,
    H = 150;
  cv.style.height = H + 'px';
  cv.width = W * dpr;
  cv.height = H * dpr;
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  const L = 30,
    B = 18,
    T = 8,
    maxS = Math.max(SHAPES.adv.maxSteps, curve.length ? curve[curve.length - 1].s : 0);
  const X = s => L + ((W - L - 8) * s) / maxS,
    Y = v => T + (H - T - B) * (1 - v);
  x.strokeStyle = shCss('--line');
  x.fillStyle = shCss('--ink-2');
  x.font = '11px "IBM Plex Sans", system-ui, sans-serif';
  x.lineWidth = 1;
  [0, 0.5, 1].forEach(v => {
    x.beginPath();
    x.moveTo(L, Y(v));
    x.lineTo(W - 8, Y(v));
    x.stroke();
    x.fillText('%' + v * 100, 2, Y(v) + 4);
  });
  x.fillText(B3fmtSteps(maxS), W - 70, H - 4);
  const line = (key, color, dash) => {
    x.strokeStyle = color;
    x.setLineDash(dash);
    x.lineWidth = 2.2;
    x.beginPath();
    curve.forEach((p, i) => (i ? x.lineTo(X(p.s), Y(p[key])) : x.moveTo(X(p.s), Y(p[key]))));
    x.stroke();
  };
  line('tr', shCss('--pos'), []);
  line('te', shCss('--neg'), [5, 4]);
  x.setLineDash([]);
}
const B3fmtSteps = n => n.toLocaleString('tr-TR') + ' adım';

/* ---------- Güncelle ---------- */
function shSuggest(lv, rec) {
  const st = rec.st,
    act = rec.done.length === lv.missions.length ? null : rec.active,
    on = st.bits.reduce((a, b) => a + b, 0);
  const s = { ids: [], grid: false, chip: -1 };
  const same = (a, b) => a.every((v, i) => v === b[i]);
  const taught = st.examples.some(e => same(e.bits, st.bits));
  if (st.mode === 'simple') {
    if (act === 'teach' || act === 'all') {
      const target =
        act === 'all' && st.counts[st.label] >= 2
          ? st.counts.indexOf(Math.min(...st.counts))
          : st.label;
      if (target !== st.label) s.chip = target;
      else if (on < 4 || st.drawnFor !== st.label || taught) s.ids.push('shSample');
      else s.ids.push('shTeach');
    } else if (act === 'test') {
      if (on < 4 || taught) s.ids.push('shSample');
      else s.ids.push('shTest');
    } else if (act === 'fix') {
      // çiz → sına → yanıldıysa doğrusunu öğret → aynı çizimi yeniden sına
      const last = st.tests[0],
        here = last && same(last.bits, st.bits),
        wrongHere = st.wrong.some(w => same(w.bits, st.bits));
      if (here && !last.ok && !st.flags.taughtWrong) {
        if (st.label !== last.y) s.chip = last.y;
        else s.ids.push('shTeach');
      } else if (st.flags.taughtWrong && wrongHere) s.ids.push('shTest');
      else if (on >= 4 && !taught && !(here && last.ok)) s.ids.push('shTest');
      else s.grid = true;
    } else if (act) s.ids.push('shAdvBtn');
  } else {
    if (act === 'ten')
      s.ids.push(
        shAdv && shAdv.stats.trainAcc >= 0.9 && st.adv.hidden < 8 ? 'shHidden' : 'shTrain'
      );
    else if (act === 'small') s.ids.push(st.adv.hidden !== 2 ? 'shHidden' : 'shTrain');
    else if (act === 'noise')
      s.ids.push(st.adv.hidden < 8 ? 'shHidden' : st.adv.noise < 6 ? 'shNoise' : 'shTrain');
    else if (act) s.ids.push('shSimple');
  }
  return s;
}
function updateShapes(lv, rec) {
  const st = rec.st,
    adv = st.mode === 'adv';
  if (adv && !shAdv) shAdvBuild(st);
  if (!shNet) shNet = shapesReplay(st);
  const sug = shSuggest(lv, rec);
  $('#shSimple').setAttribute('aria-pressed', String(!adv));
  $('#shAdvBtn').setAttribute('aria-pressed', String(adv));
  $('#shAdd').hidden = !adv;
  $('#shTray').hidden = adv;
  $('#shAdvBox').hidden = !adv;
  // göz
  const cells = $('#shGrid').children;
  for (let i = 0; i < 35; i++) {
    cells[i].classList.toggle('on', !!st.bits[i]);
    cells[i].setAttribute('aria-pressed', st.bits[i] ? 'true' : 'false');
  }
  $('#shGrid').classList.toggle('psugc', sug.grid);
  $('#shSample').classList.toggle('psug', sug.ids.includes('shSample'));
  $('#shAdvBtn').classList.toggle('psug', sug.ids.includes('shAdvBtn'));
  $('#shSimple').classList.toggle('psug', sug.ids.includes('shSimple'));
  $('#shEyeHint').textContent = adv
    ? 'Piksellere dokun ya da sürükle. “Örnek çiz” rastgele, biraz bozuk bir rakam çizer.'
    : `Piksellere dokun ya da sürükle. “Örnek çiz” seçili şeklin (${SHAPES.names[st.label].toLocaleLowerCase('tr-TR')}) biraz bozuk bir örneğini çizer.`;
  const net = adv ? shAdv.net : shNet,
    labels = adv ? shAdv.ds.labels : SHAPES.names;
  $('#shBrainSub').textContent = adv
    ? `35 göz → ${st.adv.hidden} ara nöron → ${labels.length} cevap`
    : `35 göz → ${SHAPES.hidden} ara nöron → 3 cevap`;
  drawShapesNet($('#shNet'), net, st.bits, labels);
  const p = Array.from(net.predict(st.bits)),
    on = st.bits.reduce((a, b) => a + b, 0),
    best = shArgmax(p);
  const learned = adv ? shAdv.steps > 0 : st.examples.length > 0;
  const verdict = !on
    ? 'Önce göze bir şey çiz.'
    : !learned
      ? 'Henüz hiçbir şey öğrenmedi; tahmini rastgele.'
      : p[best] >= 0.7
        ? `Bence bu bir ${labels[best].toLocaleLowerCase('tr-TR')}.`
        : p[best] >= 0.45
          ? `Galiba ${labels[best].toLocaleLowerCase('tr-TR')}…`
          : 'Emin değilim.';
  const order = p
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, adv ? 5 : 3);
  const shown = adv ? order : p.map((v, i) => ({ v, i }));
  const bars = shown
    .map(
      o =>
        `<div class="sh-bar ${o.i === best && on && learned ? 'top' : ''}"><span class="sh-bl">${esc(labels[o.i])}</span><span class="sh-bt"><i style="width:${Math.round(o.v * 100)}%"></i></span><span class="sh-bv">${shPct(o.v)}</span></div>`
    )
    .join('');
  let h = `<div class="ans-l">Ağın cevabı</div><div class="sh-verdict" data-fl="shv">${esc(verdict)}</div><div class="sh-bars">${bars}</div>`;
  if (!adv) {
    const last = st.tests[0],
      lastHere = last && st.bits.every((v, i) => v === last.bits[i]);
    h += `<div class="sh-teach">
      <span class="sh-q">Bu çizim aslında ne?</span>
      <div class="sh-chips" role="group" aria-label="Şeklin adı">${SHAPES.names
        .map(
          (n, i) =>
            `<button class="sh-chip ${i === sug.chip ? 'psug' : ''}" data-l="${i}" aria-pressed="${i === st.label}">${n} <small>${st.counts[i]}</small></button>`
        )
        .join('')}</div>
      <div class="sh-acts"><button class="btn primary ${sug.ids.includes('shTeach') ? 'psug' : ''}" id="shTeach">Öğret: bu bir ${SHAPES.names[st.label].toLocaleLowerCase('tr-TR')}</button>
      <button class="btn ${sug.ids.includes('shTest') ? 'psug' : ''}" id="shTest">Sına (öğretmeden sor)</button></div>
      ${lastHere ? `<p class="sh-res ${last.ok ? 'ok' : 'bad'}">${last.ok ? `✓ Doğru bildi: ${SHAPES.names[last.y].toLocaleLowerCase('tr-TR')} (${'%' + last.p})` : `✗ Yanıldı: aslında ${SHAPES.names[last.y].toLocaleLowerCase('tr-TR')}, o ${SHAPES.names[last.guess].toLocaleLowerCase('tr-TR')} sandı. Şimdi doğrusunu öğret.`}</p>` : ''}
    </div>`;
  }
  const ans = $('#shAns');
  ans.innerHTML = h;
  if (!adv) {
    ans.querySelectorAll('.sh-chip').forEach(
      b =>
        (b.onclick = () => {
          st.label = +b.dataset.l;
          refresh();
        })
    );
    $('#shTeach').onclick = () => {
      if (!on) return toast('Önce göze bir şey çiz.');
      shapesTeach(st, shNet, st.bits, st.label);
      toast(
        `Öğretildi: ${SHAPES.names[st.label].toLocaleLowerCase('tr-TR')} (toplam ${st.examples.length} örnek)`
      );
      refresh();
    };
    $('#shTest').onclick = () => {
      if (!on) return toast('Önce göze bir şey çiz.');
      if (!st.examples.length)
        return toast('Önce birkaç örnek öğret; hiçbir şey bilmeyen ağı sınamak anlamsız.');
      shapesTest(st, shNet, st.bits, st.label);
      refresh();
    };
    // öğretilen örnekler
    $('#shTray').innerHTML =
      `<div class="ph"><h3>Öğrettiğin örnekler</h3><span class="pc">${st.examples.length} örnek</span></div>
      <div class="sh-tray-row">${SHAPES.names
        .map((n, i) => {
          const ex = st.examples.filter(e => e.y === i).slice(-8);
          return `<div class="sh-tcol"><div class="sh-th">${shMini(SHAPES.protos[i], 5)}<b>${n}</b><small>${st.counts[i]} örnek</small></div><div class="sh-tex">${ex.length ? ex.map(e => shMini(e.bits, 5)).join('') : '<span class="hint">henüz yok</span>'}</div></div>`;
        })
        .join('')}</div>`;
  } else {
    const s = shAdv.stats;
    $('#shHiddenOut').textContent = st.adv.hidden + ' nöron';
    $('#shNoiseOut').textContent = st.adv.noise + ' piksel';
    for (const id of ['shTrain', 'shHidden', 'shNoise']) {
      const el = $('#' + id);
      (id === 'shTrain' ? el : el.closest('label')).classList.toggle('psug', sug.ids.includes(id));
    }
    $('#shScores').innerHTML = [
      ['Gördüklerini bilme', shPct(s.trainAcc), `${shAdv.ds.train.length} eğitim kartı`],
      ['Hiç görmediklerini bilme', shPct(s.testAcc), `${shAdv.ds.test.length} sınav kartı`],
      ['Yanılma payı', shAdv.loss == null ? '–' : num(shAdv.loss, 2), 'düştükçe daha az yanılıyor'],
      ['Eğitim adımı', shAdv.steps.toLocaleString('tr-TR'), `her adımda ${SHAPES.adv.batch} kart`]
    ]
      .map(
        t =>
          `<div class="sh-score"><small>${t[0]}</small><b data-fl="shs-${t[0]}">${t[1]}</b><small>${t[2]}</small></div>`
      )
      .join('');
    drawShCurve($('#shCurve'), shAdv.curve);
    $('#shConf').innerHTML = shAdv.conf.length
      ? shAdv.conf
          .map(
            (c, k) =>
              `<button class="sh-cc" data-k="${k}">${shMini(c.bits, 7)}<small>aslında <b>${esc(c.truth)}</b><br><span class="neg-t">sandı: ${esc(c.guess)}</span></small></button>`
          )
          .join('')
      : `<p class="hint">${shAdv.steps ? 'Sınav kartlarının hiçbirini karıştırmıyor.' : 'Eğitim başlayınca burada görünecek.'}</p>`;
  }
}
