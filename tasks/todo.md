# Reseliva → generic MCP client

## Done

- [x] `mcp_servers` tablosu + RLS (`integrations.access` yeniden kullanıldı, yeni enum yok)
      + Vault RPC'leri `set/get/clear_mcp_server_secret` + `generate_typescript_types`
- [x] `ReselivaLocale` → `src/lib/i18n/guest-locale.ts` (`GuestLocale`, `normalizeGuestLocale`)
- [x] `src/lib/mcp/**` client katmanı (`@mastra/mcp@1.16`): config, session, toolsets,
      parse-result, images, discover, errors, prompt-block, SSRF gate
- [x] `send_link_button` tool'u + jenerik görsel taraması; `booking-cta-copy.ts` silindi
- [x] `runAssistantTurn` — WhatsApp ve önizleme aynı yoldan geçiyor; jenerik `escalate`
- [x] `prompt.ts` sektörden bağımsız; My Dora persona'sı `assistants.system_prompt`'a yazıldı
      (kopyası `docs/prompts/my-dora-hotel.md`)
- [x] `/[slug]/mcp` paneli: liste, ekle/düzenle, bağlantı testi, aç/kapa, sil + sidebar girdisi
- [x] `src/lib/bookings/**` ve tüm Reseliva kodu silindi; `RESELIVA_*` env'leri kaldırıldı
- [x] Testler: `src/lib/mcp/mcp.test.ts`, `src/mastra/prompt.test.ts` (+ mevcut suite) → 74/74
- [x] Entegrasyonlar sayfası tamamen kaldırıldı — bağlanmak = MCP sunucusu bağlamak.
      `integrations.access` izni MCP sayfasını gatelemeye devam ediyor (enum değişmedi),
      middleware artık `/[slug]/mcp` için de izin kontrolü yapıyor (önceden boşluktu).
- [x] Bağlantı testi: 45 sn tavan + `disconnect()` artık spinner'ı bekletmiyor;
      ulaşılamayan adres için Türkçe hata mesajı
- [x] Reseliva izi sıfır: `.cursor/rules/respondly.mdc` CLAUDE.md ile yeniden senkronlandı;
      DB'de `integrations` satırı ve 17 Reseliva claim'i silindi; `integrations` tablosu +
      `set/get_integration_secret` RPC'leri düşürüldü; `database.ts` yenilendi

## WhatsApp interactive bileşenleri

- [x] `ask_choice` tool'u — model 2-10 seçenek verir, **taşıma katmanı bileşeni seçer**:
      ≤3 → reply buttons, 4-10 → list (gruplayınca section'lı). Model WhatsApp
      limitlerini bilmek zorunda değil.
- [x] `request_location` tool'u — native "Konum gönder" butonu
- [x] `src/lib/whatsapp/cloud-api/payloads.ts` — saf payload üreticileri; tüm Meta
      limitleri (buton 20, satır 24, açıklama 72, 3 buton / 10 satır) burada kırpılıyor
- [x] `client.ts` sadece kimlik + transport; payload üretimi test edilebilir hale geldi
- [x] Önizlemede `ChoicePreview` — misafirin göreceği şekli gösterir (buton mu liste mi)
- [x] Prompt: hangi bileşen ne zaman + "her zaman bir kaçış seçeneği (Diğer) bırak"

## Kişi kartı sadeleştirmesi

- [x] `contacts`: `first_name`, `last_name`, `nationality`, `country`, `preferred_language`
      kolonları eklendi; `name` artık trigger ile ad+soyaddan türetiliyor (WhatsApp push
      adı yapılandırılmış isim gelene kadar korunuyor)
- [x] `profile` JSONB kolonu ve içindeki serbest alanlar tamamen düşürüldü
- [x] Yeni kişide `country` telefondan (`getPhoneCountry`), ad/soyad push adından seed'leniyor
- [x] Kart UI 7 alana indi; telefon salt-okunur, dil için Select
- [x] `get_contact_profile` / `update_contact_profile` yeni alanlara göre yazıldı
- [x] Prompt: kartın tam olarak 7 alan olduğu, ülkenin tahmin olduğu ve uyrukla
      karıştırılmaması gerektiği yazıldı

## Prompt yapısı — persona'ya uyum

- [x] Tek blob yerine **sıralı sistem mesajları**: `[motor kuralları, kimlik, kişi kartı, tur dili]`
      (`AgentInstructions = SystemMessage` dizi kabul ediyor)
- [x] Ses/üslup artık **tek yerde**: kimlik bölümü. Motor bölümü sadece mekanik anlatıyor
- [x] Çift yönlü öncelik cümlesi: motor "ses konusunda son bölüm kazanır", kimlik
      "yukarıdaki genel kuralları geçersiz kılar" diyor
- [x] Kimlik bölümü sonda → recency etkisi persona'nın lehine çalışıyor
- [x] Cache breakpoint son bölüme taşındı (öncesindeki her şeyi kapsıyor)

## Review

**Kanıtlanan davranış (gerçek sunucuya karşı):**
- Gerçek MyDora MCP sunucusuna (localhost:3001) yanlış token → 401 yakalandı, tur düşmedi,
  hata Türkçe açıklamayla `mcp_servers.error` alanına yazılabilir halde döndü.
- Kontrollü bir MCP sunucusuna karşı tam yeşil yol: 3 tool keşfedildi → `search_knowledge`
  adını taklit eden tool **reddedildi** (built-in gölgeleme engeli çalışıyor), diğer ikisi
  `mydora_*` ön ekiyle modele sunuldu, çağrıldı, content-block JSON'ı çözüldü, görsel
  bulundu, claim hook iki çağrı için de tetiklendi.
- DB'deki `tools` cache'i → `## Connected Systems` prompt bloğu → persona + industry birlikte
  render edildi; prompt'ta "Reseliva" geçmiyor.

**Açık kalan (kullanıcı eylemi gerekiyor):**
- Panelde gerçek bearer token ile "Bağlantıyı test et" (token'ı ben girmedim).
- WhatsApp üzerinden canlı bir tur + `assistant_claims` satırlarının doğrulanması.

**Not:** `npx eslint src --quiet` 5 hata veriyor; hepsi bu değişiklikten önce de vardı
(`inbox-client.tsx`, `carousel.tsx`, `use-inbox-conversation-list.ts`, `use-mobile.ts` —
`react-hooks/set-state-in-effect`). Yeni dosyalarda hata yok.

---

# Görsel gönderimi: Meta media upload + cache (2026-08-12)

**Sorun:** Bir yanıtta 6 görsel varken hepsi `image.link` ile sıralı gidiyordu. Meta her
`link`'i kendi indiriyor ve indirme bitmeden API cevap vermiyor → görsel başına saniyeler,
üstüne her gönderimden sonra beklenen DB insert'i.

**Karar:** Kolaj/carousel yok (kullanıcı tercihi). Görseller ayrı ayrı gitmeye devam ediyor,
sadece hızlanıyor.

- [x] `whatsapp_media_cache` tablosu (org + phone_number_id + source_url digest → media_id),
      RLS: `inbox.access` ile okuma, yazma yalnız service role
- [x] `uploadWhatsAppMedia` — `POST /{phone-number-id}/media`, multipart
- [x] `media-limits.ts` — Meta'nın kabul ettiği tip/boyut kuralları, saf ve test edilir
- [x] `image-normalize.ts` — webp/avif/gif/heic → jpeg (sharp), 5MB üstü yeniden kodlama.
      SVG bilerek dışarıda: MCP çıktısından gelen markup'ı rasterize etmek dış referans açar
- [x] `media-cache.ts` — cache okuma, eksikleri paralel indir+dönüştür+yükle, sonucu yaz
- [x] SSRF koruması: URL'leri artık **biz** indiriyoruz (eskiden Meta indiriyordu), o yüzden
      her redirect hop'u tek tek `isPrivateHostname` ile doğrulanıyor, gövde 16MB'da kesiliyor
- [x] `send-reply.ts` — upload metin mesajıyla paralel başlıyor; `media_id` ile gönder,
      Meta id'yi reddederse cache satırını sil ve `link`'e düş
- [x] Testler: `media-limits.test.ts` + `buildImagePayload` (id / link / boş caption)

## Review

**Canlı Meta hesabına karşı ölçüldü** (org `faa4cffd…`, 3 gerçek bilgi kütüphanesi görseli):

| | süre |
|---|---|
| soğuk (indir + dönüştür + yükle, 3 görsel paralel) | 2699 ms |
| sıcak (cache hit, 3 görsel) | 156 ms |

`GET /{media-id}` üçü için de HTTP 200 → Meta medyayı tutuyor, `mime_type: image/jpeg`.

**Yan bulgu — üretimde sessiz bir hata düzeldi:** bilgi kütüphanesindeki görsellerin çoğu
`image/webp`. Meta `image` mesajında webp kabul etmiyor ve bunu gönderim anında değil
*teslimat* anında reddediyor; yani o görseller gönderilmiş görünüp hiç ulaşmıyordu. Artık
yükleme sırasında jpeg'e çevriliyor (2/3 görsel dönüştürüldü, log'a yazılıyor).

**Açık kalan:**
- Gerçek bir WhatsApp konuşmasında uçtan uca gönderim doğrulanmadı (canlı misafire mesaj
  atmak gerekiyordu). Yükleme + id geçerliliği kanıtlandı, payload şekli unit test'te.
- `insertMessage` hâlâ görsel başına sıralı ve 2 round-trip (insert + conversations update).
  Gönderim hızlandığı için baskın maliyet artık orası; istenirse ayrı iş.

---

# İki kaynak + sessiz devir yok (2026-08-12)

**Olay:** "kargo gönderebilir miyim" sorusunda agent cevap vermeden `needs_human`'a düştü.
Bilgi kütüphanesinde cevap vardı.

**Teşhis:**
- RAG suçsuz — ham misafir mesajı kargo chunk'ını #1 sırada, 0.505 benzerlikle getiriyor
  (eşik 0.22). Turu tekrar oynattım: `escalate: false`, doğru cevap.
- Gerçek sebep: tur exception attı. Kanıt, o saatten sonra hiç assistant mesajı olmaması —
  normal devirde modelin devir cümlesi gönderilirdi. `turn-runner.ts` içindeki **çıplak
  catch** hatayı yutup `needs_human` yazıyordu. Ne attığı kayıtsız kaldığı için
  öğrenilemedi.

- [x] `handoff-decision.ts` — devir kararı saf fonksiyona çıktı. Yeni kural: bilgi
      kütüphanesi ve bağlı sistemler **iki eşit kaynak**; tur, danışılan kaynaklardan
      *biri* cevap verdiyse ayakta kalıyor. Tek bir MCP tool'unun patlaması artık
      kütüphanenin cevapladığı soruyu gömmüyor
- [x] Cevapsız tur (metin yok + rich içerik yok) da devir sebebi — sessizlik cevap değil
- [x] `send-reply.ts` — devir edilirken model metin yazmadıysa, misafirin dilinde devir
      cümlesi gönderiliyor
- [x] `turn-runner.ts` — catch artık hatayı stack'iyle logluyor, misafire devir mesajı
      gidiyor (`metadata.handoff = "turn_failed"`), çift mesaj `replySent` ile engelleniyor
- [x] `handoff-message.ts` — tr/en/de/ru devir cümleleri. Teknik hata dilinden kaçınıyor
- [x] Prompt: bağlı sistemler bloğu artık "iki yarım bir bütün" diyor — MCP boş/hatalı
      dönerse **aynı soruyu `search_knowledge` ile ara**, devir ancak ikisi de boşsa
- [x] Prompt: "asla sessizce devretme, devrettiğini tek cümleyle söyle"

## Review

- 148 test geçiyor (9 yeni: devir kararı 9, devir mesajı 5), `tsc` temiz, lint temiz.
- Gerçek konuşma tekrar oynatıldı: `escalate: false`, cevap bilgi kütüphanesinden geldi.
- Devir kararının her kombinasyonu unit test'te — özellikle "MCP patladı ama kütüphane
  cevapladı → devretme" senaryosu.

**Açık kalan:**
- 14:49'da ne attığı hâlâ bilinmiyor; kanıt o zaman silinmişti. Bir daha olursa log'da olacak.
- MCP url'i `trycloudflare.com` geçici tüneli — süreç durunca ölür, host adı değişir.
  Üretim için kalıcı adres gerekiyor.
- `assistant_claims` hâlâ sadece MCP tool'larını logluyor; `search_knowledge` denetim
  dışında. CLAUDE.md'nin "her iddiayı logla" kuralı yarım.

---

# Model: Sonnet 4.5 → Sonnet 5 (2026-08-12)

**Sebep:** misafir "otel adresi" sorduğunda model **uydurma adres** verdi. Tüm kaynaklar
(MCP `get_hotel_info`, site, bilgi kütüphanesi, hızlı bilgi kartı) aynı adresi söylüyor:
`Rıhtım Cad. Tayyareci Sami Sk. No:17, 34716 Kadıköy`. Modelin yazdığı hiçbir yerde geçmiyor.

**A/B:** aynı konuşma, aynı prompt, aynı tool'lar, geçmiş misafir mesajında kesildi.

| model | sonuç |
|---|---|
| sonnet-4.5 | uydurma adres (`Caferağa, Mühürdar Cd. No:35`) **+ uydurma telefon** `+90 (216) 348 65 46` |
| sonnet-4.6 | cevabı bulamadı, gereksiz yere insana devretti |
| **sonnet-5** | **doğru, kaynağa sadık, adres uydurmadı** |
| haiku-4.5 | "tam detayları göremiyorum" diye geveledi |

4.5 iki ayrı koşuda iki ayrı sahte adres üretti — tek seferlik değil, sistematik.
Ayrıca 4.5 ($3/$15) Sonnet 5'ten ($2/$10) **pahalı**.

- [x] `assistants.model` → `anthropic/claude-sonnet-5` (DB)
- [x] `DEFAULT_MODEL` → `anthropic/claude-sonnet-5` (eskiden gemini-2.5-flash; yedek modelin
      farklı bir ses çıkarması kabul edilemez)
- [x] `MODEL_ALIASES` — sonnet-4 ve sonnet-4.5 kayıtlı configleri sonnet-5'e taşıyor
- [x] `MODEL_OPTIONS` — 4.5 ve 4 kaldırıldı, Sonnet 5 önerilen olarak başa alındı

**Yan bulgu:** konuşma asistan mesajıyla biterken tur çalışırsa 4.6/5 sert hata veriyor
("does not support assistant message prefill"), 4.5 sessizce boş dönüyordu. Üretimde
`isTriggerStillLatest` bunu engelliyor; yine de her iki durum da artık zararsız — boş tur
`saidNothing` ile, hata da catch ile devir mesajına düşüyor.

**Açık kalan:** uydurma spesifik sorunu modelle *azaldı*, çözülmedi. Cevap gitmeden önce
adres/telefon/fiyat/saat gibi spesifikleri o turun kaynak metninde birebir arayan
deterministik guard hâlâ gerekli.

---

# Varsayılan kişi sayısı (2026-08-12)

Misafir kaç kişi olduğunu söylemezse agent duruyor ya da rastgele bir sayı geçiyordu.

**Nereye yazıldı:** MyDora'nın persona metnine (`assistants.system_prompt`), Respondly'nin
ortak prompt'una değil — "2 yetişkin" otelciliğe özgü bir varsayım, CLAUDE.md gereği
paylaşılan prompt'ta yeri yok.

**Neden MCP şemasına değil:** `search_availability.adults` zorunlu alan, `.default(2)`
koymak varsayımı *gizlerdi* — model 2 varsaydığını bilmez, misafire de söyleyemezdi. Yanlış
kişi sayısı için fiyat vermek, sormaktan daha kötü.

Eklenen kural: kişi sayısı söylenmediyse **2 yetişkin / 1 oda** varsay, sorma, ama varsayımı
fiyatla aynı cümlede söyle ("2 kişi için baktım") — düzeltmek tek kelimeye insin.

**Doğrulama:** "yarin icin 2 gece oda lazim" → `search_availability({adults: 2})`, cevap
"13-15 Ağustos, 2 kişi için baktım." ile açılıyor. Soru sorulmadı.

---

# Prompt engineering + persona best practice geçişi (2026-08-12)

**Sorun:** Türkçe cevaplar resepsiyonist gibi değil, doküman gibi. Prompt üslubu neredeyse
tamamen **yasakla** tarif ediyordu: ~30 yasak kalıp, 4 dilde liste, karşılığında 3 tane tek
satırlık örnek. Araştırma bunun tersini söylüyor — gösteri sıfattan ve yasaktan üstün
(3-10 örnekle %88-93 tutarlılık), ve yasak istifi modeli savunmaya sokup düzleştiriyor.

- [x] **Dil sözleşmesi açık yazıldı.** Talimatların hepsi İngilizce; başka dildeki her metin
      *örnek* — asla talimat, asla script, asla hangi dilde cevaplanacağının işareti değil.
      Bir ses çeviriyle gösterilemez, o yüzden örnekler kendi dilinde kalıyor
- [x] **Yasak listesi ~30'dan 5 maddeye indi.** Sadece örneklerden sonra hayatta kalan
      refleksler kaldı (soruyu övmek, söyleyeceğini duyurmak, gereksiz kapanış, hitap kalıbı)
- [x] **Çok turlu Türkçe transkript eklendi.** Tek satırlık örnekler akışı öğretmiyordu:
      ikinci mesajda selam vermemek, her cevaba "başka bir şey?" eklememek, bilmediğini tek
      satırda devretmek. Örnek altında ne *olmadığı* da yazılı
- [x] **`## Writing Turkish` bloğu** — kelime değil **sözdizimi** kuralları: özne düşürme
      (çeviri kokusunun asıl kaynağı), `-maktadır` yasağı, virgülle fiil zincirleme,
      cümle başında bağlaç istifi yok, zorlama üçleme yok, retorik soru-cevap yok, em-dash yok.
      Kelime kara listesi bunların hiçbirine dokunamıyor
- [x] **"Recite etme, söyle"** kuralı — model bilgi kütüphanesinin cümlesini birebir
      kopyalıyordu ("özenle saklanır ve teslim edilir"). Artık okuyup kendi diliyle söylüyor
- [x] Almanca/Rusça örnekler tek satıra indi (v1 Türkçe öncelikli, token disiplini)
- [x] **Koddaki sabit Türkçe düzeltildi:** `"Seçenekler"` iki yerde hardcode'du — Alman
      misafir Türkçe buton görüyordu. `ui-labels.ts` locale'e göre veriyor, `buildListPayload`
      artık `sectionTitleFallback` alıyor

## Review

158 test geçiyor (10 yeni), `tsc` temiz, lint temiz.

Aynı soru, öncesi ve sonrası:

**Önce:** "Evet, kargonuzu otelimize gönderebilirsiniz. Adınıza gelen paketleri *özenle
saklıyor ve size teslim ediyoruz.* Sadece resepsiyonumuzu önceden bilgilendirmeniz
gerekiyor — kargo beklediğinizi ve ne zaman geleceğini. […adres bloğu, uydurma…] Başka
sormak istediğiniz var mı?"

**Sonra:** "Kargonuzu adresimize gönderebilirsiniz, kabul ediyoruz. Yalnız kargo
beklediğinizi resepsiyona önceden bildirmeniz gerekiyor, ismi de kargo geldiğinizde teslim
alacağınız isimle aynı olmalı."

Kütüphane cümlesi kopyalanmıyor, em-dash yok, kuyruk sorusu yok, virgülle bağlanmış.

**Açık kalan:** bu iki örnek, benchmark değil. Asıl kalibrasyon için işletmenin kendi
yazdığı 3-5 konuşma prompt'a örnek olarak girmeli — o zaman ses tahminden çıkıp
işletmenin sesi olur.

---

# Prompt editöründe `@` ile tool mention (2026-08-12)

İstek: system prompt alanında `@` yazınca MCP sunucuları ve tool'ları dropdown'da çıksın,
seçince metne eklensin.

**Kararlar:** eklenen metin `` `tool_adi` `` (Connected Systems bloğu tool'ları zaten
backtick içinde listeliyor — model için tanıdık biçim). Listede MCP tool'larının yanı sıra
yerleşik tool'lar da var, ayrı grup başlığı altında.

- [x] `lib/assistant/mention.ts` — `@` tespiti saf fonksiyon. Kenar durumlar burada:
      e-posta adresi mention değil, boşluk mention'ı kapatır, imleç metnin ortasında olabilir
- [x] `lib/assistant/mentionable-tools.ts` — yerleşik + MCP gruplama, filtreleme. Filtre
      sadece **isimde** arıyor; açıklamada arasa kısa sorgu her şeyi eşlerdi
- [x] `components/assistant/caret-coordinates.ts` — imleç konumu (mirror div). 24rem'lik
      kayan bir kutuda listeyi kutunun altına sabitlemek yazılan kelimeden kopuk düşerdi
- [x] `components/assistant/prompt-mention-textarea.tsx` — shadcn `Popover` + `Command`.
      Odak textarea'dan hiç çıkmıyor; cmdk `shouldFilter={false}` + kontrollü `value` ile
      sadece vurgu için kullanılıyor
- [x] `page.tsx` katalogu sunucudan geçiriyor, `assistant-client.tsx` yeni bileşeni kullanıyor

## Tarayıcıda doğrulanan davranış

| | sonuç |
|---|---|
| `@` tek başına | tam menü açılıyor, iki grup: "Yerleşik araçlar", "My Dora Web Sitesi" |
| `@avail` | tek eşleşme `mydora_search_availability` |
| `@photos` | tek eşleşme `mydora_get_photos` |
| Enter | `@avail` → `` `mydora_search_availability` `` + boşluk, imleç sonda, liste kapanıyor |
| ↓ ↓ ↑ | vurgu doğru dolaşıyor |
| Escape | kapanıyor **ve** takip eden keyup'ta geri açılmıyor |
| yeni `@` | vurgu ilk maddeye dönüyor |
| konum | popover imlecin altında (x=745 vs textarea x=275) |

## Yol boyunca çıkan iki gerçek hata

1. **cmdk `id`'yi eziyor.** `aria-activedescendant` ve `aria-controls` var olmayan
   elemanları gösteriyordu — ekran okuyucu için liste görünmezdi. Id'ler artık ref
   callback'te damgalanıyor (Effect yok, state yok, değerden türetiliyor).
2. **`set-state-in-effect`** — ilk çözüm Effect içinde setState yapıyordu, repo'nun lint
   kuralı haklı olarak reddetti. Ref callback çözümü hem kuralı hem sorunu kapattı.

179 test geçiyor (18 yeni), `tsc` temiz. Kalan 5 lint hatası bu değişiklikten önce de vardı
(inbox-client, carousel, use-mobile, use-inbox-conversation-list, channel-badge).

**Not:** dashboard giriş gerektirdiği için bileşen geçici izole bir sayfada doğrulandı;
sayfa sonrasında silindi. Asistan sayfasındaki gerçek görünüm gözle doğrulanmadı.

---

# "2 kişi için baktım" — kendi yazdığım kötü örneğin düzeltilmesi (2026-08-12)

Kullanıcı haklı olarak takıldı: agent kendi **eylemini** rapor ediyordu. O cümle persona'ya
benim koyduğum örnekti ("varsayımı söyle" kuralının yanına).

Kök sebep: prompt'ta zaten "iç işlemleri duyurma" kuralı vardı ama örnekleri sadece şimdiki
zaman ("Sistemde arıyorum"). Geçmiş zaman "baktım" kuralın dışında kalmıştı.

- [x] Kural her zamana genişletildi: "Baktım", "Kontrol ettim", "I checked" de yasak
- [x] Pozitif kural eklendi: varsayım, cevabın bir **özelliği** olarak görünsün, yaptığın
      işin raporu olarak değil — "2 kişilik odalarımız şöyle", "2 kişi için baktım" değil
- [x] Persona'daki kötü örnek DB'de düzeltildi
- [x] Liste kuralı + **gösterim** eklendi: satırların hepsinde doğru olan şey listenin
      üstünde bir kez söylenir; başlıkta geçen hiçbir şey satırlarda tekrar etmez

## Review

Önce/sonra, aynı soru (`13-20 agustos icin oda lazim`):

**Önce**
> 2 kişi için baktım, 13-20 Ağustos 7 gecelik oda seçenekleri şöyle, hepsi kahvaltı dahil
> Standart Çift Kişilik Oda, 7 gece toplam 36.069 TL …  (× 4 satır)
> Hepsinde ücretsiz iptal imkanı var. Hangisini düşünüyorsunuz?

**Sonra**
> 13-20 Ağustos, 2 kişilik 7 gece için müsait odalarımız şöyle:
> Standart Çift Kişilik: *36.069 TL* ~42.434 TL~  (× 4 satır, sadece fark eden bilgi)
> Hepsi kahvaltı dahil, ücretsiz iptal edilebiliyor. Hangisi ilginizi çekti?

Not: ilk denemede kuralı düz metin olarak yazmak yetmedi — "7 gece toplam" dört satırda
kalmaya devam etti. İyi/kötü örnek çifti eklenince düzeldi. Bu oturumun tekrar eden dersi:
kural anlatmak değil, göstermek işe yarıyor.

179 test geçiyor, `tsc` temiz.

**Açık kalan:** kargo cevabında model hâlâ bilgi kütüphanesinin cümlesini kopyalıyor
("özenle saklanır ve size teslim edilir" — edilgen, doküman dili), oysa "recite etme, söyle"
kuralı ve tam bu cümleyi kötü örnek gösteren madde prompt'ta duruyor. Kalıcı çözüm
işletmenin kendi yazdığı örnek konuşmalar.

---

# Müsaitlik artık interactive list olarak gidiyor (2026-08-12)

Soru: Meta'nın interactive list mesajını destekliyor muyuz? **Evet** — `buildListPayload`
Meta'nın dokümanıyla birebir aynı, limitler de doğru (satır başlığı 24, açıklama 72,
10 satır, buton 20, header/footer 60, body 4096). Webhook `list_reply`'ı okuyor.
Eksik olan, müsaitliğin bu yolla iletilmesiydi.

## Yol boyunca çıkan iki gerçek hata

1. **Sessiz fiyat kaybı.** 3 veya daha az seçenek **buton** olarak gidiyordu ve butonlarda
   `description` yok. 2 oda müsaitse fiyatlar hiç ulaşmayacaktı. `ask_choice` artık
   `descriptionsMatter` alıyor; açıklama gerçek bilgi taşıyorsa transport listeye zorlanıyor.
2. **Biçimlendirme harfiyen görünüyordu.** Fiyat kuralları modele `*36.069 TL* ~42.434 TL~`
   yazmayı öğretiyor, ama liste satırları biçimlendirme render etmiyor — misafir yıldız ve
   tildeleri görürdü. `payloads.ts` içindeki `plain()` artık satır/buton/footer/section
   metinlerinden `*_~\`` işaretlerini kesiyor. Body'ye dokunmuyor (orada render ediliyor).

- [x] `descriptionsMatter` → tool şeması, `ChoiceMessage`, `choiceTransport`, send-reply,
      dashboard önizleme balonu
- [x] `plain()` — interactive chrome düz metin
- [x] Genel prompt: `ask_choice` çağırırken **metin yazma**, soru tool'un `body`'sinde
- [x] MyDora persona: müsaitlik `ask_choice` + `descriptionsMatter: true` ile gönderilir;
      `body` ortak bilgi, `label` ≤24 karakter (kırpılmasın), `description` fiyat,
      `footer` her odada ortak olan

## Review — canlı çıktı

```
body:   "13-20 Ağustos, 2 kişilik 7 gece için müsait odalarımız şöyle. Hangisini uygun görürsünüz?"
button: "Seçenekler"    footer: "Kahvaltı dahil, ücretsiz iptal"
  • Standart Çift Kişilik  (21/24)  "7 gece 36.069 TL (42.434 TL yerine)"
  • Standart İki Yataklı   (20/24)  "7 gece 36.069 TL (42.434 TL yerine)"
  • Aile Odası             (10/24)  "7 gece 44.922 TL (52.849 TL yerine)"
  • Suit                    (4/24)  "7 gece 51.855 TL (61.005 TL yerine)"
4/10 satır, hiçbir başlık kırpılmadı
```

184 test geçiyor (5 yeni), `tsc` temiz, lint temiz.

**Açık kalan:** model listenin yanına hâlâ kısa bir metin satırı yazıyor ("Bekliyorum,
hangisini isterseniz seçebilirsiniz."). Üç prompt denemesi bunu kaldırmadı; en azından artık
yanlış yön belirtmiyor ("yukarıdaki liste" gitti). Kod tarafında kesmek mümkün ama körlemesine
silmek yanlış olur: bazen o metin gerçek bilgi taşıyor ("Otoparkımız yok. Hangi tarih?").

---

# Mesaj bölme kuralı kaldırıldı + cta_url görsel başlığı (2026-08-12)

## 1. "İnsan gibi böl" kuralı

Tek kaynak vardı: `prompt.ts` → *"One idea per message when possible."* Kaldırıldı, yerine
tersi kondu: **"One reply per turn."** — bir tur, tek mesaj; sohbet taklidi için balonlara
bölme yok.

- [x] Kural değiştirildi
- [x] **Yan hata:** model metni tool çağrısının iki yanında yazınca AI SDK parçaları
      **boşluksuz** birleştiriyordu — "…hazırlıyorum.Bağlantıyı hazırladım." Canlı turda
      da görüldü. `separateGluedSentences` cümle sonu + büyük harf birleşmesini onarıyor;
      ondalık, saat ve kısaltmalara dokunmuyor (peşinden büyük harf gelmiyor)

## 2. Aynı şeyi iki balonda söyleme

Ekran görüntüsündeki hata metin bölünmesi değildi: model hem metin yazmış hem de aynı cümleyi
`send_link_button`'ın body'sine koymuştu. `ask_choice`, `send_link_button` ve
`request_location` **kendi body'lerini taşıyor** — o body zaten mesajın kendisi.

- [x] Tek kural, üç bileşen için: bunlardan biri çağrılıyorsa **metin yazma**
- [x] Doğru/yanlış örneği eklendi (kural tek başına yetmiyor, bu oturumun tekrar eden dersi)

## 3. cta_url görsel başlığı

Zaten `cta_url` kullanıyorduk (limitler dokümanla birebir: body 1024, header/footer 60,
display_text 20, template gerekmiyor). Eksik olan başlık görseliydi.

- [x] `buildCtaUrlPayload` → `headerImage` (`{id}` veya `{link}`). Bilerek sadece CTA'da:
      liste mesajının başlığı **metin olmak zorunda**, `trimmings`'e koysaydım Meta'nın
      reddedeceği bir kombinasyon üretilebilirdi
- [x] Görsel **medya cache'inden** geçiyor — buton fotoğrafı da `media_id` ile gidiyor,
      Meta'nın indirmesini beklemiyor
- [x] `send_link_button` → `imageUrl` girdisi; `@` listesinde zaten görünüyor
- [x] Persona: rezervasyon linkinde **her zaman** o odanın fotoğrafı; konuşmada yoksa
      `get_photos` çağrılıp ilki alınır

## Review

197 test geçiyor (5 yeni), `tsc` temiz, lint temiz.

Canlı tur (`13-15 Ağustos, 2 kişi, standart çift kişilik` → bilgiler verildi):
```
toollar: update_contact_profile → search_availability → get_photos
         → create_checkout_link → send_link_button
header:  image → room-163-01.jpg
body:    "13-15 Ağustos, 2 kişilik Standart Çift Kişilik Oda için 2 gece toplam
          *10.305 TL*, kahvaltı dahil ve ücretsiz iptal edilebiliyor. …"
label:   "Rezervasyonu Tamamla" (20/20)
```

**Açık kalan:** model CTA'nın yanına hâlâ kısa bir metin satırı yazıyor ("Rezervasyon
bağlantınız hazır…"). Dört prompt denemesi kaldırmadı. Deterministik kesme mümkün ama
körlemesine silmek yanlış: bazen o metin gerçekten başka bir soruya cevap veriyor.
Ayırt etmek için "bu turda cta/choice dışında bilgi var mı" kontrolü gerekiyor.

---

# Caption zinciri söküldü (2026-08-12)

**Şikayet:** fotoğraf gönderirken agent'ın metni saçmalıyor — "İşte 'dan birkaç".

**Bu modelin hatası değildi.** Model muhtemelen "İşte Standart İki Yataklı Oda'dan birkaç
fotoğraf" yazdı. `stripEmbodiedImageLabels` oda adını **cümlenin ortasından** kesti, Türkçe
eki ortada kaldı.

Neden öyle bir temizleyici vardı: fotoğrafın altına bir caption koyuyorduk, sonra modelin
onu tekrar etmesini engellemeye çalışıyorduk. Ama **o caption'ı da biz uyduruyorduk**:
- MCP fotoğrafları: `extractMcpImages` en yakın objenin `title` alanını caption yapıyordu →
  bir odanın 4 fotoğrafının altında oda adı 4 kez yazıyordu
- `search_knowledge` görselleri: caption = pasaj metninin ilk 150 karakteri → doküman parçası

Yani uydurduğumuz etiketi gizlemek için modelin cümlesini kesiyorduk. İki yanlış.

**Çözüm: caption'ı hiç üretme, temizleyiciyi tamamen sil.**

- [x] `extractMcpImages` artık sadece URL döndürüyor (`captionFor` ve `CAPTION_KEYS` silindi)
- [x] `search_knowledge` görselleri caption'sız
- [x] `stripEmbodiedImageLabels`, `collectImageTextExcludes`, `textExcludes`, `escapeRegExp`
      → hepsi silindi. `formatAssistantMessageText` artık modelin cümlesine dokunmuyor,
      sadece çıplak URL'leri atıyor
- [x] `caption` alanı render tiplerinde **opsiyonel** kaldı — eski satırlar hâlâ taşıyor
- [x] Konuşma listesi önizlemesi: caption'sız medya için "📷 Fotoğraf"
- [x] Prompt: "caption'ı tekrar etme" kuralı artık yanlış (caption yok). Yerine: fotoğraflar
      çıplak gelir, onları tanıtan tek satırı sen yazarsın — set başına bir satır

## Review

213 test geçiyor, `tsc` temiz. Eski davranışı doğrulayan iki test, yerini garantiye bıraktı:
modelin cümlesi **hiç düzenlenmiyor** ("İşte Standart İki Yataklı Oda'dan birkaç fotoğraf."
aynen çıkıyor), çıplak URL yine atılıyor.

**Ders:** iki tur önce bu temizleyiciyi *iyileştirmeye* çalışmıştım — cümle bazlı çalışan,
Türkçe dolgu-kelime listeli bir sürüm. Kullanıcı haklı olarak "böyle statik bir metin
temizleyici mantıklı değil" dedi. Doğru hamle heuristiği inceltmek değil, onu gerektiren
sebebi kaldırmaktı.

(Not: `src/components/ui/carousel.tsx` içindeki lint hatası bu işten değil, başka bir
oturumun eklediği shadcn primitive'inden geliyor.)

---

# Gelen kutusu: rehber kartı davet edilmeden açılıyordu (2026-08-12)

`panelOpen` `useState(true)` ile başlıyordu, yani masaüstünde konuşma seçer seçmez rehber
kolonu geliyordu. Konuşmayı açmak onu **okuma** isteğidir, kişiyi inceleme isteği değil.

- [x] `panelOpen` artık `false` başlıyor (mobil zaten öyleydi). Personel açtığında açık
      kalıyor, konuşma değiştirince kapanmıyor — bileşen aynı route'ta mount kalıyor
- [x] **Yan bulgu:** paneli açan tek kontrol, dropdown içinde **"İç not ekle"** yazan bir
      maddeydi. Yanlış etiket, üstelik gizli. Varsayılanı kapatınca panel fiilen
      ulaşılamaz hale gelirdi
- [x] Başlığa görünür bir düğme kondu (arama düğmesinin yanında): `PanelRightOpen` /
      `PanelRightClose`, `aria-pressed` ile durum bildiriyor, tooltip ve `aria-label`
      **ne yapacağını** söylüyor ("Rehber kartını aç" / "…kapat")
- [x] Yanlış etiketli dropdown maddesi kaldırıldı

213 test geçiyor, `tsc` temiz. Bu dosyadaki iki `set-state-in-effect` lint hatası önceden
vardı (`readOverrides` efektleri), bu değişiklikten değil.

**Doğrulanmayan:** görsel kontrol yapılamadı — `/[slug]/inbox` oturum açmayı gerektiriyor,
kimlik bilgisi girmem doğru olmaz.

---

# Rehber kartı: kolon değil, sağdan açılan sheet (2026-08-12)

Kart masaüstünde kalıcı bir **kolon**du; açılınca sohbetten yer alıyordu, satırlar yeniden
sarılıyordu. Birinin telefon numarasına bakması konuşmanın yeniden dizilmesine sebep olmamalı.

- [x] Tek `detailOpen` durumu — `panelOpen` + `mobilePanelOpen` ikilisi kalktı
- [x] Masaüstündeki kolon dalı silindi; her genişlikte tek `Sheet side="right"`
      (mobil zaten böyleydi, artık iki kod yolu yerine bir tane var)
- [x] `useIsMobile` bu dosyada gereksizleşti, kaldırıldı
- [x] **Çift kapatma düğmesi:** `SheetContent` kendi X'ini çiziyor, panel de `onClose` ile
      bir tane daha koyuyordu. `onClose` artık geçilmiyor
- [x] **Çift kenarlık:** panelin kökü `border-l max-w-sm` taşıyordu (kolon kalıntısı).
      Çerçeveyi artık sheet sahipleniyor

213 test geçiyor, `tsc` temiz. Bu klasörde kalan lint bulgularının hepsi önceden vardı
(`Plus`/`numOrUndef` kullanılmıyor, `readOverrides` efektleri, `<img>` uyarıları).

**Doğrulanmayan:** görsel kontrol — `/[slug]/inbox` oturum açmayı gerektiriyor.

---

# Konum mesajı (send_location) (2026-08-12)

Elimizde `request_location` vardı — bu onun tersi: misafirden konum istemek değil, **kendi
konumumuzu göndermek**. Adresi metne yazmak misafire kopyala-yapıştır işi çıkarıyor; pin'e
dokununca kendi harita uygulaması açılıyor.

- [x] `buildLocationPayload` — Meta koordinatları **string** bekliyor (`type: "location"`,
      latitude/longitude zorunlu, name/address opsiyonel). Etiketlerden biçimlendirme
      işaretleri kesiliyor (pin etiketi render etmiyor)
- [x] `sendWhatsAppLocation`
- [x] `send_location` tool'u — zod ile enlem ±90 / boylam ±180 sınırı. Bu sadece saçmalığı
      yakalar; koordinatın *bu işletmeye* ait olduğunu diğer spesifiklerdeki grounding
      kuralı garanti ediyor
- [x] `location` RichMessage + gönderim + konuşma listesi önizlemesi
- [x] `@` listesinde görünüyor ("Adresi haritada dokunulabilir bir konum olarak gönderir")
- [x] Genel prompt: adres/tarif/buluşma noktası verirken sokağı metne yazma, pin gönder.
      Koordinat o turdaki bir kaynaktan birebir kopyalanır; yoksa **pin gönderme**
- [x] MyDora persona: "Where we are" bölümü

## Review

5 yeni test geçiyor. Canlı deneme (`oteliniz nerede, adres verir misiniz`):

```
toollar: my_dora_get_hotel_info, send_link_button
metin:   "Otelimiz Rıhtım Cad. Tayyareci Sami Sk. No: 17 … adresinde"
```

İlk denemede `send_location` **çağrılmadı** — ve bu doğru davranıştı: o turda hiçbir kaynak
koordinat döndürmüyordu, model de uydurmadı. Grounding kuralı tuttu.

MCP koordinatları döndürmeye başladıktan sonra tekrar koşuldu:

```
>>> "oteliniz nerede, adres verir misiniz"
toollar: my_dora_get_hotel_info, send_location
metin:   "Kadıköy'deyiz, iskeleye yürüyerek 3 dakika, metro durağına da 5 dakika mesafede."
konum:   { latitude: "40.993868", longitude: "29.025558",
           name: "My Dora Hotel",
           address: "Rıhtım Cad. Tayyareci Sami Sk. No: 17, 34716 Kadıköy, Istanbul" }
```

Enlem/boylam doğru sırada (kaynak dizide ters duruyordu, karışmamış), adres MCP'den birebir
kopyalanmış, yanındaki metin **sokağı tekrar etmiyor** — çevreyi anlatıyor. Tek metin + tek pin.

Yanlış yerde tetiklenmiyor:
- "kahvalti saatleri nedir" → pin YOK
- "havalimanindan nasil gelirim" → önce hangi havalimanı diye soruyor, pin YOK

# WhatsApp İşletme Profili: Meta Cloud API yönetim alanı (2026-08-12)

Dashboard'dan çıkmadan WhatsApp'ta değiştirilebilen her şeyi değiştirebilmek. Önceden
`/[slug]/channels` sadece bağlantıyı kuruyordu; profil için WhatsApp Manager'a gitmek
gerekiyordu.

## Done

- [x] Migration `whatsapp_business_profile`: `channels.wa_app_id` kolonu + `whatsapp-profile`
      public bucket (5 MB, **sadece jpeg/png**) + 3 storage policy. Policy stili yazmadan
      önce `pg_policies`'ten okundu: `authorize_for_org(((storage.foldername(name))[1])::uuid,
      'channels.access')` — `knowledge-images` ile birebir aynı.
- [x] Kalıcılık: Meta kaynak-of-truth, `channels.settings.whatsappProfile` ayna. Ayna
      **yalnızca başarılı bir Meta GET'inden sonra** yazılır, asla form girdisinden. Her kayıt
      POST → GET → GET yanıtını aynala (Meta bazı alanları normalize ediyor).
      `channels.settings` bugüne kadar hiç kullanılmıyordu; temiz slot.
- [x] Saf modüller (test edilebilir, `server-only` yok): `business-profile-limits.ts`
      (21 vertical, 139/512/256/128/256×2 limitleri, `sanitizeWebsites`), `graph-errors.ts`
      (`graphErrorToTurkish`), `profile/channel-settings.ts` (`read/writeProfileCache`).
- [x] Graph katmanı: `graph-request.ts` (`graphGet/graphPost`, Meta error zarfı, `cache:"no-store"`),
      `business-profile.ts`, `phone-number-info.ts`, `resumable-upload.ts`, `meta-app.ts`,
      `profile-photo.ts`. `client.ts`'in messages yolu hiç ellenmedi.
- [x] Action'lar `profile-actions.ts` (yeni dosya; `actions.ts` 150 satırda kaldı):
      `saveWhatsAppProfile`, `refreshWhatsAppProfile`, `fetchWhatsAppHealth`,
      `setWhatsAppProfilePhoto`.
- [x] Sayfa `Profil` / `Bağlantı` sekmelerine ayrıldı (`?sekme=`), `channels-client.tsx`
      275 → 133 satır kabuk; kimlik kartı `connection-form.tsx`, webhook kartı `webhook-card.tsx`.
- [x] `profile-form.tsx` (RHF `mode:"onBlur"` + `reValidateMode:"onChange"`, karakter
      sayaçları), `meta-health-card.tsx` (SWR), `profile-photo-field.tsx` (crop → Storage →
      Meta).
- [x] 4 yeni test dosyası + `package.json`'daki `test` script'ine eklendi. 279 test geçiyor.
- [x] `CLAUDE.md` + `.cursor/rules/respondly.mdc`: bayat "Twilio (WhatsApp)" satırları
      düzeltildi (repoda tek bir Twilio referansı yok, sağlayıcı %100 Meta).

## Meta'yla ilgili öğrenilenler

- **Resumable Upload API `Bearer` değil `OAuth` istiyor.** `Authorization: OAuth <token>`.
  Bearer gönderince opak bir hata dönüyor. Graph'ın geri kalanından farklı olan tek yer.
- Adım 1'in döndürdüğü `id` `upload:` önekiyle geliyor ve adım 2'de **olduğu gibi** kullanılıyor;
  önek kırpılırsa 404.
- `/{phone-number-id}/media` (mevcut `media.ts`) **media id** döndürüyor, **handle** değil —
  profil fotoğrafının yerine geçemiyor. App id bu yüzden zorunlu.
- Profil GET'i `fields` query param'ı olmadan neredeyse boş dönüyor; hiç ayarlanmamış bir
  numara `{ data: [] }` veriyor — bu hata değil, boş profil.
- Token'da `whatsapp_business_management` şart; `whatsapp_business_messaging` yetmiyor.
- **webp tuzağı yine burada.** `avatar-crop-dialog.tsx` sabit webp üretiyordu; Meta webp'i
  yükletir, handle verir, `{"success":true}` bile dönebilir ve fotoğraf hiç görünmez —
  mesaj medyasındaki tuzağın birebir aynısı. Üç yerde kapatıldı: dialog'a `outputType` prop'u
  (varsayılan webp, çağıran yerler bit-bit aynı kaldı), sunucuda `normalizeProfilePhoto`
  koşulsuz JPEG'e yeniden kodluyor, bucket `allowed_mime_types` webp'i reddediyor.

## Tasarım kararları

- **Sekme, tek uzun scroll değil.** Bağlantı bir kerelik teknik kurulum, Profil tekrar tekrar
  düzenlenen pazarlama metni — farklı iş, farklı sıklık, farklı kişi. Durum badge'i header'da,
  sekmelerin dışında kaldı.
- **`maxLength` yok.** 140. karakterde tuş vuruşunu sessizce yutmak, özellikle yapıştırmada,
  kırmızı sayaç + gerçek hata mesajından kötü.
- **Kalite rengi semantik token'la.** Temada yeşil/amber yok (`--chart-*` hepsi mavi), tek
  semantik renk `--destructive`. GREEN→`secondary`/"Yüksek", YELLOW→`outline`/"Orta",
  RED→`destructive`/"Düşük". Anlamı kelime taşıyor; SC 1.4.1 de bunu istiyor.
- **44px sadece birincil aksiyonlarda.** Sistem `radix-rhea` ile bilinçli kompakt (h-8).
  `Kaydet` ve fotoğraf butonu `size="xl"` (h-11); input/select sistem ölçeğinde bırakıldı —
  WCAG 2.2 SC 2.5.8 (AA, 24px) geçiyor, 44px AAA. Her yerde istenirse tema kararı, preset ile.
- **Mount'ta otomatik Meta tazeleme yok.** Kullanıcının yazdığını ezme riski var; onun yerine
  görünür `Son eşitleme: …` + açık `Yenile` butonu. Drift görünür, ama sessizce ezilmiyor.
- **Sağlık kartı SWR ile istemcide.** RSC'de yapmak her render'a Vault okuması + Graph turu
  koyardı; token yokken SWR key'i `null`, yani sıfır Graph çağrısı.
- `channel-creds.ts` eklendi ama **sadece yeni kod kullanıyor**; mevcut üç çağrı yerini
  (turn-runner, inbox/actions, webhook route) taşımak ayrı mekanik iş — mesaj teslimat yolu.

## Doğrulama

`npx tsc --noEmit` temiz · `npm run lint` yeni dosyalarda sıfır uyarı (21 mevcut sorun
başka dosyalarda) · `npm run test` 279/279 · `npm run build` başarılı.

Canlı: `my-dora-hotel` kanalında ayna doldu (`syncedAt` 2026-08-12T19:13Z; about, description,
address, email, websites, vertical=HOTEL), `wa_app_id` yazıldı, bucket'ta tek obje —
`image/jpeg`, 80 KB, **640×640**, public URL auth'suz açılıyor. `pictureStoragePath` yalnızca
`updateBusinessProfile(profile_picture_handle)` başarılı dönerse yazıldığı için bu, resumable
upload + handle zincirinin gerçekten çalıştığının kanıtı.

## Açık

- Dashboard sayfasının kendisi bu oturumda görsel olarak doğrulanamadı (giriş gerekiyor).
- Meta'da profil alanını `""` ile **temizleme** semantiği belgelerden doğrulanamadı;
  `buildPatch`'teki "atla vs boş string" mantığı bir kez bilerek test edilmeli
  (email set → boşalt → GET).
- Fotoğraf **silme**: Meta'da `profile_picture_handle`'ı temizlemenin belgelenmiş yolu yok.
  Hiçbir şey yapmayan "Kaldır" butonu bilerek gönderilmedi.
- Sonraki iş: konuşma bileşenleri (`conversational_automation`). `enable_welcome_message`
  açılınca Meta `request_welcome` webhook event'i gönderiyor; `api/whatsapp/webhook/route.ts`
  bunu işlemiyor. Toggle + webhook handler birlikte gitmeli, ayrı ayrı değil.

# Gelen kutusunda tool çipleri: önizlemeyle parite (2026-08-13)

Önizlemede asistan balonunun altında üç çip vardı (Kaynaklar / Araçlar / Tutarsızlık), gelen
kutusunda hiçbiri yoktu. Ekip, gerçek bir konuşmada asistanın hangi aracı çağırdığını ve hangi
kaynağa dayandığını göremiyordu — denetlenebilirliğin tam ters yerde olması.

## Done

- [x] Migration `messages_tool_trace`: `messages.tool_trace jsonb` (nullable) + COMMENT.
- [x] `src/lib/assistant/tool-trace.ts` — `buildToolTrace(toolResults, toolCalls)`. Önizlemenin
      ürettiğiyle **birebir aynı `parts[]` şekli**, çiplerin okuduğu alanlara indirgenmiş.
- [x] `assistant-reply.ts`: `normalizeToolCalls` eklendi (WhatsApp yolunda hiç çağrılmıyordu),
      `AssistantReply.toolTrace` geldi, **ölü `groundedSourceIds` kaldırıldı** (iki dönüş
      noktasında da `[]` sabitti, tek tüketicisi yoktu).
- [x] `conversation.ts` `insertMessage` → `toolTrace` arg + `tool_trace` insert. Uygulamadaki tek
      mesaj yazma hunisi, tek dokunuş her yazıcıya ulaştı.
- [x] `send-reply.ts`: iz, `pending` dizisinin **ilk satırına** iliştiriliyor (bir turn N satır
      üretiyor). Yedi push noktasına bayrak taşımak yerine flush'tan hemen önce tek yerde.
- [x] `src/components/chat/message-chips.tsx` — üç çip + çıkarıcılar `chat-message-bubble.tsx`'ten
      buraya taşındı, tek export `MessageChips`. Balon 813 → 455 satır.
- [x] `queries/inbox.ts`: select + `ThreadMessage.toolTrace` + mapping.
- [x] `inbox-client.tsx`: `MessageChips` render + `SourceDetailSheet`/`getSourceDetailAction`
      bağlantısı (önizlemedeki handler kalıbının aynısı).
- [x] Düşen zengin içerik türleri düzeltildi: `choice`, `location`, `location_request`.
      `send-reply.ts` bunları yazıyordu ama `parseRichContent` işlemiyordu — ekip boş balon
      görüyordu.
- [x] 31 yeni test (`tool-trace.test.ts` 15, `message-chips.test.ts` 16) + `test` script'ine
      eklendi. Toplam 334 test geçiyor.

## Kırpma neden düz kesme değil

İlk niyet output'u 4 KB'de string olarak kesmekti. **Yanlış olurdu:** çipler
`output.passages[].sourceId` gibi yapılandırılmış alanları okuyor; yarısı kesilmiş bir JSON'dan
Kaynaklar çipi hiç çıkmaz. Onun yerine tool bazında **yapı koruyan projeksiyon**:

| Tool | Saklanan |
|---|---|
| `search_knowledge` | `passages[]` → yalnız `{sourceId, sourceName, sourceKind}`; pasaj metinleri (600 kr × N) atılıyor |
| `flag_source_conflict` | input + output bütün (küçük, çip ikisini de istiyor) |
| Diğer hepsi | Yalnız `toolName`; input `safeJson(…, 1024)`, **output atılıyor** |

Araçlar çipi zaten sadece **isim** okuyor; MCP output'u inbox'ta hiçbir şeye yaramıyor çünkü
görseller `rich_content`'ten geliyor. Gerçekçi 5 tool'luk bir turn < 2 KB (testle sabitlendi).

## Neden yeni kolon, `metadata` değil

1. `getConversationHistory` `metadata`'yı seçiyor ve **her model turuna** besliyor — iz oraya
   girseydi her turda context şişerdi. Doğrulandı: `tool_trace`'i yalnız `queries/inbox.ts`
   okuyor.
2. `webhook/route.ts:193` delivery-status geldiğinde `.update({ metadata: { deliveryError } })`
   ile tüm metadata'yı **eziyor** (mevcut hata, `attachments`'ı da siliyor). Oraya veri koymak
   hatanın kapsamını genişletirdi.

## Neden aynı `parts[]` şekli, özel bir tip değil

Tek çıkarıcı seti, iki yüzey. "Bire bir aynı" tip düzeyinde garanti altında — biri değişirse
diğeri de değişiyor, kayamıyorlar.

## Değerlendirilip elenen: `assistant_claims`

Çiplerin kaynağı olarak bakıldı, uygun değil: yalnız MCP tool'larını logluyor (yerleşikler
denetim dışı — bu dosyada zaten kayıtlı), `claim_text` formatlanmış string, `message_id` kolonu
var ama **hiç yazılmıyor**, önizlemede hiç claim yok. Ondan beslenseydi iki yüzey birbirinden
kayardı.

## Doğrulama

`tsc --noEmit` temiz · `lint` yeni uyarı yok (4 mevcut sorun: 2× `set-state-in-effect`,
2× `<img>`) · 334/334 test · `build` başarılı. Model bağlamının şişmediği
`getConversationHistory` select'i okunarak doğrulandı.

## Açık

- **Canlı WhatsApp turu ile doğrulanmadı.** Kod yolu ve saf mantık test altında ama gerçek bir
  `tool_trace` satırı henüz yazılmadı; ilk tool kullandıran WhatsApp mesajından sonra
  `select tool_trace from messages where tool_trace is not null order by created_at desc limit 1`
  ile bakılmalı.
- Önizleme kendi `parts`'ını hâlâ **kırpmadan** saklıyor *ve* `buildPreviewModelMessages` onu her
  sonraki turda modele geri besliyor — fark edilmemiş bir maliyet, ayrı iş.
- `webhook/route.ts:193` metadata ezme hatası duruyor.

---

# Devir ayraçları: asistan → insan, insan → asistan (2026-08-14)

Konuşma akışında gün ayracı (`StickyDayHeading`) var; devir anları için de aynı türden bir
ayraç istiyoruz: asistan ekibe devrettiğinde, ekip devraldığında, konuşma asistana geri
verildiğinde.

## Karar: yeni tablo değil, `messages` içinde `role='system'` satırı

- `messages_role_check` **zaten** `'system'`e izin veriyor, `insertMessage` da alıyor, ama
  bugüne kadar hiçbir şey yazmıyor. `inbox-client.tsx` içinde ölü bir `isSystem` dalı var.
- `getConversationHistory` yalnız `guest|assistant|staff` seçiyor → olay satırları modele
  **hiç** gitmiyor, context şişmiyor.
- Thread keyset sayfalama, realtime, `mergeThreadMessages` olduğu gibi çalışıyor. Ayrı tablo
  ikinci bir sayfalanan akış + ikinci realtime aboneliği demekti; bir ayraç için ağır.
- RLS: `messages_select_inbox` / `messages_write_inbox` (`inbox.access`) aynen geçerli.

## Yapılacaklar

- [x] Migration `conversation_handoff_events`: `sync_conversation_last_message_on_insert`
      `role='system'` satırlarını atlasın (yoksa "Ekip devraldı" konuşma listesinde son mesaj
      olur ve listeyi yeniden sıralar). Unread trigger'ı zaten sadece `guest` sayıyor.
      + `messages.role` COMMENT'ine olay metadata şekli yazılsın.
- [x] `setConversationStatus` **değişti mi** bilgisini döndürsün
      (`.neq("status", status).select("id")`) — aynı statüye tekrar yazmak ayraç üretmemeli.
- [x] `src/lib/inbox/handoff-events.ts` (saf + yazıcı):
      `HandoffEventKind = "handoff_to_human" | "takeover" | "returned_to_assistant"`,
      `handoffEventBody(kind, actorName)` (Türkçe yedek cümle),
      `parseHandoffEvent(metadata)`, `recordHandoffEvent(...)`.
      Metadata: `{ event: { kind, reason? } }`, aktör `sender_user_id`.
- [x] Yazım noktaları: `turn-runner.ts` üç `needs_human` geçişi
      (`no_credentials` / `assistant_escalated` / `turn_failed`),
      `inbox/actions.ts` `takeoverConversation` + `returnToBot` (aktör = kullanıcı).
      `closeConversation` kapsam dışı.
- [x] Okuma: `queries/inbox.ts` → `ThreadMessage.event`, `loadSenders` system satırlarını da
      çözsün (aktör adı "Ali devraldı" için gerekiyor).
- [x] UI: `src/components/chat/thread-event-divider.tsx` — shadcn `Marker variant="separator"`
      + `MarkerIcon` + `MarkerContent` (repoda kurulu, hiç kullanılmamış primitive; özel
      bileşen yazmaya gerek yok). Anlamı **kelime** taşıyor, renk değil; sadece semantik
      token. `MessageBubble` içindeki ölü `isSystem` dalı buraya taşınıyor.
- [x] Testler: `handoffEventBody`, `parseHandoffEvent`, geçiş tekilleştirme.
- [x] Doğrulama: `tsc` + `lint` + `npm run test`; DB'de gerçek geçiş tetiklenip trigger'ın
      atladığı ve satırın doğru şekilde yazıldığı SQL ile kontrol; ayraç görseli geçici
      izole sayfada ekran görüntüsüyle (dashboard giriş istiyor), sonra sayfa silinir.

## Uygulamada plandan sapan iki nokta

1. **Dördüncü geçiş bulundu.** `sendStaffReply` içinde "personel yazdı → statü `human`"
   sessiz bir devralmaydı; plan bunu atlamıştı. Olay satırı personelin mesajından **önce**
   yazılıyor, böylece akış olduğu sırayla okunuyor: biri devraldı, sonra yazdı.
2. **Modül ikiye ayrıldı.** `handoff-events.ts` saf kaldı (tipler, cümle, parse);
   yazıcı `record-handoff-event.ts`'e taşındı. Ayraç istemci bileşeni saf modülü import
   ediyor — `insertMessage` ve altındaki her şey istemci paketine girmiyor.

## Doğrulama

- `tsc --noEmit` temiz · `npm run build` başarılı · **364/364 test** (11 yeni) ·
  `eslint src --quiet` 5 hata, hepsi önceden vardı (inbox-client, carousel, use-mobile,
  use-inbox-conversation-list) — yeni dosyalarda sıfır.
- **Trigger gerçekten atlıyor:** canlı DB'de bir `system` satırı açılıp
  `last_message_at` / `last_message_preview` / `unread_count` üçünün de değişmediği tek
  sorguda ölçüldü, satır sonra silindi.
- **Kontrast ölçüldü** (`/reports/divider-preview` geçici sayfası, sonra silindi):
  açık tema **4.61:1**, koyu tema **8.08:1** — ikisi de AA (4.5:1).
  İlk sürümde saat `text-muted-foreground/70` ile daha soluktu: **2.69:1**, kaldı.
  Saat artık cümlenin parçası, ayrı bir soluk eleman değil.
- 375 px'te yatay taşma yok (`scrollWidth == clientWidth`), en uzun cümle tek satır.
- Anlamı kelime taşıyor; ikon tekrar ediyor, renk hiçbir şey taşımıyor (SC 1.4.1).

## Açık

- **Gerçek bir devir henüz üretmedi.** Kod yolu ve saf mantık test altında, ayraç geçici
  sayfada göze doğrulandı; ama `/[slug]/inbox` giriş istediği için gerçek "Devral"
  düğmesine basılmadı. İlk devirden sonra:
  `select role, body, metadata from messages where role = 'system' order by created_at desc limit 5;`
- Ayraç `closed` için yok (bilerek). Konuşma kapanışı devir değil.
- `webhook/route.ts:193` metadata ezme hatası hâlâ duruyor — `system` satırlarını
  etkilemiyor (delivery status yalnız `provider_message_id`'si olan satırları buluyor).

---

# Gelen kutusu: varsayılan seçim, scroll zıplaması, ortak konuşma yüzeyi (2026-08-14)

## 1. Gelen kutusu açılınca en üstteki konuşma seçili

- [x] `page.tsx`: `activeId = istenen ?? conversations[0]?.id`. **Yönlendirme yok** —
      `?c=` yalnızca bilinçli seçimin kaydı olarak kalıyor, adres çubuğu kendi kendine
      yeniden yazılmıyor. Liste sırası zaten sabitlenmiş (önce sabitlenenler, sonra en yeni).
- [x] Breadcrumb'daki "Gelen Kutusu" **link olmaktan çıktı**: artık her zaman bir konuşma
      açık, dönülecek daha boş bir sayfa yok. (Link kalsaydı kendi üstüne dönen ölü bir
      bağlantı olurdu.)

**Yan etki, bilerek:** açılışta en üstteki konuşma okundu sayılıyor (mevcut
`markConversationRead` efekti `activeId` üzerinden çalışıyor). Okuma bölmesi olan her
posta istemcisinde böyle; istenmezse ayrı iş.

## 2. Yukarı scroll'da zıplama

**Kök sebep, iki tane:**
1. Asıl olan: **spinner'ın kendisi**. `loadingOlder` true olunca içeriğin *üstüne* bir
   spinner giriyordu; eski kod ise düzeltmeyi yalnız `messages` değişince (`useLayoutEffect`
   deps) yapıyordu. Yani zıplamanın ilk yarısı hiç telafi edilmiyordu.
2. Fotoğraflar. Düzeltme 1000 ms'lik sabit bir pencereyle tutuluyordu; imzalı URL geç
   çözülünce pencere kapanmış oluyordu.

- [x] `src/lib/inbox/pin-scroll.ts` — `pinScrollFromBottom(viewport)`. Commit sınırlarına
      değil, **içeriğin kendisine** bağlı: sayfa istendiği anda başlıyor, `ResizeObserver`
      her büyümede *alttan uzaklığı* yeniden uyguluyor, içerik 400 ms kımıldamayınca
      bırakıyor (tavan 10 sn). Okuyucu kendi kaydırırsa **anında** bırakıyor — pin hiçbir
      zaman kullanıcıyla güreşmiyor.
- [x] `inbox-client.tsx`: `anchorRef` + `useLayoutEffect` + `ANCHOR_HOLD_MS` gitti,
      yerine tek `pinRef`. En alta zıplayan efekt de `pin.active` iken susuyor.
- [x] 8 test (`pin-scroll.test.ts`): sahte viewport + sahte `ResizeObserver` + mock timer.
      Ard arda üç büyüme (spinner → sayfa → foto) tek bir alttan-uzaklıkta kalıyor;
      okuyucu kaydırınca bırakıyor; kendi düzeltmesini kullanıcı hareketi sanmıyor.

**Not:** tarayıcı sekmesi `document.hidden` olduğu için önizleme panelinde `ResizeObserver`
hiç tetiklenmiyor (arka plan sekmesinde render kısılıyor). Ölçüm oradan yapılamadı;
davranış bu yüzden birim testine alındı.

## 3. Önizleme ile gelen kutusu aynı konuşma yüzeyinde

- [x] `src/components/chat/thread-surface.tsx`: `ThreadScroller` (bg-sidebar, px-6,
      `overflow-anchor:none`), `ThreadColumn` (`mx-auto max-w-3xl py-6`), `ThreadDayGroup`
      (`gap-5 pb-5`), `ThreadTypingIndicator` (`side` ile hangi kenardan konuştuğu).
- [x] Gelen kutusu bu bileşenlere taşındı — görsel çıktı bit bit aynı, sınıflar tek yerde.
- [x] Önizleme (canlı + geçmiş oturum + iskelet + boş durum) aynı yüzeye geçti:
      px-5/py-4 ve `gap-4` gitti, sohbet alanı artık 48rem'lik kolon ve aynı zemin.
- [x] `preview-composer.tsx` gelen kutusunun çerçevesini aldı: üstte kenarlık, `px-6 py-4`,
      içerideki kutu `mx-auto max-w-3xl`.

**Sınır bilerek çizildi:** balonlar ortaklaşmadı. Gelen kutusu `ThreadMessage` satırı
okuyor, önizleme model `parts`'ı; üstelik ikisi **ayna** — misafir gelen kutusunda karşı
tarafta, önizlemede yazan kişinin kendisi. Ortak olan yüzey, mesaj değil.

**Gün ayracı önizlemeye konmadı:** canlı önizleme mesajlarında zaman damgası yok
(model `parts`), geçmiş oturumda var. Yalnız birinde olsa önizlemenin iki hâli birbirinden
ayrılırdı.

## Doğrulama

`tsc` temiz · `npm run build` başarılı · **372/372 test** (8 yeni) · lint 5 hata, hepsi
önceden vardı.

**Açık:** gelen kutusu ve önizleme sayfaları giriş istediği için üçünün de görsel kontrolü
yapılamadı. Ayraç bileşeni geçici genel sayfada doğrulanmıştı; yüzey taşıması sınıf sınıf
birebir kopyalandı, scroll pin ise birim testinde.

## Ek: balonlar da ortaklaştı (aynı gün)

İlk turda yalnız **yüzey** ortaklaşmıştı; kullanıcı haklı olarak "arayüz hâlâ farklı" dedi.
Sebep: iki ayrı balon bileşeni vardı — gelen kutusu kendi `MessageBubble`'ını çiziyordu
(kuyruklu köşe, `bg-card`/`bg-primary`, avatar + isim + saat), önizleme ise
`ChatMessageBubble`'ı (kuyruksuz, `bg-muted`, avatarsız, saatsiz).

- [x] `src/components/chat/message-row.tsx` — `MessageRow` (avatar / mesaj / künye
      ızgarası), `Bubble` (`speaker` + `side`), `MessageMeta` (isim · saat).
      **Renk sese bağlı, kenara değil:** işletme her iki yüzeyde de dolu balon, kişi her
      ikisinde de çerçeveli. Kuyruk köşesi ise konuşulan kenara bakıyor.
- [x] Gelen kutusunun `MessageBubble`'ı bu ilkellere taşındı — iki `if` dalı tek satıra
      indi, `GUEST_BUBBLE_CLASS` / `OUTBOUND_BUBBLE_CLASS` silindi. Görsel çıktı aynı.
- [x] `ChatMessageBubble` aynı satıra taşındı: artık avatarı, kuyruğu, künyesi var.
      Önizlemede renkler **ters çevrildi** — test eden kişi misafiri oynadığı için
      çerçeveli balon onun, dolu balon asistanın (gelen kutusundaki anlamla aynı).
- [x] `createdAt` opsiyonel prop olarak geldi: geçmiş oturumda saat görünüyor, canlı turda
      görünmüyor (model `parts`'ında zaman damgası yok).
- [x] Önizleme kişisinin avatarı boş gri daireydi; telefon numarası olmadığı için desen
      üretilemiyor — `UserRound` figürü kondu.
- [x] `preview-sheet.tsx` de aynı yüzeye alındı (kendi `ScrollArea`'sı, `gap-4` ve
      elle yazılmış "yazıyor…" satırı gitti).

**Doğrulandı:** iki yüzey geçici bir genel sayfada yan yana çizilip açık ve koyu temada
ekran görüntüsüyle karşılaştırıldı — balon, avatar, künye, aralık ve zemin aynı. Sayfa silindi.
`tsc` temiz · 372/372 test · lint 5 (hepsi önceden).

## Ek 2: önizlemede yazan kişi, giriş yapmış kullanıcının kendisi

Önizlemede misafiri oynayan kişi gerçek bir müşteri değil, o an giriş yapmış kullanıcı.
Balon jenerik bir figür gösteriyordu — kendi yüzünü göstermeliydi.

- [x] `ChatMessageBubble` → `author?: { name, avatarUrl }`. Varsa profil fotoğrafı,
      yoksa isimden üretilen baş harfler + desen; isim de yoksa `UserRound` figürü.
- [x] `preview-client.tsx` ve `preview-sheet.tsx` `useUser()` ile kendi profillerini
      geçiyor (bağlam `/[slug]` layout'unda zaten var; balon sunum bileşeni olarak kaldı,
      kimliği yüzey veriyor).
- [x] `preview-sheet` geçmiş oturumunda saat de eksikti, `createdAt` geçildi.

## Ek 3: kuyruk köşesi

- [x] `rounded-bl-none` / `rounded-br-none` → `rounded-*-sm`. Ölçüldü: kuyruk köşesi
      **6.375 px**, diğer üçü 19.125 px. Sert 90° bu ölçekte kırpma hatası gibi
      okunuyordu; küçük yarıçap hâlâ konuşanı işaret ediyor.

**Doğrulandı:** ekran görüntüsüyle — "EE" baş harfleri, isimsiz kullanıcı için figür,
gelen kutusundaki personel balonuyla (AD) aynı dil. Geçici sayfa silindi.

---

# Webhook gecikmesi: tek RPC + kısaltılmış debounce

Mesaj → cevap süresinin kontrol edilebilir kısmı iki yerdeydi: gereksiz sıralı
Supabase gidiş-dönüşleri ve kendi koyduğumuz sessizlik penceresi.

## Yapılanlar

- [x] `TURN_DEBOUNCE_MS` 4000 → **2500**. Arka arkaya mesaj atanı hâlâ yakalıyor,
      cevaptan 1.5 sn kesiyor.
- [x] **`record_inbound_whatsapp_message` RPC**: contact upsert + conversation
      get/create + message insert tek statement. Webhook'un mesaj başına yaptığı
      **4 gidiş-dönüş → 1**.
- [x] `sync_conversation_last_message` trigger'ı zaten `last_message_at` ve
      `last_message_preview` yazıyordu; `insertMessage` bunları ikinci bir UPDATE
      ile tekrar yazıyordu. UPDATE silindi — **her mesaj yazan yol** (asistan
      cevabı, personel mesajı, handoff) bir gidiş-dönüş kazandı.
- [x] Trigger ekleri: ek dosyası varsa önizleme dosya adını yazıyor
      (`messagePreviewFromInsert` ile aynı), `UPDATE OF metadata` üzerinde de
      çalışıyor, `last_message_at <= new.created_at` koşulu geç yazımın
      konuşmayı geriye çekmesini engelliyor.

## Yan bulgular (aynı yolda çıktı, düzeltildi)

- [x] **Yarış:** `(channel_id, guest_phone)` üzerinde unique kısıt yok ve
      `getOrCreateConversation` select-then-insert yapıyordu — aynı anda gelen
      iki mesaj iki ayrı konuşma açabiliyordu. RPC içinde advisory lock.
      Ölçüldü: 5 eşzamanlı yazım → 1 konuşma (öncesinde 5'e kadar).
- [x] **Contact alanları:** kod "ilk görüşte doldur, sonra üzerine yazma" diyordu
      ama upsert her mesajda `first_name`/`last_name`/`country` üzerine yazıyordu.
      RPC `coalesce(mevcut, yeni)` ile yorumdaki niyeti uyguluyor.
- [x] **Medya sırası:** satır artık önce yazılıyor, dosya Meta'dan inince
      iliştiriliyor. Mesaj gelen kutusunda indirmeyi beklemeden görünüyor.

## Doğrulama

- SQL seviyesinde rollback'li senaryo: yeni/mevcut contact, personel düzeltmesinin
  korunması, önizleme `📎 Ek` → `📎 fatura.pdf`.
- Gerçek Supabase client üzerinden uçtan uca: 5 alan doğru döndü, ikinci mesaj
  aynı konuşmayı kullandı, 5 eşzamanlı yazım tek konuşma, artık kayıt kalmadı.
- `tsc --noEmit` temiz, dokunulan dosyalar `eslint` temiz, 381 test geçiyor.

---

# "Seçenekler yukarıda" — sıralama yanılgısı (2026-08-14)

**Şikayet:** oda sorulunca agent önce "tüm seçenekler yukarıda" yazıyor, carousel *sonra*
gidiyor. Yani işaret ettiği şey aslında altta kalıyor.

**Gerçek kayıt** (`90338562…`, 13 Ağu):

| saat | mesaj |
|---|---|
| 14:40:57.049 | "Buyurun, tüm seçenekler yukarıda." |
| 14:40:57.434 | carousel (4 oda) |

Metin, carousel'den **0.4 sn önce** gitmiş. `sendAssistantReply` her zaman önce metni,
sonra zengin mesajları gönderiyor — doğru davranış, ama modelin bunu bilmesinin **hiçbir
yolu yoktu**. İki kör nokta:

1. **Tur içinde:** tool'lar `queued: true` dönüyordu. Model bunu "gönderildi" diye okuyor,
   sonra "yukarıda" yazıyor. Teslimat sırası hiçbir yerde söylenmiyordu.
2. **Turlar arası:** `buildWhatsAppModelHistory` yalnız `body`'yi geri veriyordu. Carousel
   geçmişte düz bir cümle olarak görünüyor, **fotoğraflar hiç görünmüyordu** (gövdesi boş).
   Yani model ne carousel gönderdiğini görebiliyor ne de kendi sözünün nereye düştüğünü.
   Kanıt yoksa ders de yok.

## Çözüm — yasak değil, eksik bağlam

- [x] `src/lib/assistant/delivery.ts` — teslimat gerçeği tek cümlede, tek yerde.
- [x] Zengin tool'ların çıktısına `delivery` alanı: `ask_choice`, `show_carousel`,
      `send_link_button`, `send_location`, `request_location`. Artık `queued: true`'nun
      yanında "henüz gönderilmedi, cevabından **sonra** gidiyor, yani **altında** görünür"
      yazıyor.
- [x] `search_knowledge` görselli sonuç dönerse `imageDelivery` aynı gerçeği söylüyor.
- [x] **MCP tool sonuçları da:** `wrapTool` görsel taşıyan bir sonuca `imageDelivery`
      ekliyor. Üçüncü taraf sunucu bunu söyleyemez, biz söylüyoruz.
- [x] `src/lib/assistant/rich-summary.ts` — geçmişte her zengin mesaj ne olduğunu söylüyor:
      `[you sent a carousel (Standart Çift Kişilik Oda, Aile Odası, +2 more) here]`,
      `[you sent a photo here]`, `[you sent a link button ("Rezervasyonu Tamamla") here]`.
      Kart etiketi kartın **ilk satırı** (gövdenin tamamı özeti mesajın kopyasına çevirirdi).
- [x] `getConversationHistory` artık `rich_content`'i de seçiyor; `tool_trace` bilerek dışarıda
      (o ekibin gözü için).
- [x] Prompt'taki tek muğlak cümle düzeltildi ("it always arrives first" — nesnesi belirsizdi).
      Yerine transportu **tarif eden** bir paragraf: sözlerin önce gider, tool'un kuyruğa
      aldığı her şey altına düşer. Yeni yasak eklenmedi.

## Doğrulama

Gerçek satır şekilleriyle `buildWhatsAppModelHistory` çıktısı:

```
assistant | Buyurun, tüm seçenekler yukarıda.
assistant | 18-21 Ağustos … müsait odalarımız  ⏎  [you sent a carousel (Standart Çift Kişilik
            Oda, Standart İki Yataklı Oda, Aile Odası, +1 more) here]
assistant | İşte Suit'ten birkaç fotoğraf.
assistant | [you sent a photo here]
assistant | [you sent a photo here]
assistant | Standart Çift Kişilik Oda için toplam *15.435 TL*.  ⏎  [you sent a link button
            ("Rezervasyonu Tamamla") here]
```

Fotoğraflar önce **tamamen kayıptı**; artık sırayla görünüyor ve "yukarıda" cümlesinin
carousel'den önce geldiği geçmişte açıkça okunuyor.

`tsc` temiz · **382/382 test** (10 yeni) · lint 5 (hepsi önceden).

**Açık:** canlı bir WhatsApp turuyla modelin artık "yukarıda" demediği ölçülmedi — gerçek
misafire mesaj gitmesi gerekiyordu. Bağlam tarafı kanıtlandı, davranış tarafı bir sonraki
gerçek turda görülecek.

---

# Cloudflare hotlink koruması: panelde görseller kayboldu (2026-08-14)

`Error 1011 / Access denied` — `www.mydorahotel.com` Cloudflare'e geçtikten sonra
hotlink koruması açık. Ölçtüm:

| istek | sonuç |
|---|---|
| referer yok (curl, `node fetch`) | **200** |
| `Referer: http://localhost:3000/…` | **403** |
| `Referer: https://www.mydorahotel.com/` | 200 |

Yani sorun **yalnız tarayıcı tarafında**: panel bir oda fotoğrafını `<img>` ile
isteyince tarayıcı kendi sayfasını referer olarak yolluyor, Cloudflare bunu başka
sitenin gömmesi sayıp reddediyor. Sunucu tarafı (Meta'ya yükleme, `media-cache`,
bilgi kütüphanesi taraması) referer göndermediği için hiç etkilenmemiş — misafire
giden fotoğraflar sağlamdı.

- [x] `src/components/remote-image.tsx` — bizim barındırmadığımız her görsel
      `referrerPolicy="no-referrer"` ile isteniyor. Kaybedilen bir şey yok; referer
      zaten yalnız ekibin hangi panel sayfasında olduğunu karşı tarafa sızdırıyordu.
- [x] Kullanıldığı yerler: gelen kutusu zengin görseli + carousel kartı,
      `chat-message-bubble` zengin görseli + carousel kartı. Depoladığımız görseller
      (Supabase storage: bilgi kütüphanesi, medya kitaplığı, ekler) değişmedi.

**Tarayıcıda ölçüldü** (`localhost:3000`, cache-bust'lı URL):

```
plain <img>            → ok: false
referrerPolicy no-ref. → ok: true, 7952×5304
bileşenin DOM'daki hali → referrerPolicy = "no-referrer"
```

`tsc` temiz · 382/382 test · lint 5 (hepsi önceden).

**Yan bulgu:** o fotoğraf **7952×5304**. Panelde 96–192 px'lik bir kutuya çiziliyor,
yani her kart için onlarca megapiksel indiriliyor. Meta'ya giden kopya
`image-normalize` sayesinde küçülüyor ama panelin gördüğü ham dosya. Ayrı iş:
panelde bir görsel proxy'si (boyutlandırma + tek origin) hem bunu hem hotlink
sorununu kökten kapatır.

---

# Vercel'e hazırlık (2026-08-14)

Proje `Projects/MyDora/Respondly` → `Projects/LittleBigApps/Respondly` taşınmış ve git
repo'suna alınmış (`d08b878 Initial commit`). Aşağıdakiler yeni konumda yapıldı.

## Eklendi

- [x] `.env.example` — 18 değişkenin tamamı, zorunlu/opsiyonel ayrımı ve nereden alınacağı
      yazılı. `.gitignore` zaten `.env.*`'ı kesip `!.env.example`'a izin veriyor.
- [x] `vercel.json` — `regions: ["lhr1"]`. Supabase `eu-west-2`'de; her istek turunda
      birkaç DB gidiş-dönüşü var, fonksiyonu veritabanının yanına koymak gecikmeyi
      doğrudan düşürüyor. **Cron bilerek konmadı:** işi Supabase `pg_cron` tetikliyor,
      ikinci bir zamanlayıcı her turu iki kez koşturur.
- [x] `package.json` → `engines.node: "22.x"`.
- [x] README baştan yazıldı: create-next-app kalıntısı gitti; ortam değişkeni tablosu,
      adım adım Vercel dağıtımı, Meta webhook adresi, Vault `app_url` güncellemesi,
      dağıtım sonrası kontrol listesi ve bilinen sınırlar.
- [x] `src/lib/supabase/client.ts` — eksik `NEXT_PUBLIC_*` için **hangi değişkenin**
      eksik olduğunu ve nereye konacağını söyleyen hata. Kütüphanenin kendi mesajı
      ("URL and API key are required") ne değişkeni ne de yeri söylüyordu; build
      prerender sırasında bununla patlıyor.
- [x] `public/images/logo-dark.png` — **gerçek bir üretim hatası**: davet e-postası
      `${APP_URL}/images/logo-dark.png` istiyordu ama `public/images/` hiç yoktu.
      Dağıtımdan sonra her davet e-postasında logo kırık gelecekti.

## Zaten hazırdı

Uzun iş yapan uçlar `runtime = "nodejs"` + `maxDuration = 60` taşıyor (webhook, asistan
sohbeti, üç cron ucu). `serverExternalPackages: ["@mastra/mcp"]` yerinde. `sharp` doğrudan
bağımlılık. epub çıkarımı `os.tmpdir()` kullanıyor (Vercel'de yazılabilir).

## Doğrulama

`tsc` temiz · **382/382 test** · `npm run build` iki public değişken verilince **başarılı**
(prerender edilen `/signup`, `/login`, `/reset-password` dahil).

## Dağıtımdan önce/sonra yapılacaklar (kod değil, ayar)

1. **`.env.local` taşınma sırasında kayboldu** — eski klasörde de yok. Değerler yeniden
   toplanmalı: Supabase (proje ayarları), OpenRouter, Meta (app secret + verify token),
   Resend. `CRON_SECRET` Vault'taki `knowledge_cron_secret` ile aynı olmalı; o değer
   Vault'ta duruyor.
2. Vercel'de aynı adlar Production ortamına girilmeli. `APP_URL` = üretim alan adı.
3. **Supabase Vault `app_url` hâlâ `http://localhost:3000`.** Cron'lar oraya POST ediyor,
   yani bilgi kütüphanesi yenileme/ingest üretimde hiç çalışmayacak. Dağıtımdan sonra
   `vault.update_secret` ile alan adına çevrilmeli (SQL README'de).
4. Meta webhook callback URL'i yeni alan adına çevrilmeli.
5. `CRAWL4AI_BASE_URL` yalnız Vercel'den erişilebilir bir adresse anlamlı; laptoptaki
   docker değil.
