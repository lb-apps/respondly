"use client"

import Image from "next/image"
import Link from "next/link"

import {
  RESPONDLY_BRAND_NAME,
  RESPONDLY_ICON_PATH,
  RESPONDLY_LOGO_PATH,
  RESPONDLY_LOGO_SIDEBAR_HEIGHT_PX,
  RESPONDLY_LOGO_SIDEBAR_WIDTH_PX,
} from "@/lib/brand/assets"
import { cn } from "@/lib/utils"
import { useOrg } from "@/contexts/org-context"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

const brandButtonClassName = cn(
  "hover:bg-transparent active:bg-transparent",
  "focus-visible:ring-2 focus-visible:ring-sidebar-ring"
)

export function NavBrand() {
  const { organization } = useOrg()
  const { state } = useSidebar()
  const homeHref = `/${organization.slug}/inbox`
  const collapsed = state === "collapsed"

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size={collapsed ? "lg" : "default"}
          asChild
          className={cn(
            brandButtonClassName,
            collapsed ? undefined : "h-auto py-2"
          )}
        >
          <Link
            href={homeHref}
            className={cn(
              "flex w-full min-w-0 items-center",
              collapsed && "justify-center"
            )}
            aria-label={`${RESPONDLY_BRAND_NAME} — Gelen kutusu`}
          >
            {collapsed ? (
              <Image
                src={RESPONDLY_ICON_PATH}
                alt={RESPONDLY_BRAND_NAME}
                width={32}
                height={32}
                unoptimized
                className="size-8 shrink-0 object-contain"
                priority
              />
            ) : (
              <Image
                src={RESPONDLY_LOGO_PATH}
                alt={RESPONDLY_BRAND_NAME}
                width={RESPONDLY_LOGO_SIDEBAR_WIDTH_PX}
                height={RESPONDLY_LOGO_SIDEBAR_HEIGHT_PX}
                unoptimized
                className="h-auto w-28 max-w-full shrink-0 object-contain object-left"
                priority
              />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
