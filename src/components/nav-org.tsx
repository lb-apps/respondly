"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Building2, ChevronsUpDown, Settings, Users } from "lucide-react"

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
import { cn } from "@/lib/utils"
import { useOrg } from "@/contexts/org-context"
import { useModuleAccess } from "@/lib/permissions/hooks"

const orgSwitcherButtonClassName = cn(
  "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  "active:bg-sidebar-accent active:text-sidebar-accent-foreground",
  "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
)

function NavOrgContent({
  organization,
  subtitle,
  showCaret,
}: {
  organization: ReturnType<typeof useOrg>["organization"]
  subtitle: string
  showCaret: boolean
}) {
  return (
    <>
      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
        {organization.logo_url ? (
          <Image
            src={organization.logo_url}
            alt={organization.name}
            width={32}
            height={32}
            className="size-full object-cover"
          />
        ) : (
          <Building2 className="size-4" />
        )}
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-semibold">{organization.name}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {showCaret ? <ChevronsUpDown className="ml-auto size-4" /> : null}
    </>
  )
}

export function NavOrg() {
  const { organization } = useOrg()
  const { isMobile } = useSidebar()
  const canAccessSettings = useModuleAccess("settings")
  const [mounted, setMounted] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), [])

  const subtitle =
    organization.company_info?.company_title ?? organization.slug
  const orgSettingsUrl = `/${organization.slug}/settings/organization`
  const membersUrl = `/${organization.slug}/settings/members`

  if (!mounted || !canAccessSettings) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className={orgSwitcherButtonClassName}>
            <NavOrgContent
              organization={organization}
              subtitle={subtitle}
              showCaret={false}
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
            <SidebarMenuButton size="lg" className={orgSwitcherButtonClassName}>
              <NavOrgContent
                organization={organization}
                subtitle={subtitle}
                showCaret
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-2xl"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <NavOrgContent
                  organization={organization}
                  subtitle={subtitle}
                  showCaret={false}
                />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={orgSettingsUrl} className="flex items-center gap-2">
                <Settings className="size-4" />
                Organizasyon Ayarları
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={membersUrl} className="flex items-center gap-2">
                <Users className="size-4" />
                Takım Üyeleri
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
