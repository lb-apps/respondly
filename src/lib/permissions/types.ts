/** Minimal org-scoped permissions (DB source of truth). */
export type Permission =
  | "inbox.access"
  | "channels.access"
  | "knowledge.access"
  | "integrations.access"
  | "assistant.access"
  | "settings.members"
  | "settings.organization"
  | "*"

export type Module =
  | "inbox"
  | "channels"
  | "knowledge"
  | "integrations"
  | "assistant"
  | "settings"

/** Selectable module access when inviting a member. */
export type MemberModulePermission =
  | "inbox.access"
  | "channels.access"
  | "knowledge.access"
  | "integrations.access"
  | "assistant.access"

export const MEMBER_MODULE_PERMISSIONS: MemberModulePermission[] = [
  "inbox.access",
  "channels.access",
  "knowledge.access",
  "integrations.access",
  "assistant.access",
]

export const PERMISSION_LABELS: Record<Exclude<Permission, "*">, string> = {
  "inbox.access": "Gelen Kutusu",
  "channels.access": "WhatsApp",
  "knowledge.access": "Bilgi Kütüphanesi",
  "integrations.access": "MCP Sunucuları",
  "assistant.access": "Asistan",
  "settings.members": "Takım üyeleri",
  "settings.organization": "Organizasyon ayarları",
}
