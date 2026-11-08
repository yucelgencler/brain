"use strict";
/* ------------------------------------------------------------------
   ÖĞRENME YOLU ARAYÜZÜ (tezgâh düzeni)
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
// Öğrenme seviyelerinde gerçek hayat durumu (js/levels.js SCENARIOS)
const scnOf=st=>SCENARIOS[st.targetKey]||SCENARIOS.custom;
const feat=(sc,k,v)=>sc['ab'[k]][v?'on':'off'];
const featTxt=(sc,x)=>x.map((v,k)=>feat(sc,k,v).text).join(', ');
const ans=(sc,v)=>v?sc.yes:sc.no;

/* ---------- Durum ve kayıt ---------- */
const P={v:2,level:'light',rec:{}};
const levelByKey=k=>LEVELS.find(l=>l.key===k);
const levelByNo=n=>LEVELS.find(l=>l.id===n);
const L=()=>levelByKey(P.level);
// Yol haritasındaki her durak (hazır olsun olmasın) gezilebilir
const roadByKey=k=>ROADMAP.find(r=>r.key===k);
const roadByNo=n=>ROADMAP.find(r=>r.id===n);
const curRoad=()=>roadByKey(P.level);
const roadNeighbors=()=>{const i=ROADMAP.indexOf(curRoad());return[ROADMAP[i-1]||null,ROADMAP[i+1]||null];};
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
  if(ol&&roadByKey(ol))P.level=ol;
  const h=levelFromHash();if(h)P.level=h;
}
let saveT=0;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(P));}catch(e){}},200);}
function levelFromHash(){const m=location.hash.match(/^#seviye-(\d+)$/);const r=m?roadByNo(+m[1]):null;return r?r.key:null;}

function targetOf(st){if(!st.targetKey)return null;if(st.targetKey==='custom')return st.custom;return GATES[st.targetKey].target;}
function inputsOf(st,lv){return lv.kind==='single'?[st.b]:st.x;}
function sumOf(st,lv){return weightedSum(inputsOf(st,lv),st.w);}
function firesNow(st,lv){return fires(inputsOf(st,lv),st.w,st.theta);}

/* ---------- Seviye sayfasını kur ---------- */
let auto=0,busy=false,lastFire=null,resetArm=0;
function go(key){
  stopAuto();multiStop();busy=false;lastFire=null;
  P.level=key;const no=curRoad().id;
  if(location.hash!=='#seviye-'+no)history.replaceState(null,'','#seviye-'+no);
  if(L())buildLevel();else buildPlaceholder();save();
  $('#lv').focus({preventScroll:true});window.scrollTo({top:0,behavior:'auto'});
}
function buildLevel(){
  const lv=L(),rec=R(),part=PARTS.find(p=>p.id===lv.part),multi=lv.kind==='multi';
  document.title=`Seviye ${lv.id}: ${lv.title} · Boş Beyin`;
  flashPrev.clear();lastCardKey='';lastStepKey='';multiResetView();
  const el=$('#lv');el.className='lv';
  const routeOpen=!rec.routeSeen;rec.routeSeen=true;
  el.innerHTML=`
    <div class="lv-head">
      <div><p class="kicker">Seviye ${lv.id} · ${esc(part.title)}</p><h2>${esc(lv.title)}</h2></div>
      <p class="lv-q">${esc(lv.question)}</p>
    </div>
    <details class="route"${routeOpen?' open':''}><summary>Amaç ve bu sayfada ne yapacaksın</summary>
      <p><b>Amaç:</b> ${esc(lv.goal)}</p><ol>${lv.todo.map(t=>`<li>${esc(t)}</li>`).join('')}</ol></details>
    <div class="mission" id="mission" aria-live="polite"></div>
    ${multi?multiGridHTML(lv):benchHTML(lv)}
    <section class="reading" aria-label="Okuma">
      <section class="cards4" aria-label="Beyinde ve modelde">
        <article class="icard brain"><h3>İnsan beyninde</h3><p>${esc(lv.cards.brain)}</p></article>
        <article class="icard model"><h3>Bu modelde</h3><p>${esc(lv.cards.model)}</p></article>
        <article class="icard limit"><h3>Benzetmenin sınırı</h3><p>${esc(lv.cards.limit)}</p></article>
        <article class="icard ai"><h3>Yapay zekâda</h3><p>${esc(lv.cards.ai)}</p></article>
      </section>
      <details class="deeper" id="deeper"><summary>Daha derine: hesabın kendisi</summary><div class="deeper-body">${lv.deeper}</div></details>
      <div class="read-duo">
        <section class="panel"><div class="ph"><h3>Bütün görevler ve açıklamaları</h3><span class="pc" id="msCount"></span></div><ol class="missions" id="missions"></ol></section>
        <section class="panel notes">
          <h3>Notlarım</h3>
          <p class="hint">Bu seviyede ne fark ettin? Kendi cümlelerinle yazmak öğrendiğini pekiştirir. Bu tarayıcıda saklanır.</p>
          <textarea class="txt" id="notes" placeholder="ör. Eşik yükselince nöron daha seçici oluyor…"></textarea>
        </section>
      </div>
      <nav class="lv-pn" aria-label="Seviyeler arası">
        <button class="btn" id="prevLv"${roadNeighbors()[0]?'':' hidden'}>← Önceki seviye</button>
        <button class="btn ghost small" id="resetLv">Bu seviyeyi baştan al</button>
        ${nextHTML()}
      </nav>
    </section>`;
  if(multi)wireMulti(lv);
  else{buildScene(lv);buildSliders(lv);if(lv.learning)wireLearn(lv);}
  $('#notes').value=rec.notes||'';
  $('#notes').addEventListener('input',e=>{R().notes=e.target.value;save();});
  $('#deeper').addEventListener('toggle',e=>{if(e.target.open){R().st.flags.openedDeeper=true;refresh();}});
  wirePrevNext();
  $('#resetLv').onclick=e=>{
    const b=e.currentTarget;
    if(resetArm&&Date.now()-resetArm<3500){resetArm=0;const notes=R().notes;P.rec[lv.key]=freshRec(lv);R().notes=notes;R().routeSeen=true;buildLevel();save();toast('Seviye baştan başladı. Notların duruyor.');return;}
    resetArm=Date.now();b.textContent='Emin misin? Tekrar bas';setTimeout(()=>{if(b.isConnected)b.textContent='Bu seviyeyi baştan al';},3500);
  };
  if(rec.st.targetKey===undefined)rec.st.targetKey=null;
  refresh();
}
// Tezgâh: (kart) → sahne → cevap, altında adım şeridi ve yardımcı paneller
function benchHTML(lv){
  const pair=lv.kind==='pair';
  const card=lv.learning?`<div class="bench-card">
      <div class="tcard-wrap" id="tcard"></div>
      <button class="btn primary big" id="lOne">Bir örnek göster</button>
      <div class="bench-more st1"><button class="btn small" id="lRound">Bir tur</button><button class="btn small" id="lAuto" aria-pressed="false">Otomatik ▶</button><button class="btn ghost small" id="lReset">Boş beyin</button></div>
      <p class="hint" id="lNext"></p>
    </div>`:'';
  const table=pair?`<div class="panel"><div class="ph"><h3>${lv.learning?'Eğitim verisi':'Bütün durumlar'}</h3><span class="pc" id="tScore"></span></div>
      <p class="hint">${lv.learning?'Öğretmenin 4 kartı ve nöronun şu anki cevapları.':'İki ışığın dört olası durumu. Bir satıra tıklarsan o durum nörona gösterilir.'}</p><table class="tt" id="tt"></table></div>`:'';
  const map=`<div class="panel"><h3>${pair?'Karar haritası':'Karar çizgisi'}</h3>
      <svg id="map" class="${pair?'map2':'map1'}" viewBox="${pair?'0 0 260 250':'0 0 300 92'}" role="img" aria-label="${pair?'Karar haritası':'Karar çizgisi'}"></svg>
      <p class="hint" id="mapHint">${pair?'Her köşe bir durum (sol alt: ikisi de 0, sağ üst: ikisi de 1). Boyalı bölgede nöron ateşler; sınırı düz bir çizgi. Dolu daire “ateşlemeli”, boş daire “susmalı”.':'Hangi parlaklıklarda ateşlediğini gösterir. Boyalı kısım ateşleme bölgesi, üçgen şu anki parlaklık.'}</p></div>`;
  return`<section class="bench ${lv.learning?'has-card':''}">
      ${card}
      <div class="bench-scene">
        <div class="stage scene-wrap"><svg id="scene" viewBox="0 0 600 270" role="img" aria-label="Girdiler, bağlantılar ve nöron"></svg></div>
        <div class="gauge${lv.learning?' hide':''}" id="gauge" aria-hidden="true">
          <div class="g-track"><div class="g-fill" id="gFill"></div><div class="g-zero" id="gZero"></div><div class="g-th" id="gTh"><span></span></div><div class="g-sum" id="gSum"><span></span></div></div>
          <div class="g-scale"><span id="gLo"></span><span>nörona gelen toplam sinyal</span><span id="gHi"></span></div>
        </div>
        ${lv.learning?`<details class="manual" id="manual"><summary>Bağlantıları elle değiştir</summary><div class="sliders" id="sliders"></div></details>`:`<div class="sliders" id="sliders"></div>`}
      </div>
      <div class="bench-answer panel" id="answer" aria-live="polite"></div>
    </section>
    ${lv.learning?`<section class="strip" id="lstep" aria-live="polite"></section>`:''}
    <section class="bench-bottom ${lv.learning?'three':''}">${table}${map}${lv.learning?learnSideHTML(lv):''}</section>`;
}
// Cevap kutusu: nöron ne diyor, doğru mu, nasıl hesapladı
function answerHTML(lv,st){
  const on=firesNow(st,lv),T=lv.kind==='pair'?targetOf(st):null;
  let big,sub,verdict='';
  if(lv.learning){
    const sc=scnOf(st),i=COMBOS.findIndex(c=>c[0]===st.x[0]&&c[1]===st.x[1]);
    big=ans(sc,on);sub=on?'nöron ateşliyor':'nöron sessiz';
    if(T)verdict=`<div class="ans-v ${on===T[i]?'ok':'bad'}">doğru cevap: <b>${esc(ans(sc,T[i]))}</b> ${on===T[i]?'✓':'✗'}</div>`;
  }else{
    big=on?'ateşliyor':'sessiz';sub=on?(lv.kind==='single'?'beyne: “ışık var”':'darbe beyne gidiyor'):'beyne mesaj yok';
    if(T){const i=COMBOS.findIndex(c=>c[0]===st.x[0]&&c[1]===st.x[1]);verdict=`<div class="ans-v ${on===T[i]?'ok':'bad'}">istenen: ${T[i]?'ateşlesin':'sussun'} ${on===T[i]?'✓':'✗'}</div>`;}
  }
  return`<div class="ans-l">${lv.learning?'Nöronun şimdiki cevabı':'Nöronun cevabı'}</div><div class="ans-big ${on?'on':''}" data-fl="ans">${esc(big.toLocaleUpperCase('tr-TR'))}</div><div class="ans-sub">${sub}</div>${verdict}
    <div class="calc" id="calc">${calcHTML(lv,st)}</div>`;
}
function nextHTML(){
  const n=roadNeighbors()[1];if(!n)return'';
  return`<button class="btn primary" id="nextLv">Sonraki: ${n.id}. ${esc(n.title)}${n.level?'':n.lab?' (laboratuvar)':' (yakında)'} →</button>`;
}
function wirePrevNext(){
  const[p,n]=roadNeighbors();
  const pv=$('#prevLv');if(pv&&p)pv.onclick=()=>go(p.key);
  const nx=$('#nextLv');if(nx&&n)nx.onclick=()=>go(n.key);
}
// Henüz hazır olmayan ya da laboratuvarda duran seviye: tanıtım sayfası
function buildPlaceholder(){
  const r=curRoad(),part=PARTS.find(p=>p.id===r.part);
  document.title=`Seviye ${r.id}: ${r.title} · Boş Beyin`;
  const el=$('#lv');el.className='lv';
  $('#barMissions').innerHTML='';
  el.innerHTML=`
    <div class="lv-head">
      <div><p class="kicker">Seviye ${r.id} · ${esc(part.title)}</p><h2>${esc(r.title)}</h2></div>
    </div>
    <section class="panel soon-page">
      <p class="soon-badge ${r.lab?'lab':''}">${r.lab?'Şimdilik laboratuvarda':'Yakında'}</p>
      <p class="soon-about">${esc(r.about||'Bu seviyenin içeriği hazırlanıyor.')}</p>
      ${r.lab?`<p><a class="btn primary" href="lab.html?task=${r.lab}">Laboratuvarda aç →</a></p>
        <p class="hint">Laboratuvar bu konunun serbest deney hâli: daha büyük bir ağ, daha çok ayar. Öğrenme yolundaki adım adım düzene sonra kavuşacak.</p>`
        :`<p class="hint">Bu seviye henüz yapılmadı. İstediğin seviyeye geçebilirsin; hiçbir seviye kilitli değil.</p>`}
    </section>
    <nav class="lv-pn" aria-label="Seviyeler arası">
      <button class="btn" id="prevLv"${roadNeighbors()[0]?'':' hidden'}>← Önceki seviye</button>
      ${nextHTML()}
    </nav>`;
  wirePrevNext();renderNav();
}

/* ---------- Sahne: ışık hücreleri → bağlantılar → nöron → akson ---------- */
const NX=440,NY=135,NR=50;
function sceneInputs(lv){return lv.kind==='pair'?[{y:30,name:'A'},{y:160,name:'B'}]:[{y:95,name:''}];}
function buildScene(lv){
  const svg=$('#scene'),ins=sceneInputs(lv),pair=lv.kind==='pair';
  let h=`<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>
    <text class="coltitle" x="80" y="16">${lv.learning?'Özellikler (girdi)':pair?'Işık hücreleri':'Işık hücresi'}</text>
    <text class="coltitle" x="255" y="16">Bağlantı (sinaps)</text>
    <text class="coltitle" x="${NX}" y="16">Nöron</text>
    <text class="coltitle" x="540" y="16">Akson</text>`;
  ins.forEach((p,i)=>{
    const cy=p.y+40,x1=128,x2=NX-NR-6,y2=NY+(pair?(i?16:-16):0),mx=(x1+x2)/2,my=(cy+y2)/2;
    h+=`<line class="syn" id="syn${i}" x1="${x1}" y1="${cy}" x2="${x2}" y2="${y2}"/>
      <line class="flow" id="flow${i}" x1="${x1}" y1="${cy}" x2="${x2}" y2="${y2}"/>
      <circle class="bouton" id="bt${i}" cx="${x2}" cy="${y2}" r="5"/>
      <text class="wtext" id="wt${i}" data-fl="wt${i}" x="${mx}" y="${my+(pair?(i?24:-12):-14)}"></text>
      <g class="delta-layer" id="dl${i}" data-x="${mx}" data-y="${my+(pair?(i?44:-32):-34)}"></g>
      <g class="inpx" id="in${i}" tabindex="0" role="button" data-i="${i}">
        <rect class="px-cell" id="pxc${i}" x="40" y="${p.y}" width="80" height="80" rx="12"/>
        <text class="px-state" id="pxs${i}" x="80" y="${p.y+46}"></text>
      </g>
      <text class="px-name" id="pxn${i}" x="80" y="${p.y+100}">${pair?p.name+' ışığı':'tıkla: aç / kapat'}</text>`;
  });
  h+=`<circle class="soma" id="soma" cx="${NX}" cy="${NY}" r="${NR}"/>
    <text class="soma-t" id="somaT" x="${NX}" y="${NY+5}">nöron</text>
    <text class="soma-sub" id="somaTh" data-fl="th" x="${NX}" y="${NY+NR+22}"></text>
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
    const pxs=$('#pxs'+i);
    if(lv.learning){
      const sc=scnOf(st),f=feat(sc,i,v);
      pxs.textContent=f.icon;pxs.setAttribute('class','px-state emo '+(f.cls||''));pxs.setAttribute('y',+$('#pxc'+i).getAttribute('y')+53);
      $('#pxn'+i).textContent=`${'AB'[i]}: ${sc['ab'[i]].q}`;
    }else{
      pxs.textContent=lv.kind==='single'?(v?num(v,2):'kapalı'):onoff(v);
      pxs.classList.toggle('lit',v>0.45);
    }
    const g=$('#in'+i);g.setAttribute('aria-pressed',v>0?'true':'false');
    g.setAttribute('aria-label',lv.kind==='single'?`Işık hücresi, parlaklık ${num(v,2)}. Aç ya da kapat`:lv.learning?`${'AB'[i]}: ${feat(scnOf(st),i,v).text}. Değiştir`:`${sceneInputs(lv)[i].name} ışığı ${onoff(v)}. Değiştir`);
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
  const outT=$('#outT');
  if(lv.learning){
    const w=ans(scnOf(st),on).toLocaleUpperCase('tr-TR');
    outT.textContent=w;outT.classList.toggle('long',w.length>9);
    $('#outS').textContent=on?'nöron ateşliyor':'nöron sessiz';
  }else{
    outT.textContent=on?'ATEŞLİYOR':'SESSİZ';outT.classList.remove('long');
    $('#outS').textContent=on?(lv.kind==='single'?'beyne: “ışık var”':'darbe beyne gidiyor'):'beyne mesaj yok';
  }
  outT.classList.toggle('on',!!on);
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
  const lines=ins.map((v,i)=>{
    const name=lv.kind==='single'?'parlaklık':sceneInputs(lv)[i].name;
    return`<div class="cl">${i?'+ ':''}${name} <b>${num(v,lv.kind==='single'?2:0)}</b> × bağlantı <b class="${st.w[i]<0?'neg':'pos'}">${num(st.w[i])}</b></div>`;
  });
  return`${lines.join('')}<div class="cl sum">= toplam <b>${num(s)}</b> ${on?'≥':'<'} eşik <b>${num(st.theta)}</b></div>`;
}

/* ---------- Kaydırıcılar ---------- */
function buildSliders(lv){
  const el=$('#sliders'),pair=lv.kind==='pair',defs=[];
  if(!pair)defs.push({key:'b',label:'Parlaklık',hint:'ışık ne kadar güçlü',r:lv.ranges.b});
  (pair?[0,1]:[0]).forEach(i=>defs.push({key:'w'+i,label:pair?`${'AB'[i]} bağlantısı`:'Bağlantı gücü',hint:lv.ranges.w[0]<0?'negatif: susturur':'sinaps ne kadar güçlü',r:lv.ranges.w}));
  defs.push({key:'theta',label:'Eşik',hint:'ateşlemek için gereken toplam',r:lv.ranges.theta});
  el.innerHTML=defs.map(d=>`<label class="sl"><span class="sl-l">${d.label}<small>${d.hint}</small></span>
    <input type="range" id="sl-${d.key}" min="${d.r[0]}" max="${d.r[1]}" step="${d.r[2]}"><output id="so-${d.key}" data-fl="so-${d.key}"></output></label>`).join('');
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
    rec.aha=fresh[fresh.length-1].id;
    if(fresh.some(m=>m.id===rec.active)){
      const nx=lv.missions.find(m=>!rec.done.includes(m.id));
      if(nx){rec.active=nx.id;if('target'in nx&&!lv.learning){st.targetKey=nx.target;}else if('target'in nx&&nx.target)setTarget(nx.target,true);}
    }
    toast(fresh.length===1?'✓ Görev tamamlandı':`✓ ${fresh.length} görev tamamlandı`);
  }
}
const plain=h=>String(h).replace(/<[^>]+>/g,'');
function pickMission(lv,rec,id){
  const m=lv.missions.find(x=>x.id===id);rec.active=m.id;rec.aha=null;
  if('target'in m){if(lv.learning){if(m.target)setTarget(m.target);}else rec.st.targetKey=m.target;}
  refresh();
}
function renderMissions(lv,rec){
  const n=lv.missions.length,allDone=rec.done.length===n;
  // üst şerit: görev noktaları
  $('#barMissions').innerHTML=`<span class="bm-l">Görevler</span>`+lv.missions.map((m,k)=>{
    const done=rec.done.includes(m.id),act=rec.active===m.id&&!allDone;
    return`<button class="bm ${done?'done':''} ${act?'active':''}" data-id="${m.id}" title="${esc(plain(m.text))}" aria-label="Görev ${k+1}${done?', tamamlandı':''}">${done?'✓':k+1}</button>`;
  }).join('');
  $('#barMissions').querySelectorAll('.bm').forEach(b=>b.onclick=()=>pickMission(lv,rec,b.dataset.id));
  // tezgâhın üstündeki bant: şimdiki görev ya da az önce tamamlananın açıklaması
  const act=lv.missions.find(m=>m.id===rec.active),idx=lv.missions.indexOf(act),ahaM=rec.aha&&lv.missions.find(m=>m.id===rec.aha);
  let h='';
  if(ahaM)h=`<div class="aha-box"><div class="aha-main"><div class="aha-h">✓ ${ahaM.text}</div><p>${esc(ahaM.aha)}</p></div>
      <button class="btn small ${allDone?'':'primary'}" id="ahaOk">${allDone?'Tamam':`Sıradaki görev (${idx+1}/${n}) →`}</button></div>`;
  else if(allDone)h=`<div class="mis-cur done"><span class="mis-n">✓ ${n}/${n}</span><span class="mis-t">Bu seviyenin bütün görevleri tamam. Aşağıdaki kartları okuyabilir ya da sonraki seviyeye geçebilirsin.</span></div>`;
  else h=`<div class="mis-cur"><span class="mis-n">Görev ${idx+1}/${n}</span><span class="mis-t">${act.text}</span></div>`;
  $('#mission').innerHTML=h;
  const ok=$('#ahaOk');if(ok)ok.onclick=()=>{rec.aha=null;refresh();};
  const man=$('#manual');if(man&&act&&act.id==='repair'&&!allDone&&!man.dataset.auto){man.open=true;man.dataset.auto='1';}
  // okuma kısmındaki tam liste
  const ol=$('#missions');
  $('#msCount').textContent=`${rec.done.length}/${n}`;
  ol.innerHTML=lv.missions.map((m,k)=>{
    const done=rec.done.includes(m.id),a=rec.active===m.id;
    return`<li class="${done?'done':''} ${a?'active':''}"><button class="ms" data-id="${m.id}" aria-pressed="${a}">
      <span class="ms-dot" aria-hidden="true">${done?'✓':k+1}</span><span class="ms-text">${m.text}</span></button>
      ${done?`<p class="aha">${esc(m.aha)}</p>`:''}</li>`;
  }).join('');
  ol.querySelectorAll('.ms').forEach(b=>b.onclick=()=>{pickMission(lv,rec,b.dataset.id);$('#mission').scrollIntoView({behavior:reducedMotion?'auto':'smooth',block:'center'});});
}

/* ---------- Doğruluk tablosu ---------- */
function renderTable(lv,st){
  const T=targetOf(st),out=outputs(st.w,st.theta),custom=st.targetKey==='custom';
  if(lv.learning)return renderTrainTable(lv,st,T,out,custom);
  let h=`<thead><tr><th>A</th><th>B</th><th>toplam</th><th>nöron</th>${T?`<th>${lv.learning?'doğru cevap':'istenen'}${custom?' <small>(tıkla)</small>':''}</th><th></th>`:''}</tr></thead><tbody>`;
  COMBOS.forEach((x,i)=>{
    const cur=st.x[0]===x[0]&&st.x[1]===x[1],s=weightedSum(x,st.w),ok=T?out[i]===T[i]:null;
    h+=`<tr class="${cur?'cur':''}" data-i="${i}" tabindex="0">
      <td>${onoff(x[0])}</td><td>${onoff(x[1])}</td><td class="num" data-fl="ts${i}">${num(s)}</td>
      <td><span class="fire ${out[i]?'on':''}" data-fl="to${i}">${out[i]?'ateşler':'susar'}</span></td>
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

function renderTrainTable(lv,st,T,out,custom){
  const sc=scnOf(st);
  const cell=(k,v)=>{const f=feat(sc,k,v);return`<td class="fcell" title="${esc(f.text)}"><span class="ti ${f.cls||''}" aria-hidden="true">${f.icon}</span><span class="sr">${esc(f.text)}</span><small>${v}</small></td>`;};
  let h=`<caption>A: ${esc(sc.a.q)} · B: ${esc(sc.b.q)}</caption><thead><tr><th>A</th><th>B</th><th>toplam</th><th>nöron</th><th>doğru cevap${custom?' <small>(tıkla)</small>':''}</th><th></th></tr></thead><tbody>`;
  COMBOS.forEach((x,i)=>{
    const cur=st.x[0]===x[0]&&st.x[1]===x[1],ok=out[i]===T[i];
    h+=`<tr class="${cur?'cur':''}" data-i="${i}" tabindex="0">${cell(0,x[0])}${cell(1,x[1])}<td class="num" data-fl="ts${i}">${num(weightedSum(x,st.w))}</td>
      <td><span class="fire ${out[i]?'on':''}" data-fl="to${i}">${esc(ans(sc,out[i]))}</span></td>
      <td>${custom?`<button class="want" data-i="${i}">${esc(ans(sc,T[i]))}</button>`:esc(ans(sc,T[i]))}</td><td class="${ok?'mk-ok':'mk-bad'}">${ok?'✓':'✗'}</td></tr>`;
  });
  const tt=$('#tt');tt.innerHTML=h+'</tbody>';
  $('#tScore').textContent=`${score(st.w,st.theta,T)}/4 doğru`;
  tt.querySelectorAll('tbody tr').forEach(tr=>{
    const pick=()=>{st.x=COMBOS[+tr.dataset.i].slice();refresh();};
    tr.addEventListener('click',e=>{if(e.target.closest('.want'))return;pick();});
    tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick();}});
  });
  tt.querySelectorAll('.want').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;st.custom=st.custom.slice();st.custom[i]=st.custom[i]?0:1;resetRounds();refresh();});
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
    <text class="m-ax" x="${X0+S/2}" y="${Y0+S+34}">${L().learning?'A':'A ışığı'} →</text>
    <text class="m-ax" x="${X0-12}" y="${py(0)+4}">0</text><text class="m-ax" x="${X0-12}" y="${py(1)+4}">1</text>
    <text class="m-ax" x="${X0-24}" y="${Y0+S/2}" transform="rotate(-90 ${X0-24} ${Y0+S/2})">${L().learning?'B':'B ışığı'} →</text>`;
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
function learnSideHTML(lv){
  const sel=lv.targets.length>1
    ?`<div class="seg tsel" id="tsel">${lv.targets.map(k=>`<button data-k="${k}">${esc(SCENARIOS[k].short)}</button>`).join('')}</div>`
    :`<b>${esc(SCENARIOS[lv.targets[0]].title)}</b>`;
  return`<div class="panel learn-side">
    <p class="hint st0only">İlk tur bitince burada tur başına hata grafiği, öğrendikten sonra öğrenme ayarları açılacak.</p>
    <div class="st2 lset"><h3>Öğrenme ayarları</h3>
      <div class="row"><span class="ctl">Öğretilecek durum:</span> ${sel}</div>
      <label class="ctl">Öğrenme hızı <select id="rate"><option value="0.1">yavaş (0,1)</option><option value="0.2">normal (0,2)</option><option value="0.5">hızlı (0,5)</option></select></label></div>
    <div class="lrounds st1"><div class="ph"><h3>Tur başına hata</h3><span class="pc" id="roundsN"></span></div><svg id="rounds" viewBox="0 0 400 64" preserveAspectRatio="none" aria-hidden="true"></svg><p class="hint" id="roundsHint"></p></div>
    <details class="llog st2"><summary>Öğrenme defteri (son 10 adım)</summary><div class="llog-wrap"><table class="tt" id="ltable"></table></div></details>
  </div>`;
}
// Adım şeridi: kutular yan yana
function stripHTML(boxes){
  return boxes.map((b,i)=>`<div class="ph-box ${b.cls||''}" style="--d:${i}"><div class="ph-t">${b.t}</div><div class="ph-b">${b.h}</div></div>`).join('<div class="ph-arrow" aria-hidden="true">▸</div>');
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
  // Unutma deneyi: daha önce öğrendiği bir duruma dönünce artık bilmiyorsa
  const T=targetOf(st);
  if(st.flags.learned&&st.flags.learned[k]&&T&&!solves(st.w,st.theta,T)){
    st.flags.forgot=true;
    setTimeout(()=>toast(`“${SCENARIOS[k].title}” sorusunu unuttu! Tabloya bak: artık yanlış cevaplar var.`),50);
  }
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
  r.w0=st.w.slice();r.theta0=st.theta;r.key=st.targetKey;rec.cardSeq=(rec.cardSeq||0)+1;
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
  const sc=SCENARIOS[r.key]||SCENARIOS.custom,said=`“${esc(ans(sc,r.out))}”`,right=`“${esc(ans(sc,r.target))}”`;
  const boxes=[
    {t:'1 · Tahmin',h:`${esc(featTxt(sc,r.x))}<br>toplam ${num(r.sum)} ${r.out?'≥':'<'} eşik ${num(r.theta0)}<br>→ nöron ${r.out?'ateşledi':'sustu'}: <b>${said}</b>`},
    {t:'2 · Karşılaştır',cls:r.err?'bad':'ok',h:r.err===0?`Doğrusu da ${right}.<br><span class="mk-ok">Doğru, hata 0.</span>`
      :`Doğrusu ${right}.<br><span class="mk-bad">Hata ${r.err>0?'+1':'−1'}</span>: ${r.err>0?'sustu, ateşlemeliydi':'boşuna ateşledi'}.`}
  ];
  if(pending){boxes.push({t:'3 · Düzelt',h:'<span class="pend">hesaplanıyor…</span>'},{t:'4 · Şimdi',h:'<span class="pend">…</span>'});return stripHTML(boxes);}
  if(r.err===0){boxes.push({t:'3 · Düzelt',h:'Hata yok → <b>hiçbir şey değişmedi</b>.'},{t:'4 · Şimdi',h:'Bağlantılar ve eşik aynı. Sıradaki karta geç.'});return stripHTML(boxes);}
  const lines=r.x.map((xi,k)=>{const n='AB'[k],t=esc(feat(sc,k,xi).text);return xi
    ?`<div class="chg ${r.dw[k]>0?'up':'down'}">${n} (${t}) <b>${num(r.w0[k])} → ${num(r.w[k])}</b></div>`
    :`<div class="chg same">${n} (${t}) değişmedi: rol oynamadı</div>`;});
  lines.push(`<div class="chg ${r.dtheta<0?'up':'down'}">eşik <b>${num(r.theta0)} → ${num(r.theta)}</b> (daha ${r.dtheta<0?'kolay':'zor'} ateşler)</div>`);
  boxes.push({t:'3 · Düzelt',h:lines.join('')});
  const s2=weightedSum(r.x,r.w),o2=s2>=r.theta-EPS?1:0;
  boxes.push({t:'4 · Şimdi',cls:o2===r.target?'ok':'',h:`Aynı kartta toplam ${num(s2)} ${o2?'≥':'<'} eşik ${num(r.theta)}<br>→ ${o2===r.target?`artık ${right} <span class="mk-ok">✓</span>`:`hâlâ “${esc(ans(sc,o2))}”; sıra bu karta yine gelince bir adım daha`}`});
  return stripHTML(boxes);
}
function cardHTML(sc,x,target,guess,label){
  const verdict=guess==null?'':guess===target?'ok':'bad';
  return`<div class="tcard ${verdict}">
    <div class="tc-top">${esc(label)}</div>
    <div class="tc-scn">${esc(sc.title)}</div>
    <div class="tc-feats">${x.map((v,k)=>{const f=feat(sc,k,v);return`<div class="tc-f ${v?'on':'off'}"><span class="tc-i ${f.cls||''}" aria-hidden="true">${f.icon}</span><span class="tc-t">${esc(f.text)}</span><span class="tc-k">${'AB'[k]} = ${v}</span></div>`;}).join('')}</div>
    <div class="tc-ans">Doğru cevap: <b>${esc(ans(sc,target))}</b></div>
    <div class="tc-guess">${guess==null?'Nöron henüz görmedi':`Nöron o an: <b>${esc(ans(sc,guess))}</b> ${guess===target?'✓':'✗'}`}</div>
  </div>`;
}
let lastCardKey='',lastStepKey='';
function renderCard(rec,st,T){
  const wrap=$('#tcard');let html,key;
  if(rec.last){const r=rec.last,sc=SCENARIOS[r.key]||scnOf(st);html=cardHTML(sc,r.x,r.target,r.out,'Öğretmenin kartı');key='c'+(rec.cardSeq||0)+(r.key||'');}
  else if(T){const i=rec.cursor%4,sc=scnOf(st);html=cardHTML(sc,COMBOS[i],T[i],null,'Sıradaki kart');key='n'+i+st.targetKey;}
  else{wrap.innerHTML='';return;}
  wrap.innerHTML=html;
  if(key!==lastCardKey&&!auto&&!reducedMotion){const c=wrap.firstElementChild;c.classList.add('deal');}
  lastCardKey=key;
}
function learnStage(lv,rec){
  if(lv.key!=='learn')return 2;
  const learned=rec.st.flags.learned&&Object.keys(rec.st.flags.learned).length;
  return learned?2:rec.steps>=4?1:0;
}
function updateLearn(lv,rec){
  const st=rec.st,T=targetOf(st),stage=learnStage(lv,rec);
  if(stage>(rec.stage||0)&&lv.key==='learn'){
    setTimeout(()=>toast(stage===1?'Bir tur bitti. Artık bir turu tek seferde ya da otomatik oynatabilirsin; tur başına hata grafiği de açıldı.':'Öğrendi! Şimdi öğrenme hızı, başka durumlar ve öğrenme defteri de açıldı.'),stage===2?2200:0);
  }
  rec.stage=stage;
  const box=$('#lv');box.classList.toggle('stage1',stage>=1);box.classList.toggle('stage2',stage>=2);
  document.querySelectorAll('#tsel button').forEach(b=>b.setAttribute('aria-pressed',st.targetKey===b.dataset.k?'true':'false'));
  const nx=COMBOS[rec.cursor%4];
  $('#lNext').textContent=T?`Sıradaki kart: ${featTxt(scnOf(st),nx)}. Kartlar hep aynı sırayla gelir; dördü bir tur eder.`:'Önce öğretilecek durumu seç.';
  renderCard(rec,st,T);
  const stepKey=rec.last?(rec.cardSeq||0)+(rec.pendingShown?'p':''):'none';
  if(stepKey!==lastStepKey||!rec.last){$('#lstep').innerHTML=rec.last?stepHTML(rec.last,!!rec.pendingShown):`<div class="ph-box empty"><div class="ph-b">Henüz kart gösterilmedi. Soldaki <b>“Bir örnek göster”</b>e bas: öğretmen kartı nörona gösterir, nöron tahmin eder, yanıldıysa bağlantıları biraz düzeltilir. Dört aşama burada yan yana görünecek.</div></div>`;lastStepKey=stepKey;}
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

/* ---------- Üst şerit ve seviye menüsü ---------- */
function renderNav(){
  const r0=curRoad(),[pr,nx]=roadNeighbors();
  $('#barLevel').innerHTML=`<span class="bl-n">${r0.id}/${ROADMAP.length}</span> ${esc(r0.title)} <span aria-hidden="true">▾</span>`;
  $('#barPrev').disabled=!pr;$('#barNext').disabled=!nx;
  const el=$('#lvnav');
  el.innerHTML=PARTS.map(p=>{
    const items=ROADMAP.filter(r=>r.part===p.id).map(r=>{
      if(r.level){
        const l=r.level,rec=P.rec[l.key],n=l.missions.length,d=rec.done.length,cur=l.key===P.level;
        return`<li><a href="#seviye-${r.id}" class="${cur?'cur':''}" ${cur?'aria-current="page"':''}><span class="ln">${r.id}</span><span class="lt">${esc(l.title)}</span><span class="lp ${d===n?'full':''}">${d===n?'✓':d+'/'+n}</span></a></li>`;
      }
      const cur=r.key===P.level;
      return`<li><a href="#seviye-${r.id}" class="${r.lab?'lab':'soon-i'} ${cur?'cur':''}"${r.about?` title="${esc(r.about)}"`:''}><span class="ln">${r.id}</span><span class="lt">${esc(r.title)}</span><span class="lp">${r.note}</span></a></li>`;
    });
    return`<div class="pgroup"><h3>${esc(p.title)}<small>${esc(p.sub)}</small></h3><ol>${items.join('')}</ol></div>`;
  }).join('');
}
function menuOpen(on){const m=$('#lvnav'),b=$('#barLevel');m.hidden=!on;b.setAttribute('aria-expanded',on?'true':'false');}
$('#barLevel').onclick=e=>{e.stopPropagation();menuOpen($('#lvnav').hidden);};
$('#barPrev').onclick=()=>{const p=roadNeighbors()[0];if(p)go(p.key);};
$('#barNext').onclick=()=>{const n=roadNeighbors()[1];if(n)go(n.key);};
document.addEventListener('click',e=>{if(!$('#lvnav').hidden&&!e.target.closest('#lvnav'))menuOpen(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape')menuOpen(false);});
$('#lvnav').addEventListener('click',e=>{if(e.target.closest('a'))menuOpen(false);});

/* ---------- Değişen değerler yerinde parlasın ---------- */
const flashPrev=new Map();
function flashScan(){
  const quiet=reducedMotion||auto||(typeof mAuto!=='undefined'&&mAuto);
  document.querySelectorAll('[data-fl]').forEach(el=>{
    const k=el.dataset.fl,t=el.textContent;
    if(!quiet&&flashPrev.has(k)&&flashPrev.get(k)!==t){el.classList.remove('flash');void el.getBoundingClientRect();el.classList.add('flash');}
    flashPrev.set(k,t);
  });
}

/* ---------- Hepsini güncelle ---------- */
function refresh(fromSlider){
  const lv=L(),rec=R(),st=rec.st;
  checkMissions(lv,rec);
  if(lv.kind==='multi'){updateMulti(lv,rec);renderMissions(lv,rec);renderNav();flashScan();save();return;}
  updateScene(lv,st);updateGauge(lv,st);
  $('#answer').innerHTML=answerHTML(lv,st);
  if(!fromSlider)syncSliders();
  else{const set=(k,v)=>{const o=$('#so-'+k);if(o)o.textContent=k==='b'?num(v,2):num(v);};if(lv.kind==='single')set('b',st.b);st.w.forEach((w,i)=>set('w'+i,w));set('theta',st.theta);}
  renderMissions(lv,rec);
  if(lv.kind==='pair'){renderTable(lv,st);renderMap2(st);}else renderMap1(st);
  if(lv.learning)updateLearn(lv,rec);
  renderNav();flashScan();save();
}

let toastT=0;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('on'),3800);}

window.addEventListener('hashchange',()=>{const k=levelFromHash();if(k&&k!==P.level)go(k);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){try{localStorage.setItem(STORE,JSON.stringify(P));}catch(e){}}});

load();
history.replaceState(null,'','#seviye-'+curRoad().id);
if(L())buildLevel();else buildPlaceholder();
