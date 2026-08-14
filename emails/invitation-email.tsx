import * as React from "react"
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components"

// Dev: /static/ served by React Email preview server (from emails/static/)
// Production: APP_URL/images/ served by Next.js (from public/images/)
const logoUrl = process.env.APP_URL
  ? `${process.env.APP_URL}/images/logo-dark.png`
  : "/static/logo-dark.png"

function getInitials(name?: string): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Inline-table avatar that works across email clients.
// border-radius: 50% renders correctly in Gmail, Apple Mail, Outlook.com.
// Outlook for Windows shows a square — acceptable fallback.
function Avatar({
  src,
  name,
  size = 64,
  shape = "circle",
}: {
  src?: string
  name?: string
  size?: number
  shape?: "circle" | "rounded"
}) {
  const borderRadius = shape === "circle" ? "50%" : "14px"

  if (src) {
    return (
      <Img
        src={src}
        width={size}
        height={size}
        alt={name ?? ""}
        style={{ borderRadius, display: "block" }}
      />
    )
  }

  return (
    <table
      width={size}
      cellPadding={0}
      cellSpacing={0}
      style={{
        borderRadius,
        backgroundColor: "#f4f4f5",
        display: "inline-table",
        width: size,
        height: size,
      }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            valign="middle"
            style={{
              fontSize: Math.round(size * 0.34),
              fontWeight: 600,
              color: "#71717a",
              fontFamily: "Inter, Arial, sans-serif",
            }}
          >
            {getInitials(name)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

interface InvitationEmailProps {
  // Person being invited — name is optional (inviter may not have provided it)
  inviteeName?: string
  // Person sending the invite
  inviterName?: string
  inviterEmail?: string
  inviterAvatarUrl?: string
  // Organization
  organizationName?: string
  orgLogoUrl?: string
  // Invitation details
  role?: string
  inviteLink?: string
  expiresInDays?: number
}

export const InvitationEmail = ({
  inviteeName,
  inviterName,
  inviterEmail,
  inviterAvatarUrl,
  organizationName,
  orgLogoUrl,
  role,
  inviteLink,
  expiresInDays = 7,
}: InvitationEmailProps) => {
  return (
    <Html lang="tr">
      <Head>
          <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
          {/* Load Inter with latin-ext subset to support Turkish characters (ş, ğ, ı, ö, ü, ç) */}
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&subset=latin,latin-ext&display=swap');
          `}</style>
        </Head>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              fontFamily: {
                sans: ["Inter", "Arial", "sans-serif"],
              },
            },
          },
        }}
      >
        <Body className="mx-auto my-auto bg-[#edf0f3] px-[8px] font-sans">
          <Preview>
            {inviterName ?? inviterEmail ?? ""} seni {organizationName ?? ""} ekibine davet etti
          </Preview>

          {/* Logo — outside the white card, on the gray background */}
          <Section className="pt-[48px] pb-[40px]" style={{ backgroundColor: "#edf0f3" }}>
            <Img
              src={logoUrl}
              width="120"
              height="65"
              alt="My Dora Hotel"
              className="mx-auto my-0"
            />
          </Section>

          <Container className="mx-auto mb-[24px] max-w-[520px] rounded-xl border border-solid border-[#e4e4e4] bg-white px-[40px] py-[52px]">

            {/* Heading */}
            <Heading className="mx-0 mt-[8px] mb-[44px] p-0 text-center text-[22px] font-normal text-black">
              <strong>{organizationName}</strong> ekibine davet edildiniz.
            </Heading>

            {/* Greeting — skip name if not provided */}
            <Text className="text-[16px] leading-[28px] text-black">
              {inviteeName ? `Merhaba ${inviteeName},` : "Merhaba,"}
            </Text>

            {/* Invitation message */}
            <Text className="text-[16px] leading-[28px] text-black">
              {inviterName ? (
                <>
                  <Link href={`mailto:${inviterEmail}`} className="text-black no-underline">
                    {inviterName}
                  </Link>
                  {" "}sizi {organizationName} ekibine {role} olarak davet etti.
                </>
              ) : (
                <>
                  <Link href={`mailto:${inviterEmail}`} className="text-blue-600 no-underline">
                    {inviterEmail}
                  </Link>
                  {" "}sizi {organizationName} ekibine {role} olarak davet etti.
                </>
              )}
            </Text>

            {/* Avatars row — inviter on left, org on right */}
            <Section className="my-[36px]">
              <Row>
                <Column align="right">
                  <Avatar src={inviterAvatarUrl} name={inviterName ?? inviterEmail} size={72} />
                </Column>
                <Column align="center" style={{ width: 48 }}>
                  <Text
                    className="m-0 text-center text-[22px] text-[#cccccc]"
                    style={{ letterSpacing: "-2px" }}
                  >
                    →
                  </Text>
                </Column>
                <Column align="left">
                  <Avatar src={orgLogoUrl} name={organizationName} size={72} shape="rounded" />
                </Column>
              </Row>
            </Section>

            {/* CTA */}
            <Section className="mb-[36px] mt-[40px] text-center">
              <Button
                href={inviteLink}
                className="rounded-xl bg-[#000000] px-[36px] py-[14px] text-center text-[15px] font-semibold text-white no-underline box-border"
              >
                Daveti Kabul Et
              </Button>
            </Section>

            {/* "veya" divider */}
            <Section className="my-[0px]">
              <Row>
                <Column>
                  <Hr className="mx-0 my-0 w-full border border-solid border-[#f0f0f0]" />
                </Column>
                <Column style={{ width: 60 }}>
                  <Text className="m-0 text-center text-[12px] text-[#999999]">
                    veya
                  </Text>
                </Column>
                <Column>
                  <Hr className="mx-0 my-0 w-full border border-solid border-[#f0f0f0]" />
                </Column>
              </Row>
            </Section>

            {/* Fallback link */}
            <Text className="text-[15px] leading-[26px] text-black" style={{ marginTop: 36, marginBottom: 6 }}>
              Bağlantıyı tarayıcınıza kopyalayın:
            </Text>
            <Section
              style={{
                backgroundColor: "#f4f4f5",
                borderRadius: "12px",
                padding: "10px 14px",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#374151",
                  fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
                  wordBreak: "break-all",
                }}
              >
                {inviteLink?.includes("://") ? (
                  <>
                    <span style={{ color: "#374151" }}>
                      {inviteLink.split("://")[0]}://
                    </span>
                    <span style={{ color: "#374151" }}>
                      {inviteLink.split("://")[1]}
                    </span>
                  </>
                ) : inviteLink}
              </Text>
            </Section>

          </Container>

          {/* Fine print + footer — outside the white card, same max-width as container */}
          <Container className="mx-auto max-w-[520px] px-[40px] pt-[24px] pb-[48px]" style={{ backgroundColor: "#edf0f3" }}>
            <Text className="m-0 text-center text-[12px] leading-[20px] text-[#999999]">
              {inviteeName ? (
                <>Bu e-posta <span style={{ color: "#666666" }}>{inviteeName}</span> için gönderildi. </>
              ) : (
                <>Bu e-posta size özel gönderildi. </>
              )}
              Davet <span style={{ color: "#666666" }}>{expiresInDays} gün</span> içinde geçerli.
              Beklediğiniz bir davet değilse bu e-postayı yoksayabilirsiniz.
            </Text>
            <Text className="m-0 mt-[12px] text-center text-[12px] text-[#999999]">
              © {new Date().getFullYear()} My Dora · Tüm hakları saklıdır.
            </Text>
          </Container>

        </Body>
      </Tailwind>
    </Html>
  )
}

export default InvitationEmail

InvitationEmail.PreviewProps = {
  inviteeName: "Emirhan",
  inviterName: "Ahmet Yılmaz",
  inviterEmail: "ahmet@mydora.com",
  inviterAvatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=144&h=144&fit=crop&crop=face",
  organizationName: "Örnek Otel",
  orgLogoUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=144&h=144&fit=crop",
  role: "Yönetici",
  inviteLink: "http://localhost:3001/invitation/preview-token-123",
  expiresInDays: 7,
} as InvitationEmailProps
