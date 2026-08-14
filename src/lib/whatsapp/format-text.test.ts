import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseWhatsAppMessage } from "@/lib/whatsapp/format-text"

function inlineText(nodes: { type: string; value?: string; children?: unknown[] }[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.value ?? ""
      if ("children" in n && Array.isArray(n.children)) {
        return inlineText(n.children as { type: string; value?: string; children?: unknown[] }[])
      }
      if ("value" in n && typeof n.value === "string") return n.value
      return ""
    })
    .join("")
}

describe("parseWhatsAppMessage", () => {
  it("parses bold", () => {
    const blocks = parseWhatsAppMessage("Merhaba *dünya*!")
    const para = blocks[0]
    assert.equal(para?.type, "paragraph")
    if (para?.type !== "paragraph") return
    assert.deepEqual(para.children, [
      { type: "text", value: "Merhaba " },
      { type: "bold", children: [{ type: "text", value: "dünya" }] },
      { type: "text", value: "!" },
    ])
  })

  it("parses italic and strikethrough", () => {
    const blocks = parseWhatsAppMessage("_italic_ ve ~strike~")
    const para = blocks[0]
    if (para?.type !== "paragraph") assert.fail("expected paragraph")
    assert.equal(inlineText(para.children), "italic ve strike")
    assert.equal(para.children[0]?.type, "italic")
    assert.equal(para.children[2]?.type, "strike")
  })

  it("parses inline code and monospace block", () => {
    const inline = parseWhatsAppMessage("Kod: `foo`")
    const inlinePara = inline[0]
    if (inlinePara?.type !== "paragraph") assert.fail()
    assert.equal(inlinePara.children[1]?.type, "inlineCode")

    const block = parseWhatsAppMessage("```multi\nline```")
    assert.equal(block[0]?.type, "monospaceBlock")
    if (block[0]?.type === "monospaceBlock") {
      assert.equal(block[0].value, "multi\nline")
    }
  })

  it("does not treat math asterisks as bold", () => {
    const blocks = parseWhatsAppMessage("3*5=15")
    const para = blocks[0]
    if (para?.type !== "paragraph") assert.fail()
    assert.deepEqual(para.children, [{ type: "text", value: "3*5=15" }])
  })

  it("parses bullet, numbered, and quote lines", () => {
    const blocks = parseWhatsAppMessage("* bir\n- iki\n1. üç\n> alıntı")
    assert.equal(blocks[0]?.type, "bullet")
    assert.equal(blocks[1]?.type, "bullet")
    assert.equal(blocks[2]?.type, "numbered")
    assert.equal(blocks[3]?.type, "quote")
    if (blocks[2]?.type === "numbered") assert.equal(blocks[2].index, 1)
    if (blocks[3]?.type === "quote") {
      assert.equal(inlineText(blocks[3].children), "alıntı")
    }
  })

  it("supports nested emphasis", () => {
    const blocks = parseWhatsAppMessage("*_hem kalın hem italik_*")
    const para = blocks[0]
    if (para?.type !== "paragraph") assert.fail()
    const bold = para.children[0]
    assert.equal(bold?.type, "bold")
    if (bold?.type === "bold") {
      assert.equal(bold.children[0]?.type, "italic")
    }
  })

  it("leaves unclosed markers literal", () => {
    const blocks = parseWhatsAppMessage("*açık kalın")
    const para = blocks[0]
    if (para?.type !== "paragraph") assert.fail()
    assert.deepEqual(para.children, [{ type: "text", value: "*açık kalın" }])
  })
})
