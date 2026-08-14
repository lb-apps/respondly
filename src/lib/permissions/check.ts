import type { Permission, Module } from "./types"

export function hasPermission(
  userPermissions: readonly string[],
  required: Permission
): boolean {
  if (userPermissions.includes("*")) return true
  return userPermissions.includes(required)
}

export function hasAnyPermission(
  userPermissions: readonly string[],
  required: Permission[]
): boolean {
  if (userPermissions.includes("*")) return true
  return required.some((p) => userPermissions.includes(p))
}

export function hasModuleAccess(
  userPermissions: readonly string[],
  module: Module
): boolean {
  if (userPermissions.includes("*")) return true

  switch (module) {
    case "inbox":
      return userPermissions.includes("inbox.access")
    case "channels":
      return userPermissions.includes("channels.access")
    case "knowledge":
      return userPermissions.includes("knowledge.access")
    case "integrations":
      return userPermissions.includes("integrations.access")
    case "assistant":
      return userPermissions.includes("assistant.access")
    case "settings":
      return (
        userPermissions.includes("settings.members") ||
        userPermissions.includes("settings.organization")
      )
    default:
      return false
  }
}
