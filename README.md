This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## WhatsApp ortam değişkenleri

`.env.local` içinde tanımlanır. Kanala özel kimlik bilgileri (Phone Number ID,
WABA ID, access token) buraya değil, dashboard'daki **WhatsApp → Bağlantı**
sekmesine girilir; access token Supabase Vault'ta saklanır.

| Değişken | Zorunlu | Ne işe yarar |
|---|---|---|
| `WHATSAPP_APP_SECRET` | evet | Gelen webhook imzasının (`X-Hub-Signature-256`) doğrulanması. |
| `WHATSAPP_VERIFY_TOKEN` | evet | Meta'nın webhook doğrulama handshake'i. |
| `WHATSAPP_GRAPH_VERSION` | hayır | Graph API sürümü. Varsayılan `v25.0`. |
| `WHATSAPP_APP_ID` | hayır | Profil fotoğrafı yüklemek için kullanılan Resumable Upload API'nin app id'si. Sadece varsayılan olarak kullanılır: önce kanalın `wa_app_id` alanına, o da boşsa buraya, o da boşsa access token'dan otomatik keşfe bakılır. |
| `APP_URL` | evet | Meta'ya verilecek webhook callback adresinin kökü. |

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
