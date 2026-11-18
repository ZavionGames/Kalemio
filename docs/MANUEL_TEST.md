# Elle kabul testi

## Uygulama adımları

Üretim derlemesini yeni bir Chrome profiline yükle. Kök klasörde `node scripts/fixture.mjs` komutu yerel deneme sayfasını başlatır. `http://127.0.0.1:4173` adresini aç. Testlerde yalnızca yapay metin kullan. Sonuçla birlikte Chrome sürümü, uzantı sürümü, tarih ve sayfayı kaydet.

1. **Çevrimdışı sözlük.** İnterneti kapat. Yerel deneme sayfasında düz metin alanına `turkce yazim` yaz. İlk sözlük yüklemesi sonrasında çizgiler görünmeli. `turkce`ye tıkla, **Türkçe** seç. İkinci kelime ve diğer içerik korunmalı. **Geri al** ilk yazımı getirmeli. Kısa metin kutusunda da tekrarla.
2. **Gmail.** İnterneti aç. Gmail’de **Oluştur** seç ve boş taslağın gövdesine `bugun hava cok guzel ama yinede disari cikmak istemiyorum` yaz. Çizgiye tıklayınca öneri görünmeli. **k → Düzelt** seç. Yeni profilde onay metni gelmeli. Önce **Vazgeç** seç ve taslağın değişmediğini kontrol et. Uzantının hizmet çalışanında Network görünümünde AI isteği oluşmamalı.
3. **Gerçek düzenleme.** Aynı taslakta **Düzelt → Onayla ve gönder** seç. İstekten önizlemeye kadar süreyi ölç. Örnek çıktı “Bugün hava çok güzel ama yine de dışarı çıkmak istemiyorum.” Modelin noktalaması değişebilir. Önizleme açıkken alan hâlâ eski metni taşımalı. **Uygula** ve **Geri al** seç, her iki durumda Gmail’in taslağı güncellediğini kontrol et. Mesajı göndermeye gerek yok.
4. **Seçim ve biçim.** Yerel sayfadaki kalın “Merhaba” yanında yalnız “dünya”yı seç. Alt+Shift+K ile menüyü aç. Düzenlemeyi uygula. Kalın kelime ve seçim dışındaki metin korunmalı. Kısayolu Chrome ayarlarında değiştirip tekrar dene. Dinamik açılan bir LinkedIn, WhatsApp Web veya X yazı alanında aynı akışı tekrarla.
5. **Sağ tık ve hassas alanlar.** Normal yazı alanında sağ tıklayıp Kalemio düzeltme komutunu dene. Ardından parola, tek kullanımlık kod, kart numarası ve aynı ödeme formundaki açıklama alanına odaklan. Kalemio simgesi, alt çizgi ve sağ tık eylemi görünmemeli. Kısayol AI başlatmamalı. Normal yazı alanına dönünce simge yeniden gelmeli.
6. **Site tercihi.** Normal sitede popup’tan **Bu sitede kapat** seç. Simge kaybolmalı ve sayfayı yenileyince kapalı kalmalı. **Bu sitede aç** ile geri getir. Ayarlardaki kapalı siteler listesini de kontrol et.
7. **Ağ kesintisi ve uzunluk.** Önce onayı vermiş olarak ağ bağlantısını kes. AI işlemini dene. Bağlantı/zaman aşımı mesajı görülmeli, sayaç ve metin değişmemeli. Yeniden bağlan. 4001 karakter seçip Düzelt’e bas. Bölümlere ayırma uyarısı gelmeli ve istek çıkmamalı. 4000 karakterlik seçim gönderilebilmeli.
8. **Günlük hak.** Farklı modlarda toplam 10 başarılı sonuç al. On birinci denemede günlük sınır mesajını kontrol et. Başarısız istek ve çevrimdışı denetim hakkı azaltmamalı.
9. **Kişisel sözlük.** Ayarlardan bir kelime ekle. Bir sonraki denetimde o kelime işaretlenmemeli.
10. **Onayı geri alma.** Ayarlardan onayı geri al. Sonraki AI işleminde yeniden onay sorulmalı. Yerel öneriler çevrimdışı çalışmaya devam etmeli. Türkçe ve İngilizce Chrome arayüzlerinde metinleri kontrol et.
