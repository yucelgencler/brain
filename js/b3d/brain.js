/* Durak 1: bütün beyin (1 birim = 1 cm).
   Kıvrımlar kodla üretilir: gürültünün sıfır çizgileri oluk (sulkus), aradaki tümsekler kıvrım (girus).
   Büyük oluklar (yan yarık, merkez oluk) ve loblar elle yerleştirilir. */
(function(){
'use strict';
const B3=window.B3,{smooth,clamp,lerp}=B3;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

const LOBES={
  frontal:{name:'Alın lobu',color:'#5E8DFF',text:'Planlama, karar verme, dikkat. Arka şeridi hareket kabuğudur: kasları buradan yönetirsin. Sol tarafın alt kısmı (Broca alanı) konuşmayı üretir.'},
  parietal:{name:'Yan lob',color:'#E2B54A',text:'Dokunma ve vücut duyusu (ön şeridi), nesnelerin nerede olduğu, uzay ve dikkat. Gözün gördüğünü elin hareketine bağlar.'},
  temporal:{name:'Şakak lobu',color:'#43D29A',text:'İşitme, nesne ve yüz tanıma, kelimelerin anlamı. İç tarafında anıları kaydeden hipokampus vardır. “Bu bir limon” kararı büyük ölçüde burada verilir.'},
  occipital:{name:'Ense lobu',color:'#FF5D8F',text:'Görme. Gözden gelen ışık sinyalinden önce kenarları, sonra renk, hareket ve biçimi çıkarır. Birincil görme alanı (V1) en arkadadır.'},
  cerebellum:{name:'Beyincik',color:'#B48CFF',text:'Hareketin zamanlaması, denge, beceri. Küçük görünür ama beynin nöronlarının yaklaşık %80’i buradadır (86 milyarın ~69 milyarı).'},
  stem:{name:'Beyin sapı',color:'#8FA3C8',text:'Nefes, kalp atışı, uyanıklık. Beyinle omurilik arasındaki bütün yollar buradan geçer.'}
};

const A=6.35,Bh=4.9,C=8.0,YOFF=0.45;
function hemiShape(side){
  return function(dx,dy,dz,o){
    let x=dx>0?dx*A:dx*A*0.11,y,z=dz*C;
    const fz=Math.max(0,dz),bz=Math.max(0,-dz);
    if(dy>=0){y=dy*Bh*(1-0.13*fz*fz-0.22*bz*bz);}
    else{
      const lat=smooth(-0.15,0.65,dx);
      const temp=smooth(0.6,0.36,dz)*smooth(-1.05,-0.5,dz)*lat;
      y=dy*Bh*(0.38+0.45*temp);
    }
    x*=1-0.16*fz*fz-0.30*bz*bz*bz;
    z*=1-0.05*Math.max(0,dy);
    x+=0.72;
    o[0]=x*side;o[1]=y+YOFF;o[2]=z;
  };
}
/* yan yarık (Sylvius) çizgisi: (z,y) düzleminde */
const S0=[4.4,-0.8],S1=[-2.8,1.15];
function sylv(z,y){
  const dz=S1[0]-S0[0],dy=S1[1]-S0[1],L2=dz*dz+dy*dy;
  const s=clamp(((z-S0[0])*dz+(y-S0[1])*dy)/L2,-0.3,1.3);
  const pz=S0[0]+s*dz,py=S0[1]+s*dy;
  const side=(z-S0[0])*dy-(y-S0[1])*dz;  // >0: çizginin altı (şakak)
  return{d:Math.hypot(z-pz,y-py),s,below:side<0?false:true,lineY:S0[1]+((z-S0[0])/dz)*dy};
}
function centralZ(y){const top=Bh+YOFF;return lerp(-0.7,1.7,clamp((top-y)/(top-1.2),0,1));}

function lobeOf(ax,y,z){
  const sy=sylv(z,y);
  if(z<-5.4+0.25*y)return'occipital';
  if(ax>1.6&&y<sy.lineY-0.15&&z<4.6&&z>-5.6)return'temporal';
  if(y<-0.6&&ax>2.2&&z<4.6&&z>-5.6)return'temporal';
  return z>centralZ(y)?'frontal':'parietal';
}

B3.makeBrainStage=function(ctx){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(ctx.bg);
  const st={id:'brain',name:'Beyin',scene,far:34,near:3.6,unit:0.01,center:V(0,0.2,-0.4),focus:V(),focusDir:V(),home:{yaw:-1.05,pitch:0.3},labels:[],lobe:null};
  st.yaw=st.home.yaw;st.pitch=st.home.pitch;

  scene.add(new THREE.HemisphereLight(0xfff1ee,0x3a2030,0.75));
  const key=new THREE.DirectionalLight(0xffffff,0.95);key.position.set(-6,10,8);scene.add(key);
  const rim=new THREE.DirectionalLight(0x9fb6ff,0.55);rim.position.set(6,-2,-10);scene.add(rim);
  const fill=new THREE.DirectionalLight(0xffd8cc,0.35);fill.position.set(8,2,6);scene.add(fill);

  const GYR=B3.rgb('#e6bcb3'),MID=B3.rgb('#c78f8a'),SUL=B3.rgb('#5e2c3a');
  const group=new THREE.Group();scene.add(group);
  const mats=[];
  function brainMat(){const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.58,metalness:0});mats.push(m);return m;}

  /* --- iki yarım küre --- */
  const hemis=[];
  [-1,1].forEach((side,hi)=>{
    const nz=B3.makeNoise(101+hi*17),nw=B3.makeNoise(202+hi*17),n2=B3.makeNoise(303+hi*17);
    const lob=[];const D=0.6;
    const g=B3.shapedGeometry(7,hemiShape(side),function(x,y,z,nx,ny,nz_,i){
      const ax=Math.abs(x);
      lob[i]=lobeOf(ax,y,z);
      const wx=nw(x*0.22,y*0.22,z*0.22)*0.9,wy=nw(y*0.22+31,z*0.22,x*0.22)*0.9,wz=nw(z*0.22+57,x*0.22,y*0.22)*0.9;
      const a=Math.abs(nz(x*0.5+wx,y*0.5+wy,z*0.5+wz));
      // oluk dar ve derin, kıvrım tepesi yuvarlak (karekök profili)
      let d=-D*(1-Math.sqrt(Math.min(a/0.5,1)));
      const b=Math.abs(n2(x*0.95,y*0.95,z*0.95));
      d+=-0.12*(1-Math.sqrt(Math.min(b/0.3,1)))*smooth(0.15,0.35,a);
      const medial=ax<1.3?smooth(1.3,0.75,ax):0;
      d*=1-0.55*medial;
      // yan yarık
      if(ax>1.2){const sy=sylv(z,y);const wgt=smooth(-0.1,0.06,sy.s)*smooth(1.1,0.85,sy.s)*smooth(1.2,3.0,ax);
        d-=0.95*Math.exp(-((sy.d/0.2)**2))*wgt;}
      // merkez oluk
      if(y>1.0){const zc=centralZ(y)+0.18*nw(y*0.7,3.1,ax*0.3);const dd=Math.abs(z-zc);
        d-=0.62*Math.exp(-((dd/0.24)**2))*smooth(0.6,1.6,y)*smooth(0.4,1.4,ax+ (y>4?1:0));}
      // ense-yan oluğu (üstte kısa çentik)
      if(y>2.6){const dd=Math.abs(z+5.3-0.25*y);d-=0.4*Math.exp(-((dd/0.25)**2))*smooth(2.6,4,y)*smooth(2.2,0.6,ax);}
      return d;
    },function(i,x,y,z,d,c){
      const k=clamp((d+0.55)/0.5,0,1);
      const base=k<0.5?[lerp(SUL[0],MID[0],k*2),lerp(SUL[1],MID[1],k*2),lerp(SUL[2],MID[2],k*2)]:[lerp(MID[0],GYR[0],(k-0.5)*2),lerp(MID[1],GYR[1],(k-0.5)*2),lerp(MID[2],GYR[2],(k-0.5)*2)];
      const v=0.94+0.06*nz(x*2.1+9,y*2.1,z*2.1);
      c[0]=base[0]*v;c[1]=base[1]*v*0.985;c[2]=base[2]*v;
    },side<0);
    const base=new Float32Array(g.attributes.color.array);
    const m=new THREE.Mesh(g,brainMat());group.add(m);
    hemis.push({mesh:m,geo:g,base,lob});
  });

  /* --- beyincik --- */
  {
    const nz=B3.makeNoise(404),lob=[];
    const g=B3.shapedGeometry(6,function(dx,dy,dz,o){
      let x=dx*4.4,y=dy*2.1,z=dz*2.8;
      if(dy>0)y*=0.62;
      z+=0.55*Math.exp(-((x/0.9)**2))*(dz<0?1:0.3);
      o[0]=x;o[1]=y-2.45;o[2]=z-5.0;
    },function(x,y,z,nx,ny,nzz,i){
      lob[i]='cerebellum';
      const s=Math.sin(y*14+1.6*nz(x*0.35,y*0.35,z*0.35)*3+z*0.9);
      return -0.09*Math.pow(Math.max(0,s),4)-0.08*Math.exp(-((x/0.35)**2));
    },function(i,x,y,z,d,c){const k=clamp((d+0.15)/0.15,0,1);c[0]=lerp(0.42,0.83,k);c[1]=lerp(0.22,0.6,k);c[2]=lerp(0.28,0.6,k);});
    const m=new THREE.Mesh(g,brainMat());group.add(m);
    hemis.push({mesh:m,geo:g,base:new Float32Array(g.attributes.color.array),lob});
  }
  /* --- beyin sapı --- */
  {
    const lob=[];
    const g=B3.shapedGeometry(5,function(dx,dy,dz,o){
      let x=dx*0.95,y=dy*2.7,z=dz*0.95;
      const pons=Math.exp(-(((dy-0.25)/0.28)**2));
      x*=1+0.35*pons;z+=(dz>0?0.75:0.15)*pons;
      x*=1-0.25*smooth(0,-1,dy);z*=1-0.2*smooth(0,-1,dy);
      const a=0.38,ca=Math.cos(a),sa=Math.sin(a);
      const yy=y*ca-z*sa,zz=y*sa+z*ca;
      o[0]=x;o[1]=yy-3.4;o[2]=zz-1.5;
    },function(x,y,z,a,b,c,i){lob[i]='stem';return 0;},function(i,x,y,z,d,c){c[0]=0.78;c[1]=0.6;c[2]=0.58;});
    const m=new THREE.Mesh(g,brainMat());group.add(m);
    hemis.push({mesh:m,geo:g,base:new Float32Array(g.attributes.color.array),lob});
  }

  /* --- fare için hafif vekil: yalnız iki yarım küreyle beyincik --- */
  const proxy=new THREE.Group();scene.add(proxy);
  const pmat=new THREE.MeshBasicMaterial({visible:false});
  [-1,1].forEach(side=>{const g=B3.shapedGeometry(4,hemiShape(side),null,null,side<0);const m=new THREE.Mesh(g,pmat);m.userData.side=side;proxy.add(m);});
  {const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),pmat);m.scale.set(4.5,1.9,2.9);m.position.set(0,-2.9,-5.15);m.userData.lobe='cerebellum';proxy.add(m);
   const s=new THREE.Mesh(new THREE.CylinderGeometry(1.2,0.9,6,12),pmat);s.position.set(0,-4.3,-1.0);s.rotation.x=0.38;s.userData.lobe='stem';proxy.add(s);}

  /* --- talamus (içi gösterilince görünür) --- */
  const inner=new THREE.Group();scene.add(inner);inner.visible=false;
  const thMat=new THREE.MeshStandardMaterial({color:0xd99a7a,roughness:0.6,transparent:true,opacity:0.9});
  [-1,1].forEach(s=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),thMat);m.scale.set(0.95,0.85,1.5);m.position.set(1.05*s,-0.7,-0.6);inner.add(m);});

  /* --- yolculuk sahnesi: gözler, limon, yollar --- */
  const P={
    eyeL:V(-3.0,-2.0,9.3),eyeR:V(3.0,-2.0,9.3),chiasm:V(0,-2.5,3.9),lgnL:V(-1.9,-1.0,-0.9),lgnR:V(1.9,-1.0,-0.9),
    v1L:V(-1.1,0.9,-7.6),v1R:V(1.1,0.9,-7.6),itL:V(-5.0,-2.7,-0.4),itR:V(5.0,-2.7,-0.4),
    nose:V(0,-2.9,10.6),bulb:V(-0.7,-1.7,6.1),pir:V(-3.4,-2.2,2.3),
    broca:V(-5.5,0.4,3.7),motor:V(-6.0,2.1,1.4),stem:V(0,-6.6,-1.7),mouth:V(0,-7.4,8.9),lemon:V(0,-1.6,15.2)
  };
  st.P=P;
  const paths={
    vis1L:[P.eyeL,V(-1.9,-2.3,6.6),P.chiasm,V(1.2,-1.9,1.6),P.lgnR],
    vis1R:[P.eyeR,V(1.9,-2.3,6.6),P.chiasm,V(-1.2,-1.9,1.6),P.lgnL],
    vis2L:[P.lgnL,V(-2.2,-0.4,-2.6),V(-2.5,0.2,-5.2),P.v1L],
    vis2R:[P.lgnR,V(2.2,-0.4,-2.6),V(2.5,0.2,-5.2),P.v1R],
    venL:[P.v1L,V(-3.4,-1.2,-5.6),V(-4.7,-2.4,-3.1),P.itL],
    venR:[P.v1R,V(3.4,-1.2,-5.6),V(4.7,-2.4,-3.1),P.itR],
    smell:[P.nose,V(0,-2.4,8.1),P.bulb,V(-2.1,-2.4,4.1),P.pir,P.itL],
    speech:[P.itL,V(-5.5,-1.3,1.9),P.broca],
    motor:[P.broca,V(-5.9,1.4,2.6),P.motor],
    out:[P.motor,V(-3.0,0.2,0.0),V(-1.0,-3.4,-1.3),P.stem,V(0,-7.9,3.5),P.mouth]
  };
  const journey=new THREE.Group();scene.add(journey);journey.visible=false;
  const curves={};
  const pathMat=new THREE.MeshBasicMaterial({color:0x9fd8ff,transparent:true,opacity:0.35,blending:THREE.AdditiveBlending,depthWrite:false});
  for(const k in paths){
    const c=new THREE.CatmullRomCurve3(paths[k],false,'catmullrom',0.4);curves[k]=c;
    const m=new THREE.Mesh(new THREE.TubeGeometry(c,80,0.06,6,false),pathMat);m.visible=false;c.mesh=m;journey.add(m);
  }
  st.curves=curves;
  const eyeMat=new THREE.MeshStandardMaterial({color:0xf4f1ec,roughness:0.3});
  const irisMat=new THREE.MeshStandardMaterial({color:0x3b6e8f,roughness:0.4});
  [P.eyeL,P.eyeR].forEach(p=>{const e=new THREE.Mesh(new THREE.SphereGeometry(1.2,24,16),eyeMat);e.position.copy(p);journey.add(e);
    const ir=new THREE.Mesh(new THREE.SphereGeometry(0.55,16,12),irisMat);ir.position.copy(p).add(V(0,0,0.82));ir.scale.set(1,1,0.45);journey.add(ir);});
  const lemonN=B3.makeNoise(77);
  const lemonGeo=B3.shapedGeometry(4,function(dx,dy,dz,o){const tip=Math.pow(Math.abs(dx),6)*0.45;o[0]=dx*(2.3+tip);o[1]=dy*1.65;o[2]=dz*1.65;},
    function(x,y,z){return 0.04*lemonN(x*3,y*3,z*3);});
  const lemon=new THREE.Mesh(lemonGeo,new THREE.MeshStandardMaterial({color:0xf2d23c,roughness:0.55,emissive:0x2a2200}));
  lemon.position.copy(P.lemon);lemon.rotation.z=0.25;lemon.visible=false;scene.add(lemon);
  st.lemon=lemon;

  /* parlayan darbeler ve bölge ışıkları */
  const glow=new B3.GlowPoints(800);scene.add(glow.mesh);
  st.glow=glow;st.pulses=[];st.spots={};      // spots: ad → {pos,color,until}
  st.xray=false;

  /* --- etiketler --- */
  const lobeLbl=B3.label(ctx.layer,'','lobe');lobeLbl.on=false;st.labels.push(lobeLbl);
  st.spotLabels={};
  function spotLabel(key,text,pos){const l=B3.label(ctx.layer,text,'spot');l.pos.copy(pos);l.on=false;l.maxT=0.3;st.labels.push(l);st.spotLabels[key]=l;}
  spotLabel('eye','göz → retina',V(-3.0,-0.4,9.5));
  spotLabel('lgn','talamus (LGN)',V(-2.2,0.1,-0.9));
  spotLabel('v1','görme alanı (V1)',V(-1.4,2.2,-7.9));
  spotLabel('it','şakak: nesne tanıma',V(-6.2,-3.4,-0.4));
  spotLabel('smell','koku soğancığı',V(-0.9,-3.0,6.4));
  spotLabel('broca','Broca: konuşma planı',V(-6.6,0.9,4.0));
  spotLabel('motor','hareket kabuğu: ağız, dil',V(-6.9,3.0,1.4));
  const say=B3.label(ctx.layer,'“Limon!”','say');say.pos.copy(P.mouth).add(V(0,-0.6,0.8));say.on=false;say.maxT=0.3;st.labels.push(say);st.sayLbl=say;

  /* --- odak: bir lob seçilince oraya dalınır --- */
  const FOCI={
    occipital:{a:V(-1.4,0.9,-6.2),d:V(-0.45,0.3,-1)},
    temporal:{a:V(-4.2,-2.0,0.2),d:V(-1,-0.28,0.12)},
    frontal:{a:V(-3.0,2.6,4.6),d:V(-0.7,0.45,0.6)},
    parietal:{a:V(-3.0,3.6,-2.6),d:V(-0.6,0.8,-0.25)},
    cerebellum:{a:V(-2.0,-3.0,-5.6),d:V(-0.55,-0.25,-0.8)},
    stem:{a:V(0,-4.6,-0.6),d:V(-1,0,0.35)}
  };
  const ray=new THREE.Raycaster();
  st.setFocus=function(lobe){
    const f=FOCI[lobe]||FOCI.occipital;st.focusLobe=lobe;
    const dir=f.d.clone().normalize();
    ray.set(f.a.clone().addScaledVector(dir,30),dir.clone().negate());
    const hit=ray.intersectObjects(hemis.map(h=>h.mesh),false)[0];
    st.focus.copy(hit?hit.point:f.a);st.focusDir.copy(dir);
  };
  st.setFocus('occipital');

  let hoverLobe=null;
  function paint(){
    for(const h of hemis){
      const col=h.geo.attributes.color.array,base=h.base;
      for(let i=0;i<h.lob.length;i++){
        const L=h.lob[i];
        if(L===hoverLobe||L===st.lobe){
          const c=new THREE.Color(LOBES[L].color),k=L===st.lobe?0.5:0.38;
          col[i*3]=lerp(base[i*3],c.r,k);col[i*3+1]=lerp(base[i*3+1],c.g,k);col[i*3+2]=lerp(base[i*3+2],c.b,k);
        }else{col[i*3]=base[i*3];col[i*3+1]=base[i*3+1];col[i*3+2]=base[i*3+2];}
      }
      h.geo.attributes.color.needsUpdate=true;
    }
  }
  st.hover=function(raycaster){
    const hit=raycaster.intersectObjects(proxy.children,false)[0];
    let L=null;
    if(hit){const q=hit.point;L=hit.object.userData.lobe||lobeOf(Math.abs(q.x),q.y,q.z);lobeLbl.pos.copy(q);}
    if(L!==hoverLobe){hoverLobe=L;paint();}
    lobeLbl.on=!!L&&!st.xray;
    if(L)lobeLbl.el.textContent=LOBES[L].name;
    return L;
  };
  st.select=function(L){st.lobe=L;paint();};
  st.LOBES=LOBES;

  st.setXray=function(on){
    st.xray=on;inner.visible=on;
    for(const m of mats){m.transparent=on;m.opacity=on?0.22:1;m.depthWrite=!on;m.needsUpdate=true;}
    if(on){hoverLobe=null;paint();lobeLbl.on=false;}
  };
  st.setJourney=function(on){journey.visible=on;for(const k in curves)curves[k].mesh.visible=false;if(!on){lemon.visible=false;st.pulses.length=0;st.spots={};for(const k in st.spotLabels)st.spotLabels[k].on=false;say.on=false;}};

  /* darbe gönder: path anahtarı, süre (s), renk */
  st.send=function(key,dur,color,count,gap){
    const c=curves[key];c.mesh.visible=true;count=count||5;gap=gap==null?0.12:gap;
    for(let i=0;i<count;i++)st.pulses.push({c,t0:ctx.clock()+i*gap,dur:dur||1.4,col:color||[0.6,0.9,1]});
  };
  st.spot=function(key,pos,color,secs,label){st.spots[key]={pos,col:color,until:ctx.clock()+(secs||1e9)};if(label&&st.spotLabels[label])st.spotLabels[label].on=true;};
  st.unspot=function(key){delete st.spots[key];};

  st.update=function(dt,info){
    const now=ctx.clock();
    glow.clear();
    st.pulses=st.pulses.filter(p=>now<p.t0+p.dur+0.05);
    const tmp=new THREE.Vector3();
    for(const p of st.pulses){
      const u=(now-p.t0)/p.dur;if(u<0||u>1)continue;
      p.c.getPointAt(u,tmp);glow.add(tmp.x,tmp.y,tmp.z,p.col[0],p.col[1],p.col[2],1.3,1);
      for(let k=1;k<5;k++){const uu=u-k*0.012;if(uu<0)break;p.c.getPointAt(uu,tmp);glow.add(tmp.x,tmp.y,tmp.z,p.col[0],p.col[1],p.col[2],1.0-k*0.15,0.5-k*0.09);}
    }
    for(const k in st.spots){const s=st.spots[k];if(now>s.until){delete st.spots[k];continue;}
      const pulse=0.75+0.25*Math.sin(now*5);glow.add(s.pos.x,s.pos.y,s.pos.z,s.col[0],s.col[1],s.col[2],4.2*pulse,0.85);}
    if(lemon.visible)lemon.rotation.y+=dt*0.4;
    glow.commit(info.pxScale);
  };

  st.card=function(){
    return{title:'Beyin',scale:'≈ 15 cm',
      body:'Yaklaşık 1,4 kg ve 86 milyar nöron. Kıvrımlar, kabuğu kafatasına sığdırmak için katlanmış hâlidir: açılsa yaklaşık bir masa örtüsü kadar (≈2.000 cm²) yer kaplar. Bir lobun üzerine gel; tıklayınca o loba yaklaşırsın.',
      ai:'Yapay zekâda bunun karşılığı tek parça bir ağdır; ama beyinde her bölge farklı bir işe uzmanlaşmış ve birbirine kablolarla bağlıdır.'};
  };
  return st;
};
})();
