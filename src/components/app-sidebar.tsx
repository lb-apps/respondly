"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Bot,
  Images,
  Inbox,
  MessageCircle,
  Server,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react"

import { NavBrand } from "@/components/nav-brand"
import { NavOrg } from "@/components/nav-org"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useOrg } from "@/contexts/org-context"
import {
  KNOWLEDGE_LIBRARY_LABEL,
  MEDIA_LIBRARY_LABEL,
} from "@/lib/knowledge/constants"
import { useModuleAccess } from "@/lib/permissions/hooks"
import type { Module } from "@/lib/permissions/types"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  module: Module
}

function SidebarNavGroup({
  label,
  items,
  isActive,
}: {
  label?: string
  items: NavItem[]
  isActive: (href: string) => boolean
}) {
  if (items.length === 0) return null

  return (
    <SidebarGroup>
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(item.href)}>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/** Inbox-first navigation. Konfigürasyon and Asistan are separate labeled groups. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { organization } = useOrg()
  const base = `/${organization.slug}`

  const canInbox = useModuleAccess("inbox")
  const canChannels = useModuleAccess("channels")
  const canKnowledge = useModuleAccess("knowledge")
  const canIntegrations = useModuleAccess("integrations")
  const canAssistant = useModuleAccess("assistant")

  const assistantBase = `${base}/assistant`
  const isOnSettings = pathname === assistantBase
  const isOnPreview = pathname.startsWith(`${assistantBase}/preview`)

  const primary: NavItem[] = [
    { href: `${base}/inbox`, label: "Gelen Kutusu", icon: Inbox, module: "inbox" },
    { href: `${base}/contacts`, label: "Kişiler", icon: Users, module: "inbox" },
    { href: `${base}/channels`, label: "WhatsApp", icon: MessageCircle, module: "channels" },
  ]

  const configuration: NavItem[] = [
    { href: `${base}/knowledge`, label: KNOWLEDGE_LIBRARY_LABEL, icon: BookOpen, module: "knowledge" },
    { href: `${base}/media`, label: MEDIA_LIBRARY_LABEL, icon: Images, module: "knowledge" },
    { href: `${base}/mcp`, label: "MCP Sunucuları", icon: Server, module: "integrations" },
  ]

  const moduleAccess: Record<Module, boolean> = {
    inbox: canInbox,
    channels: canChannels,
    knowledge: canKnowledge,
    integrations: canIntegrations,
    assistant: canAssistant,
    settings: true,
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function filterItems(items: NavItem[]) {
    return items.filter((item) => moduleAccess[item.module])
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-4">
        <NavBrand />
        <NavOrg />
      </SidebarHeader>
      <SidebarContent>
        {/* Primary: Inbox, WhatsApp */}
        <SidebarNavGroup items={filterItems(primary)} isActive={isActive} />

        {/* Konfigürasyon: Knowledge, Media, Integrations */}
        <SidebarNavGroup
          label="Konfigürasyon"
          items={filterItems(configuration)}
          isActive={isActive}
        />

        {/* Asistan: flat Ayarlar + Önizleme */}
        {canAssistant && (
          <SidebarGroup>
            <SidebarGroupLabel>Asistan</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isOnSettings && !isOnPreview}>
                    <Link href={assistantBase}>
                      <Settings2 />
                      <span>Ayarlar</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isOnPreview}>
                    <Link href={`${assistantBase}/preview`}>
                      <Bot />
                      <span>Önizleme</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
