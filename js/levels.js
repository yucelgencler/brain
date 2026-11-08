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
const NN=(typeof module!=='undefined'&&module.exports)?require('./neuron.js'):{fires,solves,score,GATES,COMBOS,num,tidy,netPattern,netSolves};

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
/* ------------------------------ 5 ------------------------------ */
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
}
];

// Yol haritası: bütün seviyeler sırasıyla. Hazır olanlar LEVELS'ta, ötekiler “yakında” ya da laboratuvarda.
const ROADMAP=[
  {key:'light'},{key:'pair'},{key:'inhibit'},
  {key:'learn'},
  {key:'predict',part:'B',title:'Tahmin ederek öğrenme',note:'yakında',about:'Öğretmen yok; doğru cevabı bir sonraki an veriyor. Sürpriz azaldıkça öğrenme yavaşlıyor.'},
  {key:'xor'},
  {key:'fruit'},
  {key:'two'},
  {key:'lines',part:'C',title:'Yatay mı dikey mi?',note:'yakında',about:'3×3 piksellik çizgiler: gizli nöronların kendiliğinden çizgi dedektörlerine dönüşmesi ve bir nöronun “gördüğü” desen (algı alanı).'},
  {key:'digits',part:'C',title:'Rakamları tanıma',lab:'digits',note:'laboratuvar',about:'5×7 piksellik rakamları daha büyük bir ağla tanımak: kaç gizli nöron yeter, bozuk çizilmiş bir rakamı nasıl tamamlar?'},
  {key:'hebb',part:'D',title:'Birlikte yanan, birlikte bağlanır',note:'yakında',about:'Etiket yok; hep birlikte gelen özellikler birbirine bağlanıp bir “şey” oluşturuyor. Parçası görülünce bütünü tamamlanıyor.'},
  {key:'where',part:'D',title:'Hafıza nerede?',note:'yakında',about:'Öğrenmiş bir ağdan nöron ya da bağlantı silince ne olur? Bilgi tek bir yerde değil, bağlantılara dağılmış; beyin hasarı da çoğu zaman yavaş yavaş bozulma olarak görülür.'},
  {key:'general',part:'D',title:'Ezber ve genelleme',note:'yakında',about:'Eğitimde hiç gösterilmeyen sınav (doğrulama) kartlarıyla: ağ kuralı mı öğrendi, yoksa örnekleri mi ezberledi?'},
  {key:'sleep',part:'D',title:'Unutma ve uyku',note:'yakında',about:'Yeni bir şey öğrenince eskisinin bozulması ve beynin uykuda yaptığı tekrar oynatmanın bunu nasıl önlediği.'},
  {key:'words',part:'E',title:'Kelimeler ve anlam',lab:'words',note:'laboratuvar',about:'Her kelime bir duyu nöronu, her anlam bir cevap nöronu. Eğitim ilerledikçe benzer anlamlı kelimeler gizli katmanda birbirine yaklaşır (anlam uzayı).'},
  {key:'read',part:'E',title:'Okuma ve kayma sorunu',lab:'read',note:'laboratuvar',about:'Kelimeyi piksel resmi olarak okumak: hiç görmediği kelimeleri tahmin etmesi, bir harf kayınca neden şaşırdığı ve paylaşımlı dedektörlerin çözümü.'}
];
ROADMAP.forEach((r,i)=>{r.id=i+1;const lv=LEVELS.find(l=>l.key===r.key);if(lv){lv.id=r.id;r.level=lv;r.part=lv.part;r.title=lv.title;}});

if(typeof module!=='undefined'&&module.exports){module.exports={PARTS,LEVELS,ROADMAP,SCENARIOS,NET_PATTERNS,NET_SEEDS};}
