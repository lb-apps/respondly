import { Suspense } from "react"
import { SignupPageClient } from "./signup-page-client"

export default function SignupPage() {
  return (
    <Suspense>
      <SignupPageClient />
    </Suspense>
  )
}
