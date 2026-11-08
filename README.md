# Boş Beyin

Rastgele bağlantılarla doğan küçük bir sinir ağına rakam ve kelime öğreten, her sinyali canlı gösteren bir laboratuvar. İnsan beyninin öğrenme biçimini yapay sinir ağları üzerinden anlamak için yapıldı.

Kurulum veya derleme gerekmez: `index.html` dosyasını tarayıcıda açman yeterli. Ağ tamamen tarayıcıda çalışır ve eğitilir; öğrettiklerin aynı tarayıcıda saklanır.

## Bölgeler

| Sekme | Girdi | Çıktı | Ne gösteriyor |
|---|---|---|---|
| Rakamları tanıma | 5×7 piksel çizim | 0–9 ve öğrettiğin yeni şekiller | Bozuk deseni tamamlama, kapasite sınırı, kayma sorunu |
| Kelimeler (duyarak) | Her kelime ayrı bir nöron | Anlam (hayvan, meyve…) | Saf ezber, yeni kelime = yeni nöron, anlam uzayı |
| Kelimeler (okuyarak) | Kelimenin piksel resmi (harf başına 3×6) | Anlam | Şekilden okuma, hiç görülmemiş kelimelerde tahmin, kayma sorunu |

Toplama ve çarpma bölgeleri kodda duruyor ama şimdilik kapalı. Açmak için `js/core.js` içindeki `TASKS` dizisine `addTask` ve `mulTask` eklenmeli.

## Dosya yapısı

```
index.html          Sayfa iskeleti
css/style.css       Görünüm (açık tema: boyanmış doku kesiti, koyu tema: floresan mikroskop)
js/core.js          Sinir ağı (ileri yayılım, geri yayılım, Adam), PCA ve görevler. Arayüzden bağımsız.
js/app.js           Arayüz: ağ tuvali, eğitim döngüsü, paneller, deste görünümü, kayıt
tests/core.test.js  Çekirdek testleri (Node.js ile, bağımlılık yok)
```

## Ağ

- Katmanlar: duyu nöronları → 1 veya 2 gizli katman (tanh) → cevap nöronları (softmax; toplamadaki “miktar” kodlamasında sigmoid)
- Öğrenme: 32 kartlık mini yığınlar, çapraz entropi kaybı, Adam
- Başlangıç: Xavier ile rastgele ağırlıklar (simetriyi kırmak için)
- Yeni kelime veya şekil eklenince ağ yeniden boyutlanır, eski bağlantılar etiketlerine göre korunur

## Yeni bir bölge eklemek

`js/core.js` başındaki açıklamada arayüz tanımlı. Kısaca bir görev nesnesi şunları sağlar:

```
id, short, region, about
defaults()           -> {hidden, layers, lr, ...}
inputLabels(cfg)     -> duyu nöronlarının adları
outputLabels(cfg)    -> cevap nöronlarının adları
inputLayout          -> (isteğe bağlı) {cols, rows} ya da cfg => {cols, rows}
dataset(cfg)         -> {train:[{x, y, q}], test:[...]}
encode(q, cfg)       -> girdi dizisi ya da {error}
parse(text, cfg)     -> soru nesnesi ya da null
qText(q), truth(q, cfg), mapPoints(cfg)
```

Sağ paneldeki arayüz `js/app.js` içindeki `PANELS` nesnesine, görevin `id` ya da `kind` adıyla eklenir.

Akla gelen sonraki bölgeler: unutma deneyi (sadece yeni kartlarla eğitince eski bilginin bozulması), konumdan bağımsız görme (kayma sorununu çözen paylaşımlı dedektörler), uyku benzeri tekrar oynatma.

## Testler

```
node tests/core.test.js
```
