# Kalemio

Kalemio, Chrome’daki Türkçe metin alanlarına yerel yazım önerileri ekler. Bir kelimeyi veya altındaki çizgiyi tıklayarak öneriyi seçebilirsin. Yapay zekâ ile düzenleme için alanın köşesindeki **k → Düzelt** yolunu kullan. Seçim varsa yalnızca seçtiğin bölüm, seçim yoksa etkin alanın metni işlenir. Önce ve sonra görünümünü inceleyip **Uygula** veya **Vazgeç** seç. Uyguladıktan sonra **Geri al** önceki metne döner.

## Windows’ta ilk çalıştırma

Güncel Node.js 24 LTS veya daha yeni desteklenen bir sürüm, npm ve Chrome 116+ kullan. Komutları PowerShell’e sırayla yapıştır. Windows’ta `npm.cmd` kullanımı PowerShell betik yürütme ayarını değiştirme ihtiyacını ortadan kaldırır.

```powershell
# İlk kurulumda depoyu indir. Mevcut kopyan varsa doğrudan o klasöre geç.
git clone https://github.com/ZavionGames/Kalemio.git
Set-Location Kalemio

# Node ve npm sürümlerini gösterir.
node --version
npm.cmd --version

# Kilit dosyasındaki bağımlılıkları ve yerel Türkçe sözlüğü kurar.
npm.cmd ci

# TypeScript strict denetimini yapar ve Chrome için üretim dosyalarını oluşturur.
npm.cmd run build

# Tarayıcıdan bağımsız birim testlerini ve yerel Cloudflare entegrasyon testlerini çalıştırır.
npm.cmd test
```

1. Chrome adres çubuğuna `chrome://extensions` yaz. Sağ üstte **Geliştirici modu** seçeneğini aç.
2. **Paketlenmemiş öğe yükle** düğmesine bas ve indirdiğin projenin içindeki **extension/dist** klasörünü seç. Bulmaca simgesinden Kalemio’yu sabitle.
3. Açık web sayfasını yenile. Bir yazı alanına `turkce yazim` yaz. İlk kullanımda sözlüğün açılması birkaç saniye alabilir. Noktalı çizgiye tıklayıp öneriyi seç.
4. Yapay zekâyı denemek için örnek bir metin seç, **k → Düzelt → Onayla ve gönder** seç. Onayı ayarlardan geri alabilirsin. Yayındaki Worker yeni sürüme geçirilince tüm işlemler ortak günlük kotayı kullanır.
5. Uzantı kartındaki **Kimlik** değerini al. Üretimde mağazanın verdiği sabit kimliği kullan. Farklı klasörden yüklenen geliştirme kopyasının kimliği değişebilir.

### Geliştirme ve tekrar test

```powershell
# Değişen dosyaları yeniden derler. Bu terminali açık tut.
npm.cmd run dev

# Ayrı bir PowerShell penceresinde yalnız bu bilgisayara açık deneme sayfasını başlatır.
node scripts/fixture.mjs

# Tek başına strict tip kontrolü yapar.
npm.cmd run typecheck

# Uçtan uca test için uyumlu Chrome for Testing sürümünü bir kez indirir.
npx.cmd playwright-core install chromium --no-shell

# Güncel üretim uzantısını hazırlar.
npm.cmd run build

# Geçici Chrome profili, yerel Worker ve örnek AI yanıtlarıyla kullanıcı akışını sınar.
npm.cmd run test:browser

# Gerçek hesaba dokunmadan Worker paketini üretir ve bağları listeler.
npm.cmd run worker:build

# Worker'ı yerelde http://localhost:8787 adresinde başlatır.
npm.cmd run worker:dev
```

Deneme sayfasını `http://127.0.0.1:4173` adresinde aç. Geliştirme sırasında Chrome’un uzantılar sayfasında **Yeniden yükle**, ardından açık siteyi yenile. İzleyiciyi ve yerel sunucuyu **Ctrl+C** ile kapat. Üretim derlemesinden önce izleyiciyi kapat. Uzantının varsayılan sunucusu `extension/src/config.ts` içindedir. Tamamen yerel deneme için bu adresi yerel Worker adresiyle değiştirip yeniden derle. Mağaza paketlemesinden önce üretim adresini geri koy. Otomatik tarayıcı testi yalnızca geçici kopyasında adres değiştirir ve gerçek anahtar gerektirmez.

### Klasörler

- `extension/src` içerik betiğini, Shadow DOM arayüzünü, arka plan hizmetini, React popup/ayarlarını ve yerel sözlük işçisini içerir. `extension/public/_locales` Türkçe ve İngilizce metinleri barındırır.
- `backend/src` AI çağrılarını ve eşzamanlı kota işlemlerini içerir. `backend/wrangler.toml` Cloudflare yapılandırmasıdır.
- `extension/tests` istemci ve dil testlerini, `backend/tests` Miniflare testlerini ve yalnızca testlerde erişilebilen sahte sağlayıcıyı içerir.
- `scripts` uzantı derlemesini, gerçek tarayıcı testini, örnek sayfayı ve yayın ZIP’ini üretir.
- `shared/limits.json` günlük hak ve metin uzunluğu sınırlarını hem uzantı hem Worker için belirler. Değişiklik sonrasında iki paketi de yeniden derle ve kullanıcıya gösterilen sınır açıklamalarını güncelle.
- [Elle test listesi](docs/MANUEL_TEST.md), [gizlilik politikası taslağı](docs/PRIVACY.md) ve [mağaza metinleri ve kontrol listesi](docs/STORE_LISTING.md) yayına hazırlık içindir.

## Günlük kullanım

Tüm düzenleme, ton, kısaltma, e-posta, çeviri ve analiz işlemleri kurulum başına günlük 10 hakkı paylaşır. Sonuç hazır olduğunda bir hak kullanılır. Sağlayıcıların tümü başarısız olursa hak korunur. Önizlemeden vazgeçmek kullanılan hakkı geri almaz. Çevrimdışı denetim ve kişisel sözlük bu sayaca dahil değildir.

## Cloudflare kurulumu

Kendi dağıtımın için Worker adresini `extension/src/config.ts` içinde güncelle ve uzantıyı yeniden derle. API anahtarları yalnızca Worker tarafında kullanılır. Yerel Worker denemesinde proje kökündeki `.env.example` dosyasını `backend/.dev.vars` olarak kopyalayıp ihtiyacın olan değerleri ekleyebilirsin.

Worker ayarlarında API anahtarlarını Secret olarak ekle. Deneme sırası ve karşılık gelen model değişkenleri aşağıdadır.

1. Gemini için `AI_API_KEY` ve `GEMINI_MODEL`.
2. İkinci Gemini hesabı için `AI_API_KEY_2` ve `GEMINI_MODEL_2`.
3. Groq için `GROQ_API_KEY` ve `GROQ_MODEL`.
4. OpenRouter için `OPENROUTER_API_KEY` ve `OPENROUTER_MODEL`.

Model değerleri `backend/wrangler.toml` içinde bulunur. `ALLOWED_ORIGIN` değerini yayımlanan uzantının `chrome-extension://UZANTI_KIMLIGI` adresine ayarla. Mevcut bir KV alanını kullanıyorsan kimliğini `KALEMIO_KV` bağının altına ekle. Proje dizininde `npx.cmd wrangler login` ardından `npm.cmd run worker:deploy` çalıştır. Bu dağıtım kota için gerekli `LEDGER` Durable Object bağını ve geçişini de içerir. Panelde kod düzenliyorsan bu bağlar kurulduktan sonra `npm.cmd run worker:panel` ile oluşturulan `backend/worker-panel.js` dosyasını kullan.

## İstemci ve sunucu sözleşmesi

Worker, kaynak metni düzenleme talimatından ayrı gönderir. Tanınan bazı rol değiştirme kalıplarında veya dili koruması gereken uzun bir metinde belirgin alfabe değişimi olduğunda sonuç reddedilir ve günlük hak korunur. Bu denetimler her uygunsuz yanıtı yakalayamaz.

`POST /` metin ve işlem türünü alır. Başarı yanıtı `{ "result": "...", "mode": "fix" }` biçimindedir. Uzantı kurulum kimliğini ve saat dilimini gönderir. Sunucu günlük sınırı paralel isteklerde de uygular. Kota dolduğunda 429 döner. Kimlik göndermeyen eski istemciler IP tabanlı kotayı paylaşır. Günlük kullanım kaydının KV kopyası iki gün saklanır.

- Türkçe ve İngilizce arayüz Chrome’un dil ayarını izler. Google Dokümanlar’ın özel düzenleyicisi, başka bir kaynaktan gelen gömülü iframe editörleri ve kapalı Shadow DOM kullanan üçüncü taraf editörler kapsam dışıdır. Parola, ödeme, kart, doğrulama kodu ve banka alanları URL, alan türü, form ve erişilebilir etiketlerinden tanınır. Özel işaretlenmemiş alanlar için sitede kapatma seçeneği vardır.

## İzinler ve sözlük lisansı

- `storage` onay, kurulum kimliği, sayaç, sözlük, kapalı siteleri yerel profilde tutar.
- `activeTab` popup açıldığında etkin sitenin adresini okumak ve o siteyi kapatmak içindir.
- `contextMenus` desteklenen etkin yazı alanına sağ tık düzeltme işlemi ekler. `commands` tanımının varsayılanı **Alt+Shift+K**. Ayarlardan Chrome’un kısayol düzenleyicisi açılır.
- `offscreen` bir uzantı belgesinde yerel sözlük Web Worker’ını çalıştırır. İşçi boşta kaldığında bellek serbest bırakılır.
- `host_permissions` yalnızca yapılandırılmış Worker adresidir. HTTP ve HTTPS sitelerini kapsayan statik `content_scripts.matches` tanımı düzenlenebilir alana simge/öneri eklemek içindir. Chrome’un web siteleri için geniş erişim bildirimine bu tanım neden olur. AI ağı yalnızca service worker’dan çıkar.
- `dictionary-tr@2.0.0` içindeki Türkçe Hunspell sözlük ve ek dosyalarının lisansı MIT’dir. Ticari dağıtıma izin verir, telif ve lisans bildiriminin korunmasını gerektirir. Derleme Harun Reşit Zafer’in bildirimini `licenses/dictionary-tr.txt` olarak uzantıya ekler. Bu sürümdeki sayısal ve koşulsuz son ek kuralları Web Worker’da ters arama ile uygulanır. Belirsiz öneriler kullanıcı seçince uygulanır. [Sözlük kaynağı ve lisansı](https://github.com/wooorm/dictionaries/tree/main/dictionaries/tr)

## Mağazaya paketleme

```powershell
# Strict kontrol, üretim derlemesi ve ZIP üretimini sırayla çalıştırır.
npm.cmd run package
```

**release/kalemio-1.0.0.zip** uzantının manifestini arşivin kökünde içerir. Chrome Web Store geliştirici hesabını aç, yeni öğe oluştur ve ZIP’i yükle. Gizlilik politikasını kendi HTTPS adresinde yayımla. İletişim bilgilerini, inceleme ekibine özel yönergeleri, açıklamaları, amaç ve izin beyanlarını tamamla. [Mağaza dosyası](docs/STORE_LISTING.md)

## Yayın sahibinin tamamlayacağı işler

- Cloudflare hesabında Worker’ı güncelle, KV ve Ledger bağlarını, gerçek mağaza Origin’ini ve secret’ları doğrula.
- Gemini’nin veri kullanımı, yaş, bölge ve kullanım koşullarını hedef kitlenle karşılaştır. Özellikle 18 yaş altı kullanıcıların erişebileceği bir ürün olarak yayımlamadan önce sağlayıcı uygunluğunu çöz. Gerçek kullanıcılar için ücretli proje, uygun bildirim metni ve bölgesel erişim kararını ver. [Gemini API koşulları](https://ai.google.dev/gemini-api/terms)
- Kuruluş ve iletişim bilgilerini gizlilik metnine ekle. Gmail ve diğer hedef sitelerde [elle kabul testlerini](docs/MANUEL_TEST.md) yap, ekran görüntülerini al ve mağaza başvurusunu tamamla.
