import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const MODULE_PERMISSION_MAP: Record<string, string> = {
  inbox: "inbox",
  channels: "channels",
  knowledge: "knowledge",
  // Media is part of the knowledge domain — same staff, same RAG store.
  media: "knowledge",
  // MCP servers page is gated by the same permission the old integrations page used.
  mcp: "integrations",
  assistant: "assistant",
  settings: "settings",
}

function hasModulePermission(permissions: string[], module: string): boolean {
  if (permissions.includes("*")) return true
  switch (module) {
    case "inbox":
      return permissions.includes("inbox.access")
    case "channels":
      return permissions.includes("channels.access")
    case "knowledge":
      return permissions.includes("knowledge.access")
    case "integrations":
      return permissions.includes("integrations.access")
    case "assistant":
      return permissions.includes("assistant.access")
    case "settings":
      return (
        permissions.includes("settings.members") ||
        permissions.includes("settings.organization")
      )
    default:
      return false
  }
}

function getDefaultRedirectModule(permissions: string[]): string {
  if (permissions.includes("*") || permissions.includes("inbox.access")) {
    return "inbox"
  }
  if (permissions.includes("channels.access")) return "channels"
  if (permissions.includes("knowledge.access")) return "knowledge"
  if (permissions.includes("integrations.access")) return "mcp"
  if (permissions.includes("assistant.access")) return "assistant"
  if (
    permissions.includes("settings.members") ||
    permissions.includes("settings.organization")
  ) {
    return "settings"
  }
  return "settings/account"
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Validate user (getUser() is the source of truth for auth state)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Always allow these routes regardless of auth status. /auth/* handles the
  // email magic-link callback — it runs before a session cookie exists, so it
  // must never be bounced to /login (which would drop the `?code` param).
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/invitation/") ||
    pathname.startsWith("/reports/") ||
    // Externally-triggered endpoints that carry their own secret/token guard
    // (Bearer CRON_SECRET / Meta X-Hub-Signature-256) — never session-gate
    // them or the caller (pg_net cron, Meta webhook) is bounced to /login.
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/whatsapp/") ||
    pathname === "/reset-password"
  ) {
    return response
  }

  if (pathname === "/login") {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return response
  }

  if (pathname === "/signup") {
    return response
  }

  // Protect all other routes: require authentication
  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Reserved root segments that are NOT org slugs
  const RESERVED_ROOTS = new Set([
    "login",
    "signup",
    "invitation",
    "reset-password",
    "create-org",
    "api",
    "dashboard",
    "inbox",
    "channels",
    "knowledge",
    "mcp",
    "assistant",
    "settings",
    "_next",
  ])

  const firstSegment = pathname.split("/")[1]
  const isOrgRoute = firstSegment && !RESERVED_ROOTS.has(firstSegment)

  // Org-scoped routes: validate org slug and inject organization_id header
  if (isOrgRoute) {
    const slug = firstSegment

    // Look up organization by slug to get its ID
    const { data: org } = await supabase
      .from("organizations")
      .select("id, slug")
      .eq("slug", slug)
      .single()

    if (!org) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    // Verify current user is a member of this org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    const { data: orgPermissions } = await supabase.rpc(
      "get_user_permissions_for_org",
      { p_org_id: org.id }
    )
    const permissions = (orgPermissions as string[] | null) ?? []

    // Org root route: redirect to user's default module based on permissions
    if (pathname === `/${slug}`) {
      const defaultModule = getDefaultRedirectModule(permissions)
      return NextResponse.redirect(
        new URL(`/${slug}/${defaultModule}`, request.url)
      )
    }

    // Module-level permission enforcement
    const segments = pathname.split("/")
    const moduleSegment = segments[2]
    const requiredModule = MODULE_PERMISSION_MAP[moduleSegment]

    if (requiredModule) {
      // /settings/account is accessible to everyone
      if (moduleSegment === "settings" && segments[3] === "account") {
        // Allow — personal account settings
      } else if (!hasModulePermission(permissions, requiredModule)) {
        const defaultModule = getDefaultRedirectModule(permissions)
        return NextResponse.redirect(
          new URL(`/${slug}/${defaultModule}`, request.url)
        )
      }
    }

    // Inject org ID into request headers for use in server components
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-organization-id", org.id)
    requestHeaders.set("x-organization-slug", org.slug)

    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
