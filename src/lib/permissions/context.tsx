"use client"

import { createContext, type ReactNode } from "react"

interface PermissionContextValue {
  permissions: readonly string[]
  role: string
}

export const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  role: "member",
})

interface ProviderProps {
  permissions: string[]
  role: string
  children: ReactNode
}

export function PermissionProvider({
  permissions,
  role,
  children,
}: ProviderProps) {
  return (
    <PermissionContext.Provider value={{ permissions, role }}>
      {children}
    </PermissionContext.Provider>
  )
}
