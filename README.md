# Respondly

İşletmeler için WhatsApp yönetim sistemi. İşletme kendi WhatsApp numarasını bağlar;
Respondly müşteri konuşmalarını yürütür — bilgi kütüphanesinden yanıtlar, işletmenin
bağladığı MCP sunucularından canlı veri çeker, gerektiğinde insana devreder.

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + pgvector + Storage + Realtime + Vault) · Mastra (asistan motoru) ·
OpenRouter · Meta WhatsApp Cloud API.

## Geliştirme

```bash
npm install
cp .env.example .env.local   # sonra değerleri doldur
npm run dev
```

```bash
npm run test        # birim testleri (node:test)
npx tsc --noEmit    # tip kontrolü
npm run lint
npm run build
```

## Ortam değişkenleri

Tam liste ve açıklamalar `.env.example` içinde. Zorunlu olanlar:

| Değişken | Ne işe yarar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje adresi (istemci + sunucu). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Tarayıcı istemcisi. Sınır RLS'tir, bu anahtar herkese açıktır. |
| `SUPABASE_SERVICE_ROLE_KEY` | RLS'i aşan sunucu istemcisi. Asla istemciye sızmamalı. |
| `APP_URL` | Uygulamanın **genel** adresi, sonunda eğik çizgi yok. Meta webhook adresi ve davet bağlantıları buradan üretilir. |
| `CRON_SECRET` | Bilgi kütüphanesi cron uçlarının paylaşılan sırrı (`Authorization: Bearer …`). |
| `OPENROUTER_API_KEY` | Her model çağrısı. |
| `WHATSAPP_APP_SECRET` | Gelen webhook imzasının (`X-Hub-Signature-256`) doğrulanması. |
| `WHATSAPP_VERIFY_TOKEN` | Meta'nın webhook doğrulama handshake'i. |
| `RESEND_API_KEY` | Davet ve hesap e-postaları. |

Kanala özel WhatsApp kimlik bilgileri (Phone Number ID, WABA ID, access token) ortam
değişkeni **değildir**: dashboard'da **WhatsApp → Bağlantı** sekmesinden girilir, access
token Supabase Vault'ta saklanır.

## Vercel'e dağıtım

1. **Projeyi bağla.** Vercel → Add New → Project → bu repo. Framework `Next.js`,
   build komutu varsayılan. `vercel.json` bölgeyi `lhr1`'e sabitliyor: Supabase projesi
   `eu-west-2`'de, her istek turunda birkaç veritabanı gidiş-dönüşü var, fonksiyonun
   veritabanının yanında çalışması gecikmeyi doğrudan düşürüyor.
2. **Ortam değişkenlerini gir.** `.env.example`'daki her zorunlu adı Production (ve
   istersen Preview) ortamına ekle. `APP_URL` üretim alan adın olmalı — `vercel.app`
   adresi veya bağladığın kendi alan adın.

   Panelden tek tek girmek yerine, doldurulmuş `.env.local`'i toptan yükleyebilirsin:

   ```bash
   vercel link                                   # proje bir kez bağlanır
   ./scripts/vercel-env.sh .env.local production
   ```

   Script değerleri dosyadan okuyup `vercel env add`'e stdin ile verir — değerler
   kabuk geçmişine ve repoya girmez. Aynı adı ikinci kez çalıştırmak günceller.
   Zorunlu bir değişken eksikse hangisi olduğunu söyleyip hata verir.
3. **Dağıt.** Uzun iş yapan uçlar (`/api/whatsapp/webhook`, `/api/assistant/chat`,
   `/api/cron/*`) kendi `maxDuration = 60` değerlerini kodda taşıyor; Vercel bunu
   dosyadan okur, ayrıca ayar gerekmez.
4. **Meta webhook'unu güncelle.** Meta App → WhatsApp → Configuration → Callback URL:
   `https://<alan-adın>/api/whatsapp/webhook`, Verify token = `WHATSAPP_VERIFY_TOKEN`.
   Dashboard'daki WhatsApp → Bağlantı sekmesi bu adresi `APP_URL`'den üretip gösterir.
5. **Supabase Vault'taki `app_url`'i güncelle.** Bilgi kütüphanesi cron'ları Vercel'de
   değil, Supabase'de `pg_cron` ile çalışıyor (`trigger_knowledge_refresh`,
   `trigger_knowledge_ingest_sweep`) ve adresi Vault'tan okuyor. Dağıtımdan sonra:

   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'app_url'),
     'https://<alan-adın>'
   );
   ```

   `knowledge_cron_secret` ile Vercel'deki `CRON_SECRET` **aynı değer** olmalı.

Cron'lar bilerek `vercel.json`'a konmadı: aynı işi iki zamanlayıcı tetiklerse her tur
iki kez koşar.

### Dağıtım sonrası kontrol listesi

- `https://<alan-adın>/login` açılıyor.
- Meta'da webhook doğrulaması yeşil; test mesajı gelen kutusuna düşüyor.
- Bir konuşmada asistan yanıt veriyor (OpenRouter anahtarı çalışıyor).
- `select * from cron.job_run_details order by start_time desc limit 5;` — cron'lar
  2xx dönüyor (localhost'a gitmiyor).
- Davet e-postası ulaşıyor (Resend alan adı doğrulanmış olmalı).

### Bilinen sınırlar

- **Crawl4AI** yalnız `CRAWL4AI_BASE_URL` **dağıtımdan erişilebilir** bir adresse çalışır.
  Docker'ı kendi makinende çalıştırıyorsan Vercel oraya ulaşamaz; değişkeni boş bırak,
  tek sayfa çıkarma çalışmaya devam eder.
- Asistan turu webhook yanıtından sonra `after()` içinde sürüyor ve fonksiyonun 60 sn'lik
  tavanına dahil. Çok araç çağıran uzun bir tur bu tavana yaklaşırsa devir mesajına düşer.
