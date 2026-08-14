import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  VERTICAL_LABELS,
  profileFormSchema,
  type ProfileFormValues,
} from "@/app/[slug]/channels/profile-schema"
import { WHATSAPP_VERTICALS } from "@/lib/whatsapp/cloud-api/business-profile-limits"

const valid: ProfileFormValues = {
  about: "Deniz manzaralı butik otel",
  description: "Antalya Kaleiçi'nde 12 odalı butik otel.",
  address: "Kaleiçi Mah. Antalya",
  email: "rezervasyon@ornek.com",
  vertical: "HOTEL",
  website1: "https://ornek.com",
  website2: "",
}

function parse(overrides: Partial<ProfileFormValues>) {
  return profileFormSchema.safeParse({ ...valid, ...overrides })
}

function firstError(result: ReturnType<typeof parse>): string {
  return result.success ? "" : (result.error.issues[0]?.message ?? "")
}

describe("profileFormSchema", () => {
  it("accepts a filled-in profile", () => {
    assert.ok(parse({}).success)
  })

  it("accepts a completely empty profile", () => {
    // Nothing is required — an org may connect WhatsApp before writing copy.
    assert.ok(
      parse({
        about: "",
        description: "",
        address: "",
        email: "",
        website1: "",
        website2: "",
      }).success
    )
  })
})

describe("about", () => {
  it("passes at exactly Meta's 139", () => {
    assert.ok(parse({ about: "a".repeat(139) }).success)
  })

  it("fails at 140 with the message the counter shows", () => {
    assert.equal(firstError(parse({ about: "a".repeat(140) })), "En fazla 139 karakter")
  })
})

describe("email", () => {
  it("treats blank as cleared, not invalid", () => {
    assert.ok(parse({ email: "" }).success)
  })

  it("rejects something that is not an address", () => {
    assert.equal(firstError(parse({ email: "x" })), "Geçerli bir e-posta girin")
  })
})

describe("websites", () => {
  it("requires a scheme", () => {
    assert.equal(
      firstError(parse({ website1: "ornek.com" })),
      "Geçerli bir adres girin (https:// ile başlamalı)"
    )
  })

  it("accepts http and https", () => {
    assert.ok(parse({ website1: "https://ornek.com" }).success)
    assert.ok(parse({ website1: "http://ornek.com" }).success)
  })

  it("rejects a bare scheme with no host", () => {
    assert.ok(!parse({ website1: "https://" }).success)
  })

  it("allows the second slot to stay empty", () => {
    assert.ok(parse({ website2: "" }).success)
  })
})

describe("vertical", () => {
  it("rejects a value Meta does not list", () => {
    assert.equal(
      firstError(parse({ vertical: "SPACESHIPS" as ProfileFormValues["vertical"] })),
      "Sektör seçin"
    )
  })

  it("has a Turkish label for every enum value", () => {
    // A missing label renders a blank row in the Select instead of failing.
    for (const vertical of WHATSAPP_VERTICALS) {
      assert.ok(VERTICAL_LABELS[vertical], `no label for ${vertical}`)
    }
    assert.equal(Object.keys(VERTICAL_LABELS).length, WHATSAPP_VERTICALS.length)
  })
})
