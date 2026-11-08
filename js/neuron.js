"use strict";
/* ------------------------------------------------------------------
   TEK NÖRON: seviye 1–5'in modeli. Arayüzden bağımsız, Node ile test edilir.

   Nöron "ya hep ya hiç" çalışır:
     toplam = girdi₁ × bağlantı₁ + girdi₂ × bağlantı₂ + ...
     toplam ≥ eşik  ->  ateşler (1),  değilse susar (0)

   Öğrenme (seviye 4–5): Rosenblatt'ın algılayıcı (perceptron) kuralı.
     hata = istenen − çıktı           (+1: susmuştu, ateşlemeliydi; −1: boşuna ateşledi; 0: doğru)
     bağlantı_i += hız × hata × girdi_i  (yanan girdilerin bağlantısı değişir)
     eşik       −= hız × hata
------------------------------------------------------------------- */
const EPS=1e-9;
// Kaydırıcılardan gelen ondalık sayılarda 0,1 + 0,2 gibi yuvarlama hatalarını temizler
const tidy=v=>(Math.round(v*1e6)/1e6)||0;  // ||0: −0 yerine 0

function weightedSum(x,w){let s=0;for(let i=0;i<x.length;i++)s+=x[i]*w[i];return tidy(s);}
function fires(x,w,theta){return weightedSum(x,w)>=theta-EPS?1:0;}

// İki girdinin dört durumu: (A, B). Sıra bütün tablolarda aynı.
const COMBOS=[[0,0],[1,0],[0,1],[1,1]];

// İstenen davranışlar: dört durum için istenen çıktı
const GATES={
  and:  {name:'İkisi de yanınca',               short:'VE',            target:[0,0,0,1]},
  or:   {name:'Biri yanınca yeter',             short:'VEYA',          target:[0,1,1,1]},
  aNotB:{name:'A yansın, B yanmasın',       short:'A AMA B DEĞİL', target:[0,1,0,0]},
  nor:  {name:'Hiçbiri yanmayınca',             short:'KARANLIK',      target:[1,0,0,0]},
  xor:  {name:'Tam olarak biri yanınca',        short:'YA O YA BU',    target:[0,1,1,0]}
};

function outputs(w,theta){return COMBOS.map(x=>fires(x,w,theta));}
function score(w,theta,target){const o=outputs(w,theta);let c=0;for(let i=0;i<4;i++)if(o[i]===target[i])c++;return c;}
function solves(w,theta,target){return score(w,theta,target)===4;}

// Tek bir örnekten öğrenme. Değişiklikleri ayrıntılı döndürür ki arayüz gösterebilsin.
function learnStep(x,w,theta,target,rate){
  const sum=weightedSum(x,w),out=sum>=theta-EPS?1:0,err=target-out;
  const dw=x.map(xi=>tidy(rate*err*xi)),dtheta=tidy(-rate*err);
  return{x:x.slice(),sum,out,target,err,dw,dtheta,w:w.map((wi,i)=>tidy(wi+dw[i])),theta:tidy(theta+dtheta)};
}

// Bir tur: dört örneğin hepsini sırayla göster. Kaç hata yaptığını döndürür.
function learnRound(w,theta,target,rate){
  let mistakes=0;
  for(let i=0;i<4;i++){const r=learnStep(COMBOS[i],w,theta,target[i],rate);if(r.err)mistakes++;w=r.w;theta=r.theta;}
  return{w,theta,mistakes};
}

// Birden çok nöron aynı girdileri okur (seviye 7). Her nöron kendi bağlantıları ve eşiğiyle, birbirinden bağımsız öğrenir.
function multiOutputs(x,W,th){return W.map((w,k)=>fires(x,w,th[k]));}
function multiStep(x,W,th,y,rate){
  const per=W.map((w,k)=>learnStep(x,w,th[k],y[k],rate));
  return{per,W:per.map(p=>p.w),th:per.map(p=>p.theta),mistakes:per.filter(p=>p.err).length};
}

/* ---------- Seviye 8: iki ara (gizli) nöron + bir çıkış nöronu ----------
   net = {W:[[a,b],[a,b]] (ara nöronların A,B bağlantıları), th:[t1,t2], V:[v1,v2] (ara → çıkış), thO}
   soft=false: ya hep ya hiç; soft=true: yumuşak eşik (0–1 arası ateşleme gücü) */
const sigmoid=z=>1/(1+Math.exp(-z));
function rng(seed){let a=seed|0;return function(){a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function netRandom(seed){const r=rng(seed),u=()=>r()*2-1;return{W:[[u(),u()],[u(),u()]],th:[u(),u()],V:[u(),u()],thO:u()};}
function netZero(){return{W:[[0,0],[0,0]],th:[0,0],V:[0,0],thO:0};}
function netClone(n){return{W:n.W.map(w=>w.slice()),th:n.th.slice(),V:n.V.slice(),thO:n.thO};}
function netForward(x,n,soft){
  const act=(s,t)=>soft?sigmoid(s-t):(s>=t-EPS?1:0);
  const hs=n.W.map(w=>weightedSum(x,w)),h=hs.map((s,j)=>act(s,n.th[j]));
  const os=weightedSum(h,n.V),o=act(os,n.thO);
  return{hs,h,os,o};
}
// Çıkış ≥ 0,5 ise lamba yanar
function netOutputs(n,soft){return COMBOS.map(x=>netForward(x,n,soft).o>=0.5?1:0);}
function netSolves(n,soft,target,margin){
  return COMBOS.every((x,i)=>{const o=netForward(x,n,soft).o;return margin?Math.abs(o-target[i])<margin:(o>=0.5?1:0)===target[i];});
}
// Ara nöronun dört durumdaki ateşleme deseni ("0100" gibi)
function netPattern(n,soft,j){return COMBOS.map(x=>netForward(x,n,soft).h[j]>=0.5?1:0).join('');}
/* Geri yayılım: 4. seviyedeki kuralın aynısı (bağlantı += hız × hata × girdi).
   Fark: ara nöronların hatası doğrudan bilinmez; çıkışın hatasından pay alır:
   pay_j = çıkış hatası × (ara j → çıkış bağlantısı) × eğim_j,  eğim = ateş × (1 − ateş) */
function netLearnStep(x,t,n,rate){
  const f=netForward(x,n,true),err=t-f.o;
  const blame=f.h.map((hj,j)=>err*n.V[j]*hj*(1-hj));
  const m=netClone(n);
  m.V=n.V.map((v,j)=>v+rate*err*f.h[j]);m.thO=n.thO-rate*err;
  m.W=n.W.map((w,j)=>w.map((wi,i)=>wi+rate*blame[j]*x[i]));m.th=n.th.map((th,j)=>th-rate*blame[j]);
  return{x:x.slice(),t,f,err,blame,before:n,after:m};
}

// Tek bir nöronun bu tabloyu en fazla kaç doğruyla yapabildiği (kaba arama). XOR için 3 çıkar.
function bestScore(target,lo=-2,hi=2,step=0.1){
  let best=0;
  for(let a=lo;a<=hi+EPS;a+=step)for(let b=lo;b<=hi+EPS;b+=step)for(let t=lo;t<=hi+EPS;t+=step){
    const s=score([tidy(a),tidy(b)],tidy(t),target);if(s>best){best=s;if(best===4)return 4;}
  }
  return best;
}

// Sayıyı Türkçe biçimde yazar: 0.5 -> "0,5", -1 -> "−1"
function num(v,d=1){
  const r=tidy(v),s=Math.abs(r).toFixed(d).replace('.',',');
  return(r<-EPS?'−':'')+s;
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={EPS,tidy,weightedSum,fires,COMBOS,GATES,outputs,score,solves,learnStep,learnRound,bestScore,num,multiOutputs,multiStep,
    sigmoid,rng,netRandom,netZero,netClone,netForward,netOutputs,netSolves,netPattern,netLearnStep};
}
