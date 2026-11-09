"use strict";
/* ------------------------------------------------------------------
   SEVİYE 11: birlikte yanan, birlikte bağlanır (Ela, limon ve çilek)
   Sekiz his nöronu bir halkada; herkes herkese bağlı. Kullanıcı Ela’ya
   bir an yaşatır (birlikte yananlar bağlanır) ya da bir ipucu verir
   (beyin bağlar üzerinden bütünü tamamlar).
   Model: hebbLearn/hebbRecall (neuron.js); hebbLive/hebbCue (levels.js).
------------------------------------------------------------------- */
let hT=0,hTimer=0,hLastStep='';
function hebbResetView(){clearInterval(hTimer);hTimer=0;hT=0;hLastStep='';}
const HZ={cx:250,cy:202,R:126,nr:28};
const hPos=k=>{const a=(112.5+45*k)*Math.PI/180;return[HZ.cx+HZ.R*Math.cos(a),HZ.cy+HZ.R*Math.sin(a)];};
const hIcons=x=>HEBB.feats.filter((f,i)=>x[i]).map(f=>f.icon).join(' ');
const hNames=x=>HEBB.feats.filter((f,i)=>x[i]).map(f=>`${f.icon} ${f.name}`).join(', ');
const hThing=x=>Object.values(HEBB.things).find(t=>hKey(t.x)===hKey(x));
const hN=v=>num(v,2);

function hebbGridHTML(lv){
  const T=HEBB.things;
  return`<section class="bench has-card">
      <div class="bench-card pact">
        <div class="pstep-h"><span class="pdot">1</span> Ela’ya bir an yaşat</div>
        <div class="pbtns"><button class="btn" id="hLim">${T.lim.icon} Limon <small class="dimtxt">dört his birlikte</small></button><button class="btn" id="hCil">${T.cil.icon} Çilek <small class="dimtxt">dört his birlikte</small></button><button class="btn" id="hMix">${T.mix.icon} Çilekli limonata <small class="dimtxt">sekizi birden</small></button></div>
        <div class="pstep-h"><span class="pdot">2</span> Bir ipucu ver: ne hatırlıyor?</div>
        <div class="pbtns"><button class="btn" id="kKoku">👃 Sadece keskin koku</button><button class="btn" id="kKir">🔴 Sadece kırmızı</button><button class="btn" id="kNoisy">🟡 😖 😋 Karışık ipucu</button></div>
        <p class="hint ehint">ya da sahnedeki hislere tıklayıp kendin seç, sonra:</p>
        <div class="pbtns three"><button class="btn small" id="hSelLive">▶ Yaşat</button><button class="btn small" id="hSelCue">💭 İpucu</button><button class="btn ghost small" id="hSelClr">🧽</button></div>
        <p class="pnext" id="hNext" aria-live="polite"></p>
        <div class="bench-more pquick"><button class="btn ghost small" id="hNew">👶 Yeni bebek (bağlar sıfır)</button></div>
      </div>
      <div class="bench-scene"><div class="stage scene-wrap"><svg id="hscene" viewBox="0 0 860 372" role="img" aria-label="Halkada Ela’nın sekiz his nöronu ve aralarındaki bağlar; sağda Ela ve aklından geçenler"></svg></div></div>
      <div class="bench-answer panel" id="hanswer" aria-live="polite"></div>
    </section>
    <section class="strip" id="hstep" aria-live="polite"></section>
    <section class="bench-bottom">
      <div class="panel"><div class="ph"><h3>Bütün bağlar: hafıza burada</h3><span class="pc" id="hMatN"></span></div>
        <div class="llog-wrap"><table class="hmat" id="hmat"></table></div>
        <p class="hint">Her kare iki his arasındaki bağ: koyulaştıkça güçlü. Sol üst köşe limonun, sağ alt köşe çileğin bağları; öbür iki köşe ikisi arasındaki bağlar.</p></div>
      <div class="panel"><h3>Son anlar</h3><div class="llog-wrap"><table class="tt" id="hlog"></table></div></div>
    </section>`;
}

function wireHebb(lv){
  const svg=$('#hscene');
  let h=`<text class="coltitle" x="${HZ.cx}" y="22">Ela’nın beynindeki his nöronları</text>
    <text class="hgrp" x="${HZ.cx-HZ.R-62}" y="${HZ.cy+4}">limonun<tspan x="${HZ.cx-HZ.R-62}" dy="15">hisleri</tspan></text>
    <text class="hgrp" x="${HZ.cx+HZ.R+62}" y="${HZ.cy+4}">çileğin<tspan x="${HZ.cx+HZ.R+62}" dy="15">hisleri</tspan></text>
    <g id="hsyn"></g>`;
  HEBB.feats.forEach((f,k)=>{const[x,y]=hPos(k),a=(112.5+45*k)*Math.PI/180,lx=HZ.cx+(HZ.R+52)*Math.cos(a),ly=HZ.cy+(HZ.R+44)*Math.sin(a);
    h+=`<g class="hnode" id="hn${k}" data-k="${k}" tabindex="0" role="button"><circle class="hsel" id="hs${k}" cx="${x}" cy="${y}" r="${HZ.nr+7}"/><circle class="soma hsoma" id="hc${k}" cx="${x}" cy="${y}" r="${HZ.nr}"/>
      <text class="pemo" x="${x}" y="${y+9}" style="font-size:24px">${f.icon}</text></g>
      <text class="cname" x="${lx}" y="${ly+4}">${esc(f.name)}</text>`;});
  h+=`<text class="pemo" x="700" y="350" style="font-size:58px">👧</text>
    <circle class="hbub-d" cx="690" cy="276" r="5"/><circle class="hbub-d" cx="678" cy="258" r="8"/>
    <rect class="hbub" x="520" y="40" width="326" height="200" rx="24"/>
    <text class="coltitle" x="683" y="66" id="hbT">Ela’nın aklında</text>
    <text class="pemo" id="hbI" x="683" y="134" style="font-size:34px"></text>
    <text class="soma-sub" id="hbS" x="683" y="176" style="font-size:14px"></text>
    <text class="soma-sub" id="hbS2" x="683" y="200" style="font-size:13px;font-weight:500"></text>
    <text class="soma-sub" id="hbStep" x="683" y="226" style="font-size:12px;font-weight:500"></text>`;
  svg.innerHTML=h;
  svg.querySelectorAll('.hnode').forEach(g=>{const tog=()=>{const st=R().st;st.sel=st.sel.slice();st.sel[+g.dataset.k]=st.sel[+g.dataset.k]?0:1;refresh();};
    g.addEventListener('click',tog);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});});
  const T=HEBB.things,one=k=>HEBB.feats.map((f,i)=>i===k?1:0);
  $('#hLim').onclick=()=>hLive(T.lim.x);$('#hCil').onclick=()=>hLive(T.cil.x);$('#hMix').onclick=()=>hLive(T.mix.x);
  $('#kKoku').onclick=()=>hCue(one(2));$('#kKir').onclick=()=>hCue(one(4));$('#kNoisy').onclick=()=>hCue([1,1,0,0,0,1,0,0]);
  $('#hSelLive').onclick=()=>{const s=R().st.sel;if(!s.some(v=>v)){toast('Önce sahnedeki hislerden en az birine tıkla.');return;}hLive(s);};
  $('#hSelCue').onclick=()=>{const s=R().st.sel;if(!s.some(v=>v)){toast('Önce sahnedeki hislerden en az birine tıkla.');return;}hCue(s);};
  $('#hSelClr').onclick=()=>{R().st.sel=[0,0,0,0,0,0,0,0];refresh();};
  $('#hNew').onclick=()=>{hebbResetView();hebbNewBaby(R().st);refresh();toast('Yeni bebek: bütün bağlar sıfır. Görevlerin duruyor.');};
}
function hLive(x){hebbResetView();hebbLive(R().st,x.slice());hT=0;refresh();}
function hCue(cue){
  hebbResetView();const r=hebbCue(R().st,cue.slice());if(!r)return;
  hT=reducedMotion?r.steps.length-1:0;refresh();
  if(!reducedMotion&&r.steps.length>1)hTimer=setInterval(()=>{hT++;if(hT>=r.steps.length-1){clearInterval(hTimer);hTimer=0;hT=r.steps.length-1;}if(R().st.last===r)refresh();else{clearInterval(hTimer);hTimer=0;}},650);
}

function hSuggest(lv,rec){
  const st=rec.st,T=HEBB.things,act=rec.done.length===lv.missions.length?null:rec.active;
  const lim=hebbMinIn(st.W,T.lim.x),cil=hebbMinIn(st.W,T.cil.x),cross=hebbMinCross(st.W,T.lim.x,T.cil.x),k=v=>Math.round(v/HEBB.rate);
  const needLim=need=>lim<need?{ids:['hLim'],m:`Önce limon: <b>🍋 Limon</b>. (${k(lim)}/4)`}:null;
  const mixed=cross>=0.5?{ids:['hNew'],m:'Limon ve çilek birbirine bağlanmış (çilekli limonata). Bu görev için <b>👶 Yeni bebek</b> al.'}:null;
  if(act==='wire')return{ids:['hLim'],m:`Şimdi <b>🍋 Limon</b>: Ela limonu görüyor, tadıyor, kokluyor, tutuyor. (${k(lim)}/4)`};
  if(act==='complete')return mixed||needLim(0.75)||{ids:['kKoku'],m:'Şimdi Ela’nın gözleri kapalı: sadece <b>👃 keskin koku</b> ver. Hangi nöronlar yanacak?'};
  if(act==='two'){if(mixed)return mixed;const l=needLim(0.99);if(l)return l;
    if(cil<0.99)return{ids:['hCil'],m:`Şimdi <b>🍓 Çilek</b>. (${k(cil)}/4)`};
    return{ids:['kKir'],m:'İki meyve de öğrenildi. Şimdi sadece <b>🔴 kırmızı</b> ipucunu ver.'};}
  if(act==='clean')return mixed||needLim(0.99)||{ids:['kNoisy'],m:'Şimdi <b>🟡 😖 😋 Karışık ipucu</b>: sarı ve ekşi limondan, tatlı başka yerden.'};
  if(act==='mix'){const l=needLim(0.75);if(l)return l;
    if(cross<0.75)return{ids:['hMix'],m:`Şimdi <b>🍋🍓 Çilekli limonata</b>: sekiz his birden. (${k(cross)}/3)`};
    return{ids:['kKoku'],m:'Şimdi yine sadece <b>👃 keskin koku</b> ver. Bu sefer ne gelecek?'};}
  return{ids:[],m:'Serbest deneme: sahnedeki hislere tıklayıp kendi anını kur (ör. sarı + tatlı + yumuşak: muz?). <b>▶ Yaşat</b> ile öğret, <b>💭 İpucu</b> ile hatırlat.'};
}

function updateHebb(lv,rec){
  const st=rec.st,r=st.last,sug=hSuggest(lv,rec);
  ['hLim','hCil','hMix','kKoku','kKir','kNoisy','hSelLive','hSelCue','hSelClr','hNew'].forEach(id=>$('#'+id).classList.toggle('psug',sug.ids.includes(id)));
  $('#hNext').innerHTML=sug.m;
  const any=st.sel.some(v=>v);['hSelLive','hSelCue','hSelClr'].forEach(id=>$('#'+id).disabled=!any);
  // şu an gösterilen etkinlik
  const act=!r?Array(8).fill(0):r.type==='live'?r.x:r.steps[Math.min(hT,r.steps.length-1)];
  const cue=r&&r.type==='recall'?r.cue:null;
  let syn='';
  for(let i=0;i<8;i++)for(let j=i+1;j<8;j++){const w=st.W[i][j];if(w<0.02)continue;const[a,b]=[hPos(i),hPos(j)],both=act[i]&&act[j];
    syn+=`<line class="hsyn${both?' on':''}" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" style="stroke-width:${(1+6*w).toFixed(1)};opacity:${(0.25+0.75*w).toFixed(2)}"/>`;}
  $('#hsyn').innerHTML=syn;
  HEBB.feats.forEach((f,k)=>{
    $('#hc'+k).setAttribute('class','soma hsoma'+(act[k]?' on':'')+(cue&&cue[k]?' cue':'')+(cue&&!cue[k]&&act[k]?' added':''));
    $('#hs'+k).setAttribute('class','hsel'+(st.sel[k]?' on':''));
    $('#hn'+k).setAttribute('aria-label',`${f.name}: ${act[k]?'yanık':'sönük'}${st.sel[k]?', seçili':''}. Seç ya da bırak`);
    $('#hn'+k).setAttribute('aria-pressed',st.sel[k]?'true':'false');
  });
  // Ela’nın aklı
  const th=hThing(act);
  if(!r){$('#hbT').textContent='Ela’nın aklında';$('#hbI').textContent='💭';$('#hbS').textContent='henüz bir şey yok';$('#hbS2').textContent='';$('#hbStep').textContent='';}
  else if(r.type==='live'){$('#hbT').textContent='Ela şu an yaşıyor';$('#hbI').textContent=hIcons(r.x);$('#hbI').style.fontSize=r.x.filter(v=>v).length>5?'24px':'34px';$('#hbS').textContent=th?`(senin bildiğin adıyla: ${th.name} ${th.icon})`:'';$('#hbS2').textContent='birlikte yananlar bağlanıyor';$('#hbStep').textContent='';}
  else{const fin=hT>=r.steps.length-1,added=act.filter((v,i)=>v&&!r.cue[i]).length;
    $('#hbT').textContent='Ela’nın aklına gelen';$('#hbI').textContent=hIcons(act)||'…';$('#hbI').style.fontSize=act.filter(v=>v).length>5?'24px':'34px';
    $('#hbS').textContent=th?`(senin bildiğin adıyla: ${th.name} ${th.icon})`:added?'':'hiçbir şey eklenmedi';
    $('#hbS2').textContent=act[1]&&!r.cue[1]?'🤤 tadına bakmadan ağzı sulandı':act[5]&&!r.cue[5]?'😋 tatlı tadı aklına geldi':'';
    $('#hbStep').textContent=hT===0?'ipucu geldi…':fin?`${r.steps.length-1}. adımda durdu`:`${hT}. adım…`;}
  hAnswer(st,r,act);hStep(rec);hMat(st,act);hLog(st);
}

function hAnswer(st,r,act){
  const el=$('#hanswer');
  if(!r){el.innerHTML=`<div class="ans-l">Ela ne hatırlıyor?</div><div class="ans-big">…</div><div class="ans-sub">Henüz bir an yaşamadı.</div>`;return;}
  if(r.type==='live'){const th=hThing(r.x),pairs=r.x.filter(v=>v).length;
    el.innerHTML=`<div class="ans-l">Ela ne yaşıyor?</div><div class="ans-big hbig">${hIcons(r.x)}</div><div class="ans-sub">${th?`${th.icon} ${th.name}: `:''}${pairs} his aynı anda</div>
      <div class="ans-v ok">${pairs*(pairs-1)/2} bağ güçlendi (+0,25)</div>
      <div class="calc"><div class="cl">birlikte yanan iki his: bağ += 0,25</div><div class="cl">hatırlarken: ortalama destek ≥ %60 → yanar</div></div>`;return;}
  const fin=r.fin,added=fin.map((v,i)=>v&&!r.cue[i]?1:0),dropped=r.cue.map((v,i)=>v&&!fin[i]?1:0),th=hThing(fin);
  el.innerHTML=`<div class="ans-l">Ela ne hatırlıyor?</div><div class="ans-big hbig">${hIcons(fin)||'—'}</div><div class="ans-sub">${th?`${th.icon} ${th.name}`:added.some(v=>v)?'karışık bir şey':'ipucunun ötesinde hiçbir şey'}</div>
    <div class="hlist"><div><span>Sen verdin</span><b>${hIcons(r.cue)}</b></div>
      <div class="${added.some(v=>v)?'ok':''}"><span>Beyni tamamladı</span><b>${hIcons(added)||'—'}</b></div>
      ${dropped.some(v=>v)?`<div class="bad"><span>Söndü</span><b>${hIcons(dropped)}</b></div>`:''}</div>
    ${added[1]?'<div class="ans-v ok">🤤 tadına bakmadan ağzı sulandı</div>':''}
    <div class="calc"><div class="cl">hatırlarken: ortalama destek ≥ %60 → yanar</div></div>`;
}

function hStep(rec){
  const st=rec.st,r=st.last,el=$('#hstep');
  const key=r?r.seq+'|'+(r.type==='recall'?hT:''):'none';
  if(key===hLastStep)return;hLastStep=key;
  if(!r){el.innerHTML=`<div class="ph-box empty"><div class="ph-b">Henüz bir an yaşanmadı. Soldan <b>🍋 Limon</b>’a bas: dört his aynı anda yanacak ve aralarındaki bağlar güçlenecek. Sonra bir <b>ipucu</b> ver: Ela’nın beyni eksik parçaları tamamlayacak. Aşamalar burada yan yana görünecek.</div></div>`;return;}
  if(r.type==='live'){
    const on=r.x.map((v,i)=>v?i:-1).filter(i=>i>=0),pairs=[];on.forEach((i,a)=>on.slice(a+1).forEach(j=>pairs.push([i,j])));
    const ch=pairs.filter(([i,j])=>r.W[i][j]!==r.W0[i][j]),T=HEBB.things,grp=Object.values(T).find(t=>hKey(t.x)===hKey(r.x)),mn=grp?hebbMinIn(r.W,r.x):null;
    const lines=ch.slice(0,3).map(([i,j])=>`<div class="chg up">${HEBB.feats[i].icon}–${HEBB.feats[j].icon} <b>${hN(r.W0[i][j])} → ${hN(r.W[i][j])}</b></div>`);
    if(ch.length>3)lines.push(`<div class="chg same">… ve ${ch.length-3} bağ daha</div>`);
    if(!ch.length)lines.push('<div class="chg same">Bağlar zaten en güçlü hâlinde (1): değişmedi.</div>');
    el.innerHTML=stripHTML([
      {t:'1 · Yaşadı',h:`<span class="hbig2">${hIcons(r.x)}</span><br>${esc(hNames(r.x))}`},
      {t:'2 · Birlikte yananlar',h:on.length>1?`${on.length} his aynı anda yandı<br>→ <b>${pairs.length} çift</b>`:'Tek bir his: birlikte yanan bir eşi yok, <b>hiçbir bağ değişmez</b>.'},
      {t:'3 · Bağlar güçlendi',h:on.length>1?lines.join(''):'—'},
      {t:'4 · Şimdi',cls:mn!=null&&mn>=0.75?'ok':'',h:mn==null?'Kendi seçtiğin hisler artık birbirine biraz daha bağlı.':mn>=0.75?`Bu grubun en zayıf bağı ${hN(mn)}: artık <b>tek bir parçası bütünü çağırabilir</b>.`:`En zayıf bağ ${hN(mn)}: tek bir parça bütünü çağırmaya henüz yetmez (%60 gerekiyor).`}
    ]);return;
  }
  const s=r.steps,fin=r.fin,boxes=[{t:'1 · İpucu',h:`<span class="hbig2">${hIcons(r.cue)}</span><br>${esc(hNames(r.cue))}`}];
  const diff=(a,b)=>{const on=b.map((v,i)=>v&&!a[i]?i:-1).filter(i=>i>=0),off=b.map((v,i)=>!v&&a[i]?i:-1).filter(i=>i>=0);
    return(on.length?`yandı: <b>${on.map(i=>HEBB.feats[i].icon).join(' ')}</b>`:'')+(on.length&&off.length?'<br>':'')+(off.length?`söndü: <b>${off.map(i=>HEBB.feats[i].icon).join(' ')}</b>`:'')||'değişiklik yok';};
  const shown=Math.min(hT,s.length-1);
  boxes.push({t:'2 · 1. adım',h:shown<1?'<span class="pend">…</span>':s.length>1?`${diff(s[0],s[1])}<br><span class="dimtxt">bağlardan yeterli destek alanlar</span>`:'değişiklik yok'});
  const later=[];for(let t=2;t<s.length&&t<=shown;t++)later.push(`${t}. adım: ${diff(s[t-1],s[t])}${hKey(s[t-1])===hKey(s[t])?', <b>duruldu</b>':''}`);
  boxes.push({t:'3 · Sonraki adımlar',h:shown<2&&s.length>2?'<span class="pend">…</span>':later.join('<br>')||'Başka değişiklik yok: <b>duruldu</b>.'});
  const done=shown>=s.length-1,th=hThing(fin);
  boxes.push({t:'4 · Sonuç',cls:done&&fin.some((v,i)=>v&&!r.cue[i])?'ok':'',h:!done?'<span class="pend">…</span>':`<span class="hbig2">${hIcons(fin)}</span><br>${th?`${th.icon} ${th.name}: ${hKey(r.cue)===hKey(fin)?'zaten tamdı':'tamamlandı'}`:fin.some((v,i)=>v&&!r.cue[i])?'karışık bir anı':'ipucu bir şey çağırmadı (bağlar zayıf)'}`});
  el.innerHTML=stripHTML(boxes);
}

function hMat(st,act){
  const F=HEBB.feats;let n=0;
  let h=`<thead><tr><th></th>${F.map(f=>`<th title="${esc(f.name)}">${f.icon}</th>`).join('')}</tr></thead><tbody>`;
  F.forEach((f,i)=>{h+=`<tr><th title="${esc(f.name)}">${f.icon}</th>`;F.forEach((g,j)=>{const w=st.W[i][j];if(i<j&&w>0.02)n++;
    h+=i===j?'<td class="self"></td>':`<td class="${act[i]&&act[j]?'on':''}" style="--w:${w}" title="${esc(f.name)} – ${esc(g.name)}: ${hN(w)}">${w>0.02?hN(w):''}</td>`;});h+='</tr>';});
  $('#hmat').innerHTML=h+'</tbody>';
  $('#hMatN').textContent=`${n}/28 bağ`;
}
function hLog(st){
  const rows=(st.hist||[]).slice(-6).reverse();
  $('#hlog').innerHTML=`<thead><tr><th>#</th><th>ne oldu</th><th>hisler</th><th>sonuç</th></tr></thead><tbody>${rows.map(e=>`<tr>
    <td class="num">${e.n}</td><td>${e.type==='live'?'▶ yaşadı':'💭 ipucu'}</td><td>${hIcons(e.x)}</td><td>${e.type==='live'?'bağlar güçlendi':hIcons(e.fin)}</td></tr>`).join('')||'<tr><td colspan="4" class="hint">Henüz an yok.</td></tr>'}</tbody>`;
}
