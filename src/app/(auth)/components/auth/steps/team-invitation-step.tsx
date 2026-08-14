"use client"

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getRoleDisplayLabel } from "@/lib/i18n/roles"
import { sortRolesByPower } from "@/lib/sort-roles"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconPlus, IconTrash, IconUsers } from "@tabler/icons-react"
import { toast } from "sonner"
import type { RolePayload } from "@/types/serialization"
import type { InviteFormData } from "@/components/members/invite-member-dialog"

const InviteMemberDialog = dynamic(
  () => import("@/components/members/invite-member-dialog").then((m) => ({ default: m.InviteMemberDialog })),
  { ssr: false }
)

export interface TeamInvitationStepHandle {
  submit: () => Promise<boolean>
  canProceed: boolean
  isLoading: boolean
}

interface TeamInvitationStepProps {
  orgSlug: string
  orgId: string
}

interface PendingInvite extends InviteFormData {
  localId: string
}

const INVITES_KEY = "signup_invites"
const PROFILE_KEYS = ["signup_first_name", "signup_last_name", "signup_email", "signup_user_id"]
const ORG_KEYS = ["signup_org_name", "signup_currency", "signup_timezone", "signup_sector", "signup_team_size"]

function clearSignupStorage() {
  ;[INVITES_KEY, ...PROFILE_KEYS, ...ORG_KEYS].forEach((k) => sessionStorage.removeItem(k))
}

function readStoredInvites(): PendingInvite[] {
  try {
    const raw = sessionStorage.getItem(INVITES_KEY)
    return raw ? (JSON.parse(raw) as PendingInvite[]) : []
  } catch {
    return []
  }
}

function writeStoredInvites(invites: PendingInvite[]) {
  sessionStorage.setItem(INVITES_KEY, JSON.stringify(invites))
}

function getInitials(firstName: string, lastName: string, email: string): string {
  if (firstName || lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }
  return email.charAt(0).toUpperCase()
}

let localIdCounter = 0

export const TeamInvitationStep = forwardRef<TeamInvitationStepHandle, TeamInvitationStepProps>(
  function TeamInvitationStep({ orgSlug, orgId }, ref) {
    const [roles, setRoles] = useState<RolePayload[]>([])
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(() => readStoredInvites())
    const [dialogOpen, setDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const supabase = useMemo(() => createClient(), [])

    const assignableRoles = useMemo(
      () => sortRolesByPower(roles).filter((r) => r.name !== "owner"),
      [roles]
    )

    useEffect(() => {
      async function loadRoles() {
        const { data } = await supabase
          .from("roles")
          .select("id, name, description")
          .order("id")
        if (data) setRoles(data as RolePayload[])
      }
      loadRoles()
    }, [supabase])

    const handleDialogConfirm = useCallback((data: InviteFormData) => {
      setPendingInvites((prev) => {
        if (prev.some((i) => i.email === data.email)) {
          toast.error("Bu e-posta zaten listede.")
          return prev
        }
        const next = [...prev, { ...data, localId: `local-${++localIdCounter}` }]
        writeStoredInvites(next)
        return next
      })
      setDialogOpen(false)
    }, [])

    const handleRemove = useCallback((localId: string) => {
      setPendingInvites((prev) => {
        const next = prev.filter((i) => i.localId !== localId)
        writeStoredInvites(next)
        return next
      })
    }, [])

    const handleFinish = useCallback(async (): Promise<boolean> => {
      setIsLoading(true)
      try {
        const results = await Promise.allSettled(
          pendingInvites.map((invite) =>
            fetch("/api/invitations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: invite.email,
                roleId: invite.roleId,
                organizationId: orgId,
                firstName: invite.firstName || undefined,
                lastName: invite.lastName || undefined,
              }),
            })
          )
        )

        const failedCount = results.filter((r) => r.status === "rejected").length
        if (failedCount > 0) {
          toast.error(`${failedCount} davet gönderilemedi.`)
        }

        clearSignupStorage()
        router.push(`/${orgSlug}/inbox`)
        router.refresh()
        return true
      } catch {
        toast.error("Davetler gönderilemedi. Lütfen tekrar deneyin.")
        return false
      } finally {
        setIsLoading(false)
      }
    }, [pendingInvites, orgId, orgSlug, router])

    useImperativeHandle(ref, () => ({
      submit: handleFinish,
      canProceed: true,
      isLoading,
    }), [handleFinish, isLoading])

    const hasInvites = pendingInvites.length > 0

    return (
      <div className="flex flex-1 flex-col gap-6">
        <AnimatePresence mode="wait" initial={false}>
          {hasInvites ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  Davet edilecekler
                  <span className="ml-1.5 text-muted-foreground">({pendingInvites.length})</span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  disabled={isLoading}
                >
                  <IconPlus className="mr-1.5 size-3.5" />
                  Ekle
                </Button>
              </div>

              <div className="rounded-2xl border">
                <AnimatePresence initial={false}>
                  {pendingInvites.map((inv, index) => {
                    const displayName = inv.firstName || inv.lastName
                      ? `${inv.firstName} ${inv.lastName}`.trim()
                      : null

                    return (
                      <motion.div
                        key={inv.localId}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className={cn(
                          "flex items-center gap-3 px-4 py-3",
                          index > 0 && "border-t border-border"
                        )}>
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-xs">
                              {getInitials(inv.firstName, inv.lastName, inv.email)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium text-foreground">
                              {displayName ?? inv.email}
                            </span>
                            {displayName ? (
                              <span className="truncate text-xs text-muted-foreground">{inv.email}</span>
                            ) : null}
                          </div>

                          <Badge variant="secondary" className="shrink-0">
                            {getRoleDisplayLabel(inv.role)}
                          </Badge>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemove(inv.localId)}
                            disabled={isLoading}
                            aria-label="Kaldır"
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <IconUsers className="size-6 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <p className="text-sm font-medium text-foreground">Henüz kimse eklenmedi</p>
                <p className="max-w-[280px] text-xs text-muted-foreground">
                  Ekibinizi şimdiden davet edin. Bu adımı atlayıp daha sonra da ekleyebilirsiniz.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
                disabled={isLoading}
              >
                <IconPlus className="mr-1.5 size-3.5" />
                Üye Ekle
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <InviteMemberDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          roles={assignableRoles}
          onConfirm={handleDialogConfirm}
          submitLabel="Ekle"
        />
      </div>
    )
  }
)
