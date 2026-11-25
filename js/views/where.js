'use strict';
/* ------------------------------------------------------------------
   SEVİYE 13 görünümü: Hafıza nerede?
   Solda ipucu, ortada 36 nöronluk hafıza ağı (hatırlarken adım adım),
   sağda hatırlanan anı; altta hasar günlüğü.
   Model ve görevler: js/levels/13-where.js
------------------------------------------------------------------- */
let whT = 0,
  whShow = null; // canlandırılan durum (adım adım)

function whereResetView() {
  clearTimeout(whT);
  whT = 0;
  whShow = null;
}
function whPic(p, cell, cls) {
  const c = cell || 6;
  let h = `<svg class="wh-pic ${cls || ''}" viewBox="0 0 ${6 * c} ${6 * c}" width="${6 * c}" height="${6 * c}" aria-hidden="true">`;
  p.forEach((v, i) => {
    h += `<rect x="${(i % 6) * c + 0.5}" y="${Math.floor(i / 6) * c + 0.5}" width="${c - 1}" height="${c - 1}" rx="1" class="${v > 0 ? 'on' : v < 0 ? '' : 'unk'}"/>`;
  });
  return h + '</svg>';
}

function whereGridHTML(lv) {
  let cue = '',
    net = '';
  for (let i = 0; i < 36; i++) {
    cue += `<button class="wh-c" data-i="${i}" aria-label="İpucu ${Math.floor(i / 6) + 1}. satır ${(i % 6) + 1}. sütun"></button>`;
    net += `<button class="wh-n" data-i="${i}" aria-label="Nöron ${i + 1}"></button>`;
  }
  return `<section class="bench wh-bench">
    <div class="panel wh-cue">
      <div class="ph"><h3>1. İpucu ver</h3><span class="pc">bir anının parçası</span></div>
      <div class="wh-qbtns">${MEM.names
        .map(
          (n, k) =>
            `<button class="btn small" id="whHalf${k}">${MEM.icons[k]} ${['Pamuk’un', 'Evin', 'Şemsiyenin'][k]} yarısı</button>`
        )
        .join('')}<button class="btn small" id="whNoisy">🌫️ Bozuk bir Pamuk</button></div>
      <div class="wh-grid wh-cgrid" id="whCue">${cue}</div>
      <p class="hint">Kutulara dokunarak kendi ipucunu da çizebilirsin. Taralı kutular: ipucunda boş kalan yer.</p>
    </div>
    <div class="panel wh-net">
      <div class="ph"><h3>2. Hafıza ağı</h3><span class="pc" id="whSub">36 nöron · 630 bağlantı</span></div>
      <div class="wh-grid wh-ngrid" id="whNet">${net}</div>
      <p class="wh-stepline" id="whStep" aria-live="polite"></p>
      <div class="wh-ctl">
        <button class="btn primary" id="whGo">▶ Hatırla</button>
        <button class="btn" id="whKill" aria-pressed="false">✂ Nöron sil</button>
        <button class="btn ghost" id="whFix">Onar</button>
      </div>
      <label class="ctl wh-cut">Kopan bağlantı <input type="range" id="whCut" min="0" max="0.9" step="0.05" /><output id="whCutOut"></output></label>
    </div>
    <div class="panel wh-ans" id="whAns" aria-live="polite"></div>
  </section>
  <section class="panel wh-logp"><div class="ph"><h3>Hasar günlüğü</h3><span class="pc">son hatırlamalar</span></div><div class="llog-wrap"><table class="tt" id="whLog"></table></div></section>`;
}

function wireWhere(lv) {
  const st = R().st;
  const setCue = (cue, of, kind) => {
    whereResetView();
    st.cue = cue;
    st.cueOf = of;
    st.cueKind = kind;
    refresh();
  };
  MEM.names.forEach((n, k) => ($('#whHalf' + k).onclick = () => setCue(memHalf(k), k, 'half')));
  $('#whNoisy').onclick = () => setCue(memNoisy(0, 6, 3 + st.runs), 0, 'noisy');
  $('#whCue').addEventListener('click', e => {
    const b = e.target.closest('.wh-c');
    if (!b) return;
    const i = +b.dataset.i,
      c = st.cue.slice();
    // kendi çizimin: boş yerler sönük sayılır
    if (st.cueKind !== 'draw') for (let j = 0; j < 36; j++) if (c[j] === 0) c[j] = -1;
    c[i] = c[i] > 0 ? -1 : 1;
    // hangi anıya en çok benziyor? (görevler için niyet)
    const best = memBest(c, new Uint8Array(36));
    setCue(c, best.sim >= 0.6 ? best.k : null, 'draw');
  });
  $('#whNet').addEventListener('click', e => {
    const b = e.target.closest('.wh-n');
    if (!b) return;
    if (!st.kill) return toast('Nöron silmek için önce “✂ Nöron sil”e bas.');
    const i = +b.dataset.i,
      k = st.dead.indexOf(i);
    if (k >= 0) st.dead.splice(k, 1);
    else st.dead.push(i);
    whereResetView();
    refresh();
  });
  $('#whKill').onclick = () => {
    st.kill = !st.kill;
    refresh();
  };
  $('#whFix').onclick = () => {
    st.dead = [];
    st.cut = 0;
    $('#whCut').value = 0;
    whereResetView();
    toast('Ağ onarıldı: bütün nöronlar ve bağlantılar yerinde.');
    refresh();
  };
  $('#whCut').value = st.cut;
  $('#whCut').oninput = e => {
    st.cut = +e.target.value;
    whereResetView();
    refresh();
  };
  $('#whGo').onclick = () => {
    clearTimeout(whT);
    const { steps } = memRun(st);
    // adım adım göster
    let k = 0;
    const tick = () => {
      whShow = { state: steps[k], k, n: steps.length - 1 };
      refresh();
      if (++k < steps.length) whT = setTimeout(tick, reducedMotion ? 0 : 420);
      else {
        whT = 0;
        whShow = null;
        refresh();
      }
    };
    tick();
  };
}

function whSuggest(lv, rec) {
  const st = rec.st,
    act = rec.done.length === lv.missions.length ? null : rec.active;
  const s = [];
  const go = () => s.push('whGo');
  if (act === 'recall') {
    if (st.cueOf !== 0 || st.cueKind !== 'half') s.push('whHalf0');
    else go();
  } else if (act === 'one') {
    if (st.cut > 0) s.push('whFix');
    else if (!st.dead.length) s.push(st.kill ? 'whNet' : 'whKill');
    else if (st.cueOf == null) s.push('whHalf0');
    else go();
  } else if (act === 'many') {
    const left = [0, 1, 2].filter(k => !(st.flags.many || []).includes(k));
    if (st.dead.length < 6) s.push(st.kill ? 'whNet' : 'whKill');
    else if (st.cueOf !== left[0] || st.cueKind !== 'half') s.push('whHalf' + left[0]);
    else go();
  } else if (act === 'cut') {
    if (st.dead.length) s.push('whFix');
    else if (st.cut < 0.5) s.push('whCut');
    else go();
  } else if (act === 'lost') {
    if (st.cut < 0.85) s.push('whCut');
    else go();
  }
  return s;
}

function updateWhere(lv, rec) {
  const st = rec.st,
    dead = deadMask(st),
    sug = whSuggest(lv, rec);
  // ipucu
  const cues = $('#whCue').children;
  for (let i = 0; i < 36; i++) {
    const v = st.cue[i];
    cues[i].className = 'wh-c' + (v > 0 ? ' on' : v === 0 ? ' unk' : '');
  }
  // ağ: canlandırma sürüyorsa o adım, yoksa son sonuç ya da ipucunun kendisi
  const shown = whShow ? whShow.state : st.last && !whT ? st.last.state : st.cue;
  const cells = $('#whNet').children;
  for (let i = 0; i < 36; i++) {
    const v = dead[i] ? 0 : shown[i];
    cells[i].className = 'wh-n' + (dead[i] ? ' dead' : v > 0 ? ' on' : v === 0 ? ' unk' : '');
    cells[i].setAttribute(
      'aria-label',
      `Nöron ${i + 1}${dead[i] ? ', silindi' : v > 0 ? ', yanık' : ', sönük'}`
    );
  }
  $('#whNet').classList.toggle('killing', !!st.kill);
  $('#whNet').classList.toggle('psugc', sug.includes('whNet'));
  $('#whKill').setAttribute('aria-pressed', String(!!st.kill));
  $('#whKill').textContent = st.kill ? '✂ Silme açık: nörona dokun' : '✂ Nöron sil';
  $('#whCutOut').textContent = '%' + Math.round(st.cut * 100);
  $('#whSub').textContent =
    `${36 - st.dead.length} nöron · ${Math.round(630 * (1 - st.cut) * ((36 - st.dead.length) / 36) ** 2)} bağlantı`;
  $('#whStep').textContent = whShow
    ? whShow.k === 0
      ? 'İpucu ağa verildi…'
      : `Tur ${whShow.k}: nöronlar desteklerine göre yanıp sönüyor…`
    : st.last
      ? `${st.last.steps} turda bir anıya oturdu.`
      : '';
  for (const id of ['whGo', 'whKill', 'whFix', 'whHalf0', 'whHalf1', 'whHalf2'])
    $('#' + id).classList.toggle('psug', sug.includes(id));
  $('#whCut').closest('label').classList.toggle('psug', sug.includes('whCut'));
  // cevap
  const L = st.last;
  let h = `<div class="ans-l">Ağın hatırladığı</div>`;
  if (!L || whT)
    h += `<div class="wh-verdict">${whT ? 'Hatırlıyor…' : 'Henüz bir şey sorulmadı.'}</div>`;
  else {
    const good = L.sim >= 0.9,
      mid = L.sim >= 0.8;
    h += `<div class="wh-verdict ${good ? 'ok' : mid ? '' : 'bad'}">${MEM.icons[L.k]} ${good ? MEM.names[L.k] : mid ? `Bulanık bir ${MEM.names[L.k].toLocaleLowerCase('tr-TR')}` : 'Karışık bir şey'}</div>
      <div class="wh-sub">${good ? 'Anı tam geri geldi.' : mid ? 'Anı bulanık geldi.' : 'Anı başka anılarla karıştı.'}${L.intended != null && L.k !== L.intended ? ` Oysa ipucu ${MEM.names[L.intended].toLocaleLowerCase('tr-TR')} içindi.` : ''}</div>`;
  }
  h += `<div class="wh-mems">${MEM.pats
    .map((p, k) => {
      const v = L && !whT ? L.sims[k] : null;
      return `<div class="wh-mem ${L && !whT && k === L.k ? 'top' : ''}">${whPic(p, 7)}<span class="wh-mn">${MEM.icons[k]} ${MEM.names[k]}</span><span class="sh-bt"><i style="width:${v == null ? 0 : Math.round(v * 100)}%"></i></span><span class="wh-mv">${v == null ? '' : '%' + Math.round(v * 100)}</span></div>`;
    })
    .join('')}</div>
    <p class="hint">Yüzde: hatırlanan resmin o anıyla kaç nöronda aynı olduğu (silinen nöronlar sayılmaz).</p>`;
  $('#whAns').innerHTML = h;
  // günlük
  $('#whLog').innerHTML = st.log.length
    ? `<thead><tr><th>ölü nöron</th><th>kopan bağlantı</th><th>ipucu</th><th>hatırlanan</th><th>benzerlik</th></tr></thead><tbody>${st.log
        .map(
          r =>
            `<tr><td>${r.dead}</td><td>%${Math.round(r.cut * 100)}</td><td>${{ half: 'yarım resim', noisy: 'bozuk resim', draw: 'kendi çizimin' }[r.cue]}</td><td>${MEM.icons[r.k]} ${MEM.names[r.k]}</td><td class="${r.sim >= 90 ? 'ok' : r.sim >= 80 ? '' : 'bad'}">%${r.sim}</td></tr>`
        )
        .join('')}</tbody>`
    : `<tbody><tr><td class="hint">Hatırla’ya bastıkça her deneme buraya yazılır: hasar büyüdükçe benzerlik nasıl değişiyor?</td></tr></tbody>`;
}
