'use strict';
/* ------------------------------------------------------------------
   SÖZLÜK: terimlerin sade açıklamaları. Arayüzden bağımsız.
   Bir terim: { t: terim, d: açıklama, see: ilgili seviyenin key'i (isteğe bağlı), alt: eş anlamlılar }
------------------------------------------------------------------- */
const GLOSSARY = [
  {
    t: 'Nöron',
    alt: ['sinir hücresi'],
    d: 'Beynin bilgi işleyen hücresi. Başka hücrelerden sinyal toplar; toplam yeterince güçlüyse kendisi de bir sinyal gönderir. İnsan beyninde yaklaşık 86 milyar tane var.',
    see: 'light'
  },
  {
    t: 'Sinaps',
    alt: ['bağlantı'],
    d: 'İki nöronun buluştuğu yer. Sinyal buradan kimyasal bir haberciyle karşıya geçer. Bir nöronun binlerce sinapsı olabilir.',
    see: 'light'
  },
  {
    t: 'Bağlantı gücü',
    alt: ['ağırlık', 'sinaps gücü'],
    d: 'Bir sinapsın karşıdaki nöronu ne kadar etkilediği. Güçlü bağlantı sinyali büyütür, zayıf bağlantı küçültür. Öğrenmenin büyük kısmı bu gücün değişmesidir.',
    see: 'learn'
  },
  {
    t: 'Eşik',
    d: 'Bir nöronun ateşlemesi için gelen sinyallerin toplamının ulaşması gereken düzey. Toplam eşiğin altındaysa nöron susar.',
    see: 'light'
  },
  {
    t: 'Ateşleme',
    alt: ['aksiyon potansiyeli', 'sinyal', 'darbe'],
    d: 'Nöronun gönderdiği kısa elektrik darbesi. Aksonu boyunca ilerler ve sinapslardan sonraki nöronlara ulaşır.',
    see: 'light'
  },
  {
    t: 'Ya hep ya hiç',
    d: 'Bir nöron ya tam bir darbe gönderir ya hiç göndermez; “yarım ateşleme” yoktur. Bir şeyin ne kadar güçlü olduğunu darbelerin büyüklüğü değil sıklığı anlatır.',
    see: 'light'
  },
  {
    t: 'Dendrit',
    d: 'Nöronun girdileri topladığı kısa, dallı uzantıları. Başka nöronlardan gelen sinapsların çoğu dendritlerin üzerindedir.',
    see: 'pair'
  },
  {
    t: 'Akson',
    d: 'Nöronun sinyalini uzağa taşıyan tek, uzun uzantısı. Ucunda dallanır ve başka nöronlarla sinaps kurar.',
    see: 'pair'
  },
  {
    t: 'Uyarıcı bağlantı',
    d: 'Karşıdaki nöronu ateşlemeye yaklaştıran bağlantı. Beyinde çoğunlukla glutamat adlı haberciyi kullanır.',
    see: 'pair'
  },
  {
    t: 'Susturan bağlantı',
    alt: ['engelleyici bağlantı', 'baskılayıcı bağlantı'],
    d: 'Karşıdaki nöronu ateşlemekten uzaklaştıran bağlantı. Beyinde çoğunlukla GABA adlı haberciyi kullanır. Susturma olmasa beyin aşırı uyarılırdı.',
    see: 'inhibit'
  },
  {
    t: 'Duyu nöronu',
    alt: ['girdi nöronu'],
    d: 'Dış dünyadan bilgi alan nöron: ışığa, sese, kokuya, dokunmaya tepki verir ve bunu sinyale çevirir.',
    see: 'light'
  },
  {
    t: 'Ara nöron',
    alt: ['gizli nöron'],
    d: 'Duyu nöronlarıyla cevap veren nöronlar arasında duran nöron. Doğrudan dışarıyı görmez; girdilerin birleşimlerini, örüntüleri yakalar.',
    see: 'two'
  },
  {
    t: 'Öğrenme',
    d: 'Deneyimle bağlantı güçlerinin değişmesi. Aynı girdi, öğrenmeden sonra farklı bir cevaba yol açar.',
    see: 'learn'
  },
  {
    t: 'Öğretmenle öğrenme',
    d: 'Doğru cevabın bilindiği öğrenme: her yanlışta bağlantılar hatayı azaltacak yönde biraz düzeltilir.',
    see: 'learn'
  },
  {
    t: 'Tahmin hatası',
    alt: ['sürpriz'],
    d: 'Beklenenle olan arasındaki fark. Beyin en çok şaşırdığında öğrenir; her şey beklendiği gibiyse bağlantılar değişmez.',
    see: 'predict'
  },
  {
    t: 'Dopamin',
    d: 'Ödülle ilgili bir kimyasal haberci. Bir ödül beklenenden iyi geldiğinde dopamin nöronları ateşlenir, beklenen ödül gelmezse susar. Bu sinyal öğrenmeyi yönlendirir.',
    see: 'predict'
  },
  {
    t: 'Kendi kendine öğrenme',
    alt: ['etiketsiz öğrenme', 'öğretmensiz öğrenme'],
    d: 'Kimse doğru cevabı söylemeden, yalnızca çevredeki düzenlilikleri görerek öğrenme. Yavru bir kedinin görme sistemi böyle gelişir.',
    see: 'lines'
  },
  {
    t: 'Kritik dönem',
    d: 'Bir becerinin en kolay öğrenildiği erken yaşam dönemi. Görme, dil gibi becerilerin kritik dönemi vardır; bu dönemde görülmeyen şeye beyin sonradan zor uyum sağlar.',
    see: 'lines'
  },
  {
    t: 'Algı alanı',
    d: 'Bir nöronun “baktığı” küçük bölge. Görme alanındaki her nöron gözün gördüğü resmin yalnızca bir parçasına tepki verir.',
    see: 'lines'
  },
  {
    t: 'Kavram nöronu',
    d: 'Tek bir kavrama, örneğin belli bir kişiye ya da nesneye, onu nasıl gördüğünden bağımsız olarak tepki veren nöron. İnsanda şakak lobunun iç kısmında bulundu.',
    see: 'senses'
  },
  {
    t: 'Hebb kuralı',
    alt: ['birlikte ateşlenen birlikte bağlanır'],
    d: 'Aynı anda ateşlenen iki nöronun arasındaki bağlantı güçlenir. Hafızanın en temel kurallarından biri; 1949’da Donald Hebb önerdi.',
    see: 'hebb'
  },
  {
    t: 'Örüntü tamamlama',
    d: 'Bir anının küçük bir parçası (bir koku, bir ses) bütün anıyı geri çağırır. Birbirine güçlü bağlı nöronlar eksik kalan parçaları da ateşler.',
    see: 'hebb'
  },
  {
    t: 'Hafıza izi',
    alt: ['engram'],
    d: 'Bir anıyı taşıyan, birbirine bağlanmış nöron grubu. Anı tek bir hücrede değil, bu grubun bağlantılarında saklanır.',
    see: 'hebb'
  },
  {
    t: 'Pekiştirme',
    alt: ['konsolidasyon'],
    d: 'Yeni öğrenilen bir şeyin kalıcı hâle gelmesi. Tekrar ve özellikle uyku sırasında beyin gün içindeki deneyimleri yeniden oynatarak bağlantıları sağlamlaştırır.',
    see: 'hebb'
  },
  {
    t: 'Genelleme',
    d: 'Daha önce hiç görülmemiş bir örneği de doğru tanıyabilmek. Ezberlemenin tersi: kuralı ya da ortak özelliği öğrenmek.',
    see: 'shapes'
  },
  {
    t: 'Hipokampus',
    d: 'Şakak lobunun içinde, yeni anıları kaydetmede önemli rol oynayan bölge. Hasar görürse kişi yeni anı oluşturmakta zorlanır.',
    see: 'hebb'
  },
  {
    t: 'Beyin kabuğu',
    alt: ['korteks', 'gri madde'],
    d: 'Beynin dış yüzündeki 2–3 mm kalınlığındaki, kıvrımlı nöron tabakası. Görme, dil, düşünme gibi işlerin çoğu burada yapılır. Altı katmandan oluşur.'
  },
  {
    t: 'Beyaz madde',
    d: 'Kabuğun altında, bölgeleri birbirine bağlayan akson demetleri. Aksonları saran yağlı miyelin kılıfı onu beyaz gösterir ve sinyali hızlandırır.'
  },
  {
    t: 'Talamus',
    d: 'Beynin ortasındaki aktarma merkezi. Kokudan başka bütün duyu sinyalleri kabuğa ulaşmadan önce buradan geçer.'
  },
  {
    t: 'Glutamat',
    d: 'Beyindeki en yaygın uyarıcı kimyasal haberci. Sinapsta karşıdaki nöronun gerilimini yükseltir.'
  },
  {
    t: 'GABA',
    d: 'Beyindeki en yaygın susturucu kimyasal haberci. Sinapsta karşıdaki nöronun gerilimini düşürür.'
  }
];

if (typeof module !== 'undefined' && module.exports) module.exports = { GLOSSARY };
