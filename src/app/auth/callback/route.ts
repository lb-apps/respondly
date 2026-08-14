import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Email magic-link / confirmation callback.
 *
 * Supabase's confirmation email opens `{SUPABASE_URL}/auth/v1/verify`, which
 * verifies the token then redirects here with a PKCE `?code=`. We exchange that
 * code for a session (writes the auth cookies) and bounce the user back into the
 * open signup flow — `SignupPageClient.detectStep()` reads the now-confirmed
 * session and lands on the next step (organization).
 *
 * Works whether the link opens in the same tab or a new one: the session lives
 * in cookies, so the destination tab always sees the confirmed user.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/signup"

  // Only allow same-origin relative redirects.
  const dest = next.startsWith("/") ? next : "/signup"

  if (!code) {
    return NextResponse.redirect(new URL(dest, url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/signup?error=link_invalid`, url.origin)
    )
  }

  return NextResponse.redirect(new URL(dest, url.origin))
}
