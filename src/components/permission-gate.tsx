"use client"

import { memo, type ReactNode } from "react"
import { usePermissions } from "@/lib/permissions/hooks"
import { hasPermission, hasAnyPermission } from "@/lib/permissions/check"
import type { Permission } from "@/lib/permissions/types"

interface Props {
  permission?: Permission
  anyOf?: Permission[]
  fallback?: ReactNode
  children: ReactNode
}

export const PermissionGate = memo(function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: Props) {
  const permissions = usePermissions()

  if (permission && !hasPermission(permissions, permission)) {
    return <>{fallback}</>
  }

  if (anyOf && !hasAnyPermission(permissions, anyOf)) {
    return <>{fallback}</>
  }

  return <>{children}</>
})
