"use strict";
/* ------------------------------------------------------------------
   ARAYÜZ
------------------------------------------------------------------- */
const $=s=>document.querySelector(s);
const fmt=n=>Math.round(n).toLocaleString('tr-TR');
const pct=p=>'%'+Math.round(p*100);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP_MS=reduced?0:520;
const STORE='bos-beyin-v1';
const FONT='"IBM Plex Sans", system-ui, sans-serif';

const S={active:'digits',tasks:{},log:[],speed:8,running:false,cellMode:'ask',deckFilter:'last',deckAll:false,padBits:DIGIT_BITS['3'].slice(),rq:{text:'kedi'}};
const layoutOf=(t,cfg)=>typeof t.inputLayout==='function'?t.inputLayout(cfg):t.inputLayout;
const view={acts:null,anim:null,hover:null,dirty:true,frame:0};
const taskById=id=>TASKS.find(t=>t.id===id);
const curTask=()=>taskById(S.active);
const cur=()=>S.tasks[S.active];
const seed=()=>(Math.random()*2147483647)|0;

function sizesFor(t,cfg){return[t.inputLabels(cfg).length,...Array(cfg.layers).fill(cfg.hidden),t.outputLabels(cfg).length];}
function newState(t,cfg){cfg=cfg?JSON.parse(JSON.stringify(cfg)):t.defaults();return{cfg,net:new Net(sizesFor(t,cfg),seed(),outActOf(t,cfg)),steps:0,seen:0,lossHist:[],accHist:[],ds:null,lastQ:null,msg:null,eval:null,axes:null};}
function getDS(st,t){if(!st.ds){st.ds=t.dataset(st.cfg);st.lastBatch=null;}return st.ds;}

/* ---------- Kalıcılık (bu tarayıcıda) ---------- */
function save(){
  try{
    const o={active:S.active,tasks:{}};
    for(const t of TASKS){const st=S.tasks[t.id];o.tasks[t.id]={cfg:st.cfg,net:st.net.toJSON(),steps:st.steps,seen:st.seen,lossHist:st.lossHist.slice(-300),accHist:st.accHist.slice(-300)};}
    localStorage.setItem(STORE,JSON.stringify(o));
  }catch(e){}
}
function load(){
  let o=null;try{o=JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){o=null;}
  for(const t of TASKS){
    let st=null;
    try{
      const sv=o&&o.tasks&&o.tasks[t.id];
      if(sv){
        const cfg=Object.assign(t.defaults(),sv.cfg);
        const net=Net.fromJSON(sv.net);
        if(JSON.stringify(net.sizes)===JSON.stringify(sizesFor(t,cfg))&&net.outAct===outActOf(t,cfg)){
          st=newState(t,cfg);st.net=net;st.steps=sv.steps||0;st.seen=sv.seen||0;st.lossHist=sv.lossHist||[];st.accHist=sv.accHist||[];
        }
      }
    }catch(e){st=null;}
    S.tasks[t.id]=st||newState(t);
  }
  if(o&&taskById(o.active))S.active=o.active;
}

/* ---------- Tema renkleri (tuval için) ---------- */
let theme={};
const rgbCache={};
function hexRgb(h){if(rgbCache[h])return rgbCache[h];let s=h.replace('#','');if(s.length===3)s=s.split('').map(c=>c+c).join('');const v=[0,2,4].map(i=>parseInt(s.slice(i,i+2),16));rgbCache[h]=v;return v;}
function mix(a,b,t){const A=hexRgb(a),B=hexRgb(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`;}
function rgba(h,a){const v=hexRgb(h);return`rgba(${v[0]},${v[1]},${v[2]},${a})`;}
function isDark(){const d=document.documentElement.dataset.theme;return d==='dark'||(d!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);}
function readTheme(){
  const cs=getComputedStyle(document.documentElement),g=n=>cs.getPropertyValue(n).trim();
  theme={pos:g('--pos'),neg:g('--neg'),off:g('--node-off'),on:g('--node-on'),ink:g('--ink'),ink2:g('--ink-2'),line:g('--line'),ok:g('--ok'),bad:g('--bad'),held:g('--held'),surface:g('--surface'),surface2:g('--surface-2')};
}
function classColor(i,n){const h=(205+i/Math.max(1,n)*300)%360;return`hsl(${h} 62% ${isDark()?66:42}%)`;}

/* ---------- Ağ tuvali ---------- */
const cv=$('#net'),ctx=cv.getContext('2d');
let VW=0,VH=0,DPR=1,pos=[],layerX=[],layerSpacing=[];

function resizeCanvas(){
  const w=cv.parentElement.clientWidth-20;if(w<=0)return;
  const t=curTask(),sz=cur().net.sizes,grid=layoutOf(t,cur().cfg);
  const cols=sz.filter((n,i)=>!(i===0&&grid));
  const maxN=Math.max(8,...cols);
  const h=w<640?clamp(maxN*13+70,340,560):clamp(maxN*17+70,400,660);
  DPR=window.devicePixelRatio||1;
  cv.width=Math.round(w*DPR);cv.height=Math.round(h*DPR);cv.style.height=h+'px';
  VW=w;VH=h;computeLayout();view.dirty=true;
}
function labelWidth(labels,size){ctx.font=`${size}px ${FONT}`;let m=0;for(const s of labels)m=Math.max(m,ctx.measureText(s).width);return m;}
function computeLayout(){
  const t=curTask(),st=cur(),sz=st.net.sizes,L=sz.length;
  const top=44,bot=14,avail=VH-top-bot;
  const inL=t.inputLabels(st.cfg),outL=t.outputLabels(st.cfg);
  const narrow=VW<640,grid=layoutOf(t,st.cfg);
  const leftPad=grid?10:Math.min(narrow?64:96,12+labelWidth(inL,narrow?10:11.5));
  const rightPad=Math.min(narrow?80:120,22+labelWidth(outL,12)+34);
  pos=[];layerX=[];layerSpacing=[];
  let a,gridW=0;
  if(grid){
    const {cols,rows}=grid,wide=cols>rows*2;
    const cell=Math.min(avail/rows,(VW*(wide?(narrow?0.5:0.42):(narrow?0.28:0.2)))/cols,28);
    gridW=cell*cols;const y0=top+(avail-cell*rows)/2;
    const layer=[];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)layer.push({x:leftPad+c*cell+cell/2,y:y0+r*cell+cell/2,r:cell*0.4,sq:true});
    pos.push(layer);layerX.push(leftPad+gridW/2);layerSpacing.push(cell);
    a=leftPad+gridW+(narrow?40:70);
  }else a=leftPad+10;
  const b=VW-rightPad;
  const first=grid?1:0;
  for(let l=first;l<L;l++){
    const n=sz[l],k=L-1-first;
    const x=k===0?b:a+(b-a)*(l-first)/k;
    const sp=n?Math.min(avail/n,32):0,total=sp*Math.max(0,n-1),y0=top+(avail-total)/2;
    const r=clamp(sp*0.36,2.2,10.5);
    const layer=[];for(let i=0;i<n;i++)layer.push({x,y:y0+i*sp,r,sq:false});
    pos.push(layer);layerX.push(x);layerSpacing.push(sp);
  }
}
function hiddenName(l,i){const st=cur();return(st.cfg.layers>1?l+'.':'')+'G'+(i+1);}
function nodeName(l,i){const t=curTask(),st=cur(),L=st.net.sizes.length-1;if(l===0)return t.inputLabels(st.cfg)[i];if(l===L)return t.outputLabels(st.cfg)[i];return hiddenName(l,i);}
function nodeFill(l,v,L,sig){
  if(v==null)return theme.off;
  if(l===0)return mix(theme.off,theme.on,clamp(v,0,1));
  if(l===L)return mix(theme.off,theme.on,sig?clamp(v,0,1):Math.sqrt(clamp(v,0,1)));
  return v>=0?mix(theme.off,theme.on,clamp(v,0,1)):mix(theme.off,theme.neg,clamp(-v,0,1));
}

function drawEdges(l,acts,reached,dimAll){
  const net=cur().net,W=net.W[l],nin=net.sizes[l],nout=net.sizes[l+1],P0=pos[l],P1=pos[l+1];
  const useAct=!!(acts&&reached),a=useAct?acts[l]:null;
  let mx=1e-9;
  for(let j=0;j<nout;j++)for(let i=0;i<nin;i++){const v=Math.abs(useAct?W[j*nin+i]*a[i]:W[j*nin+i]);if(v>mx)mx=v;}
  const NB=7,buckets=[[],[]].map(()=>Array.from({length:NB},()=>[]));
  for(let j=0;j<nout;j++)for(let i=0;i<nin;i++){
    const v=useAct?W[j*nin+i]*a[i]:W[j*nin+i],m=Math.abs(v)/mx;if(m<0.06)continue;
    buckets[v>0?0:1][Math.min(NB-1,Math.floor(m*NB))].push(i,j);
  }
  let f=acts?(reached?1:0.22):0.7;if(dimAll)f*=0.3;
  for(let s=0;s<2;s++){
    ctx.strokeStyle=s?theme.neg:theme.pos;
    for(let bk=0;bk<NB;bk++){
      const arr=buckets[s][bk];if(!arr.length)continue;
      const q=(bk+1)/NB;
      ctx.globalAlpha=(0.05+0.72*Math.pow(q,1.4))*f;ctx.lineWidth=0.5+2.4*Math.pow(q,1.6);
      ctx.beginPath();
      for(let k=0;k<arr.length;k+=2){const p=P0[arr[k]],r=P1[arr[k+1]];ctx.moveTo(p.x,p.y);ctx.lineTo(r.x,r.y);}
      ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
}
function drawHoverEdges(h){
  const net=cur().net,L=net.sizes.length-1;
  const draw=(l,filter)=>{
    const W=net.W[l],nin=net.sizes[l],nout=net.sizes[l+1];let mx=1e-9;
    for(let j=0;j<nout;j++)for(let i=0;i<nin;i++)if(filter(i,j))mx=Math.max(mx,Math.abs(W[j*nin+i]));
    for(let j=0;j<nout;j++)for(let i=0;i<nin;i++){
      if(!filter(i,j))continue;const w=W[j*nin+i],m=Math.abs(w)/mx;if(m<0.04)continue;
      ctx.strokeStyle=w>0?theme.pos:theme.neg;ctx.globalAlpha=0.25+0.75*m;ctx.lineWidth=0.8+2.6*m;
      ctx.beginPath();ctx.moveTo(pos[l][i].x,pos[l][i].y);ctx.lineTo(pos[l+1][j].x,pos[l+1][j].y);ctx.stroke();
    }
  };
  if(h.l>0)draw(h.l-1,(i,j)=>j===h.i);
  if(h.l<L)draw(h.l,(i)=>i===h.i);
  ctx.globalAlpha=1;
}
function drawParticles(l,frac,acts){
  const net=cur().net,W=net.W[l],nin=net.sizes[l],nout=net.sizes[l+1],a=acts[l];
  const list=[];
  for(let j=0;j<nout;j++)for(let i=0;i<nin;i++){const c=W[j*nin+i]*a[i];if(c)list.push([Math.abs(c),c,i,j]);}
  list.sort((p,q)=>q[0]-p[0]);
  const top=list.slice(0,48);
  top.forEach((e,rank)=>{
    const f=clamp(frac*1.35-(rank%6)*0.06,0,1);if(f<=0||f>=1)return;
    const p=pos[l][e[2]],q=pos[l+1][e[3]];
    ctx.fillStyle=e[1]>0?theme.pos:theme.neg;ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.arc(p.x+(q.x-p.x)*f,p.y+(q.y-p.y)*f,2.6,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

function drawNet(now){
  if(!VW)return;
  const t=curTask(),st=cur(),net=st.net,L=net.sizes.length-1;
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.clearRect(0,0,VW,VH);
  let acts=view.acts,p=Infinity;
  if(view.anim){
    p=(now-view.anim.t0)/STEP_MS;acts=view.anim.acts;
    if(p>L+0.35){view.anim=null;p=Infinity;acts=view.acts;renderAnswer();}
  }
  // katman başlıkları
  ctx.font=`500 12.5px ${FONT}`;ctx.fillStyle=theme.ink2;ctx.textAlign='center';ctx.textBaseline='alphabetic';
  for(let l=0;l<=L;l++){
    const name=l===0?'Duyu nöronları':l===L?'Cevap nöronları':(st.cfg.layers>1?`Çağrışım ${l}`:'Çağrışım katmanı');
    ctx.fillText(name,clamp(layerX[l],50,VW-50),18);
  }
  // bağlantılar
  for(let l=0;l<L;l++)drawEdges(l,acts,p>=l,!!view.hover);
  if(view.hover)drawHoverEdges(view.hover);
  if(view.anim&&p<L)drawParticles(Math.floor(p),p-Math.floor(p),acts);
  // nöronlar
  const outL=t.outputLabels(st.cfg),inL=t.inputLabels(st.cfg);
  const sig=net.outAct==='sigmoid';
  let win=-1;if(acts&&p>=L&&outL.length){const an=taskAnswer(t,st.cfg,acts[L]);win=an?an.win:-1;}
  for(let l=0;l<=L;l++){
    const vals=acts&&p>=l?acts[l]:null,fade=acts?clamp(p-l,0,1):1;
    pos[l].forEach((n,i)=>{
      const v=vals?vals[i]:null;
      ctx.fillStyle=v==null?theme.off:nodeFill(l,v*fade,L,sig);
      ctx.strokeStyle=theme.line;ctx.lineWidth=1;
      if(n.sq){roundRect(n.x-n.r,n.y-n.r,n.r*2,n.r*2,Math.min(4,n.r*0.3));}
      else{ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);}
      ctx.fill();ctx.stroke();
      if(view.hover&&view.hover.l===l&&view.hover.i===i){ctx.strokeStyle=theme.ink;ctx.lineWidth=2;ctx.stroke();}
    });
  }
  // kazanan cevap halkası
  if(win>=0){const n=pos[L][win];ctx.strokeStyle=theme.pos;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(n.x,n.y,n.r+4.5,0,Math.PI*2);ctx.stroke();}
  // etiketler
  ctx.textBaseline='middle';
  if(!layoutOf(t,st.cfg)){
    const sp=layerSpacing[0],every=sp>=9?1:Math.ceil(9/Math.max(sp,0.1)),fs=Math.min(11.5,Math.max(9,sp*0.8));
    ctx.font=`${fs}px ${FONT}`;ctx.textAlign='right';
    pos[0].forEach((n,i)=>{if(i%every)return;const on=acts&&p>=0&&acts[0][i]>0.5;ctx.fillStyle=on?theme.ink:theme.ink2;ctx.fillText(inL[i],n.x-n.r-6,n.y);});
  }
  {
    const sp=layerSpacing[L],every=sp>=9?1:Math.ceil(9/Math.max(sp,0.1)),fs=Math.min(12.5,Math.max(9,sp*0.8));
    ctx.textAlign='left';
    pos[L].forEach((n,i)=>{
      const pr=acts&&p>=L?acts[L][i]:null;const isWin=i===win;
      const showP=pr!=null&&(sig?pr>0.05&&pr<0.95:pr>=0.05);
      if(i%every&&!isWin&&!showP)return;
      ctx.font=`${isWin?600:400} ${fs}px ${FONT}`;ctx.fillStyle=isWin?theme.pos:(sig&&pr>0.5?theme.ink:theme.ink2);
      let s=outL[i];if(showP)s+='  '+pct(pr);
      ctx.fillText(s,n.x+n.r+8,n.y);
    });
  }
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
}

/* ---------- İpucu (tooltip) ---------- */
const tip=$('#tip');
function hit(mx,my){let best=null,bd=1e9;pos.forEach((layer,l)=>layer.forEach((n,i)=>{const d=Math.hypot(n.x-mx,n.y-my);if(d<Math.max(n.r+4,7)&&d<bd){bd=d;best={l,i};}}));return best;}
function tipHTML(h){
  const st=cur(),net=st.net,L=net.sizes.length-1,acts=view.acts;
  const val=acts?acts[h.l][h.i]:null;
  const kind=h.l===0?'Duyu nöronu':h.l===L?'Cevap nöronu':'Çağrışım nöronu';
  let s=`<b>${esc(nodeName(h.l,h.i))}</b><br>${kind}`;
  if(val!=null)s+=`<br>${h.l===L?'Olasılık '+pct(val):'Ateşlenme '+val.toFixed(2)}`;
  if(h.l>0){
    const W=net.W[h.l-1],nin=net.sizes[h.l-1],a=acts?acts[h.l-1]:null;
    const arr=[];for(let i=0;i<nin;i++){const w=W[h.i*nin+i];arr.push([a?w*a[i]:w,i]);}
    arr.sort((x,y)=>Math.abs(y[0])-Math.abs(x[0]));
    const top=arr.slice(0,3).filter(e=>Math.abs(e[0])>1e-3).map(e=>`${esc(nodeName(h.l-1,e[1]))} (${e[0]>0?'+':'−'}${Math.abs(e[0]).toFixed(2)})`);
    if(top.length)s+=`<br>${a?'Bu soruda en çok etkileyenler':'En güçlü bağlantıları'}: ${top.join(', ')}`;
  }
  return s;
}
function showTip(h,mx,my){
  if(!h){tip.style.display='none';return;}
  tip.innerHTML=tipHTML(h);tip.style.display='block';
  const sw=cv.parentElement.clientWidth,tw=tip.offsetWidth;
  tip.style.left=clamp(mx+24,4,sw-tw-4)+'px';tip.style.top=(my+22)+'px';
}
function onPointer(e){
  const r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  const h=hit(mx,my);
  const same=(h&&view.hover&&h.l===view.hover.l&&h.i===view.hover.i)||(!h&&!view.hover);
  view.hover=h;showTip(h,mx+10,my+10);if(!same)view.dirty=true;
}
cv.addEventListener('pointermove',onPointer);
cv.addEventListener('pointerdown',onPointer);
cv.addEventListener('pointerleave',()=>{view.hover=null;tip.style.display='none';view.dirty=true;});

/* ---------- Eğitim ---------- */
function trainSteps(n){
  const t=curTask(),st=cur(),ds=getDS(st,t);
  if(!ds.train.length)return false;
  const bs=Math.min(32,ds.train.length);let tot=0;
  for(let k=0;k<n;k++){
    const idx=[];for(let b=0;b<bs;b++)idx.push((Math.random()*ds.train.length)|0);
    const batch=idx.map(i=>ds.train[i]);
    // Son adımın kartlarını ve beynin onları görürken (düzeltmeden önce) ne dediğini sakla
    if(k===n-1)st.lastBatch={step:st.steps+1,ran:n,items:idx.map(i=>{const a=taskAnswer(t,st.cfg,st.net.predict(ds.train[i].x));return{i,label:a?a.label:'–',p:a?a.p:0};})};
    tot+=st.net.trainBatch(batch,st.cfg.lr);st.steps++;st.seen+=bs;
  }
  st.lossHist.push(tot/n);if(st.lossHist.length>800)st.lossHist=st.lossHist.filter((_,i)=>i%2===0);
  return true;
}
function evaluate(){
  const t=curTask(),st=cur(),ds=getDS(st,t);let tr=0,te=0;
  const idx=x=>{const a=taskAnswer(t,st.cfg,st.net.predict(x));return a?a.idx:-1;};
  for(const ex of ds.train)if(idx(ex.x)===ex.y)tr++;
  for(const ex of ds.test)if(idx(ex.x)===ex.y)te++;
  st.eval={train:tr,trainN:ds.train.length,test:te,testN:ds.test.length};
  if(st.steps>0){st.accHist.push(ds.train.length?tr/ds.train.length:0);if(st.accHist.length>800)st.accHist=st.accHist.filter((_,i)=>i%2===0);}
}
function setRunning(on){
  S.running=on;const b=$('#btnTrain');b.textContent=on?'Durdur':'Eğit';b.setAttribute('aria-pressed',on?'true':'false');
  if(!on){evaluate();renderStats();updatePanel();drawMap();drawChart();renderAnswer();renderDeck();save();}
}
function refreshActs(){const st=cur();if(st.lastQ&&!view.anim)view.acts=st.net.forward(st.lastQ.x);}
function frame(now){
  view.frame++;
  if(S.running){
    if(!trainSteps(S.speed)){setRunning(false);toast('Öğretilecek örnek yok.');}
    else{
      refreshActs();
      if(view.frame%4===0){evaluate();renderStats();}
      if(view.frame%6===0&&!view.anim)renderAnswer();
      if(view.frame%8===0){updatePanel();drawMap();drawChart();}
      if(view.frame%16===0)renderDeck();
      view.dirty=true;
    }
  }
  if(view.anim)view.dirty=true;
  if(view.dirty){view.dirty=false;drawNet(now);}
  requestAnimationFrame(frame);
}

/* ---------- Sorma ---------- */
function askText(raw){
  raw=raw.trim();if(!raw)return;
  const teach=raw.match(/^([\p{L}][\p{L}\s’'-]*?)\s*(?:=|:|→|->)\s*([\p{L}][\p{L}\s’'-]*)$/u);
  if(teach){teachWord(trLower(teach[1]),trLower(teach[2]));return;}
  const norm=normalizeQ(raw);
  for(const t of [curTask(),...TASKS.filter(x=>x!==curTask())]){const q=t.parse(norm,S.tasks[t.id].cfg);if(q){askQ(t,q,true);return;}}
  const st=cur();st.lastQ=null;view.acts=null;view.anim=null;
  st.msg=`<p class="answer-q">“${esc(raw)}”</p><p>Bunu anlayacak bir beyin bölgesi yok. Bir kelime sor (<code>kedi</code>) ya da <code>aslan = hayvan</code> yazarak yeni bir kelime öğret.</p>`;
  renderAnswer();view.dirty=true;
}
function askQ(t,q,animate){
  if(S.active!==t.id)switchTask(t.id);
  if(t.kind==='read'){S.rq=q;const inp=document.querySelector('#rdIn');if(inp&&!q.edited&&document.activeElement!==inp)inp.value=q.text;}
  const st=cur(),x=t.encode(q,st.cfg);
  if(x.error){
    st.lastQ=null;view.acts=null;view.anim=null;
    if(x.error==='unknown'){
      st.msg=`<p class="answer-q">“${esc(q.w)}” ne?</p><p>Bu beyin “${esc(q.w)}” kelimesini hiç duymadı; onun için bir duyu nöronu yok. Öğretmek için soru kutusuna <code>${esc(q.w)} = anlamı</code> yaz. Ya da “Kelimeler (okuyarak)” sekmesinde bu kelimeyi yine de okut: orada beyin kelimeyi şeklinden tahmin edebiliyor.</p>`;
      const inp=$('#askInput');inp.value=q.w+' = ';inp.focus();
    }else st.msg=`<p>${esc(x.error)}</p>`;
    renderAnswer();view.dirty=true;return;
  }
  st.msg=null;st.lastQ={q,x};view.acts=st.net.forward(x);
  view.anim=animate&&STEP_MS>0?{t0:performance.now(),acts:view.acts}:null;
  renderAnswer();view.dirty=true;
  if(animate){const inf=answerInfo();addLog(t,q,inf);}
}
function answerInfo(){
  const t=curTask(),st=cur();if(!st.lastQ)return null;
  const acts=st.net.forward(st.lastQ.x),L=acts.length-1,out=acts[L];
  const ans=taskAnswer(t,st.cfg,out);if(!ans)return null;
  const truth=t.truth(st.lastQ.q,st.cfg),best=ans.win;
  const h=acts[L-1],W=st.net.W[L-1],nin=st.net.sizes[L-1];
  const contrib=best<0?[]:[...h.keys()].map(i=>[h[i]*W[best*nin+i],i]).sort((a,b)=>b[0]-a[0]).filter(e=>e[0]>0.05).slice(0,3);
  return{label:ans.label,p:ans.p,alts:ans.alts,count:ans.count,truth,ok:truth==null?null:truth===ans.label,why:contrib.map(e=>hiddenName(L-1,e[1]))};
}
function renderAnswer(){
  const t=curTask(),st=cur(),el=$('#answer');
  if(st.msg){el.innerHTML=st.msg;return;}
  if(!st.lastQ){
    el.innerHTML=`<p class="answer-q">Henüz soru yok</p><p>Beyin şu an ${st.steps?'eğitimli ama sessiz':'boş: bütün bağlantılar rastgele'}. Yukarıdan bir şey sor, sonra <b>Eğit</b>’e bas ve aynı sorunun cevabının öğrendikçe nasıl değiştiğini izle.</p>`;
    return;
  }
  const qt=esc(t.qText(st.lastQ.q));
  if(view.anim){el.innerHTML=`<p class="answer-q">${qt}</p><p class="answer-thinking">Sinyal katmanlardan geçiyor…</p>`;return;}
  const a=answerInfo();if(!a){el.innerHTML=`<p class="answer-q">${qt}</p><p>Bu bölgede henüz cevap nöronu yok.</p>`;return;}
  let html=`<p class="answer-q">${qt}</p><div class="answer-main"><span class="answer-val">${esc(a.label)}</span><span class="answer-conf">${pct(a.p)} emin</span>`;
  if(a.ok!=null)html+=`<span class="verdict ${a.ok?'ok':'bad'}">${a.ok?'doğru':'yanlış, doğrusu '+esc(a.truth)}</span>`;
  html+='</div>';
  if(a.alts.length)html+=`<p class="answer-alts">Öteki adaylar: ${a.alts.map(([l,p])=>`${esc(l)} (${pct(p)})`).join(', ')}</p>`;
  if(a.count!=null)html+=`<p class="answer-why">Cevap bir termometre gibi okunuyor: ${a.count} eşik nöronu ateşlendi${a.count?` (≥ ${esc(curTask().outputLabels(st.cfg)[a.count-1].replace('≥ ',''))} dahil)`:''}, ötesi sönük.</p>`;
  if(a.why.length)html+=`<p class="answer-why">Bu cevabı en çok ${a.why.join(', ')} nöronları itti. Üzerlerine gelip neye tepki verdiklerine bakabilirsin.</p>`;
  const notes=[];
  if(!st.steps)notes.push('Beyin henüz hiç eğitilmedi; bu cevap rastgele bağlantıların tesadüfü.');
  if(t.kind==='arith'&&st.cfg.held.includes(st.lastQ.q.a+','+st.lastQ.q.b))notes.push('Bu soru eğitimde hiç gösterilmedi. Cevabı ezberden değil, çıkarımla veriyor.');
  if(t.kind==='digits'&&a.truth==null)notes.push('Bu çizim eğitimdeki hiçbir örnekle birebir aynı değil; beyin en yakın deseni arıyor.');
  if(t.kind==='read'){
    const q=st.lastQ.q;
    if(a.truth==null&&!q.edited)notes.push('Bu kelime sözlükte yok, beyin onu hiç görmedi. Cevabı harf şekillerinin benzerliğinden tahmin ediyor.');
    if(q.mods&&q.mods.some(m=>m.includes('kaydır')))notes.push('Harfler sağa kaydı: beyin aynı kelimeyi bambaşka piksellerde görüyor.');
  }
  if(notes.length)html+=`<p class="answer-note">${notes.join(' ')}</p>`;
  el.innerHTML=html;
}
function addLog(t,q,inf){
  if(!inf)return;
  S.log.unshift({id:t.id,q,text:t.kind==='digits'?'çizim':t.kind==='read'?'okuma: '+readTask.label(q):t.qText(q).replace(/[“”]/g,'').replace(' ne?',''),ans:inf.label,ok:inf.ok});
  S.log=S.log.slice(0,8);renderLog();
}
function renderLog(){
  const el=$('#log');el.innerHTML='';
  S.log.forEach(e=>{
    const b=document.createElement('button');
    const mk=e.ok==null?'':e.ok?' <span class="m-ok">✓</span>':' <span class="m-bad">✗</span>';
    b.innerHTML=`${esc(e.text)}: ${esc(e.ans)}${mk}`;
    b.title='Yeniden sor';
    b.onclick=()=>{const t=taskById(e.id);if(t.kind==='digits'){S.padBits=e.q.bits.slice();}askQ(t,e.q,true);if(t.kind==='digits'||t.kind==='read')updatePanel();};
    el.appendChild(b);
  });
}

/* ---------- Yapı değişikliği: yeni nöronlar doğar, eskiler korunur ---------- */
function restructure(t,st,mutate){
  const oldIn=t.inputLabels(st.cfg),oldOut=t.outputLabels(st.cfg);
  mutate(st.cfg);
  const newIn=t.inputLabels(st.cfg),newOut=t.outputLabels(st.cfg);
  st.net=st.net.resized(oldIn,newIn,oldOut,newOut,seed());st.ds=null;st.axes=null;
  if(st.lastQ){const x=t.encode(st.lastQ.q,st.cfg);st.lastQ=x.error?null:{q:st.lastQ.q,x};}
  view.acts=st.lastQ?st.net.forward(st.lastQ.x):null;view.anim=null;view.hover=null;
  resizeCanvas();evaluate();refreshAll();save();
  return{addedIn:newIn.filter(s=>!oldIn.includes(s)),addedOut:newOut.filter(s=>!oldOut.includes(s)),removedIn:oldIn.filter(s=>!newIn.includes(s)),removedOut:oldOut.filter(s=>!newOut.includes(s))};
}
function teachWord(w,c){
  const t=S.active==='read'?readTask:wordTask;if(S.active!==t.id)switchTask(t.id);
  const st=cur();
  const res=restructure(t,st,cfg=>{cfg.text=setPair(cfg.text,w,c);});
  const parts=[];
  if(t===wordTask&&res.addedIn.length)parts.push(`“${w}” için yeni bir duyu nöronu doğdu`);
  if(t===readTask&&res.addedIn.length)parts.push(`kelime uzun olduğu için tahtaya ${res.addedIn.length} yeni piksel nöronu eklendi`);
  if(res.addedOut.length)parts.push(`“${c}” anlamı için yeni bir cevap nöronu doğdu`);
  if(!parts.length)parts.push(t===readTask?`“${w}” sözlüğe “${c}” olarak eklendi`:`“${w}” artık “${c}” olarak öğretilecek`);
  toast(parts.join(', ')+'. Öğrenmesi için Eğit’e bas.');
  $('#askInput').value='';
  askQ(t,t===readTask?{text:w}:{w},true);
}

/* ---------- Sağ panel: göreve özel arayüz ---------- */
let refs={};
const PANELS={
  arith:{
    build(el,t,st){
      const n=t.nums.length;
      el.innerHTML=`<h2>Karne</h2>
        <p class="hint">Her hücre, beynin o soruya şu anki cevabı. Yeşil doğru, kırmızı yanlış; renk koyulaştıkça daha emin. Kesik çizgili hücreler sınav soruları: eğitimde hiç gösterilmez.</p>
        <div class="row"><span class="ctl">Hücreye tıklayınca</span>
          <div class="seg" id="cellMode"><button data-v="ask">beyne sor</button><button data-v="held">sınava ayır</button></div></div>
        <div class="karne" id="karne" style="grid-template-columns:repeat(${n+1},minmax(0,1fr))"></div>
        <h3>Sayıları nasıl hissetsin?</h3>
        <div class="seg" id="enc"><button data-v="onehot">ezber: her sayıya bir nöron</button><button data-v="thermo">miktar: termometre gibi</button></div>
        <p class="hint" style="margin-top:8px">Miktar kodlamasında hem soru hem cevap termometredir: “7” yedi nöronun dolması demek. Değiştirmek yeni bir boş beyin kurar; iki kodlamada sınav sorularını karşılaştır.</p>`;
      const k=el.querySelector('#karne');refs.cells=[];
      k.insertAdjacentHTML('beforeend',`<div class="hd">${t.sym}</div>`);
      for(const b of t.nums)k.insertAdjacentHTML('beforeend',`<div class="hd">${b}</div>`);
      for(const a of t.nums){
        k.insertAdjacentHTML('beforeend',`<div class="hd">${a}</div>`);
        for(const b of t.nums){
          const c=document.createElement('button');c.className='cell';c.dataset.a=a;c.dataset.b=b;
          c.onclick=()=>{
            if(S.cellMode==='ask')askQ(t,{a,b},true);
            else{const key=a+','+b,h=st.cfg.held,i=h.indexOf(key);if(i>=0)h.splice(i,1);else h.push(key);st.ds=null;evaluate();updatePanel();renderStats();renderAnswer();save();}
          };
          k.appendChild(c);refs.cells.push(c);
        }
      }
      el.querySelectorAll('#cellMode button').forEach(b=>b.onclick=()=>{S.cellMode=b.dataset.v;updatePanel();});
      el.querySelectorAll('#enc button').forEach(b=>b.onclick=()=>{if(st.cfg.encoding===b.dataset.v)return;st.cfg.encoding=b.dataset.v;rebuild(b.dataset.v==='thermo'?'Yeni boş beyin: sayıları miktar olarak hissediyor.':'Yeni boş beyin: her sayı ayrı bir nöron.');});
    },
    update(el,t,st){
      el.querySelectorAll('#cellMode button').forEach(b=>b.setAttribute('aria-pressed',S.cellMode===b.dataset.v));
      el.querySelectorAll('#enc button').forEach(b=>b.setAttribute('aria-pressed',st.cfg.encoding===b.dataset.v));
      for(const c of refs.cells||[]){
        const a=+c.dataset.a,b=+c.dataset.b,an=taskAnswer(t,st.cfg,st.net.predict(t.encode({a,b},st.cfg))),lab=an.label,ok=lab===t.truth({a,b});
        c.textContent=lab;c.style.background=rgba(ok?theme.ok:theme.bad,0.1+0.6*an.p);
        c.classList.toggle('held',st.cfg.held.includes(a+','+b));
        c.setAttribute('aria-label',`${a} ${t.sym} ${b}: beyin ${lab} diyor, ${ok?'doğru':'yanlış'}`);
      }
    }
  },
  digits:{
    build(el,t,st){
      el.innerHTML=`<h2>Çizim tahtası</h2>
        <p class="hint">Piksellere tıklayarak ya da sürükleyerek bir rakam çiz. Beyin sen çizdikçe tahmin eder; “Beyne sor” sinyali adım adım gösterir.</p>
        <div class="padwrap"><div class="pad" id="pad"></div><div class="bars" id="bars"></div></div>
        <div class="row" id="tpl"></div>
        <div class="row"><button class="btn small" id="noise">Bozulma ekle</button><button class="btn small" id="clear">Temizle</button><button class="btn small primary" id="askPad">Beyne sor</button></div>
        <label class="ctl" style="margin-top:6px">Eğitim örneklerindeki bozulma <input type="range" id="noiseLvl" min="0" max="4"><output id="noiseOut"></output></label>
        <h3>Yeni bir şekil öğret</h3>
        <p class="hint">Tahtadaki çizime bir ad ver. Yeni ad, yeni bir cevap nöronu doğurur; aynı ada birkaç farklı çizim öğretmek daha iyi tanımasını sağlar.</p>
        <div class="row"><input class="txt" id="lbl" placeholder="Ad, ör. kalp ya da A" style="flex:1;min-width:120px"><button class="btn small" id="teach">Bu çizimi öğret</button></div>
        <div class="chips" id="customs"></div>`;
      const pad=el.querySelector('#pad');refs.px=[];
      for(let i=0;i<35;i++){const b=document.createElement('button');b.className='px';b.dataset.i=i;b.setAttribute('aria-label',`piksel ${Math.floor(i/5)+1}. satır ${i%5+1}. sütun`);
        b.addEventListener('click',e=>{if(e.detail===0)setPx(i,S.padBits[i]?0:1);});pad.appendChild(b);refs.px.push(b);}
      let paint=null;
      pad.addEventListener('pointerdown',e=>{const c=e.target.closest('.px');if(!c)return;e.preventDefault();paint=S.padBits[+c.dataset.i]?0:1;setPx(+c.dataset.i,paint);});
      pad.addEventListener('pointermove',e=>{if(paint==null)return;const c=document.elementFromPoint(e.clientX,e.clientY);const p=c&&c.closest&&c.closest('.px');if(p)setPx(+p.dataset.i,paint);});
      window.addEventListener('pointerup',()=>{paint=null;});window.addEventListener('pointercancel',()=>{paint=null;});
      const tpl=el.querySelector('#tpl');
      for(const k of Object.keys(DIGIT_BITS)){const b=document.createElement('button');b.className='btn small';b.textContent=k;b.setAttribute('aria-label',k+' rakamını tahtaya koy');b.onclick=()=>{S.padBits=DIGIT_BITS[k].slice();padChanged();};tpl.appendChild(b);}
      el.querySelector('#noise').onclick=()=>{S.padBits=noisyBits(S.padBits,2,Math.random);padChanged();};
      el.querySelector('#clear').onclick=()=>{S.padBits=new Array(35).fill(0);padChanged();};
      el.querySelector('#askPad').onclick=()=>askQ(t,{bits:S.padBits.slice()},true);
      const nl=el.querySelector('#noiseLvl');nl.value=st.cfg.noise;
      nl.oninput=()=>{el.querySelector('#noiseOut').textContent=nl.value+' piksel';};
      nl.onchange=()=>{st.cfg.noise=+nl.value;st.ds=null;evaluate();renderStats();renderDeck(true);save();toast(`Eğitim örneklerinde artık en çok ${nl.value} piksel bozulma var.`);};
      el.querySelector('#teach').onclick=()=>{
        const label=el.querySelector('#lbl').value.trim();
        if(!label){toast('Önce çizime bir ad yaz.');return;}
        if(!S.padBits.some(v=>v)){toast('Önce tahtaya bir şey çiz.');return;}
        const res=restructure(t,cur(),cfg=>{cfg.custom.push({label,bits:S.padBits.slice()});});
        toast(res.addedOut.length?`“${label}” için yeni bir cevap nöronu doğdu. Öğrenmesi için Eğit’e bas.`:`“${label}” için bir örnek daha eklendi. Eğit’e bas.`);
      };
    },
    update(el,t,st){
      refs.px.forEach((b,i)=>b.setAttribute('aria-pressed',S.padBits[i]?'true':'false'));
      el.querySelector('#noiseOut').textContent=st.cfg.noise+' piksel';
      const outs=t.outputLabels(st.cfg),pr=st.net.predict(S.padBits),ord=[...pr.keys()].sort((a,b)=>pr[b]-pr[a]).slice(0,5);
      el.querySelector('#bars').innerHTML=ord.map(i=>`<div class="bar"><span>${esc(outs[i])}</span><span class="tr"><i style="width:${(pr[i]*100).toFixed(1)}%"></i></span><span>${pct(pr[i])}</span></div>`).join('');
      const counts={};for(const c of st.cfg.custom)counts[c.label]=(counts[c.label]||0)+1;
      const cs=el.querySelector('#customs');cs.innerHTML='';
      for(const [label,n] of Object.entries(counts)){
        const s=document.createElement('span');s.className='chip';s.innerHTML=`${esc(label)} <span class="pc">${n} örnek</span>`;
        const x=document.createElement('button');x.textContent='×';x.setAttribute('aria-label',`“${label}” şeklini unuttur`);
        x.onclick=()=>{restructure(t,cur(),cfg=>{cfg.custom=cfg.custom.filter(c=>c.label!==label);});toast(`“${label}” ve cevap nöronu silindi.`);};
        s.appendChild(x);cs.appendChild(s);
      }
    }
  },
  words:{
    build(el,t,st){
      el.innerHTML=`<h2>Sözlük</h2>
        <p class="hint">Her satır “kelime = anlam”. Yeni kelime yeni bir duyu nöronu, yeni anlam yeni bir cevap nöronu demek; eski bağlantılar korunur. Soru kutusundan da öğretebilirsin.</p>
        <textarea class="txt" id="dict" spellcheck="false" aria-label="Sözlük"></textarea>
        <div class="row"><button class="btn small primary" id="apply">Sözlüğü beyne aktar</button></div>
        <h3>Şu an ne biliyor?</h3>
        <ul class="wordlist" id="wl"></ul>`;
      el.querySelector('#dict').value=st.cfg.text;
      el.querySelector('#apply').onclick=()=>{
        const text=el.querySelector('#dict').value;
        if(!parsePairs(text).length){toast('Sözlükte en az bir “kelime = anlam” satırı olmalı.');return;}
        const r=restructure(t,cur(),cfg=>{cfg.text=text;});
        const msg=[];
        if(r.addedIn.length)msg.push(`${r.addedIn.length} yeni kelime nöronu doğdu`);
        if(r.addedOut.length)msg.push(`${r.addedOut.length} yeni anlam nöronu doğdu`);
        if(r.removedIn.length||r.removedOut.length)msg.push(`${r.removedIn.length+r.removedOut.length} nöron silindi`);
        toast((msg.length?msg.join(', '):'Sözlük güncellendi')+'. Öğrenmesi için Eğit’e bas.');
      };
    },
    update(el,t,st){
      const dict=el.querySelector('#dict');if(document.activeElement!==dict&&dict.value!==st.cfg.text)dict.value=st.cfg.text;
      const outs=t.outputLabels(st.cfg),wl=el.querySelector('#wl');wl.innerHTML='';
      for(const p of parsePairs(st.cfg.text)){
        const pr=st.net.predict(t.encode({w:p.w},st.cfg)),bi=argmax(pr),ok=outs[bi]===p.c;
        const li=document.createElement('li'),b=document.createElement('button');
        b.innerHTML=`<span>${esc(p.w)}</span><span class="pc">${esc(outs[bi])} ${pct(pr[bi])}</span><span class="${ok?'mk-ok':'mk-bad'}">${ok?'✓':'✗'}</span>`;
        b.onclick=()=>askQ(t,{w:p.w},true);li.appendChild(b);wl.appendChild(li);
      }
    }
  }
};
function backVowel(w){const v=[...w].reverse().find(ch=>'aıoueiöü'.includes(ch));return!v||'aıou'.includes(v);}
function readTries(cfg){
  const ws=parsePairs(cfg.text).map(p=>p.w).filter(w=>[...w].length>=3);
  const pick=n=>ws.find(w=>w===n)||null;
  const a=pick('kedi')||ws[0],b=pick('elma')||ws[1]||a,c=pick('mavi')||ws[2]||a;
  if(!a)return[];
  const pl=w=>w+(backVowel(w)?'lar':'ler'),drop=w=>[...w].filter((_,i)=>i!==1).join('');
  return[{label:pl(a),q:{text:pl(a)}},{label:drop(a),q:{text:drop(a)}},{label:'kaydırılmış '+b,shift:b},{label:pl(c),q:{text:pl(c)}},{label:drop(b),q:{text:drop(b)}}];
}
function editedRQ(bits,cols,mod){
  const prev=S.rq,base=prev.edited?prev.base:trLower(prev.text||'');
  const mods=prev.edited?prev.mods.slice():[];if(!mods.includes(mod))mods.push(mod);
  return{edited:true,bits,cols,base,mods};
}
PANELS.read={
  build(el,t,st){
    const C=t.cols(st.cfg);
    el.innerHTML=`<h2>Okuma tahtası</h2>
      <p class="hint">Bir kelime yaz: piksel resmine çevrilip beyne gösterilir. Beyin kelimeyi harf olarak değil şekil olarak görüyor, bu yüzden sözlükte olmayan kelimeleri de okutabilirsin. Piksellere tıklayıp sürükleyerek resmi elle de bozabilirsin.</p>
      <div class="row"><input class="txt" id="rdIn" placeholder="ör. kediler" style="flex:1;min-width:120px" autocomplete="off" spellcheck="false"><button class="btn small primary" id="rdAsk">Beyne okut</button></div>
      <div class="rpad" id="rpad" style="grid-template-columns:repeat(${C},minmax(0,1fr))"></div>
      <div class="bars" id="rbars"></div>
      <div class="row"><button class="btn small" id="rdShift">Bir harf sağa kaydır</button><button class="btn small" id="rdNoise">Bozulma ekle</button><button class="btn small" id="rdClear">Temizle</button></div>
      <h3>Bunları dene</h3>
      <div class="chips" id="tries"></div>
      <label class="ctl" style="margin-top:12px">Eğitim örneklerindeki bozulma <input type="range" id="rNoise" min="0" max="6"><output id="rNoiseOut"></output></label>
      <h3>Sözlük</h3>
      <p class="hint">“Kelimeler (duyarak)” sekmesinden ayrı bir sözlük. Uzun bir kelime eklersen tahta genişler ve yeni piksel nöronları doğar.</p>
      <textarea class="txt" id="rdict" spellcheck="false" aria-label="Okuma sözlüğü"></textarea>
      <div class="row"><button class="btn small primary" id="rApply">Sözlüğü beyne aktar</button></div>
      <h3>Sözlükteki kelimeleri nasıl okuyor?</h3>
      <ul class="wordlist" id="rwl"></ul>`;
    const pad=el.querySelector('#rpad');refs.rpx=[];
    for(let i=0;i<READ_ROWS*C;i++){const b=document.createElement('button');b.className='rpx';b.dataset.i=i;b.tabIndex=-1;b.setAttribute('aria-label',`piksel ${Math.floor(i/C)+1}. satır ${i%C+1}. sütun`);pad.appendChild(b);refs.rpx.push(b);}
    let paint=null;
    const setR=(i,v)=>{const bits=t.encode(S.rq,cur().cfg);if(bits[i]===v)return;bits[i]=v;askQ(t,editedRQ(bits,C,'elle değiştirilmiş'),false);updatePanel();};
    pad.addEventListener('pointerdown',e=>{const c=e.target.closest('.rpx');if(!c)return;e.preventDefault();const bits=t.encode(S.rq,cur().cfg);paint=bits[+c.dataset.i]?0:1;setR(+c.dataset.i,paint);});
    pad.addEventListener('pointermove',e=>{if(paint==null)return;const c=document.elementFromPoint(e.clientX,e.clientY);const p=c&&c.closest&&c.closest('.rpx');if(p)setR(+p.dataset.i,paint);});
    window.addEventListener('pointerup',()=>{paint=null;});window.addEventListener('pointercancel',()=>{paint=null;});
    const inp=el.querySelector('#rdIn');inp.value=S.rq.edited?'':S.rq.text;
    inp.addEventListener('input',()=>{askQ(t,{text:inp.value},false);updatePanel();});
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();askQ(t,{text:inp.value},true);updatePanel();}});
    el.querySelector('#rdAsk').onclick=()=>{askQ(t,S.rq,true);updatePanel();};
    el.querySelector('#rdShift').onclick=()=>{const cfg=cur().cfg;askQ(t,editedRQ(shiftBits(t.encode(S.rq,cfg),C,4),C,'bir harf kaydırılmış'),true);updatePanel();};
    el.querySelector('#rdNoise').onclick=()=>{const cfg=cur().cfg;askQ(t,editedRQ(noisyBits(t.encode(S.rq,cfg),3,Math.random),C,'bozulmuş'),true);updatePanel();};
    el.querySelector('#rdClear').onclick=()=>{inp.value='';askQ(t,{text:''},false);updatePanel();};
    const tries=el.querySelector('#tries');
    for(const tr of readTries(st.cfg)){
      const b=document.createElement('button');b.className='try';b.textContent=tr.label;
      b.onclick=()=>{
        if(tr.shift){inp.value=tr.shift;S.rq={text:tr.shift};askQ(t,editedRQ(shiftBits(renderWord(tr.shift,C),C,4),C,'bir harf kaydırılmış'),true);}
        else{inp.value=tr.q.text;askQ(t,tr.q,true);}
        updatePanel();
      };
      tries.appendChild(b);
    }
    const nl=el.querySelector('#rNoise');nl.value=st.cfg.noise;
    nl.oninput=()=>{el.querySelector('#rNoiseOut').textContent=nl.value+' piksel';};
    nl.onchange=()=>{cur().cfg.noise=+nl.value;cur().ds=null;evaluate();renderStats();renderDeck(true);save();toast(`Eğitim örneklerinde artık en çok ${nl.value} piksel bozulma var.`);};
    el.querySelector('#rdict').value=st.cfg.text;
    el.querySelector('#rApply').onclick=()=>{
      const text=el.querySelector('#rdict').value;
      if(!parsePairs(text).length){toast('Sözlükte en az bir “kelime = anlam” satırı olmalı.');return;}
      const r=restructure(t,cur(),cfg=>{cfg.text=text;});
      const msg=[];
      if(r.addedIn.length)msg.push(`tahtaya ${r.addedIn.length} yeni piksel nöronu eklendi`);
      if(r.addedOut.length)msg.push(`${r.addedOut.length} yeni anlam nöronu doğdu`);
      if(r.removedOut.length)msg.push(`${r.removedOut.length} anlam nöronu silindi`);
      toast((msg.length?msg.join(', '):'Sözlük güncellendi')+'. Öğrenmesi için Eğit’e bas.');
    };
  },
  update(el,t,st){
    el.querySelector('#rNoiseOut').textContent=st.cfg.noise+' piksel';
    const bits=t.encode(S.rq,st.cfg);
    (refs.rpx||[]).forEach((b,i)=>b.setAttribute('aria-pressed',bits[i]?'true':'false'));
    const outs=t.outputLabels(st.cfg),pr=st.net.predict(bits),ord=[...pr.keys()].sort((a,b)=>pr[b]-pr[a]).slice(0,4);
    el.querySelector('#rbars').innerHTML=ord.map(i=>`<div class="bar"><span>${esc(outs[i])}</span><span class="tr"><i style="width:${(pr[i]*100).toFixed(1)}%"></i></span><span>${pct(pr[i])}</span></div>`).join('');
    const d=el.querySelector('#rdict');if(document.activeElement!==d&&d.value!==st.cfg.text)d.value=st.cfg.text;
    const wl=el.querySelector('#rwl');wl.innerHTML='';
    for(const p of parsePairs(st.cfg.text)){
      const q=st.net.predict(t.encode({text:p.w},st.cfg)),bi=argmax(q),ok=outs[bi]===p.c;
      const li=document.createElement('li'),b=document.createElement('button');
      b.innerHTML=`<span>${esc(p.w)}</span><span class="pc">${esc(outs[bi])} ${pct(q[bi])}</span><span class="${ok?'mk-ok':'mk-bad'}">${ok?'✓':'✗'}</span>`;
      b.onclick=()=>{const inp=el.querySelector('#rdIn');inp.value=p.w;askQ(t,{text:p.w},true);updatePanel();};
      li.appendChild(b);wl.appendChild(li);
    }
  }
};
function panelFor(t){return PANELS[t.id]||PANELS[t.kind];}
function buildPanel(){const t=curTask(),el=$('#taskPanel');refs={};panelFor(t).build(el,t,cur());}
function updatePanel(){const t=curTask();panelFor(t).update($('#taskPanel'),t,cur());}
function setPx(i,v){if(S.padBits[i]===v)return;S.padBits[i]=v;padChanged();}
function padChanged(){askQ(digitTask,{bits:S.padBits.slice()},false);updatePanel();}

/* ---------- Küçük grafikler ---------- */
function prepCanvas(c,h){const w=c.clientWidth||300,d=window.devicePixelRatio||1;c.width=Math.round(w*d);c.height=Math.round(h*d);c.style.height=h+'px';const g=c.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);return[g,w,h];}
function drawChart(){
  const c=$('#chart'),st=cur();const[g,w,h]=prepCanvas(c,130);
  g.font=`12px ${FONT}`;g.fillStyle=theme.ink2;g.strokeStyle=theme.line;g.lineWidth=1;
  g.beginPath();g.moveTo(0,h-14.5);g.lineTo(w,h-14.5);g.stroke();
  const L=st.lossHist,A=st.accHist;
  if(L.length<2){g.fillText('Eğitim başlayınca eğri burada çizilecek.',4,h/2);return;}
  const top=18,bot=h-18,lv=L.map(v=>Math.log10(Math.max(v,1e-4)));
  const lo=Math.min(...lv),hi=Math.max(...lv,lo+0.5);
  g.strokeStyle=theme.neg;g.lineWidth=1.6;g.beginPath();
  lv.forEach((v,i)=>{const x=i/(lv.length-1)*w,y=top+(hi-v)/(hi-lo)*(bot-top);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();
  if(A.length>1){g.strokeStyle=theme.ok;g.lineWidth=1.6;g.beginPath();A.forEach((v,i)=>{const x=i/(A.length-1)*w,y=top+(1-v)*(bot-top);i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();}
  g.fillStyle=theme.neg;g.fillText(`kayıp ${L[L.length-1].toFixed(3)}`,4,12);
  if(A.length){g.fillStyle=theme.ok;g.fillText(`doğruluk ${pct(A[A.length-1])}`,120,12);}
  g.fillStyle=theme.ink2;g.textAlign='right';g.fillText(`${fmt(st.steps)} adım`,w-2,h-2);g.textAlign='left';
}
function drawMap(){
  const c=$('#map'),t=curTask(),st=cur();const w=c.clientWidth||300;const[g,,h]=prepCanvas(c,Math.round(Math.min(300,w*0.82)));
  const pts=t.mapPoints(st.cfg),L=st.net.sizes.length-1;
  if(!pts.length){g.fillStyle=theme.ink2;g.font=`12px ${FONT}`;g.fillText('Haritada gösterilecek bir şey yok.',4,20);return;}
  const rows=pts.map(p=>st.net.forward(p.x)[L-1]);
  const{proj,comps}=pca2(rows,st.axes);st.axes=comps;
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(const[x,y]of proj){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  const sx=Math.max(x1-x0,1e-6),sy=Math.max(y1-y0,1e-6),pad=20;
  const big=pts.length>40;
  g.textAlign='center';g.textBaseline='middle';
  proj.forEach(([x,y],i)=>{
    const px=pad+(x-x0)/sx*(w-2*pad),py=pad+(y-y0)/sy*(h-2*pad),col=classColor(pts[i].cls,pts[i].n);
    if(big){g.font=`600 10px ${FONT}`;g.fillStyle=col;g.fillText(pts[i].text,px,py);}
    else{g.fillStyle=col;g.beginPath();g.arc(px,py,4.5,0,Math.PI*2);g.fill();g.font=`12px ${FONT}`;g.fillStyle=theme.ink;g.textAlign='left';g.fillText(pts[i].text,px+7,py);g.textAlign='center';}
  });
  g.textAlign='left';g.textBaseline='alphabetic';
}

/* ---------- Deste: kartları ve her karta gizli nöronların tepkisini göster ---------- */
let deckKeys='',deckRefs=[];
const DECK_LIMIT=60;
function deckEntries(t,st,ds){
  const f=S.deckFilter;
  if(f==='last'){
    const lb=st.lastBatch;if(!lb)return[];
    const cnt={};lb.items.forEach(it=>{cnt[it.i]=(cnt[it.i]||0)+1;});
    const seen=new Set();
    return lb.items.filter(it=>!seen.has(it.i)&&seen.add(it.i)).map(it=>({key:'t'+it.i,ex:ds.train[it.i],before:it,times:cnt[it.i]}));
  }
  if(f==='test')return ds.test.map((ex,i)=>({key:'s'+i,ex}));
  const all=ds.train.map((ex,i)=>({key:'t'+i,ex}));
  if(f==='wrong')return all.filter(e=>{const a=taskAnswer(t,st.cfg,st.net.predict(e.ex.x));return!a||a.idx!==e.ex.y;});
  return all;
}
function drawCardImg(c,bits,cols,rows,scale){
  c.width=cols;c.height=rows;c.style.width=cols*scale+'px';c.style.height=rows*scale+'px';
  const g=c.getContext('2d');g.fillStyle=theme.surface2;g.fillRect(0,0,cols,rows);g.fillStyle=theme.on;
  for(let i=0;i<bits.length;i++)if(bits[i])g.fillRect(i%cols,Math.floor(i/cols),1,1);
}
function drawPrint(c,h){
  const n=h.length,cw=Math.max(2,Math.min(6,Math.floor(90/Math.max(1,n))));
  c.width=n*cw;c.height=7;c.style.width=n*cw+'px';c.style.height='7px';
  const g=c.getContext('2d');
  for(let i=0;i<n;i++){g.fillStyle=nodeFill(1,h[i],99);g.fillRect(i*cw,0,cw,7);}
  g.strokeStyle=theme.line;g.lineWidth=1;g.strokeRect(0.5,0.5,n*cw-1,6);
}
function deckHint(t,st,ds,total,shown){
  const f=S.deckFilter;
  if(f==='last'){
    const lb=st.lastBatch;
    if(!lb)return'Henüz eğitim yapılmadı. Eğit butonuna bas: son adımda desteden çekilen kartlar burada görünecek.';
    let s=`${fmt(lb.step)}. adımda ${ds.train.length} kartlık desteden çekilen ${lb.items.length} kart (${total} farklı kart; iki kez çekilenlerde ×2 yazar). “Eğitimde” satırı, beynin bu kartı görürken ne dediği; kalın satır, düzeltmeden sonra şimdi ne dediği.`;
    if(lb.ran>1)s+=` Son basışta ${lb.ran} adım çalıştı; burada sadece sonuncusunun kartları var. Tek tek görmek için hızı 1’e çek.`;
    return s;
  }
  if(f==='wrong')return total?`Beynin şu an yanlış bildiği ${total} eğitim kartı.`:'Beyin bütün eğitim kartlarını doğru biliyor.';
  if(f==='test')return total?`Eğitimde hiç gösterilmeyen ${total} sınav kartı. Beyin bunları ancak öğrendiğini genelleyebilirse bilir.`:'Bu bölgede sınav kartı yok: her kelime kendi nöronu olduğu için hiç görülmemiş bir kart üretilemiyor.';
  return`Destenin tamamı: ${total} kart, doğru cevaplarına göre sıralı.${shown<total?` İlk ${shown} tanesi gösteriliyor.`:''}`;
}
function askCard(ex){
  const t=curTask();
  if(t.kind==='digits'){S.padBits=ex.x.slice();askQ(t,{bits:ex.x.slice()},true);}
  else askQ(t,ex.q,true);
  updatePanel();
  $('#stage').scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'});
}
function renderDeck(force){
  const t=curTask(),st=cur(),ds=getDS(st,t),wrap=$('#cards');if(!wrap)return;
  document.querySelectorAll('#deckFilter button').forEach(b=>b.setAttribute('aria-pressed',S.deckFilter===b.dataset.v));
  const ents=deckEntries(t,st,ds),shown=S.deckAll?ents:ents.slice(0,DECK_LIMIT);
  $('#deckHint').textContent=deckHint(t,st,ds,ents.length,shown.length);
  const more=$('#deckMore');more.hidden=ents.length<=DECK_LIMIT;
  more.textContent=S.deckAll?`Sadece ilk ${DECK_LIMIT} kartı göster`:`Hepsini göster (${ents.length})`;
  const outs=t.outputLabels(st.cfg),grid=layoutOf(t,st.cfg),L=st.net.sizes.length-1;
  const keys=[S.active,S.deckFilter,st.lastBatch?st.lastBatch.step:'',st.net.sizes.join('x'),shown.map(e=>e.key).join(',')].join('|');
  if(force||keys!==deckKeys){
    deckKeys=keys;wrap.innerHTML='';deckRefs=[];
    const scale=grid?(grid.cols>grid.rows*2?3:5):1;
    for(const e of shown){
      const b=document.createElement('button');b.className='card';b.title='Tıkla: bu kartı beyne göster';
      if(grid){const c=document.createElement('canvas');drawCardImg(c,e.ex.x,grid.cols,grid.rows,scale);b.appendChild(c);}
      else{const w=document.createElement('span');w.className='cw';w.textContent=e.ex.q.w;b.appendChild(w);}
      const ct=document.createElement('span');ct.className='ct';ct.textContent=`doğru: ${outs[e.ex.y]}${e.times>1?'  ×'+e.times:''}`;b.appendChild(ct);
      const cn=document.createElement('span');cn.className='cn';b.appendChild(cn);
      if(e.before){const cb=document.createElement('span');cb.className='cb';cb.textContent=`eğitimde: ${e.before.label} ${pct(e.before.p)}`;b.appendChild(cb);}
      const fp=document.createElement('canvas');fp.setAttribute('aria-hidden','true');b.appendChild(fp);
      b.onclick=()=>askCard(e.ex);
      wrap.appendChild(b);deckRefs.push({e,b,cn,fp});
    }
  }
  for(const r of deckRefs){
    const acts=st.net.forward(r.e.ex.x),a=taskAnswer(t,st.cfg,acts[L]);
    const ok=a&&a.idx===r.e.ex.y;
    r.b.classList.toggle('ok',!!ok);r.b.classList.toggle('bad',!ok);
    r.cn.textContent=a?`şimdi: ${a.label} ${pct(a.p)}`:'şimdi: –';
    r.b.setAttribute('aria-label',`Kart, doğru cevap ${outs[r.e.ex.y]}, beyin şimdi ${a?a.label:'cevapsız'} diyor`);
    drawPrint(r.fp,acts[L-1]);
  }
}
document.querySelectorAll('#deckFilter button').forEach(b=>b.onclick=()=>{S.deckFilter=b.dataset.v;S.deckAll=false;renderDeck(true);});
$('#deckMore').onclick=()=>{S.deckAll=!S.deckAll;renderDeck(true);};

/* ---------- Genel arayüz ---------- */
function renderStats(){
  const st=cur(),e=st.eval,parts=[['Adım',fmt(st.steps)],['Gördüğü örnek',fmt(st.seen)]];
  if(st.lossHist.length)parts.push(['Kayıp',st.lossHist[st.lossHist.length-1].toFixed(3).replace('.',',')]);
  if(e){parts.push(['Eğitim sorularında doğru',`${e.train}/${e.trainN}`]);if(e.testN)parts.push(['Sınav sorularında doğru',`${e.test}/${e.testN}`]);}
  $('#stats').innerHTML=parts.map(([k,v])=>`<div>${k}<b>${v}</b></div>`).join('');
}
function renderTabs(){
  const el=$('#tabs');el.innerHTML='';
  for(const t of TASKS){
    const b=document.createElement('button');b.className='tab';b.setAttribute('role','tab');b.setAttribute('aria-selected',t.id===S.active);
    b.innerHTML=`${esc(t.short)}<small>${esc(t.region)}</small>`;b.onclick=()=>{if(t.id!==S.active)switchTask(t.id);};
    el.appendChild(b);
  }
}
function syncControls(){
  const st=cur();
  $('#hidden').value=st.cfg.hidden;$('#hiddenOut').textContent=st.cfg.hidden;$('#layers').value=st.cfg.layers;
  const lr=$('#lr');lr.value=String(st.cfg.lr);if(lr.value!==String(st.cfg.lr)){st.cfg.lr=0.01;lr.value='0.01';}
}
function refreshAll(){
  syncControls();renderTabs();buildPanel();updatePanel();renderStats();renderAnswer();drawMap();drawChart();
  $('#about').textContent=curTask().about;renderDeck(true);view.dirty=true;
}
// Her bölge ilk açıldığında ekranda bir soru olsun; aritmetikte bilerek sınav sorusu
function ensureQ(t,st){
  if(st.lastQ)return;
  const q=t.kind==='read'?S.rq:t.kind==='digits'?{bits:S.padBits.slice()}:t.id==='add'?{a:3,b:5}:t.id==='mul'?{a:7,b:8}:t.kind==='words'?{w:parsePairs(st.cfg.text)[0]?.w}:null;
  if(!q||(t.kind==='words'&&!q.w))return;
  const x=t.encode(q,st.cfg);if(!x.error)st.lastQ={q,x};
}
function switchTask(id){
  if(S.running)setRunning(false);
  save();S.active=id;const st=cur();
  view.anim=null;view.hover=null;tip.style.display='none';
  ensureQ(curTask(),st);
  view.acts=st.lastQ?st.net.forward(st.lastQ.x):null;
  resizeCanvas();evaluate();refreshAll();
}
function rebuild(msg){
  if(S.running)setRunning(false);
  const t=curTask(),old=cur(),st=newState(t,old.cfg);
  if(old.lastQ){const x=t.encode(old.lastQ.q,st.cfg);if(!x.error)st.lastQ={q:old.lastQ.q,x};}
  S.tasks[t.id]=st;view.anim=null;view.hover=null;view.acts=st.lastQ?st.net.forward(st.lastQ.x):null;
  resizeCanvas();evaluate();refreshAll();save();if(msg)toast(msg);
}
function stepLabel(){$('#btnStep').textContent=`${S.speed} adım eğit`;}
let toastTimer=0;
function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('on'),3600);}

$('#askForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#askInput').value;askText(v);if(!/=\s*$/.test($('#askInput').value))$('#askInput').select();});
$('#btnTrain').onclick=()=>setRunning(!S.running);
$('#btnStep').onclick=()=>{if(!trainSteps(S.speed)){toast('Öğretilecek örnek yok.');return;}refreshActs();evaluate();renderStats();updatePanel();drawMap();drawChart();renderAnswer();renderDeck();view.dirty=true;};
$('#speed').oninput=e=>{S.speed=+e.target.value;stepLabel();};
$('#lr').onchange=e=>{cur().cfg.lr=+e.target.value;save();};
$('#hidden').oninput=e=>{$('#hiddenOut').textContent=e.target.value;};
$('#hidden').onchange=e=>{cur().cfg.hidden=+e.target.value;rebuild(`Yeni boş beyin: ${e.target.value} çağrışım nöronu.`);};
$('#layers').onchange=e=>{cur().cfg.layers=+e.target.value;rebuild(`Yeni boş beyin: ${e.target.value} gizli katman.`);};
$('#btnReset').onclick=()=>rebuild('Bütün bağlantılar yeniden rastgele. Beyin yine boş.');

function onThemeChange(){readTheme();view.dirty=true;updatePanel();drawMap();drawChart();renderDeck(true);}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',onThemeChange);
new MutationObserver(onThemeChange).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
let rsT=0;
new ResizeObserver(()=>{clearTimeout(rsT);rsT=setTimeout(()=>{resizeCanvas();drawMap();drawChart();},60);}).observe($('#stage'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
window.addEventListener('pagehide',save);

// Başlat
readTheme();load();
{
  const st=cur(),t=curTask();ensureQ(t,st);
  view.acts=st.lastQ?st.net.forward(st.lastQ.x):null;
}
$('#speed').value=S.speed;stepLabel();
resizeCanvas();evaluate();refreshAll();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{computeLayout();view.dirty=true;drawMap();drawChart();});
requestAnimationFrame(frame);
