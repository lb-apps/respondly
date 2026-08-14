import { buildSystemPrompt } from "@/mastra/prompt"
import { buildContactContextBlock } from "@/lib/assistant/contact-context"
import { buildGuestLanguagePromptBlock } from "@/lib/assistant/guest-language-prompt"
import { readFileSync } from "node:fs"

const persona = readFileSync("docs/prompts/my-dora-hotel.md", "utf8").split("---\n")[1].trim()
const sections = [
  ...buildSystemPrompt({
    orgName: "My Dora Hotel", industry: "Otelcilik", persona,
    tone: "kibar ve profesyonel",
    firstMessage: "Merhaba, My Dora Hotel’e hoş geldiniz!",
    timezone: "Europe/Istanbul",
    connectedServers: [{ slug: "my_dora", name: "My Dora Web Sitesi", tools: [
      { name: "my_dora_search_availability", originalName: "search_availability", description: "Live rooms and prices." }] }],
  }),
  buildContactContextBlock({ phone: "+33766151513", country: "FR" })!,
  buildGuestLanguagePromptBlock("tr"),
]

const all = sections.join("\n")
console.log("bolum karakterleri:", sections.map((s) => s.length).join(" / "))
console.log("~token (kabaca /3.6):", Math.round(all.length / 3.6))

// Tekrar eden cumleler
const lines = all.split("\n").map((l) => l.trim()).filter((l) => l.length > 45)
const seen = new Map<string, number>()
for (const l of lines) seen.set(l, (seen.get(l) ?? 0) + 1)
const dupes = [...seen.entries()].filter(([, n]) => n > 1)
console.log("\nbirebir tekrar eden satir:", dupes.length)
for (const [line, n] of dupes) console.log(`  ${n}x  ${line.slice(0, 90)}`)

// Ayni konuyu iki yerde anlatan anahtar kelimeler
const topics: Record<string, RegExp> = {
  "dil kurali": /language of the customer|reply in that language|Active Conversation Language/gi,
  "ham URL yasagi": /never paste|raw URL|bare URL/gi,
  "emoji": /emoji/gi,
  "telefon sorma": /phone number/gi,
  "tool ciktisi guvenilmez": /tool (result|output).*(instructions|data, not)/gi,
}
console.log("\nkonu bazli tekrar:")
for (const [name, re] of Object.entries(topics)) {
  const hits = sections.map((s, i) => (s.match(re) ?? []).length ? i + 1 : null).filter(Boolean)
  console.log(`  ${name}: bolum ${hits.join(", ") || "-"}  (toplam ${(all.match(re) ?? []).length} gecis)`)
}
