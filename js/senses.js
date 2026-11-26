'use strict';
/* ------------------------------------------------------------------
   SEVİYE 10: beş duyu, tek kavram (eğitilmiş ağ, eğitim yok)
   Kart / yazı / tat / koku / ses → duyu nöronları (59) → duyu alanları (28)
   → kavram nöronları (10) → çıktı (10 ad + 3 tür).
   Model: sensesRun/sensesCommit (levels.js). Sesler Web Audio ile üretilir.
------------------------------------------------------------------- */
let svLastStep = '',
  svAC = null;
function sensesResetView() {
  svLastStep = '';
}
const SZ = {
  rows: {
    vis: [34, 150],
    word: [160, 300],
    smell: [310, 382],
    sound: [392, 468],
    taste: [478, 566]
  },
  bx: 150,
  cx: 452,
  kx: 738,
  ex: 880
};
const svPct = v => '%' + Math.round(v * 100);
const svN = v => num(v, 2);
const SV_SENSE = [
  { k: 'vis', icon: '👁', name: 'görme' },
  { k: 'word', icon: '📖', name: 'okuma' },
  { k: 'smell', icon: '👃', name: 'koku' },
  { k: 'sound', icon: '👂', name: 'işitme' },
  { k: 'taste', icon: '👅', name: 'tat' }
];

function sensesGridHTML(lv) {
  const T = SENSES.things;
  return `<section class="bench has-card">
      <div class="bench-card pact sact">
        <div class="pstep-h">🃏 Kart göster</div>
        <div class="sgrid5">${T.map((t, k) => `<button class="btn sb" id="sc${k}" title="${esc(t.name)} kartı">${t.icon}</button>`).join('')}</div>
        <div class="pstep-h" data-lay="word">📖 Yazı göster</div>
        <div class="srow" data-lay="word"><input class="txt sword" id="sWord" maxlength="12" placeholder="ör. LİMON" autocomplete="off" spellcheck="false"><button class="btn small" id="sWordGo">Göster</button><button class="btn small" id="sWordRnd" title="Rastgele bir kelime">🎲</button></div>
        <div class="pstep-h" data-lay="taste">👅 Tat ver</div>
        <div class="sgrid5" data-lay="taste">${SENSES.tastes.map((t, k) => `<button class="btn sb tall" id="st${k}" title="${esc(t.name)}">${t.icon}<small>${esc(t.name)}</small></button>`).join('')}</div>
        <div class="pstep-h" data-lay="smell">👃 Koklat</div>
        <div class="sgrid5" data-lay="smell">${SENSES.smells.map((s, k) => `<button class="btn sb tall" id="sm${k}" title="${esc(s.name)}">${s.icon}<small>koku</small></button>`).join('')}</div>
        <div class="pstep-h" data-lay="sound">🔊 Ses çal</div>
        <div class="srow" data-lay="sound">${SENSES.sounds.map((s, k) => `<button class="btn small" id="ss${k}">${s.icon} ${esc(s.name)}</button>`).join('')}</div>
        <p class="pnext" id="sNext" aria-live="polite"></p>
        <div class="bench-more pquick" data-lay="clear"><button class="btn ghost small" id="sClr">🧹 Hepsini temizle</button></div>
      </div>
      <div class="bench-scene"><div class="stage scene-wrap"><svg id="sscene" viewBox="0 0 1000 576" role="img" aria-label="Soldan sağa: girdi, duyu nöronları, duyu alanları, kavram nöronları ve çıktı"></svg></div></div>
      <div class="bench-answer panel" id="sanswer" aria-live="polite"></div>
    </section>
    <section class="strip" id="sstep" aria-live="polite" data-lay="strip"></section>
    <section class="bench-bottom">
      <div class="panel" data-lay="mat"><div class="ph"><h3>Hangi kavrama hangi duyuyla ulaşılır?</h3></div>
        <div class="llog-wrap"><table class="tt smat" id="smat"></table></div>
        <p class="hint">✓: o duyunun bu kavrama giden bir yolu var. Renkli hücre: şu an o yoldan gelen destek.</p></div>
      <div class="panel" data-lay="log"><h3>Son denemeler</h3><div class="llog-wrap"><table class="tt" id="slog"></table></div></div>
    </section>`;
}

function wireSenses(lv) {
  const svg = $('#sscene'),
    T = SENSES.things,
    R0 = SZ.rows;
  let h = `<text class="coltitle" x="68" y="18">Girdi</text><text class="coltitle" x="270" y="18">1 · Duyu nöronları</text>
    <text class="coltitle" x="${SZ.cx + 62}" y="18">2 · Duyu alanları</text><text class="coltitle" x="${SZ.kx + 20}" y="18">3 · Kavram</text><text class="coltitle" x="${SZ.ex + 50}" y="18">4 · Çıktı</text>
    <g id="sl1"></g><g id="sl2"></g><g id="sl3"></g>`;
  SV_SENSE.forEach(s => {
    const [y0, y1] = R0[s.k];
    h += `<rect class="sblock" x="6" y="${y0}" width="${SZ.cx + 170}" height="${y1 - y0 - 4}" rx="10"/>
      <text class="sbl" x="14" y="${y0 + 16}">${s.icon} ${s.name}</text><g id="sin-${s.k}"></g>`;
  });
  // 1 · duyu nöronları
  SENSES.vis.forEach((f, i) => {
    const x = SZ.bx + 18 + (i % 7) * 36,
      y = R0.vis[0] + 30 + Math.floor(i / 7) * 36;
    h += `<circle class="sn" id="nv${i}" cx="${x}" cy="${y}" r="10"><title>${esc(f)}</title></circle>`;
  });
  h += `<text class="sfl" id="nvT" x="${SZ.bx + 8}" y="${R0.vis[1] - 12}"></text>`;
  SENSES.letters.forEach((c, i) => {
    const x = SZ.bx + 8 + (i % 10) * 26,
      y = R0.word[0] + 14 + Math.floor(i / 10) * 30;
    h += `<rect class="sltr" id="nl${i}" x="${x}" y="${y}" width="22" height="24" rx="4"/><text class="sltr-t" id="nlt${i}" x="${x + 11}" y="${y + 17}">${c}</text>`;
  });
  for (let i = 0; i < 6; i++) {
    const x = SZ.bx + 18 + i * 40,
      y = R0.smell[0] + 30;
    h += `<circle class="sn" id="no${i}" cx="${x}" cy="${y}" r="11"/><text class="sml" x="${x}" y="${y + 26}">R${i + 1}</text>`;
  }
  for (let i = 0; i < 6; i++) {
    const x = SZ.bx + 8 + i * 40;
    h += `<rect class="sbar-bg" x="${x}" y="${R0.sound[0] + 12}" width="22" height="40" rx="3"/><rect class="sbar" id="na${i}" x="${x}" y="${R0.sound[0] + 52}" width="22" height="0" rx="3"/>`;
  }
  h += `<text class="sml" x="${SZ.bx + 8}" y="${R0.sound[0] + 66}" style="text-anchor:start">pes</text><text class="sml" x="${SZ.bx + 230}" y="${R0.sound[0] + 66}" style="text-anchor:end">tiz</text>`;
  SENSES.tastes.forEach((t, i) => {
    const x = SZ.bx + 20 + i * 48,
      y = R0.taste[0] + 34;
    h += `<circle class="sn" id="nt${i}" cx="${x}" cy="${y}" r="14"/><text class="pemo" x="${x}" y="${y + 5}" style="font-size:14px">${t.icon}</text><text class="sml" x="${x}" y="${y + 30}">${esc(t.name)}</text>`;
  });
  // 2 · duyu alanları (tanıyıcılar)
  T.forEach((t, k) => {
    const x = SZ.cx + 14 + (k % 5) * 30,
      y = R0.vis[0] + 44 + Math.floor(k / 5) * 40;
    h += `<circle class="srec" id="rv${k}" cx="${x}" cy="${y}" r="12"/><text class="pemo" x="${x}" y="${y + 5}" style="font-size:13px">${t.icon}</text>`;
  });
  h += `<text class="sml" x="${SZ.cx + 74}" y="${R0.vis[1] - 12}">görsel nesne tanıyıcılar</text>`;
  T.forEach((t, k) => {
    const x = SZ.cx + (k % 5) * 35 - 8,
      y = R0.word[0] + 30 + Math.floor(k / 5) * 40;
    h += `<rect class="srec" id="rw${k}" x="${x}" y="${y}" width="33" height="24" rx="5"/><text class="srw" x="${x + 16.5}" y="${y + 16}">${t.word}</text>`;
  });
  h += `<text class="sml" x="${SZ.cx + 74}" y="${R0.word[1] - 12}">kelime tanıyıcılar</text>`;
  SENSES.smells.forEach((s, k) => {
    const x = SZ.cx + 14 + k * 30,
      y = R0.smell[0] + 30;
    h += `<circle class="srec" id="ro${k}" cx="${x}" cy="${y}" r="12"/><text class="pemo" x="${x}" y="${y + 5}" style="font-size:13px">${s.icon}</text>`;
  });
  h += `<text class="sml" x="${SZ.cx + 74}" y="${R0.smell[1] - 10}">koku tanıyıcılar</text>`;
  SENSES.sounds.forEach((s, k) => {
    const x = SZ.cx + 14 + k * 30,
      y = R0.sound[0] + 30;
    h += `<circle class="srec" id="ra${k}" cx="${x}" cy="${y}" r="12"/><text class="pemo" x="${x}" y="${y + 5}" style="font-size:13px">${s.icon}</text>`;
  });
  h += `<text class="sml" x="${SZ.cx + 74}" y="${R0.sound[1] - 10}">ses tanıyıcılar</text>
    <text class="sml" x="${SZ.cx + 60}" y="${R0.taste[0] + 38}">tat doğrudan kavrama gider →</text><circle class="srec" id="thub" cx="${SZ.cx + 150}" cy="${R0.taste[0] + 34}" r="6"/>`;
  // 3 · kavram nöronları
  T.forEach((t, k) => {
    const y = 48 + k * 52;
    h += `<circle class="soma sk" id="kc${k}" cx="${SZ.kx}" cy="${y}" r="21"/><text class="pemo" x="${SZ.kx}" y="${y + 7}" style="font-size:20px">${t.icon}</text>
    <text class="skn" id="kn${k}" x="${SZ.kx + 28}" y="${y - 2}">${esc(t.name)}</text><text class="skp" id="kp${k}" x="${SZ.kx + 28}" y="${y + 13}"></text>`;
  });
  // 4 · çıktı: konuşma balonu + tür nöronları
  h += `<rect class="hbub" x="${SZ.ex - 58}" y="32" width="174" height="96" rx="18"/><text class="pemo" id="oI" x="${SZ.ex + 29}" y="78" style="font-size:30px"></text>
    <text class="soma-sub" id="oT" x="${SZ.ex + 29}" y="108" style="font-size:15px"></text>`;
  SENSES.cats.forEach((c, j) => {
    const y = 210 + j * 110;
    h += `<circle class="soma sk" id="oc${j}" cx="${SZ.ex + 29}" cy="${y}" r="28"/><text class="pemo" x="${SZ.ex + 29}" y="${y + 7}" style="font-size:20px">${c.icon}</text>
    <text class="soma-sub" x="${SZ.ex + 29}" y="${y + 46}" style="font-size:13px">${c.name}</text><text class="skp" id="op${j}" x="${SZ.ex + 29}" y="${y + 62}" style="text-anchor:middle"></text>`;
  });
  // kullanılmayan duyuların satırları soluklaşır (dikkat kullanılan yola gitsin)
  SV_SENSE.forEach(s => {
    const [y0, y1] = R0[s.k];
    h += `<rect class="sveil" id="sveil-${s.k}" x="4" y="${y0 - 2}" width="${SZ.cx + 174}" height="${y1 - y0}" rx="10"/>`;
  });
  svg.innerHTML = h;
  // girdiler
  const st = () => R().st,
    go = () => {
      sensesCommit(st());
      refresh();
    };
  T.forEach(
    (t, k) =>
      ($('#sc' + k).onclick = () => {
        st().card = st().card === k ? null : k;
        go();
      })
  );
  const showWord = () => {
    st().word = sWordNorm($('#sWord').value);
    $('#sWord').value = st().word;
    go();
  };
  $('#sWordGo').onclick = showWord;
  $('#sWord').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      showWord();
    }
  });
  $('#sWordRnd').onclick = () => {
    const w = T[Math.floor(Math.random() * T.length)].word;
    $('#sWord').value = w;
    showWord();
  };
  SENSES.tastes.forEach(
    (t, k) =>
      ($('#st' + k).onclick = () => {
        const a = st().taste.slice();
        a[k] = a[k] ? 0 : 1;
        st().taste = a;
        go();
      })
  );
  SENSES.smells.forEach(
    (s, k) =>
      ($('#sm' + k).onclick = () => {
        st().smell = st().smell === k ? null : k;
        go();
      })
  );
  SENSES.sounds.forEach(
    (s, k) =>
      ($('#ss' + k).onclick = () => {
        const on = st().sound !== k;
        st().sound = on ? k : null;
        if (on) svPlay(k);
        go();
      })
  );
  $('#sClr').onclick = () => {
    sensesClear(st());
    $('#sWord').value = '';
    refresh();
  };
  $('#sWord').value = st().word || '';
}

// Sesleri tarayıcıda üret (dosya yok)
function svPlay(k) {
  try {
    svAC = svAC || new (window.AudioContext || window.webkitAudioContext)();
    const c = svAC,
      t = c.currentTime,
      out = c.createGain();
    out.gain.value = 0.18;
    out.connect(c.destination);
    const env = (g, a, b, peak) => {
      g.gain.setValueAtTime(0.0001, a);
      g.gain.exponentialRampToValueAtTime(peak, a + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, b);
    };
    if (k === 0) {
      const o = c.createOscillator(),
        f = c.createBiquadFilter(),
        g = c.createGain();
      o.type = 'sawtooth';
      f.type = 'bandpass';
      f.frequency.value = 1100;
      f.Q.value = 1.2;
      o.frequency.setValueAtTime(480, t);
      o.frequency.linearRampToValueAtTime(850, t + 0.18);
      o.frequency.linearRampToValueAtTime(560, t + 0.6);
      env(g, t, t + 0.65, 1);
      o.connect(f).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.7);
    } else if (k === 1) {
      [0, 0.28].forEach(d => {
        const o = c.createOscillator(),
          f = c.createBiquadFilter(),
          g = c.createGain();
        o.type = 'sawtooth';
        f.type = 'lowpass';
        f.frequency.value = 900;
        o.frequency.setValueAtTime(260, t + d);
        o.frequency.exponentialRampToValueAtTime(150, t + d + 0.14);
        env(g, t + d, t + d + 0.16, 1.4);
        o.connect(f).connect(g).connect(out);
        o.start(t + d);
        o.stop(t + d + 0.2);
      });
    } else {
      const o = c.createOscillator(),
        lfo = c.createOscillator(),
        lg = c.createGain(),
        g = c.createGain();
      o.type = 'square';
      o.frequency.value = 2300;
      lfo.frequency.value = 26;
      lg.gain.value = 0.5;
      g.gain.value = 0.5;
      lfo.connect(lg).connect(g.gain);
      env(out, t, t + 1.0, 0.12);
      o.connect(g).connect(out);
      o.start(t);
      lfo.start(t);
      o.stop(t + 1.05);
      lfo.stop(t + 1.05);
    }
  } catch (e) {}
}

function svSuggest(lv, rec) {
  const st = rec.st,
    r = sensesRun(st),
    g = r.given,
    act = curMission(lv, rec);
  const others = keys => Object.keys(g).some(k => g[k] && !keys.includes(k));
  const clr = m => ({ ids: ['sClr'], m: `${m} Önce <b>🧹 Hepsini temizle</b>.` });
  if (act === 'card') {
    if (others(['vis'])) return clr('Bu görevde sadece kart olsun.');
    return { ids: ['sc0'], m: 'Şimdi <b>🃏 🍋</b> kartını seç ve akışı soldan sağa izle.' };
  }
  if (act === 'word') {
    if (g.word && !SENSES.things.some(t => t.word === sWordNorm(st.word)))
      return {
        ids: ['sWord', 'sWordRnd'],
        m: 'Bu kelime listede yok. Yazı kutusuna <b>LİMON</b> yaz ve <b>Göster</b>’e bas.'
      };
    return {
      ids: ['sWord', 'sWordGo', 'sWordRnd'],
      m: `Yazı kutusuna <b>LİMON</b> yaz ve <b>Göster</b>’e bas (ya da 🎲 ile rastgele bir kelime).${g.vis ? ' Kart dursa da olur.' : ''}`
    };
  }
  if (act === 'sound') {
    if (others(['sound'])) return clr('Gözler kapalı: sadece ses olsun.');
    return {
      ids: ['ss0'],
      m: 'Şimdi <b>🔊 miyav</b> sesini çal. (Bilgisayarının sesi açıksa duyarsın.)'
    };
  }
  if (act === 'ambig') {
    if (others(['taste']) || st.taste.some((v, i) => v && i !== 0))
      return clr('Sadece tatlı tat olsun.');
    return { ids: ['st0'], m: 'Şimdi sadece <b>😋 tatlı</b> tat ver. Ne diyecek?' };
  }
  if (act === 'combine') {
    if (others(['taste', 'smell']) || st.taste.some((v, i) => v && i !== 0))
      return clr('Sadece tat ve koku olsun.');
    if (!g.taste) return { ids: ['st0'], m: 'Önce <b>😋 tatlı</b> tat ver.' };
    return { ids: ['sm1'], m: 'Tatlı tat kararsız bıraktı. Şimdi <b>👃 🍓 çilek kokusu</b> ekle.' };
  }
  if (act === 'typo') {
    if (others(['word'])) return clr('Sadece yazı olsun.');
    return {
      ids: ['sWord', 'sWordGo'],
      m: 'Yazı kutusuna yanlış yazılmış bir kelime yaz: <b>KÖPEG</b> (ya da ELNA, KEDl) ve <b>Göster</b>.'
    };
  }
  return {
    ids: [],
    m: 'Serbest deneme: duyular çelişirse ne olur? <b>🃏 🐈</b> kartı + <b>🔊 hav hav</b>. Ya da sadece <b>😣 acı</b> tat: kahve mi, sabun mu?'
  };
}

function sensesVeil(lv, st) {
  const on = {
      vis: st.card != null,
      word: !!(st.word || '').trim(),
      smell: st.smell != null,
      sound: st.sound != null,
      taste: st.taste.some(Boolean)
    },
    any = Object.values(on).some(Boolean);
  SV_SENSE.forEach(s => {
    const v = document.getElementById('sveil-' + s.k);
    if (v) v.classList.toggle('on', !!lv.layered && (any ? !on[s.k] : s.k !== 'vis'));
  });
}
function updateSenses(lv, rec) {
  sensesVeil(lv, rec.st);
  const st = rec.st,
    r = sensesRun(st),
    T = SENSES.things,
    R0 = SZ.rows,
    sug = svSuggest(lv, rec);
  const ids = [
    ...T.map((t, k) => 'sc' + k),
    'sWord',
    'sWordGo',
    'sWordRnd',
    ...SENSES.tastes.map((t, k) => 'st' + k),
    ...SENSES.smells.map((s, k) => 'sm' + k),
    ...SENSES.sounds.map((s, k) => 'ss' + k),
    'sClr'
  ];
  ids.forEach(id => $('#' + id).classList.toggle('psug', sug.ids.includes(id)));
  $('#sNext').innerHTML = sug.m;
  const sel = (id, on) => {
    const b = $('#' + id);
    b.classList.toggle('sel', !!on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  T.forEach((t, k) => sel('sc' + k, st.card === k));
  SENSES.tastes.forEach((t, k) => sel('st' + k, st.taste[k]));
  SENSES.smells.forEach((s, k) => sel('sm' + k, st.smell === k));
  SENSES.sounds.forEach((s, k) => sel('ss' + k, st.sound === k));
  $('#sClr').disabled = !r.nGiven;
  // girdi sütunu
  $('#sin-vis').innerHTML =
    `<rect class="scard${r.given.vis ? ' on' : ''}" x="20" y="${R0.vis[0] + 24}" width="96" height="86" rx="10"/><text class="pemo" x="68" y="${R0.vis[0] + 82}" style="font-size:${r.given.vis ? 44 : 20}px">${r.given.vis ? T[st.card].icon : '—'}</text>`;
  const w = sWordNorm(st.word);
  $('#sin-word').innerHTML =
    `<rect class="scard${w ? ' on' : ''}" x="14" y="${R0.word[0] + 30}" width="108" height="64" rx="8"/><text class="sword-img" x="68" y="${R0.word[0] + 70}" style="font-size:${w.length > 6 ? 15 : w.length > 4 ? 18 : 22}px">${w ? esc(w) : '—'}</text>`;
  $('#sin-smell').innerHTML = r.given.smell
    ? `<text class="pemo" x="50" y="${R0.smell[0] + 50}" style="font-size:26px">🧴</text><text class="pemo" x="88" y="${R0.smell[0] + 50}" style="font-size:22px">${SENSES.smells[st.smell].icon}</text>`
    : `<text class="sml" x="68" y="${R0.smell[0] + 46}">—</text>`;
  $('#sin-sound').innerHTML = r.given.sound
    ? `<text class="pemo" x="44" y="${R0.sound[0] + 50}" style="font-size:24px">🔊</text><text class="sml strong" x="94" y="${R0.sound[0] + 46}">${esc(SENSES.sounds[st.sound].name)}</text>`
    : `<text class="sml" x="68" y="${R0.sound[0] + 46}">—</text>`;
  $('#sin-taste').innerHTML = r.given.taste
    ? `<text class="pemo" x="68" y="${R0.taste[0] + 52}" style="font-size:22px">${SENSES.tastes
        .filter((t, i) => st.taste[i])
        .map(t => t.icon)
        .join('')}</text>`
    : `<text class="sml" x="68" y="${R0.taste[0] + 46}">—</text>`;
  // 1 · duyu nöronları
  r.inp.vis.forEach((v, i) => $('#nv' + i).setAttribute('class', 'sn' + (v ? ' on' : '')));
  $('#nvT').textContent = r.given.vis ? SENSES.vis.filter((f, i) => r.inp.vis[i]).join(' · ') : '';
  r.inp.let.forEach((v, i) => {
    $('#nl' + i).setAttribute('class', 'sltr' + (v ? ' on' : ''));
    $('#nlt' + i).textContent = SENSES.letters[i] + (v > 1 ? '²' : '');
  });
  r.inp.smell.forEach((v, i) => $('#no' + i).setAttribute('class', 'sn' + (v ? ' on' : '')));
  r.inp.sound.forEach((v, i) => {
    const b = $('#na' + i),
      hh = 40 * v;
    b.setAttribute('y', (R0.sound[0] + 52 - hh).toFixed(1));
    b.setAttribute('height', hh.toFixed(1));
  });
  r.inp.taste.forEach((v, i) => $('#nt' + i).setAttribute('class', 'sn' + (v ? ' on' : '')));
  // 2 · tanıyıcılar
  const rs = (id, a) => {
    const e = $('#' + id);
    e.setAttribute('class', 'srec' + (a > 0 ? ' on' : ''));
    e.style.setProperty('--a', a);
  };
  T.forEach((t, k) => {
    rs('rv' + k, r.rec.vis[k]);
    rs('rw' + k, r.rec.word[k]);
  });
  rs('thub', r.given.taste ? 1 : 0);
  SENSES.smells.forEach((s, k) => rs('ro' + k, r.rec.smell[k]));
  SENSES.sounds.forEach((s, k) => rs('ra' + k, r.rec.sound[k]));
  // çizgiler: duyu nöronu → tanıyıcı (sadece yananlar)
  const C = id => {
    const e = $('#' + id);
    if (e.tagName === 'circle')
      return [+e.getAttribute('cx'), +e.getAttribute('cy'), +e.getAttribute('r')];
    return [
      +e.getAttribute('x') + +e.getAttribute('width') / 2,
      +e.getAttribute('y') + +e.getAttribute('height') / 2,
      +e.getAttribute('width') / 2
    ];
  };
  const ln = (a, b, op, cls) => {
    const [x1, y1, r1] = C(a),
      [x2, y2, r2] = C(b);
    return `<line class="${cls}" x1="${x1 + r1}" y1="${y1}" x2="${x2 - r2}" y2="${y2}" style="opacity:${op.toFixed(2)}"/>`;
  };
  let l1 = '';
  T.forEach((t, k) => {
    if (r.rec.vis[k] > 0)
      r.inp.vis.forEach((v, i) => {
        if (v && t.vis.includes(i)) l1 += ln('nv' + i, 'rv' + k, 0.25 + 0.6 * r.rec.vis[k], 'sl');
      });
    if (r.rec.word[k] > 0) {
      const L = sLetters(t.word);
      r.inp.let.forEach((v, i) => {
        if (v && L[i]) l1 += ln('nl' + i, 'rw' + k, 0.2 + 0.6 * r.rec.word[k], 'sl');
      });
    }
  });
  SENSES.smells.forEach((s, k) => {
    if (r.rec.smell[k] > 0)
      r.inp.smell.forEach((v, i) => {
        if (v && s.r[i]) l1 += ln('no' + i, 'ro' + k, 0.25 + 0.6 * r.rec.smell[k], 'sl');
      });
  });
  SENSES.sounds.forEach((s, k) => {
    if (r.rec.sound[k] > 0)
      r.inp.sound.forEach((v, i) => {
        if (v && s.b[i] > 0.2) l1 += ln('na' + i, 'ra' + k, 0.25 + 0.6 * r.rec.sound[k], 'sl');
      });
  });
  $('#sl1').innerHTML = l1;
  // tanıyıcı → kavram (yapı soluk, etkin olan parlak)
  let l2 = '';
  T.forEach((t, k) => {
    const p = r.parts[k];
    l2 += ln('rv' + k, 'kc' + k, p.vis ? 0.9 : 0.07, 'sl2' + (p.vis ? ' on' : ''));
    l2 += ln('rw' + k, 'kc' + k, p.word ? 0.9 : 0.07, 'sl2' + (p.word ? ' on' : ''));
    if (t.smell != null)
      l2 += ln('ro' + t.smell, 'kc' + k, p.smell ? 0.9 : 0.07, 'sl2' + (p.smell ? ' on' : ''));
    if (t.sound != null)
      l2 += ln('ra' + t.sound, 'kc' + k, p.sound ? 0.9 : 0.07, 'sl2' + (p.sound ? ' on' : ''));
    if (t.taste)
      l2 += ln(
        'thub',
        'kc' + k,
        p.taste ? 0.25 + 0.65 * p.taste : 0.06,
        'sl2 taste' + (p.taste ? ' on' : '')
      );
  });
  r.inp.taste.forEach((v, i) => {
    if (v) l1 += ln('nt' + i, 'thub', 0.8, 'sl');
  });
  $('#sl1').innerHTML = l1;
  $('#sl2').innerHTML = l2;
  // 3 · kavram ve 4 · çıktı
  const any = r.nGiven > 0;
  T.forEach((t, k) => {
    const c = $('#kc' + k),
      pk = any && !r.unknown ? r.p[k] : 0;
    c.setAttribute('class', 'soma sk' + (any && k === r.top && !r.unknown ? ' top' : ''));
    c.style.setProperty('--a', pk);
    $('#kp' + k).textContent = any && r.c[k] > 0.005 ? `destek ${svN(r.c[k])} · ${svPct(pk)}` : '';
    $('#kn' + k).setAttribute('class', 'skn' + (pk >= 0.05 ? ' on' : ''));
  });
  let l3 = '';
  T.forEach((t, k) => {
    const pk = any && !r.unknown ? r.p[k] : 0;
    l3 += ln(
      'kc' + k,
      'oc' + t.cat,
      pk > 0.05 ? 0.2 + 0.8 * pk : 0.05,
      'sl3' + (pk > 0.05 ? ' on' : '')
    );
  });
  $('#sl3').innerHTML = l3;
  SENSES.cats.forEach((c, j) => {
    const e = $('#oc' + j),
      pj = any && !r.unknown ? r.cat[j] : 0;
    e.setAttribute('class', 'soma sk' + (pj >= 0.6 ? ' top' : ''));
    e.style.setProperty('--a', pj);
    $('#op' + j).textContent = any && !r.unknown ? svPct(pj) : '';
  });
  const say = svSay(r);
  $('#oI').textContent = say.icon;
  $('#oT').textContent = say.short;
  svAnswer(st, r, say);
  svStep(rec, r, say);
  svMat(r);
  svLog(st);
}
// Çıktının söylediği
function svSay(r) {
  const T = SENSES.things;
  if (!r.nGiven)
    return { icon: '💤', short: 'bekliyor', big: '…', sub: 'Henüz bir şey sunmadın.', cls: '' };
  if (r.unknown)
    return {
      icon: '🤷',
      short: '“Bilmiyorum.”',
      big: 'BİLMİYORUM',
      sub: 'hiçbir kavram yeterince destek almadı',
      cls: 'bad'
    };
  const a = T[r.order[0]],
    b = T[r.order[1]],
    pa = r.p[r.order[0]];
  if (pa < 0.6)
    return {
      icon: '🤔',
      short: `“${a.name} mı, ${b.name} mı?”`,
      big: `${a.name} mı, ${b.name} mı?`.toLocaleUpperCase('tr-TR'),
      sub: 'kararsız: iki ya da üç kavram yakın destek aldı',
      cls: 'mid'
    };
  return {
    icon: a.icon,
    short: `“${a.name.charAt(0).toLocaleUpperCase('tr-TR') + a.name.slice(1)}!”`,
    big: `${a.icon} ${a.name.toLocaleUpperCase('tr-TR')}`,
    sub: `${SENSES.cats[a.cat].name} · emin ${svPct(pa)}`,
    cls: 'on'
  };
}
const svSrc = (p, t) =>
  [
    ['vis', '👁 görme'],
    ['word', '📖 yazı'],
    ['smell', '👃 koku'],
    ['sound', '👂 ses'],
    ['taste', '👅 tat']
  ]
    .filter(([k]) => p[k] > 0.005)
    .map(([k, n]) => `${n} ${svN(p[k])}`);
function svAnswer(st, r, say) {
  const T = SENSES.things;
  if (!r.nGiven) {
    $('#sanswer').innerHTML =
      `<div class="ans-l">Ne olduğunu söylüyor</div><div class="ans-big">…</div><div class="ans-sub">${say.sub}</div>`;
    return;
  }
  const bars = r.order
    .slice(0, 3)
    .map(
      k =>
        `<div class="prow"><span class="prow-l">${T[k].icon} ${esc(T[k].name)}</span><span class="pbar"><i style="width:${Math.round((r.unknown ? 0 : r.p[k]) * 100)}%"></i></span><b>${r.unknown ? '—' : svPct(r.p[k])}</b></div>`
    )
    .join('');
  const top = r.top,
    src = svSrc(r.parts[top]);
  $('#sanswer').innerHTML =
    `<div class="ans-l">Ne olduğunu söylüyor</div><div class="ans-big ${say.cls}" data-fl="sans">${esc(say.big)}</div><div class="ans-sub">${esc(say.sub)}</div>
    <div class="sbars">${bars}</div>
    ${r.unknown ? '' : `<div class="calc"><div class="cl">${T[top].icon} ${esc(T[top].name)} kavramına destek:</div><div class="cl">${src.join(' + ') || '—'} = <b>${svN(r.c[top])}</b></div></div>`}`;
}
function svStep(rec, r, say) {
  const st = rec.st,
    T = SENSES.things,
    el = $('#sstep');
  const key = [st.card, sWordNorm(st.word), st.smell, st.sound, st.taste.join('')].join('|');
  if (key === svLastStep) return;
  svLastStep = key;
  if (!r.nGiven) {
    el.innerHTML = `<div class="ph-box empty"><div class="ph-b">Henüz bir şey sunmadın. Soldan bir <b>🃏 kart</b> seç, bir <b>📖 kelime</b> yaz, <b>👅 tat</b> ver, <b>👃 koklat</b> ya da <b>🔊 ses</b> çal. Akış burada dört adımda görünecek; birden çok duyuyu birleştirebilirsin.</div></div>`;
    return;
  }
  const g = r.given,
    s1 = [];
  if (g.vis) s1.push(`👁 ${SENSES.vis.filter((f, i) => r.inp.vis[i]).join(', ')}`);
  if (g.word) s1.push(`📖 harfler: ${SENSES.letters.filter((c, i) => r.inp.let[i]).join(' ')}`);
  if (g.smell)
    s1.push(
      `👃 reseptör ${r.inp.smell
        .map((v, i) => (v ? 'R' + (i + 1) : ''))
        .filter(x => x)
        .join(', ')}`
    );
  if (g.sound)
    s1.push(`👂 ${SENSES.bands.filter((b, i) => r.inp.sound[i] >= 0.5).join(', ')} bantlar`);
  if (g.taste)
    s1.push(
      `👅 ${SENSES.tastes
        .filter((t, i) => r.inp.taste[i])
        .map(t => t.name)
        .join(', ')}`
    );
  const s2 = [];
  if (g.vis) {
    const k = r.rec.vis.indexOf(Math.max(...r.rec.vis));
    s2.push(r.rec.vis[k] > 0 ? `👁 ${T[k].icon} ${svPct(r.rec.vis[k])}` : '👁 tanıyan yok');
  }
  if (g.word) {
    const k = r.rec.word.indexOf(Math.max(...r.rec.word));
    s2.push(r.rec.word[k] > 0 ? `📖 ${T[k].word} ${svPct(r.rec.word[k])}` : '📖 tanıyan yok');
  }
  if (g.smell) {
    const k = r.rec.smell.indexOf(Math.max(...r.rec.smell));
    s2.push(
      r.rec.smell[k] > 0 ? `👃 ${SENSES.smells[k].icon} ${svPct(r.rec.smell[k])}` : '👃 tanıyan yok'
    );
  }
  if (g.sound) {
    const k = r.rec.sound.indexOf(Math.max(...r.rec.sound));
    s2.push(
      r.rec.sound[k] > 0 ? `👂 ${SENSES.sounds[k].icon} ${svPct(r.rec.sound[k])}` : '👂 tanıyan yok'
    );
  }
  if (g.taste) s2.push('👅 tat doğrudan geçer');
  const s3 = r.order
    .slice(0, 3)
    .filter(k => r.c[k] > 0.005)
    .map(k => `${T[k].icon} ${svSrc(r.parts[k]).join(' + ')} = <b>${svN(r.c[k])}</b>`);
  el.innerHTML = stripHTML([
    { t: '1 · Duyu nöronları', h: s1.join('<br>') },
    {
      t: '2 · Duyu alanları',
      h:
        s2.join('<br>') +
        '<br><span class="dimtxt">her duyu önce kendi başına tanımaya çalışır</span>'
    },
    {
      t: '3 · Kavram',
      h:
        (s3.join('<br>') || 'hiçbir kavram destek almadı') +
        '<br><span class="dimtxt">kavram, bütün duyulardan gelen desteği toplar</span>'
    },
    {
      t: '4 · Söyledi',
      cls: say.cls === 'on' ? 'ok' : say.cls === 'bad' ? 'bad' : '',
      h: `<b>${esc(say.short)}</b><br>${esc(say.sub)}`
    }
  ]);
}
function svMat(r) {
  const T = SENSES.things,
    cols = [
      ['vis', '👁'],
      ['word', '📖'],
      ['smell', '👃'],
      ['sound', '👂'],
      ['taste', '👅']
    ];
  const has = (t, k) =>
    k === 'vis' ||
    k === 'word' ||
    (k === 'smell' && t.smell != null) ||
    (k === 'sound' && t.sound != null) ||
    (k === 'taste' && !!t.taste);
  $('#smat').innerHTML =
    `<thead><tr><th>kavram</th>${cols.map(c => `<th>${c[1]}</th>`).join('')}<th>toplam</th></tr></thead><tbody>${T.map(
      (t, k) =>
        `<tr class="${r.nGiven && k === r.top && !r.unknown ? 'cur' : ''}"><td>${t.icon} ${esc(t.name)}</td>${cols
          .map(([c]) => {
            const v = r.parts[k][c];
            return `<td class="smc${v > 0.005 ? ' on' : ''}" style="--a:${v}">${has(t, c) ? (v > 0.005 ? svN(v) : '✓') : ''}</td>`;
          })
          .join('')}<td class="num">${r.c[k] > 0.005 ? svN(r.c[k]) : ''}</td></tr>`
    ).join('')}</tbody>`;
}
function svLog(st) {
  const T = SENSES.things,
    rows = (st.hist || []).slice(-6).reverse();
  const inTxt = e =>
    [
      e.card != null ? T[e.card].icon : '',
      e.word ? `“${esc(e.word)}”` : '',
      e.smell != null ? '👃' + SENSES.smells[e.smell].icon : '',
      e.sound != null ? '🔊' + SENSES.sounds[e.sound].icon : '',
      (e.taste || []).some(v => v)
        ? SENSES.tastes
            .filter((t, i) => e.taste[i])
            .map(t => t.icon)
            .join('')
        : ''
    ]
      .filter(x => x)
      .join(' + ');
  $('#slog').innerHTML = `<thead><tr><th>#</th><th>sunulan</th><th>dedi</th></tr></thead><tbody>${
    rows
      .map(
        e => `<tr><td class="num">${e.n}</td><td>${inTxt(e)}</td>
    <td>${e.unknown ? 'bilmiyorum' : `${T[e.top].icon} ${esc(T[e.top].name)} ${svPct(e.pt)}`}</td></tr>`
      )
      .join('') || '<tr><td colspan="3" class="hint">Henüz deneme yok.</td></tr>'
  }</tbody>`;
}
