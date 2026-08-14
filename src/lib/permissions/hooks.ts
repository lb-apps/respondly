"use client"

import { useContext, useMemo } from "react"
import { PermissionContext } from "./context"
import { hasPermission, hasAnyPermission, hasModuleAccess } from "./check"
import type { Permission, Module } from "./types"

export function usePermissions(): readonly string[] {
  const { permissions } = useContext(PermissionContext)
  return permissions
}

export function useRole(): string {
  const { role } = useContext(PermissionContext)
  return role
}

export function useCan(permission: Permission): boolean {
  const permissions = usePermissions()
  return useMemo(
    () => hasPermission(permissions, permission),
    [permissions, permission]
  )
}

export function useCanAny(required: Permission[]): boolean {
  const permissions = usePermissions()
  return useMemo(
    () => hasAnyPermission(permissions, required),
    [permissions, required]
  )
}

export function useModuleAccess(module: Module): boolean {
  const permissions = usePermissions()
  return useMemo(
    () => hasModuleAccess(permissions, module),
    [permissions, module]
  )
}
