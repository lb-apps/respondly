/**
 * Turn a raw transport/protocol error into something the operator reading the
 * dashboard can act on. Pure function — no I/O, unit tested.
 */
/** Drop stack frames — the operator needs the reason, not our call stack. */
function withoutStack(message: string): string {
  return message.split(/\n\s*at\s/)[0].trim()
}

/**
 * The client re-wraps its own failure as it bubbles up, so the same sentence
 * often arrives two or three times. Keep the first occurrence only.
 */
function dedupeRepeats(message: string): string {
  const seen = new Set<string>()
  return message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || seen.has(line)) return false
      seen.add(line)
      return true
    })
    .join("\n")
}

export function explainMcpError(message: string): string {
  const text = dedupeRepeats(withoutStack(message))

  // The client pins the connection to one host, so a server that redirects
  // (typically apex → www) fails here. Saving or testing the server resolves
  // the address and stores where it really answers.
  if (/allowedHosts policy|redirect hops/i.test(text)) {
    return `Sunucu adresi başka bir adrese yönlendiriyor. Sunucuyu kaydedip tekrar test edin; adres otomatik düzeltilir. — ${text}`
  }
  if (
    /ECONNREFUSED|ENOTFOUND|EAI_AGAIN|any available HTTP transport|fetch failed/i.test(
      text
    )
  ) {
    return `Adrese ulaşılamadı. Port ve adres doğru mu, sunucu ayakta mı? — ${text}`
  }
  if (/\b401\b|unauthor|invalid[_ ]token|bearer token|missing[_ ]token/i.test(text)) {
    return `Kimlik doğrulama reddedildi (401). Gizli anahtarı kontrol edin. — ${text}`
  }
  if (/\b403\b|forbidden/i.test(text)) {
    return `Erişim reddedildi (403). Token'ın bu sunucuda yetkisi var mı? — ${text}`
  }
  if (/\b404\b/.test(text)) {
    return `Adres bulunamadı (404). MCP uç noktasının yolunu kontrol edin. — ${text}`
  }
  if (/\b405\b/.test(text)) {
    return `Sunucu bu aktarımı kabul etmiyor (405). Aktarım türünü değiştirin. — ${text}`
  }
  if (/\b429\b|rate limit/i.test(text)) {
    return `Hız sınırı aşıldı (429). Kısa bir süre sonra tekrar deneyin. — ${text}`
  }
  if (/\b503\b|not_configured/i.test(text)) {
    return `Sunucu hazır değil (503). Sunucu tarafındaki yapılandırmayı kontrol edin. — ${text}`
  }
  if (/timeout|timed out|abort/i.test(text)) {
    return `Zaman aşımı. Adres doğru mu, sunucu ayakta mı? — ${text}`
  }
  return text
}
