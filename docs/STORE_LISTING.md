# Chrome Web Store yayın dosyası

## Türkçe mağaza metni

**Ad** — Kalemio · Türkçe Yazım Asistanı

**Kısa açıklama** — Türkçe yazım ve aksan önerilerini cihazında gör. Seçtiğin metni yapay zekâyla düzelt, karşılaştır ve uygula.

**Uzun açıklama**

Gmail’de bir e-posta veya web formunda kısa bir mesaj yazarken Kalemio hatalı kelimeleri işaretler. Çizili kelimeye tıkla, öneriyi incele ve istediğin düzeltmeyi seç. Yerel Türkçe sözlük internet bağlantısı olmadan kullanılabilir.

Yazımını denetle, metni kısalt, tonunu değiştir, e-posta taslağı hazırla, Türkçe ve İngilizce arasında çeviri yap veya okunabilirliği incele. Tüm bu AI işlemleri günde toplam 10 hak kullanır. Öneriyi uygulamadan önce inceleyebilirsin. Çevrimdışı yazım denetimi ve kişisel sözlük günlük haktan harcamaz.

## English listing

**Name** — Kalemio · Turkish Writing Assistant

**Short description** — Check Turkish spelling and accents on your device. Preview, apply and undo AI edits to the text you select.

**Long description**

Write a message or email in Turkish and click an underlined word to review spelling and accent suggestions. The Turkish dictionary runs on your device and works offline.

Correct, rewrite, shorten, draft emails, translate between Turkish and English, or review readability. All AI tools share ten edits per day. You can review each result before applying it. Offline spelling and your personal dictionary do not use your daily allowance.

## İnceleme ekibi ve veri beyanı

**Tek amaç.** Kullanıcının web sayfalarındaki Türkçe metnini yazım, ifade ve bu metne bağlı düzenleme önerileriyle iyileştirmek.

**İzin gerekçeleri**

- HTTP/HTTPS içerik betiği kullanıcı etkin bir alanda yazarken yerel önerileri ve düzenleme arayüzünü gösterir.
- Worker host izni açıkça istenen AI düzenlemesini gerçekleştirir.
- `activeTab` popup içinde site adını gösterip o siteye ilişkin tercihi değiştirir.
- `storage` kurulum kimliği, yerel sözlük, onay, günlük kullanım ve site tercihlerini saklar.
- `contextMenus` yazı alanındaki sağ tık menüsü, `offscreen` çevrimdışı sözlük işçisi içindir.
- Klavye komutu Kalemio menüsünü açar. Varsayılan kombinasyon Alt+Shift+K’dir.

**Veri beyanı hazırlığı.** Seçilen web içeriği kişisel iletişim de içerebilir. AI kapsamında hangi içeriğin Cloudflare ve Google’a iletildiğini, kurulum kimliğini, kota için IP işlemeyi başvuru formunda fiilî dağıtıma göre beyan et. Destek ve gizlilik bağlantılarını yayımla.

## Ekran görüntüleri

1. Yapay örnek metin içeren Gmail taslağında çizili Türkçe kelime ve yerel öneri.
2. Verilen örnek cümlenin önce/sonra önizlemesi ve Uygula/Vazgeç düğmeleri.
3. Popup’ta günlük kalan hak ve siteyi kapatma seçeneği.
4. Ayarlarda onayı geri alma ve kişisel sözlük. Görüntüde kişisel mesaj bulunmamalı.
5. Çeviri ya da analiz sonucunun yer aldığı örnek kart.

## Başvurmadan önce

- [ ] Üretim ZIP’ini yeni Chrome profiline yükle. Manifest kökte, Türkçe/İngilizce metinler, ikonlar ve sözlük lisansı pakette olmalı.
- [ ] Üretimde geliştirme anahtarının görünmediğini kontrol et. JavaScript, React, sözlük ve stil dosyaları paket içinden geliyor. Uzak kod veya uzaktan indirilen çalıştırılabilir betik yok.
- [ ] Tek amaç ve her izin gerekçesini, gizlilik URL’sini, yasal yayıncı kimliğini ve veri işleme bildirimlerini başvuruya aktar.
- [ ] Mağaza kimliğiyle ALLOWED_ORIGIN’i ayarla ve gerçek yayında onay, AI, kota sınırını dene.
- [ ] Ekran görüntülerini ekle, iki dilde metni ve hedef bölge/yaş uygunluğunu kontrol et.
- [ ] Son gizlilik, minimum izin, sınırlı kullanım ve tek amaç politikalarını gözden geçir. [Chrome Web Store program politikaları](https://developer.chrome.com/docs/webstore/program-policies/policies)
