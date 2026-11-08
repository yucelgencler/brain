"use strict";
/* ------------------------------------------------------------------
   ÖĞRENME YOLU ARAYÜZÜ: seviye 1–5
   Model: js/neuron.js, içerik: js/levels.js
------------------------------------------------------------------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE='bos-beyin-yol-v1';
const sgn=v=>(v>1e-9?'+':'')+num(v);
const onoff=v=>v?'yanık':'sönük';
const exDesc=x=>`A ${onoff(x[0])}, B ${onoff(x[1])}`;

/* ---------- Durum ve kayıt ---------- */
const P={v:2,level:'light',rec:{}};
const levelByKey=k=>LEVELS.find(l=>l.key===k);
const levelByNo=n=>LEVELS.find(l=>l.id===n);
const L=()=>levelByKey(P.level);
// İlk sürüm kayıtları seviye numarasıyla tutuyordu
const LEGACY_NO={light:1,pair:2,inhibit:3,learn:4,xor:5};
const R=()=>P.rec[P.level];
function freshRec(lv){
  const st=Object.assign(lv.init(),{flags:{}});
  if(lv.learning)st.custom=[0,0,0,0];
  return{ver:lv.ver||1,st,done:[],active:lv.missions[0].id,notes:'',log:[],rounds:[],roundMistakes:0,cursor:0,steps:0,last:null,stage:0};
}
function load(){
  let o=null;try{o=JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){o=null;}
  for(const lv of LEVELS){
    const legacy=o&&!o.v,f=freshRec(lv),saved=o&&o.rec&&o.rec[legacy?LEGACY_NO[lv.key]:lv.key],r=saved&&(saved.ver||1)===(lv.ver||1)?saved:null;
    if(saved&&!r)f.notes=saved.notes||'';
    P.rec[lv.key]=r?Object.assign(f,r,{st:Object.assign(f.st,r.st,{flags:Object.assign({},r.st&&r.st.flags)})}):f;
  }
  const ol=o&&(o.v?o.level:Object.keys(LEGACY_NO).find(k=>LEGACY_NO[k]===o.level));
  if(ol&&levelByKey(ol))P.level=ol;
  const h=levelFromHash();if(h)P.level=h;
}
let saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(P));}catch(e){}},200);}
function levelFromHash(){const m=location.hash.match(/^#seviye-(\d+)$/);const lv=m?levelByNo(+m[1]):null;return lv?lv.key:null;}

function targetOf(st){if(!st.targetKey)return null;if(st.targetKey==='custom')return st.custom;return GATES[st.targetKey].target;}
function inputsOf(st,lv){return lv.kind==='single'?[st.b]:st.x;}
function sumOf(st,lv){return weightedSum(inputsOf(st,lv),st.w);}
function firesNow(st,lv){return fires(inputsOf(st,lv),st.w,st.theta);}

/* ---------- Seviye sayfasını kur ---------- */
let auto=0,busy=false,lastFire=null,resetArm=0;
function go(key){
  stopAuto();busy=false;lastFire=null;
  P.level=key;const no=L().id;
  if(location.hash!=='#seviye-'+no)history.replaceState(null,'','#seviye-'+no);
  buildLevel();save();
  $('#lv').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
}
function buildLevel(){
  const lv=L(),rec=R(),part=PARTS.find(p=>p.id===lv.part),pair=lv.kind==='pair';
  document.title=`Seviye ${lv.id}: ${lv.title} · Boş Beyin`;
  const el=$('#lv');
  el.innerHTML=`
    <div class="lv-head">
      <p class="kicker">Seviye ${lv.id} · ${esc(part.title)}</p>
      <h2>${esc(lv.title)}</h2>
      <p class="lv-q">${esc(lv.question)}</p>
      <div class="route">
        <p><b>Amaç:</b> ${esc(lv.goal)}</p>
        <p class="route-h"><b>Bu sayfada ne yapacaksın:</b></p>
        <ol>${lv.todo.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>
      </div>
    </div>
    <div class="lv-grid">
      <div class="lv-main">
        <div class="stage scene-wrap"><svg id="scene" viewBox="0 0 730 270" role="img" aria-label="Işık hücresi, bağlantı ve nöron"></svg></div>
        <div class="gauge" id="gauge" aria-hidden="true">
          <div class="g-track"><div class="g-fill" id="gFill"></div><div class="g-zero" id="gZero"></div><div class="g-th" id="gTh"><span></span></div><div class="g-sum" id="gSum"><span></span></div></div>
          <div class="g-scale"><span id="gLo"></span><span>nörona gelen toplam sinyal</span><span id="gHi"></span></div>
        </div>
        <p class="calc" id="calc" aria-live="polite"></p>
        <div class="sliders" id="sliders"></div>
        ${lv.learning?learnPanelHTML(lv):''}
      </div>
      <aside class="lv-side">
        <div class="panel"><div class="ph"><h3>Görevler</h3><span class="pc" id="msCount"></span></div><ol class="missions" id="missions"></ol></div>
        ${pair?`<div class="panel"><div class="ph"><h3>${lv.learning?'Eğitim verisi':'Bütün durumlar'}</h3><span class="pc" id="tScore"></span></div>
          <p class="hint">${lv.learning?'Öğretmenin elindeki 4 kart. Her satır bir girdi (A, B) ve doğru cevap. Nöron sadece bunlardan öğrenir; şu an hangilerini bildiği “nöron” sütununda.':'İki ışığın dört olası durumu. Bir satıra tıklarsan o durum nörona gösterilir.'}</p><table class="tt" id="tt"></table></div>`:''}
        <div class="panel"><h3>${pair?'Karar haritası':'Karar çizgisi'}</h3>
          <svg id="map" class="${pair?'map2':'map1'}" viewBox="${pair?'0 0 260 250':'0 0 300 92'}" role="img" aria-label="${pair?'Karar haritası':'Karar çizgisi'}"></svg>
          <p class="hint" id="mapHint">${pair?'Her köşe bir durum (sol alt: ikisi de sönük, sağ üst: ikisi de yanık). Boyalı bölgede nöron ateşler; sınırı düz bir çizgi. Dolu daire “ateşlemeli”, boş daire “susmalı” demek.':'Hangi parlaklıklarda ateşlediğini gösterir. Boyalı kısım ateşleme bölgesi, üçgen şu anki parlaklık.'}</p>
        </div>
      </aside>
    </div>
    <section class="cards4" aria-label="Beyinde ve modelde">
      <article class="icard brain"><h3>İnsan beyninde</h3><p>${esc(lv.cards.brain)}</p></article>
      <article class="icard model"><h3>Bu modelde</h3><p>${esc(lv.cards.model)}</p></article>
      <article class="icard limit"><h3>Benzetmenin sınırı</h3><p>${esc(lv.cards.limit)}</p></article>
      <article class="icard ai"><h3>Yapay zekâda</h3><p>${esc(lv.cards.ai)}</p></article>
    </section>
    <details class="deeper" id="deeper"><summary>Daha derine: hesabın kendisi</summary><div class="deeper-body">${lv.deeper}</div></details>
    <section class="notes">
      <h3>Notlarım</h3>
      <p class="hint">Bu seviyede ne fark ettin? Kendi cümlelerinle yazmak öğrendiğini pekiştirir. Bu tarayıcıda saklanır.</p>
      <textarea class="txt" id="notes" placeholder="ör. Eşik yükselince nöron daha seçici oluyor…"></textarea>
    </section>
    <nav class="lv-pn" aria-label="Seviyeler arası">
      <button class="btn" id="prevLv"${LEVELS.indexOf(lv)===0?' hidden':''}>← Önceki seviye</button>
      <button class="btn ghost small" id="resetLv">Bu seviyeyi baştan al</button>
      ${nextHTML(lv)}
    </nav>`;
  buildScene(lv);buildSliders(lv);
  if(lv.learning)wireLearn(lv);
  $('#notes').value=rec.notes||'';
  $('#notes').addEventListener('input',e=>{R().notes=e.target.value;save();});
  $('#deeper').addEventListener('toggle',e=>{if(e.target.open){R().st.flags.openedDeeper=true;refresh();}});
  const li=LEVELS.indexOf(lv);
  const pv=$('#prevLv');if(pv)pv.onclick=()=>go(LEVELS[li-1].key);
  const nx=$('#nextLv');if(nx)nx.onclick=()=>go(LEVELS[li+1].key);
  $('#resetLv').onclick=e=>{
    const b=e.currentTarget;
    if(resetArm&&Date.now()-resetArm<3500){resetArm=0;const notes=R().notes;P.rec[lv.key]=freshRec(lv);R().notes=notes;buildLevel();save();toast('Seviye baştan başladı. Notların duruyor.');return;}
    resetArm=Date.now();b.textContent='Emin misin? Tekrar bas';setTimeout(()=>{if(b.isConnected)b.textContent='Bu seviyeyi baştan al';},3500);
  };
  if(rec.st.targetKey===undefined)rec.st.targetKey=null;
  refresh();
}
function nextHTML(lv){
  const nxt=LEVELS[LEVELS.indexOf(lv)+1],skipped=ROADMAP.filter(r=>r.id>lv.id&&(!nxt||r.id<nxt.id));
  const soonNote=skipped.length?`<span class="soon">${skipped.map(r=>`${r.id}. seviye “${esc(r.title)}” ${r.lab?'laboratuvarda':'yakında'}`).join(', ')}.</span>`:'';
  if(nxt)return`${soonNote}<button class="btn primary" id="nextLv">Sonraki: ${esc(nxt.title)} →</button>`;
  const up=skipped[0];
  return`<span class="soon">Sıradaki: <b>${esc(up.title)}</b> (yakında). O zamana kadar <a href="lab.html?task=digits">rakam laboratuvarına</a> göz atabilirsin.</span>`;
}

/* ---------- Sahne: ışık hücreleri → bağlantılar → nöron → akson ---------- */
const NX=440,NY=135,NR=50;
function sceneInputs(lv){return lv.kind==='pair'?[{y:30,name:'A'},{y:160,name:'B'}]:[{y:95,name:''}];}
function buildScene(lv){
  const svg=$('#scene'),ins=sceneInputs(lv),pair=lv.kind==='pair';
  let h=`<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>
    <text class="coltitle" x="80" y="16">${pair?'Işık hücreleri':'Işık hücresi'}</text>
    <text class="coltitle" x="255" y="16">Bağlantı (sinaps)</text>
    <text class="coltitle" x="${NX}" y="16">Nöron</text>
    <text class="coltitle" x="640" y="16">Akson → beyne</text>`;
  ins.forEach((p,i)=>{
    const cy=p.y+40,x1=128,x2=NX-NR-6,y2=NY+(pair?(i?16:-16):0),mx=(x1+x2)/2,my=(cy+y2)/2;
    h+=`<line class="syn" id="syn${i}" x1="${x1}" y1="${cy}" x2="${x2}" y2="${y2}"/>
      <line class="flow" id="flow${i}" x1="${x1}" y1="${cy}" x2="${x2}" y2="${y2}"/>
      <circle class="bouton" id="bt${i}" cx="${x2}" cy="${y2}" r="5"/>
      <text class="wtext" id="wt${i}" x="${mx}" y="${my+(pair?(i?24:-12):-14)}"></text>
      <g class="delta-layer" id="dl${i}" data-x="${mx}" data-y="${my+(pair?(i?44:-32):-34)}"></g>
      <g class="inpx" id="in${i}" tabindex="0" role="button" data-i="${i}">
        <rect class="px-cell" id="pxc${i}" x="40" y="${p.y}" width="80" height="80" rx="12"/>
        <text class="px-state" id="pxs${i}" x="80" y="${p.y+46}"></text>
      </g>
      <text class="px-name" x="80" y="${p.y+100}">${pair?p.name+' ışığı':'tıkla: aç / kapat'}</text>`;
  });
  h+=`<circle class="soma" id="soma" cx="${NX}" cy="${NY}" r="${NR}"/>
    <text class="soma-t" id="somaT" x="${NX}" y="${NY+5}">nöron</text>
    <text class="soma-sub" id="somaTh" x="${NX}" y="${NY+NR+22}"></text>
    <g class="delta-layer" id="dlT" data-x="${NX}" data-y="${NY+NR+42}"></g>
    <line class="axon" id="axon" x1="${NX+NR}" y1="${NY}" x2="586" y2="${NY}" marker-end="url(#arrow)"/>
    <circle class="ap" id="ap" cx="${NX+NR+8}" cy="${NY}" r="6"/>
    <text class="out-t" id="outT" x="598" y="${NY-4}"></text>
    <text class="out-s" id="outS" x="598" y="${NY+17}"></text>`;
  svg.innerHTML=h;
  svg.querySelectorAll('.inpx').forEach(g=>{
    const tog=()=>toggleInput(+g.dataset.i);
    g.addEventListener('click',tog);
    g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});
  });
}
function toggleInput(i){
  const lv=L(),st=R().st;
  if(lv.kind==='single'){if(st.b>0){st.bLast=st.b;st.b=0;}else st.b=st.bLast||1;syncSliders();}
  else{st.x=st.x.slice();st.x[i]=st.x[i]?0:1;}
  refresh();
}
function updateScene(lv,st){
  const ins=inputsOf(st,lv),on=firesNow(st,lv);
  ins.forEach((v,i)=>{
    const w=st.w[i],aw=Math.min(Math.abs(w),2),kind=Math.abs(w)<1e-9?'zero':w>0?'pos':'neg';
    $('#pxc'+i).style.fill=`color-mix(in srgb, var(--light) ${Math.round(v*100)}%, var(--surface-2))`;
    $('#pxs'+i).textContent=lv.kind==='single'?(v?num(v,2):'kapalı'):onoff(v);
    $('#pxs'+i).classList.toggle('lit',v>0.45);
    const g=$('#in'+i);g.setAttribute('aria-pressed',v>0?'true':'false');
    g.setAttribute('aria-label',lv.kind==='single'?`Işık hücresi, parlaklık ${num(v,2)}. Aç ya da kapat`:`${sceneInputs(lv)[i].name} ışığı ${onoff(v)}. Değiştir`);
    const syn=$('#syn'+i);syn.setAttribute('class','syn '+kind);syn.style.strokeWidth=kind==='zero'?1.2:(1.4+3.2*aw/2);
    const fl=$('#flow'+i),sig=Math.abs(v*w);fl.setAttribute('class','flow '+kind);fl.style.opacity=sig<1e-9?0:clamp(0.35+sig*0.5,0,1);fl.style.strokeWidth=1.4+3.2*aw/2;
    const bt=$('#bt'+i);bt.setAttribute('class','bouton '+kind);bt.setAttribute('r',kind==='zero'?3:(3.5+3.5*aw/2));
    $('#wt'+i).textContent=kind==='zero'?'bağlantı yok (0)':`bağlantı ${sgn(w)}`;
    $('#wt'+i).setAttribute('class','wtext '+kind);
  });
  const soma=$('#soma');
  soma.classList.toggle('on',!!on);
  if(lastFire===0&&on&&!reducedMotion){soma.classList.remove('spike');void soma.getBoundingClientRect();soma.classList.add('spike');}
  lastFire=on;
  $('#somaT').classList.toggle('on',!!on);
  $('#somaTh').textContent=`eşik ${num(st.theta)}`;
  $('#ap').classList.toggle('on',!!on);
  $('#axon').classList.toggle('on',!!on);
  $('#outT').textContent=on?'ATEŞLİYOR':'SESSİZ';
  $('#outT').classList.toggle('on',!!on);
  $('#outS').textContent=on?(lv.kind==='single'?'beyne: “ışık var”':'darbe beyne gidiyor'):'beyne mesaj yok';
}
function showDeltas(r){
  if(reducedMotion)return;
  const put=(id,v,label)=>{
    if(Math.abs(v)<1e-9)return;
    const g=$('#'+id);if(!g)return;
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',g.dataset.x);t.setAttribute('y',g.dataset.y);t.setAttribute('class','delta '+(v>0?'pos':'neg'));
    t.textContent=label+sgn(v);g.appendChild(t);setTimeout(()=>t.remove(),1800);
  };
  r.dw.forEach((d,i)=>put('dl'+i,d,''));
  put('dlT',r.dtheta,'eşik ');
}

/* ---------- Toplam göstergesi ve hesap satırı ---------- */
function gaugeRange(lv){
  const[wl,wh]=lv.ranges.w,[tl,th]=lv.ranges.theta,n=lv.kind==='pair'?2:1;
  return[Math.min(0,n*wl,tl),Math.max(n*wh,th)];
}
function updateGauge(lv,st){
  const[lo,hi]=gaugeRange(lv),pos=v=>clamp((v-lo)/(hi-lo),0,1)*100;
  const s=sumOf(st,lv),on=firesNow(st,lv),z=pos(0),sp=pos(s);
  const f=$('#gFill');f.style.left=Math.min(z,sp)+'%';f.style.width=Math.abs(sp-z)+'%';f.classList.toggle('on',!!on);
  $('#gZero').style.left=z+'%';
  const edgeShift=p=>p<8?'translateX(-10%)':p>92?'translateX(-90%)':'translateX(-50%)';
  const th=$('#gTh'),tp=pos(st.theta);th.style.left=tp+'%';th.firstChild.textContent=`eşik ${num(st.theta)}`;th.firstChild.style.transform=edgeShift(tp);
  const sm=$('#gSum');sm.style.left=sp+'%';sm.firstChild.textContent=`toplam ${num(s)}`;sm.firstChild.style.transform=edgeShift(sp);sm.classList.toggle('on',!!on);
  $('#gLo').textContent=num(lo);$('#gHi').textContent=num(hi);
}
function calcHTML(lv,st){
  const ins=inputsOf(st,lv),s=sumOf(st,lv),on=firesNow(st,lv);
  const terms=ins.map((v,i)=>{
    const name=lv.kind==='single'?'parlaklık':sceneInputs(lv)[i].name;
    return`<span class="term">${name} <b>${num(v,lv.kind==='single'?2:0)}</b> × bağlantı <b class="${st.w[i]<0?'neg':'pos'}">${num(st.w[i])}</b></span>`;
  });
  return`${terms.join(' <span class="op">+</span> ')} <span class="op">=</span> <b>${num(s)}</b>
    <span class="op">${on?'≥':'<'}</span> eşik <b>${num(st.theta)}</b> <span class="op">→</span>
    <span class="res ${on?'on':''}">${on?'ateşler':'susar'}</span>`;
}

/* ---------- Kaydırıcılar ---------- */
function buildSliders(lv){
  const el=$('#sliders'),pair=lv.kind==='pair',defs=[];
  if(!pair)defs.push({key:'b',label:'Parlaklık',hint:'ışık ne kadar güçlü',r:lv.ranges.b});
  (pair?[0,1]:[0]).forEach(i=>defs.push({key:'w'+i,label:pair?`${'AB'[i]} bağlantısı`:'Bağlantı gücü',hint:lv.ranges.w[0]<0?'negatif: susturur':'sinaps ne kadar güçlü',r:lv.ranges.w}));
  defs.push({key:'theta',label:'Eşik',hint:'ateşlemek için gereken toplam',r:lv.ranges.theta});
  el.innerHTML=defs.map(d=>`<label class="sl"><span class="sl-l">${d.label}<small>${d.hint}</small></span>
    <input type="range" id="sl-${d.key}" min="${d.r[0]}" max="${d.r[1]}" step="${d.r[2]}"><output id="so-${d.key}"></output></label>`).join('');
  defs.forEach(d=>{
    $('#sl-'+d.key).addEventListener('input',e=>{
      const st=R().st,v=tidy(+e.target.value),T=targetOf(st);
      const before=T?solves(st.w,st.theta,T):false;
      if(d.key==='b')st.b=v;else if(d.key==='theta')st.theta=v;else{st.w=st.w.slice();st.w[+d.key[1]]=v;}
      if(lv.learning&&T&&before&&!solves(st.w,st.theta,T)&&st.flags.learned&&st.flags.learned[st.targetKey])st.flags.damaged=true;
      refresh(true);
    });
  });
  syncSliders();
}
function syncSliders(){
  const lv=L(),st=R().st;
  const set=(k,v)=>{const s=$('#sl-'+k);if(!s)return;s.value=v;$('#so-'+k).textContent=k==='b'?num(v,2):num(v);};
  if(lv.kind==='single')set('b',st.b);
  st.w.forEach((w,i)=>set('w'+i,w));set('theta',st.theta);
}

/* ---------- Görevler ---------- */
function checkMissions(lv,rec){
  const st=rec.st;
  if(lv.key==='pair'&&solves(st.w,st.theta,GATES.and.target))st.flags.andW=st.w.slice();
  let fresh=[];
  for(const m of lv.missions)if(!rec.done.includes(m.id)&&m.check(st)){rec.done.push(m.id);fresh.push(m);}
  if(fresh.length){
    if(fresh.some(m=>m.id===rec.active)){
      const nx=lv.missions.find(m=>!rec.done.includes(m.id));
      if(nx){rec.active=nx.id;if('target'in nx&&!lv.learning){st.targetKey=nx.target;}else if('target'in nx&&nx.target)setTarget(nx.target,true);}
    }
    toast(fresh.length===1?'Görev tamamlandı. Açıklaması görev listesinde.':`${fresh.length} görev tamamlandı.`);
    if(rec.done.length===lv.missions.length)setTimeout(()=>toast('Bu seviyenin bütün görevleri tamam. Kartları okuyup sonraki seviyeye geçebilirsin.'),1800);
  }
}
function renderMissions(lv,rec){
  const ol=$('#missions');
  $('#msCount').textContent=`${rec.done.length}/${lv.missions.length}`;
  ol.innerHTML=lv.missions.map((m,k)=>{
    const done=rec.done.includes(m.id),act=rec.active===m.id;
    return`<li class="${done?'done':''} ${act?'active':''}"><button class="ms" data-id="${m.id}" aria-pressed="${act}">
      <span class="ms-dot" aria-hidden="true">${done?'✓':k+1}</span><span class="ms-text">${m.text}</span></button>
      ${done?`<p class="aha">${esc(m.aha)}</p>`:''}</li>`;
  }).join('');
  ol.querySelectorAll('.ms').forEach(b=>b.onclick=()=>{
    const m=lv.missions.find(x=>x.id===b.dataset.id);rec.active=m.id;
    if('target'in m){if(lv.learning){if(m.target)setTarget(m.target);}else rec.st.targetKey=m.target;}
    refresh();
  });
}

/* ---------- Doğruluk tablosu ---------- */
function renderTable(lv,st){
  const T=targetOf(st),out=outputs(st.w,st.theta),custom=st.targetKey==='custom';
  let h=`<thead><tr><th>A</th><th>B</th><th>toplam</th><th>nöron</th>${T?`<th>${lv.learning?'doğru cevap':'istenen'}${custom?' <small>(tıkla)</small>':''}</th><th></th>`:''}</tr></thead><tbody>`;
  COMBOS.forEach((x,i)=>{
    const cur=st.x[0]===x[0]&&st.x[1]===x[1],s=weightedSum(x,st.w),ok=T?out[i]===T[i]:null;
    h+=`<tr class="${cur?'cur':''}" data-i="${i}" tabindex="0">
      <td>${onoff(x[0])}</td><td>${onoff(x[1])}</td><td class="num">${num(s)}</td>
      <td><span class="fire ${out[i]?'on':''}">${out[i]?'ateşler':'susar'}</span></td>
      ${T?`<td>${custom?`<button class="want" data-i="${i}">${T[i]?'ateşlesin':'sussun'}</button>`:(T[i]?'ateşlesin':'sussun')}</td><td class="${ok?'mk-ok':'mk-bad'}">${ok?'✓':'✗'}</td>`:''}</tr>`;
  });
  const tt=$('#tt');tt.innerHTML=h+'</tbody>';
  $('#tScore').textContent=T?`${score(st.w,st.theta,T)}/4 doğru`:'';
  tt.querySelectorAll('tbody tr').forEach(tr=>{
    const pick=()=>{st.x=COMBOS[+tr.dataset.i].slice();refresh();};
    tr.addEventListener('click',e=>{if(e.target.closest('.want'))return;pick();});
    tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});
  });
  tt.querySelectorAll('.want').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i;st.custom=st.custom.slice();st.custom[i]=st.custom[i]?0:1;resetRounds();refresh();
  });
}

/* ---------- Karar haritası ---------- */
function renderMap2(st){
  const svg=$('#map'),d0=-0.45,d1=1.45,X0=34,Y0=10,S=200;
  const px=v=>X0+(v-d0)/(d1-d0)*S,py=v=>Y0+S-(v-d0)/(d1-d0)*S;
  const T=targetOf(st),out=outputs(st.w,st.theta);
  let h=`<rect class="m-bg" x="${X0}" y="${Y0}" width="${S}" height="${S}"/>`;
  const poly=firePolygon(st.w,st.theta,d0,d1);
  if(poly.length>2)h+=`<polygon class="m-fire" points="${poly.map(([a,b])=>px(a).toFixed(1)+','+py(b).toFixed(1)).join(' ')}"/>`;
  // sınır çizgisi: wA·a + wB·b = eşik
  const[wa,wb]=st.w,th=st.theta,pts=[];
  if(Math.abs(wb)>1e-9){for(const a of[d0,d1]){const b=(th-wa*a)/wb;if(b>=d0-1e-9&&b<=d1+1e-9)pts.push([a,b]);}}
  if(Math.abs(wa)>1e-9){for(const b of[d0,d1]){const a=(th-wb*b)/wa;if(a>=d0-1e-9&&a<=d1+1e-9)pts.push([a,b]);}}
  if(pts.length>=2){const[p,q]=pts.sort((u,v)=>u[0]-v[0]||u[1]-v[1]).filter((p,i,arr)=>i===0||i===arr.length-1);h+=`<line class="m-line" x1="${px(p[0])}" y1="${py(p[1])}" x2="${px(q[0])}" y2="${py(q[1])}"/>`;}
  // eksenler
  h+=`<text class="m-ax" x="${px(0)}" y="${Y0+S+16}">0</text><text class="m-ax" x="${px(1)}" y="${Y0+S+16}">1</text>
    <text class="m-ax" x="${X0+S/2}" y="${Y0+S+34}">A ışığı →</text>
    <text class="m-ax" x="${X0-12}" y="${py(0)+4}">0</text><text class="m-ax" x="${X0-12}" y="${py(1)+4}">1</text>
    <text class="m-ax" x="${X0-24}" y="${Y0+S/2}" transform="rotate(-90 ${X0-24} ${Y0+S/2})">B ışığı →</text>`;
  COMBOS.forEach((x,i)=>{
    const cx=px(x[0]),cy=py(x[1]),cur=st.x[0]===x[0]&&st.x[1]===x[1];
    const want=T?T[i]:out[i],ok=T?out[i]===T[i]:null;
    if(cur)h+=`<circle class="m-cur" cx="${cx}" cy="${cy}" r="17"/>`;
    if(ok!=null)h+=`<circle class="m-ring ${ok?'ok':'bad'}" cx="${cx}" cy="${cy}" r="13"/>`;
    h+=`<circle class="m-pt ${want?'want':'nowant'}" cx="${cx}" cy="${cy}" r="8" data-i="${i}"><title>${exDesc(x)}: nöron ${out[i]?'ateşler':'susar'}${T?`, istenen: ${T[i]?'ateşlesin':'sussun'}`:''}</title></circle>`;
  });
  svg.innerHTML=h;
  svg.querySelectorAll('.m-pt').forEach(c=>c.addEventListener('click',()=>{st.x=COMBOS[+c.dataset.i].slice();refresh();}));
}
// Karenin, nöronun ateşlediği kısmı (toplam ≥ eşik): kareyi tek bir düz çizgiyle kırpar
function firePolygon(w,theta,d0,d1){
  const sq=[[d0,d0],[d1,d0],[d1,d1],[d0,d1]],f=p=>w[0]*p[0]+w[1]*p[1]-theta,out=[];
  for(let k=0;k<4;k++){
    const p=sq[k],q=sq[(k+1)%4],fp=f(p),fq=f(q);
    if(fp>=0)out.push(p);
    if((fp>=0)!==(fq>=0)){const t=fp/(fp-fq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
  }
  return out;
}
function renderMap1(st){
  const svg=$('#map'),X0=14,W=272,y=30,h=22,px=v=>X0+v*W;
  let s=`<rect class="m-bg" x="${X0}" y="${y}" width="${W}" height="${h}" rx="4"/>`;
  const edge=st.w[0]>1e-9?st.theta/st.w[0]:null;
  if(edge!=null&&edge<=1){const a=clamp(edge,0,1);s+=`<rect class="m-fire" x="${px(a)}" y="${y}" width="${px(1)-px(a)}" height="${h}"/>`;}
  if(edge!=null&&edge>0&&edge<=1)s+=`<line class="m-line" x1="${px(edge)}" y1="${y-6}" x2="${px(edge)}" y2="${y+h+6}"/><text class="m-ax strong" x="${px(edge)}" y="${y-10}">sınır ${num(edge,2)}</text>`;
  s+=`<path class="m-tri" d="M${px(st.b)},${y+h+3} l-7,12 h14 z"/>`;
  s+=`<text class="m-ax" x="${X0}" y="${y+h+30}" style="text-anchor:start">karanlık</text><text class="m-ax" x="${X0+W}" y="${y+h+30}" style="text-anchor:end">en parlak</text>`;
  svg.innerHTML=s;
  const hint=$('#mapHint');
  hint.textContent=edge==null?'Bağlantı yok: hiçbir parlaklıkta ateşlemiyor.':edge>1?`Sınır ${num(edge,2)}: bu ışık hiçbir zaman yeterince parlak değil, nöron hep susar.`:`Sınır parlaklık = eşik ÷ bağlantı = ${num(st.theta)} ÷ ${num(st.w[0])} = ${num(edge,2)}. Bunun üstündeki her parlaklıkta ateşler, altında susar.`;
}

/* ---------- Öğrenme paneli (seviye 4–5) ---------- */
function learnPanelHTML(lv){
  const sel=lv.targets.length>1
    ?`<div class="seg tsel" id="tsel">${lv.targets.map(k=>`<button data-k="${k}">${k==='custom'?'Kendi tablon':esc(GATES[k].short)}</button>`).join('')}</div>`
    :`<b>${esc(GATES[lv.targets[0]].name)}</b> <span class="pc">(${esc(GATES[lv.targets[0]].short)})</span>`;
  return`<div class="panel learn" id="learn">
    <div class="ph"><h3>Öğrenme</h3>
      <label class="ctl st2">Öğrenme hızı <select id="rate"><option value="0.1">yavaş (0,1)</option><option value="0.2">normal (0,2)</option><option value="0.5">hızlı (0,5)</option></select></label></div>
    <div class="row st2"><span class="ctl">Öğretilecek davranış:</span> ${sel}</div>
    <div class="row">
      <button class="btn primary" id="lOne">Bir örnek göster</button>
      <button class="btn st1" id="lRound">Bir tur (4 örnek)</button>
      <button class="btn st1" id="lAuto" aria-pressed="false">Otomatik ▶</button>
      <button class="btn ghost st1" id="lReset">Boş beyinle başla</button>
    </div>
    <p class="hint" id="lNext"></p>
    <div class="lstep" id="lstep" aria-live="polite"></div>
    <div class="lrounds st1"><div class="ph"><h4>Tur başına hata</h4><span class="pc" id="roundsN"></span></div><svg id="rounds" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true"></svg><p class="hint" id="roundsHint"></p></div>
    <details class="llog st2"><summary>Öğrenme defteri (son 10 adım)</summary><div class="llog-wrap"><table class="tt" id="ltable"></table></div></details>
  </div>`;
}
function wireLearn(lv){
  const rec=R(),st=rec.st;
  const rate=$('#rate');rate.value=String(st.rate);
  rate.onchange=()=>{st.rate=+rate.value;save();};
  document.querySelectorAll('#tsel button').forEach(b=>b.onclick=()=>{setTarget(b.dataset.k);refresh();});
  $('#lOne').onclick=()=>learnOne(true);
  $('#lRound').onclick=()=>{if(busy)return;for(let k=0;k<4;k++)learnOne(false);};
  $('#lAuto').onclick=()=>{auto?stopAuto():startAuto();};
  $('#lReset').onclick=()=>{stopAuto();const i0=lv.init();st.w=i0.w.slice();st.theta=i0.theta;rec.log=[];rec.last=null;resetRounds();syncSliders();refresh();toast(`Boş beyin: bütün bağlantılar 0, eşik ${num(i0.theta)}. Görevlerin duruyor.`);};
}
function setTarget(k,quiet){
  const st=R().st;if(st.targetKey===k)return;
  st.targetKey=k;resetRounds();
  if(k==='custom'&&!quiet)toast('Tablodaki “istenen” sütununa tıklayarak kendi tablonu kur, sonra öğret.');
}
function resetRounds(){const rec=R();rec.rounds=[];rec.roundMistakes=0;rec.cursor=0;}
function startAuto(){
  if(auto)return;const b=$('#lAuto');b.textContent='Durdur ⏸';b.setAttribute('aria-pressed','true');
  auto=setInterval(()=>{if(!busy)learnOne(false);},reducedMotion?400:280);
}
function stopAuto(){
  if(!auto)return;clearInterval(auto);auto=0;
  const b=$('#lAuto');if(b){b.textContent='Otomatik ▶';b.setAttribute('aria-pressed','false');}
}
function learnOne(staged){
  if(busy)return;
  const rec=R(),st=rec.st,T=targetOf(st);
  if(!T){toast('Önce öğretilecek davranışı seç.');return;}
  const i=rec.cursor%4,x=COMBOS[i],r=learnStep(x,st.w,st.theta,T[i],st.rate);
  r.w0=st.w.slice();r.theta0=st.theta;
  st.x=x.slice();
  if(staged&&!reducedMotion){
    busy=true;rec.last=r;rec.pendingShown=true;refresh();
    setTimeout(()=>{busy=false;rec.pendingShown=false;if(R()===rec)applyStep(r);},r.err?1400:900);
    return;
  }
  rec.last=r;applyStep(r);
}
function applyStep(r){
  const lv=L(),rec=R(),st=rec.st,T=targetOf(st);
  rec.cursor++;rec.steps++;
  st.w=r.w.slice();st.theta=r.theta;
  rec.log.unshift({n:rec.steps,x:r.x,out:r.out,target:r.target,err:r.err,dw:r.dw,dtheta:r.dtheta});rec.log=rec.log.slice(0,10);
  if(!r.err)st.flags.zeroErr=true;else rec.roundMistakes++;
  if(r.err&&T&&solves(st.w,st.theta,T)){
    st.flags.learned=Object.assign({},st.flags.learned,{[st.targetKey]:true});
    if(st.flags.damaged){st.flags.damaged=false;st.flags.repaired=true;}
  }
  if(rec.cursor%4===0){
    rec.rounds.push(rec.roundMistakes);rec.rounds=rec.rounds.slice(-60);rec.roundMistakes=0;
    st.flags.rounds=(st.flags.rounds||0)+1;
    if(auto&&rec.rounds[rec.rounds.length-1]===0){stopAuto();toast('Bir tur boyunca hiç hata yapmadı: öğrendi. Kural kendiliğinden durdu.');}
  }
  syncSliders();showDeltas(r);refresh();
}
function stepHTML(r,pending){
  const want=r.target?'ateşlemesi':'susması';
  const items=[
    `<b>Öğretmenin kartı:</b> ${exDesc(r.x)}. Doğru cevap: ${want}.`,
    `<b>Tahmin:</b> toplam ${num(r.sum)} ${r.out?'≥':'<'} eşik ${num(r.theta0)} → nöron <b>${r.out?'ateşledi':'sustu'}</b>.`,
    r.err===0?`<b>Karşılaştırma:</b> doğru bildi. <span class="mk-ok">Hata 0.</span>`
      :r.err>0?`<b>Karşılaştırma:</b> sustu ama ateşlemeliydi. <span class="mk-bad">Hata +1.</span>`
      :`<b>Karşılaştırma:</b> boşuna ateşledi, susmalıydı. <span class="mk-bad">Hata −1.</span>`
  ];
  const noLit=r.err&&!r.x.some(v=>v);
  if(pending){items.push(`<span class="pend">Düzeltme hesaplanıyor…</span>`);}
  else if(r.err===0){items.push(`<b>Düzeltme:</b> hata yok, hiçbir şey değişmedi.`);}
  else{
    const parts=r.x.map((xi,k)=>{const n='AB'[k];return xi?`${n} yanıktı → bağlantısı <b class="${r.dw[k]>0?'pos':'neg'}">${sgn(r.dw[k])}</b> (${num(r.w0[k])} → ${num(r.w[k])})`:`${n} sönüktü → bağlantısı değişmedi (bu hatadan sorumlu değil)`;});
    parts.push(`eşik <b>${sgn(r.dtheta)}</b> (${num(r.theta0)} → ${num(r.theta)}): artık daha ${r.dtheta<0?'kolay':'zor'} ateşler`);
    items.push(noLit
      ?`<b>Düzeltme:</b> hiçbir ışık yanmıyordu, yani hiçbir bağlantı bu hatada rol oynamadı; bağlantılar değişmedi. Sadece ${parts[parts.length-1]}.`
      :`<b>Düzeltme:</b> ${parts.join('; ')}.`);
    const s2=weightedSum(r.x,r.w),o2=s2>=r.theta-EPS?1:0;
    items.push(`<b>Şimdi aynı örnekte:</b> toplam ${num(s2)} ${o2?'≥':'<'} eşik ${num(r.theta)} → ${o2===r.target?'<span class="mk-ok">artık doğru</span>.':'hâlâ yanlış; tek adım yetmedi. Sıra bu örneğe tekrar gelince bir adım daha atacak.'}`);
  }
  return`<ol class="steps">${items.map(s=>`<li>${s}</li>`).join('')}</ol>`;
}
function learnStage(lv,rec){
  if(lv.key!=='learn')return 2;
  const learned=rec.st.flags.learned&&Object.keys(rec.st.flags.learned).length;
  return learned?2:rec.steps>=4?1:0;
}
function updateLearn(lv,rec){
  const st=rec.st,T=targetOf(st),stage=learnStage(lv,rec);
  if(stage>(rec.stage||0)&&lv.key==='learn'){
    setTimeout(()=>toast(stage===1?'Bir tur bitti. Artık bir turu tek seferde ya da otomatik oynatabilirsin; tur başına hata grafiği de açıldı.':'Öğrendi! Şimdi öğrenme hızı, başka davranışlar ve öğrenme defteri de açıldı.'),stage===2?2200:0);
  }
  rec.stage=stage;
  const box=$('#learn');box.classList.toggle('stage1',stage>=1);box.classList.toggle('stage2',stage>=2);
  document.querySelectorAll('#tsel button').forEach(b=>b.setAttribute('aria-pressed',st.targetKey===b.dataset.k?'true':'false'));
  const nx=COMBOS[rec.cursor%4];
  $('#lNext').textContent=T?`Sıradaki kart: ${exDesc(nx)}. Kartlar hep aynı sırayla gelir; dördü bir tur eder.`:'Önce öğretilecek davranışı seç.';
  $('#lstep').innerHTML=rec.last?stepHTML(rec.last,!!rec.pendingShown):`<p class="hint">Henüz kart gösterilmedi. “Bir örnek göster”e bas: öğretmen tablodan bir kart gösterir, nöron tahmin eder, yanıldıysa bağlantıları biraz düzeltilir. Her aşama burada yazacak.</p>`;
  ['lOne','lRound'].forEach(id=>{$('#'+id).disabled=busy;});
  // tur grafiği
  const rs=rec.rounds,svg=$('#rounds'),n=Math.max(20,rs.length),bw=400/n;
  let h='';for(let k=0;k<=4;k++)h+=`<line class="r-grid" x1="0" x2="400" y1="${60-k*13.5}" y2="${60-k*13.5}"/>`;
  rs.forEach((m,k)=>{h+=m?`<rect class="r-bar" x="${k*bw+1}" y="${60-m*13.5}" width="${Math.max(1,bw-2)}" height="${m*13.5}"/>`:`<rect class="r-zero" x="${k*bw+1}" y="57" width="${Math.max(1,bw-2)}" height="3"/>`;});
  svg.innerHTML=h;
  $('#roundsN').textContent=rs.length?`${rs.length} tur`:'';
  const last=rs[rs.length-1];
  $('#roundsHint').textContent=!rs.length?'Her çubuk bir tur: o turda kaç örnekte yanıldığı (0–4). Yeşil çizgi hatasız tur.'
    :last===0?'Son tur hatasız: öğrendi. Bundan sonra hiçbir bağlantı değişmez.'
    :(st.targetKey==='xor'&&rs.length>=6)?'Hata hiç sıfıra inmiyor. Kural her turda bir şeyi düzeltirken başka bir şeyi bozuyor.'
    :`Son turda ${last} hata.`;
  const tb=$('#ltable');
  tb.innerHTML=`<thead><tr><th>#</th><th>örnek</th><th>nöron</th><th>istenen</th><th>hata</th><th>değişiklik</th></tr></thead><tbody>${rec.log.map(e=>`<tr>
    <td class="num">${e.n}</td><td>${e.x.map(v=>v?'●':'○').join(' ')}</td><td>${e.out?'ateşledi':'sustu'}</td><td>${e.target?'ateşlesin':'sussun'}</td>
    <td class="${e.err?'mk-bad':'mk-ok'}">${e.err>0?'+1':e.err<0?'−1':'0'}</td>
    <td class="num">${e.err?`A ${sgn(e.dw[0])}, B ${sgn(e.dw[1])}, eşik ${sgn(e.dtheta)}`:'—'}</td></tr>`).join('')||'<tr><td colspan="6" class="hint">Henüz adım yok.</td></tr>'}</tbody>`;
}

/* ---------- Kenar menüsü ---------- */
function renderNav(){
  const el=$('#lvnav');
  el.innerHTML=PARTS.map(p=>{
    const items=ROADMAP.filter(r=>r.part===p.id).map(r=>{
      if(r.level){
        const l=r.level,rec=P.rec[l.key],n=l.missions.length,d=rec.done.length,cur=l.key===P.level;
        return`<li><a href="#seviye-${r.id}" class="${cur?'cur':''}" ${cur?'aria-current="page"':''}><span class="ln">${r.id}</span><span class="lt">${esc(l.title)}</span><span class="lp ${d===n?'full':''}">${d===n?'✓':d+'/'+n}</span></a></li>`;
      }
      if(r.lab)return`<li><a href="lab.html?task=${r.lab}" class="lab"><span class="ln">${r.id}</span><span class="lt">${esc(r.title)}</span><span class="lp">${r.note}</span></a></li>`;
      return`<li><span class="soon-i"${r.about?` title="${esc(r.about)}"`:''}><span class="ln">${r.id}</span><span class="lt">${esc(r.title)}</span><span class="lp">${r.note}</span></span></li>`;
    });
    return`<div class="pgroup"><h3>${esc(p.title)}<small>${esc(p.sub)}</small></h3><ol>${items.join('')}</ol></div>`;
  }).join('');
}

/* ---------- Hepsini güncelle ---------- */
function refresh(fromSlider){
  const lv=L(),rec=R(),st=rec.st;
  checkMissions(lv,rec);
  updateScene(lv,st);updateGauge(lv,st);
  $('#calc').innerHTML=calcHTML(lv,st);
  if(!fromSlider)syncSliders();
  else{const set=(k,v)=>{const o=$('#so-'+k);if(o)o.textContent=k==='b'?num(v,2):num(v);};if(lv.kind==='single')set('b',st.b);st.w.forEach((w,i)=>set('w'+i,w));set('theta',st.theta);}
  renderMissions(lv,rec);
  if(lv.kind==='pair'){renderTable(lv,st);renderMap2(st);}else renderMap1(st);
  if(lv.learning)updateLearn(lv,rec);
  renderNav();save();
}

let toastT=0;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),3800);}

window.addEventListener('hashchange',()=>{const k=levelFromHash();if(k&&k!==P.level)go(k);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{localStorage.setItem(STORE,JSON.stringify(P));}catch(e){}}});

load();
history.replaceState(null,'','#seviye-'+L().id);
buildLevel();
