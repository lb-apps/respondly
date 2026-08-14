const ROLE_LABELS: Record<string, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  member: "Üye",
}

/** Known module / segment prefixes in custom role slugs (e.g. stock_yonetici). */
const ROLE_NAME_SEGMENT_LABELS: Record<string, string> = {
  stock: "Stok",
  accounting: "Muhasebe",
  settings: "Ayarlar",
  dashboard: "Dashboard",
  activity: "Aktivite",
  receipts: "Fişler",
  warehouse: "Depo",
  product: "Ürün",
  category: "Kategori",
  count: "Sayım",
  template: "Şablon",
  read: "Görüntüleme",
  write: "Düzenleme",
  delete: "Silme",
  manager: "Yönetici",
  yonetici: "Yönetici",
  muhasebe: "Muhasebe",
  stok: "Stok",
}

function upperFirstTr(value: string): string {
  const s = value.trim()
  if (!s) return s
  return s[0].toLocaleUpperCase("tr-TR") + s.slice(1)
}

function humanizeRoleName(name: string): string {
  const parts = name
    .trim()
    .toLowerCase()
    .split("_")
    .filter(Boolean)

  if (parts.length === 0) return name.trim()

  return parts
    .map((part) => ROLE_NAME_SEGMENT_LABELS[part] ?? upperFirstTr(part))
    .join(" ")
}

/**
 * Returns the Turkish display label for a role from the database.
 * System roles use fixed labels; custom roles prefer `description`, then humanized slug.
 */
export function translateRole(name: string, description?: string | null): string {
  const key = name.toLowerCase()
  if (ROLE_LABELS[key]) return ROLE_LABELS[key]

  const desc = description?.trim()
  if (desc) return desc

  return humanizeRoleName(name)
}

/** Display label from a role row (name + optional description). */
export function getRoleDisplayLabel(role: {
  name: string
  description?: string | null
}): string {
  return translateRole(role.name, role.description)
}
