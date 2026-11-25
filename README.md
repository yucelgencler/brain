# Nörondan Beyne

Beynin bilgiyi nasıl aldığını, nasıl karar verdiğini, nasıl öğrendiğini ve nasıl hatırladığını tek bir nörondan başlayarak **kendi deneylerinle** keşfettiğin bir öğrenme yolu. Tek bir ışık hücresi ve tek bir nöronla başlar, her seviyede tek bir yeni fikir ekler.

Kurulum veya derleme gerekmez: `index.html` dosyasını tarayıcıda açman yeterli. İlerlemen ve notların aynı tarayıcıda saklanır.

## Öğrenme yolu

Her seviye aynı yapıda: **soru → elle dene → (makineye öğret) → görevlerle fark et → İnsan beyninde / Bu modelde / Benzetmenin sınırı / Yapay zekâda** kartları, isteyene “Daha derine” ve kişisel not alanı.

| # | Bölüm | Seviye | Yeni fikir | Durum |
|---|---|---|---|---|
| 1 | Algı | Tek bir ışık hücresi | girdi, bağlantı, eşik, ya hep ya hiç | hazır |
| 2 | Algı | İki ışık, bir karar | sinyalleri toplamak, VE / VEYA, karar haritası | hazır |
| 3 | Algı | Susturan bağlantı | negatif bağlantı, kendiliğinden ateşleme, karanlık dedektörü | hazır |
| 4 | Öğrenme | Öğretmenle öğrenme | etiketli eğitim verisi, hatadan düzeltme (algılayıcı kuralı), unutma | hazır |
| 5 | Öğrenme | Tahmin ederek öğrenme | kedi Pamuk ve mama: öğretmen yok, cevabı bir sonraki an veriyor; sürpriz, dopamin, söndürme, engelleme | hazır |
| 6 | Öğrenme | Tek nöronun duvarı | XOR: tek nöronun öğrenemediği şey | hazır |
| 7 | Anlama | Muz ve armut: ortak nöronlar | birden çok nöron ve çıktı, ortak özellikler, desen | hazır |
| 8 | Anlama | Duvarı aşmak: gizli nöronlar | gizli nöron, yumuşak eşik, geri yayılım (suç paylaştırma), simetri | hazır |
| 9 | Anlama | Yatay mı dikey mi? | yavru Pamuk’un gözü: algı alanı, etiketsiz (rekabetçi) öğrenme, az etiketle ad, kritik dönem (Blakemore) | hazır |
| 11 | Anlama | Beş duyu, tek kavram | eğitilmiş ağ: kart, yazı, tat, koku, ses → duyu alanları → kavram nöronları → ad; duyuları birleştirmek, kavram hücreleri | hazır |
| 10 | Anlama | Rakamları tanıma | kapasite, bozuk deseni tamamlama | serbest deneyde |
| 12 | Hafıza | Birlikte yanan, birlikte bağlanır | Ela, limon ve çilek: Hebb kuralı, örüntü tamamlama, yanlış ipucunu düzeltme, anıların karışması | hazır |
| 13 | Hafıza | Hafıza nerede? | bilgi bağlantılara dağılmış | yakında |
| 14 | Hafıza | Ezber ve genelleme | eğitim ve doğrulama (sınav) verisi | yakında |
| 15 | Hafıza | Unutma ve uyku | yeni öğrenince eskiyi bozma, tekrar oynatma | yakında |
| 16 | Anlam | Kelimeler ve anlam | anlam uzayı | laboratuvarda |
| 17 | Anlam | Okuma ve kayma sorunu | şekilden okuma, paylaşımlı dedektörler | laboratuvarda |

Seviye numaraları `js/levels.js` içindeki `ROADMAP` sırasından hesaplanır; ilerleme her seviyenin sabit `key` adıyla saklandığı için araya yeni seviye eklemek kayıtları bozmaz.

İlkeler: ekranda sadece o seviyenin getirdiği kontroller olur; hesaplar canlı sayılarla gösterilir; beyin benzetmesinin sınırları her seviyede açıkça yazılır.

## Beyne yolculuk (3B)

`beyin3d.html`, yaklaştıkça ayrıntıya inen üç boyutlu bir beyin. Tekerlek ya da iki parmakla yaklaşılır, sürükleyerek döndürülür; alttaki ölçek şeridinden durağa atlanabilir. Beş durak var, her biri kendi ölçeğinde ayrı bir sahne; aralarında iki sahne üst üste karıştırılarak geçilir:

| Durak | Ölçek | Ne görülür |
|---|---|---|
| Beyin | ~15 cm | kodla üretilmiş kıvrımlar (gürültünün sıfır çizgileri oluk olur), yan yarık ve merkez oluk, loblar (üzerine gel / tıkla → “Buraya yaklaş”), beyincik, beyin sapı; “İçini göster” ile talamus |
| Bölge | ~1 cm | kabuktan kesilmiş blok: kıvrım ve oluk, gri madde (yüzeyden ~2,6 mm) ve beyaz madde, damarlar; ense lobunda Gennari çizgisi |
| Kolon | ~1 mm | altı katman, ~2.900 temsilî nöron; “Girdi gönder” ile talamustan gelen sinyal IV → II/III → V → VI sırasıyla yayılır |
| Devre | ~100 µm | dendritli, aksonlu nöronlar; zar gerilimi ışıltı olarak, sinyaller akson boyunca ilerleyen darbeler olarak görünür. Nörona tıklayınca gerilim izi; “Sinyali takip et” ile kamera bir darbenin peşine düşer, varınca “Bu sinapsa yaklaş” |
| Sinaps | ~1 µm | akson ucu, kesecikler, kalsiyum kapıları, glutamat/GABA, alıcılar, iyon akışı; uyarıcı ve susturan sinaps |

**Limonun yolculuğu** (8 adım): göz → talamus → görme alanı (V1 devresinde “eğri kenar” ve “sarı leke” nöronları ateşler) → şakak lobu (özellik nöronları → LİMON kavram nöronu, susturan rakipleri bastırır) → Broca → hareket kabuğu → “Limon!”. Devredeki akım `js/b3d/sim.js` içindeki sızdıran topla-ateşle modeliyle hesaplanır (ms, mV, µm); ağır çekim kaydırıcısı simülasyon hızını değiştirir. `beyin3d.html?yolculuk` yolculuğu doğrudan açar.

Three.js (r149, MIT) `vendor/` içinde; internet gerekmez.

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
js/predict.js         Seviye 5 arayüzü: oda (Pamuk koşar) + Pamuk’un beyni; ses çıkar → tahmin → mama ver/verme → sürpriz → öğren
js/senses.js          Seviye 10 arayüzü: kart / yazı / tat / koku / ses → 59 duyu nöronu → 28 tanıyıcı → 10 kavram → ad ve tür (sesler Web Audio)
js/hebb.js            Seviye 12 arayüzü: 8 his nöronu halkada; an yaşat (Hebb) / ipucu ver (tamamlama), bağ tablosu
js/eye.js             Seviye 9 arayüzü: 3×3 göz → 6 görme nöronu (resimleriyle) → yatay/dikey adları; büyüt, yeni yavru
js/core.js            Laboratuvarın çok katmanlı ağı (geri yayılım, Adam), PCA ve görevler
js/app.js             Laboratuvar arayüzü
beyin3d.html          Beyne yolculuk (3B)
css/b3d.css           3B sayfanın görünümü
js/b3d/util.js        Gürültü, ikosfer, incelen tüp, parlayan noktalar, etiketler
js/b3d/sim.js         Devre simülasyonu (sızdıran topla-ateşle) ve devre tarifleri: serbest, V1, şakak lobu. Arayüzden bağımsız.
js/b3d/brain.js       Durak 1: beyin, loblar, yolculuk yolları
js/b3d/region.js      Durak 2: kabuk kesiti
js/b3d/column.js      Durak 3: altı katman ve kolon
js/b3d/micro.js       Durak 4: nöron devresi, darbeler, takip
js/b3d/synapse.js     Durak 5: sinaps
js/b3d/main.js        Kamera, sürekli yakınlaştırma ve geçiş, kartlar, limonun yolculuğu
vendor/three.min.js   Three.js r149 (MIT, lisans: vendor/THREE-LICENSE)
tests/neuron.test.js  Tek nöron ve seviye görevleri testleri
tests/core.test.js    Laboratuvar çekirdeği testleri
tests/b3d.test.js     3B sayfanın devre simülasyonu testleri
```

## Yeni bir seviye eklemek

`js/levels.js` başındaki açıklamada seviye nesnesinin alanları var: `key`, `kind` (`single` ya da `pair`), `ranges`, `init()`, `missions` (her biri `check(st)` ve tamamlanınca görünen `aha` metniyle), `cards` ve `deeper`. Öğrenme paneli için `learning: true` ve `targets`. Görevlerin kontrolleri arayüzden bağımsız olduğu için Node ile test edilebilir. Seviyeyi `ROADMAP` içinde doğru yere de koy.

## Testler

```
node tests/neuron.test.js
node tests/core.test.js
node tests/b3d.test.js
```

3B sayfa `file://` ile de açılır; tarayıcı eski dosyayı gösterirse Cmd+Shift+R.
