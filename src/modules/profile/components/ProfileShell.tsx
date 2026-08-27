"use client"

import { useState, useTransition } from "react"
import type { OwnProfile, UserRole } from "@/types/users"
import { updateOwnProfile, changeOwnPassword } from "@/modules/profile/actions/profileActions"
import { Avatar } from "@/components/Avatar"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Button } from "@/components/Button"
import { Badge } from "@/components/Badge"

interface ProfileShellProps {
  profile: OwnProfile
}

interface FeedbackMsg {
  type: "success" | "error"
  text: string
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  agent: "Usuario",
}

export function ProfileShell({ profile }: ProfileShellProps) {
  const [name, setName] = useState(profile.name)
  const [profileMsg, setProfileMsg] = useState<FeedbackMsg | null>(null)
  const [isSavingProfile, startProfileTransition] = useTransition()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMsg, setPasswordMsg] = useState<FeedbackMsg | null>(null)
  const [isSavingPassword, startPasswordTransition] = useTransition()

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileMsg(null)
    startProfileTransition(async () => {
      try {
        await updateOwnProfile({ name })
        setProfileMsg({ type: "success", text: "Perfil actualizado" })
      } catch (err) {
        setProfileMsg({ type: "error", text: err instanceof Error ? err.message : "No se pudo guardar" })
      }
    })
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Las contraseñas nuevas no coinciden" })
      return
    }
    startPasswordTransition(async () => {
      try {
        await changeOwnPassword({ currentPassword, newPassword })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setPasswordMsg({ type: "success", text: "Contraseña actualizada" })
      } catch (err) {
        setPasswordMsg({
          type: "error",
          text: err instanceof Error ? err.message : "No se pudo cambiar la contraseña",
        })
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Mi perfil" description="Administrá tu cuenta" />

      <div className="p-6 max-w-2xl mx-auto w-full space-y-6">
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Datos personales</h3>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={name || profile.name} size="lg" />
            </div>

            <Field label="Nombre">
              <Input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <Field label="Email">
              <Input type="email" value={profile.email} disabled />
            </Field>

            <Field label="Rol">
              <Badge tone="neutral">{ROLE_LABEL[profile.role]}</Badge>
            </Field>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" isLoading={isSavingProfile}>
                Guardar cambios
              </Button>
              {profileMsg && (
                <p className={`text-sm ${profileMsg.type === "success" ? "text-success" : "text-error"}`}>{profileMsg.text}</p>
              )}
            </div>
          </form>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Contraseña</h3>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Field label="Contraseña actual">
              <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </Field>
            <Field label="Nueva contraseña">
              <Input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </Field>
            <Field label="Confirmar nueva contraseña">
              <Input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" isLoading={isSavingPassword}>
                Cambiar contraseña
              </Button>
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.type === "success" ? "text-success" : "text-error"}`}>{passwordMsg.text}</p>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
