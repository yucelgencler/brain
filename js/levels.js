"use strict";
/* ------------------------------------------------------------------
   ÖĞRENME YOLU: seviyelerin içeriği ve görev kontrolleri. Arayüzden bağımsız.

   Bir seviye:
     id, part (bölüm), title, question
     kind: 'single' (tek ışık) | 'pair' (iki ışık: A ve B)
     learning: true ise öğrenme paneli açılır
     ranges: kaydırıcı aralıkları, init(): başlangıç durumu
     goal: seviyenin amacı, todo: “bu sayfada ne yapacaksın” adımları
     targets: (öğrenme seviyelerinde) seçilebilen istenen davranışlar
     missions: [{id, text, target?, check(st), aha}]  -> aha, görev tamamlanınca görünen açıklama
     cards: {brain, model, limit, ai}, deeper: "Daha derine" (HTML)

   Durum (st): single -> {b, w:[w], theta}; pair -> {x:[a,b], w:[w1,w2], theta, targetKey, target, flags}
------------------------------------------------------------------- */
const NN=(typeof module!=='undefined'&&module.exports)?require('./neuron.js'):{fires,solves,score,GATES,COMBOS,num,tidy};

const PARTS=[
  {id:'A',title:'Algı',sub:'tek bir nöron'},
  {id:'B',title:'Öğrenme',sub:'hatadan düzeltme'},
  {id:'C',title:'Anlama',sub:'gizli nöronlar'},
  {id:'D',title:'Hafıza',sub:'bilgi nerede saklanır'},
  {id:'E',title:'Anlam',sub:'kelimeler ve okuma'}
];

const sameW=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<1e-6);

const LEVELS=[
/* ------------------------------ 1 ------------------------------ */
{
  id:1,goal:"Bir nöronun girdiyi nasıl bir karara (ateşle ya da sus) çevirdiğini görmek.",
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
  id:2,goal:"Bir nöronun birden çok sinyali toplayarak nasıl tek bir karar verdiğini görmek.",
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
  id:3,goal:"Bir sinyalin nöronu susturabildiğini ve bir hücrenin bir şeyin yokluğunu bile fark edebildiğini görmek.",
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
  id:4,ver:2,goal:"Doğru bağlantıların kimse elle ayarlamadan, örnekler ve geri bildirimle nasıl ortaya çıktığını görmek. Öğrenmek, bağlantıların ayarlanmasıdır; hafıza, bu ayarın kalıcı olmasıdır.",
  todo:["Sağdaki tablo öğretmenin elindeki eğitim verisi: 4 kart, her kartta bir girdi ve doğru cevap. Örneğin A = kabuğu sarı mı, B = dokununca yumuşak mı, doğru cevap = muz olgun mu (ikisi birden).", "“Bir örnek göster”e tekrar tekrar bas. Her basışta öğretmen bir kart gösterir; nöron tahmin eder, yanılırsa bağlantıları biraz düzeltilir. Ne değiştiği her adımda yazıyor.", "Hatalar bitene kadar devam et. İlerledikçe yeni düğmeler açılacak."],
  part:'B',title:'Kendi kendine öğrenme',
  question:'Kimse bağlantıların kaç olması gerektiğini söylemezse, nöron doğru sayıları kendisi bulabilir mi?',
  kind:'pair',learning:true,
  ranges:{w:[-3,3,0.1],theta:[-3,3,0.1]},
  init(){return{x:[0,0],w:[0,0],theta:0,targetKey:'and',rate:0.2};},
  targets:['and','or','aNotB','nor','custom'],
  missions:[
    {id:'learnAnd',target:'and',text:'Makineye <b>VE</b>’yi öğret. “Bir örnek göster”e basarak her adımda ne değiştiğini izle.',
      check:st=>!!(st.flags.learned&&st.flags.learned.and),
      aha:'Kimse ona bağlantıların kaç olması gerektiğini söylemedi; sadece her örnekte doğru cevabı söyledin. Nöron hatalarından küçük düzeltmeler çıkardı ve bir noktada durdu: artık hata yok, değişiklik de yok.'},
    {id:'zero',text:'Doğru bildiği bir örneği göster. Bağlantılarda ne değişiyor?',
      check:st=>!!st.flags.zeroErr,
      aha:'Hiçbir şey. Hata yoksa öğrenme de yok: bu kural sadece yanıldığında öğrenir. Ayrıca yanılınca bile sadece o örnekte yanan ışıkların bağlantısı değişir; sönük ışık o hatadan sorumlu değil.'},
    {id:'other',text:'Başka bir davranış seç (ör. Karanlık ya da kendi tablon) ve onu da öğret.',
      check:st=>!!st.flags.learned&&Object.keys(st.flags.learned).some(k=>k!=='and'),
      aha:'Aynı kural, hiç değişmeden, yeni bir davranış öğrendi. Kural genel; öğrenilen şey bağlantılarda saklanıyor.'},
    {id:'repair',text:'Öğrendikten sonra bir bağlantıyı elle boz. Sonra yeniden öğret: kendini onarabiliyor mu?',
      check:st=>!!st.flags.repaired,
      aha:'Bozduğun yeri hataları sayesinde yeniden buldu. Öğrenen bir sistem hasarı aynı yoldan onarabilir. Beyindeki iyileşmenin, örneğin felçten sonraki rehabilitasyonun, önemli bir kısmı da yeniden öğrenmedir.'}
  ],
  cards:{
    brain:'Öğrenmenin beyindeki temel izlerinden biri sinapsların güçlenip zayıflamasıdır. Donald Hebb 1949’da birlikte etkin olan nöronlar arasındaki bağlantının güçlendiğini öne sürdü (sonradan “birlikte ateşlenen birlikte bağlanır” diye özetlendi). 1973’te sinapsların tekrarlanan uyarıyla uzun süre güçlendiği gösterildi (uzun süreli güçlenme). Beyin hatadan da öğrenir: beyincik hareket hatalarından, dopamin nöronları ise “beklenenden iyi ya da kötü” sinyallerinden öğrenmeye katkıda bulunuyor gibi görünüyor.',
    model:'Her örnekte üç şey olur: nöron tahmin eder; tahmin istenenle karşılaştırılır; fark varsa yanan ışıkların bağlantıları ve eşik küçük bir adım düzeltilir. Buna algılayıcı (perceptron) kuralı denir. Çözümü olan bir tablo için bir noktada durmayı garanti eder.',
    limit:'Burada her örnekte bir “öğretmen” doğru cevabı söylüyor. Beyin çoğu zaman böyle hazır etiketler almaz; sık sık kendi öğretmeni olur: bir sonraki anı tahmin eder, sonra dünya ne olduğunu gösterir ve aradaki fark geri bildirim olur. Beynin sinapsları tam olarak bu kuralla değiştirdiği de gösterilmiş değil; bu, “hatadan düzeltme” fikrinin en sade hâli.',
    ai:'Tablodaki dört kart, yapay zekâda “etiketli eğitim verisi” diye anılır: her örnek bir girdi ve doğru cevap. Kural 1958’de Frank Rosenblatt’ın algılayıcısıyla ortaya çıktı. Ayrıca eğitimde hiç gösterilmeyen “doğrulama” ya da “sınav” verisiyle modelin ezberleyip ezberlemediği kontrol edilir (10. seviye). Bugünkü bütün yapay sinir ağları aynı fikrin genelleştirilmiş hâliyle eğitilir: tahmin et, hatayı ölç, ağırlıkları hatayı azaltacak yönde biraz değiştir, milyonlarca kez tekrarla.'
  },
  deeper:`<p><b>hata = istenen − çıktı</b>. Üç değer alabilir: <b>+1</b> (sustu ama ateşlemeliydi), <b>−1</b> (boşuna ateşledi), <b>0</b> (doğru).</p>
    <p>Düzeltme: <b>bağlantı += hız × hata × ışık</b> ve <b>eşik −= hız × hata</b>. Işık sönükse (0) çarpım sıfırdır, o bağlantı değişmez.</p>
    <p>Hata +1 ise yanan ışıkların bağlantısı güçlenir ve eşik düşer: nöron bir dahakine daha kolay ateşler. Hata −1 ise tersi olur.</p>
    <p><b>Yakınsama teoremi</b> (Novikoff, 1962): istenen tablo karar haritasında düz bir çizgiyle ayrılabiliyorsa, bu kural sonlu sayıda adımda hatasız bir çözüm bulur ve durur.</p>`
},
/* ------------------------------ 5 ------------------------------ */
{
  id:5,goal:"Tek bir nöronun asla öğrenemeyeceği bir şey olduğunu ve neden birden çok nörona ihtiyaç olduğunu görmek.",
  todo:["Önce elle dene: tablodaki dört satırı tutturmaya çalış.", "Sonra makineye öğret ve tur başına hata sayısını izle.", "“Daha derine”yi açıp nedenini oku."],
  part:'B',title:'Tek nöronun duvarı',
  question:'Tek bir nöronun asla öğrenemeyeceği bir şey var mı?',
  kind:'pair',learning:true,
  ranges:{w:[-3,3,0.1],theta:[-3,3,0.1]},
  init(){return{x:[0,0],w:[0,0],theta:0.5,targetKey:'xor',rate:0.2};},
  targets:['xor'],
  missions:[
    {id:'hand',text:'Elle dene: nöron sadece <b>tam olarak biri yanınca</b> ateşlesin. Dört satırın kaçını tutturabiliyorsun?',
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
}
];

// Henüz hazır olmayan ya da laboratuvarda açılan seviyeler (kenar menüsü için)
const UPCOMING=[
  {id:6,part:'C',title:'İki nöron birlikte',note:'yakında'},
  {id:7,part:'C',title:'Yatay mı dikey mi?',note:'yakında'},
  {id:8,part:'C',title:'Rakamları tanıma',lab:'digits',note:'laboratuvar'},
  {id:9,part:'D',title:'Hafıza nerede?',note:'yakında'},
  {id:10,part:'D',title:'Ezber ve genelleme',note:'yakında'},
  {id:11,part:'D',title:'Unutma ve uyku',note:'yakında'},
  {id:12,part:'E',title:'Kelimeler ve anlam',lab:'words',note:'laboratuvar'},
  {id:13,part:'E',title:'Okuma ve kayma sorunu',lab:'read',note:'laboratuvar'}
];

if(typeof module!=='undefined'&&module.exports){module.exports={PARTS,LEVELS,UPCOMING};}
