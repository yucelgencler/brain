/* Beyne yolculuk: küçük devrenin nöron simülasyonu (sızdıran topla-ateşle).
   Arayüzden bağımsız; Node testleri için module.exports.
   Birimler: zaman ms, gerilim mV, uzunluk µm. */
(function(root){
'use strict';

const LIF={rest:-70,thr:-55,reset:-75,tau:15,refr:2.5,speed:150/* µm/ms ≈ 0,15 m/s */,syn:0.8/* sinaps gecikmesi ms */,h:0.1};

function rng(seed){let a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

/* ---------- devre tarifleri ----------
   neuron: {id, kind:'pyr'|'int'|'in'|'out', label, pos:[x,y,z], bg:Hz (arka plan girdisi)}
   conn:   {from, to, w (mV), len (µm, yol uzunluğu)} */
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);}
function finish(spec){
  const byId={};spec.neurons.forEach((n,i)=>{n.i=i;byId[n.id]=n;});
  spec.conns.forEach(c=>{c.a=byId[c.from].i;c.b=byId[c.to].i;if(!c.len)c.len=dist(byId[c.from].pos,byId[c.to].pos)*1.35+30;});
  return spec;
}

function specGeneric(seed){
  const r=rng(seed||7),N=[],C=[];
  const P=(x,y,z)=>[x,y,z];
  for(let i=0;i<9;i++)N.push({id:'p'+i,kind:'pyr',label:'',pos:P(-130+r()*260,40+r()*70,-70+r()*140),bg:150});
  for(let i=0;i<6;i++)N.push({id:'q'+i,kind:'pyr',label:'',pos:P(-120+r()*240,-110+r()*60,-60+r()*120),bg:150});
  for(let i=0;i<4;i++)N.push({id:'i'+i,kind:'int',label:'',pos:P(-110+r()*220,-30+r()*80,-60+r()*120),bg:110});
  for(let i=0;i<3;i++)N.push({id:'t'+i,kind:'in',label:'talamustan',pos:P(-80+i*80,-230,-30+r()*60),rate:18});
  const ex=N.filter(n=>n.kind==='pyr'),inh=N.filter(n=>n.kind==='int'),inp=N.filter(n=>n.kind==='in');
  const pick=(arr,k,not)=>{const a=arr.filter(n=>n!==not).slice();const o=[];while(o.length<k&&a.length){o.push(a.splice(Math.floor(r()*a.length),1)[0]);}return o;};
  ex.forEach(n=>{pick(ex,3,n).forEach(t=>C.push({from:n.id,to:t.id,w:5+r()*3}));pick(inh,1).forEach(t=>C.push({from:n.id,to:t.id,w:7}));});
  inh.forEach(n=>pick(ex,4).forEach(t=>C.push({from:n.id,to:t.id,w:-(7+r()*3)})));
  inp.forEach(n=>pick(ex,4).forEach(t=>C.push({from:n.id,to:t.id,w:8})));
  return finish({mode:'generic',neurons:N,conns:C});
}

/* Görme alanı (V1): talamustan gelen 6 lif → kenar ve renk nöronları. */
function specV1(){
  const N=[],C=[];
  for(let i=0;i<6;i++)N.push({id:'g'+i,kind:'in',label:i===0?'talamustan (LGN)':'',pos:[-125+i*50,-230,0],rate:5});
  N.push({id:'curve',kind:'pyr',label:'eğri kenar ◠',pos:[-95,40,10],bg:40});
  N.push({id:'horiz',kind:'pyr',label:'yatay kenar —',pos:[-30,70,-20],bg:40});
  N.push({id:'vert',kind:'pyr',label:'dikey kenar |',pos:[40,60,25],bg:40});
  N.push({id:'yellow',kind:'pyr',label:'sarı leke',pos:[105,30,-10],bg:40});
  N.push({id:'inh',kind:'int',label:'susturan',pos:[5,-40,40],bg:30});
  N.push({id:'out',kind:'out',label:'→ şakak lobuna',pos:[20,240,-30]});
  const w=(a,b,v)=>C.push({from:a,to:b,w:v});
  ['g0','g1','g2','g3'].forEach(g=>w(g,'curve',6.5));
  w('g0','horiz',5);w('g4','horiz',5);
  w('g1','vert',5);w('g5','vert',5);
  ['g2','g3','g4'].forEach(g=>w(g,'yellow',6.5));
  w('curve','inh',8);w('yellow','inh',8);
  w('inh','horiz',-10);w('inh','vert',-10);
  w('curve','out',0);w('yellow','out',0);
  return finish({mode:'v1',neurons:N,conns:C,stim:{lemon:{g0:70,g1:70,g2:70,g3:70,g4:8,g5:8}},rest:{g0:5,g1:5,g2:5,g3:5,g4:5,g5:5}});
}

/* Şakak lobu (nesne tanıma): özellikler → kavram nöronları, susturanla kazanan tek. */
function specIT(){
  const N=[],C=[];
  const feats=[['f_yel','sarı renk'],['f_oval','oval biçim'],['f_peel','pürüzlü kabuk'],['f_sour','ekşi koku'],['f_long','uzun biçim'],['f_orng','turuncu renk'],['f_sweet','tatlı koku']];
  feats.forEach((f,i)=>N.push({id:f[0],kind:'in',label:f[1],pos:[-180+i*60,-230,(i%2?30:-30)],rate:3}));
  N.push({id:'lemon',kind:'pyr',label:'LİMON',pos:[-90,70,0],bg:30,concept:true});
  N.push({id:'banana',kind:'pyr',label:'MUZ',pos:[0,95,-30],bg:30,concept:true});
  N.push({id:'orange',kind:'pyr',label:'PORTAKAL',pos:[90,70,20],bg:30,concept:true});
  N.push({id:'inh',kind:'int',label:'susturan',pos:[0,-30,45],bg:20});
  N.push({id:'out',kind:'out',label:'→ konuşma alanına',pos:[-40,250,-20]});
  const w=(a,b,v)=>C.push({from:a,to:b,w:v});
  w('f_yel','lemon',5.5);w('f_oval','lemon',4.5);w('f_peel','lemon',4.5);w('f_sour','lemon',5.5);
  w('f_yel','banana',5);w('f_long','banana',8);w('f_sweet','banana',4);
  w('f_orng','orange',7);w('f_oval','orange',4);w('f_peel','orange',4);w('f_sweet','orange',3);
  ['lemon','banana','orange'].forEach(c=>{w(c,'inh',16);w('inh',c,-9);});
  w('lemon','out',0);
  return finish({mode:'it',neurons:N,conns:C,stim:{lemon:{f_yel:65,f_oval:65,f_peel:65,f_sour:65,f_long:3,f_orng:3,f_sweet:3}},rest:{}});
}

/* ---------- simülasyon ---------- */
function Sim(spec,seed){
  this.spec=spec;this.r=rng(seed||11);this.t=0;
  const n=spec.neurons.length;
  this.v=new Float64Array(n).fill(LIF.rest);
  this.refr=new Float64Array(n);this.last=new Float64Array(n).fill(-1e9);
  this.count=new Uint32Array(n);
  this.rate=spec.neurons.map(x=>x.kind==='in'?(x.rate||0):0);
  this.next=spec.neurons.map(()=>this.r()*60);
  this.out=spec.neurons.map(()=>[]);
  spec.conns.forEach((c,k)=>{c.k=k;c.travel=c.len/LIF.speed;this.out[c.a].push(c);});
  this.q=[];                 // bekleyen varışlar {t,c}
  this.TR=160;this.trace=spec.neurons.map(()=>new Float32Array(this.TR).fill(LIF.rest));this.tp=0;this.tAcc=0;
  this.bgOn=true;
}
Sim.prototype.setRates=function(map){
  this.spec.neurons.forEach((x,i)=>{if(x.kind==='in'&&map&&map[x.id]!=null)this.rate[i]=map[x.id];});
};
Sim.prototype.fire=function(i,spikes){
  this.v[i]=LIF.reset;this.refr[i]=LIF.refr;this.last[i]=this.t;this.count[i]++;
  spikes.push({i,t:this.t});
  for(const c of this.out[i]){if(this.spec.neurons[c.b].kind==='out')continue;this.q.push({t:this.t+c.travel+LIF.syn,c});}
};
/* dt ms ilerlet; o aralıktaki ateşlemeleri ve varışları döndür. */
Sim.prototype.step=function(dt){
  const spikes=[],arrivals=[],N=this.spec.neurons,h=LIF.h,decay=Math.exp(-h/LIF.tau);
  let steps=Math.max(1,Math.round(dt/h));
  for(let s=0;s<steps;s++){
    this.t+=h;
    // varışlar
    if(this.q.length){
      let keep=[];
      for(const e of this.q){
        if(e.t<=this.t){const b=e.c.b;arrivals.push(e.c);if(this.refr[b]<=0)this.v[b]+=e.c.w;}
        else keep.push(e);
      }
      this.q=keep;
    }
    for(let i=0;i<N.length;i++){
      const nn=N[i];
      if(nn.kind==='out')continue;
      if(nn.kind==='in'){
        if(this.rate[i]>0&&this.t>=this.next[i]){
          this.fire(i,spikes);
          const per=1000/this.rate[i];this.next[i]=this.t+per*(0.75+0.5*this.r());
        }else if(this.rate[i]<=0)this.next[i]=this.t+this.r()*50;
        continue;
      }
      if(this.refr[i]>0){this.refr[i]-=h;continue;}
      if(this.v[i]>=LIF.thr){this.fire(i,spikes);continue;}   // gelen sinyal eşiği geçirdiyse hemen ateşle
      this.v[i]=LIF.rest+(this.v[i]-LIF.rest)*decay;
      if(this.bgOn&&nn.bg&&this.r()<nn.bg*h/1000)this.v[i]+=3;
      if(this.v[i]>=LIF.thr)this.fire(i,spikes);
    }
    this.tAcc+=h;
    if(this.tAcc>=0.5){this.tAcc-=0.5;this.tp=(this.tp+1)%this.TR;for(let i=0;i<N.length;i++)this.trace[i][this.tp]=this.refr[i]>LIF.refr-0.6?20:this.v[i];}
  }
  return{spikes,arrivals};
};
/* Eşiğe ne kadar yakın: 0 dinlenme, 1 eşik. */
Sim.prototype.charge=function(i){return Math.max(0,Math.min(1,(this.v[i]-LIF.rest)/(LIF.thr-LIF.rest)));};

const api={LIF,Sim,specGeneric,specV1,specIT,rng};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else{root.B3=root.B3||{};root.B3.sim=api;}
})(typeof window!=='undefined'?window:globalThis);
