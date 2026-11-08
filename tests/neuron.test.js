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
  assert.deepStrictEqual(LEVELS.map(l=>l.id),[1,2,3,4,6]);
  assert.strictEqual(ROADMAP[4].key,'predict');assert.strictEqual(ROADMAP[9].key,'hebb');
  for(const r of ROADMAP)assert.ok(r.title&&r.part,r.key);
});
test('öğrenme seviyelerinin her hedefi için gerçek hayat durumu var',()=>{
  const {SCENARIOS}=require('../js/levels.js');
  for(const l of LEVELS.filter(l=>l.learning))for(const k of l.targets){
    const sc=SCENARIOS[k];assert.ok(sc,k);
    for(const f of [sc.a.on,sc.a.off,sc.b.on,sc.b.off])assert.ok(f.icon&&f.text,k);
    assert.ok(sc.yes&&sc.no&&sc.title&&sc.short,k);
  }
});
console.log(`\n${passed} test geçti.`);
