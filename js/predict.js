"use strict";
/* ------------------------------------------------------------------
   SEVİYE 5: tahmin ederek öğrenme (öğretmen yok, bir sonraki an var)
   İşaret gelir → tahmin nöronu ne kadar beklediğini söyler → bir an sonra
   kurabiye gelir ya da gelmez → dopamin nöronu sürprizi bildirir →
   o an gelen işaretlerin bağlantıları sürpriz kadar düzelir.
   Model: predictStep (neuron.js), kurallar ve görev bayrakları: PREDICT,
   predictPlan, predictCommit (levels.js). path.js yardımcılarını kullanır.
------------------------------------------------------------------- */
let pAuto=0,pBusy=false,pAutoN=0,pLastCard='';
const PX={cx:80,cy:[78,188],cs:56,nx:330,ny:133,nr:46,wx:560,wy:40,dx:560,dy:222,dr:34};
const pPct=v=>'%'+Math.round(v*100);
const sg2=v=>(v>0.005?'+':'')+num(v,2);
const cueTxt=x=>PREDICT.cues.filter((c,i)=>x[i]).map(c=>`${c.icon} ${c.short}`).join(' + ');

function predictStop(){
  if(!pAuto)return;clearInterval(pAuto);pAuto=0;
  const b=document.querySelector('#pAuto');if(b){b.textContent='Otomatik ▶';b.setAttribute('aria-pressed','false');}
}
function predictResetView(){pLastCard='';pBusy=false;}

function predictGridHTML(lv){
  return`<section class="bench has-card">
      <div class="bench-card">
        <div class="tcard-wrap" id="pcard"></div>
        <button class="btn primary big" id="pOne">Bir an yaşat</button>
        <div class="bench-more"><button class="btn small" id="pTen">10 an</button><button class="btn small" id="pAuto" aria-pressed="false">Otomatik ▶</button><button class="btn ghost small" id="pReset">Boş beyin</button></div>
        <p class="hint" id="pNext"></p>
        <p class="pwarn" id="pWarn" hidden></p>
      </div>
      <div class="bench-scene"><div class="stage scene-wrap"><svg id="pscene" viewBox="0 0 680 306" role="img" aria-label="İşaretler, tahmin nöronu, olan ve dopamin nöronu"></svg></div>
        <div class="prules"><div class="ans-l">Dünyanın kuralı</div><div class="prule-list" id="prules" role="group" aria-label="Dünyanın kuralı">
          ${PREDICT.order.map(k=>`<button data-k="${k}">${PREDICT.rules[k].label}</button>`).join('')}</div></div>
</div>
      <div class="bench-answer panel" id="panswer" aria-live="polite"></div>
    </section>
    <section class="strip" id="pstep" aria-live="polite"></section>
    <section class="bench-bottom">
      <div class="panel"><div class="ph"><h3>Beklenti ve sürpriz, an an</h3><span class="pc" id="pChartN"></span></div>
        <svg id="pchart" viewBox="0 0 600 206" aria-hidden="true"></svg>
        <p class="hint" id="pChartHint"></p></div>
      <div class="panel"><h3>Bağlantılar ve son anlar</h3>
        <div class="pweights" id="pweights"></div>
        <div class="llog-wrap"><table class="tt" id="plog"></table></div></div>
    </section>`;
}

function wirePredict(lv){
  const svg=$('#pscene');
  let h=`<text class="coltitle" x="${PX.cx}" y="18">İşaretler</text><text class="coltitle" x="205" y="18">Bağlantılar</text>
    <text class="coltitle" x="${PX.nx}" y="18">Tahmin nöronu</text><text class="coltitle" x="${PX.wx}" y="18">Bir an sonra</text>`;
  // öğretme sinyali: dopamin nöronundan bağlantılara geri
  h+=`<path class="teach" id="pteach" d="M${PX.dx-PX.dr-2},${PX.dy+8} C440,300 240,292 205,${PX.cy[1]+10}"/>
    <text class="teach-t" x="340" y="301">sürpriz, bağlantıları ayarlar</text>`;
  PREDICT.cues.forEach((c,i)=>{
    const y=PX.cy[i],x1=PX.cx+PX.cs/2+4,x2=PX.nx-PX.nr-4,y2=PX.ny+(i?14:-14);
    h+=`<line class="syn" id="pe${i}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}"/><line class="flow" id="pf${i}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}"/>
      <text class="wtext" id="pw${i}" x="${(x1+x2)/2}" y="${(y+y2)/2-10}"></text>`;
  });
  h+=`<g id="pdl"></g>`;
  PREDICT.cues.forEach((c,i)=>{const y=PX.cy[i]-PX.cs/2;
    h+=`<g class="pcue" id="pc${i}"><rect class="px-cell" id="pcc${i}" x="${PX.cx-PX.cs/2}" y="${y}" width="${PX.cs}" height="${PX.cs}" rx="12"/>
      <text class="px-state emo small" x="${PX.cx}" y="${y+38}">${c.icon}</text></g>
      <text class="cname" x="${PX.cx}" y="${y+PX.cs+17}">${esc(c.name)}</text>`;});
  // tahmin nöronu → dopamin (−), olan → dopamin (+)
  h+=`<path class="syn neg inh" d="M${PX.nx+PX.nr},${PX.ny+10} C${PX.nx+120},${PX.ny+30} ${PX.dx-90},${PX.dy} ${PX.dx-PX.dr-2},${PX.dy}"/>
    <text class="wtext neg" x="${PX.nx+118}" y="${PX.dy-22}">− beklenti</text>
    <line class="syn pos" x1="${PX.wx}" y1="${PX.wy+92}" x2="${PX.dx}" y2="${PX.dy-PX.dr-2}" style="stroke-width:3"/>
    <text class="wtext pos" x="${PX.wx+12}" y="${PX.wy+122}" style="text-anchor:start">+ olan</text>`;
  h+=`<circle class="soma pnode" id="pn" cx="${PX.nx}" cy="${PX.ny}" r="${PX.nr}"/>
    <text class="soma-t big" id="pnv" x="${PX.nx}" y="${PX.ny+8}"></text>
    <text class="soma-sub" id="pns" x="${PX.nx}" y="${PX.ny+PX.nr+20}">beklenti</text>`;
  h+=`<rect class="pworld" id="pwb" x="${PX.wx-50}" y="${PX.wy}" width="100" height="90" rx="14"/>
    <text class="px-state emo" id="pwe" x="${PX.wx}" y="${PX.wy+54}"></text><text class="soma-sub" id="pwt" x="${PX.wx}" y="${PX.wy+80}" style="font-size:12px"></text>`;
  h+=`<circle class="soma dopa" id="pd" cx="${PX.dx}" cy="${PX.dy}" r="${PX.dr}"/>
    <text class="soma-t" id="pdv" x="${PX.dx}" y="${PX.dy+5}"></text>
    <g id="pspk"></g><text class="soma-sub" x="${PX.dx}" y="296" style="font-size:12px">dopamin nöronu (sürpriz)</text>`;
  svg.innerHTML=h;
  document.querySelectorAll('#prules button').forEach(b=>b.onclick=()=>{if(pBusy)return;predictStop();R().st.rule=b.dataset.k;refresh();});
  $('#pOne').onclick=()=>pLive(true);
  $('#pTen').onclick=()=>{if(pBusy)return;predictStop();for(let k=0;k<10;k++)pLive(false,true);refresh();};
  $('#pAuto').onclick=()=>{
    if(pAuto){predictStop();return;}
    const b=$('#pAuto');b.textContent='Durdur ⏸';b.setAttribute('aria-pressed','true');pAutoN=0;
    pAuto=setInterval(()=>{if(pBusy)return;pLive(false);pAutoN++;
      const hs=R().st.hist.slice(-3);
      if(hs.length===3&&hs.every(e=>Math.abs(e.d)<0.03)){predictStop();toast('Sürpriz kalmadı: öğrenecek bir şey yok. Kendiliğinden durdu.');}
      else if(pAutoN>=40){predictStop();toast('40 an yaşandı; otomatik durdu.');}
    },reducedMotion?450:380);
  };
  $('#pReset').onclick=()=>{
    if(pBusy)return;predictStop();const st=R().st;
    st.w=[0,0];st.runRule=null;st.run=0;st.hist=[];R().last=null;
    refresh();toast('Boş beyin: iki bağlantı da 0. Görevlerin duruyor.');
  };
}

// Bir an: staged=true ise önce tahmin, bir an sonra olan görünür
function pLive(staged,silent){
  if(pBusy)return;
  const rec=R(),st=rec.st,r=predictPlan(st,Math.random);
  rec.cardSeq=(rec.cardSeq||0)+1;
  if(staged&&!reducedMotion){
    pBusy=true;rec.last=Object.assign({pending:true},r);refresh();
    setTimeout(()=>{pBusy=false;if(R()!==rec)return;rec.last=r;predictCommit(st,r);pShowDeltas(r);refresh();},1100);
    return;
  }
  rec.last=r;predictCommit(st,r);
  if(!silent){pShowDeltas(r);refresh();}
}

function pShowDeltas(r){
  if(reducedMotion||pAuto)return;
  const g=$('#pdl');if(!g)return;
  r.dw.forEach((d,i)=>{if(!r.x[i]||Math.abs(d)<0.005)return;
    const e=$('#pe'+i),x=(+e.getAttribute('x1')+ +e.getAttribute('x2'))/2,y=(+e.getAttribute('y1')+ +e.getAttribute('y2'))/2+20;
    const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
    tx.setAttribute('x',x);tx.setAttribute('y',y);tx.setAttribute('class','delta '+(d>0?'pos':'neg'));tx.textContent=sg2(d);
    g.appendChild(tx);setTimeout(()=>tx.remove(),1800);
  });
}

function updatePredict(lv,rec){
  const st=rec.st,R0=PREDICT.rules[st.rule];
  // görev değişince kuralı da ona göre ayarla
  if(rec.ruleFor!==rec.active){const m=lv.missions.find(x=>x.id===rec.active);if(m&&m.rule&&!pBusy){predictStop();st.rule=m.rule;}rec.ruleFor=rec.active;}
  const r=rec.last,pend=!!(r&&r.pending);
  document.querySelectorAll('#prules button').forEach(b=>{b.setAttribute('aria-pressed',st.rule===b.dataset.k?'true':'false');b.disabled=pBusy;});
  ['pOne','pTen','pReset'].forEach(id=>{$('#'+id).disabled=pBusy;});
  $('#pNext').textContent=`${PREDICT.rules[st.rule].text}. Bir an: işaret gelir, nöron tahmin eder, bir an sonra ne olduğu görülür.`;
  pWarn(lv,rec);
  // sahne: o anki (ya da son) işaretler
  const x=r?r.x:R0.x,shownW=pend?r.w0:st.w;
  PREDICT.cues.forEach((c,i)=>{
    const on=!!x[i],w=shownW[i],aw=Math.min(Math.abs(w),1),kind=Math.abs(w)<1e-9?'zero':w>0?'pos':'neg';
    $('#pcc'+i).style.fill=on?'var(--light)':'var(--surface-2)';$('#pc'+i).classList.toggle('off',!on);
    const e=$('#pe'+i);e.setAttribute('class','syn '+kind);e.style.strokeWidth=kind==='zero'?1.2:(1.4+5*aw);
    const fl=$('#pf'+i);fl.setAttribute('class','flow '+kind);fl.style.opacity=on&&kind!=='zero'?clamp(0.4+aw*0.6,0,1):0;fl.style.strokeWidth=1.4+5*aw;
    const t=$('#pw'+i);t.textContent=kind==='zero'?'bağlantı 0':`bağlantı ${num(w,2)}`;t.setAttribute('class','wtext '+kind);
  });
  const V=r?r.V:weightedSum(R0.x,st.w);
  $('#pn').style.fill=`color-mix(in srgb, var(--light) ${Math.round(clamp(V,0,1)*100)}%, var(--node-off))`;
  $('#pnv').textContent=pPct(V);
  $('#pns').textContent=r&&!pend?`şimdi: ${pPct(weightedSum(r.x,st.w))}`:'beklenti';
  // olan
  const wb=$('#pwb'),we=$('#pwe'),wt=$('#pwt');
  if(!r){we.textContent='❔';wt.textContent='henüz an yok';wb.setAttribute('class','pworld');}
  else if(pend){we.textContent='⏳';wt.textContent='bekleniyor…';wb.setAttribute('class','pworld wait');}
  else{we.textContent=r.r?PREDICT.yes.icon:PREDICT.no.icon;wt.textContent=r.r?'geldi (1)':'gelmedi (0)';wb.setAttribute('class','pworld '+(r.r?'yes':'no'));}
  // dopamin nöronu
  const d=r&&!pend?r.d:0,mood=!r||pend?'':d>0.15?'burst':d<-0.15?'pause':'calm';
  $('#pd').setAttribute('class','soma dopa '+mood);
  $('#pdv').textContent=!r||pend?'…':sg2(d);
  const nT=!r||pend?4:d>=0?Math.round(4+10*d):Math.max(0,Math.round(4*(1+d)));
  let sp='';for(let k=0;k<nT;k++){const xx=PX.dx-55+(nT>1?k*110/(nT-1):55);sp+=`<line class="spk ${mood}" x1="${xx.toFixed(1)}" y1="266" x2="${xx.toFixed(1)}" y2="280"/>`;}
  if(!nT)sp=`<line class="spk-base" x1="${PX.dx-55}" y1="273" x2="${PX.dx+55}" y2="273"/><text class="teach-t" x="${PX.dx}" y="270">sustu</text>`;
  $('#pspk').innerHTML=sp;
  $('#pteach').setAttribute('class','teach'+(r&&!pend&&Math.abs(d)>=0.03?' on':''));
  pAnswer(st);pCard(rec);pStep(lv,rec);pChart(st);pWeights(st);
}

function pWarn(lv,rec){
  const st=rec.st,el=$('#pWarn');let m='';
  if(rec.active==='block'&&!rec.done.includes('block')){
    if(st.rule==='light'&&st.w[1]>0.1)m=`Zil bağlantısı şu an ${num(st.w[1],2)}, sıfır değil. Deneyin temiz olması için önce “Boş beyin”e bas.`;
    else if(st.rule==='both'&&st.runRule==='both'&&!(st.runStart[0]>=0.85&&st.runStart[1]<=0.1))m=`Bu deneme temiz başlamadı (başta ışık ${num(st.runStart[0],2)}, zil ${num(st.runStart[1],2)}). “Boş beyin” → 💡 → hep 🍪 ile ışığı %85’in üstüne çıkar → sonra 💡+🔔.`;
    else if(st.rule==='both'&&st.runRule!=='both'&&st.w[0]<0.85)m=`Işık henüz yeterince öğrenilmedi (${pPct(st.w[0])}). Önce 💡 → hep 🍪 ile %85’in üstüne çıkar.`;
  }
  if(rec.active==='control'&&!rec.done.includes('control')){
    if(st.rule==='both'&&st.runRule==='both'&&!(st.runStart[0]<=0.1&&st.runStart[1]<=0.1))m='Bu deneme boş beyinle başlamadı. “Boş beyin”e bas, sonra doğrudan 💡+🔔 ile devam et.';
    else if(st.runRule!=='both'&&(st.w[0]>0.1||st.w[1]>0.1))m='Kontrol deneyi için önce “Boş beyin”e bas.';
  }
  el.textContent=m;el.hidden=!m;
}

function pAnswer(st){
  const R0=PREDICT.rules[st.rule],V=weightedSum(R0.x,st.w),r=R().last;
  const one=(x,lab)=>`<div class="cl">${lab}: <b data-fl="pa${x.join('')}">${pPct(weightedSum(x,st.w))}</b></div>`;
  $('#panswer').innerHTML=`<div class="ans-l">Sıradaki anda beklenti</div>
    <div class="ans-big ${V>=0.5?'on':''}" data-fl="pbig">${pPct(V)} <small>🍪</small></div>
    <div class="ans-sub">${esc(cueTxt(R0.x))} gelirse kurabiye ne kadar bekleniyor</div>
    ${r&&!r.pending?`<div class="ans-v ${Math.abs(r.d)<0.05?'ok':r.d>0?'ok':'bad'}">son an: beklenti ${pPct(r.V)}, ${r.r?'🍪 geldi':'🍽️ gelmedi'} → sürpriz <b>${sg2(r.d)}</b></div>`:''}
    <div class="calc">${one([1,0],'💡 ışık tek başına')}${one([0,1],'🔔 zil tek başına')}${one([1,1],'💡+🔔 birlikte')}</div>`;
}

function pCard(rec){
  const st=rec.st,r=rec.last,wrap=$('#pcard'),R0=PREDICT.rules[st.rule];
  const x=r?r.x:R0.x,pend=!!(r&&r.pending);
  const cues=PREDICT.cues.map((c,i)=>`<div class="tc-f ${x[i]?'on':'off'}"><span class="tc-i ${x[i]?'':'dim'}" aria-hidden="true">${c.icon}</span><span class="tc-t">${esc(c.name)}</span><span class="tc-k">${x[i]?'var':'yok'}</span></div>`).join('');
  const out=!r?'<span class="pc-o">❔</span>':pend?'<span class="pc-o">⏳</span>':`<span class="pc-o">${r.r?PREDICT.yes.icon:PREDICT.no.icon}</span>`;
  const verdict=!r||pend?'':Math.abs(r.d)<0.05?'ok':r.d>0?'':'bad';
  wrap.innerHTML=`<div class="tcard ${verdict}">
    <div class="tc-top">${r?'Son an':'Sıradaki an'}</div>
    <div class="pc-row"><div class="tc-feats">${cues}</div><span class="pc-arr" aria-hidden="true">→</span>${out}</div>
    <div class="tc-ans">${!r?'Henüz bir an yaşanmadı':pend?`Nöron <b>${pPct(r.V)}</b> bekliyor… bakalım ne olacak`:`${r.r?'Kurabiye geldi':'Kurabiye gelmedi'}: olan <b>${r.r}</b>`}</div>
    <div class="tc-guess">${r&&!pend?`Beklenti ${pPct(r.V)} → sürpriz <b>${sg2(r.d)}</b>`:'Doğru cevabı öğretmen değil, bir an sonrası söyleyecek'}</div>
  </div>`;
  const key='c'+(rec.cardSeq||0)+(pend?'p':'');
  if(key!==pLastCard&&!pAuto&&!reducedMotion&&r&&pend)wrap.firstElementChild.classList.add('deal');
  pLastCard=key;
}

function pStep(lv,rec){
  const r=rec.last,el=$('#pstep');
  if(!r){el.innerHTML=`<div class="ph-box empty"><div class="ph-b">Henüz bir an yaşanmadı. Soldaki <b>“Bir an yaşat”</b>a bas: işaret gelir, tahmin nöronu ne kadar beklediğini söyler, bir an sonra kurabiye gelir ya da gelmez, aradaki fark (sürpriz) bağlantıları düzeltir. Dört aşama burada yan yana görünecek.</div></div>`;return;}
  const pres=PREDICT.cues.map((c,i)=>({c,i})).filter(o=>r.x[o.i]);
  const sumTxt=pres.length>1?pres.map(o=>`${o.c.short} ${num(r.w0[o.i],2)}`).join(' + ')+` = ${num(r.V,2)}`:`${pres[0].c.short} bağlantısı = ${num(r.V,2)}`;
  const boxes=[{t:'1 · Tahmin',h:`${esc(cueTxt(r.x))} geldi<br>beklenti: ${sumTxt}<br>→ nöron kurabiyeyi <b>${pPct(r.V)}</b> bekliyor`}];
  if(r.pending){boxes.push({t:'2 · Bir an sonra',h:'<span class="pend">bekleniyor…</span>'},{t:'3 · Sürpriz',h:'<span class="pend">…</span>'},{t:'4 · Düzelt',h:'<span class="pend">…</span>'});el.innerHTML=stripHTML(boxes);return;}
  boxes.push({t:'2 · Bir an sonra',h:r.r?`🍪 kurabiye geldi<br>olan = <b>1</b>`:`🍽️ kurabiye gelmedi<br>olan = <b>0</b>`});
  const big=Math.abs(r.d)<0.05?'Neredeyse hiç sürpriz yok: zaten biliyordu. Dopamin nöronu sakin.'
    :r.d>0?`${r.d>0.5?'Büyük':'Küçük'} sevindirici sürpriz: dopamin nöronu atış patlaması yaptı.`
    :`${r.d<-0.5?'Büyük':'Küçük'} hayal kırıklığı: dopamin nöronu sustu.`;
  boxes.push({t:'3 · Sürpriz',cls:Math.abs(r.d)<0.05?'ok':r.d>0?'':'bad',h:`olan ${r.r} − beklenti ${num(r.V,2)} = <b>${sg2(r.d)}</b><br>${big}`});
  if(Math.abs(r.d)<0.005){boxes.push({t:'4 · Düzelt',h:'Sürpriz yok → <b>hiçbir bağlantı değişmedi</b>. Öğrenecek bir şey kalmadı.'});el.innerHTML=stripHTML(boxes);return;}
  const lines=PREDICT.cues.map((c,i)=>r.x[i]
    ?`<div class="chg ${r.dw[i]>0?'up':'down'}">${c.icon} ${esc(c.short)} <b>${num(r.w0[i],2)} → ${num(r.w[i],2)}</b> <span class="dimtxt">(0,3 × ${sg2(r.d)})</span></div>`
    :`<div class="chg same">${c.icon} ${esc(c.short)} yoktu: değişmedi</div>`);
  boxes.push({t:'4 · Düzelt',h:lines.join('')});
  el.innerHTML=stripHTML(boxes);
}

function pChart(st){
  const hs=st.hist.slice(-40),svg=$('#pchart'),X0=118,W=472,n=40,bw=W/n;
  const vy=v=>12+(1-clamp(v,0,1.2)/1.2)*66,zy=140,dyS=42;
  let h=`<text class="m-ax lab" x="0" y="${vy(0.5)+4}">beklenti</text><text class="m-ax lab" x="0" y="${zy+4}">sürpriz</text>
    <line class="r-grid" x1="${X0}" x2="${X0+W}" y1="${vy(1)}" y2="${vy(1)}"/><line class="r-grid" x1="${X0}" x2="${X0+W}" y1="${vy(0)}" y2="${vy(0)}"/>
    <text class="m-ax" x="${X0-8}" y="${vy(1)+4}" style="text-anchor:end">%100</text><text class="m-ax" x="${X0-8}" y="${vy(0)+4}" style="text-anchor:end">%0</text>
    <line class="r-grid" x1="${X0}" x2="${X0+W}" y1="${zy}" y2="${zy}"/>
    <text class="m-ax" x="${X0-8}" y="${zy-dyS+4}" style="text-anchor:end">+1</text><text class="m-ax" x="${X0-8}" y="${zy+dyS+4}" style="text-anchor:end">−1</text>`;
  let prev=null,pts=[];
  hs.forEach((e,k)=>{
    const cx=X0+k*bw+bw/2;
    if(e.k!==prev){h+=`<line class="p-sep" x1="${X0+k*bw}" x2="${X0+k*bw}" y1="6" y2="${zy+dyS+4}"/><text class="p-rl" x="${X0+k*bw+3}" y="${zy+dyS+16}">${PREDICT.rules[e.k].label}</text>`;prev=e.k;}
    pts.push(`${cx.toFixed(1)},${vy(e.V).toFixed(1)}`);
    h+=`<circle class="p-out ${e.r?'yes':'no'}" cx="${cx.toFixed(1)}" cy="${vy(e.r).toFixed(1)}" r="3.2"/>`;
    const hgt=Math.abs(e.d)*dyS;
    h+=hgt<0.8?`<rect class="r-zero" x="${(cx-bw/2+1).toFixed(1)}" y="${zy-1}" width="${Math.max(1,bw-2).toFixed(1)}" height="2"/>`
      :`<rect class="p-d ${e.d>0?'up':'down'}" x="${(cx-bw/2+1).toFixed(1)}" y="${(e.d>0?zy-hgt:zy).toFixed(1)}" width="${Math.max(1,bw-2).toFixed(1)}" height="${hgt.toFixed(1)}"/>`;
  });
  if(pts.length)h+=`<polyline class="p-v" points="${pts.join(' ')}"/>`;
  svg.innerHTML=h;
  $('#pChartN').textContent=st.hist.length?`${st.n} an`:'';
  const last=hs[hs.length-1],r3=hs.slice(-3);
  $('#pChartHint').textContent=!hs.length?'Çizgi: her anda nöronun beklentisi. Nokta: gerçekte olan (üstte 🍪 geldi, altta gelmedi). Çubuk: sürpriz (yukarı sevinç, aşağı hayal kırıklığı).'
    :st.rule==='half'&&st.runRule==='half'&&st.run>=6?'Beklenti %50 civarında dolaşıyor; sürpriz çubukları hiç kısalmıyor, çünkü tek tek anlar tahmin edilemiyor.'
    :r3.length===3&&r3.every(e=>Math.abs(e.d)<0.03)?'Sürpriz çubukları kayboldu: beklenti, olanla örtüşüyor. Bundan sonra bağlantılar değişmez.'
    :last&&Math.abs(last.d)>=0.5?'Büyük bir sürpriz: çizgi bir sonraki anda büyük bir adım atacak.'
    :'Sürpriz küçüldükçe çizginin adımları da küçülüyor: öğrenme önce hızlı, sonra yavaş.';
}

function pWeights(st){
  $('#pweights').innerHTML=PREDICT.cues.map((c,i)=>{const w=st.w[i];
    return`<div class="pwt"><span class="pwt-n">${c.icon} ${esc(c.name)} → tahmin</span><span class="pwt-bar"><i style="width:${Math.round(clamp(Math.abs(w),0,1)*100)}%" class="${w<0?'neg':''}"></i></span><b class="num" data-fl="pw${i}">${num(w,2)}</b></div>`;}).join('');
  const rows=st.hist.slice(-6).reverse();
  $('#plog').innerHTML=`<thead><tr><th>#</th><th>işaret</th><th>beklenti</th><th>olan</th><th>sürpriz</th></tr></thead><tbody>${rows.map((e,k)=>`<tr>
    <td class="num">${st.n-k}</td><td>${PREDICT.cues.filter((c,i)=>e.x[i]).map(c=>c.icon).join('')}</td><td class="num">${pPct(e.V)}</td>
    <td>${e.r?'🍪':'🍽️'}</td><td class="num ${Math.abs(e.d)<0.05?'':e.d>0?'mk-ok':'mk-bad'}">${sg2(e.d)}</td></tr>`).join('')||'<tr><td colspan="5" class="hint">Henüz an yok.</td></tr>'}</tbody>`;
}
