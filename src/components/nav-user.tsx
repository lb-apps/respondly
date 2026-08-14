"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, LogOut, User } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useOrg } from "@/contexts/org-context"
import { useUser } from "@/contexts/user-context"
import { createClient } from "@/lib/supabase/client"

function NavUserContent({
  avatarUrl,
  displayName,
  initials,
  email,
  showCaret,
}: {
  avatarUrl: string | null | undefined
  displayName: string
  initials: string
  email: string
  showCaret: boolean
}) {
  return (
    <>
      <Avatar className="h-8 w-8 rounded-xl">
        <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback className="rounded-xl">{initials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{displayName}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </div>
      {showCaret ? <ChevronsUpDown className="ml-auto size-4" /> : null}
    </>
  )
}

export function NavUser() {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const { organization } = useOrg()
  const { user } = useUser()
  const [mounted, setMounted] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])

  const handleLogout = async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
      router.push("/login")
      router.refresh()
    } catch {
      toast.error("Çıkış yapılırken bir hata oluştu")
    }
  }

  const displayName =
    user.first_name || user.last_name
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
      : user.email.split("@")[0]

  const initials =
    user.first_name && user.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : user.first_name
        ? user.first_name.slice(0, 2).toUpperCase()
        : user.email.slice(0, 2).toUpperCase()

  const accountUrl = `/${organization.slug}/settings/account`

  if (!mounted) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <NavUserContent
              avatarUrl={user.avatar_url}
              displayName={displayName}
              initials={initials}
              email={user.email}
              showCaret
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <NavUserContent
                avatarUrl={user.avatar_url}
                displayName={displayName}
                initials={initials}
                email={user.email}
                showCaret
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <NavUserContent
                  avatarUrl={user.avatar_url}
                  displayName={displayName}
                  initials={initials}
                  email={user.email}
                  showCaret={false}
                />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={accountUrl} className="flex items-center gap-2">
                <User className="size-4" />
                Hesap Ayarları
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="gap-2">
              <LogOut className="size-4" />
              Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
