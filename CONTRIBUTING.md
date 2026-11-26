# Katkı rehberi

Teşekkürler! Kısaca:

## İlkeler

- **Herkes için.** Yazılımcı ya da biyolog olmayan da anlamalı.
- **Az yazı.** Ekranda tek cümle; ayrıntı isteyince açılır.
- **Önce yaşa, sonra adını koy.**
- **Sıradaki adım parlar.** Kullanıcı “şimdi ne yapacağım?” dememeli.
- **Dürüst model.** Neyi basitleştirdiğini yaz, bilimsel iddianın kaynağını an.

## Çalıştır

```
npm start   # http://localhost:8765
npm test
```

## Yeni seviye

1. **İçerik:** `js/levels/NN-ad.js`. Örnek olarak `js/levels/17-read.js` dosyasını kopyala.
   - `q`: tek satırlık soru (en çok 8 kelime)
   - her görevde `do`: banttaki kısa adım (en çok 10 kelime)
   - `aha`: görev bitince çıkan açıklama; ilk cümle görünür, gerisi “Neden?” ile
   - `brainShort`: “Beyninde de böyle” kartı (2–3 cümle)
2. **Görünüm:** `js/views/ad.js`.
   - Sonradan görünecek panele `data-lay`, parlayacak düğmeye `data-glow` ver.
3. **Bağla:** `ROADMAP` (`js/levels.js`), `viewOf` (`js/path.js`), `index.html`.
4. **Test:** `tests/levels.test.js`.

## Göndermeden önce

- [ ] `npm test` ve `npm run format:check` geçiyor.
- [ ] Seviyeyi yalnız parlayan düğmeleri izleyerek bitirdin.
- [ ] Telefonda (≈ 390 px) düzen bozulmuyor.
