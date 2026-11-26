'use strict';
/* ------------------------------------------------------------------
   SEVİYE 14 görünümü: Ezber mi, anlamak mı?
   Solda göz ve öğret/sor; ortada iki öğrencinin cevabı yan yana;
   altta sınav ve son sorular. Model: js/levels/14-general.js
------------------------------------------------------------------- */
let gnNet = null,
  gnExamItems = null;
function generalResetView() {
  gnNet = null;
  gnExamItems = null;
}
function generalGridHTML(lv) {
  return `<section class="bench gn-bench">
    <div class="panel gn-eye">
      <div class="ph"><h3>Göz</h3><span class="pc">iki öğrenci de aynı şeyi görür</span></div>
      ${pixelGridHTML('gnGrid')}
      <div class="sh-tools"><button class="btn small" id="gnClear">Temizle</button><button class="btn small" id="gnSample">Örnek çiz</button></div>
      <span class="sh-q">Bu çizim aslında ne?</span>
      <div class="sh-chips" id="gnChips" role="group" aria-label="Şeklin adı"></div>
      <div class="sh-acts"><button class="btn primary" id="gnTeach"></button><button class="btn" id="gnAsk">Sor (öğretmeden)</button></div>
    </div>
    <div class="panel gn-panel" id="gnMemo"></div>
    <div class="panel gn-panel" id="gnCortex"></div>
  </section>
  <section class="gn-bottom">
    <div class="panel"><div class="ph"><h3>Sınav: hiç görmedikleri 30 çizim</h3><button class="btn" id="gnExam">📝 Sınava sok</button></div><div id="gnExamBox"></div></div>
    <div class="panel"><div class="ph"><h3>Son sorular</h3><span class="pc" id="gnCount"></span></div><div class="llog-wrap"><table class="tt" id="gnLog"></table></div></div>
  </section>`;
}
function wireGeneral(lv) {
  const st = R().st;
  gnNet = genReplay(st);
  gnExamItems = null;
  wirePixelGrid(
    'gnGrid',
    () => st.bits,
    (i, v) => {
      st.bits[i] = v;
      st.drawnFor = st.label;
      refresh();
    }
  );
  $('#gnClear').onclick = () => {
    st.bits = new Array(35).fill(0);
    st.drawnFor = null;
    refresh();
  };
  $('#gnSample').onclick = () => {
    // “yeni çizim” görevinde öğretilenlerden belirgin farklı bir çizim
    const fresh = curMission(lv, R()) === 'new';
    st.bits = noisyBits(
      GEN.protos[st.label],
      fresh ? 3 : 1 + Math.floor(Math.random() * 2),
      Math.random
    );
    st.drawnFor = st.label;
    refresh();
  };
  $('#gnChips').addEventListener('click', e => {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    st.label = +b.dataset.l;
    refresh();
  });
  $('#gnTeach').onclick = () => {
    if (st.bits.every(b => !b)) return toast('Önce göze bir şey çiz.');
    genTeach(st, gnNet, st.bits, st.label);
    gnExamItems = null;
    toast(
      `İkisine de öğretildi: ${GEN.names[st.label].toLocaleLowerCase('tr-TR')} (${st.examples.length}. örnek)`
    );
    refresh();
  };
  $('#gnAsk').onclick = () => {
    if (st.bits.every(b => !b)) return toast('Önce göze bir şey çiz.');
    if (!st.examples.length) return toast('Önce en az bir örnek öğret.');
    genAsk(st, gnNet, st.bits, st.label);
    refresh();
  };
  $('#gnExam').onclick = () => {
    if (!st.examples.length) return toast('Önce birkaç örnek öğret.');
    gnExamItems = genExam(st, gnNet, 99 + st.examples.length).items;
    refresh();
  };
}
function gnSuggest(lv, rec) {
  const st = rec.st,
    act = curMission(lv, rec),
    on = st.bits.reduce((a, b) => a + b, 0),
    same = (a, b) => a.every((v, i) => v === b[i]),
    taught = st.examples.some(e => same(e.bits, st.bits)),
    last = st.asks[0],
    askedHere = last && same(last.bits, st.bits);
  const s = { ids: [], chip: -1 };
  if (act === 'one') s.ids.push(on < 4 ? 'gnSample' : 'gnTeach');
  else if (act === 'over') {
    if (st.label !== 2) s.chip = 2;
    else if (st.drawnFor !== 2 || on < 4) s.ids.push('gnSample');
    else s.ids.push('gnAsk');
  } else if (act === 'all') {
    const target = st.counts[st.label] >= 2 ? st.counts.indexOf(Math.min(...st.counts)) : st.label;
    if (target !== st.label) s.chip = target;
    else if (on < 4 || st.drawnFor !== st.label || taught) s.ids.push('gnSample');
    else s.ids.push('gnTeach');
  } else if (act === 'new') {
    if (on < 4 || taught || st.drawnFor !== st.label || askedHere || genMemo(st, st.bits).d <= 1)
      s.ids.push('gnSample');
    else s.ids.push('gnAsk');
  } else if (act === 'exam') s.ids.push('gnExam');
  return s;
}
function updateGeneral(lv, rec) {
  const st = rec.st,
    sug = gnSuggest(lv, rec);
  if (!gnNet) gnNet = genReplay(st);
  paintPixelGrid('gnGrid', st.bits);
  $('#gnChips').innerHTML = GEN.names
    .map(
      (n, i) =>
        `<button class="sh-chip ${i === sug.chip ? 'psug' : ''}" data-l="${i}" aria-pressed="${i === st.label}">${n} <small>${st.counts[i]}</small></button>`
    )
    .join('');
  $('#gnTeach').textContent = `Öğret: bu bir ${GEN.names[st.label].toLocaleLowerCase('tr-TR')}`;
  for (const id of ['gnTeach', 'gnAsk', 'gnSample', 'gnExam'])
    $('#' + id).classList.toggle('psug', sug.ids.includes(id));
  // iki öğrenci: şu anki çizime ne derlerdi?
  const on = st.bits.some(b => b),
    memo = genMemo(st, st.bits),
    p = Array.from(gnNet.predict(st.bits)),
    g = p.indexOf(Math.max(...p)),
    any = st.examples.length > 0;
  const low = s => s.toLocaleLowerCase('tr-TR');
  $('#gnMemo').innerHTML =
    `<div class="ph"><h3>📒 Ezberci</h3><span class="pc">hipokampus gibi</span></div>
    <p class="gn-how">Her örneği olduğu gibi defterine yazar. Bir kerede öğrenir.</p>
    <div class="gn-say ${!on || !any ? '' : memo.y === null ? 'unk' : 'sure'}">${!on ? 'Önce bir şey çiz.' : !any ? 'Defteri boş.' : memo.y === null ? '“Bunu hatırlamıyorum.”' : `“Bu bir ${low(GEN.names[memo.y])}. Aynısını görmüştüm.”`}</div>
    <p class="hint">Defterinde ${st.examples.length} çizim var.${on && any ? ` Bu çizim en yakın olanından ${memo.d} piksel farklı.` : ''}</p>
    <div class="gn-book">${st.examples
      .slice(-12)
      .map(e => shMini(e.bits, 5))
      .join('')}</div>`;
  $('#gnCortex').innerHTML =
    `<div class="ph"><h3>🧠 Kavrayan</h3><span class="pc">beyin kabuğu gibi</span></div>
    <p class="gn-how">Her örnekte bağlantılarını biraz düzeltir. Yavaş öğrenir, ortak yanı çıkarır.</p>
    <div class="gn-say ${!on || !any ? '' : p[g] >= 0.6 ? 'sure' : 'unk'}">${!on ? 'Önce bir şey çiz.' : !any ? 'Henüz hiçbir şey öğrenmedi.' : p[g] >= 0.6 ? `“Bence bu bir ${low(GEN.names[g])}.”` : `“Emin değilim… ${low(GEN.names[g])} olabilir.”`}</div>
    <div class="sh-bars">${GEN.names
      .map(
        (n, i) =>
          `<div class="sh-bar ${i === g && on && any ? 'top' : ''}"><span class="sh-bl">${n}</span><span class="sh-bt"><i style="width:${Math.round(p[i] * 100)}%"></i></span><span class="sh-bv">%${Math.round(p[i] * 100)}</span></div>`
      )
      .join('')}</div>`;
  // sınav
  const ex = st.exam;
  $('#gnExamBox').innerHTML = ex
    ? `<div class="gn-score"><div><small>📒 Ezberci</small><b>${ex.memo}/${ex.n}</b></div><div><small>🧠 Kavrayan</small><b>${ex.cortex}/${ex.n}</b></div></div>
      ${gnExamItems ? `<div class="gn-cards">${gnExamItems.map(it => `<span class="gn-card" title="${GEN.names[it.y]}">${shMini(it.bits, 4)}<i class="${it.m === it.y ? 'ok' : 'no'}">📒</i><i class="${it.c === it.y ? 'ok' : 'no'}">🧠</i></span>`).join('')}</div><p class="hint">Her kartın altında: renkli = doğru bildi, soluk = bilemedi.</p>` : '<p class="hint">Kartları tek tek görmek için sınavı yeniden yap.</p>'}`
    : `<p class="hint">Sınav kartlarının hiçbiri öğrettiğin çizimlere iki pikselden yakın değil: ikisi de bunları ilk kez görecek.</p>`;
  $('#gnCount').textContent = `${st.examples.length} örnek öğretildi`;
  $('#gnLog').innerHTML = st.asks.length
    ? `<thead><tr><th>çizim</th><th>aslında</th><th>📒 ezberci</th><th>🧠 kavrayan</th></tr></thead><tbody>${st.asks
        .map(
          a =>
            `<tr><td>${shMini(a.bits, 4)}</td><td>${GEN.names[a.y]}</td><td class="${a.memo === a.y ? 'ok' : 'bad'}">${a.memo === null ? 'hatırlamıyorum' : GEN.names[a.memo]}</td><td class="${a.cortex === a.y ? 'ok' : 'bad'}">${GEN.names[a.cortex]} (%${a.p})</td></tr>`
        )
        .join('')}</tbody>`
    : `<tbody><tr><td class="hint">“Sor”a bastıkça ikisinin cevabı buraya yazılır.</td></tr></tbody>`;
}
