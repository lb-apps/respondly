"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { getRoleDisplayLabel } from "@/lib/i18n/roles"
import { sortRolesByPower } from "@/lib/sort-roles"
import {
  MEMBER_MODULE_PERMISSIONS,
  PERMISSION_LABELS,
  type MemberModulePermission,
} from "@/lib/permissions/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { RolePayload } from "@/types/serialization"

export interface InviteFormData {
  email: string
  firstName: string
  lastName: string
  roleId: string
  role: RolePayload
  modulePermissions: MemberModulePermission[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RolePayload[]
  onConfirm: (data: InviteFormData) => void
  submitLabel?: string
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  roles,
  onConfirm,
  submitLabel = "Davet Gönder",
}: Props) {
  const sorted = useMemo(
    () => sortRolesByPower(roles).filter((r) => ["owner", "admin", "member"].includes(r.name)),
    [roles]
  )
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [roleId, setRoleId] = useState("")
  const [modulePermissions, setModulePermissions] = useState<MemberModulePermission[]>([
    ...MEMBER_MODULE_PERMISSIONS,
  ])

  const selectedRole = useMemo(
    () => sorted.find((r) => r.id === roleId) ?? null,
    [sorted, roleId]
  )
  const isMemberRole = selectedRole?.name === "member"
  const selectedRoleDescription = selectedRole?.description

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const hasModuleSelection = !isMemberRole || modulePermissions.length > 0
  const canSubmit = isEmailValid && Boolean(roleId) && hasModuleSelection

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRoleId((prev) => {
      if (prev !== "" && sorted.some((r) => r.id === prev)) return prev
      return sorted.find((r) => r.name === "member")?.id ?? sorted[0]?.id ?? ""
    })
  }, [sorted])

  const toggleModulePermission = (perm: MemberModulePermission, checked: boolean) => {
    setModulePermissions((prev) => {
      if (checked) {
        return prev.includes(perm) ? prev : [...prev, perm]
      }
      return prev.filter((p) => p !== perm)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    const role = roles.find((r) => r.id === roleId)
    if (!role) return

    onConfirm({
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleId,
      role,
      modulePermissions: isMemberRole ? modulePermissions : [],
    })

    setEmail("")
    setFirstName("")
    setLastName("")
    setRoleId(sorted.find((r) => r.name === "member")?.id ?? sorted[0]?.id ?? "")
    setModulePermissions([...MEMBER_MODULE_PERMISSIONS])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[12%] translate-y-0 sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Üye Davet Et</DialogTitle>
          <DialogDescription>
            Ekibinize yeni birini davet edin.
          </DialogDescription>
        </DialogHeader>

        <form id="invite-form" onSubmit={handleSubmit}>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="inviteEmail">E-posta Adresi</FieldLabel>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="inviteFirstName">
                  Ad <span className="text-muted-foreground">(opsiyonel)</span>
                </FieldLabel>
                <Input
                  id="inviteFirstName"
                  type="text"
                  placeholder="Ad"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inviteLastName">
                  Soyad <span className="text-muted-foreground">(opsiyonel)</span>
                </FieldLabel>
                <Input
                  id="inviteLastName"
                  type="text"
                  placeholder="Soyad"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Rol</FieldLabel>
              <ToggleGroup
                type="single"
                value={roleId}
                onValueChange={(val) => {
                  if (val) setRoleId(val)
                }}
                variant="outline"
                className="w-full"
              >
                {sorted.map((role) => (
                  <ToggleGroupItem
                    key={role.id}
                    value={role.id}
                    className="flex-1"
                  >
                    {getRoleDisplayLabel(role)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {selectedRoleDescription ? (
                <FieldDescription>{selectedRoleDescription}</FieldDescription>
              ) : null}
            </Field>

            {isMemberRole ? (
              <FieldSet>
                <FieldLegend variant="label">Modül erişimi</FieldLegend>
                <div className="flex flex-col gap-3" data-slot="checkbox-group">
                  {MEMBER_MODULE_PERMISSIONS.map((perm) => (
                    <Field key={perm} orientation="horizontal">
                      <Checkbox
                        id={`invite-perm-${perm}`}
                        checked={modulePermissions.includes(perm)}
                        onCheckedChange={(checked) =>
                          toggleModulePermission(perm, checked === true)
                        }
                      />
                      <FieldLabel htmlFor={`invite-perm-${perm}`} className="font-normal">
                        {PERMISSION_LABELS[perm]}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
              </FieldSet>
            ) : null}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button form="invite-form" type="submit" disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
