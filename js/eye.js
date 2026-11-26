'use strict';
/* ------------------------------------------------------------------
   SEVİYE 9: yatay mı dikey mi? (yavru Pamuk’un gözü)
   Kullanıcı yavru kediye çizgi gösterir. Gözdeki 6 görme nöronunun
   her biri baktığı şekli küçük bir 3×3 resim olarak taşır. En çok
   benzeyen kazanır, yavruyken gördüğüne doğru kayar (etiket yok).
   Sonra kullanıcı öğretmen olur: “Bu yatay / Bu dikey”.
   Model: eyeLook/eyeLearn (neuron.js); eyeShow/eyeName/eyeGrow (levels.js).
------------------------------------------------------------------- */
let eLastStep = '';
function eyeResetView() {
  eLastStep = '';
}
const EZ = {
  gx: 34,
  gy: 96,
  gc: 46,
  gg: 5,
  dx: 318,
  dw: 232,
  dy0: 44,
  dyS: 48,
  wx: 730,
  wy: [118, 226],
  wr: 38
};
const ePct = v => '%' + Math.round(v * 100);
const W_MAX = 1 / Math.sqrt(3),
  W_LO = 0.24;
// nöron resmi: bulanık (≈0,33) soluk, keskin çizgi (≈0,58) dolu görünsün
const wShow = w => w.map(v => clamp((v - W_LO) / (W_MAX - W_LO), 0, 1));
// Küçük 3×3 resim (satır içi SVG). v: 9 değer, max: tam dolu sayılacak değer
function ePic(v, size, max, cls) {
  const c = size / 3;
  let h = `<svg class="epic ${cls || ''}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">`;
  v.forEach((x, i) => {
    const a = clamp(x / (max || 1), 0, 1);
    h += `<rect x="${(i % 3) * c + 0.5}" y="${Math.floor(i / 3) * c + 0.5}" width="${c - 1}" height="${c - 1}" rx="1.5" style="fill:color-mix(in srgb, var(--light) ${Math.round(a * 100)}%, var(--surface-2))"/>`;
  });
  return h + '</svg>';
}
// SVG içinde 3×3 resim (sahne için)
function ePicG(v, x, y, c, max) {
  let h = '';
  v.forEach((p, i) => {
    const a = clamp(p / (max || 1), 0, 1);
    h += `<rect x="${x + (i % 3) * c}" y="${y + Math.floor(i / 3) * c}" width="${c - 1.2}" height="${c - 1.2}" rx="1.5" style="fill:color-mix(in srgb, var(--light) ${Math.round(a * 100)}%, var(--surface-2))"/>`;
  });
  return h;
}
// Nöronun resmi hangi çizgiye benziyor?
function eTunedTo(w) {
  let best = -1,
    bi = 0;
  EYE.lines.forEach((l, i) => {
    const m = NN_eyeDot(w, l.x);
    if (m > best) {
      best = m;
      bi = i;
    }
  });
  return { li: bi, m: best };
}
function NN_eyeDot(w, x) {
  return eyeLook(x, [w]).m[0];
}
const eAnsTxt = a =>
  a === 'blur'
    ? 'net göremiyor'
    : a === 'unknown'
      ? 'adını bilmiyor'
      : `${EYE.words[a].icon} ${EYE.words[a].name}`;

function eyeGridHTML(lv) {
  return `<section class="bench has-card">
      <div class="bench-card pact">
        <div class="pstep-h"><span class="pdot">1</span> Pamuk’a bir çizgi göster</div>
        <div class="ebtns">${EYE.lines.map((l, i) => `<button class="btn eline" id="e${i}" title="${esc(eyeLineName(i))}">${ePic(l.x, 26, 1)}<span>${EYE.words[l.o].icon} ${esc(l.short)}</span></button>`).join('')}</div>
        <p class="hint ehint" data-lay="draw">ya da sahnedeki gözün noktalarına tıklayıp kendin çiz, sonra göster:</p>
        <div class="pbtns two" data-lay="draw"><button class="btn" id="eDraw">👁 Göster</button><button class="btn ghost" id="eClr">🧽 Temizle</button></div>
        <div class="pstep-h" data-lay="name"><span class="pdot">2</span> Adını öğret</div>
        <div class="pbtns two" data-lay="name"><button class="btn" id="n0">━ Bu yatay</button><button class="btn" id="n1">┃ Bu dikey</button></div>
        <p class="pnext" id="eNext" aria-live="polite"></p>
        <div class="bench-more pquick"><button class="btn small" id="qGrow" data-lay="grow">🌱 Büyüt (her çizgiden)</button><button class="btn small" id="qGrowV" data-lay="blake">🌱 Sadece dikey dünyada büyüt</button><button class="btn ghost small" id="qKit" data-lay="blake">🐣 Yeni yavru</button></div>
      </div>
      <div class="bench-scene"><div class="stage scene-wrap"><svg id="escene" viewBox="0 0 860 340" role="img" aria-label="Solda Pamuk’un gözü (3×3 nokta), ortada altı görme nöronu ve her birinin baktığı resim, sağda yatay ve dikey kelime nöronları"></svg></div></div>
      <div class="bench-answer panel" id="eanswer" aria-live="polite"></div>
    </section>
    <section class="strip" id="estep" aria-live="polite" data-lay="strip"></section>
    <section class="bench-bottom">
      <div class="panel" data-lay="age"><div class="ph"><h3>Yavruluk: kritik dönem</h3><span class="pc" id="eAgeN"></span></div>
        <div class="eage"><i id="eAgeBar"></i></div>
        <p class="hint" id="eAgeHint"></p>
        <div class="eworld" id="eWorld"></div></div>
      <div class="panel" data-lay="log"><h3>Son bakışlar</h3><div class="llog-wrap"><table class="tt" id="elog"></table></div></div>
    </section>`;
}

function wireEye(lv) {
  const svg = $('#escene');
  let h = `<text class="coltitle" x="${EZ.gx + 73}" y="22">Pamuk’un gözü</text>
    <text class="coltitle" x="${EZ.dx + EZ.dw / 2}" y="22">Görme nöronları: her biri neye bakıyor?</text>
    <text class="coltitle" x="${EZ.wx}" y="22">Adlar</text>
    <text class="pemo" x="${EZ.gx + 20}" y="70" style="font-size:30px">🐈</text><text class="soma-sub" id="eAge" x="${EZ.gx + 46}" y="64" style="text-anchor:start;font-size:12px"></text>
    <g id="esyn"></g><g id="ewl"></g>`;
  for (let i = 0; i < 9; i++) {
    const x = EZ.gx + (i % 3) * (EZ.gc + EZ.gg),
      y = EZ.gy + Math.floor(i / 3) * (EZ.gc + EZ.gg);
    h += `<rect class="ecell" id="ec${i}" data-i="${i}" x="${x}" y="${y}" width="${EZ.gc}" height="${EZ.gc}" rx="9" tabindex="0" role="button"/>`;
  }
  h += `<text class="cname" x="${EZ.gx + 73}" y="${EZ.gy + 3 * (EZ.gc + EZ.gg) + 14}">tıkla: noktayı yak / söndür</text>`;
  for (let k = 0; k < EYE.n; k++) {
    const y = EZ.dy0 + k * EZ.dyS;
    h += `<g class="edet" id="ed${k}"><rect class="edet-r" id="edr${k}" x="${EZ.dx}" y="${y}" width="${EZ.dw}" height="${EZ.dyS - 8}" rx="10"/>
      <g id="edp${k}"></g>
      <text class="edet-n" x="${EZ.dx + 52}" y="${y + 16}">nöron ${k + 1}</text><text class="edet-s" id="eds${k}" x="${EZ.dx + 52}" y="${y + 32}"></text>
      <rect class="ebar-bg" x="${EZ.dx + 150}" y="${y + 12}" width="60" height="10" rx="5"/><rect class="ebar" id="eb${k}" x="${EZ.dx + 150}" y="${y + 12}" width="0" height="10" rx="5"/>
      <text class="edet-m" id="em${k}" x="${EZ.dx + 180}" y="${y + 35}"></text></g>`;
  }
  EYE.words.forEach((w, j) => {
    h += `<circle class="soma eword" id="ew${j}" cx="${EZ.wx}" cy="${EZ.wy[j]}" r="${EZ.wr}"/>
    <text class="soma-t" x="${EZ.wx}" y="${EZ.wy[j] - 2}" style="font-size:20px">${w.icon}</text><text class="soma-sub" x="${EZ.wx}" y="${EZ.wy[j] + 18}" style="font-size:13px">${w.name}</text>`;
  });
  h += `<text class="soma-sub" id="eOut" x="${EZ.wx}" y="${EZ.wy[1] + EZ.wr + 30}" style="font-size:13px"></text>`;
  svg.innerHTML = h;
  svg.querySelectorAll('.ecell').forEach(c => {
    const tog = () => {
      const st = R().st;
      st.retina = st.retina.slice();
      st.retina[+c.dataset.i] = st.retina[+c.dataset.i] ? 0 : 1;
      st.drawn = true;
      refresh();
    };
    c.addEventListener('click', tog);
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        tog();
      }
    });
  });
  EYE.lines.forEach((l, i) => ($('#e' + i).onclick = () => eDo(l.x)));
  $('#eDraw').onclick = () => {
    const st = R().st;
    if (!st.retina.some(v => v)) {
      toast('Gözde yanık nokta yok. Önce noktalara tıklayıp bir şey çiz.');
      return;
    }
    eDo(st.retina);
  };
  $('#eClr').onclick = () => {
    const st = R().st;
    st.retina = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    st.drawn = true;
    refresh();
  };
  [0, 1].forEach(
    j =>
      ($('#n' + j).onclick = () => {
        const st = R().st,
          r = eyeName(st, j);
        if (r.err === 'none') {
          toast('Önce Pamuk’a bir çizgi göster.');
          return;
        }
        if (r.err === 'blur') {
          toast(
            `Pamuk bunu net göremiyor (en iyi eşleşme ${ePct(r.m)}). Göremediği şeye ad bağlanamaz.`
          );
          return;
        }
        toast(`Nöron ${r.k + 1} → “${EYE.words[j].name}” bağı güçlendi.`);
        refresh();
      })
  );
  $('#qGrow').onclick = () => eGrow('all');
  $('#qGrowV').onclick = () => eGrow('v');
  $('#qKit').onclick = () => {
    eyeNewKitten(R().st);
    refresh();
    toast(
      'Yeni yavru Pamuk: gözündeki altı nöron bulanık, hiçbir ad bilmiyor. Görevlerin duruyor.'
    );
  };
}
function eDo(x) {
  const st = R().st;
  st.drawn = false;
  eyeShow(st, x);
  refresh();
}
function eGrow(world) {
  const st = R().st;
  if (st.age >= EYE.age) {
    toast('Pamuk zaten büyüdü. Baştan büyütmek için 🐣 Yeni yavru al.');
    return;
  }
  const before = st.age;
  eyeGrow(st, world);
  st.drawn = false;
  refresh();
  toast(
    `${st.age - before} bakış: Pamuk ${world === 'v' ? 'yalnızca dikey çizgiler görerek ' : ''}büyüdü. Gözündeki bağlar artık değişmeyecek.`
  );
}

// Şimdi ne yapmalı?
function eSuggest(lv, rec) {
  const st = rec.st,
    act = curMission(lv, rec),
    last = st.last,
    grown = st.age >= EYE.age;
  const lineIdx = x => EYE.lines.findIndex(l => l.x.every((v, i) => v === x[i]));
  if (act === 'first')
    return {
      ids: ['e0'],
      m: 'Şimdi: soldaki <b>━ üst</b> çizgiye bas. Altı nörondan hangisi kazanacak?'
    };
  if (act === 'tuned') {
    if (grown && !eyeTuned(st.W))
      return {
        ids: ['qKit'],
        m: 'Pamuk büyüdü ama her çizginin kendi nöronu olmadı. <b>🐣 Yeni yavru</b> al ve baştan göster.'
      };
    const ks = EYE.lines.map(l => eyeLook(l.x, st.W)),
      owner = {};
    ks.forEach((o, i) => {
      (owner[o.k] = owner[o.k] || []).push(i);
    });
    const miss = EYE.lines
      .map((l, i) => i)
      .filter(i => ks[i].m[ks[i].k] < EYE.sharp || owner[ks[i].k].length > 1);
    const n = EYE.lines.length - miss.length;
    if (st.age > EYE.age - 4 && miss.length)
      return {
        ids: ['qKit'],
        m: 'Yavruluk bitmek üzere ve bazı çizgilerin nöronu yok. <b>🐣 Yeni yavru</b> al.'
      };
    return {
      ids: ['e' + miss[0]],
      m: `Şimdi <b>${esc(eyeLineName(miss[0]))}</b> çizgisini göster. (${n}/6 çizginin kendi keskin nöronu var)`
    };
  }
  if (act === 'name') {
    if (last) {
      const li = lineIdx(last.x),
        a = eyeAnswer(st, last.x);
      if (li >= 0 && a.ans !== EYE.lines[li].o && a.ans !== 'blur') {
        const o = EYE.lines[li].o;
        return {
          ids: ['n' + o],
          m: `Bu bir ${EYE.words[o].name} çizgi. Pamuk ${a.ans === 'unknown' ? 'adını bilmiyor' : 'yanlış söylüyor'}: <b>${EYE.words[o].icon} Bu ${EYE.words[o].name}</b> de.`
        };
      }
    }
    const bad = EYE.lines
      .map((l, i) => i)
      .filter(i => eyeAnswer(st, EYE.lines[i].x).ans !== EYE.lines[i].o);
    if (bad.some(i => eyeAnswer(st, EYE.lines[i].x).ans === 'blur'))
      return {
        ids: ['qKit'],
        m: 'Bazı çizgileri net göremiyor. <b>🐣 Yeni yavru</b> al, önce altı çizgiyi göster.'
      };
    return {
      ids: ['e' + bad[0]],
      m: `Şimdi <b>${esc(eyeLineName(bad[0]))}</b> çizgisini göster, sonra adını söyle. (${6 - bad.length}/6 doğru)`
    };
  }
  if (act === 'noisy') {
    const near = eyeNearest(st.retina),
      on = st.retina.some(v => v);
    if (!on)
      return {
        ids: ['e0'],
        m: 'Önce bir çizgi göster (ör. <b>━ üst</b>). Sonra gözdeki bir noktasına tıklayıp boz.'
      };
    if (near.d === 0)
      return {
        ids: [],
        m: 'Şimdi sahnedeki <b>gözün bir noktasına tıkla</b>: çizginin bir noktasını söndür ya da yanına bir nokta yak.',
        cells: true
      };
    if (near.d === 1)
      return {
        ids: ['eDraw'],
        m: `Bozuk bir ${EYE.words[EYE.lines[near.li].o].name} çizgi çizdin. Şimdi <b>👁 Göster</b>.`
      };
    return {
      ids: ['eClr'],
      m: 'Bu çizim hiçbir çizgiye yakın değil (birden çok nokta farklı). <b>🧽 Temizle</b> ve tek bir noktayı değiştir.'
    };
  }
  if (act === 'blake') {
    const fresh = st.youth && !st.youth.h;
    if (!fresh)
      return { ids: ['qKit'], m: 'Bu Pamuk yatay çizgi görerek büyüdü. <b>🐣 Yeni yavru</b> al.' };
    if (!grown)
      return {
        ids: ['qGrowV'],
        m: `Şimdi <b>🌱 Sadece dikey dünyada büyüt</b>. (${st.age}/${EYE.age} bakış)`
      };
    return {
      ids: ['e0', 'e1', 'e2'],
      m: 'Pamuk yalnızca dikey çizgiler görerek büyüdü. Şimdi ona bir <b>━ yatay</b> çizgi göster.'
    };
  }
  return {
    ids: [],
    m: 'Serbest deneme: kendi şekillerini çiz (çapraz, köşe…). Pamuk hangi nöronla görüyor, ne diyor?'
  };
}

function updateEye(lv, rec) {
  const st = rec.st,
    last = st.last,
    grown = st.age >= EYE.age;
  const sug = eSuggest(lv, rec);
  [
    'e0',
    'e1',
    'e2',
    'e3',
    'e4',
    'e5',
    'eDraw',
    'eClr',
    'n0',
    'n1',
    'qGrow',
    'qGrowV',
    'qKit'
  ].forEach(id => $('#' + id).classList.toggle('psug', sug.ids.includes(id)));
  $('#eNext').innerHTML = sug.m;
  ['n0', 'n1'].forEach(id => ($('#' + id).disabled = !last));
  ['qGrow', 'qGrowV'].forEach(id => ($('#' + id).disabled = grown));
  // göz: o an gözdeki resim
  const showing = st.retina;
  for (let i = 0; i < 9; i++) {
    const c = $('#ec' + i);
    c.setAttribute('class', 'ecell' + (st.retina[i] ? ' on' : '') + (sug.cells ? ' psugc' : ''));
    c.setAttribute('aria-pressed', st.retina[i] ? 'true' : 'false');
    c.setAttribute('aria-label', `Nokta ${i + 1}: ${st.retina[i] ? 'yanık' : 'sönük'}`);
  }
  $('#eAge').textContent = grown
    ? 'Pamuk büyüdü: göz bağları sabit'
    : `yavru Pamuk · ${st.age}/${EYE.age} bakış`;
  // nöronlar: o anki resme benzerlik
  const live = showing.some(v => v) ? eyeLook(showing, st.W) : null,
    win = live ? live.k : -1;
  let syn = '',
    wl = '';
  for (let k = 0; k < EYE.n; k++) {
    const y = EZ.dy0 + k * EZ.dyS,
      w = st.W[k],
      t = eTunedTo(w),
      sharp = t.m >= EYE.sharp;
    $('#edp' + k).innerHTML = ePicG(wShow(w), EZ.dx + 8, y + 3, 11, 1);
    $('#eds' + k).textContent = sharp
      ? `${EYE.words[EYE.lines[t.li].o].icon} ${EYE.lines[t.li].short} çizgisi`
      : t.m >= 0.8
        ? 'keskinleşiyor'
        : 'bulanık';
    const m = live ? live.m[k] : 0;
    $('#eb' + k).setAttribute('width', (60 * clamp(m, 0, 1)).toFixed(1));
    $('#eb' + k).setAttribute(
      'class',
      'ebar' + (k === win ? (m >= EYE.see ? ' win' : ' weak') : '')
    );
    $('#em' + k).textContent = live ? `benzerlik ${ePct(m)}` : '';
    $('#ed' + k).setAttribute(
      'class',
      'edet' + (k === win ? ' win' : '') + (sharp ? ' sharp' : '')
    );
    const x1 = EZ.gx + 3 * (EZ.gc + EZ.gg),
      y1 = EZ.gy + 1.5 * (EZ.gc + EZ.gg),
      op = live ? (k === win ? 0.95 : 0.12 + 0.25 * m) : 0.12;
    syn += `<line class="esyn${k === win ? ' win' : ''}" x1="${x1}" y1="${y1}" x2="${EZ.dx - 2}" y2="${y + 20}" style="opacity:${op.toFixed(2)}"/>`;
    EYE.words.forEach((wd, j) => {
      const v = st.L[k][j];
      if (v < 0.05) return;
      wl += `<line class="eword-l${k === win && live && live.m[k] >= EYE.see ? ' win' : ''}" x1="${EZ.dx + EZ.dw + 2}" y1="${y + 20}" x2="${EZ.wx - EZ.wr - 2}" y2="${EZ.wy[j]}" style="stroke-width:${(1 + 4 * v).toFixed(1)}"/>`;
    });
  }
  $('#esyn').innerHTML = syn;
  $('#ewl').innerHTML = wl;
  const a = live ? eyeAnswer(st, showing) : null;
  EYE.words.forEach((w, j) => $('#ew' + j).classList.toggle('on', !!a && a.ans === j));
  $('#eOut').textContent = a
    ? a.ans === 'blur'
      ? 'net göremiyor'
      : a.ans === 'unknown'
        ? 'adını bilmiyor'
        : ''
    : '';
  eAnswer(st, showing, a);
  eStep(rec);
  eAge(st);
  eLog(st);
}

function eAnswer(st, x, a) {
  const el = $('#eanswer'),
    near = x.some(v => v) ? eyeNearest(x) : null;
  if (!a) {
    el.innerHTML = `<div class="ans-l">Pamuk ne görüyor?</div><div class="ans-big">…</div><div class="ans-sub">Henüz bir şey göstermedin.</div>`;
    return;
  }
  const big =
    a.ans === 'blur'
      ? 'BULANIK'
      : a.ans === 'unknown'
        ? '?'
        : `${EYE.words[a.ans].icon} ${EYE.words[a.ans].name.toLocaleUpperCase('tr-TR')}`;
  const sub =
    a.ans === 'blur'
      ? 'hiçbir nöronu bu şekle ayarlı değil'
      : a.ans === 'unknown'
        ? `nöron ${a.k + 1} tanıyor ama adını bilmiyor`
        : `nöron ${a.k + 1} kazandı, onun adı bu`;
  const truth = near && near.d <= 1 ? EYE.lines[near.li].o : null;
  const verdict =
    truth == null || a.ans === 'blur' || a.ans === 'unknown'
      ? ''
      : `<div class="ans-v ${a.ans === truth ? 'ok' : 'bad'}">${near.d ? 'bozuk ' : ''}${EYE.words[truth].name} çizgi ${a.ans === truth ? '✓' : '✗'}</div>`;
  el.innerHTML = `<div class="ans-l">Pamuk ne görüyor?</div><div class="ans-big ${a.ans === 0 || a.ans === 1 ? 'on' : ''}" data-fl="eans">${big}</div><div class="ans-sub">${sub}</div>${verdict}
    <div class="eans-pic"><figure>${ePic(x, 50, 1)}<figcaption>gözdeki</figcaption></figure><span>≈</span><figure>${ePic(wShow(st.W[a.k]), 50, 1)}<figcaption>nöron ${a.k + 1}</figcaption></figure></div>
    <div class="ans-sub">benzerlik <b>${ePct(a.m)}</b> <span class="dimtxt">(net görmek için %75)</span></div>
    <div class="calc"><div class="cl">en çok benzeyen nöron kazanır</div><div class="cl">yavruyken: kazananın resmi gördüğüne %60 yaklaşır</div></div>`;
}

function eStep(rec) {
  const st = rec.st,
    r = st.last,
    el = $('#estep');
  const key = r ? r.seq + '|' + st.L.flat().join(',') + '|' + st.seed : 'none' + st.seed;
  if (key === eLastStep) return;
  eLastStep = key;
  if (!r) {
    el.innerHTML = `<div class="ph-box empty"><div class="ph-b">Henüz bir şey göstermedin. Soldan bir <b>çizgi</b> seç: Pamuk’un gözündeki altı nöron, gördüğüne ne kadar benzediğini hesaplayacak; en çok benzeyen kazanacak ve (Pamuk yavruyken) resmi o çizgiye doğru kayacak. Dört aşama burada yan yana görünecek.</div></div>`;
    return;
  }
  const ord = r.all.map((m, k) => ({ m, k })).sort((p, q) => q.m - p.m),
    second = ord[1];
  const boxes = [
    {
      t: '1 · Gördü',
      h: `<div class="estep-pic">${ePic(r.x, 46, 1)}<span>${r.x.filter(v => v).length} nokta yanık${r.near.d === 0 ? `<br><b>${esc(eyeLineName(r.near.li))}</b>` : r.near.d === 1 ? `<br>bozuk ${EYE.words[EYE.lines[r.near.li].o].name}` : ''}</span></div>`
    },
    {
      t: '2 · Kim benziyor?',
      cls: r.m < EYE.see ? 'bad' : 'ok',
      h: `En çok benzeyen <b>nöron ${r.k + 1}</b>: ${ePct(r.m)}<br>ikinci: nöron ${second.k + 1}, ${ePct(second.m)}<br>${r.m < EYE.see ? '%75’in altında: <b>net göremedi</b>.' : 'Kazanan o.'}`
    }
  ];
  boxes.push(
    r.young
      ? {
          t: '3 · Ayarlandı',
          h: `<div class="estep-pic">${ePic(wShow(r.w0), 40, 1)}<span>→</span>${ePic(wShow(r.w), 40, 1)}</div>Nöron ${r.k + 1}’in resmi bu şekle kaydı: benzerlik <b>${ePct(r.m)} → ${ePct(r.mAfter)}</b>.`
        }
      : { t: '3 · Ayarlandı', h: 'Pamuk büyüdü: kritik dönem bitti. <b>Hiçbir bağ değişmedi.</b>' }
  );
  const a = eyeAnswer(st, r.x),
    truth = r.near.d <= 1 ? EYE.lines[r.near.li].o : null;
  boxes.push({
    t: '4 · Adı',
    cls: a.ans === truth ? 'ok' : '',
    h:
      a.ans === 'blur'
        ? 'Net göremediği şeyin adını söyleyemez.'
        : a.ans === 'unknown'
          ? `Nöron ${a.k + 1} tanıyor ama hiçbir ada bağlı değil.<br><b>Sıra sende:</b> ━ Bu yatay ya da ┃ Bu dikey.`
          : `Nöron ${a.k + 1} → <b>${eAnsTxt(a.ans)}</b>${truth != null ? (a.ans === truth ? ' ✓' : ' ✗') : ''}`
  });
  el.innerHTML = stripHTML(boxes);
}

function eAge(st) {
  const grown = st.age >= EYE.age;
  $('#eAgeN').textContent = `${Math.min(st.age, EYE.age)}/${EYE.age} bakış`;
  $('#eAgeBar').style.width = Math.round((100 * Math.min(st.age, EYE.age)) / EYE.age) + '%';
  $('#eAgeBar').classList.toggle('done', grown);
  $('#eAgeHint').textContent = grown
    ? 'Pamuk büyüdü. Gözündeki nöronlar artık değişmiyor; sadece adlar (yatay, dikey) öğrenilmeye devam ediyor.'
    : 'Pamuk yavruyken her bakış, kazanan nöronun resmini değiştirir. 24 bakıştan sonra bu pencere kapanır.';
  const y = Object.assign({ h: 0, v: 0, o: 0 }, st.youth);
  $('#eWorld').innerHTML =
    `<span>Yavruyken gördükleri:</span><b>━ ${y.h}</b><b>┃ ${y.v}</b><b>✏️ ${y.o}</b>`;
}
function eLog(st) {
  const rows = (st.hist || []).slice(-6).reverse();
  $('#elog').innerHTML =
    `<thead><tr><th>#</th><th>resim</th><th>kazanan</th><th>benzerlik</th><th>dedi</th></tr></thead><tbody>${
      rows
        .map(
          e => `<tr>
    <td class="num">${e.n}</td><td>${ePic(e.x, 22, 1)}</td><td>nöron ${e.k + 1}</td><td class="num ${e.m < EYE.see ? 'mk-bad' : ''}">${ePct(e.m)}</td><td>${eAnsTxt(e.ans)}</td></tr>`
        )
        .join('') || '<tr><td colspan="5" class="hint">Henüz bakış yok.</td></tr>'
    }</tbody>`;
}
