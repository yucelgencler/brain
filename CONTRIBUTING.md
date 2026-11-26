# Katkı rehberi

Nörondan Beyne’ye katkı vermek istediğin için teşekkürler. Bu belge projenin nasıl çalıştığını, yeni bir seviyenin nasıl eklendiğini ve neye dikkat ettiğimizi anlatır.

## İlkeler

1. **Herkes için.** Kullanan kişi yazılımcı ya da biyolog olmak zorunda değil. Her terim ilk geçtiği yerde açıklanır (gerekirse `js/glossary.js` sözlüğüne eklenir). Kontrollerin adı ne yaptığını söyler: “gizli nöron sayısı” değil “ağ büyüklüğü”.
2. **Gerçek beyne odak.** Her seviye bir beyin olgusunu anlatır. Kartlar: _Gerçek beyinde_, _Bu modelde_, _Modelin basitleştirdiği_. Bilimsel bir iddiada bulunuyorsan kaynağını (araştırmacı ve yıl) kartta an.
3. **Dürüstlük.** Model beyni bire bir taklit etmez; neyi basitleştirdiğini açıkça yaz. Modeli asla “küçük beyin” diye anma (Türkçede beyincik demektir); “nöron ağı”, “ağ” ya da “devre” de.
4. **Tek bakış.** Dokunulan şey, etkisi ve sonuç aynı görüş alanında olur. Bir seviyenin tezgâhı genelde soldan sağa: girdi → nöronlar → cevap.
5. **Parlayan düğme.** Kullanıcı hiçbir an “şimdi ne yapacağım?” dememeli: sıradaki adımın düğmesi `psug` sınıfıyla parlar.

## Çalıştırmak

```
npm start            # yerel sunucu: http://localhost:8765
npm test             # bütün testler (Node.js yeter)
npm run format       # Prettier ile biçimlendir
npm run format:check # biçim denetimi (CI’da da çalışır)
```

Derleme adımı yok; sayfalar klasik `<script>` etiketleriyle yüklenir ve `file://` ile de açılır.

## Dosya düzeni

```
index.html              Ana sayfa, seviyeler ve sözlük (tek sayfa; #seviye-N, #sozluk)
beyin3d.html            3B beyin (Three.js)
lab.html                Serbest deney (rehbersiz laboratuvar)

js/neuron.js            Tek nöron: eşik, ateşleme, algılayıcı öğrenme kuralı
js/core.js              Çok katmanlı ağ (geri yayılım, Adam), PCA, laboratuvar görevleri
js/levels.js            Bölümler (PARTS), yol haritası (ROADMAP), seviye 1–9, 11, 12 ve registerLevel
js/levels/NN-ad.js      Ayrı dosyadaki seviyeler (10, 13–17): içerik, model ve görev kontrolleri
js/views/*.js           Ayrı dosyadaki seviyelerin görünümleri (+ pixelgrid.js ortak çizim ızgarası)
js/eye.js, hebb.js, senses.js, multi.js, net.js, predict.js   Eski seviyelerin görünümleri
js/path.js              Seviye sayfası, üst menü, yönlendirme (ana sayfa / seviye / sözlük)
js/home.js              Ana sayfa (açılış animasyonu, bölüm kartları) ve sözlük sayfası
js/glossary.js          Sözlük terimleri
js/app.js               Serbest deney arayüzü
js/b3d/                 3B beyin: util, sim (nöron simülasyonu), brain, region, column, micro, synapse, main

css/style.css           Ortak tema (renk değişkenleri, açık/koyu tema)
css/levels.css          Seviye sayfaları
css/site.css            Üst menü, ana sayfa, sözlük
css/views/*.css         Seviyelere özel görünümler
css/b3d.css             3B sayfası

tests/*.test.js         Node testleri
vendor/three.min.js     Three.js r149 (MIT)
```

## Bir seviye nasıl çalışır?

Bir seviye iki parçadır: **içerik ve model** (arayüzden bağımsız, Node’da test edilir) ve **görünüm** (tarayıcıda çizer).

### 1. İçerik ve model: `js/levels/NN-ad.js`

```js
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Lv = isNode ? require('../levels.js') : { registerLevel };

  const level = Lv.registerLevel({
    key: 'ornek', // kayıt adı; hiç değişmez (ilerleme buna göre saklanır)
    ver: 1, // durumun biçimi değişirse artır (eski kayıt sıfırlanır)
    part: 'C', // bölüm (levels.js içindeki PARTS)
    kind: 'ornek', // görünümün adı (path.js içindeki viewOf)
    title: 'Örnek seviye',
    question: 'Seviyenin sorduğu, herkesin anlayacağı soru?',
    goal: 'Bu seviyede ne fark edilecek (tek cümle).',
    todo: ['Adım 1', 'Adım 2', 'Adım 3'],
    init() {
      return {
        /* başlangıç durumu: JSON’a yazılabilir olmalı */
      };
    },
    missions: [
      {
        id: 'ilk',
        text: 'Görev metni (HTML olabilir).',
        check: st => !!st.flags.ilk,
        aha: 'Görev bitince açılan açıklama.'
      }
    ],
    cards: { brain: '…', model: '…', limit: '…' },
    deeper: '<p>“Daha derine” bölümü (HTML).</p>'
  });

  const api = { level /* + modelin fonksiyonları */ };
  if (isNode) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
```

- `check(st)` yalnız durumu (`st`) okur; arayüzü değil. Görevin tamamlandığını model fonksiyonların `st.flags` içine yazar.
- **Önce yaşa, sonra adını koy.** Görev açıklamalarında (`aha`) bir terimi ilk kez kullanırken `[[eşik]]` ya da `[[bağlantı gücü|bağlantı]]` yaz: üstüne gelince sözlükteki tek cümlelik açıklama görünür.
- **Katmanlı seviye** (bütün seviyeler böyle): `layered: true` ile sayfa en sade hâliyle açılır. Görünümdeki bir panele `data-lay="anahtar"` verirsen, o anahtarı `shows` listesinde taşıyan görev gelince görünür; `data-glow="anahtar"` verilen kontrol, görevin `glow` listesinde (ya da `glow: (st, rec) => [...]` fonksiyonunda) varsa parlar. Temel olmayan görevlere `extra: true` ver: ilerlemeye sayılmaz, “Derinleş”teki listede “ek deney” olarak durur. Seviye bitince `brainShort` (2–3 cümle) “Beyninde de böyle” kartı olarak çıkar; kartlar, hesap ve harita kapalı “Derinleş” bölümündedir.
- Seviyenin yeri `js/levels.js` içindeki `ROADMAP` dizisinde belirlenir (oraya `{ key: 'ornek', part: 'C', title: '…' }` ekle). Numara sıradan hesaplanır.

### 2. Görünüm: `js/views/ad.js`

Dört fonksiyon: `ornekGridHTML(lv)` (iskelet), `wireOrnek(lv)` (olay bağlama), `updateOrnek(lv, rec)` (her değişiklikte çizim), `ornekResetView()` (zamanlayıcıları durdur). Durum `R().st`, her değişiklikten sonra `refresh()` çağrılır. Sıradaki adımın düğmesine `psug` sınıfı ver.

### 3. Bağla

1. `js/path.js` → `viewOf` içine `ornek: { html, wire, update, reset }` ekle.
2. `index.html` → seviye dosyasını `js/levels.js`’ten sonra, görünümü `js/path.js`’ten önce yükle; CSS’i `css/views/` altına koy.
3. `js/path.js` → `BRAIN_LINK` içine “🧠 3B’de gör” bağlantısını ekle.
4. `tests/levels.test.js` → görevlerin modelle gerçekten tamamlanabildiğini test et.

## Pull request öncesi

- [ ] `npm test` geçiyor, `npm run format:check` temiz.
- [ ] Seviyeyi tarayıcıda yalnız parlayan düğmeleri izleyerek baştan sona oynadın.
- [ ] Metinler sade Türkçe; yeni terimler sözlükte.
- [ ] Kartlarda bilimsel iddiaların kaynağı var; modelin basitleştirdiği açıkça yazılı.
- [ ] Telefon genişliğinde (≈ 390 px) düzen bozulmuyor.
