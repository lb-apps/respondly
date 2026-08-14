import type { GraphError } from "./graph-request"

/**
 * Turn a Graph API failure into something an org admin can act on.
 *
 * Pure and kept apart from the transport so the mapping can be unit tested —
 * including the assertion that a token never reaches a user-facing string.
 *
 * Meta's own `message` is only surfaced for 400, where it names the field it
 * refused and is genuinely the most useful thing we can say. Every other status
 * gets our own wording, because Meta's is either generic ("Unsupported get
 * request") or leaks internals.
 */
export function graphErrorToTurkish(error: GraphError): string {
  const { status, code } = error

  if (status === 401 || code === 190) {
    return "Erişim anahtarı geçersiz veya süresi dolmuş. Meta'dan yeni bir token üretip kaydet."
  }

  if (status === 403 || code === 200 || code === 10 || code === 299) {
    return "Token'da whatsapp_business_management izni yok. Meta'da bu izni ekleyip yeni token üret."
  }

  if (status === 404 || code === 803) {
    return "Phone Number ID Meta'da bulunamadı. Bağlantı sekmesindeki kimlik bilgilerini kontrol et."
  }

  if (status === 429 || code === 4 || code === 80007 || code === 130429) {
    return "Meta istek sınırına takıldı. Birkaç dakika sonra tekrar dene."
  }

  if (status >= 500 || status === 0) {
    return "Meta'ya şu anda ulaşılamıyor. Biraz sonra tekrar dene."
  }

  if (status === 400) {
    return `Meta bu bilgiyi kabul etmedi: ${error.message}`
  }

  return `Meta hatası (${status}): ${error.message}`
}
