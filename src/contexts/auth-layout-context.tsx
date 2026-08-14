"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

interface AuthLayoutState {
  currentStep: number
  headerVisible: boolean
  title: string | null
  subtitle: string | null
  direction: number
  slideAxis: "x" | "y"
  patternVariant: "circles" | "triangles" | "squares" | "hexagons"
  footer: ReactNode | null
}

interface AuthLayoutContextValue {
  state: AuthLayoutState
  setHeader: (partial: Partial<Pick<AuthLayoutState, "currentStep" | "headerVisible" | "title" | "subtitle" | "direction" | "slideAxis" | "patternVariant">>) => void
  setFooter: (content: ReactNode | null) => void
}

const AuthLayoutContext = createContext<AuthLayoutContextValue | null>(null)

export function AuthLayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthLayoutState>({
    currentStep: 1,
    headerVisible: false,
    title: null,
    subtitle: null,
    direction: 1,
    slideAxis: "y",
    patternVariant: "hexagons",
    footer: null,
  })

  const setHeader = useCallback(
    (partial: Partial<Pick<AuthLayoutState, "currentStep" | "headerVisible" | "title" | "subtitle" | "direction" | "slideAxis" | "patternVariant">>) => {
      setState((prev) => ({ ...prev, ...partial }))
    },
    []
  )

  const setFooter = useCallback((content: ReactNode | null) => {
    setState((prev) => ({ ...prev, footer: content }))
  }, [])

  return (
    <AuthLayoutContext.Provider value={{ state, setHeader, setFooter }}>
      {children}
    </AuthLayoutContext.Provider>
  )
}

export function useAuthLayout() {
  const ctx = useContext(AuthLayoutContext)
  if (!ctx) throw new Error("useAuthLayout must be used within AuthLayoutProvider")
  return ctx
}
