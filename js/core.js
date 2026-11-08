"use strict";
/* ------------------------------------------------------------------
   ÇEKİRDEK: sinir ağı, yardımcılar ve görevler (beyin bölgeleri)

   Yeni bir görev eklemek için TASKS dizisine şu arayüzde bir nesne ekle:
     id, short (sekme adı), region (bölge adı), about (açıklama)
     defaults()            -> {hidden, layers, lr, ...görevin ayarları}
     inputLabels(cfg)      -> duyu nöronlarının adları
     outputLabels(cfg)     -> cevap nöronlarının adları
     inputLayout           -> (isteğe bağlı) {cols, rows} ya da cfg => {cols, rows}: girdiyi ızgara çiz
     dataset(cfg)          -> {train:[{x, y, q}], test:[...]}
     encode(q, cfg)        -> sayı dizisi ya da {error}
     parse(text, cfg)      -> soru nesnesi ya da null (soru kutusu için)
     qText(q), truth(q,cfg)-> soru metni, doğru cevap etiketi (ya da null)
     mapPoints(cfg)        -> [{x, text, cls}] kavram haritası noktaları
   Sağ paneldeki arayüz PANELS nesnesinde, görevin id’si ya da kind’ı ile.
------------------------------------------------------------------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function argmax(a){let b=0;for(let i=1;i<a.length;i++)if(a[i]>a[b])b=i;return b;}
function trLower(s){return String(s).toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();}

class Net{
  constructor(sizes,seed,outAct){
    this.sizes=sizes.slice();this.outAct=outAct||'softmax';
    const rnd=mulberry32(seed==null?1:seed);
    this.W=[];this.b=[];
    for(let l=0;l<sizes.length-1;l++){
      const nin=sizes[l],nout=sizes[l+1],lim=Math.sqrt(6/Math.max(1,nin+nout));
      const W=new Float64Array(nin*nout);
      for(let k=0;k<W.length;k++)W[k]=(rnd()*2-1)*lim;
      this.W.push(W);this.b.push(new Float64Array(nout));
    }
    this.resetOpt();
  }
  resetOpt(){
    this.t=0;
    this.mW=this.W.map(w=>new Float64Array(w.length));this.vW=this.W.map(w=>new Float64Array(w.length));
    this.mb=this.b.map(b=>new Float64Array(b.length));this.vb=this.b.map(b=>new Float64Array(b.length));
  }
  // Her katmanın aktivasyonlarını döndürür: [girdi, gizli..., çıktı olasılıkları]
  forward(x){
    const acts=[Float64Array.from(x)],L=this.W.length;
    for(let l=0;l<L;l++){
      const nin=this.sizes[l],nout=this.sizes[l+1],W=this.W[l],b=this.b[l],a=acts[l];
      const z=new Float64Array(nout);
      for(let j=0;j<nout;j++){let s=b[j];const off=j*nin;for(let i=0;i<nin;i++)s+=W[off+i]*a[i];z[j]=s;}
      if(l<L-1){for(let j=0;j<nout;j++)z[j]=Math.tanh(z[j]);}
      else if(this.outAct==='sigmoid'){for(let j=0;j<nout;j++)z[j]=1/(1+Math.exp(-z[j]));}
      else if(nout){let m=-Infinity;for(let j=0;j<nout;j++)if(z[j]>m)m=z[j];let s=0;for(let j=0;j<nout;j++){z[j]=Math.exp(z[j]-m);s+=z[j];}for(let j=0;j<nout;j++)z[j]/=s;}
      acts.push(z);
    }
    return acts;
  }
  predict(x){const a=this.forward(x);return a[a.length-1];}
  // Bir mini-yığın üzerinde geri yayılım + Adam. Ortalama kaybı döndürür.
  trainBatch(batch,lr){
    const L=this.W.length,n=batch.length;
    const gW=this.W.map(w=>new Float64Array(w.length)),gb=this.b.map(b=>new Float64Array(b.length));
    let loss=0;
    for(const ex of batch){
      const acts=this.forward(ex.x),out=acts[L];
      let delta=Float64Array.from(out);
      if(this.outAct==='sigmoid'){for(let j=0;j<out.length;j++){const t=ex.t[j];loss+=-(t*Math.log(Math.max(out[j],1e-12))+(1-t)*Math.log(Math.max(1-out[j],1e-12)));delta[j]-=t;}}
      else{loss+=-Math.log(Math.max(out[ex.y],1e-12));delta[ex.y]-=1;}
      for(let l=L-1;l>=0;l--){
        const nin=this.sizes[l],nout=this.sizes[l+1],a=acts[l],W=this.W[l],g=gW[l],gbl=gb[l];
        const prev=l>0?new Float64Array(nin):null;
        for(let j=0;j<nout;j++){
          const d=delta[j];if(d===0)continue;gbl[j]+=d;const off=j*nin;
          for(let i=0;i<nin;i++){g[off+i]+=d*a[i];if(prev)prev[i]+=W[off+i]*d;}
        }
        if(prev){for(let i=0;i<nin;i++)prev[i]*=(1-a[i]*a[i]);delta=prev;}
      }
    }
    this.t++;
    const b1=0.9,b2=0.999,eps=1e-8,c1=1-Math.pow(b1,this.t),c2=1-Math.pow(b2,this.t),wd=1e-4;
    const step=(p,g,m,v,decay)=>{for(let k=0;k<p.length;k++){const gk=g[k]/n+(decay?wd*p[k]:0);m[k]=b1*m[k]+(1-b1)*gk;v[k]=b2*v[k]+(1-b2)*gk*gk;p[k]-=lr*(m[k]/c1)/(Math.sqrt(v[k]/c2)+eps);}};
    for(let l=0;l<L;l++){step(this.W[l],gW[l],this.mW[l],this.vW[l],true);step(this.b[l],gb[l],this.mb[l],this.vb[l],false);}
    return loss/Math.max(1,n);
  }
  // Yeni duyu/cevap nöronları eklenip çıkarılınca eski bağlantıları etikete göre korur
  resized(oldIn,newIn,oldOut,newOut,seed){
    const sizes=this.sizes.slice();sizes[0]=newIn.length;sizes[sizes.length-1]=newOut.length;
    const net=new Net(sizes,seed,this.outAct),L=this.W.length;
    const inMap=newIn.map(s=>oldIn.indexOf(s)),outMap=newOut.map(s=>oldOut.indexOf(s));
    for(let l=0;l<L;l++){
      const ninN=net.sizes[l],noutN=net.sizes[l+1],ninO=this.sizes[l];
      for(let j=0;j<noutN;j++){
        const jo=l===L-1?outMap[j]:j;if(jo<0)continue;
        net.b[l][j]=this.b[l][jo];
        for(let i=0;i<ninN;i++){const io=l===0?inMap[i]:i;if(io<0)continue;net.W[l][j*ninN+i]=this.W[l][jo*ninO+io];}
      }
    }
    net.resetOpt();return net;
  }
  toJSON(){return{sizes:this.sizes,outAct:this.outAct,W:this.W.map(w=>Array.from(w,v=>Math.round(v*1e5)/1e5)),b:this.b.map(b=>Array.from(b,v=>Math.round(v*1e5)/1e5))};}
  static fromJSON(o){const n=new Net(o.sizes,1,o.outAct);n.W=o.W.map(a=>Float64Array.from(a));n.b=o.b.map(a=>Float64Array.from(a));n.resetOpt();return n;}
}

// İki ana bileşenli PCA (güç yinelemesi). prev: önceki eksenler, işaret kararlılığı için.
function pca2(rows,prev){
  const n=rows.length,d=n?rows[0].length:0;
  if(!n||!d)return{proj:rows.map(()=>[0,0]),comps:null};
  const mean=new Float64Array(d);
  for(const r of rows)for(let k=0;k<d;k++)mean[k]+=r[k]/n;
  const X=rows.map(r=>{const v=new Float64Array(d);for(let k=0;k<d;k++)v[k]=r[k]-mean[k];return v;});
  const C=Array.from({length:d},()=>new Float64Array(d));
  for(const v of X)for(let i=0;i<d;i++){const vi=v[i];if(!vi)continue;const Ci=C[i];for(let j=0;j<d;j++)Ci[j]+=vi*v[j];}
  const comps=[];
  for(let c=0;c<2;c++){
    const usePrev=prev&&prev[c]&&prev[c].length===d;
    let v=new Float64Array(d);for(let k=0;k<d;k++)v[k]=usePrev?prev[c][k]+0.01*Math.sin(k+c):Math.sin(k*1.7+c*2.3)+0.1;
    let lam=0;
    for(let it=0;it<50;it++){
      const w=new Float64Array(d);
      for(let i=0;i<d;i++){let s=0;const Ci=C[i];for(let j=0;j<d;j++)s+=Ci[j]*v[j];w[i]=s;}
      let nrm=0;for(let k=0;k<d;k++)nrm+=w[k]*w[k];nrm=Math.sqrt(nrm);
      if(nrm<1e-12){lam=0;break;}
      for(let k=0;k<d;k++)w[k]/=nrm;v=w;lam=nrm;
    }
    if(usePrev){let dot=0;for(let k=0;k<d;k++)dot+=v[k]*prev[c][k];if(dot<0)for(let k=0;k<d;k++)v[k]=-v[k];}
    comps.push(v);
    for(let i=0;i<d;i++)for(let j=0;j<d;j++)C[i][j]-=lam*v[i]*v[j];
  }
  const proj=X.map(x=>comps.map(c=>{let s=0;for(let k=0;k<d;k++)s+=x[k]*c[k];return s;}));
  return{proj,comps};
}

// Çıktıdan cevabı çıkarır: {idx (sınıf), label, p (güven), alts, win (halkalanacak cevap nöronu)}
function softmaxAnswer(labels,out){
  if(!out.length)return null;
  const order=[...out.keys()].sort((a,b)=>out[b]-out[a]);
  return{idx:order[0],label:labels[order[0]],p:out[order[0]],alts:order.slice(1,3).filter(i=>out[i]>0.01).map(i=>[labels[i],out[i]]),win:order[0]};
}
function taskAnswer(t,cfg,out){return t.answer?t.answer(out,cfg):softmaxAnswer(t.outputLabels(cfg),out);}
function outActOf(t,cfg){return t.outAct?t.outAct(cfg):'softmax';}

/* ---------- Rakamlar: 5×7 piksel ---------- */
const DIGIT_ROWS={
  '0':[" ### ","#   #","#  ##","# # #","##  #","#   #"," ### "],
  '1':["  #  "," ##  ","  #  ","  #  ","  #  ","  #  "," ### "],
  '2':[" ### ","#   #","    #","   # ","  #  "," #   ","#####"],
  '3':["#####","   # ","  #  ","   # ","    #","#   #"," ### "],
  '4':["   # ","  ## "," # # ","#  # ","#####","   # ","   # "],
  '5':["#####","#    ","#### ","    #","    #","#   #"," ### "],
  '6':["  ## "," #   ","#    ","#### ","#   #","#   #"," ### "],
  '7':["#####","    #","   # ","  #  "," #   "," #   "," #   "],
  '8':[" ### ","#   #","#   #"," ### ","#   #","#   #"," ### "],
  '9':[" ### ","#   #","#   #"," ####","    #","   # "," ##  "]
};
const DIGIT_BITS={};
for(const k in DIGIT_ROWS)DIGIT_BITS[k]=DIGIT_ROWS[k].join('').split('').map(c=>c==='#'?1:0);
function noisyBits(bits,flips,rnd){const b=bits.slice();for(let f=0;f<flips;f++){const i=Math.floor(rnd()*b.length);b[i]=1-b[i];}return b;}

const digitTask={
  id:'digits',kind:'digits',short:'Rakamları tanıma',region:'görme bölgesi',
  about:'Gözden gelen ışık, görme korteksinde önce kenar ve çizgi gibi basit parçalara ayrılır; daha derindeki bölgeler bu parçaları “3” gibi bütünlere bağlar. Buradaki 35 piksel retina, gizli nöronlar o ara bölgeler. Hiçbir yerde “3’ün resmi” saklanmıyor: 3, belirli bağlantıların birlikte ateşlenme deseni. Bozuk bir 3 çizdiğinde bile tanıması, beynin eksik deseni tamamlamasına benzer.',
  inputLayout:{cols:5,rows:7},
  defaults(){return{hidden:16,layers:1,lr:0.01,noise:2,custom:[]};},
  inputLabels(){const a=[];for(let r=0;r<7;r++)for(let c=0;c<5;c++)a.push(`piksel ${r+1}. satır ${c+1}. sütun`);return a;},
  outputLabels(cfg){const L=Object.keys(DIGIT_BITS);for(const s of cfg.custom)if(!L.includes(s.label))L.push(s.label);return L;},
  sources(cfg){return[...Object.keys(DIGIT_BITS).map(k=>({label:k,bits:DIGIT_BITS[k]})),...cfg.custom];},
  dataset(cfg){
    const outs=digitTask.outputLabels(cfg),rnd=mulberry32(97+cfg.noise*31+cfg.custom.length*7);
    const train=[],test=[];
    for(const s of digitTask.sources(cfg)){
      const y=outs.indexOf(s.label);
      train.push({x:s.bits.slice(),y,q:{bits:s.bits.slice()}});
      for(let k=0;k<23;k++){const b=noisyBits(s.bits,Math.floor(rnd()*(cfg.noise+1)),rnd);train.push({x:b,y,q:{bits:b}});}
      for(let k=0;k<8;k++){const b=noisyBits(s.bits,Math.max(1,cfg.noise),rnd);test.push({x:b,y,q:{bits:b}});}
    }
    return{train,test};
  },
  encode(q){return q.bits.slice();},
  parse(){return null;},
  qText(){return'Çizdiğin şekil ne?';},
  truth(q,cfg){for(const s of digitTask.sources(cfg))if(s.bits.every((v,i)=>v===q.bits[i]))return s.label;return null;},
  mapPoints(cfg){const outs=digitTask.outputLabels(cfg);return digitTask.sources(cfg).map(s=>({x:s.bits,text:s.label,cls:outs.indexOf(s.label),n:outs.length}));}
};

/* ---------- Aritmetik: toplama, çarpma (ve ileride çıkarma vb.) ---------- */
function makeArithTask(def){
  const nums=[];for(let n=def.min;n<=def.max;n++)nums.push(n);
  const results=[...new Set(nums.flatMap(a=>nums.map(b=>def.op(a,b))))].sort((x,y)=>x-y);
  const outs=results.map(String);
  const thrLabels=results.slice(1).map(v=>'≥ '+v);
  // Miktar kodlamasında cevap da termometredir: “sonuç ≥ k” nöronları
  const target=r=>results.slice(1).map(v=>r>=v?1:0);
  const enc=(a,b,cfg)=>{
    if(cfg.encoding==='thermo'){const t=nums.slice(1);return[...t.map(n=>a>=n?1:0),...t.map(n=>b>=n?1:0)];}
    return[...nums.map(n=>n===a?1:0),...nums.map(n=>n===b?1:0)];
  };
  const task={
    id:def.id,kind:'arith',short:def.short,region:def.region,about:def.about,sym:def.sym,nums,
    defaults(){return{hidden:def.hidden,layers:1,lr:0.01,encoding:'onehot',held:def.held?def.held.slice():[]};},
    inputLabels(cfg){
      if(cfg.encoding==='thermo'){const t=nums.slice(1);return[...t.map(n=>'a ≥ '+n),...t.map(n=>'b ≥ '+n)];}
      return[...nums.map(n=>'a = '+n),...nums.map(n=>'b = '+n)];
    },
    outputLabels(cfg){return cfg&&cfg.encoding==='thermo'?thrLabels:outs;},
    outAct(cfg){return cfg.encoding==='thermo'?'sigmoid':'softmax';},
    answer(out,cfg){
      if(cfg.encoding!=='thermo')return softmaxAnswer(outs,out);
      let c=0;for(const v of out)if(v>0.5)c++;
      let p=1;for(const v of out)p*=Math.max(v,1-v);
      const alts=[];
      if(c<out.length&&out[c]>0.01)alts.push([outs[c+1],out[c]]);
      if(c>0&&1-out[c-1]>0.01)alts.push([outs[c-1],1-out[c-1]]);
      alts.sort((x,y)=>y[1]-x[1]);
      return{idx:c,label:outs[c],p,alts,win:c>0?c-1:-1,count:c};
    },
    encode(q,cfg){
      if(!nums.includes(q.a)||!nums.includes(q.b))return{error:`Bu bölgede yalnızca ${def.min} ile ${def.max} arasındaki sayılar için duyu nöronu var. ${q.a} ${def.sym} ${q.b} sorusunu “duyamıyor”.`};
      return enc(q.a,q.b,cfg);
    },
    dataset(cfg){
      const train=[],test=[];
      for(const a of nums)for(const b of nums){
        const r=def.op(a,b),ex={x:enc(a,b,cfg),y:results.indexOf(r),t:target(r),q:{a,b}};
        (cfg.held.includes(a+','+b)?test:train).push(ex);
      }
      return{train,test};
    },
    parse(text){const m=text.match(def.re);return m?{a:+m[1],b:+m[2]}:null;},
    qText(q){return`${q.a} ${def.sym} ${q.b}`;},
    truth(q){return String(def.op(q.a,q.b));},
    mapPoints(cfg){const pts=[];for(const a of nums)for(const b of nums){const r=def.op(a,b);pts.push({x:enc(a,b,cfg),text:String(r),cls:results.indexOf(r),n:results.length});}return pts;}
  };
  return task;
}
const addTask=makeArithTask({
  id:'add',short:'Toplama',region:'sayı bölgesi',sym:'+',min:0,max:9,hidden:24,op:(a,b)=>a+b,re:/^(\d+)\s*\+\s*(\d+)$/,
  held:['3,5','6,2','7,7','1,8'],
  about:'Beyin sayıları sadece sembol olarak değil, miktar olarak da hisseder: 7, 6’dan biraz fazladır. “Ezber” kodlamasında her sayı birbirinden bağımsız bir nörondur, ağ tabloyu ezberler ve sınava ayrılan (kesik çizgili) soruları çoğu zaman bilemez. “Miktar” kodlamasında hem sorular hem cevaplar termometre gibi dolar; ağ “ne kadar çok” ilişkisini yakalar ve hiç görmediği soruları da bilmeye başlar. Ezberle anlamak arasındaki farkı burada görebilirsin.'
});
const mulTask=makeArithTask({
  id:'mul',short:'Çarpma',region:'sayı bölgesi',sym:'×',min:1,max:9,hidden:32,op:(a,b)=>a*b,re:/^(\d+)\s*×\s*(\d+)$/,
  held:['7,8','4,6','9,3'],
  about:'Çarpım tablosunu çoğumuz kuralla değil ezberle öğreniriz; “7 × 8” duyunca 56 kendiliğinden gelir. Bu bir çağrışım belleğidir. Bu ağ da benzer çalışır: toplamaya göre daha çok nörona ve daha uzun eğitime ihtiyaç duyar, sınava ayrılan sorularda ise çoğunlukla tahmin yürütür. Miktar kodlaması burada toplamadaki kadar yardım etmez, çünkü çarpma basit bir “bir o kadar daha” ilişkisi değildir; sayılar büyüdükçe sonuç hızla sıçrar.'
});

/* ---------- Kelimeler: kelime → anlam ---------- */
const DEFAULT_WORDS=['kedi = hayvan','köpek = hayvan','kuş = hayvan','at = hayvan','elma = meyve','armut = meyve','muz = meyve','çilek = meyve','kırmızı = renk','mavi = renk','yeşil = renk','istanbul = şehir','ankara = şehir','izmir = şehir'].join('\n');
const PAIR_SPLIT=/\s*(?:=|:|→|->)\s*/;
function parsePairs(text){
  const m=new Map();
  for(const line of String(text).split('\n')){
    const parts=line.split(PAIR_SPLIT);if(parts.length<2)continue;
    const w=trLower(parts[0]),c=trLower(parts.slice(1).join(' '));
    if(w&&c)m.set(w,c);
  }
  return[...m].map(([w,c])=>({w,c}));
}
function setPair(text,w,c){
  const lines=String(text).split('\n');let found=false;
  const out=lines.map(line=>{const p=line.split(PAIR_SPLIT);if(p.length>=2&&trLower(p[0])===w){found=true;return`${w} = ${c}`;}return line;});
  if(!found)out.push(`${w} = ${c}`);
  return out.filter((l,i,a)=>l.trim()||i<a.length-1).join('\n');
}
const wordTask={
  id:'words',kind:'words',short:'Kelimeler (duyarak)',region:'dil bölgesi',
  about:'Yeni bir kelime öğrendiğinde beyinde ona özel bir bağlantı ağı kurulur; anlamı, başka kavramlarla ilişkisinden doğar. Burada her kelime bir duyu nöronu, her anlam bir cevap nöronu. Kavram haritasında aynı türdeki kelimelerin eğitim ilerledikçe birbirine yaklaştığını görebilirsin: dil modellerindeki “anlam uzayı” fikrinin küçük bir örneği. Hiç duymadığı bir kelimeyi soramazsın, çünkü onun için henüz bir nöron yok.',
  defaults(){return{hidden:8,layers:1,lr:0.03,text:DEFAULT_WORDS};},
  inputLabels(cfg){return parsePairs(cfg.text).map(p=>p.w);},
  outputLabels(cfg){const s=[];for(const p of parsePairs(cfg.text))if(!s.includes(p.c))s.push(p.c);return s;},
  dataset(cfg){
    const pairs=parsePairs(cfg.text),outs=wordTask.outputLabels(cfg),n=pairs.length;
    return{train:pairs.map((p,i)=>{const x=new Array(n).fill(0);x[i]=1;return{x,y:outs.indexOf(p.c),q:{w:p.w}};}),test:[]};
  },
  encode(q,cfg){const words=wordTask.inputLabels(cfg),i=words.indexOf(q.w);if(i<0)return{error:'unknown'};const x=new Array(words.length).fill(0);x[i]=1;return x;},
  parse(text){return/^[\p{L}][\p{L}\s’'-]*$/u.test(text)?{w:trLower(text)}:null;},
  qText(q){return`“${q.w}” ne?`;},
  truth(q,cfg){const p=parsePairs(cfg.text).find(p=>p.w===q.w);return p?p.c:null;},
  mapPoints(cfg){const outs=wordTask.outputLabels(cfg),pairs=parsePairs(cfg.text);return pairs.map((p,i)=>{const x=new Array(pairs.length).fill(0);x[i]=1;return{x,text:p.w,cls:outs.indexOf(p.c),n:outs.length};});}
};

/* ---------- Okuma: kelimeler piksel resmi olarak ---------- */
// 3×6 piksellik küçük harfler. 1. satır nokta/şapka, 2–5 gövde, 6. satır kuyruk/çengel.
const GLYPHS={
  a:["...",".##","#.#","#.#",".##","..."], b:["#..","#..","##.","#.#","##.","..."], c:["...",".##","#..","#..",".##","..."],
  'ç':["...",".##","#..","#..",".##",".#."], d:["..#","..#",".##","#.#",".##","..."], e:["...",".#.","###","#..",".##","..."],
  f:[".##",".#.","###",".#.",".#.","..."], g:["...",".##","#.#",".##","..#","##."], 'ğ':["###","...",".##","#.#",".##","##."],
  h:["#..","#..","##.","#.#","#.#","..."], 'ı':["...","...",".#.",".#.",".#.","..."], i:[".#.","...",".#.",".#.",".#.","..."],
  j:["..#","...","..#","..#","..#","##."], k:["#..","#..","#.#","##.","#.#","..."], l:[".#.",".#.",".#.",".#.",".##","..."],
  m:["...","##.","###","#.#","#.#","..."], n:["...","##.","#.#","#.#","#.#","..."], o:["...",".#.","#.#","#.#",".#.","..."],
  'ö':["#.#",".#.","#.#","#.#",".#.","..."], p:["...","##.","#.#","##.","#..","#.."], r:["...","#.#","##.","#..","#..","..."],
  s:["...",".##","#..","..#","##.","..."], 'ş':["...",".##","#..","..#","##.",".#."], t:[".#.","###",".#.",".#.","..#","..."],
  u:["...","#.#","#.#","#.#","###","..."], 'ü':["#.#","...","#.#","#.#","###","..."], v:["...","#.#","#.#","#.#",".#.","..."],
  y:["...","#.#","#.#",".##","..#","##."], z:["...","###","..#","#..","###","..."], q:["...",".##","#.#",".##","..#","..#"],
  w:["...","#.#","#.#","###","###","..."], x:["...","#.#",".#.",".#.","#.#","..."], ' ':["...","...","...","...","...","..."],
  '?':["###","..#",".#.","...",".#.","..."]
};
const GLYPH_ALIAS={'â':'a','î':'i','û':'u'};
const READ_ROWS=6;
// Kelimeyi sola yaslı piksel resmine çevirir (harf başına 3 sütun + 1 boşluk)
function renderWord(text,cols){
  const bits=new Array(READ_ROWS*cols).fill(0),letters=Math.floor((cols+1)/4);
  [...String(text).toLocaleLowerCase('tr-TR')].slice(0,letters).forEach((ch,li)=>{
    const g=GLYPHS[GLYPH_ALIAS[ch]||ch]||GLYPHS['?'];
    for(let r=0;r<READ_ROWS;r++)for(let c=0;c<3;c++)if(g[r][c]==='#')bits[r*cols+li*4+c]=1;
  });
  return bits;
}
function fitBits(bits,oldC,newC){
  if(oldC===newC)return bits.slice();
  const out=new Array(READ_ROWS*newC).fill(0);
  for(let r=0;r<READ_ROWS;r++)for(let c=0;c<Math.min(oldC,newC);c++)out[r*newC+c]=bits[r*oldC+c];
  return out;
}
function shiftBits(bits,cols,by){
  const out=new Array(bits.length).fill(0);
  for(let r=0;r<READ_ROWS;r++)for(let c=0;c<cols;c++){const s=c-by;if(s>=0&&s<cols)out[r*cols+c]=bits[r*cols+s];}
  return out;
}
const readTask={
  id:'read',kind:'read',short:'Kelimeler (okuyarak)',region:'görsel kelime bölgesi',
  about:'Okurken önce görme korteksi harfleri birer şekil olarak alır. Beynin sol tarafındaki “görsel kelime biçimi bölgesi” bu şekilleri tanıdık kelimelere bağlar, ardından dil bölgeleri anlamı getirir. Bu bölgede beyin kelimeyi numara olarak değil, piksel resmi olarak görüyor. Bu yüzden sözlükte olmayan kelimeleri de okutabilirsin: “kediler” kediye benziyor mu, bir harfi eksik yazınca ne oluyor? Kelimeyi bir harf kaydırınca beynin neden şaşırdığını da burada görebilirsin.',
  defaults(){return{hidden:16,layers:1,lr:0.01,noise:2,text:DEFAULT_WORDS};},
  letters(cfg){return Math.min(12,Math.max(6,...parsePairs(cfg.text).map(p=>[...p.w].length)));},
  cols(cfg){return readTask.letters(cfg)*4-1;},
  inputLayout(cfg){return{cols:readTask.cols(cfg),rows:READ_ROWS};},
  inputLabels(cfg){const C=readTask.cols(cfg),a=[];for(let r=0;r<READ_ROWS;r++)for(let c=0;c<C;c++)a.push(`piksel ${r+1}. satır ${c+1}. sütun`);return a;},
  outputLabels(cfg){const s=[];for(const p of parsePairs(cfg.text))if(!s.includes(p.c))s.push(p.c);return s;},
  dataset(cfg){
    const pairs=parsePairs(cfg.text),outs=readTask.outputLabels(cfg),C=readTask.cols(cfg),rnd=mulberry32(311+cfg.noise*17+pairs.length*5);
    const train=[],test=[];
    for(const p of pairs){
      const base=renderWord(p.w,C),y=outs.indexOf(p.c);
      train.push({x:base,y,q:{text:p.w}});
      for(let k=0;k<23;k++){const x=noisyBits(base,Math.floor(rnd()*(cfg.noise+1)),rnd);train.push({x,y,q:{edited:true,bits:x,cols:C,base:p.w,mods:['bozulmuş eğitim kartı']}});}
      for(let k=0;k<8;k++){const x=noisyBits(base,Math.max(1,cfg.noise),rnd);test.push({x,y,q:{edited:true,bits:x,cols:C,base:p.w,mods:['sınav kartı']}});}
    }
    return{train,test};
  },
  // q: {text} yazılan kelime ya da {edited, bits, cols} elle/bozularak değiştirilmiş tahta
  encode(q,cfg){const C=readTask.cols(cfg);return q.edited?fitBits(q.bits,q.cols,C):renderWord(q.text,C);},
  parse(text){return/^[\p{L}][\p{L}\s’'-]*$/u.test(text)?{text:trLower(text)}:null;},
  label(q){return q.edited?`${q.base||'tahta'} (${(q.mods||[]).join(', ')})`:q.text;},
  qText(q){return`“${readTask.label(q)}” ne demek?`;},
  truth(q,cfg){const w=q.edited?q.base:trLower(q.text||'');const p=parsePairs(cfg.text).find(p=>p.w===w);return p?p.c:null;},
  mapPoints(cfg){const outs=readTask.outputLabels(cfg),C=readTask.cols(cfg);return parsePairs(cfg.text).map(p=>({x:renderWord(p.w,C),text:p.w,cls:outs.indexOf(p.c),n:outs.length}));}
};

// Toplama ve çarpma şimdilik kapalı; geri açmak için addTask ve mulTask’ı diziye ekle.
const TASKS=[digitTask,wordTask,readTask];

// Serbest metni sadeleştirir: “3 artı 4 kaç eder?” -> “3+4”
function normalizeQ(raw){
  let s=trLower(raw);
  s=s.replace(/[?!.]+$/,'').trim().replace(/\s*=\s*$/,'').replace(/\s+(kaç eder|kaçtır|kaç|eder|nedir|ne)$/,'').trim();
  s=s.replace(/\s*(artı|arti|plus)\s*/g,'+').replace(/\s*(çarpı|carpi|kere|times)\s*/g,'×');
  s=s.replace(/(\d)\s*[x*·]\s*(\d)/g,'$1×$2');
  return s.trim();
}

// Node.js’te test edebilmek için (tarayıcıda etkisiz)
if(typeof module!=='undefined'&&module.exports){
  module.exports={Net,pca2,mulberry32,argmax,trLower,softmaxAnswer,taskAnswer,outActOf,
    digitTask,addTask,mulTask,wordTask,readTask,TASKS,DIGIT_ROWS,DIGIT_BITS,GLYPHS,
    renderWord,shiftBits,fitBits,noisyBits,parsePairs,setPair,normalizeQ};
}
