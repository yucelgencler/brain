'use strict';
/* ------------------------------------------------------------------
   SEVİYE 7: birden çok nöron (muz ve armut)
   Altı özellik nöronu iki kavram nöronuna bağlı. Her kavram nöronu
   seviye 4'teki nöronun aynısı; aynı kuralla, birbirinden bağımsız öğrenir.
   path.js'teki yardımcıları ($, esc, L, R, refresh, toast…) kullanır.
------------------------------------------------------------------- */
let mAuto = 0,
  mLastCard = '';
function multiResetView() {
  mLastCard = '';
}
const MX = { fx: 150, fy0: 42, fdy: 52, fs: 46, cx: 520, cy: [112, 252], cr: 42 };

function multiStop() {
  if (!mAuto) return;
  clearInterval(mAuto);
  mAuto = 0;
  const b = document.querySelector('#mAuto');
  if (b) {
    b.textContent = 'Otomatik ▶';
    b.setAttribute('aria-pressed', 'false');
  }
}
const featNames = (lv, x) => lv.features.filter((f, i) => x[i]).map(f => f.name);
function answerWord(lv, outs) {
  const on = lv.outs.filter((o, k) => outs[k]);
  return on.length ? on.map(o => o.name).join(' + ') : 'hiçbiri';
}
const deckOk = (lv, st, c) => multiOutputs(c.x, st.W, st.th).every((o, k) => o === c.y[k]);

function multiGridHTML(lv) {
  return `<section class="bench has-card">
      <div class="bench-card">
        <div class="tcard-wrap" id="mcard"></div>
        <button class="btn primary big" id="mOne" data-glow="one">Bir kart göster</button>
        <div class="bench-more" data-lay="more"><button class="btn small" id="mRound">Bir tur</button><button class="btn small" id="mAuto" aria-pressed="false">Otomatik ▶</button><button class="btn ghost small" id="mReset">Boş beyin</button></div>
        <p class="hint" id="mNext"></p>
      </div>
      <div class="bench-scene"><div class="stage scene-wrap"><svg id="mscene" viewBox="0 0 730 350" role="img" aria-label="Özellik nöronları ve kavram nöronları"></svg></div>
        <p class="hint" data-lay="own" data-glow="own">Özellik nöronlarına tıklayarak kendi meyveni yapabilirsin.</p></div>
      <div class="bench-answer panel" id="manswer" aria-live="polite"></div>
    </section>
    <section class="strip" id="mstep" aria-live="polite" data-lay="strip"></section>
    <section class="bench-bottom three">
      <div class="panel" data-lay="deck"><div class="ph"><h3>Eğitim kartları</h3><span class="pc" id="mScore"></span></div>
        <p class="hint">Bir karta tıklarsan beyne sadece gösterilir; öğretmek için “Bir kart göster”i kullan.</p><div class="mdeck" id="mdeck"></div>
        <div class="lrounds"><div class="ph"><h3>Tur başına yanlış kart</h3><span class="pc" id="mRoundsN"></span></div><svg id="mrounds" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true"></svg><p class="hint" id="mRoundsHint"></p></div></div>
      <div class="panel" data-lay="cmp" data-glow="cmp"><h3>Ortak mı, farklı mı?</h3>
        <p class="hint">İki kart seç: hangi özellik nöronları ikisinde de ateşliyor, hangi kavram nöronu hangisinde?</p>
        <div class="row cmp-sel"><select id="cmpA" aria-label="Birinci kart"></select><span class="pc">ile</span><select id="cmpB" aria-label="İkinci kart"></select></div>
        <table class="tt cmp" id="cmpT"></table><p class="cmp-sum" id="cmpSum"></p></div>
      <div class="panel" data-lay="wt"><h3>Bağlantı tablosu</h3>
        <p class="hint">Her özellik nöronundan her kavram nöronuna giden bağlantının gücü. Aynı özellik iki nörona farklı sayılar verebilir.</p><table class="tt wt" id="wtT"></table></div>
    </section>`;
}

function wireMulti(lv) {
  const rec = R(),
    st = rec.st,
    svg = $('#mscene');
  // sahne
  let h = `<text class="coltitle" x="${MX.fx}" y="16">Özellik nöronları</text><text class="coltitle" x="335" y="16">Bağlantılar</text>
    <text class="coltitle" x="${MX.cx}" y="16">Kavram nöronları</text><text class="coltitle" x="652" y="16">Cevap</text>`;
  lv.features.forEach((f, i) => {
    const y = MX.fy0 + i * MX.fdy + MX.fs / 2;
    lv.outs.forEach((o, k) => {
      const x1 = MX.fx + MX.fs / 2 + 4,
        x2 = MX.cx - MX.cr - 4,
        y2 = MX.cy[k] + (i - 2.5) * 6;
      h += `<line class="syn" id="me${i}_${k}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}"/><line class="flow" id="mf${i}_${k}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}"/>`;
    });
  });
  h += `<g id="mdl"></g>`;
  lv.features.forEach((f, i) => {
    const y = MX.fy0 + i * MX.fdy;
    h += `<g class="inpx" id="mfn${i}" tabindex="0" role="button" data-i="${i}"><rect class="px-cell" id="mfc${i}" x="${MX.fx - MX.fs / 2}" y="${y}" width="${MX.fs}" height="${MX.fs}" rx="10"/>
      <text class="px-state emo small" x="${MX.fx}" y="${y + 32}">${f.icon}</text></g>
      <text class="fname" x="${MX.fx - MX.fs / 2 - 10}" y="${y + MX.fs / 2 + 5}">${esc(f.name)}</text>`;
  });
  lv.outs.forEach((o, k) => {
    const y = MX.cy[k];
    h += `<circle class="soma" id="mc${k}" cx="${MX.cx}" cy="${y}" r="${MX.cr}"/><text class="px-state emo" x="${MX.cx}" y="${y + 12}">${o.icon}</text>
      <text class="soma-sub" data-lay="sums" id="mct${k}" x="${MX.cx}" y="${y + MX.cr + 20}"></text>
      <line class="axon" id="max${k}" x1="${MX.cx + MX.cr}" y1="${y}" x2="${MX.cx + MX.cr + 40}" y2="${y}"/>
      <text class="out-t" id="mot${k}" x="${MX.cx + MX.cr + 50}" y="${y - 2}"></text><text class="out-s" id="mos${k}" x="${MX.cx + MX.cr + 50}" y="${y + 17}"></text>`;
  });
  svg.innerHTML = h;
  svg.querySelectorAll('.inpx').forEach(g => {
    const tog = () => {
      const s = R().st,
        i = +g.dataset.i;
      s.x = s.x.slice();
      s.x[i] = s.x[i] ? 0 : 1;
      s.shown = -1;
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
  // karşılaştırma seçimleri
  const opts = lv.deck
    .map((c, i) => `<option value="${i}">${c.icon} ${esc(c.name)}</option>`)
    .join('');
  ['cmpA', 'cmpB'].forEach((id, j) => {
    const sel = $('#' + id);
    sel.innerHTML = opts;
    sel.value = String(st.cmp[j]);
    sel.onchange = () => {
      const s = R().st;
      s.cmp = s.cmp.slice();
      s.cmp[j] = +sel.value;
      s.flags.compared = true;
      refresh();
    };
  });
  // öğrenme
  $('#mOne').onclick = () => mLearnOne();
  $('#mRound').onclick = () => {
    for (let k = 0; k < lv.deck.length; k++) mLearnOne(true);
    refresh();
  };
  $('#mAuto').onclick = () => {
    if (mAuto) {
      multiStop();
      return;
    }
    const b = $('#mAuto');
    b.textContent = 'Durdur ⏸';
    b.setAttribute('aria-pressed', 'true');
    mAuto = setInterval(() => mLearnOne(), reducedMotion ? 450 : 320);
  };
  $('#mReset').onclick = () => {
    multiStop();
    const s = R().st,
      i0 = lv.init();
    s.W = i0.W;
    s.th = i0.th;
    s.flags.learned = false;
    Object.assign(R(), { cursor: 0, steps: 0, rounds: [], roundMistakes: 0, last: null });
    refresh();
    toast('Boş beyin: bütün bağlantılar 0, eşikler 0. Görevlerin duruyor.');
  };
}

function mLearnOne(silent) {
  const lv = L(),
    rec = R(),
    st = rec.st,
    n = lv.deck.length,
    i = rec.cursor % n,
    c = lv.deck[i];
  const r = multiStep(c.x, st.W, st.th, c.y, st.rate);
  r.card = i;
  r.x = c.x.slice();
  r.y = c.y.slice();
  r.W0 = st.W.map(w => w.slice());
  r.th0 = st.th.slice();
  st.W = r.W;
  st.th = r.th;
  st.x = c.x.slice();
  st.shown = i;
  rec.cursor++;
  rec.steps++;
  rec.cardSeq = (rec.cardSeq || 0) + 1;
  rec.last = r;
  if (r.mistakes) rec.roundMistakes++;
  if (rec.cursor % n === 0) {
    rec.rounds.push(rec.roundMistakes);
    rec.rounds = rec.rounds.slice(-60);
    rec.roundMistakes = 0;
    if (mAuto && rec.rounds[rec.rounds.length - 1] === 0) {
      multiStop();
      toast('Bir tur boyunca hiç yanlış kart yok: öğrendi. Kural kendiliğinden durdu.');
    }
  }
  if (lv.deck.every(c => deckOk(lv, st, c)) && !st.flags.learned) {
    st.flags.learned = true;
    setTimeout(
      () => toast('Öğrendi! Altı kartın hepsini doğru biliyor. Bağlantı tablosuna bak.'),
      silent ? 0 : 600
    );
  }
  if (!silent) {
    mShowDeltas(lv, r);
    refresh();
  }
}

function mShowDeltas(lv, r) {
  if (reducedMotion) return;
  const g = $('#mdl');
  if (!g) return;
  r.per.forEach((p, k) => {
    if (!p.err) return;
    p.dw.forEach((d, i) => {
      if (!d) return;
      const e = $('#me' + i + '_' + k),
        x1 = +e.getAttribute('x1'),
        y1 = +e.getAttribute('y1'),
        x2 = +e.getAttribute('x2'),
        y2 = +e.getAttribute('y2'),
        t = 0.72;
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', x1 + (x2 - x1) * t);
      tx.setAttribute('y', y1 + (y2 - y1) * t - 4);
      tx.setAttribute('class', 'delta small ' + (d > 0 ? 'pos' : 'neg'));
      tx.textContent = sgn(d);
      g.appendChild(tx);
      setTimeout(() => tx.remove(), 1800);
    });
  });
}

function updateMulti(lv, rec) {
  const st = rec.st,
    outs = multiOutputs(st.x, st.W, st.th),
    sums = st.W.map(w => weightedSum(st.x, w));
  // sahne
  lv.features.forEach((f, i) => {
    const v = st.x[i];
    $('#mfc' + i).style.fill = `color-mix(in srgb, var(--light) ${v ? 100 : 0}%, var(--surface-2))`;
    $('#mfn' + i).classList.toggle('off', !v);
    $('#mfn' + i).setAttribute('aria-pressed', v ? 'true' : 'false');
    $('#mfn' + i).setAttribute('aria-label', `${f.name}: ${v ? 'ateşliyor' : 'sessiz'}. Değiştir`);
    lv.outs.forEach((o, k) => {
      const w = st.W[k][i],
        aw = Math.min(Math.abs(w), 1),
        kind = Math.abs(w) < 1e-9 ? 'zero' : w > 0 ? 'pos' : 'neg';
      const e = $('#me' + i + '_' + k);
      e.setAttribute('class', 'syn ' + kind);
      e.style.strokeWidth = kind === 'zero' ? 1 : 1.2 + 3.6 * aw;
      const fl = $('#mf' + i + '_' + k);
      fl.setAttribute('class', 'flow ' + kind);
      fl.style.opacity = v && kind !== 'zero' ? clamp(0.4 + aw * 0.6, 0, 1) : 0;
      fl.style.strokeWidth = 1.2 + 3.6 * aw;
    });
  });
  lv.outs.forEach((o, k) => {
    $('#mc' + k).classList.toggle('on', !!outs[k]);
    $('#mct' + k).textContent =
      `toplam ${num(sums[k])} ${outs[k] ? '≥' : '<'} eşik ${num(st.th[k])}`;
    $('#max' + k).classList.toggle('on', !!outs[k]);
    const t = $('#mot' + k);
    t.textContent = outs[k] ? o.name.toLocaleUpperCase('tr-TR') + '!' : 'sessiz';
    t.classList.toggle('on', !!outs[k]);
    $('#mos' + k).textContent = `${o.name} nöronu`;
  });
  // gösterilen şey ve cevap
  const c = st.shown >= 0 ? lv.deck[st.shown] : null,
    fn = featNames(lv, st.x);
  const word = answerWord(lv, outs),
    right = c ? answerWord(lv, c.y) : null,
    ok = c ? deckOk(lv, st, c) : null;
  $('#manswer').innerHTML =
    `<div class="ans-l">Beynin şimdiki cevabı</div><div class="ans-big ${outs.some(Boolean) ? 'on' : ''}" data-fl="ans">${esc(word.toLocaleUpperCase('tr-TR'))}</div>
    <div class="ans-sub">${c ? `gösterilen: ${c.icon} ${esc(c.name)}` : 'kendi meyven'}</div>
    ${c ? `<div class="ans-v ${ok ? 'ok' : 'bad'}">doğru cevap: <b>${esc(right)}</b> ${ok ? '✓' : '✗'}</div>` : ''}
    <div class="calc">${lv.outs.map((o, k) => `<div class="cl">${o.icon} ${esc(o.name)}: toplam <b data-fl="ms${k}">${num(sums[k])}</b> ${outs[k] ? '≥' : '<'} eşik <b>${num(st.th[k])}</b></div>`).join('')}
      <div class="cl dimtxt">${fn.length ? esc(fn.join(', ')) : 'hiçbir özellik yok'}</div></div>`;
  // eğitim kartları
  const okN = lv.deck.filter(c => deckOk(lv, st, c)).length;
  $('#mScore').textContent = `${okN}/${lv.deck.length} doğru`;
  const dk = $('#mdeck');
  dk.innerHTML = lv.deck
    .map((c, i) => {
      const ok = deckOk(lv, st, c),
        o = multiOutputs(c.x, st.W, st.th);
      return `<button class="mcard ${st.shown === i ? 'cur' : ''} ${ok ? 'ok' : 'bad'}" data-i="${i}"><span class="mc-i ${c.cls || ''}" aria-hidden="true">${c.icon}</span><span class="mc-n">${esc(c.name)}</span>
      <span class="mc-a">doğru: ${esc(answerWord(lv, c.y))}</span><span class="mc-b">beyin: ${esc(answerWord(lv, o))} ${ok ? '✓' : '✗'}</span></button>`;
    })
    .join('');
  dk.querySelectorAll('.mcard').forEach(
    b =>
      (b.onclick = () => {
        const s = R().st,
          i = +b.dataset.i;
        s.x = lv.deck[i].x.slice();
        s.shown = i;
        refresh();
      })
  );
  renderCompare(lv, st);
  renderWeights(lv, st);
  updateMultiLearn(lv, rec);
}

function renderCompare(lv, st) {
  const A = lv.deck[st.cmp[0]],
    B = lv.deck[st.cmp[1]],
    dot = v => (v ? '<span class="dot-on">●</span>' : '<span class="dot-off">○</span>');
  const both = [],
    onlyA = [],
    onlyB = [];
  let h = `<thead><tr><th>nöron</th><th>${A.icon} ${esc(A.name)}</th><th>${B.icon} ${esc(B.name)}</th><th></th></tr></thead><tbody>`;
  lv.features.forEach((f, i) => {
    const a = A.x[i],
      b = B.x[i],
      tag = a && b ? 'ortak' : a ? 'sadece 1.' : b ? 'sadece 2.' : '';
    if (a && b) both.push(f.name);
    else if (a) onlyA.push(f.name);
    else if (b) onlyB.push(f.name);
    h += `<tr class="${a && b ? 'both' : ''}"><td>${f.icon} ${esc(f.name)}</td><td>${dot(a)}</td><td>${dot(b)}</td><td class="tag">${tag}</td></tr>`;
  });
  const oA = multiOutputs(A.x, st.W, st.th),
    oB = multiOutputs(B.x, st.W, st.th);
  lv.outs.forEach((o, k) => {
    h += `<tr class="concept"><td>${o.icon} ${esc(o.name)} nöronu</td><td>${dot(oA[k])}</td><td>${dot(oB[k])}</td><td class="tag">${oA[k] && oB[k] ? 'ikisinde de' : ''}</td></tr>`;
  });
  $('#cmpT').innerHTML = h + '</tbody>';
  const uni = both.length + onlyA.length + onlyB.length,
    pc = uni ? Math.round((both.length / uni) * 100) : 0;
  const conc = (o, name) => {
    const on = lv.outs.filter((x, k) => o[k]).map(x => x.name + ' nöronu');
    return on.length
      ? `${name} kartında ${on.join(' ve ')} ateşliyor`
      : `${name} kartında hiçbir kavram nöronu ateşlemiyor`;
  };
  $('#cmpSum').innerHTML =
    A === B
      ? 'Aynı kartı iki kez seçtin; farklı iki kart seç.'
      : `<b>Özellik nöronları:</b> ${both.length ? `${both.length} tanesi ikisinde de ateşliyor (${esc(both.join(', '))})` : 'ortak ateşleyen yok'}; ${onlyA.length} tanesi sadece 1. kartta, ${onlyB.length} tanesi sadece 2. kartta. Ortaklık: ${both.length} ÷ ${uni} = %${pc}.<br>
      <b>Kavram nöronları:</b> ${esc(conc(oA, A.name))}; ${esc(conc(oB, B.name))}.${st.flags.learned ? '' : ' (Beyin henüz öğrenmedi; bu kısım öğrendikten sonra anlam kazanır.)'}`;
}

function renderWeights(lv, st) {
  const cell = w => {
    const a = Math.min(Math.abs(w), 1),
      col = w > 0 ? 'var(--pos)' : 'var(--neg)';
    return `<td class="num wcell" style="background:${Math.abs(w) < 1e-9 ? 'transparent' : `color-mix(in srgb, ${col} ${Math.round(12 + a * 45)}%, var(--surface))`}">${sgn(w)}</td>`;
  };
  let h = `<thead><tr><th>özellik</th>${lv.outs.map(o => `<th>${o.icon} ${esc(o.name)}</th>`).join('')}</tr></thead><tbody>`;
  lv.features.forEach((f, i) => {
    h += `<tr><td>${f.icon} ${esc(f.name)}</td>${lv.outs.map((o, k) => cell(st.W[k][i]).replace('<td ', `<td data-fl="w${k}_${i}" `)).join('')}</tr>`;
  });
  h += `<tr class="concept"><td>eşik</td>${lv.outs.map((o, k) => `<td class="num" data-fl="t${k}">${num(st.th[k])}</td>`).join('')}</tr>`;
  $('#wtT').innerHTML = h + '</tbody>';
}

function mStepHTML(lv, r) {
  const c = lv.deck[r.card],
    act = featNames(lv, r.x);
  const boxes = [
    {
      t: 'Kart',
      h: `${c.icon} <b>${esc(c.name)}</b><br>${esc(act.join(', '))}<br>doğru cevap: <b>${esc(answerWord(lv, r.y))}</b>`
    }
  ];
  r.per.forEach((p, k) => {
    const o = lv.outs[k],
      head = `toplam ${num(p.sum)} ${p.out ? '≥' : '<'} eşik ${num(r.th0[k])} → ${p.out ? 'ateşledi' : 'sustu'}`;
    if (!p.err) {
      boxes.push({
        t: `${o.icon} ${esc(o.name)} nöronu`,
        cls: 'ok',
        h: `${head}<br><span class="mk-ok">doğru ✓</span> → değişiklik yok`
      });
      return;
    }
    boxes.push({
      t: `${o.icon} ${esc(o.name)} nöronu`,
      cls: 'bad',
      h: `${head}<br><span class="mk-bad">hata ${p.err > 0 ? '+1' : '−1'}</span>: ${p.err > 0 ? 'ateşlemeliydi' : 'susmalıydı'}
      <div class="chg ${p.err > 0 ? 'up' : 'down'}">${esc(act.join(', '))} → ${esc(o.name)} bağlantıları <b>${p.err > 0 ? '+' : '−'}0,2</b></div>
      <div class="chg ${p.dtheta < 0 ? 'up' : 'down'}">eşik <b>${num(r.th0[k])} → ${num(p.theta)}</b></div>`
    });
  });
  if (r.per.filter(p => p.err).length === 1)
    boxes.push({
      t: 'Not',
      h: 'Öbür nöronun bağlantılarına dokunulmadı: her nöron sadece kendi hatasından öğrenir.'
    });
  return stripHTML(boxes);
}

function mCardHTML(lv, c, outs, label) {
  const ok = outs ? outs.every((o, k) => o === c.y[k]) : null;
  return `<div class="tcard ${ok == null ? '' : ok ? 'ok' : 'bad'}">
    <div class="tc-top">${esc(label)}</div>
    <div class="tc-fruit"><span class="${c.cls || ''}" aria-hidden="true">${c.icon}</span><span class="tc-scn">${esc(c.name)}</span></div>
    <div class="tc-chips">${lv.features.map((f, i) => (c.x[i] ? `<span class="chipf">${f.icon} ${esc(f.name)}</span>` : '')).join('')}</div>
    <div class="tc-ans">Doğru cevap: <b>${esc(answerWord(lv, c.y))}</b></div>
    <div class="tc-guess">${outs ? `Beyin o an: <b>${esc(answerWord(lv, outs))}</b> ${ok ? '✓' : '✗'}` : 'Beyin henüz görmedi'}</div>
  </div>`;
}

function updateMultiLearn(lv, rec) {
  const n = lv.deck.length,
    nx = lv.deck[rec.cursor % n],
    wrap = $('#mcard');
  $('#mNext').textContent =
    `Sıradaki kart: ${nx.icon} ${nx.name}. Kartlar hep aynı sırayla gelir; altısı bir tur eder.`;
  let key;
  if (rec.last) {
    const r = rec.last;
    wrap.innerHTML = mCardHTML(
      lv,
      lv.deck[r.card],
      r.per.map(p => p.out),
      'Öğretmenin kartı'
    );
    key = 'c' + rec.cardSeq;
    if (key !== mLastCard) $('#mstep').innerHTML = mStepHTML(lv, r);
  } else {
    wrap.innerHTML = mCardHTML(lv, nx, null, 'Sıradaki kart');
    $('#mstep').innerHTML =
      `<div class="ph-box empty"><div class="ph-b">Henüz kart gösterilmedi. Soldaki <b>“Bir kart göster”</b>e bas: öğretmen kartı gösterir, iki kavram nöronu da tahmin eder, yanılan kendi bağlantılarını düzeltir. Her nöronun ne yaptığı burada yan yana görünecek.</div></div>`;
    key = 'n' + rec.cursor;
  }
  if (key !== mLastCard && !mAuto && !reducedMotion) wrap.firstElementChild.classList.add('deal');
  mLastCard = key;
  const rs = rec.rounds,
    svg = $('#mrounds'),
    cnt = Math.max(15, rs.length),
    bw = 400 / cnt,
    u = 60 / n;
  let h = '';
  for (let k = 0; k <= n; k += 2)
    h += `<line class="r-grid" x1="0" x2="400" y1="${60 - k * u}" y2="${60 - k * u}"/>`;
  rs.forEach((m, k) => {
    h += m
      ? `<rect class="r-bar" x="${k * bw + 1}" y="${60 - m * u}" width="${Math.max(1, bw - 2)}" height="${m * u}"/>`
      : `<rect class="r-zero" x="${k * bw + 1}" y="57" width="${Math.max(1, bw - 2)}" height="3"/>`;
  });
  svg.innerHTML = h;
  $('#mRoundsN').textContent = rs.length ? `${rs.length} tur` : '';
  const last = rs[rs.length - 1];
  $('#mRoundsHint').textContent = !rs.length
    ? `Her çubuk bir tur: o turda kaç kartta en az bir nöronun yanıldığı (0–${n}). Yeşil çizgi hatasız tur.`
    : last === 0
      ? 'Son tur hatasız: öğrendi.'
      : `Son turda ${last} kartta yanlış vardı.`;
}
