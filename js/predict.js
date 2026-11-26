'use strict';
/* ------------------------------------------------------------------
   SEVİYE 5: tahmin ederek öğrenme (öğretmen yok, bir sonraki an var)
   Hikâye: kedi Pamuk ve mama. Kullanıcı sahibi: önce bir ses çıkarır
   (poşet hışırtısı, “pisi pisi”), Pamuk beklediği kadar kabına koşar,
   sonra kullanıcı mama verir ya da vermez → sürpriz → bağ düzelir.
   Üstte dışarıdan görünen (oda), altta Pamuk’un beyni.
   Model: predictStep (neuron.js); predictCue/predictGive/predictNewBrain (levels.js).
------------------------------------------------------------------- */
let pAuto = 0,
  pLastAct = '';
function predictStop() {}
function predictResetView() {
  pLastAct = '';
}
const PZ = {
  rx0: 110,
  rx1: 740,
  cx: 90,
  cy: [160, 250],
  cs: 50,
  nx: 360,
  ny: 205,
  nr: 42,
  wx: 640,
  wy: 128,
  dx: 640,
  dy: 265,
  dr: 30
};
const pPct = v => '%' + Math.round(v * 100);
const sg2 = v => (v > 0.005 ? '+' : '') + num(v, 2);
const cueIcons = x =>
  PREDICT.cues
    .filter((c, i) => x[i])
    .map(c => c.icon)
    .join('');
const cueSound = x =>
  PREDICT.cues
    .filter((c, i) => x[i])
    .map(c => `${c.icon} “${c.sound}”`)
    .join(' + ');
const catAct = V =>
  V < 0.1
    ? 'Pamuk kılını bile kıpırdatmadı.'
    : V < 0.4
      ? 'Pamuk başını kaldırdı, birkaç adım attı.'
      : V < 0.75
        ? 'Pamuk yarı yola kadar geldi.'
        : 'Pamuk koşarak kabının başına geldi.';
const catMood = d =>
  d >= 0.5
    ? ['😻', 'Çok sevindi! Hiç beklemiyordu.']
    : d >= 0.15
      ? ['😺', 'Sevindi.']
      : d > -0.15
        ? ['🐱', 'Zaten biliyordu; şaşırmadı.']
        : d > -0.5
          ? ['😾', 'Biraz bozuldu.']
          : ['😿', 'Büyük hayal kırıklığı! Mama bekliyordu.'];

function predictGridHTML(lv) {
  return `<section class="bench has-card">
      <div class="bench-card pact">
        <div class="pstep-h"><span class="pdot">1</span> Bir ses çıkar</div>
        <div class="pbtns">${PREDICT.cues.map((c, i) => `<button class="btn" id="c${i}"${i ? ' data-lay="pisi"' : ''}>${c.icon} ${esc(c.btn)}</button>`).join('')}<button class="btn" id="cB" data-lay="pisi">${PREDICT.cues.map(c => c.icon).join('+')} İkisi birden</button></div>
        <div class="pstep-h"><span class="pdot">2</span> Mama verecek misin?</div>
        <div class="pbtns two"><button class="btn" id="gYes">🐟 Mama ver</button><button class="btn" id="gNo">🚫 Verme</button></div>
        <p class="pnext" id="pNext" aria-live="polite"></p>
        <div class="bench-more pquick"><button class="btn small" id="qRep" data-lay="repeat">↻ Son anı 5 kez tekrarla</button><button class="btn small" id="qDice" data-lay="dice">🎲 Yazı-tura × 10</button><button class="btn ghost small" id="qNew" data-lay="kitten">🐣 Yeni yavru kedi</button></div>
      </div>
      <div class="bench-scene"><div class="stage scene-wrap"><svg id="pscene" viewBox="0 0 860 348" role="img" aria-label="Üstte oda: Pamuk ve mama kabı. Altta Pamuk’un beyni: ses nöronları, tahmin nöronu, dopamin nöronu"></svg></div></div>
      <div class="bench-answer panel" id="panswer" aria-live="polite"></div>
    </section>
    <section class="strip" id="pstep" aria-live="polite" data-lay="strip"></section>
    <section class="bench-bottom">
      <div class="panel" data-lay="chart"><div class="ph"><h3>Beklenti ve sürpriz, an an</h3><span class="pc" id="pChartN"></span></div>
        <svg id="pchart" viewBox="0 0 600 206" aria-hidden="true"></svg>
        <p class="hint" id="pChartHint"></p></div>
      <div class="panel" data-lay="log"><h3>Pamuk’un beynindeki bağlar ve son anlar</h3>
        <div class="pweights" id="pweights"></div>
        <div class="llog-wrap"><table class="tt" id="plog"></table></div></div>
    </section>`;
}

function wirePredict(lv) {
  const svg = $('#pscene');
  // ---- oda (dışarıdan görünen) ----
  let h = `<rect class="proom" x="8" y="6" width="844" height="92" rx="14"/>
    <text class="coltitle" x="22" y="24" style="text-anchor:start">Dışarıdan görünen</text>
    <line class="pfloor" x1="22" x2="838" y1="90" y2="90"/>
    <text class="pemo" x="60" y="86" style="font-size:40px">🛋️</text>
    <text class="pemo" x="800" y="88" style="font-size:34px">🥣</text><text class="pemo" id="pfish" x="800" y="62" style="font-size:22px"></text>
    <text class="psound" id="psound" x="838" y="25" style="text-anchor:end"></text>
    <g id="pcat" class="pcat"><text class="pemo" x="-${PZ.rx0}" y="88" transform="scale(-1,1)" style="font-size:40px">🐈</text>
      <text class="pthink" id="pthink" x="${PZ.rx0}" y="52"></text></g>`;
  // ---- Pamuk’un beyni ----
  h += `<line class="pfloor" x1="22" x2="838" y1="108" y2="108" style="stroke-dasharray:3 5"/>
    <text class="coltitle" x="22" y="128" style="text-anchor:start">Pamuk’un beyninde</text>
    <text class="coltitle" x="${PZ.nx}" y="146">Tahmin nöronu</text>`;
  h += `<path class="teach" id="pteach" d="M${PZ.dx - PZ.dr},${PZ.dy + 10} C520,345 250,340 215,${PZ.cy[1] + 10}"/>
    <text class="teach-t" x="400" y="344">sürpriz, bağları ayarlar</text>`;
  PREDICT.cues.forEach((c, i) => {
    const y = PZ.cy[i],
      x1 = PZ.cx + PZ.cs / 2 + 4,
      x2 = PZ.nx - PZ.nr - 4,
      y2 = PZ.ny + (i ? 14 : -14);
    h += `<line class="syn" id="pe${i}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}"/><line class="flow" id="pf${i}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}"/>
      <text class="wtext" id="pw${i}" x="${(x1 + x2) / 2}" y="${(y + y2) / 2 - 10}"></text>`;
  });
  h += `<g id="pdl"></g>`;
  PREDICT.cues.forEach((c, i) => {
    const y = PZ.cy[i] - PZ.cs / 2;
    h += `<g class="pcue" id="pc${i}"><rect class="px-cell" id="pcc${i}" x="${PZ.cx - PZ.cs / 2}" y="${y}" width="${PZ.cs}" height="${PZ.cs}" rx="12"/>
      <text class="px-state emo small" x="${PZ.cx}" y="${y + 35}">${c.icon}</text></g>
      <text class="cname" x="${PZ.cx}" y="${y + PZ.cs + 15}">${esc(c.name)}</text>`;
  });
  h += `<path class="syn neg inh" d="M${PZ.nx + PZ.nr},${PZ.ny + 10} C480,240 560,${PZ.dy} ${PZ.dx - PZ.dr - 2},${PZ.dy}"/>
    <text class="wtext neg" x="505" y="${PZ.dy - 4}">− beklenti</text>
    <rect class="pworld" id="pwb" x="${PZ.wx - 40}" y="${PZ.wy}" width="80" height="64" rx="12"/>
    <text class="pemo" id="pwe" x="${PZ.wx}" y="${PZ.wy + 36}" style="font-size:26px"></text><text class="soma-sub" id="pwt" x="${PZ.wx}" y="${PZ.wy + 56}" style="font-size:11px"></text>
    <line class="syn pos" x1="${PZ.wx}" y1="${PZ.wy + 64}" x2="${PZ.dx}" y2="${PZ.dy - PZ.dr - 2}" style="stroke-width:3"/>
    <text class="wtext pos" x="${PZ.wx + 10}" y="${PZ.wy + 90}" style="text-anchor:start">+ olan</text>
    <circle class="soma pnode" id="pn" cx="${PZ.nx}" cy="${PZ.ny}" r="${PZ.nr}"/>
    <text class="soma-t big" id="pnv" x="${PZ.nx}" y="${PZ.ny + 7}"></text>
    <text class="soma-sub" id="pns" x="${PZ.nx}" y="${PZ.ny + PZ.nr + 18}">beklenti</text>
    <circle class="soma dopa" id="pd" cx="${PZ.dx}" cy="${PZ.dy}" r="${PZ.dr}"/>
    <text class="soma-t" id="pdv" x="${PZ.dx}" y="${PZ.dy + 5}"></text>
    <g id="pspk"></g><text class="soma-sub" x="${PZ.dx + PZ.dr + 10}" y="${PZ.dy + 5}" style="font-size:12px;text-anchor:start">dopamin nöronu</text>
    <text class="teach-t" x="${PZ.dx + PZ.dr + 10}" y="${PZ.dy + 21}" style="text-anchor:start">(sürpriz sinyali)</text>`;
  svg.innerHTML = h;
  const X = [
    [1, 0],
    [0, 1],
    [1, 1]
  ];
  ['c0', 'c1', 'cB'].forEach(
    (id, k) =>
      ($('#' + id).onclick = () => {
        predictCue(R().st, X[k]);
        refresh();
      })
  );
  $('#gYes').onclick = () => pGive(1);
  $('#gNo').onclick = () => pGive(0);
  $('#qRep').onclick = () => {
    const rc = R(),
      l = rc.last;
    if (!l) {
      toast('Önce bir an yaşat: bir ses çıkar, sonra mama ver ya da verme.');
      return;
    }
    let r;
    for (let k = 0; k < 5; k++) {
      predictCue(rc.st, l.x);
      r = predictGive(rc.st, l.r);
    }
    rc.last = r;
    rc.cardSeq = (rc.cardSeq || 0) + 1;
    refresh();
  };
  $('#qDice').onclick = () => {
    const rc = R();
    let r;
    for (let k = 0; k < 10; k++) {
      predictCue(rc.st, [1, 0]);
      r = predictGive(rc.st, Math.random() < 0.5 ? 1 : 0);
    }
    rc.last = r;
    rc.cardSeq = (rc.cardSeq || 0) + 1;
    refresh();
  };
  $('#qNew').onclick = () => {
    predictNewBrain(R().st);
    R().last = null;
    refresh();
    toast('Yeni yavru kedi: Pamuk’un beynindeki iki bağ da 0. Görevlerin duruyor.');
  };
}
function pGive(v) {
  const rec = R(),
    st = rec.st;
  if (!st.pend) {
    toast('Önce bir ses çıkar: Pamuk ne beklediğini göstersin.');
    return;
  }
  const r = predictGive(st, v);
  rec.last = r;
  rec.cardSeq = (rec.cardSeq || 0) + 1;
  pShowDeltas(r);
  refresh();
}
function pShowDeltas(r) {
  if (reducedMotion) return;
  const g = $('#pdl');
  if (!g) return;
  r.dw.forEach((d, i) => {
    if (!r.x[i] || Math.abs(d) < 0.005) return;
    const e = $('#pe' + i),
      x = (+e.getAttribute('x1') + +e.getAttribute('x2')) / 2,
      y = (+e.getAttribute('y1') + +e.getAttribute('y2')) / 2 + 22;
    const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    tx.setAttribute('x', x);
    tx.setAttribute('y', y);
    tx.setAttribute('class', 'delta ' + (d > 0 ? 'pos' : 'neg'));
    tx.textContent = sg2(d);
    g.appendChild(tx);
    setTimeout(() => tx.remove(), 1800);
  });
}

// Şimdi ne yapmalı? Görev ve duruma göre ipucu + parlayacak düğmeler
function pSuggest(lv, rec) {
  const st = rec.st,
    f = st.flags,
    ph = st.pend,
    pos = st.w[0],
    act = curMission(lv, rec);
  const cueFirst = (id, m1) =>
    ph
      ? { ids: [id], m: m1 }
      : { ids: ['c0'], m: 'Şimdi: <b>🛍️ Poşeti hışırdat</b> ve Pamuk’a bak.' };
  const clean = (a, b) => st.runStart[0] >= a[0] && st.runStart[0] <= a[1] && st.runStart[1] <= b;
  if (act === 'learn')
    return cueFirst('gYes', `Pamuk ${pPct(ph && ph.V)} bekliyor. Şimdi: <b>🐟 Mama ver</b>.`);
  if (act === 'miss') {
    if (pos < 0.5 && !ph)
      return {
        ids: ['c0'],
        m: 'Pamuk poşet sesine henüz koşmuyor; önce birkaç kez <b>poşet + 🐟 mama</b> ile öğret.'
      };
    return cueFirst('gNo', `Pamuk ${pPct(ph && ph.V)} bekliyor… ama bu sefer <b>🚫 Verme</b>.`);
  }
  if (act === 'extinct')
    return ph
      ? {
          ids: ['gNo'],
          m: '<b>🚫 Verme</b>. (Hızlı gitmek için sonra <b>↻ Son anı 5 kez tekrarla</b>.)'
        }
      : {
          ids: ['c0', 'qRep'],
          m: `Pamuk poşet sesine hâlâ ${pPct(pos)} bekliyor. <b>🛍️ Poşeti hışırdat</b>, mama verme; ya da <b>↻</b> ile tekrarla.`
        };
  if (act === 'half')
    return {
      ids: ['qDice'],
      m: 'Şimdi: <b>🎲 Yazı-tura × 10</b> (iki kez bas). Her seferinde poşet hışırdar, mama yarı yarıya gelir.'
    };
  if (act === 'block') {
    if (f.blocked && f.lastExp === 'block')
      return ph
        ? { ids: [], m: 'Pamuk ne yaptı? Görevin bitti; mama verip vermemek sana kalmış.' }
        : { ids: ['c1'], m: 'Son adım: <b>sadece 🗣️ “pisi pisi”</b> de. Pamuk geliyor mu?' };
    if (st.runKey === '111' && !clean([0.85, 9], 0.1))
      return {
        ids: ['qNew'],
        m: 'Bu deneme temiz başlamadı. <b>🐣 Yeni yavru kedi</b> al ve baştan başla.'
      };
    if (st.runKey === '111')
      return ph
        ? { ids: ['gYes'], m: `<b>🐟 Mama ver</b>. (${st.run}/8)` }
        : { ids: ['cB'], m: `<b>🛍️+🗣️ İkisi birden</b>, sonra mama ver. (${st.run}/8)` };
    if (st.w[1] > 0.1)
      return {
        ids: ['qNew'],
        m: `Bu Pamuk “pisi pisi”yi zaten biraz biliyor (${pPct(st.w[1])}). Önce <b>🐣 Yeni yavru kedi</b>.`
      };
    if (pos < 0.85)
      return cueFirst('gYes', `<b>🐟 Mama ver</b>. Poşet sesi ${pPct(pos)}; %85’i geçene kadar.`);
    return ph
      ? { ids: ['gYes'], m: '<b>🐟 Mama ver</b>.' }
      : {
          ids: ['cB'],
          m: `Poşet sesi öğrenildi (${pPct(pos)}). Şimdi <b>🛍️+🗣️ İkisi birden</b>, sonra mama ver (8 kez).`
        };
  }
  if (act === 'control') {
    if (f.control && f.lastExp === 'control')
      return ph
        ? { ids: [], m: 'Pamuk ne yaptı? Görevin bitti.' }
        : { ids: ['c1'], m: 'Son adım: <b>sadece 🗣️ “pisi pisi”</b> de. Bu sefer geliyor mu?' };
    if (st.runKey === '111' && !clean([-9, 0.1], 0.1))
      return { ids: ['qNew'], m: 'Bu deneme boş beyinle başlamadı. <b>🐣 Yeni yavru kedi</b> al.' };
    if (st.runKey === '111')
      return ph
        ? { ids: ['gYes'], m: `<b>🐟 Mama ver</b>. (${st.run}/8)` }
        : { ids: ['cB'], m: `<b>🛍️+🗣️ İkisi birden</b>, sonra mama ver. (${st.run}/8)` };
    if (st.w[0] > 0.1 || st.w[1] > 0.1)
      return {
        ids: ['qNew'],
        m: 'Kontrol deneyi boş beyinle başlar: önce <b>🐣 Yeni yavru kedi</b>.'
      };
    return ph
      ? { ids: ['gYes'], m: '<b>🐟 Mama ver</b>.' }
      : { ids: ['cB'], m: '<b>🛍️+🗣️ İkisi birden</b>, sonra mama ver (8 kez).' };
  }
  return ph
    ? { ids: ['gYes', 'gNo'], m: `Pamuk ${pPct(ph.V)} bekliyor. Mama verecek misin?` }
    : {
        ids: [],
        m: 'Serbest deneme: istediğin sesi çıkar, istediğin gibi davran. Pamuk’un beklentisini istediğin yere götürebilir misin?'
      };
}

function updatePredict(lv, rec) {
  const st = rec.st,
    ph = st.pend,
    r = ph ? null : rec.last;
  // düğmeler: 2. adım ancak bir ses çıkınca açılır
  ['gYes', 'gNo'].forEach(id => {
    $('#' + id).disabled = !ph;
  });
  $('#qRep').disabled = !rec.last;
  const sug = pSuggest(lv, rec);
  ['c0', 'c1', 'cB', 'gYes', 'gNo', 'qRep', 'qDice', 'qNew'].forEach(id =>
    $('#' + id).classList.toggle('psug', sug.ids.includes(id))
  );
  $('#pNext').innerHTML = sug.m;
  // o anki (ya da son) an
  const x = ph ? ph.x : r ? r.x : [0, 0],
    V = ph ? ph.V : r ? r.V : 0,
    shownW = r ? r.w0 : st.w;
  // oda: kedi beklentisi kadar koşar
  const tx = (PZ.rx1 - PZ.rx0) * clamp(V, 0, 1);
  $('#pcat').style.transform = `translateX(${tx.toFixed(1)}px)`;
  $('#psound').textContent = ph || r ? cueSound(x) : '';
  $('#pfish').textContent = r && r.r ? '🐟' : '';
  const mood = r ? catMood(r.d) : null;
  $('#pthink').textContent = ph ? `💭 ${pPct(V)} mama?` : r ? `${mood[0]} ${sg2(r.d)}` : '💤';
  // beyin
  PREDICT.cues.forEach((c, i) => {
    const on = !!x[i],
      w = shownW[i],
      aw = Math.min(Math.abs(w), 1),
      kind = Math.abs(w) < 1e-9 ? 'zero' : w > 0 ? 'pos' : 'neg';
    $('#pcc' + i).style.fill = on ? 'var(--light)' : 'var(--surface-2)';
    $('#pc' + i).classList.toggle('off', !on);
    const e = $('#pe' + i);
    e.setAttribute('class', 'syn ' + kind);
    e.style.strokeWidth = kind === 'zero' ? 1.2 : 1.4 + 5 * aw;
    const fl = $('#pf' + i);
    fl.setAttribute('class', 'flow ' + kind);
    fl.style.opacity = on && kind !== 'zero' ? clamp(0.4 + aw * 0.6, 0, 1) : 0;
    fl.style.strokeWidth = 1.4 + 5 * aw;
    const t = $('#pw' + i);
    t.textContent = Math.abs(st.w[i]) < 1e-9 ? 'bağ 0' : `bağ ${num(st.w[i], 2)}`;
    t.setAttribute('class', 'wtext ' + kind);
  });
  $('#pn').style.fill =
    `color-mix(in srgb, var(--light) ${Math.round(clamp(V, 0, 1) * 100)}%, var(--node-off))`;
  $('#pnv').textContent = ph || r ? pPct(V) : '…';
  $('#pns').textContent = r ? `beklenti · şimdi ${pPct(weightedSum(r.x, st.w))}` : 'beklenti';
  const wb = $('#pwb'),
    we = $('#pwe'),
    wt = $('#pwt');
  if (ph) {
    we.textContent = '⏳';
    wt.textContent = 'mama gelecek mi?';
    wb.setAttribute('class', 'pworld wait');
  } else if (r) {
    we.textContent = r.r ? '🐟' : '🚫';
    wt.textContent = r.r ? 'geldi (1)' : 'gelmedi (0)';
    wb.setAttribute('class', 'pworld ' + (r.r ? 'yes' : 'no'));
  } else {
    we.textContent = '❔';
    wt.textContent = 'olan';
    wb.setAttribute('class', 'pworld');
  }
  const d = r ? r.d : 0,
    dm = !r ? '' : d > 0.15 ? 'burst' : d < -0.15 ? 'pause' : 'calm';
  $('#pd').setAttribute('class', 'soma dopa ' + dm);
  $('#pdv').textContent = r ? sg2(d) : '…';
  const nT = !r ? 4 : d >= 0 ? Math.round(4 + 10 * d) : Math.max(0, Math.round(4 * (1 + d)));
  let sp = '';
  for (let k = 0; k < nT; k++) {
    const xx = PZ.dx - 50 + (nT > 1 ? (k * 100) / (nT - 1) : 50);
    sp += `<line class="spk ${dm}" x1="${xx.toFixed(1)}" y1="${PZ.dy + PZ.dr + 6}" x2="${xx.toFixed(1)}" y2="${PZ.dy + PZ.dr + 18}"/>`;
  }
  if (!nT)
    sp = `<line class="spk-base" x1="${PZ.dx - 50}" y1="${PZ.dy + PZ.dr + 12}" x2="${PZ.dx + 50}" y2="${PZ.dy + PZ.dr + 12}"/>`;
  $('#pspk').innerHTML = sp;
  $('#pteach').setAttribute('class', 'teach' + (r && Math.abs(d) >= 0.03 ? ' on' : ''));
  pAnswer(st, rec);
  pStep(rec);
  pChart(st);
  pWeights(st);
}

function pAnswer(st, rec) {
  const r = rec.last,
    ph = st.pend;
  const row = (x, lab) => {
    const v = weightedSum(x, st.w);
    return `<div class="prow"${x[1] ? ' data-lay="pisi"' : ''}><span class="prow-l">${lab}</span><span class="pbar"><i style="width:${Math.round(clamp(v, 0, 1) * 100)}%"></i></span><b data-fl="pa${x.join('')}">${pPct(v)}</b></div>`;
  };
  $('#panswer').innerHTML = `<div class="ans-l">Pamuk ne bekliyor?</div>
    <p class="ans-sub" style="margin:0 0 4px">Bu sesi duyarsa ne kadar mama bekler (ve kabına ne kadar koşar)</p>
    ${row([1, 0], '🛍️ poşet')}${row([0, 1], '🗣️ pisi pisi')}${row([1, 1], '🛍️+🗣️ ikisi')}
    ${r && !ph ? `<div class="ans-v ${r.d < -0.15 ? 'bad' : 'ok'}">son an: ${pPct(r.V)} bekledi, ${r.r ? '🐟 mama geldi' : '🚫 gelmedi'} → sürpriz <b>${sg2(r.d)}</b></div>` : ''}
    <div class="calc"><div class="cl">sürpriz = olan − beklenti</div><div class="cl">bağ += 0,3 × sürpriz</div></div>`;
}

function pStep(rec) {
  const st = rec.st,
    ph = st.pend,
    r = ph ? null : rec.last,
    el = $('#pstep');
  const key = ph ? 'p' + ph.x.join('') + (rec.cardSeq || 0) : r ? 'r' + (rec.cardSeq || 0) : 'none';
  if (key === pLastAct) return;
  pLastAct = key;
  if (!ph && !r) {
    el.innerHTML = `<div class="ph-box empty"><div class="ph-b">Henüz bir an yaşanmadı. Soldan <b>bir ses çıkar</b> (🛍️ poşeti hışırdat): Pamuk ne kadar mama beklediğini gösterecek. Sonra <b>mama ver</b> ya da <b>verme</b>: beklediği ile olan arasındaki fark (sürpriz) kadar öğrenecek. Dört aşama burada yan yana görünecek.</div></div>`;
    return;
  }
  const x = ph ? ph.x : r.x,
    V = ph ? ph.V : r.V,
    w0 = ph ? st.w : r.w0;
  const pres = PREDICT.cues.map((c, i) => ({ c, i })).filter(o => x[o.i]);
  const sumTxt =
    pres.length > 1
      ? pres.map(o => `${o.c.short} ${num(w0[o.i], 2)}`).join(' + ') + ` = ${num(V, 2)}`
      : `${pres[0].c.short} bağı = ${num(V, 2)}`;
  const boxes = [
    {
      t: '1 · Ses ve tahmin',
      h: `${esc(cueSound(x))}<br>beynindeki bağ: ${sumTxt}<br>→ <b>${pPct(V)}</b> mama bekliyor. ${catAct(V)}`
    }
  ];
  if (ph) {
    boxes.push(
      { t: '2 · Bir an sonra', cls: 'empty', h: '<b>Sıra sende:</b> 🐟 mama ver ya da 🚫 verme.' },
      { t: '3 · Sürpriz', h: '<span class="pend">…</span>' },
      { t: '4 · Öğrendi', h: '<span class="pend">…</span>' }
    );
    el.innerHTML = stripHTML(boxes);
    return;
  }
  const mood = catMood(r.d);
  boxes.push({
    t: '2 · Bir an sonra',
    h: r.r ? '🐟 Mama verdin.<br>olan = <b>1</b>' : '🚫 Mama vermedin, kap boş.<br>olan = <b>0</b>'
  });
  boxes.push({
    t: '3 · Sürpriz',
    cls: Math.abs(r.d) < 0.15 ? 'ok' : r.d > 0 ? '' : 'bad',
    h: `olan ${r.r} − beklenti ${num(r.V, 2)} = <b>${sg2(r.d)}</b><br>${mood[0]} ${mood[1]} ${Math.abs(r.d) < 0.15 ? 'Dopamin nöronu sakin.' : r.d > 0 ? 'Dopamin nöronu atış patlaması yaptı.' : 'Dopamin nöronu sustu.'}`
  });
  if (Math.abs(r.d) < 0.005) {
    boxes.push({
      t: '4 · Öğrendi',
      h: 'Sürpriz yok → <b>hiçbir bağ değişmedi</b>. Öğrenecek bir şey kalmadı.'
    });
    el.innerHTML = stripHTML(boxes);
    return;
  }
  const lines = PREDICT.cues.map((c, i) =>
    r.x[i]
      ? `<div class="chg ${r.dw[i] > 0 ? 'up' : 'down'}">${c.icon} ${esc(c.short)} bağı <b>${num(r.w0[i], 2)} → ${num(r.w[i], 2)}</b> <span class="dimtxt">(0,3 × ${sg2(r.d)})</span></div>`
      : `<div class="chg same">${c.icon} ${esc(c.short)} duyulmadı: değişmedi</div>`
  );
  boxes.push({ t: '4 · Öğrendi', h: lines.join('') });
  el.innerHTML = stripHTML(boxes);
}

function pChart(st) {
  const hs = st.hist.slice(-40),
    svg = $('#pchart'),
    X0 = 118,
    W = 472,
    n = 40,
    bw = W / n;
  const vy = v => 12 + (1 - clamp(v, 0, 1.2) / 1.2) * 66,
    zy = 140,
    dyS = 42;
  let h = `<text class="m-ax lab" x="0" y="${vy(0.5) + 4}">beklenti</text><text class="m-ax lab" x="0" y="${zy + 4}">sürpriz</text>
    <line class="r-grid" x1="${X0}" x2="${X0 + W}" y1="${vy(1)}" y2="${vy(1)}"/><line class="r-grid" x1="${X0}" x2="${X0 + W}" y1="${vy(0)}" y2="${vy(0)}"/>
    <text class="m-ax" x="${X0 - 8}" y="${vy(1) + 4}" style="text-anchor:end">%100</text><text class="m-ax" x="${X0 - 8}" y="${vy(0) + 4}" style="text-anchor:end">%0</text>
    <line class="r-grid" x1="${X0}" x2="${X0 + W}" y1="${zy}" y2="${zy}"/>
    <text class="m-ax" x="${X0 - 8}" y="${zy - dyS + 4}" style="text-anchor:end">+1</text><text class="m-ax" x="${X0 - 8}" y="${zy + dyS + 4}" style="text-anchor:end">−1</text>`;
  let prev = null;
  const pts = [];
  hs.forEach((e, k) => {
    const cx = X0 + k * bw + bw / 2,
      kk = e.x.join('');
    if (kk !== prev) {
      h += `<line class="p-sep" x1="${X0 + k * bw}" x2="${X0 + k * bw}" y1="6" y2="${zy + dyS + 4}"/><text class="p-rl" x="${X0 + k * bw + 3}" y="${zy + dyS + 16}">${cueIcons(e.x)}</text>`;
      prev = kk;
    }
    pts.push(`${cx.toFixed(1)},${vy(e.V).toFixed(1)}`);
    h += `<circle class="p-out ${e.r ? 'yes' : 'no'}" cx="${cx.toFixed(1)}" cy="${vy(e.r).toFixed(1)}" r="3.2"/>`;
    const hg = Math.abs(e.d) * dyS;
    h +=
      hg < 0.8
        ? `<rect class="r-zero" x="${(cx - bw / 2 + 1).toFixed(1)}" y="${zy - 1}" width="${Math.max(1, bw - 2).toFixed(1)}" height="2"/>`
        : `<rect class="p-d ${e.d > 0 ? 'up' : 'down'}" x="${(cx - bw / 2 + 1).toFixed(1)}" y="${(e.d > 0 ? zy - hg : zy).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${hg.toFixed(1)}"/>`;
  });
  if (pts.length) h += `<polyline class="p-v" points="${pts.join(' ')}"/>`;
  svg.innerHTML = h;
  $('#pChartN').textContent = st.hist.length ? `${st.n} an` : '';
  const last = hs[hs.length - 1],
    r3 = hs.slice(-3),
    h10 = hs.slice(-10),
    mixed =
      h10.length >= 8 &&
      h10.every(e => e.x.join('') === h10[0].x.join('')) &&
      h10.some(e => e.r) &&
      h10.some(e => !e.r);
  $('#pChartHint').textContent = !hs.length
    ? 'Çizgi: her anda Pamuk’un beklentisi. Nokta: gerçekte olan (üstte 🐟 mama geldi, altta gelmedi). Çubuk: sürpriz (yukarı sevinç, aşağı hayal kırıklığı).'
    : mixed
      ? 'Mama bazen geliyor bazen gelmiyor: beklenti ortada dolaşıyor, sürpriz çubukları hiç kısalmıyor.'
      : r3.length === 3 && r3.every(e => Math.abs(e.d) < 0.03)
        ? 'Sürpriz çubukları kayboldu: beklenti, olanla örtüşüyor. Bundan sonra bağlar değişmez.'
        : last && Math.abs(last.d) >= 0.5
          ? 'Büyük bir sürpriz: çizgi bir sonraki anda büyük bir adım atacak.'
          : 'Sürpriz küçüldükçe çizginin adımları da küçülüyor: öğrenme önce hızlı, sonra yavaş.';
}

function pWeights(st) {
  $('#pweights').innerHTML = PREDICT.cues
    .map((c, i) => {
      const w = st.w[i];
      return `<div class="pwt"><span class="pwt-n">${c.icon} ${esc(c.name)} → mama</span><span class="pwt-bar"><i style="width:${Math.round(clamp(Math.abs(w), 0, 1) * 100)}%" class="${w < 0 ? 'neg' : ''}"></i></span><b class="num" data-fl="pw${i}">${num(w, 2)}</b></div>`;
    })
    .join('');
  const rows = st.hist.slice(-6).reverse();
  $('#plog').innerHTML =
    `<thead><tr><th>#</th><th>ses</th><th>beklenti</th><th>mama</th><th>sürpriz</th></tr></thead><tbody>${
      rows
        .map(
          (e, k) => `<tr>
    <td class="num">${st.n - k}</td><td>${cueIcons(e.x)}</td><td class="num">${pPct(e.V)}</td>
    <td>${e.r ? '🐟' : '🚫'}</td><td class="num ${Math.abs(e.d) < 0.05 ? '' : e.d > 0 ? 'mk-ok' : 'mk-bad'}">${sg2(e.d)}</td></tr>`
        )
        .join('') || '<tr><td colspan="5" class="hint">Henüz an yok.</td></tr>'
    }</tbody>`;
}
