"use strict";
/* ------------------------------------------------------------------
   ÖĞRENME YOLU: seviyelerin içeriği ve görev kontrolleri. Arayüzden bağımsız.

   Bir seviye:
     key (kayıt adı, hiç değişmez), part (bölüm), title, question
     Seviye numarası ROADMAP’teki sırasından hesaplanır (lv.id).
     kind: 'single' (tek ışık) | 'pair' (iki ışık: A ve B)
     learning: true ise öğrenme paneli açılır
     ranges: kaydırıcı aralıkları, init(): başlangıç durumu
     goal: seviyenin amacı, todo: “bu sayfada ne yapacaksın” adımları
     targets: (öğrenme seviyelerinde) seçilebilen istenen davranışlar
     missions: [{id, text, target?, check(st), aha}]  -> aha, görev tamamlanınca görünen açıklama
     cards: {brain, model, limit, ai}, deeper: "Daha derine" (HTML)

   Durum (st): single -> {b, w:[w], theta}; pair -> {x:[a,b], w:[w1,w2], theta, targetKey, target, flags}
------------------------------------------------------------------- */
const NN=(typeof module!=='undefined'&&module.exports)?require('./neuron.js'):{fires,solves,score,GATES,COMBOS,num,tidy,netPattern,netSolves,predictStep,weightedSum,unitVec,eyeInit,eyeLook,eyeLearn,rng,hebbLearn,hebbRecall};

// Öğrenme seviyelerinde her istenen davranışın gerçek hayattaki karşılığı.
// a, b: iki özellik (on: var / 1, off: yok / 0); yes/no: nöron ateşlerse / susarsa cevap.
// cls: 'dim' (soluk: yok), 'green' (yeşile boyanmış simge)
const SCENARIOS={
  and:{short:'Muz olgun mu?',title:'Muz olgun mu?',
    a:{q:'Kabuğu sarı mı?',on:{icon:'🍌',text:'sarı kabuk'},off:{icon:'🍌',text:'yeşil kabuk',cls:'green'}},
    b:{q:'Dokununca yumuşak mı?',on:{icon:'🧽',text:'yumuşak'},off:{icon:'🪨',text:'sert'}},
    yes:'olgun',no:'ham'},
  or:{short:'Kapıya bakayım mı?',title:'Kapıya bakmalı mıyım?',
    a:{q:'Zil çaldı mı?',on:{icon:'🔔',text:'zil çaldı'},off:{icon:'🔕',text:'zil sessiz',cls:'dim'}},
    b:{q:'Kapı vuruldu mu?',on:{icon:'✊',text:'kapı vuruldu'},off:{icon:'🚪',text:'kapı sessiz',cls:'dim'}},
    yes:'kapıya bak',no:'otur'},
  aNotB:{short:'Karşıya geçeyim mi?',title:'Karşıya geçebilir miyim?',
    a:{q:'Yaya ışığı yeşil mi?',on:{icon:'🚶',text:'yaya ışığı yeşil'},off:{icon:'🧍',text:'yaya ışığı kırmızı',cls:'dim'}},
    b:{q:'Araba geliyor mu?',on:{icon:'🚗',text:'araba geliyor'},off:{icon:'🛣️',text:'yol boş',cls:'dim'}},
    yes:'karşıya geç',no:'bekle'},
  nor:{short:'Uyumaya devam mı?',title:'Uyumaya devam etmeli miyim?',
    a:{q:'Alarm çaldı mı?',on:{icon:'⏰',text:'alarm çaldı'},off:{icon:'⏰',text:'alarm sessiz',cls:'dim'}},
    b:{q:'Biri seslendi mi?',on:{icon:'🗣️',text:'biri seslendi'},off:{icon:'🤫',text:'ses yok',cls:'dim'}},
    yes:'uyu',no:'uyan'},
  xor:{short:'Merdiven lambası',title:'Merdiven lambası yansın mı?',
    a:{q:'Alttaki anahtar yukarıda mı?',on:{icon:'🔼',text:'alt anahtar yukarı'},off:{icon:'🔽',text:'alt anahtar aşağı'}},
    b:{q:'Üstteki anahtar yukarıda mı?',on:{icon:'🔼',text:'üst anahtar yukarı'},off:{icon:'🔽',text:'üst anahtar aşağı'}},
    yes:'yansın',no:'sönsün'},
  custom:{short:'Kendi tablon',title:'Kendi tablon',
    a:{q:'A ışığı',on:{icon:'🟡',text:'A yanık'},off:{icon:'⚪',text:'A sönük',cls:'dim'}},
    b:{q:'B ışığı',on:{icon:'🟡',text:'B yanık'},off:{icon:'⚪',text:'B sönük',cls:'dim'}},
    yes:'ateşle',no:'sus'}
};

// Ara nöronun dört durumdaki ateşleme deseni → anlamı (sıra: 00, alt yukarı, üst yukarı, ikisi de yukarı)
const NET_PATTERNS={'0000':'hiç ateşlemiyor','1111':'her durumda ateşliyor','0001':'ikisi de yukarı','0111':'en az biri yukarı',
  '0100':'sadece alt yukarı','0010':'sadece üst yukarı','1000':'ikisi de aşağı','1110':'ikisi birden yukarı değil',
  '0110':'anahtarlar farklı','1001':'anahtarlar aynı','0101':'alt yukarı','0011':'üst yukarı','1010':'alt aşağı','1100':'üst aşağı',
  '1011':'alt aşağı ya da üst yukarı','1101':'üst aşağı ya da alt yukarı'};
// Rastgele başlangıçlardan takılmadan öğrenenler (hız 2 ile 300 turun altında)
const NET_SEEDS=[7,1,12,13,18,20,22,25,5,10,11,15];

// Seviye 5: tahmin ederek öğrenme. Kedi Pamuk ve mama: sen bir ses çıkarırsın (poşet hışırtısı, “pisi pisi”),
// Pamuk ne kadar mama beklediğini gösterir, sonra sen mama verirsin ya da vermezsin.
const PREDICT={
  cat:'Pamuk',rate:0.3,
  cues:[
    {icon:'🛍️',name:'poşet sesi',short:'poşet',btn:'Poşeti hışırdat',sound:'hışır hışır'},
    {icon:'🗣️',name:'“pisi pisi”',short:'pisi pisi',btn:'“Pisi pisi” de',sound:'pisi pisi!'}
  ],
  yes:{icon:'🐟',name:'mama verildi'},no:{icon:'🚫',name:'mama verilmedi'}
};
const pKey=x=>x.join('');
// 1. adım: ses çıkar. Pamuk o an ne kadar bekliyor? (Durumu değiştirmez, sadece anı başlatır.)
function predictCue(st,x){
  const V=NN.tidy(NN.weightedSum(x,st.w)),f=st.flags;st.pend={x:x.slice(),V};
  // engelleme / kontrol deneyinin sonunda “sadece pisi pisi” denemesi
  if(pKey(x)==='01'){if(f.lastExp==='block'){f.blockProbed=true;f.blockProbeV=V;}if(f.lastExp==='control'){f.controlProbed=true;f.controlProbeV=V;}}
  return st.pend;
}
// 2. adım: mama ver (1) ya da verme (0). Sürpriz kadar öğrenir.
function predictGive(st,reward){
  const x=st.pend?st.pend.x:[1,0];st.pend=null;
  return predictCommit(st,NN.predictStep(x,st.w,reward,st.rate));
}
function predictNewBrain(st){st.w=[0,0];st.pend=null;st.runKey=null;st.run=0;st.runStart=[0,0];st.hist=[];st.flags.lastExp=null;}
// Anı yaşanmış say: bağları güncelle, kaydı tut, görev bayraklarını koy
function predictCommit(st,r){
  const f=st.flags,k=pKey(r.x)+r.r;
  if(st.runKey!==k){st.runKey=k;st.run=0;st.runStart=r.w0.slice();}
  st.run++;st.n=(st.n||0)+1;st.w=r.w.slice();
  st.hist=(st.hist||[]).concat([{x:r.x,V:r.V,r:r.r,d:r.d}]).slice(-60);
  const pos=NN.weightedSum([1,0],st.w);
  if(k==='101'&&pos>=0.9-1e-9)f.learned=true;
  if(r.x[0]&&!r.r&&r.d<=-0.5)f.miss=true;
  if(f.miss&&k==='100'&&pos<0.2)f.extinct=true;
  const h20=st.hist.slice(-20);
  if(h20.length===20&&h20.every(e=>pKey(e.x)==='10')){const g=h20.filter(e=>e.r).length;if(g>=6&&g<=14)f.half=true;}
  if(k==='111'&&st.run>=8){
    if(st.runStart[0]>=0.85&&st.runStart[1]<=0.1){f.blocked=true;f.blockBell=st.w[1];f.lastExp='block';}
    if(st.runStart[0]<=0.1&&st.runStart[1]<=0.1){f.control=true;f.controlBell=st.w[1];f.lastExp='control';}
  }
  return r;
}

/* ---------- Seviye 9: yavru Pamuk’un gözü (rekabetçi öğrenme + kritik dönem) ---------- */
const EYE={n:6,rate:0.6,age:24,see:0.75,sharp:0.9,
  lines:[
    {x:[1,1,1,0,0,0,0,0,0],o:0,short:'üst'},{x:[0,0,0,1,1,1,0,0,0],o:0,short:'orta'},{x:[0,0,0,0,0,0,1,1,1],o:0,short:'alt'},
    {x:[1,0,0,1,0,0,1,0,0],o:1,short:'sol'},{x:[0,1,0,0,1,0,0,1,0],o:1,short:'orta'},{x:[0,0,1,0,0,1,0,0,1],o:1,short:'sağ'}],
  words:[{icon:'━',name:'yatay'},{icon:'┃',name:'dikey'}]};
const eyeLineName=li=>`${EYE.words[EYE.lines[li].o].icon} ${EYE.lines[li].short} ${EYE.words[EYE.lines[li].o].name}`;
// En yakın temiz çizgi (kaç noktası farklı)
function eyeNearest(x){
  let best=null;EYE.lines.forEach((l,li)=>{const d=l.x.reduce((s,v,i)=>s+(v!==x[i]?1:0),0);if(!best||d<best.d)best={li,d};});
  return best;
}
// Pamuk bu resme ne der? 'blur': net göremiyor, 'unknown': tanıyor ama adını bilmiyor, 0/1: yatay/dikey
function eyeAnswer(st,x){
  const o=NN.eyeLook(x,st.W),m=o.m[o.k],L=st.L[o.k];
  const ans=m<EYE.see?'blur':Math.max(L[0],L[1])<0.3?'unknown':L[0]>=L[1]?0:1;
  return{k:o.k,m,all:o.m,ans};
}
function eyeTuned(W){
  const ks=EYE.lines.map(l=>NN.eyeLook(l.x,W));
  return new Set(ks.map(o=>o.k)).size===EYE.lines.length&&ks.every(o=>o.m[o.k]>=EYE.sharp);
}
function eyeNamedAll(st){return EYE.lines.every(l=>eyeAnswer(st,l.x).ans===l.o);}
function eyeShow(st,x){
  if(!x.some(v=>v))return null;
  const a=eyeAnswer(st,x),young=st.age<EYE.age,w0=st.W[a.k].slice(),near=eyeNearest(x);
  if(young){st.W=st.W.slice();st.W[a.k]=NN.eyeLearn(x,w0,EYE.rate);st.age++;
    const y=Object.assign({h:0,v:0,o:0},st.youth);if(near.d===0)y[EYE.lines[near.li].o?'v':'h']++;else y.o++;st.youth=y;}
  st.n=(st.n||0)+1;st.retina=x.slice();
  const r={x:x.slice(),k:a.k,m:a.m,all:a.all,ans:a.ans,young,w0,w:st.W[a.k].slice(),near,seq:st.n,mAfter:NN.eyeLook(x,st.W).m[a.k]};
  st.last=r;st.hist=(st.hist||[]).concat([{x:r.x,k:r.k,m:r.m,ans:r.ans,n:st.n}]).slice(-30);
  st.flags.first=true;
  if(near.d===1&&a.m>=EYE.see&&a.ans===EYE.lines[near.li].o)st.flags.noisy=true;
  if(!young&&near.d===0&&EYE.lines[near.li].o===0&&a.m<EYE.see&&!(st.youth&&st.youth.h)&&st.youth&&st.youth.v>0)st.flags.blake=true;
  return r;
}
// Son gösterilen resmin adını öğret (kazanan nöron → kelime nöronu bağı)
function eyeName(st,j){
  const r=st.last;if(!r)return{err:'none'};
  const a=eyeAnswer(st,r.x);if(a.m<EYE.see)return{err:'blur',m:a.m};
  const L=st.L.map(l=>l.slice()),l=L[a.k];l[j]=Math.round((l[j]+0.7*(1-l[j]))*1e4)/1e4;l[1-j]=Math.round(l[1-j]*0.3*1e4)/1e4;
  st.L=L;r.named=j;st.names=(st.names||0)+1;return{k:a.k,j};
}
function eyeNewKitten(st){
  st.seed=(st.seed||1)+1;st.W=NN.eyeInit(st.seed,EYE.n);st.L=Array.from({length:EYE.n},()=>[0,0]);
  st.age=0;st.youth={h:0,v:0,o:0};st.last=null;st.hist=[];st.retina=[0,0,0,0,0,0,0,0,0];
}
// Yavruluk bitene kadar karışık sırayla çizgi göster: 'all' her çizgiden, 'v' sadece dikey
function eyeGrow(st,world){
  const pool=EYE.lines.map((l,i)=>i).filter(i=>world==='v'?EYE.lines[i].o===1:true),r=NN.rng(st.seed*97+st.age);let last=null;
  while(st.age<EYE.age){const ord=pool.slice().sort(()=>r()-0.5);for(const i of ord){if(st.age>=EYE.age)break;last=eyeShow(st,EYE.lines[i].x);}}
  return last;
}

/* ---------- Seviye 11: birlikte yanan, birlikte bağlanır (Ela, limon ve çilek) ---------- */
const HEBB={rate:0.25,thr:0.6,who:'Ela',
  feats:[{icon:'🟡',name:'sarı renk'},{icon:'😖',name:'ekşi tat'},{icon:'👃',name:'keskin koku'},{icon:'✋',name:'pürüzlü kabuk'},
         {icon:'🔴',name:'kırmızı renk'},{icon:'😋',name:'tatlı tat'},{icon:'🌸',name:'tatlı koku'},{icon:'🧸',name:'yumuşak'}],
  things:{lim:{icon:'🍋',name:'limon',x:[1,1,1,1,0,0,0,0]},cil:{icon:'🍓',name:'çilek',x:[0,0,0,0,1,1,1,1]},mix:{icon:'🍋🍓',name:'çilekli limonata',x:[1,1,1,1,1,1,1,1]}}};
const hZero=()=>Array.from({length:8},()=>Array(8).fill(0));
const hKey=a=>a.join('');
// Bir grubun içindeki bütün bağların en zayıfı / iki grup arasındaki en zayıf bağ
function hebbMinIn(W,x){let m=1;x.forEach((a,i)=>x.forEach((b,j)=>{if(a&&b&&i!==j)m=Math.min(m,W[i][j]);}));return m;}
function hebbMinCross(W,x,y){let m=1;x.forEach((a,i)=>y.forEach((b,j)=>{if(a&&b&&i!==j)m=Math.min(m,W[i][j]);}));return m;}
function hebbLive(st,x){
  if(!x.some(v=>v))return null;
  const W0=st.W;st.W=NN.hebbLearn(x,st.W,HEBB.rate);st.n=(st.n||0)+1;
  const r={type:'live',x:x.slice(),W0,W:st.W,seq:st.n};st.last=r;
  st.hist=(st.hist||[]).concat([{type:'live',x:x.slice(),n:st.n}]).slice(-30);
  return r;
}
function hebbCue(st,cue){
  if(!cue.some(v=>v))return null;
  const steps=NN.hebbRecall(cue,st.W,HEBB.thr),fin=steps[steps.length-1];st.n=(st.n||0)+1;
  const r={type:'recall',cue:cue.slice(),steps,fin,seq:st.n};st.last=r;
  st.hist=(st.hist||[]).concat([{type:'recall',x:cue.slice(),fin,n:st.n}]).slice(-30);
  const T=HEBB.things,cnt=cue.filter(v=>v).length,inL=cue.filter((v,i)=>v&&T.lim.x[i]).length,inC=cue.filter((v,i)=>v&&T.cil.x[i]).length;
  if(cnt===1&&inL===1&&hKey(fin)===hKey(T.lim.x))st.flags.complete=true;
  if(cnt===1&&inC===1&&hKey(fin)===hKey(T.cil.x)&&hebbMinIn(st.W,T.lim.x)>=0.99)st.flags.two=true;
  if(inL>=2&&inC>=1&&hKey(fin)===hKey(T.lim.x))st.flags.clean=true;
  if(cnt===1&&fin.every(v=>v))st.flags.mix=true;
  return r;
}
function hebbNewBaby(st){st.W=hZero();st.last=null;st.hist=[];st.sel=[0,0,0,0,0,0,0,0];}

/* ---------- Seviye 10: beş duyu, tek kavram (eğitilmiş, çok duyulu tanıma) ---------- */
const SENSES={beta:6,tasteW:0.7,
  things:[
    {icon:'🍋',name:'limon',word:'LİMON',cat:0,vis:[0,4,7],smell:0,taste:[0,1,0,0,0]},
    {icon:'🍓',name:'çilek',word:'ÇİLEK',cat:0,vis:[1,6,7],smell:1,taste:[1,0.5,0,0,0]},
    {icon:'🍌',name:'muz',word:'MUZ',cat:0,vis:[0,5],taste:[1,0,0,0,0]},
    {icon:'🍎',name:'elma',word:'ELMA',cat:0,vis:[1,4,6],taste:[1,0.3,0,0,0]},
    {icon:'🐈',name:'kedi',word:'KEDİ',cat:1,vis:[8,9,10],sound:0},
    {icon:'🐕',name:'köpek',word:'KÖPEK',cat:1,vis:[2,8,9],sound:1},
    {icon:'🐟',name:'balık',word:'BALIK',cat:1,vis:[5,11],smell:4,taste:[0,0,0.8,0,1]},
    {icon:'☕',name:'kahve',word:'KAHVE',cat:2,vis:[2,4,12],smell:2,taste:[0,0,0,1,0]},
    {icon:'🧼',name:'sabun',word:'SABUN',cat:2,vis:[3,12],smell:3,taste:[0,0,0,1,0]},
    {icon:'⏰',name:'çalar saat',word:'SAAT',cat:2,vis:[1,4,12],sound:2}],
  cats:[{icon:'🍎',name:'meyve'},{icon:'🐾',name:'hayvan'},{icon:'🧰',name:'nesne'}],
  vis:['sarı','kırmızı','kahverengi','beyaz','yuvarlak','uzun','yaprak, sap','benekli, pürüzlü','tüylü','dört bacak','sivri kulak, bıyık','pul, yüzgeç','yapılmış eşya'],
  letters:'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split(''),
  smells:[{icon:'🍋',name:'limon kokusu',r:[1,1,0,1,0,0]},{icon:'🍓',name:'çilek kokusu',r:[0,1,1,0,0,1]},{icon:'☕',name:'kahve kokusu',r:[0,0,1,0,1,1]},
          {icon:'🧼',name:'sabun kokusu',r:[1,0,0,1,0,1]},{icon:'🐟',name:'balık kokusu',r:[0,0,0,1,1,0]}],
  sounds:[{icon:'🐈',name:'miyav',b:[0,0.3,1,0.8,0.3,0]},{icon:'🐕',name:'hav hav',b:[0.6,1,0.5,0,0,0]},{icon:'⏰',name:'zırrr',b:[0,0,0,0.3,1,0.9]}],
  tastes:[{icon:'😋',name:'tatlı'},{icon:'😖',name:'ekşi'},{icon:'🧂',name:'tuzlu'},{icon:'😣',name:'acı'},{icon:'🍖',name:'umami'}],
  bands:['en pes','pes','orta','tiz','daha tiz','en tiz']};
function sCos(a,b){let s=0,na=0,nb=0;for(let i=0;i<a.length;i++){s+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return na&&nb?s/Math.sqrt(na*nb):0;}
const sRec=r=>Math.round(Math.min(1,Math.max(0,(r-0.55)/0.45))*1000)/1000;
const sWordNorm=w=>String(w||'').toLocaleUpperCase('tr-TR').replace(/[^A-ZÇĞIİÖŞÜ]/g,'');
function sLetters(w){const c=SENSES.letters.map(()=>0);for(const ch of sWordNorm(w)){const i=SENSES.letters.indexOf(ch);if(i>=0)c[i]++;}return c;}
function sVis(k){const v=SENSES.vis.map(()=>0);if(k!=null)SENSES.things[k].vis.forEach(i=>v[i]=1);return v;}
// Bütün akış: duyu nöronları → duyu alanları → kavram → çıktı
function sensesRun(st){
  const T=SENSES.things,inp={vis:sVis(st.card),let:sLetters(st.word),smell:st.smell!=null?SENSES.smells[st.smell].r.slice():[0,0,0,0,0,0],
    sound:st.sound!=null?SENSES.sounds[st.sound].b.slice():[0,0,0,0,0,0],taste:(st.taste||[0,0,0,0,0]).slice()};
  const rec={vis:T.map(t=>sRec(sCos(inp.vis,sVis(T.indexOf(t))))),word:T.map(t=>sRec(sCos(inp.let,sLetters(t.word)))),
    smell:SENSES.smells.map(s=>sRec(sCos(inp.smell,s.r))),sound:SENSES.sounds.map(s=>sRec(sCos(inp.sound,s.b)))};
  const parts=T.map((t,k)=>({vis:rec.vis[k],word:rec.word[k],smell:t.smell!=null?rec.smell[t.smell]:0,sound:t.sound!=null?rec.sound[t.sound]:0,
    taste:t.taste?Math.round(SENSES.tasteW*sCos(inp.taste,t.taste)*1000)/1000:0}));
  const c=parts.map(p=>Math.round((p.vis+p.word+p.smell+p.sound+p.taste)*1000)/1000);
  const mx=Math.max(...c),e=c.map(v=>Math.exp(SENSES.beta*(v-mx))),z=e.reduce((a,b)=>a+b,0),p=e.map(v=>v/z);
  const order=p.map((v,k)=>k).sort((a,b)=>p[b]-p[a]),cat=SENSES.cats.map((x,j)=>T.reduce((s,t,k)=>s+(t.cat===j?p[k]:0),0));
  const given={vis:st.card!=null,word:!!sWordNorm(st.word),smell:st.smell!=null,sound:st.sound!=null,taste:inp.taste.some(v=>v)};
  return{inp,rec,parts,c,p,order,top:order[0],cat,unknown:mx<0.25,given,nGiven:Object.values(given).filter(v=>v).length};
}
// Her girdi değişikliğinden sonra: sonucu kaydet, görevleri işaretle
function sensesCommit(st){
  const r=sensesRun(st),g=r.given,T=SENSES.things,top=r.top,pt=r.p[top],only=k=>g[k]&&r.nGiven===1;
  if(!r.nGiven){st.last=null;return r;}
  st.n=(st.n||0)+1;
  st.hist=(st.hist||[]).concat([{n:st.n,card:st.card,word:sWordNorm(st.word),smell:st.smell,sound:st.sound,taste:(st.taste||[]).slice(),top,pt,unknown:r.unknown}]).slice(-30);
  if(!r.unknown){
    if(only('vis')&&top===st.card&&pt>=0.9)st.flags.card=true;
    if(g.word&&T[top].word===sWordNorm(st.word)&&pt>=0.9)st.flags.word=true;
    if(only('sound')&&T[top].sound===st.sound&&pt>=0.9)st.flags.sound=true;
    if(only('taste')&&pt<0.6)st.flags.ambig=true;
    if(g.taste&&g.smell&&r.nGiven===2&&pt>=0.9&&T[top].smell===st.smell)st.flags.combine=true;
    if(only('word')&&!T.some(t=>t.word===sWordNorm(st.word))&&pt>=0.5)st.flags.typo=true;
  }
  return r;
}
function sensesClear(st){st.card=null;st.word='';st.taste=[0,0,0,0,0];st.smell=null;st.sound=null;st.last=null;}

const PARTS=[
  {id:'A',title:'Algı',sub:'tek bir nöron'},
  {id:'B',title:'Öğrenme',sub:'hatadan düzeltme'},
  {id:'C',title:'Anlama',sub:'birden çok nöron'},
  {id:'D',title:'Hafıza',sub:'bilgi nerede saklanır'},
  {id:'E',title:'Anlam',sub:'kelimeler ve okuma'}
];

const sameW=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<1e-6);

const LEVELS=[
/* ------------------------------ 1 ------------------------------ */
{
  key:'light',goal:"Bir nöronun girdiyi nasıl bir karara (ateşle ya da sus) çevirdiğini görmek.",
  todo:["Işık hücresine tıklayıp ışığı aç.", "Kaydırıcılarla parlaklığı, bağlantıyı ve eşiği değiştir; nöronun ne zaman ateşlediğini izle.", "Sağdaki görevleri sırayla yap. Her görevin açıklaması, görevi tamamlayınca açılır."],
  part:'A',title:'Tek bir ışık hücresi',
  question:'Gözündeki tek bir hücre ışığı nasıl fark eder ve beyne “ışık var” der?',
  kind:'single',
  ranges:{b:[0,1,0.05],w:[0,2,0.1],theta:[0.1,2,0.1]},
  init(){return{b:0,bLast:1,w:[1],theta:0.5};},
  missions:[
    {id:'on',text:'Işık açıkken nöronun ateşlediğini gör. Işık hücresine tıklayarak aç-kapat.',
      check:st=>st.b>0&&NN.fires([st.b],st.w,st.theta),
      aha:'Işık hücresinden gelen sinyal bağlantı üzerinden nörona ulaştı, toplam eşiği geçti ve nöron ateşledi. Ateşleme, beyne giden tek mesaj: “burada ışık var”.'},
    {id:'dim',text:'Parlaklığı yavaş yavaş kıs. Işık hâlâ varken nöron hangi noktada susuyor?',
      check:st=>st.b>0&&!NN.fires([st.b],st.w,st.theta),
      aha:'Toplam (parlaklık × bağlantı) eşiğin altına indiği anda nöron tamamen sustu. Arada “yarım ateşleme” yok: ya hep ya hiç. Sınır parlaklık = eşik ÷ bağlantı. Işık hâlâ var ama bu hücre onu “görmüyor”.'},
    {id:'bright',text:'Nöron sadece çok parlak ışıkta ateşlesin: 0,8 parlaklıkta ateşlesin, 0,7’de sussun.',
      check:st=>NN.fires([0.8],st.w,st.theta)&&!NN.fires([0.7],st.w,st.theta),
      aha:'Bunu ya eşiği yükselterek ya da bağlantıyı zayıflatarak yaptın; ikisi de aynı sonucu verir, çünkü önemli olan oran. Bir hücrenin ne kadar “duyarlı” olduğunu bu iki sayı belirliyor.'},
    {id:'cut',text:'Bağlantıyı 0’a indir. Işık ne kadar parlak olursa olsun ne oluyor?',
      check:st=>Math.abs(st.w[0])<1e-9&&st.theta>0,
      aha:'Işık hücresi hâlâ ışığı alıyor ama haber veremiyor: bağlantı yoksa sinyal de yok. Bilgi hücrelerin kendisinde değil, aralarındaki bağlantılarda taşınıyor. Bu fikir hafıza bölümünde geri dönecek.'}
  ],
  cards:{
    brain:'Gözünün arkasındaki retinada ışığa duyarlı hücreler (çubuk ve koni hücreleri) ışığı elektrik sinyaline çevirir. Sinyal ara hücrelerden geçip retina gangliyon hücrelerine ulaşır. Gelen sinyal yeterince güçlüyse gangliyon hücresi kısa bir elektrik darbesi (aksiyon potansiyeli) üretir; darbe görme sinirinden beyne gider. Darbe her seferinde aynı büyüklüktedir: ya hep ya hiç.',
    model:'Kare ışık hücresi, çizgi bağlantı (sinaps), daire nöron. Nöron “parlaklık × bağlantı” hesabını yapar; sonuç eşiği geçerse ateşler. Kaydırıcılarla değiştirdiğin iki sayı, bağlantı ve eşik, bu hücrenin bütün “kişiliği”.',
    limit:'Gerçek nöron tek bir darbe değil, saniyede onlarca darbe gönderir; ışık güçlendikçe darbeler sıklaşır. Yani “ne kadar” bilgisini darbelerin sıklığı taşır. Ayrıca ışık hücreleri kendileri darbe üretmez, sinyali kademeli iletir; arada birkaç hücre katmanı daha vardır. Model bu ayrıntıları bilerek atlıyor.',
    ai:'Yapay sinir ağlarının temel parçası tam olarak bu hesap: girdiyi ağırlıkla çarp, eşikle karşılaştır. Fikir 1943’te McCulloch ve Pitts’e dayanır. Bugünkü dev modellerde bu hesaptan milyarlarca var.'
  },
  deeper:`<p>Nöronun hesabı tek satır: <b>toplam = parlaklık × bağlantı</b>. Ateşleme koşulu: <b>toplam ≥ eşik</b>.</p>
    <p>Buradan sınır parlaklık çıkar: <b>parlaklık ≥ eşik ÷ bağlantı</b>. Bağlantıyı iki katına çıkarmak, eşiği yarıya indirmekle aynı etkiyi yapar.</p>
    <p><b>Neden ya hep ya hiç?</b> Gerçek nöronda zar gerilimi eşiği geçince kendini besleyen bir süreç başlar: sodyum kanalları açılır, içeri giren sodyum gerilimi daha da yükseltir, bu da daha çok kanal açar. Süreç bir kez başlayınca sonuna kadar gider; darbe bu yüzden hep aynı büyüklüktedir.</p>`
},
/* ------------------------------ 2 ------------------------------ */
{
  key:'pair',goal:"Bir nöronun birden çok sinyali toplayarak nasıl tek bir karar verdiğini görmek.",
  todo:["Işıklara ya da tablodaki satırlara tıklayarak dört durumu dene.", "Kaydırıcılarla bağlantıları ve eşiği ayarla; tablodaki dört satırın hepsini tutturmaya çalış.", "Karar haritasında boyalı bölgenin nasıl değiştiğine bak."],
  part:'A',title:'İki ışık, bir karar',
  question:'Bir nöron birden fazla sinyali nasıl birleştirip tek bir karar verir?',
  kind:'pair',
  ranges:{w:[0,2,0.1],theta:[0.1,3,0.1]},
  init(){return{x:[1,0],w:[0.3,0.3],theta:1,targetKey:'and'};},
  missions:[
    {id:'and',target:'and',text:'Nöron sadece <b>ikisi de yanınca</b> ateşlesin (VE). Tablodaki dört satırın hepsi tutmalı.',
      check:st=>NN.solves(st.w,st.theta,NN.GATES.and.target),
      aha:'Tek başına gelen sinyal eşiğe yetmiyor, ikisi toplanınca yetiyor. Nöronun “karar vermesi” aslında bu: gelen sinyallerin toplamı eşiği geçiyor mu?'},
    {id:'or',target:'or',text:'Şimdi <b>biri yanınca yetsin</b> (VEYA).',
      check:st=>NN.solves(st.w,st.theta,NN.GATES.or.target),
      aha:'Şimdi her bağlantı tek başına eşiği aşacak kadar güçlü. Aynı iki ışık, aynı nöron; değişen sadece sayılar.'},
    {id:'switch',target:'or',text:'VE’yi çözdüğün bağlantılara dokunmadan, <b>sadece eşiği</b> değiştirerek VEYA’ya geç.',
      check:st=>!!st.flags.andW&&NN.solves(st.w,st.theta,NN.GATES.or.target)&&sameW(st.w,st.flags.andW),
      aha:'Aynı bağlantılar, farklı eşik, bambaşka davranış. Beyinde de bir nöronun ne kadar kolay ateşlediği dikkat, yorgunluk ya da kimyasal habercilerle değişebilir; aynı devre farklı durumlarda farklı çalışabilir.'}
  ],
  cards:{
    brain:'Korteksteki tipik bir nöron binlerce sinapstan sinyal alır. Sinyaller nöronun dallarında (dendritlerde) birikir; toplam, hücre gövdesindeki eşiği aşarsa nöron ateşler. Tek bir zayıf sinyal çoğu zaman yetmez; birçoğunun aynı anda gelmesi gerekir.',
    model:'İki ışık hücresi (A ve B) tek bir nörona bağlı. Nöron iki sinyali toplar ve eşikle karşılaştırır. Tablodaki dört satır, iki ışığın bütün olası durumları. Karar haritası aynı şeyin resmi: boyalı bölge, nöronun ateşlediği durumlar.',
    limit:'Gerçek dendritler basit bir toplama makinesi değil: sinyalin dalın neresine geldiği, ne zaman geldiği ve dalın kendi elektriksel özellikleri sonucu değiştirir. Bu modelde bütün sinyaller anında ve eşit şekilde toplanıyor.',
    ai:'Bilgisayarların temelindeki mantık kapıları (VE, VEYA) böyle eşik birimleriyle kurulabilir. McCulloch ve Pitts 1943’te bunu gösterdi: yeterince eşik nöronuyla her mantık hesabı yapılabilir.'
  },
  deeper:`<p>İki girdiyle hesap: <b>toplam = A × bağlantı<sub>A</sub> + B × bağlantı<sub>B</sub></b>.</p>
    <p>Karar haritasında “toplam = eşik” olan noktalar <b>düz bir çizgi</b> oluşturur. Çizginin bir yanında nöron ateşler, öbür yanında susar. Bağlantılar çizginin eğimini, eşik ise konumunu belirler.</p>
    <p><b>VE için</b> her bağlantı tek başına eşiğin altında, toplamları eşiğin üstünde olmalı. <b>VEYA için</b> her bağlantı tek başına eşiğe ulaşmalı.</p>`
},
/* ------------------------------ 3 ------------------------------ */
{
  key:'inhibit',goal:"Bir sinyalin nöronu susturabildiğini ve bir hücrenin bir şeyin yokluğunu bile fark edebildiğini görmek.",
  todo:["Bir bağlantıyı sıfırın altına indir: pembe çizgi susturan bağlantı demek.", "Görevlerdeki üç davranışı kur.", "Karar haritasında çizginin yönünün nasıl döndüğüne bak."],
  part:'A',title:'Susturan bağlantı',
  question:'Bir sinyal nöronu ateşlemek yerine susturabilir mi? “Yokluğu” fark eden bir hücre olur mu?',
  kind:'pair',
  ranges:{w:[-2,2,0.1],theta:[-2,2,0.1]},
  init(){return{x:[1,1],w:[0.6,0.6],theta:1,targetKey:'aNotB'};},
  missions:[
    {id:'aNotB',target:'aNotB',text:'<b>A yansın, B yanmasın</b>: nöron sadece A yanık ve B sönükken ateşlesin. Bağlantılar artık negatif olabilir.',
      check:st=>NN.solves(st.w,st.theta,NN.GATES.aNotB.target),
      aha:'B’nin bağlantısı negatif: B yanınca toplamı düşürüyor ve nöronu susturuyor. Buna baskılayıcı (ketleyici) bağlantı denir. Pembe çizgi bunu gösteriyor.'},
    {id:'spont',target:null,text:'Eşiği sıfırın altına indir. Hiçbir ışık yokken ne oluyor?',
      check:st=>st.theta<-1e-9,
      aha:'Toplam sıfır olduğu hâlde eşiği aşıyor: nöron kendiliğinden ateşliyor. Gerçek nöronların çoğu da hiç uyarı yokken belli bir hızda ateşler; sinyal, bu temel ritmin artması ya da azalmasıyla da taşınabilir.'},
    {id:'nor',target:'nor',text:'<b>Karanlık dedektörü</b> kur: nöron sadece hiçbir ışık yanmıyorken ateşlesin.',
      check:st=>NN.solves(st.w,st.theta,NN.GATES.nor.target),
      aha:'Retinada gerçekten böyle hücreler var: “OFF” hücreleri ışık azalınca daha çok ateşler. Kendiliğinden ateşleme ve susturan bağlantılar birlikte, bir şeyin yokluğunu fark eden bir hücre kuruyor.'}
  ],
  cards:{
    brain:'Beyindeki sinapsların bir kısmı uyarır, bir kısmı susturur. Susturan (ketleyici) nöronlar çoğunlukla GABA adlı kimyasal haberciyi kullanır ve korteksteki nöronların kabaca beşte birini oluşturur. Retinada bazı hücreler ışık artınca (ON), bazıları ışık azalınca (OFF) daha çok ateşler. Hiç uyarı yokken de belli bir hızda ateşleyen nöronlar çoktur.',
    model:'Bağlantı artık negatif olabilir: pembe çizgi, yanan ışığın toplamı düşürmesi demek. Eşik sıfırın altına inince nöron hiçbir ışık yokken de ateşler. İkisi birlikte “yokluğu” fark eden bir hücre kurar.',
    limit:'Beyinde bir nöron genellikle ya uyarıcıdır ya ketleyici; gönderdiği bütün sinyaller aynı türdendir (Dale ilkesi; istisnaları var). Buradaki yapay nöronun bir bağlantısı uyarıcı, öbürü susturucu olabiliyor. Beyinde aynı etki için araya ayrı bir ketleyici nöron girer.',
    ai:'Yapay ağlarda negatif ağırlık sıradan bir şeydir; bir ağırlığın işareti öğrenme sırasında değişebilir. Eşiğin karşılığına yapay zekâ kaynaklarında “yanlılık” (bias) denir.'
  },
  deeper:`<p>Negatif bağlantı, karar çizgisinin eğimini ters çevirir: o ışık yandıkça nöron ateşlemekten uzaklaşır.</p>
    <p><b>Karanlık dedektörü</b> için üç koşul gerekir: hiçbir ışık yokken ateşlesin (<b>0 ≥ eşik</b>, yani eşik sıfır ya da negatif), A tek başına ve B tek başına toplamı eşiğin altına çeksin (iki bağlantı da eşikten küçük).</p>
    <p>Yapay zekâ kitaplarında eşik genelde öbür tarafa geçirilir: <b>yanlılık = −eşik</b>, koşul <b>toplam + yanlılık ≥ 0</b> olur. Aynı şeyin başka yazılışı.</p>`
},
/* ------------------------------ 4 ------------------------------ */
{
  key:'learn',ver:2,goal:"Doğru bağlantıların kimse elle ayarlamadan, örnekler ve geri bildirimle nasıl ortaya çıktığını görmek. Öğrenmek, bağlantıların ayarlanmasıdır; hafıza, bu ayarın kalıcı olmasıdır.",
  todo:["Sağdaki tablo öğretmenin elindeki eğitim verisi: 4 kart, her kartta iki özellik ve doğru cevap. İlk durum “Muz olgun mu?”: kabuğu sarı mı (A), dokununca yumuşak mı (B)? Olgun muz ikisi birden.", "“Bir örnek göster”e tekrar tekrar bas. Her basışta öğretmen desteden bir kart gösterir; nöron tahmin eder, yanılırsa bağlantıları biraz düzeltilir. Kartı ve ne değiştiğini öğrenme panelinde görürsün.", "Hatalar bitene kadar devam et. İlerledikçe yeni düğmeler açılacak."],
  part:'B',title:'Öğretmenle öğrenme',
  question:'Kimse bağlantıların kaç olması gerektiğini söylemezse, nöron doğru sayıları kendisi bulabilir mi?',
  kind:'pair',learning:true,
  ranges:{w:[-3,3,0.1],theta:[-3,3,0.1]},
  init(){return{x:[0,0],w:[0,0],theta:0,targetKey:'and',rate:0.2};},
  targets:['and','or','aNotB','nor','custom'],
  missions:[
    {id:'learnAnd',target:'and',text:'Makineye <b>Muz olgun mu?</b> sorusunu öğret. “Bir örnek göster”e basarak her kartta ne değiştiğini izle.',
      check:st=>!!(st.flags.learned&&st.flags.learned.and),
      aha:'Kimse ona bağlantıların kaç olması gerektiğini söylemedi; sadece her örnekte doğru cevabı söyledin. Nöron hatalarından küçük düzeltmeler çıkardı ve bir noktada durdu: artık hata yok, değişiklik de yok.'},
    {id:'zero',text:'Doğru bildiği bir örneği göster. Bağlantılarda ne değişiyor?',
      check:st=>!!st.flags.zeroErr,
      aha:'Hiçbir şey. Hata yoksa öğrenme de yok: bu kural sadece yanıldığında öğrenir. Ayrıca yanılınca bile sadece o kartta var olan (1 olan) özelliklerin bağlantısı değişir; 0 olan özellik o hatada rol oynamadı.'},
    {id:'other',text:'Başka bir durum seç (ör. <b>Kapıya bakmalı mıyım?</b> ya da kendi tablon) ve onu da öğret.',
      check:st=>!!st.flags.learned&&Object.keys(st.flags.learned).some(k=>k!=='and'),
      aha:'Aynı kural, hiç değişmeden, bambaşka bir şey öğrendi: muz olgunluğu ile kapıya bakmak arasında kural açısından hiçbir fark yok, fark sadece eğitim verisinde. Beyinde de öğrenme mekanizması konudan bağımsız; konuyu deneyim belirliyor. Öğrenilen şey bağlantılarda saklanıyor.'},
    {id:'repair',text:'Öğrendikten sonra bir bağlantıyı elle boz. Sonra yeniden öğret: kendini onarabiliyor mu?',
      check:st=>!!st.flags.repaired,
      aha:'Bozduğun yeri hataları sayesinde yeniden buldu. Öğrenen bir sistem hasarı aynı yoldan onarabilir. Beyindeki iyileşmenin, örneğin felçten sonraki rehabilitasyonun, önemli bir kısmı da yeniden öğrenmedir.'},
    {id:'forget',text:'<b>Unutma deneyi:</b> Muz’u öğret, sonra başka bir durumu (ör. Kapı) öğret, sonra “Muz olgun mu?”ya geri dön. Hâlâ biliyor mu?',
      check:st=>!!st.flags.forgot,
      aha:'Unuttu. Bu nöronun bütün bilgisi iki bağlantı ve bir eşikte; yeni durumu öğrenirken aynı sayıların üzerine yazıldı. İki durum en az bir kartta farklı cevap istediği için tek nöron ikisini aynı anda bilemez; kartta “hangi soru soruluyor?” bilgisi de yok. Bu model abartılı: burada muzun “sarı kabuk” bilgisi ile kapının “zil” bilgisi aynı A kablosundan geliyor, beyinde ise bunlar tamamen ayrı nöronlardır. Asıl karışma muz ile armut gibi özellikleri ortak olan şeyler arasında olur (sonraki bölüm). Beynin bununla nasıl başa çıktığı ise “Unutma ve uyku” seviyesinin konusu.'}
  ],
  cards:{
    brain:'Öğrenmenin beyindeki temel izlerinden biri sinapsların güçlenip zayıflamasıdır. Donald Hebb 1949’da birlikte etkin olan nöronlar arasındaki bağlantının güçlendiğini öne sürdü (sonradan “birlikte ateşlenen birlikte bağlanır” diye özetlendi). 1973’te sinapsların tekrarlanan uyarıyla uzun süre güçlendiği gösterildi (uzun süreli güçlenme). Beyin hatadan da öğrenir: beyincik hareket hatalarından, dopamin nöronları ise “beklenenden iyi ya da kötü” sinyallerinden öğrenmeye katkıda bulunuyor gibi görünüyor.',
    model:'Her kartta üç şey olur: nöron tahmin eder; tahmin doğru cevapla karşılaştırılır; fark varsa o kartta var olan özelliklerin bağlantıları ve eşik küçük bir adım düzeltilir. Buna algılayıcı (perceptron) kuralı denir. Çözümü olan bir tablo için bir noktada durmayı garanti eder. Bu seviyede girdiler artık ham ışık değil, “sarı mı?”, “yumuşak mı?” gibi özellikler: beyinde de bir nöronun girdileri çoğu zaman, bu özellikleri daha önceki aşamalarda zaten tespit etmiş başka nöronlardan gelir.',
    limit:'Burada her örnekte bir “öğretmen” doğru cevabı söylüyor. Beyin çoğu zaman böyle hazır etiketler almaz; sık sık kendi öğretmeni olur: bir sonraki anı tahmin eder, sonra dünya ne olduğunu gösterir ve aradaki fark geri bildirim olur. Beynin sinapsları tam olarak bu kuralla değiştirdiği de gösterilmiş değil; bu, “hatadan düzeltme” fikrinin en sade hâli. Gerçek bir kararın da iki değil yüzlerce, binlerce girdisi olur: muzun kokusu, lekeleri, sapı… Burada bilerek tek nöron ve tek çıktı var, kuralı yalın görmek için. Beyinde aynı soruyu birçok nöron birlikte cevaplar, birden çok olası cevap aynı anda yarışır ve karar çoğu zaman “ya hep ya hiç” değil, kanıt biriktikçe güçlenen dereceli bir süreçtir. Birden çok nöron ve çıktı 7. seviyede (Muz ve armut) geliyor.',
    ai:'Tablodaki dört kart, yapay zekâda “etiketli eğitim verisi” diye anılır: her örnek bir girdi ve doğru cevap. Kural 1958’de Frank Rosenblatt’ın algılayıcısıyla ortaya çıktı. Ayrıca eğitimde hiç gösterilmeyen “doğrulama” ya da “sınav” verisiyle modelin ezberleyip ezberlemediği kontrol edilir (“Ezber ve genelleme” seviyesi). Bugünkü bütün yapay sinir ağları aynı fikrin genelleştirilmiş hâliyle eğitilir: tahmin et, hatayı ölç, ağırlıkları hatayı azaltacak yönde biraz değiştir, milyonlarca kez tekrarla.'
  },
  deeper:`<p><b>hata = istenen − çıktı</b>. Üç değer alabilir: <b>+1</b> (sustu ama ateşlemeliydi), <b>−1</b> (boşuna ateşledi), <b>0</b> (doğru).</p>
    <p>Düzeltme: <b>bağlantı += hız × hata × ışık</b> ve <b>eşik −= hız × hata</b>. Işık sönükse (0) çarpım sıfırdır, o bağlantı değişmez.</p>
    <p>Hata +1 ise yanan ışıkların bağlantısı güçlenir ve eşik düşer: nöron bir dahakine daha kolay ateşler. Hata −1 ise tersi olur.</p>
    <p><b>Yakınsama teoremi</b> (Novikoff, 1962): istenen tablo karar haritasında düz bir çizgiyle ayrılabiliyorsa, bu kural sonlu sayıda adımda hatasız bir çözüm bulur ve durur.</p>`
},
/* ------------------------------ 5: tahmin ederek öğrenme ------------------------------ */
{
  key:'predict',ver:2,goal:"Öğretmen olmadan öğrenmeyi görmek: beyin her an bir sonrakini tahmin eder, sonra olanla karşılaştırır. Aradaki fark (sürpriz) kadar öğrenir; sürpriz yoksa öğrenecek bir şey de yoktur.",
  todo:["Sen kedi Pamuk’un sahibisin. Önce bir ses çıkar (🛍️ poşeti hışırdat). Pamuk duyduğu sese göre ne kadar mama beklediğini gösterir: beklediği kadar kabına doğru koşar.","Sonra karar ver: 🐟 mama ver ya da 🚫 verme. Pamuk’un beklediği ile olan arasındaki fark sürprizdir; beynindeki bağ, sürpriz kadar değişir.","Sahnenin alt yarısında Pamuk’un beynini, en altta da an an beklenti ve sürpriz grafiğini izle. Ne yapacağını her an soldaki ipucu ve parlayan düğme söyler."],
  part:'B',title:'Tahmin ederek öğrenme',
  question:'Kimse ona öğretmedi: kedi, mama poşetinin sesini duyunca neden mutfağa koşar? Beyin, doğru cevabı söyleyen bir öğretmen olmadan nasıl öğrenir?',
  kind:'predict',
  init(){return{w:[0,0],rate:PREDICT.rate,pend:null,hist:[],n:0,run:0,runKey:null,runStart:[0,0]};},
  daily:[
    {icon:'📱',title:'Bildirim sesi',text:'Telefonunun bildirim sesini duyunca elin kendiliğinden telefona gider. Kimse öğretmedi: o ses ile ilginç bir mesaj sık sık arka arkaya geldi ve beynin bunu tahmin etmeyi öğrendi. Pamuk’un poşet sesine koşmasıyla aynı şey.'},
    {icon:'🪜',title:'Eksik basamak',text:'Karanlıkta merdiven inerken bir basamak daha var sanıp boşluğa basınca sarsılırsın. Ayağın basamağı bekliyordu; beklenen gelmeyince oluşan bu sarsıntı, eksi sürprizin ta kendisi.'},
    {icon:'🥛',title:'Boş süt kutusu',text:'Dolu sandığın kutuyu kaldırırken kolun havaya fırlar. Beyin ağırlığı önceden tahmin edip kaslarını ona göre hazırlamıştı; tahmin tutmayınca hareket de şaşar.'},
    {icon:'🎵',title:'Yanlış nota',text:'Çok iyi bildiğin bir şarkıda tek bir nota yanlış çalınsa hemen fark edersin. Beynin her notayı önceden bekliyor; uymayan nota bir sürpriz olarak dikkatini çekiyor.'}
  ],
  missions:[
    {id:'learn',text:'<b>🛍️ Poşeti hışırdat</b>, Pamuk’un ne yaptığına bak, sonra <b>🐟 mama ver</b>. Pamuk poşet sesini duyar duymaz kabının başına koşana kadar (beklenti <b>%90</b>) tekrarla.',
      check:st=>!!st.flags.learned,
      aha:'Kimse Pamuk’a “poşet sesi, mama demek” demedi; doğru cevabı bir sonraki an verdi. İlk seferde hiç beklemiyordu, mama gelince sürpriz en büyüktü (+1) ve bağ bir anda 0,3 arttı. Sonra her seferinde sürpriz küçüldü, bağ da daha az arttı. Grafiğe bak: öğrenme başta hızlı, sonra yavaş. Senin telefonunun bildirim sesine uzanman da böyle öğrenildi.'},
    {id:'miss',text:'Eksik basamak: Pamuk artık poşet sesine koşuyor. Bu sefer <b>🛍️ poşeti hışırdat</b> ama <b>🚫 mama verme</b>.',
      check:st=>!!st.flags.miss,
      aha:'Pamuk koştu, kap boş: sürpriz eksi çıktı. Dopamin nöronu o an sustu; normal, sakin atışı bile durdu. Bağ aynı kuralla azaldı. Karanlıkta olmayan basamağa basınca sarsılman da bu: beyin bir şey bekliyordu ve gelmedi. O sarsıntı, beklentinin orada olduğunun kanıtı.'},
    {id:'extinct',text:'Poşeti hışırdatmaya devam et ama mama verme (<b>↻ Son anı 5 kez tekrarla</b> da olur). Pamuk poşet sesine koşmayı bıraksın: beklenti <b>%20’nin altına</b> insin.',
      check:st=>!!st.flags.extinct,
      aha:'Pamuk artık poşet sesine kalkmıyor; buna söndürme denir. Modelde bağ gerçekten küçüldü. Gerçek beyinde ise eski öğrenme silinmez: üstüne “artık mama gelmiyor” diye yeni bir öğrenme eklenir. Bir süre sonra ya da başka bir odada poşet sesi yine Pamuk’u kaldırabilir. Pavlov bunu köpeklerde gördü: söndürülen tepki ertesi gün kendiliğinden geri gelebiliyordu.'},
    {id:'half',text:'Bazen ver, bazen verme: <b>🎲 Yazı-tura × 10</b> düğmesine iki kez bas (ya da elle, arka arkaya 20 kez poşeti hışırdatıp yarısında mama ver). Pamuk ne kadar bekliyor, sürpriz bitiyor mu?',
      check:st=>!!st.flags.half,
      aha:'Pamuk’un beklentisi %50 civarında dolaşıyor ve sürpriz hiç bitmiyor: mama gelince yaklaşık +0,5 sevinç, gelmeyince −0,5 hayal kırıklığı. Pamuk olasılığı öğrendi; beklentisi, ortalama sonuç. Ama tek tek anları bilemediği için sürpriz hiç sıfırlanmıyor. Dopamin nöronlarının ödül en belirsizken (yarı yarıya) en uzun süreli etkinliği gösterdiği bulundu (Fiorillo ve arkadaşları, 2003). Şans oyunlarının ve “belki bir mesaj gelmiştir” diye telefona bakmanın bu kadar çekici olmasının bir nedeninin bu olduğu düşünülüyor.'},
    {id:'block',text:'Engelleme deneyi: <b>🐣 Yeni yavru kedi</b> al. Önce poşet + mama ile öğret (%85 üstü). Sonra <b>🛍️+🗣️ ikisini birden</b> yap ve mama ver (en az 8 kez). En sonda <b>sadece 🗣️ “pisi pisi”</b> de: Pamuk geliyor mu?',
      check:st=>!!(st.flags.blocked&&st.flags.blockProbed),
      aha:'Pamuk “pisi pisi”ye neredeyse hiç kalkmıyor, oysa bu ses 8 kez mamayla birlikte geldi! Poşet sesi mamayı zaten haber veriyordu: sürpriz yoktu, öğrenecek bir şey de kalmadı. Öğrenme “birlikte gelme”yle değil, sürprizle oluyor. Bu, Kamin’in 1969’daki engelleme deneyi; öğrenmenin tahmin hatasıyla olduğunun en güçlü kanıtlarından biri. Evde bir kediyle sen de deneyebilirsin.'},
    {id:'control',text:'Kontrol deneyi: yine <b>🐣 Yeni yavru kedi</b> al ve baştan <b>🛍️+🗣️ ikisini birden</b> yapıp mama ver (en az 8 kez). Sonra <b>sadece 🗣️ “pisi pisi”</b> de. Bu sefer geliyor mu?',
      check:st=>!!(st.flags.control&&st.flags.controlProbed),
      aha:'Bu sefer Pamuk “pisi pisi”ye de yarı yola kadar koşuyor: iki ses sürprizi paylaştı. Aynı sayıda an, aynı mama; tek fark, poşet sesinin önceden bilinmesiydi. Kontrol deneyi, engellemenin gerçekten “zaten biliyordum”dan kaynaklandığını gösteriyor. Beyin yeni bir işarete ancak eski bilgisi yetmediğinde dikkat eder.'}
  ],
  cards:{
    brain:'Beynin orta kısmındaki dopamin nöronları ödülün kendisine değil, sürprize tepki verir (Schultz ve arkadaşları, 1997). Beklenmedik ödülde ani bir atış patlaması olur. Ödül tahmin edilir hâle gelince ödüle değil, onu haber veren işarete (poşet sesine) tepki verirler. Beklenen ödül gelmezse o an susarlar. Pamuk’un mama sesine koşması, Pavlov’un köpeklerinin zil sesiyle salya salgılamasıyla aynı türden bir öğrenme. Beyin bunu sadece ödül için değil, her an her şey için yapar: bebekler bile hecelerin hangi sırayla geldiğini dinleyerek kelimeleri ayırmayı öğrenir (Saffran ve arkadaşları, 1996); kendini gıdıklayamaman da beynin kendi dokunuşunu önceden tahmin etmesinden (Blakemore ve arkadaşları, 1998).',
    model:'Pamuk’un beyninde iki ses nöronu (poşet sesi, “pisi pisi”) bir tahmin nöronuna bağlı. Tahmin nöronu ya hep ya hiç çalışmıyor: ne kadar beklediğini 0 ile 1 arasında söylüyor (beklenti = o an duyulan seslerin bağlarının toplamı). Sürpriz = olan − beklenti. Bağ += 0,3 × sürpriz (sadece o an duyulan sesin bağı). Bu, 4. seviyedeki kuralın neredeyse aynısı; tek fark, doğru cevabı öğretmenin değil, bir an sonranın vermesi.',
    limit:'Bu model (Rescorla ve Wagner, 1972) her anı tek bir an sayıyor; gerçek bir kedi mamanın ne zaman geleceğini de tahmin eder. Söndürme burada bağı siliyor; hayvanlarda ve insanda eski öğrenme silinmez, bastırılır ve geri dönebilir. Gerçek kediyi koşturan sadece tek bir tahmin nöronu değil, binlercesi; dopamin de yalnızca bir sürpriz sinyali değil, harekette ve isteklendirmede de rol oynar.',
    ai:'Öğretmensiz, “bir sonrakini tahmin et” diye öğrenmeye kendi kendine denetimli öğrenme denir: dil modelleri metindeki bir sonraki kelimeyi tahmin ederek eğitilir, doğru cevap metnin kendisindedir. Ödül tahmin hatası ise pekiştirmeli öğrenmede (zamansal fark öğrenmesi) birebir kullanılır; Schultz’un dopamin bulgusu bu algoritmayla örtüştüğü için ünlü oldu.'
  },
  deeper:`<p><b>Beklenti:</b> o an duyulan seslerin bağlarının toplamı. Sadece poşet hışırdadıysa beklenti = poşet bağı; poşet ve “pisi pisi” birlikteyse ikisinin toplamı. Pamuk beklentisi kadar kabına doğru koşar.</p>
    <p><b>Sürpriz:</b> olan − beklenti. Mama verildiyse olan 1, verilmediyse 0.</p>
    <p><b>Öğrenme:</b> o an duyulan her sesin bağı += 0,3 × sürpriz. Duyulmayan sesin bağı değişmez.</p>
    <p><b>Örnek:</b> poşet bağı 0 → 0,3 → 0,51 → 0,66 → 0,76 → 0,83 → 0,88 → 0,92. Her seferinde kalan yolun %30’u kapanıyor; yol kısaldıkça adım da kısalıyor.</p>
    <p><b>Engelleme:</b> poşet 0,92’yi öğrendikten sonra iki ses birlikte gelince sürpriz 1 − 0,92 = 0,08; “pisi pisi”nin payı 0,3 × 0,08 = 0,02. Sekiz an sonra ancak 0,04’e çıkıyor. Kontrolde ikisi boş başlarsa sürprizi eşit paylaşıp ikisi de 0,5’e yaklaşıyor.</p>
    <p><b>4. seviyeyle bağ:</b> orada hata = doğru − tahmin, burada sürpriz = olan − beklenti. Aynı “delta kuralı” (Widrow ve Hoff, 1960); farkı, tahminin ya hep ya hiç değil dereceli olması.</p>`
},
/* ------------------------------ 6: XOR ------------------------------ */
{
  key:'xor',goal:"Tek bir nöronun asla öğrenemeyeceği bir şey olduğunu ve neden birden çok nörona ihtiyaç olduğunu görmek.",
  todo:["Önce elle dene: tablodaki dört satırı tutturmaya çalış.", "Sonra makineye öğret ve tur başına hata sayısını izle.", "“Daha derine”yi açıp nedenini oku."],
  part:'B',title:'Tek nöronun duvarı',
  question:'Tek bir nöronun asla öğrenemeyeceği bir şey var mı?',
  kind:'pair',learning:true,
  ranges:{w:[-3,3,0.1],theta:[-3,3,0.1]},
  init(){return{x:[0,0],w:[0,0],theta:0.5,targetKey:'xor',rate:0.2};},
  targets:['xor'],
  missions:[
    {id:'hand',text:'Elle dene: <b>merdiven lambası</b> iki anahtar farklı konumdayken yansın, aynı konumdayken sönsün (tam olarak biri yukarıdaysa yanar). Dört satırın kaçını tutturabiliyorsun?',
      check:st=>NN.score(st.w,st.theta,NN.GATES.xor.target)>=3,
      aha:'3 satırı tutturdun. Ama dördüncüsü hep bozuluyor: en fazla 3. Bu senin becerinle ilgili değil; tek bir nöron bunu yapamaz.'},
    {id:'rounds',text:'Makineye öğretmeyi dene: “Otomatik”e bas ve en az 15 tur izle. Tur başına hata sayısı sıfıra iniyor mu?',
      check:st=>(st.flags.rounds||0)>=15,
      aha:'Hata sayısı hiç sıfıra inmiyor; karar çizgisi bir o yana bir bu yana gidip geliyor. VE’de birkaç turda duran kural burada sonsuza kadar döner.'},
    {id:'why',text:'Karar haritasına bak ve aşağıdaki “Daha derine”yi aç: neden olmuyor?',
      check:st=>!!st.flags.openedDeeper,
      aha:'Tek nöron haritayı tek bir düz çizgiyle ikiye bölebilir. Bu tabloda ateşlemesi gereken iki köşe çaprazda duruyor; onları öbür ikisinden ayıran düz bir çizgi yok. Çözüm için birden fazla nöronun birlikte çalışması gerekiyor: sıradaki bölümün konusu.'}
  ],
  cards:{
    brain:'Merdiven lambasını düşün: alttaki ya da üstteki anahtarlardan herhangi biri değişince lamba değişir. Bu tam olarak “ya o ya bu” kuralı. Beyin böyle kararları tek hücreyle değil, birbirine bağlı hücre gruplarıyla verir: biri “A var, B yok” durumunu, öbürü “B var, A yok” durumunu yakalar, bir üst hücre ikisini birleştirir.',
    model:'Tek nöron karar haritasını tek bir düz çizgiyle ikiye bölebilir. “Tam olarak biri” tablosunda ateşlemesi gereken köşeler çaprazda; onları öbür ikisinden ayıran düz çizgi yok. Öğrenme kuralı da bu yüzden hiç durmuyor.',
    limit:'2020’de insan korteksinden alınan bazı nöronların dendritlerinin tek başına bu “ya o ya bu” hesabına benzer bir şey yapabildiği gösterildi (Gidon ve arkadaşları). Yani gerçek bir nöron buradaki modelden daha güçlü olabilir: tek bir dendrit dalı bile küçük bir hesap birimi gibi davranabiliyor.',
    ai:'1969’da Minsky ve Papert “Perceptrons” kitabında tek katmanlı algılayıcıların bu tür sınırlarını matematiksel olarak gösterdi. Bu, yapay sinir ağlarına ilginin yıllarca azalmasına katkıda bulundu. Çıkış yolu, nöronları katman katman bağlamak ve aradaki gizli nöronları da eğitebilmekti (geri yayılım, 1986’da yaygınlaştı).'
  },
  deeper:`<p>Tek bir nöronun bu tabloyu yapabilmesi için dört koşulun hepsi aynı anda sağlanmalı:</p>
    <ul>
      <li>A tek başına yanınca ateşlesin: <b>bağlantı<sub>A</sub> ≥ eşik</b></li>
      <li>B tek başına yanınca ateşlesin: <b>bağlantı<sub>B</sub> ≥ eşik</b></li>
      <li>Hiçbiri yanmıyorken sussun: <b>0 &lt; eşik</b></li>
      <li>İkisi birden yanınca sussun: <b>bağlantı<sub>A</sub> + bağlantı<sub>B</sub> &lt; eşik</b></li>
    </ul>
    <p>İlk ikisini toplarsan bağlantıların toplamı en az <b>2 × eşik</b> olur. Eşik pozitif olduğu için 2 × eşik, eşikten büyüktür; yani toplam eşikten büyük çıkar. Bu dördüncü koşulla çelişir. <b>Hiçbir sayı seçimi dört koşulu birden sağlayamaz.</b></p>
    <p>Resimle söylersek: karar haritasında ateşlemesi gereken iki köşe çaprazda, susması gereken iki köşe öbür çaprazda. Tek bir düz çizgi bu iki çaprazı ayıramaz.</p>`
},
/* ------------------------------ 7: muz ve armut ------------------------------ */
{
  key:'fruit',goal:"Birden çok nöronun aynı girdileri nasıl paylaştığını görmek: muzu ve armudu tanıyan nöronlar hangi özellikleri ortak kullanıyor, hangi bağlantılar ayrı?",
  todo:["Soldaki altı nöron özellik nöronu (sarı, yeşil, şekil, yumuşaklık…), sağdaki iki nöron kavram nöronu: 🍌 muz ve 🍐 armut. Her özellik nöronu iki kavram nöronuna da bağlı.","“Bir kart göster”e basarak ikisine birden öğret: her kartta iki nöron da tahmin eder, yanılan düzeltilir. Altı kartın hepsini doğru bilene kadar devam et.","“Ortak mı, farklı mı?” panelinde iki meyveyi karşılaştır; sonra özellik nöronlarına tıklayıp kendi meyveni yaparak dene."],
  part:'C',title:'Muz ve armut: ortak nöronlar',
  question:'Muzu görüp tanıyan nöronlarla armudu görüp tanıyan nöronlar aynı mı, farklı mı?',
  kind:'multi',learning:true,
  features:[
    {icon:'🟡',name:'sarı'},{icon:'🟢',name:'yeşil'},{icon:'🌙',name:'uzun, kavisli'},
    {icon:'💧',name:'damla şekli'},{icon:'⭕',name:'yuvarlak'},{icon:'🧽',name:'yumuşak'}
  ],
  outs:[{icon:'🍌',name:'muz'},{icon:'🍐',name:'armut'}],
  deck:[
    {name:'olgun muz',icon:'🍌',x:[1,0,1,0,0,1],y:[1,0]},
    {name:'ham muz',icon:'🍌',cls:'green',x:[0,1,1,0,0,0],y:[1,0]},
    {name:'olgun armut',icon:'🍐',cls:'ripe',x:[1,0,0,1,0,1],y:[0,1]},
    {name:'ham armut',icon:'🍐',x:[0,1,0,1,0,0],y:[0,1]},
    {name:'limon',icon:'🍋',x:[1,0,0,0,1,0],y:[0,0]},
    {name:'yeşil elma',icon:'🍏',x:[0,1,0,0,1,0],y:[0,0]}
  ],
  init(){return{x:[1,0,1,0,0,1],shown:0,W:[[0,0,0,0,0,0],[0,0,0,0,0,0]],th:[0,0],rate:0.2,cmp:[0,2]};},
  missions:[
    {id:'learn',text:'İki nörona birden öğret: “Bir kart göster”e basarak <b>altı kartın hepsini</b> doğru bilene kadar devam et.',
      check:st=>!!st.flags.learned,
      aha:'Öğrendi. İki kavram nöronu aynı altı özellik nöronunu dinliyor ama her birinin kendi bağlantıları var; bir kartta muz nöronu yanılınca sadece muz nöronunun bağlantıları düzeldi. Bağlantı tablosuna bak: ikisi aynı özelliklere farklı sayılar vermiş.'},
    {id:'compare',text:'“Ortak mı, farklı mı?” panelinde iki kart seç ve karşılaştır (ör. olgun muz ile olgun armut). Hangi özellik nöronları ikisinde de ateşliyor?',
      check:st=>!!st.flags.compared,
      aha:'Olgun muz ile olgun armutta sarı ve yumuşak nöronları ortak, şekil nöronları farklı. Beyinde de böyle: renk, kenar ve doku nöronları bütün nesneler için ortak; bir nesneyi ötekinden ayıran, ortak havuzdaki hangi nöronların birlikte ateşlediği, yani desen.'},
    {id:'shared',text:'Öğrendikten sonra kendi meyveni yap: özellik nöronlarına tıklayarak <b>sadece 🟡 sarı ve 🧽 yumuşak</b> açık kalsın. Beyin buna ne diyor?',
      check:st=>!!st.flags.learned&&st.shown<0&&sameW(st.x,[1,0,0,0,0,1]),
      aha:'Ne muz ne armut diyor. Sarı ve yumuşak iki meyvede de var, limon da sarı: bu özellikler muzu armuttan ayırmaya yaramıyor. Öğrenme kuralı sadece hata olunca değiştiği için, ayırt etmeye yaramayan özelliklerin bağlantıları sıfır civarında kaldı ya da eksiye indi. Beyin de dikkatini ayırt edici özelliklere yöneltmeyi öğrenir.'},
    {id:'mixed',text:'Şimdi <b>🌙 uzun, kavisli</b> ile <b>💧 damla şekli</b>ni birlikte aç: hem muz hem armut şekli. Ne oluyor?',
      check:st=>!!st.flags.learned&&st.shown<0&&st.x[2]===1&&st.x[3]===1,
      aha:'Kafası karıştı. Bağlantı tablosuna bak: muz nöronu uzun şekli lehte (+), damla şeklini aleyhte (−) kanıt saymayı öğrendi; armut nöronu tam tersini. İki şekil birden gelince lehte ve aleyhte kanıtlar birbirini götürüyor. Öğrenen beyin sadece “neye benziyor”u değil, “neye benzemiyor”u da öğreniyor.'}
  ],
  cards:{
    brain:'Görme yolunun ilk aşamaları (renk, kenar, kıvrım) bütün nesneler için ortaktır: aynı hücreler muzun da armudun da rengini ve kenarını algılar. Nesneleri tanıyan alt şakak korteksinde bir nesne, birçok nöronun birlikte ateşleme deseni olarak temsil edilir; muz ve armut desenleri bazı nöronları paylaşır. İnsan beyninde bazı nöronların belirli kavramlara çok seçici tepki verdiği de gösterildi (Quiroga ve arkadaşları, 2005), ama bir kavram yine de birçok hücreye dağılmıştır.',
    model:'Altı özellik nöronu iki kavram nöronuna bağlı. Özellik nöronları ortak: sarı nöronu hem muz hem armut nöronuna sinyal yollar. Bağlantılar ayrı: sarıdan muza giden bağlantı ile armuda giden farklı sayılar olabilir. Her kavram nöronu 4. seviyedeki nöronun aynısı ve aynı kuralla, aynı anda öğrenir.',
    limit:'Burada özellik nöronları hazır veriliyor ve her kavram tek bir nöron. Beyinde özellik dedektörlerinin kendisi de deneyimle şekillenir ve bir kavram binlerce nörona yayılır. Sonraki seviyede aradaki nöronların kendi özelliklerini kendilerinin öğrendiğini göreceğiz.',
    ai:'Görüntü tanıyan yapay ağlar da böyle çalışır: ilk katmanlar bütün nesneler için ortak kenar ve renk dedektörleridir; son katmanda her sınıfın kendi çıktı nöronu vardır ve hepsi aynı özellikleri farklı ağırlıklarla okur. Bir nesnenin katmanlardaki etkinlik deseni onun temsilidir; benzer nesnelerin desenleri birbirine yakındır.'
  },
  deeper:`<p>Her kavram nöronu bağımsız bir algılayıcıdır: bir kartta muz nöronunun hatası sadece muz nöronunun bağlantılarını değiştirir, armut nöronununkilere dokunmaz. Bu yüzden 4. seviyedeki unutma burada olmaz: armudu öğrenmek muzun üzerine yazmaz.</p>
    <p><b>Ne kadar ortak?</b> İki desenin ortaklığını ölçmenin basit bir yolu: ikisinde de ateşleyen nöron sayısı ÷ en az birinde ateşleyen nöron sayısı. Olgun muz ile olgun armut: 2 ÷ 4 = %50.</p>
    <p><b>Ortak özellikler neden zayıf kalıyor?</b> Kural sadece hata olunca değişir. “Sarı” hem muzda hem armutta hem limonda var; muz nöronu sarıya güvenirse limonda ve armutta yanılır. Hatalar sarının bağlantısını eksiye doğru iter ya da sıfırda bırakır. Ayırt edici özellik (şekil) ise her seferinde aynı yöne itilir ve güçlenir.</p>`
},
/* ------------------------------ 8: duvarı aşmak ------------------------------ */
{
  key:'two',goal:"Tek nöronun öğrenemediği merdiven lambasını, nöronları üst üste koyarak çözmek; sonra makinenin aradaki (gizli) nöronların ne yapacağını kendisinin bulmasını izlemek.",
  todo:["Önce “Elle kur” bölümünde: iki ara nöronu ve lamba nöronunu kaydırıcılarla ayarla. 2. ve 3. seviyede öğrendiğin iki şey yetecek.","Sonra “Makine öğrensin”e geç: rastgele bağlantılarla başlayan ağa kartları göster ve lambayı kendisinin öğrenmesini izle.","Öğrendikten sonra “Ara nöronlar ne yakalıyor?” panelinde makinenin çözümünü kendi çözümünle karşılaştır."],
  part:'C',title:'Duvarı aşmak: gizli nöronlar',
  question:'Tek nöronun asla öğrenemediği merdiven lambası, birkaç nöron üst üste konunca çözülebilir mi? Peki makine bunu kendisi bulabilir mi?',
  kind:'net',
  init(){return{mode:'manual',x:[1,0],man:{W:[[0,0],[0,0]],th:[0.5,0.5],V:[0,0],thO:0.5},lrn:null,seed:7,fromZero:false,zeroRounds:0,rate:2};},
  missions:[
    {id:'g1',text:'Elle kur: <b>Ara nöron 1</b> sadece <b>alt anahtar yukarı, üst aşağı</b>yken ateşlesin. (İpucu: 3. seviyedeki susturan bağlantı.)',
      check:st=>NN.netPattern(st.man,false,0)==='0100',
      aha:'Ara nöron 1 artık bir dedektör: “alt yukarı, üst aşağı” durumunu yakalıyor. Bunu 3. seviyede tek başına yapmıştın; şimdi bu nöron daha büyük bir ağın parçası.'},
    {id:'g2',text:'<b>Ara nöron 2</b> de tersini yakalasın: sadece <b>üst yukarı, alt aşağı</b>yken ateşlesin.',
      check:st=>NN.netPattern(st.man,false,1)==='0010',
      aha:'İki ara nöron, problemi iki kolay parçaya böldü. Her biri tek başına düz bir çizgiyle çözülebilen bir şey yakalıyor.'},
    {id:'wall',text:'Şimdi <b>lamba nöronunu</b> bağla: ara nöronlardan <b>biri</b> ateşlerse yansın. Dört durumun dördü de doğru mu?',
      check:st=>NN.netSolves(st.man,false,NN.GATES.xor.target),
      aha:'Duvar aşıldı! Tek nöronun asla yapamadığını üç nöron birlikte yaptı: iki ara nöron birer parça yakalıyor, lamba nöronu onları VEYA ile birleştiriyor. Karar haritasına bak: artık tek bir çizgi değil, iki çizgi var; lambanın yandığı bölge, tek bir düz çizginin asla çizemeyeceği bir şekil aldı (senin çözümünde iki ayrı köşe parçası). Beyin de karmaşık kararları basit parçaları katman katman birleştirerek verir.'},
    {id:'learn',text:'<b>“Makine öğrensin”</b>e geç ve öğret: rastgele bağlantılarla başlayan ağ, lambayı kendisi öğrenebilir mi?',
      check:st=>!!st.flags.learned,
      aha:'Öğrendi. Kimse ara nöronlara ne yakalamaları gerektiğini söylemedi; sadece lambanın doğru cevabı biliniyordu. Lamba her yanıldığında hata, ara nöronlara bağlantıları oranında paylaştırıldı ve her biri kendi payına göre düzeltildi. Buna geri yayılım denir; bugünkü bütün yapay zekâ ağları böyle eğitilir.'},
    {id:'compare',text:'Öğrendikten sonra <b>“Ara nöronlar ne yakalıyor?”</b> panelinde <b>“Benim çözümümle karşılaştır”</b>a bas. Makine senin yolunu mu buldu?',
      check:st=>!!st.flags.learned&&!!st.flags.compared,
      aha:'Makine bazen senin çözümünü (biri “sadece alt”, biri “sadece üst”), çoğu zaman başka bir yolu buluyor: örneğin biri “ikisi de aşağı”, öbürü “ikisi birden yukarı değil” olur ve lamba “ikisi birden değil ama hiçbiri de değil” der. Doğru cevaba giden tek bir yol yok. Beyinde de aynı beceriyi iki kişi farklı iç temsillerle öğrenebilir; ara nöronların ne yakaladığını dışarıdan görmek zordur.'},
    {id:'zero',text:'Deney: <b>“Tamamen sıfırla”</b> ile bütün bağlantıları 0 yapıp en az 200 tur öğret. Ne oluyor?',
      check:st=>!!st.flags.symmetry,
      aha:'Hiç öğrenemiyor. Bütün bağlantılar aynı başlayınca iki ara nöron her kartta birebir aynı payı alıyor ve sonsuza kadar ikiz kalıyor: ağ, aslında tek bir ara nöronu olan bir ağ gibi çalışıyor ve duvara takılıyor. Bu yüzden hem yapay ağlar hem beyin farklı, düzensiz bağlantılarla başlar; bu çeşitlilik, nöronların farklı şeyler öğrenebilmesinin ön koşulu (simetriyi kırmak).'}
  ],
  cards:{
    brain:'Beyin bilgiyi katman katman işler: görme yolunda ilk aşamalar kenar ve renk gibi basit parçaları, sonraki aşamalar bu parçaların birleşimlerini yakalar. Aradaki nöronlar ne doğrudan bir duyuya ne de doğrudan bir harekete bağlıdır; ne yakaladıkları deneyimle şekillenir. Bir hata yapıldığında beynin bu ara bağlantılardan hangisini ne kadar düzelteceğini nasıl bildiği (“suç paylaştırma sorunu”) nörobilimin hâlâ açık sorularından biri.',
    model:'İki ara (gizli) nöron A ve B anahtarlarını dinliyor, lamba nöronu da iki ara nöronu. “Elle kur”da nöronlar ya hep ya hiç çalışıyor. “Makine öğrensin”de yumuşak eşiğe geçiliyor: nöron ne kadar güçlü ateşlediğini 0 ile 1 arasında söylüyor; böylece “eşiğe ne kadar yakındı?” bilgisi var ve lambanın hatası ara nöronlara pay edilebiliyor.',
    limit:'Geri yayılım, hatanın aynı bağlantılardan geriye doğru, tam sayısıyla gönderilmesini ister; gerçek sinapslar ise tek yönlüdür. Beynin hatayı bu kadar düzgün geriye taşıdığına dair kanıt yok; dendritlerdeki ayrı sinyaller ya da geri bildirim bağlantıları gibi beyne daha uygun açıklamalar araştırılıyor. Yumuşak eşik ise gerçek nöronlardaki ateşleme sıklığına kabaca benziyor.',
    ai:'Geri yayılım 1986’da Rumelhart, Hinton ve Williams’ın çalışmasıyla yaygınlaştı ve 1969’daki tek katman duvarını aştı. Bugünkü bütün sinir ağları, dil modelleri dahil, bu yöntemle eğitilir. “Derin öğrenme”deki “derin”, bu ara katmanlardan çok sayıda olması demek.'
  },
  deeper:`<p><b>Yumuşak eşik:</b> ateşleme gücü = 1 ÷ (1 + e<sup>−(toplam − eşik)</sup>). Toplam eşiğe eşitken %50, çok üstündeyken %100’e, çok altındayken %0’a yaklaşır.</p>
    <p><b>Lambanın hatası:</b> doğru cevap − lambanın ateşleme gücü. Örneğin lamba %73 yandı ama sönmeliydi: hata −0,73.</p>
    <p><b>Ara nöronun payı:</b> lambanın hatası × (o ara nörondan lambaya bağlantı) × eğim. Eğim = ateş × (1 − ateş): ara nöron kararsızsa (%50 civarı) payı büyük, kararını kesin vermişse (%0 ya da %100) payı küçük.</p>
    <p><b>Düzeltme:</b> 4. seviyedeki kuralın aynısı: bağlantı += hız × hata (ya da pay) × girdi; eşik −= hız × hata (ya da pay).</p>
    <p><b>Simetri:</b> Bütün bağlantılar aynı başlarsa iki ara nöron hep aynı payı alır ve ikiz kalır; bu yüzden rastgele başlanır.</p>
    <p><b>Takılma:</b> Rastgele başlangıçların bir kısmında ağ hiç çözüme ulaşamadan bir “çukura” takılır (yerel en küçük). Burada “Rastgele başlat” takılmadığı bilinen başlangıçlardan birini seçiyor; gerçekte ağı yeniden başlatmak ya da daha çok ara nöron kullanmak gerekir.</p>`
},
/* ------------------------------ 9: yatay mı dikey mi? (yavru Pamuk’un gözü) ------------------------------ */
{
  key:'lines',goal:"Gözün neye bakacağını kimseden öğrenmeden, sadece bakarak öğrendiğini görmek: her görme nöronu sık gördüğü bir şekle ayarlanır. Bir nöronun “baktığı” şekil resim olarak çizilebilir.",
  todo:["Pamuk yeni doğmuş bir yavru kedi; gözü 3×3 noktadan oluşuyor. Soldaki çizgi düğmeleriyle ona çizgi göster. Gözündeki altı nöronun her birinin baktığı şekil, kartının içinde küçük bir resim olarak duruyor.","Her bakışta gördüğüne en çok benzeyen nöron kazanır ve resmi gördüğüne doğru kayar. Başta hepsi bulanık gri; gösterdikçe keskinleşirler.","Sonra öğretmen ol: bir çizgi göster ve “Bu yatay” ya da “Bu dikey” de. Ne yapacağını her an soldaki ipucu ve parlayan düğme söyler."],
  part:'C',title:'Yatay mı dikey mi?',
  question:'Yavru bir kedi gözünü açtığında çizgileri nasıl görmeye başlar? Gözündeki nöronlar neye bakacaklarını kimden öğrenir?',
  kind:'eye',
  init(){return{seed:1,W:NN.eyeInit(1,EYE.n),L:Array.from({length:EYE.n},()=>[0,0]),age:0,youth:{h:0,v:0,o:0},retina:[0,0,0,0,0,0,0,0,0],last:null,hist:[],n:0};},
  dailyTitle:'Bunu sen de yaşadın: görme, büyürken ayarlanır',
  daily:[
    {icon:'👶',title:'Yeni doğanın dünyası',text:'Yeni doğan bir bebek çok bulanık görür; keskin çizgileri ve kenarları ilk aylarda, baktıkça ayırmaya başlar. Pamuk’un gri, bulanık nöronlarının gösterdikçe keskinleşmesi gibi.'},
    {icon:'🙈',title:'Tembel göz',text:'Bir çocuğun bir gözü iyi görmezse beyin o gözden gelenlere ayarlanmayı bırakabilir. Bu yüzden göz tembelliği küçük yaşta, sağlam göz bantla kapatılarak tedavi edilir: büyüdükten sonra beyin çok daha zor ayarlanıyor.'},
    {icon:'🗣️',title:'Ana dilin sesleri',text:'Bebekler ilk aylarda bütün dillerin seslerini ayırabilir; bir yaş civarında yalnızca çevrelerinde duydukları seslere ayarlanırlar. Japoncada “r” ile “l” ayrı ses olmadığı için yetişkin Japonlar bu ikisini zor ayırır.'},
    {icon:'✍️',title:'Bozuk el yazısı',text:'Yarısı silinmiş bir tabelayı ya da kötü bir el yazısını yine de okursun. Gördüğün şekil tam eşleşmese de en çok benzediği harf “kazanır”.'}
  ],
  missions:[
    {id:'first',text:'Yavru Pamuk’a bir çizgi göster: soldaki <b>━ üst</b> düğmesine bas. Gözündeki altı nöronun hangisi kazandı, resmine ne oldu?',
      check:st=>!!st.flags.first,
      aha:'Altı nöronun hepsi başta bulanık griydi: her şeye biraz benziyorlardı. Gördüğü çizgiye en çok benzeyen nöron kazandı ve bağları o çizgiye doğru kaydı; resmi artık o çizgiye benziyor. Kimse Pamuk’a “bu bir çizgi” demedi. Sadece baktı.'},
    {id:'tuned',text:'Altı çizginin hepsini göster. Her çizginin <b>kendi keskin nöronu</b> olsun (benzerlik %90’ın üstünde).',
      check:st=>eyeTuned(st.W),
      aha:'Altı nöron altı çizgiye ayrıldı. Neden hepsi aynı çizgiye kaymadı? Bir nöron bir çizgiye ayarlanınca öteki çizgilere daha az benzemeye başlar; yeni bir çizgi gelince onu hâlâ bulanık olan bir nöron kazanır. Hubel ve Wiesel 1959’da kedinin görme korteksinde tam böyle nöronlar buldu: her biri yalnızca belirli bir yerdeki, belirli açıdaki bir çubuğa tepki veriyordu. Bir nöronun “baktığı” bu desene algı alanı denir.'},
    {id:'name',text:'Adını öğret: bir çizgi göster, sonra <b>━ Bu yatay</b> ya da <b>┃ Bu dikey</b> de. Pamuk altı çizginin hepsine doğru adı versin.',
      check:st=>eyeNamedAll(st),
      aha:'Görmeyi kendi kendine öğrenmişti; ad için her çizgiye bir kez söylemen yetti. Çünkü işin zor kısmını, çizgileri birbirinden ayırmayı, göz zaten yapmıştı. Ad, kazanan nörondan kelime nöronuna giden tek bir bağ. Çocuklar da bir kelimeyi çok az örnekle öğrenir: şekli zaten görebiliyorlar. Bir de dikkat et: “üst yatay”ın adını öğrenince “alt yatay”ı kendiliğinden bilmedi; bu küçük dünyada ikisinin ortak tek noktası yok.'},
    {id:'noisy',text:'Bozuk çizgi: soldaki bir çizgiyi göster, sonra gözdeki <b>bir noktaya tıklayarak</b> onu boz (bir noktayı söndür ya da fazladan bir nokta yak). Ardından <b>👁 Göster</b>. Pamuk yine doğru adı söylüyor mu?',
      check:st=>!!st.flags.noisy,
      aha:'Bozuk çizgi de en çok kendi nöronuna benziyor (%80 civarı). Kazanan değişmedi, ad da değişmedi. Silik bir yazıyı, kötü bir el yazısını, yarısı kapalı bir tabelayı da böyle okursun: tam eşleşme gerekmez, en çok benzeyen desen kazanır.'},
    {id:'blake',text:'Blakemore deneyi: <b>🐣 Yeni yavru</b> al ve <b>🌱 Sadece dikey dünyada büyüt</b>. Pamuk büyüyünce ona bir <b>yatay</b> çizgi göster. Görebiliyor mu?',
      check:st=>!!st.flags.blake,
      aha:'Pamuk yatay çizgiyi net göremiyor: hiçbir nöronu ona ayarlanmadı ve büyüdüğü için artık ayarlanamıyor. Blakemore ve Cooper 1970’te yavru kedileri yalnızca dikey çizgili bir silindirin içinde büyüttü. Kediler büyüyünce yatay şeyleri fark etmekte zorlandı ve görme korteksleri incelendiğinde yatay çizgiye tepki veren nöron neredeyse yoktu. Gözün neye ayarlanacağını büyürken gördükleri belirliyor ve bunun bir zaman penceresi var: kritik dönem. Çocuklarda tembel gözün erken tedavi edilmesi bu yüzden önemli.'}
  ],
  cards:{
    brain:'Gözden gelen sinyaller beynin arka tarafındaki görme korteksine gider. Hubel ve Wiesel (1959, 1981’de Nobel) kedilerde buradaki tek tek nöronları dinledi: bir nöron, ekranın belirli bir yerinde belirli açıda bir ışık çubuğu görününce çıtırdıyor, çubuk dönünce susuyordu. Her nöronun kendi “algı alanı” var. Bu ayar kabaca doğuştan gelir ama ilk haftalarda görülenlerle keskinleşir ve korunur; görmeyen bir göze ya da hiç görülmeyen bir açıya ayrılan nöronlar başka işe kayar. Bu pencere (kritik dönem) kapanınca değişim çok zorlaşır.',
    model:'Pamuk’un gözü 9 nokta, görme korteksi 6 nöron. Her nöronun 9 bağı var; bu bağları 3×3 resim olarak çizince nöronun neye baktığını görürsün. Bakınca her nöron, gördüğü resme ne kadar benzediğini hesaplar (benzerlik, %0–100). En çok benzeyen kazanır ve Pamuk yavruyken onun bağları gördüğü resme doğru %60 kayar (kazanan hepsini alır). 24 bakıştan sonra Pamuk büyür ve bu bağlar artık değişmez. Etiket yok; adlar ayrı: kazanan nörondan “yatay” ve “dikey” nöronlarına giden bağlar senin söylediğinle güçlenir.',
    limit:'Gerçek gözde milyonlarca nokta, görme korteksinde yüz milyonlarca nöron var; çizgiler her yerde, her açıda ve kalınlıkta. “Kazanan hepsini alır” beyinde, komşu nöronların birbirini bastırmasıyla kabaca gerçekleşir. Modelde hiç kazanamayan nöronlar bulanık kalıyor; gerçek kedilerde o nöronlar görülen açılara kaydı. Bir de: burada “yatay” adını her çizgi için ayrı öğrendi; gerçek beyin, üst katmanlarda konumdan bağımsız “yatay” diyen nöronlarla genelleştirir.',
    ai:'Görüntü tanıyan yapay ağların ilk katmanı eğitimden sonra tam da böyle kenar ve çizgi dedektörlerine dönüşür; bu filtreler resim olarak çizilip incelenir. Olshausen ve Field (1996), etiketsiz doğa fotoğraflarından öğrenen bir ağın görme korteksindekilere çok benzeyen algı alanları geliştirdiğini gösterdi. “Önce etiketsiz çok veriyle görmeyi öğren, sonra az etiketle ad öğren” bugünkü yapay zekânın da temel tarifi (ön eğitim, sonra ince ayar).'
  },
  deeper:`<p><b>Benzerlik:</b> resim ve nöronun bağları, ikisinin de “uzunluğu” 1 olacak biçimde ölçeklenir; sonra 9 noktanın her biri karşılığıyla çarpılıp toplanır. Aynı resim %100, hiç ortak noktası olmayan resim %0 verir.</p>
    <p><b>Örnek sayılar:</b> bulanık bir nöron her çizgiye %50–70 kadar benzer. Keskinleşmiş bir nöron kendi çizgisine %99, bir noktası eksik çizgiye yaklaşık %81, ortak tek noktası olan çizgiye yaklaşık %33 benzer. Pamuk %75’in altında “net göremiyor”.</p>
    <p><b>Öğrenme (yalnızca kazanan, yalnızca yavruyken):</b> yeni bağlar = 0,4 × eski bağlar + 0,6 × gördüğü resim, sonra yine ölçeklenir. Bir bakışta %60 civarından %90’ın üstüne çıkar.</p>
    <p><b>Neden tek bir nöron “her yerde yatay” diyemez?</b> Üç yatay çizginin bağ toplamları ile üç dikey çizginin bağ toplamları aynı 9 bağdan oluşur: ikisinin ortalaması da “bütün bağların toplamı ÷ 3”. Bu yüzden üç yatayın hepsi eşiğin üstünde, üç dikeyin hepsi altında olamaz. 6. seviyedeki duvarın aynısı; çözüm de aynı: araya her konum için bir dedektör koymak.</p>`
},
/* ------------------------------ 10: beş duyu, tek kavram ------------------------------ */
{
  key:'senses',goal:"Eğitilmiş bir ağın bir girdiyi cevaba nasıl çevirdiğini baştan sona izlemek: her duyu kendi yolundan gelir, kavram katmanında buluşur ve ağ ne olduğunu söyler.",
  todo:["Bu beyin eğitilmiş hâlde geliyor: 10 şeyi (4 meyve, 3 hayvan, 3 eşya) tanıyor. Senin işin ona bir şey sunmak: 🃏 bir kart göster, 📖 bir kelime yaz, 👅 tat ver, 👃 koklat ya da 🔊 bir ses çal.","Sahnede akışı soldan sağa izle: 1) duyu nöronları, 2) her duyunun kendi tanıyıcıları, 3) kavram nöronları, 4) çıktı. Yanan nöronlar ve yollar parlar.","Girdileri birleştirebilirsin (ör. tat + koku). Ne yapacağını her an soldaki ipucu ve parlayan düğme söyler."],
  part:'C',title:'Beş duyu, tek kavram',
  question:'Bir kedinin resmini görünce de, “kedi” yazısını okuyunca da, miyavlamasını duyunca da aklına aynı şey gelir. Bu kadar farklı yol beyinde nasıl aynı yerde buluşur?',
  kind:'senses',
  init(){return{card:null,word:'',taste:[0,0,0,0,0],smell:null,sound:null,last:null,hist:[],n:0};},
  dailyTitle:'Bunu sen de yaşadın: duyular buluşur',
  daily:[
    {icon:'🤧',title:'Burnun tıkalıyken',text:'Nezleyken yemekler tatsız gelir. Dil sadece beş temel tadı ayırır; “çilek tadı” sandığımızın çoğu aslında burundan gelir. Duyulardan biri susunca kavram eksik kalır.'},
    {icon:'📞',title:'Telefondaki ses',text:'Telefonu açıp “alo” sesini duyar duymaz kim olduğunu bilirsin. Yüzünü görmedin, adını okumadın; o kişinin kavramına sadece sesinden ulaştın.'},
    {icon:'🍿',title:'Patlamış mısır kokusu',text:'Bir yerden patlamış mısır kokusu gelince ortada mısır görmeden aklına sinema gelir. Koku, öbür duyuların da bağlı olduğu kavramı uyandırdı.'},
    {icon:'👄',title:'Gürültüde dudak okumak',text:'Kalabalık bir yerde konuşan birinin yüzüne bakınca onu daha iyi anlarsın. Görme ve işitme aynı kavramda buluşunca, ikisi de tek başına eksikken birlikte yetiyor.'}
  ],
  missions:[
    {id:'card',text:'Bir kart göster: soldan <b>🃏 🍋</b> kartını seç. Akışı soldan sağa izle: hangi nöronlar yanıyor, sonunda ne diyor?',
      check:st=>!!st.flags.card,
      aha:'Kart önce görme nöronlarında özelliklerine ayrıldı: sarı, yuvarlak, pürüzlü. Görsel tanıyıcılardan biri bu üçlüye en çok benziyordu; o da limon kavram nöronunu yaktı ve çıktı “limon” dedi. Beyin bir resmi tek parça olarak değil, parçalarıyla görür; tanımak, parçaların bilinen bir birleşimle eşleşmesidir.'},
    {id:'word',text:'Aynı şeyi yazıyla göster: yazı kutusuna <b>LİMON</b> yaz ve <b>Göster</b>’e bas. Bu sefer bambaşka nöronlardan geçiyor; sonunda hangi kavram nöronu yanıyor?',
      check:st=>!!st.flags.word,
      aha:'Yazı, resimle hiç ortak nöronu olmayan bir yoldan geldi: harf dedektörleri, sonra kelime tanıyıcı. Ama sonunda kartın yaktığı kavram nöronunun ta kendisini yaktı. Quiroga ve arkadaşları (2005, 2009) ameliyat için beynine elektrot yerleştirilen hastalarda bunu gördü: tek bir nöron, ünlü bir oyuncunun fotoğrafına da, yazılı adına da, söylenen adına da tepki veriyordu. Bu nöronlara kavram hücresi deniyor.'},
    {id:'sound',text:'Gözler kapalı: önce <b>🧹 Hepsini temizle</b>, sonra sadece bir ses çal (ör. <b>🔊 miyav</b>). Ses kulakta nasıl ayrılıyor?',
      check:st=>!!st.flags.sound,
      aha:'Ses, kulağın iç kısmında (koklea) pesten tize frekanslara ayrıldı; miyav orta ve tiz bantları yaktı. Ses tanıyıcı bu deseni tanıdı ve kedi kavram nöronu yandı: aynı kavrama üçüncü bir yoldan ulaşıldı. Bir kediyi görmeden, sesinden tanıman bu.'},
    {id:'ambig',text:'Tek bir duyu yetmeyebilir: temizle ve sadece <b>😋 tatlı</b> tat ver. Ne diyor?',
      check:st=>!!st.flags.ambig,
      aha:'Tatlı tat muza, elmaya ve çileğe uyuyor; beyin kararsız kaldı (%39, %32, %25). Gözün kapalıyken tadına baktığın bir şeyin ne olduğunu bilmek çoğu zaman zordur. Dil yalnızca beş temel tadı ayırır; meyvelerin farkını büyük ölçüde koku yapar.'},
    {id:'combine',text:'Şimdi tatlıya bir koku ekle: <b>👃 🍓 çilek kokusu</b>. Kararsızlık bitiyor mu?',
      check:st=>!!st.flags.combine,
      aha:'İki belirsiz ipucu birleşince kesinleşti: tatlı tat üç meyveye uyuyordu, koku başka şeylere de biraz benziyordu; ikisinin kesiştiği tek kavram çilek. Kavram nöronu farklı duyulardan gelen desteği topluyor. Beyin de duyuları böyle birleştirir: konuşan birinin dudaklarını görmek, gürültüde onu anlamayı belirgin biçimde kolaylaştırır.'},
    {id:'typo',text:'Yanlış yazılmış kelime: temizle ve yazı kutusuna <b>KÖPEG</b> yaz (ya da ELNA, kedı…). Yine tanıyor mu?',
      check:st=>!!st.flags.typo,
      aha:'Harflerin çoğu tuttuğu için kelime tanıyıcı yine doğru kelimeyi seçti; tam eşleşme gerekmiyor, en çok benzeyen kazanıyor (yatay-dikey seviyesindeki bozuk çizgi gibi). Ama bu ağın bir zaafı var: harflerin sırasına bakmıyor. LAME yaz: “elma” der! Gerçek okuma harflerin sırasını da kullanır; son seviye bu soruna bakıyor.'}
  ],
  cards:{
    brain:'Duyular beyinde ayrı yerlerden başlar: görme arkada, işitme yanlarda, koku beynin alt-ön kısmında, tat ise dilden gelen sinirlerle. Her duyu önce kendi alanında işlenir; sonra şakak lobunun ön kısmı ve hipokampus çevresi gibi birleştirme bölgelerinde buluşur. Orada bir kavrama hangi yoldan gelinirse gelinsin tepki veren nöronlar bulundu (kavram hücreleri). Şakak lobunun ön kısmı hasar görünce (semantik demans) hastalar bir nesnenin ne olduğunu ister resmini görsün, ister adını duysun, ister eline alsın bilemez hâle gelir: buluşma noktası kaybolmuştur.',
    model:'59 duyu nöronu: görme 13 özellik, okuma 29 harf, koku 6 reseptör türü, işitme 6 frekans bandı, tat 5. Sonra 28 duyu alanı nöronu: 10 görsel nesne, 10 kelime, 5 koku ve 3 ses tanıyıcı. Bir tanıyıcı, gelen desenin tanıdığı desene benzerliği %55’i geçince yanar. Sonra 10 kavram nöronu: her biri kendi tanıyıcılarından ve tat nöronlarından gelen desteği toplar (tat daha hafif sayılır). Çıktıda kavramlar yarışır; en güçlüsü payın çoğunu alır ve ad (10) ile tür (meyve, hayvan, nesne) söylenir. Ağ eğitilmiş hâlde gelir: her tanıyıcının bağları, tanıdığı şeyin deseni.',
    limit:'Buradaki görme nöronları hazır özellikler (sarı, yuvarlak, tüylü); gerçek göz ham ışık noktaları görür ve bu özellikleri katman katman kendisi çıkarır (yatay-dikey seviyesi bunun ilk adımıydı). Okuma yolu harflerin sırasına bakmıyor. İnsanda yaklaşık 400 koku reseptörü türü, on binlerce kavram var ve bir kavram tek bir nöronda değil, birçok nöronun birlikte yanmasında saklı; kavram hücreleri bunun görünen ucu. Bu ağ donmuş: yeni bir şey öğrenemiyor.',
    ai:'Çok kipli (multimodal) yapay zekâ modelleri resmi, metni ve sesi ayrı kodlayıcılarla işleyip ortak bir uzayda buluşturur; bir köpek fotoğrafı ile “köpek” kelimesi orada birbirine yakın düşer (ör. CLIP, 2021). Buradaki duyu alanları kodlayıcılara, kavram katmanı o ortak uzaya benziyor. Eğitilmiş bir modeli eğitmeden kullanmaya çıkarım denir: telefonundaki yüz tanıma her seferinde eğitilmez, eğitilmiş bağlarla sadece hesaplar.'
  },
  deeper:`<p><b>1 · Duyu nöronları:</b> kart, görme özelliklerini yakar (limon: sarı, yuvarlak, pürüzlü). Yazı, harf dedektörlerini yakar (SAAT: S bir kez, A iki kez, T bir kez). Koku 6 reseptörden 2–3’ünü, ses 6 frekans bandından birkaçını yakar. Tat, 5 tat nöronundan seçtiklerini yakar.</p>
    <p><b>2 · Duyu alanları:</b> her tanıyıcı, gelen deseni kendi deseniyle karşılaştırır (benzerlik 0–1, yatay-dikey seviyesindeki gibi). Benzerlik %55’in altındaysa susar, %100’e yaklaştıkça tam yanar: yanma = (benzerlik − 0,55) ÷ 0,45.</p>
    <p><b>3 · Kavram:</b> her kavram nöronu = görsel tanıyıcısı + kelime tanıyıcısı + koku tanıyıcısı + ses tanıyıcısı + 0,7 × tat benzerliği. Tat daha hafif sayılır: dil yalnızca beş tadı ayırdığı için tat tek başına az şey söyler. Örnek: tatlı + çilek kokusu → çilek = 0,7 × 0,89 (tat) + 1 (koku) = 1,63; muz = 0,7 × 1 = 0,7.</p>
    <p><b>4 · Çıktı:</b> kavramlar yarışır. Her kavramın payı, toplamından en büyüğünü çıkarıp 6 ile çarptığın sayının üstel değeriyle orantılı. Toplam 0,25’in altındaysa “bilmiyorum” der. Tür (meyve, hayvan, nesne), o türdeki kavramların paylarının toplamı.</p>
    <p><b>Yazım hatası:</b> KÖPEG ile KÖPEK’in 5 harfinden 4’ü ortak: benzerlik 0,85, yanma 0,66. Başka hiçbir kelime yaklaşamadığı için köpek yine kazanır. LAME ile ELMA’nın harfleri aynı, sırası farklı: bu ağ için ikisi aynı kelime.</p>`
},
/* ------------------------------ 12: birlikte yanan, birlikte bağlanır (Ela, limon ve çilek) ------------------------------ */
{
  key:'hebb',goal:"Öğretmen, ödül ya da sürpriz olmadan da öğrenilebildiğini görmek: aynı anda gelen hisler birbirine bağlanır ve bir “şey” olur. Sonra o şeyin tek bir parçası, bütününü geri çağırır.",
  todo:["Ela iki yaşında ve mutfakta ilk kez meyve tadıyor. Beyninde sekiz his nöronu var (renk, tat, koku, dokunma). Soldaki 🍋 Limon düğmesi Ela’ya bir limon yaşatır: dört his aynı anda yanar.","Aynı anda yanan iki nöronun arasındaki bağ güçlenir; sahnede çizgiler kalınlaşır. Etiket yok, öğretmen yok.","Sonra bir ipucu ver (ör. sadece koku) ve Ela’nın beyninin neyi tamamladığını izle. Ne yapacağını her an soldaki ipucu ve parlayan düğme söyler."],
  part:'D',title:'Birlikte yanan, birlikte bağlanır',
  question:'Limonu sadece düşünmek bile neden ağzını sulandırır? Bir koku, yıllar önceki bir anıyı nasıl bütünüyle geri getirir?',
  kind:'hebb',
  init(){return{W:hZero(),sel:[0,0,0,0,0,0,0,0],last:null,hist:[],n:0};},
  dailyTitle:'Bunu sen de yaşadın: bir parça, bütünü çağırır',
  daily:[
    {icon:'🍋',title:'Limon düşünmek',text:'Bir limonu dilimleyip ağzına attığını düşün. Ağzın sulandı mı? Limonun tadı yok ama görüntüsü ve kokusu, onlarla hep birlikte gelen ekşi tadı da uyandırdı.'},
    {icon:'🎵',title:'Şarkının ilk notaları',text:'Bildiğin bir şarkının ilk iki notasını duyunca devamı kafanda çalmaya başlar. Notalar hep aynı sırayla birlikte geldiği için birbirine bağlandı.'},
    {icon:'🫖',title:'Bir koku, bir anı',text:'Bir kokuyu (ıhlamur, sobada kestane, bir parfüm) duyunca birden çocukluğundaki bir ev, bir mevsim, bir insan gözünün önüne gelir. Tek bir parça bütün anıyı çağırdı.'},
    {icon:'😷',title:'Maskeli yüz',text:'Yüzünün yarısı maskeyle kapalı bir arkadaşını yine de tanırsın. Gözler ve saç, yüzün geri kalanını tamamlamaya yetiyor.'}
  ],
  missions:[
    {id:'wire',text:'Ela limonla tanışıyor: <b>🍋 Limon</b> düğmesine <b>4 kez</b> bas. Her seferinde dört his birlikte gelir: sarı renk, ekşi tat, keskin koku, pürüzlü kabuk.',
      check:st=>hebbMinIn(st.W,HEBB.things.lim.x)>=0.99,
      aha:'Dört his her seferinde aynı anda yandı ve aralarındaki altı bağın hepsi güçlendi. Kimse Ela’ya “bunun adı limon” demedi; ödül ya da sürpriz de yoktu. Tek kural şu: aynı anda yanan iki nöronun arasındaki bağ güçlenir. Donald Hebb bunu 1949’da öne sürdü; sonradan “birlikte yanan nöronlar birlikte bağlanır” diye özetlendi. Ela’nın beyninde bu dört his artık birbirine bağlı bir grup, yani bir “şey”.'},
    {id:'complete',text:'Parçadan bütüne: Ela’ya sadece <b>👃 keskin kokuyu</b> ver (gözleri kapalı, limonu koklatıyorsun). Beyni ne hatırlıyor?',
      check:st=>!!st.flags.complete,
      aha:'Sadece koku geldi; ama sarı renk, ekşi tat ve pürüzlü kabuk da yandı. Beyin eksik parçaları bağlar üzerinden tamamladı. Ekşi tat nöronu yanınca Ela’nın tadına bakmadan ağzı sulandı: limonu düşünmek bile ağzını sulandırır. Hipokampusun en önemli işlerinden biri bu: bir parçadan bütün anıyı geri çağırmak (örüntü tamamlama).'},
    {id:'two',text:'İkinci şey: <b>🍓 Çilek</b> düğmesine <b>4 kez</b> bas. Sonra sadece <b>🔴 kırmızı</b> ipucunu ver. Limon mu geliyor, çilek mi?',
      check:st=>!!st.flags.two,
      aha:'Kırmızı yalnızca çileği çağırdı; limona hiç dokunmadı. Aynı sekiz nöronda iki ayrı anı saklanıyor ve bir ipucu yalnızca kendi grubunu uyandırıyor. Bilgisayardaki bir dosyaya adresiyle ulaşılır; beyindeki bir anıya ise içeriğinin bir parçasıyla.'},
    {id:'clean',text:'Yanlış ipucu: <b>🟡 sarı + 😖 ekşi + 😋 tatlı</b> ver. Tatlı tat limona ait değil. Ela ne hatırlıyor?',
      check:st=>!!st.flags.clean,
      aha:'Sarı ve ekşi limonu çağırdı; limonun öbür parçaları da yandı. Tatlı tat ise hiçbir yandan destek almadı ve söndü. Beyin uymayan parçayı atıp en yakın anıya oturdu. Saçını kestirmiş ya da gözlük takmış bir arkadaşını yine tanıman da böyle: uymayan parça bastırılır, uyan anı tamamlanır.'},
    {id:'mix',text:'Karışan anılar: <b>🍋🍓 Çilekli limonata</b> düğmesine <b>3 kez</b> bas (iki meyve hep birlikte). Sonra yine sadece <b>👃 keskin koku</b> ver. Şimdi ne geliyor?',
      check:st=>!!st.flags.mix,
      aha:'Keskin koku artık limonla birlikte çileği de çağırıyor: iki ayrı şey, birlikte yaşandıkça tek bir anıya kaynaştı. Hebb kuralı neyin birlikte geldiğine bakar, neyin “aslında” ayrı olduğuna bakmaz. Bir kokunun sana sadece bir yemeği değil, onu yediğin evi, mevsimi ve insanları da hatırlatması bu yüzden. İyi tarafı zengin çağrışımlar; kötü tarafı, benzer anıların birbirine karışabilmesi. Sonraki seviyeler bu soruna bakıyor.'}
  ],
  cards:{
    brain:'İki nöron arasındaki bağ, ikisi neredeyse aynı anda etkin olunca kalıcı olarak güçlenir (uzun süreli güçlenme). Bunu sağlayan NMDA reseptörü bir “aynı anda mı?” dedektörü gibi çalışır: yalnızca gönderen sinyal yollarken alan nöron da etkinse açılır. Hipokampusun CA3 bölgesindeki nöronlar birbirine bol bol bağlıdır; bir anının parçası geldiğinde bütününü tamamladığı düşünülür. Bu bölgede NMDA reseptörü olmayan fareler, bir yeri bütün ipuçlarıyla bulabiliyor ama ipuçlarının çoğu kaldırılınca bulamıyordu (Nakazawa ve arkadaşları, 2002). Bir anıyı taşıyan nöron grubuna “engram” deniyor; farelerde bu nöronlar ışıkla uyarılınca anı geri geldi (Liu ve arkadaşları, 2012).',
    model:'Ela’nın beyninde sekiz his nöronu var ve her biri ötekilerin hepsine bağlı. Yaşarken: aynı anda yanan her iki nöron arasındaki bağ 0,25 artar (en çok 1). Hatırlarken: verdiğin ipucu yanar; sonra her adımda bir nöron, o an yanan öbür nöronlardan aldığı bağların ortalaması %60’ı geçerse yanar, geçmezse söner. Bu, durum değişmeyene kadar sürer. Öğretmen, ödül ya da sürpriz yok; tek kural “birlikte”.',
    limit:'Bu modelde bağlar sadece güçleniyor; beyinde bağlar zayıflayabilir de ve nöronlar toplam etkinliklerini dengede tutar. Gerçek bir anı sekiz değil binlerce nörona dağılmıştır ve her nöron birçok anıda yer alır. Beyin, benzer anıların karışmaması için onları hipokampusun bir bölümünde ayrı nöron gruplarına yayar (örüntü ayrıştırma); modelde böyle bir koruma yok. Bağlar burada iki yönde de aynı; gerçek sinapslar tek yönlüdür.',
    ai:'Bu ağ, Hopfield ağının (1982) küçük bir hâli: Hebb kuralıyla saklanan desenler, bir parçalarından tamamlanır. John Hopfield bu çalışmayla Geoffrey Hinton’la birlikte 2024 Nobel Fizik Ödülü’nü aldı. İçeriğinin bir parçasıyla ulaşılan bu tür belleğe içerikle adreslenen bellek denir. Kelimelerin anlamını, metinde hangi kelimelerle birlikte geçtiklerinden öğrenen kelime vektörleri de aynı fikre dayanır.'
  },
  deeper:`<p><b>Yaşarken (Hebb kuralı):</b> aynı anda yanan her iki nöron arasındaki bağ += 0,25 (en çok 1). Yanmayan nöronların bağları değişmez. 🍋 Limonda dört his yanar, aralarındaki 4 × 3 ÷ 2 = 6 bağın her biri 0,25 artar. Dört kerede 1’e ulaşır.</p>
    <p><b>Hatırlarken:</b> bir nöronun desteği = o an yanan öteki nöronlardan ona gelen bağların ortalaması. Destek %60 ya da üstüyse yanar. İlk adımda ipucu yanık kalır, sonraki adımlarda o da destek ister.</p>
    <p><b>Neden 3 limon yetiyor?</b> Üç kerede bağlar 0,75 olur. Sadece koku verince sarının desteği 0,75 ≥ 0,6: yanar. İki kerede 0,5 kalır, bir koku yetmez. Az yaşanmış bir anı için daha çok ipucu gerekir.</p>
    <p><b>Yanlış ipucu:</b> sarı + ekşi + tatlı. 1. adımda keskin koku ve pürüzlü kabuk da yanar (sarı ve ekşiden 1 + 1, tatlıdan 0 alırlar: ortalama 0,67). 2. adımda tatlının desteği 0 (limon nöronlarından ona hiç bağ yok): söner.</p>
    <p><b>Karışma:</b> çilekli limonata sekiz hissi birden yakar; limon ve çilek nöronları arasındaki 16 bağ da artar. Üç kerede 0,75 olur ve tek bir koku iki meyveyi birden çağırır.</p>`
}
];

// Yol haritası: bütün seviyeler sırasıyla. Hazır olanlar LEVELS'ta, ötekiler “yakında” ya da laboratuvarda.
const ROADMAP=[
  {key:'light'},{key:'pair'},{key:'inhibit'},
  {key:'learn'},
  {key:'predict'},
  {key:'xor'},
  {key:'fruit'},
  {key:'two'},
  {key:'lines'},
  {key:'senses'},
  {key:'digits',part:'C',title:'Rakamları tanıma',lab:'digits',note:'laboratuvar',about:'5×7 piksellik rakamları daha büyük bir ağla tanımak: kaç gizli nöron yeter, bozuk çizilmiş bir rakamı nasıl tamamlar?'},
  {key:'hebb'},
  {key:'where',part:'D',title:'Hafıza nerede?',note:'yakında',about:'Öğrenmiş bir ağdan nöron ya da bağlantı silince ne olur? Bilgi tek bir yerde değil, bağlantılara dağılmış; beyin hasarı da çoğu zaman yavaş yavaş bozulma olarak görülür.'},
  {key:'general',part:'D',title:'Ezber ve genelleme',note:'yakında',about:'Eğitimde hiç gösterilmeyen sınav (doğrulama) kartlarıyla: ağ kuralı mı öğrendi, yoksa örnekleri mi ezberledi?'},
  {key:'sleep',part:'D',title:'Unutma ve uyku',note:'yakında',about:'Yeni bir şey öğrenince eskisinin bozulması ve beynin uykuda yaptığı tekrar oynatmanın bunu nasıl önlediği.'},
  {key:'words',part:'E',title:'Kelimeler ve anlam',lab:'words',note:'laboratuvar',about:'Her kelime bir duyu nöronu, her anlam bir cevap nöronu. Eğitim ilerledikçe benzer anlamlı kelimeler gizli katmanda birbirine yaklaşır (anlam uzayı).'},
  {key:'read',part:'E',title:'Okuma ve kayma sorunu',lab:'read',note:'laboratuvar',about:'Kelimeyi piksel resmi olarak okumak: hiç görmediği kelimeleri tahmin etmesi, bir harf kayınca neden şaşırdığı ve paylaşımlı dedektörlerin çözümü.'}
];
ROADMAP.forEach((r,i)=>{r.id=i+1;const lv=LEVELS.find(l=>l.key===r.key);if(lv){lv.id=r.id;r.level=lv;r.part=lv.part;r.title=lv.title;}});

if(typeof module!=='undefined'&&module.exports){module.exports={PARTS,LEVELS,ROADMAP,SCENARIOS,NET_PATTERNS,NET_SEEDS,PREDICT,predictCue,predictGive,predictCommit,predictNewBrain,EYE,eyeNearest,eyeAnswer,eyeTuned,eyeNamedAll,eyeShow,eyeName,eyeNewKitten,eyeGrow,HEBB,hebbMinIn,hebbMinCross,hebbLive,hebbCue,hebbNewBaby,SENSES,sCos,sLetters,sWordNorm,sensesRun,sensesCommit,sensesClear};}
