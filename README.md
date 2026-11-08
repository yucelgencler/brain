# Boş Beyin

Beynin bir girdiyi nasıl algıladığını, nasıl cevaba çevirdiğini ve nasıl öğrendiğini; ardından yapay zekânın buna nerede benzeyip nerede ayrıldığını **kendi deneylerinle** keşfettiğin bir öğrenme yolu. Tek bir ışık hücresi ve tek bir nöronla başlar, her seviyede tek bir yeni fikir ekler.

Kurulum veya derleme gerekmez: `index.html` dosyasını tarayıcıda açman yeterli. İlerlemen ve notların aynı tarayıcıda saklanır.

## Öğrenme yolu

Her seviye aynı yapıda: **soru → elle dene → (makineye öğret) → görevlerle fark et → İnsan beyninde / Bu modelde / Benzetmenin sınırı / Yapay zekâda** kartları, isteyene “Daha derine” ve kişisel not alanı.

| # | Bölüm | Seviye | Yeni fikir | Durum |
|---|---|---|---|---|
| 1 | Algı | Tek bir ışık hücresi | girdi, bağlantı, eşik, ya hep ya hiç | hazır |
| 2 | Algı | İki ışık, bir karar | sinyalleri toplamak, VE / VEYA, karar haritası | hazır |
| 3 | Algı | Susturan bağlantı | negatif bağlantı, kendiliğinden ateşleme, karanlık dedektörü | hazır |
| 4 | Öğrenme | Öğretmenle öğrenme | etiketli eğitim verisi, hatadan düzeltme (algılayıcı kuralı), unutma | hazır |
| 5 | Öğrenme | Tahmin ederek öğrenme | öğretmen yok, cevabı bir sonraki an veriyor; sürpriz = hata | yakında |
| 6 | Öğrenme | Tek nöronun duvarı | XOR: tek nöronun öğrenemediği şey | hazır |
| 7 | Anlama | Muz ve armut: ortak nöronlar | birden çok nöron ve çıktı, ortak özellikler, desen | hazır |
| 8 | Anlama | Duvarı aşmak: gizli nöronlar | gizli nöron, yumuşak eşik, geri yayılım (suç paylaştırma), simetri | hazır |
| 9 | Anlama | Yatay mı dikey mi? | algı alanı, çizgi dedektörleri | yakında |
| 10 | Anlama | Rakamları tanıma | kapasite, bozuk deseni tamamlama | laboratuvarda |
| 11 | Hafıza | Birlikte yanan, birlikte bağlanır | öğretmensiz öğrenme, parçadan bütünü tamamlama | yakında |
| 12 | Hafıza | Hafıza nerede? | bilgi bağlantılara dağılmış | yakında |
| 13 | Hafıza | Ezber ve genelleme | eğitim ve doğrulama (sınav) verisi | yakında |
| 14 | Hafıza | Unutma ve uyku | yeni öğrenince eskiyi bozma, tekrar oynatma | yakında |
| 15 | Anlam | Kelimeler ve anlam | anlam uzayı | laboratuvarda |
| 16 | Anlam | Okuma ve kayma sorunu | şekilden okuma, paylaşımlı dedektörler | laboratuvarda |

Seviye numaraları `js/levels.js` içindeki `ROADMAP` sırasından hesaplanır; ilerleme her seviyenin sabit `key` adıyla saklandığı için araya yeni seviye eklemek kayıtları bozmaz.

İlkeler: ekranda sadece o seviyenin getirdiği kontroller olur; hesaplar canlı sayılarla gösterilir; beyin benzetmesinin sınırları her seviyede açıkça yazılır.

## Laboratuvar

`lab.html`, çok katmanlı sinir ağıyla serbest deney sayfası (rakamlar, kelimeleri duyarak ve okuyarak öğrenme). `lab.html?task=digits|words|read` doğrudan bir bölgeyi açar. Toplama ve çarpma bölgeleri kodda duruyor ama kapalı; açmak için `js/core.js` içindeki `TASKS` dizisine `addTask` ve `mulTask` eklenmeli.

## Dosya yapısı

```
index.html            Öğrenme yolu
lab.html              Serbest laboratuvar
css/style.css         Ortak görünüm (açık tema: boyanmış doku kesiti, koyu tema: floresan mikroskop)
css/levels.css        Öğrenme yolu görünümü
js/neuron.js          Tek nöron: ya hep ya hiç ateşleme, algılayıcı öğrenme kuralı. Arayüzden bağımsız.
js/levels.js          Seviyelerin içeriği: sorular, görevler ve kontrolleri, kartlar
js/path.js            Öğrenme yolu arayüzü: sahne, gösterge, tablo, karar haritası, öğrenme paneli
js/multi.js           Seviye 7 arayüzü: birden çok nöron, karşılaştırma, bağlantı tablosu
js/net.js             Seviye 8 arayüzü: iki ara nöron + lamba, elle kur / makine öğrensin
js/core.js            Laboratuvarın çok katmanlı ağı (geri yayılım, Adam), PCA ve görevler
js/app.js             Laboratuvar arayüzü
tests/neuron.test.js  Tek nöron ve seviye görevleri testleri
tests/core.test.js    Laboratuvar çekirdeği testleri
```

## Yeni bir seviye eklemek

`js/levels.js` başındaki açıklamada seviye nesnesinin alanları var: `key`, `kind` (`single` ya da `pair`), `ranges`, `init()`, `missions` (her biri `check(st)` ve tamamlanınca görünen `aha` metniyle), `cards` ve `deeper`. Öğrenme paneli için `learning: true` ve `targets`. Görevlerin kontrolleri arayüzden bağımsız olduğu için Node ile test edilebilir. Seviyeyi `ROADMAP` içinde doğru yere de koy.

## Testler

```
node tests/neuron.test.js
node tests/core.test.js
```
