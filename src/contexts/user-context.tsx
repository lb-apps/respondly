"use client"

import { createContext, useContext } from "react"
import type { UserPayload } from "@/types/serialization"

interface UserContextValue {
  user: UserPayload
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: UserPayload
  children: React.ReactNode
}) {
  return (
    <UserContext.Provider value={{ user }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return ctx
}
