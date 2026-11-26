# Katkı rehberi

Katkı vermek istediğin için teşekkürler. Bu belge kısa: önce ilkeler, sonra yeni bir seviyenin nasıl eklendiği.

## İlkeler

1. **Herkes için.** Kullanan kişi yazılımcı ya da biyolog olmak zorunda değil. Kontrollerin adı ne yaptığını söyler: “gizli nöron sayısı” değil “ağ büyüklüğü”.
2. **Az yazı.** Ekranda tek cümle; ayrıntı isteyince açılır.
3. **Önce yaşa, sonra adını koy.** Kullanıcı önce dener, terimi sonra öğrenir.
4. **Tek bakış.** Dokunulan şey, etkisi ve sonuç aynı görüş alanında: girdi → nöronlar → cevap.
5. **Parlayan düğme.** Kullanıcı hiçbir an “şimdi ne yapacağım?” dememeli; sıradaki adımın düğmesi parlar.
6. **Gerçek beyin, dürüst model.** Her seviye bir beyin olgusunu anlatır. Modelin neyi basitleştirdiğini açıkça yaz; bilimsel iddianın kaynağını (araştırmacı, yıl) an. Modele “küçük beyin” deme (Türkçede beyincik demektir); “ağ” ya da “devre” de.

## Çalıştırmak

```
npm start            # http://localhost:8765
npm test             # bütün testler (Node.js yeter)
npm run format       # Prettier ile biçimlendir
```

Derleme adımı yok; sayfalar düz `<script>` etiketleriyle yüklenir.

## Nerede ne var?

| Dosya                | İçinde                                                 |
| -------------------- | ------------------------------------------------------ |
| `index.html`         | Ana sayfa, seviyeler, sözlük (tek sayfa)               |
| `beyin3d.html`       | 3B beyin                                               |
| `lab.html`           | Serbest deney                                          |
| `js/levels.js`       | Bölümler, yol haritası (`ROADMAP`), seviye 1–9, 11, 12 |
| `js/levels/NN-ad.js` | Ayrı dosyadaki seviyeler (10, 13–17)                   |
| `js/views/`          | Bu seviyelerin görünümleri                             |
| `js/path.js`         | Seviye sayfası, menü, yönlendirme                      |
| `js/glossary.js`     | Sözlük                                                 |
| `css/`               | Stiller (`views/` altında seviyeye özel olanlar)       |
| `tests/`             | Node testleri                                          |

## Yeni bir seviye

Bir seviye iki parçadır: **içerik ve model** (Node’da test edilir) ve **görünüm** (tarayıcıda çizer).

### 1. İçerik: `js/levels/NN-ad.js`

```js
Lv.registerLevel({
  key: 'ornek', // kayıt adı; hiç değişmez
  ver: 1, // durumun biçimi değişirse artır
  part: 'C', // bölüm
  kind: 'ornek', // görünümün adı
  layered: true,
  title: 'Örnek seviye',
  q: 'Tek satırlık soru?', // en çok 8 kelime
  init: () => ({ flags: {} }),
  missions: [
    {
      id: 'ilk',
      do: '<b>Düğmeye bas.</b>', // bantta görünen; en çok 10 kelime
      text: 'Uzun açıklama (bandın “?” düğmesiyle açılır).',
      check: st => !!st.flags.ilk,
      aha: 'İlk cümle hep görünür. Gerisi “Neden?” ile açılır.',
      shows: ['panel'], // bu görevle görünür olan paneller
      glow: ['dugme'] // parlayan kontroller
    }
  ],
  brainShort: 'Seviye bitince çıkan “Beyninde de böyle” kartı (2–3 cümle).',
  cards: { brain: '…', model: '…', limit: '…' },
  deeper: '<p>Kapalı “Derinleş” bölümü.</p>'
});
```

Tam iskelet için var olan bir seviye dosyasına bak (ör. `js/levels/17-read.js`).

- `check(st)` yalnız durumu okur. Görevin bittiğini model `st.flags` içine yazar.
- Bir terimi ilk kez kullanırken `[[eşik]]` yaz: üstüne gelince sözlükteki açıklama görünür.
- Asıl olmayan görevlere `extra: true` ver: ilerlemeye sayılmaz, sonradan “+” olarak gelir.

### 2. Görünüm: `js/views/ad.js`

Dört fonksiyon: iskelet (`ornekGridHTML`), olaylar (`wireOrnek`), çizim (`updateOrnek`), temizlik (`ornekResetView`). Her değişiklikten sonra `refresh()` çağır.

- Sonradan görünecek panele `data-lay="panel"` ver.
- Parlayacak kontrole `data-glow="dugme"` ver.
- Paneldeki `p.hint` açıklaması kendiliğinden ⓘ düğmesinin arkasına geçer.

### 3. Bağla

1. `js/levels.js` → `ROADMAP` içine `{ key: 'ornek', part: 'C', title: '…' }`.
2. `js/path.js` → `viewOf` içine `ornek: { html, wire, update, reset }`; istersen `BRAIN_LINK` içine 3B bağlantısı.
3. `index.html` → seviye ve görünüm dosyalarını yükle.
4. `tests/levels.test.js` → görevlerin gerçekten tamamlanabildiğini test et.

## Göndermeden önce

- [ ] `npm test` geçiyor, `npm run format:check` temiz.
- [ ] Seviyeyi yalnız parlayan düğmeleri izleyerek baştan sona oynadın.
- [ ] Ekrandaki yazı az; yeni terimler sözlükte.
- [ ] Telefon genişliğinde (≈ 390 px) düzen bozulmuyor.
