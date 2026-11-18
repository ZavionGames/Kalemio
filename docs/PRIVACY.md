# Kalemio gizlilik politikası taslağı

Yayımlayan, yürürlük tarihi ve iletişim kanalı ürün sahibi tarafından yayından önce eklenecektir.

## Yazarken

Kalemio etkin metin alanındaki yazım hatalarını, Türkçe ekleri ve aksanları cihazındaki sözlükle denetler. Yerel denetim için yazdığın kelimeler bilgisayarında kalır. Hatalı kelimeye tıklamak veya bir öneriyi uygulamak ağ isteği başlatmaz. Parola, tek kullanımlık kod, tanınan ödeme/banka alanları ve kapattığın siteler kapsam dışındadır.

## Yapay zekâ ile düzenlerken

İlk AI işleminde senden açık onay istenir. Bir işlem seçtiğinde uzantı seçili bölümü, seçim yoksa o andaki yazı alanının içeriğini işler. Her istekte en fazla 4000 karakter gönderilir. Metin, işlem türü, rastgele kurulum kimliği, saat dilimi HTTPS üzerinden Kalemio’nun Cloudflare Worker hizmetine gider. Worker yalnızca metni ve düzenleme talimatını Google Gemini API’ye iletir. Güncel onayı verdiğinde Gemini yanıt üretemezse aynı metin ve talimat önce Groq hizmetine, gerekirse OpenRouter üzerinden diğer model sağlayıcısına iletilebilir. Kullanıcı metni ve sonuç, Kalemio sunucusunda saklanmaz veya uygulama günlüklerine yazılmaz. Kalemio kullanım analizi ya da reklam izleyicisi içermez.

Sonucu önce önizlemede görürsün. Değişikliği uygulamak veya vazgeçmek senin seçimindir. Geri alma için gereken önceki değer geçici bellekte kalır. **Ayarlar → Gizlilik → Onayı geri al** sonraki AI gönderimlerinde yeniden onay istenmesini sağlar.

## Cihazda tutulan bilgiler

Kurulum kimliği, günlük sayaç, gönderim onayı, kapalı siteler ve kişisel sözlük o Chrome profilinde saklanır. Bunlar Chrome senkronizasyonuna yazılmaz. Ayarlardan sözcükleri ve site tercihlerini kaldırabilirsin. Uzantıyı kaldırmak bu profile ait uzantı verilerini siler.

## Hizmetin çalışması için tutulan kayıtlar

Cloudflare sunucusu, IP adresinden türetilen bir tanımlayıcıyla dakikalık istek sayısını sınırlar. Sunucuda günlük kullanım sayısı ve rastgele kurulum kimliği ilişkilendirilir. KV’de günlük kota kaydının ömrü iki gündür.

## Google Gemini’nin veri işlemesi

Google’ın ücretsiz hizmet koşullarında gönderilen içerik ve yanıtlar ürün geliştirme için kullanılabilir ve insan incelemesine konu olabilir. Gizli, hassas veya kişisel metni ücretsiz hizmete göndermemelisin. Ücretli hizmet koşullarında Google, istemleri ve yanıtları ürünlerini iyileştirmek için kullanmaz. Güvenlik, kötüye kullanım denetimi ve yasal gereklilikler kapsamında sınırlı süreli işleme olabilir. Bölgeye göre ek koşullar geçerlidir. [Google Gemini API ek hizmet koşulları](https://ai.google.dev/gemini-api/terms)

**Yayıncı için hazırlık notu.** Bu taslakta gerçek yayıncının adı, ulaşılabilir iletişim adresi, hizmetin fiilen kullandığı Gemini katmanı kesinleştirilmelidir. Gerçek kullanıcıları açmadan önce ücretli katmana geçin veya kullanım koşullarının izin verdiği bölgelerde ücretsiz katmanın veri kullanımını mağazada ve ilk onay ekranında açıkça bildirin. AEA, İsviçre ve Birleşik Krallık’ta API istemcileri için ücretli hizmet şartını, yaş ve hedef kitle koşullarını ayrıca kontrol edin. Yayımlanan politika, mağaza beyanı ve uygulama içi onay aynı hizmeti tarif etmelidir. [Google’ın güncel koşulları](https://ai.google.dev/gemini-api/terms)
