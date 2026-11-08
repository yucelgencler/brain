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
const tidy=v=>Math.round(v*1e6)/1e6;

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
  module.exports={EPS,tidy,weightedSum,fires,COMBOS,GATES,outputs,score,solves,learnStep,learnRound,bestScore,num};
}
