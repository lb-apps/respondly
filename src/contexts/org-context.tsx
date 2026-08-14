"use client"

import { createContext, useContext } from "react"
import type { OrganizationPayload } from "@/types/serialization"

interface OrgContextValue {
  organization: OrganizationPayload
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgProvider({
  organization,
  children,
}: {
  organization: OrganizationPayload
  children: React.ReactNode
}) {
  return (
    <OrgContext.Provider value={{ organization }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    throw new Error("useOrg must be used within an OrgProvider")
  }
  return ctx
}
