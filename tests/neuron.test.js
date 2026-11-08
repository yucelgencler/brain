// Tek nöron ve öğrenme yolu testleri. Çalıştırmak için: node tests/neuron.test.js
"use strict";
const assert=require('assert');
const N=require('../js/neuron.js');
const {LEVELS}=require('../js/levels.js');

let passed=0;
function test(name,fn){fn();passed++;console.log('✓ '+name);}
const lv=k=>LEVELS.find(l=>l.key===k);
const mission=(l,id)=>lv(l).missions.find(m=>m.id===id);
const pair=(w,theta,flags)=>({x:[0,0],w,theta,flags:flags||{}});
function learnUntil(target,rate,maxRounds){
  let w=[0,0],theta=0.5;
  for(let r=1;r<=maxRounds;r++){const o=N.learnRound(w,theta,target,rate);w=o.w;theta=o.theta;if(!o.mistakes)return{w,theta,rounds:r};}
  return null;
}

test('ateşleme eşikte dahil, ondalık hatası yok',()=>{
  assert.strictEqual(N.fires([1],[0.5],0.5),1);
  assert.strictEqual(N.fires([1,1],[0.1,0.2],0.3),1);
  assert.strictEqual(N.fires([1],[0.4],0.5),0);
});
test('VE ve VEYA elle çözülebiliyor',()=>{
  assert.ok(N.solves([0.6,0.6],1,N.GATES.and.target));
  assert.ok(N.solves([1,1],1,N.GATES.or.target));
});
test('öğrenme adımı: sönük ışığın bağlantısı değişmez',()=>{
  const r=N.learnStep([1,0],[0,0],0.5,1,0.2);
  assert.strictEqual(r.err,1);assert.deepStrictEqual(r.dw,[0.2,0]);assert.strictEqual(r.theta,0.3);
});
test('öğrenme adımı: hata yoksa değişiklik yok',()=>{
  const r=N.learnStep([0,0],[0,0],0.5,0,0.2);
  assert.strictEqual(r.err,0);assert.deepStrictEqual(r.w,[0,0]);assert.strictEqual(r.theta,0.5);
});
for(const k of ['and','or','aNotB','nor'])for(const rate of [0.1,0.2,0.5])
  test(`algılayıcı “${N.GATES[k].short}” öğreniyor (hız ${rate})`,()=>{const r=learnUntil(N.GATES[k].target,rate,100);assert.ok(r,'öğrenemedi');assert.ok(N.solves(r.w,r.theta,N.GATES[k].target));});
test('XOR öğrenilemiyor, en fazla 3/4',()=>{
  assert.strictEqual(learnUntil(N.GATES.xor.target,0.2,200),null);
  assert.strictEqual(N.bestScore(N.GATES.xor.target),3);
});
test('sayı biçimi Türkçe',()=>{assert.strictEqual(N.num(0.5),'0,5');assert.strictEqual(N.num(-1.25,2),'−1,25');assert.strictEqual(N.num(-0.00000001),'0,0');});

// Görevlerin kontrolleri bilinen çözümlerle tamamlanabiliyor mu, başlangıçta tamamlanmış mı?
test('seviye 1 görevleri',()=>{
  const st=lv('light').init();
  assert.ok(!mission('light','on').check(st));assert.ok(mission('light','on').check({...st,b:1}));
  assert.ok(!mission('light','dim').check(st));assert.ok(mission('light','dim').check({...st,b:0.4}));
  assert.ok(!mission('light','bright').check(st));assert.ok(mission('light','bright').check({...st,b:1,theta:0.8}));
  assert.ok(mission('light','bright').check({...st,w:[0.7],theta:0.55}));
  assert.ok(!mission('light','cut').check(st));assert.ok(mission('light','cut').check({...st,w:[0]}));
});
test('seviye 2 görevleri başlangıçta açık, çözümle kapanıyor',()=>{
  const s0={...lv('pair').init(),flags:{}};
  for(const m of lv('pair').missions)assert.ok(!m.check(s0),m.id);
  assert.ok(mission('pair','and').check(pair([0.6,0.6],1)));
  assert.ok(mission('pair','or').check(pair([0.6,0.6],0.6)));
  assert.ok(mission('pair','switch').check(pair([0.6,0.6],0.6,{andW:[0.6,0.6]})));
  assert.ok(!mission('pair','switch').check(pair([1,1],1,{andW:[0.6,0.6]})));
});
test('seviye 3 görevleri',()=>{
  const s0={...lv('inhibit').init(),flags:{}};
  for(const m of lv('inhibit').missions)assert.ok(!m.check(s0),m.id);
  assert.ok(mission('inhibit','aNotB').check(pair([1,-1],0.5)));
  assert.ok(mission('inhibit','nor').check(pair([-1,-1],-0.5)));
  assert.ok(mission('inhibit','spont').check(pair([0,0],-0.1)));
});
test('seviye 1–3 çözümleri kaydırıcı aralığında',()=>{
  const inR=(v,[lo,hi])=>v>=lo-1e-9&&v<=hi+1e-9;
  assert.ok(inR(0.8,lv('light').ranges.theta));
  for(const v of [0.6,1])assert.ok(inR(v,lv('pair').ranges.w));
  for(const v of [1,-1,-0.5])assert.ok(inR(v,lv('inhibit').ranges.w)&&inR(v,lv('inhibit').ranges.theta));
});
test('seviye 4–5 başlangıçta hiçbir görev tamamlanmamış',()=>{
  for(const id of ['learn','xor']){const s={...lv(id).init(),flags:{}};for(const m of lv(id).missions)assert.ok(!m.check(s),id+':'+m.id);}
});
test('seviye 4: ilk kart hemen bir hata, VE birkaç turda öğreniliyor',()=>{
  const st=lv('learn').init(),T=N.GATES.and.target;
  const first=N.learnStep(N.COMBOS[0],st.w,st.theta,T[0],st.rate);
  assert.strictEqual(first.err,-1);assert.deepStrictEqual(first.dw,[0,0]);
  let w=st.w,theta=st.theta,r=0;
  for(;r<50;r++){const o=N.learnRound(w,theta,T,st.rate);w=o.w;theta=o.theta;if(!o.mistakes)break;}
  assert.ok(r>=2&&r<50,'tur sayısı '+r);assert.ok(N.solves(w,theta,T));
});
test('yol haritası: numaralar sıralı, hazır seviyeler yerinde',()=>{
  const {ROADMAP}=require('../js/levels.js');
  ROADMAP.forEach((r,i)=>assert.strictEqual(r.id,i+1));
  assert.deepStrictEqual(LEVELS.map(l=>l.id),[1,2,3,4,5,6,7,8]);
  assert.strictEqual(ROADMAP[4].key,'predict');assert.strictEqual(ROADMAP[6].key,'fruit');assert.strictEqual(ROADMAP[10].key,'hebb');
  for(const r of ROADMAP)assert.ok(r.title&&r.part,r.key);
});
test('öğrenme seviyelerinin her hedefi için gerçek hayat durumu var',()=>{
  const {SCENARIOS}=require('../js/levels.js');
  for(const l of LEVELS.filter(l=>l.learning&&l.targets))for(const k of l.targets){
    const sc=SCENARIOS[k];assert.ok(sc,k);
    for(const f of [sc.a.on,sc.a.off,sc.b.on,sc.b.off])assert.ok(f.icon&&f.text,k);
    assert.ok(sc.yes&&sc.no&&sc.title&&sc.short,k);
  }
});
function learnFruit(){
  const L=lv('fruit'),st={...L.init(),flags:{}};
  for(let r=0;r<100;r++){let m=0;for(const c of L.deck){const o=N.multiStep(c.x,st.W,st.th,c.y,st.rate);st.W=o.W;st.th=o.th;if(o.mistakes)m++;}if(!m)return{L,st,rounds:r+1};}
  return null;
}
test('seviye 7: muz ve armut öğreniliyor, görev açıklamaları doğru',()=>{
  const res=learnFruit();assert.ok(res,'öğrenemedi');
  const {L,st}=res,out=x=>N.multiOutputs(x,st.W,st.th);
  for(const c of L.deck)assert.deepStrictEqual(out(c.x),c.y,c.name);
  // muz uzun şekle +, damlaya −; armut tersi
  assert.ok(st.W[0][2]>0&&st.W[0][3]<0&&st.W[1][3]>0&&st.W[1][2]<0);
  // ortak özellikler (sarı, yumuşak) tek başına: hiçbiri
  assert.deepStrictEqual(out([1,0,0,0,0,1]),[0,0]);
  // iki şekil birden: kanıtlar birbirini götürüyor
  assert.deepStrictEqual(out([0,0,1,1,0,0]),[0,0]);
  // ortak özelliklerin bağlantıları sıfır ya da eksi
  for(const k of [0,1])for(const i of [0,5])assert.ok(st.W[k][i]<=1e-9);
});
test('seviye 7: bir nöronun hatası öbürünün bağlantılarına dokunmaz',()=>{
  const o=N.multiStep([1,0,1,0,0,1],[[0,0,0,0,0,0],[0,0,0,0,0,0]],[0.5,-0.5],[1,0],0.2);
  assert.strictEqual(o.per[0].err,1);assert.strictEqual(o.per[1].err,-1);
  const o2=N.multiStep([1,0,1,0,0,1],[[0,0,0,0,0,0],[0,0,0,0,0,0]],[0,1],[1,0],0.2);
  assert.strictEqual(o2.mistakes,0);assert.deepStrictEqual(o2.W,[[0,0,0,0,0,0],[0,0,0,0,0,0]]);
});
test('seviye 7 görevleri başlangıçta açık',()=>{const s={...lv('fruit').init(),flags:{}};for(const m of lv('fruit').missions)assert.ok(!m.check(s),m.id);});
test('seviye 4: başka durumu öğrenince muz unutuluyor',()=>{
  const st=lv('learn').init(),run=(T,w,t)=>{for(let r=0;r<100;r++){const o=N.learnRound(w,t,T,st.rate);w=o.w;t=o.theta;if(!o.mistakes)break;}return[w,t];};
  let [w,t]=run(N.GATES.and.target,st.w,st.theta);assert.ok(N.solves(w,t,N.GATES.and.target));
  [w,t]=run(N.GATES.or.target,w,t);assert.ok(N.solves(w,t,N.GATES.or.target));
  assert.ok(!N.solves(w,t,N.GATES.and.target));
});
const XT=N.GATES.xor.target;
function trainNet(n,rounds){for(let r=1;r<=rounds;r++){N.COMBOS.forEach((x,i)=>{n=N.netLearnStep(x,XT[i],n,2).after;});if(N.netSolves(n,true,XT,0.4))return{n,r};}return{n,r:null};}
test('seviye 8: elle kurulan çözüm duvarı aşıyor, görevler başta açık',()=>{
  const L=lv('two'),st={...L.init(),flags:{}};
  for(const m of L.missions)assert.ok(!m.check(st),m.id);
  st.man={W:[[1,-1],[-1,1]],th:[0.5,0.5],V:[1,1],thO:0.5};
  for(const id of ['g1','g2','wall'])assert.ok(L.missions.find(m=>m.id===id).check(st),id);
  // çözüm kaydırıcı aralığında (−2..2)
  assert.ok(N.netSolves(st.man,false,XT));
});
test('seviye 8: “Rastgele başlat” başlangıçlarının hepsi takılmadan öğreniyor',()=>{
  const {NET_SEEDS}=require('../js/levels.js');
  for(const sd of NET_SEEDS){const {r}=trainNet(N.netRandom(sd),400);assert.ok(r,'takıldı: '+sd);}
  assert.strictEqual(NET_SEEDS[0],lv('two').init().seed);
});
test('seviye 8: tamamen sıfırdan başlayınca ara nöronlar ikiz kalıyor',()=>{
  const {n,r}=trainNet(N.netZero(),300);
  assert.strictEqual(r,null);
  assert.ok(Math.abs(n.W[0][0]-n.W[1][0])<1e-9&&Math.abs(n.W[0][1]-n.W[1][1])<1e-9&&Math.abs(n.th[0]-n.th[1])<1e-9);
});
test('seviye 8: geri yayılım, lambaya bağlantısı 0 olan ara nörona pay vermez',()=>{
  const n={W:[[0.3,-0.2],[0.1,0.4]],th:[0.1,-0.1],V:[0,1.5],thO:0.2};
  const s=N.netLearnStep([1,1],0,n,2);
  assert.ok(s.blame[0]===0);assert.deepStrictEqual(s.after.W[0],n.W[0]);assert.ok(s.blame[1]!==0);
});
test('seviye 8: başlangıç 7 senden farklı bir çözüm buluyor (görev açıklaması)',()=>{
  const {n}=trainNet(N.netRandom(7),400),pats=[N.netPattern(n,true,0),N.netPattern(n,true,1)].sort().join('|');
  assert.notStrictEqual(pats,['0010','0100'].join('|'));
});

/* ---------- Seviye 5: tahmin ederek öğrenme ---------- */
const {PREDICT,predictPlan,predictCommit}=require('../js/levels.js');
const pFresh=()=>Object.assign(lv('predict').init(),{flags:{}});
const pRun=(st,rule,n,rand)=>{st.rule=rule;const out=[];for(let i=0;i<n;i++)out.push(predictCommit(st,predictPlan(st,rand||Math.random)));return out;};
const pDone=st=>lv('predict').missions.filter(m=>m.check(st)).map(m=>m.id);
test('seviye 5: sürpriz = olan − beklenti; sadece o an gelen işaretin bağlantısı değişir',()=>{
  const s=N.predictStep([0,1],[0.4,0.5],1,0.3);
  assert.strictEqual(s.V,0.5);assert.strictEqual(s.d,0.5);assert.deepStrictEqual(s.w,[0.4,0.65]);
  const z=N.predictStep([1,0],[0.4,0.5],0.4,0.3);assert.strictEqual(z.d,0);assert.deepStrictEqual(z.w,[0.4,0.5]);
});
test('seviye 5: sürpriz her anda küçülüyor, 7 anda %90’ı geçiyor (deeper’daki sayılar)',()=>{
  const st=pFresh(),rs=pRun(st,'always',7);
  for(let i=1;i<rs.length;i++)assert.ok(rs[i].d<rs[i-1].d);
  assert.deepStrictEqual(rs.slice(0,4).map(r=>Math.round(r.w[1]*100)/100),[0.3,0.51,0.66,0.76]);
  assert.ok(st.w[1]>=0.9&&rs[5].w[1]<0.9);assert.deepStrictEqual(pDone(st),['learn']);
});
test('seviye 5: görevler sırayla tamamlanabiliyor; engellemede zil öğrenmiyor, kontrolde öğreniyor',()=>{
  const st=pFresh();let k=0;const alt=()=>(k++%2)?0.9:0.1;
  pRun(st,'always',7);pRun(st,'never',1);assert.ok(pDone(st).includes('miss'));
  pRun(st,'never',4);assert.ok(pDone(st).includes('extinct'));
  pRun(st,'half',20,alt);assert.ok(pDone(st).includes('half'));assert.ok(st.w[1]>0.3&&st.w[1]<0.7);
  st.w=[0,0];st.runRule=null;pRun(st,'light',7);pRun(st,'both',8);
  assert.ok(pDone(st).includes('block'));assert.ok(st.flags.blockBell<0.06,'zil '+st.flags.blockBell);
  st.w=[0,0];st.runRule=null;pRun(st,'both',8);
  assert.ok(pDone(st).includes('control'));assert.ok(Math.abs(st.flags.controlBell-0.5)<0.01);
  assert.strictEqual(pDone(st).length,6);
});
test('seviye 5: temiz başlamayan engelleme denemesi sayılmıyor',()=>{
  const st=pFresh();pRun(st,'always',5);pRun(st,'light',7);pRun(st,'both',10);
  assert.ok(!st.flags.blocked&&!st.flags.control);
});
test('seviye 5: görevlerdeki kurallar tanımlı',()=>{
  for(const m of lv('predict').missions)assert.ok(PREDICT.rules[m.rule],m.id);
  assert.deepStrictEqual(PREDICT.order.slice().sort(),Object.keys(PREDICT.rules).sort());
});
console.log(`\n${passed} test geçti.`);
