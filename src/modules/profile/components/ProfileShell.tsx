"use client"

import { useState, useTransition } from "react"
import { Plane, Plus } from "lucide-react"
import type { OwnProfile, UserRole } from "@/types/users"
import type { LeaveType, PersonnelLeavePage } from "@/types/personnel"
import { updateOwnProfile, changeOwnPassword } from "@/modules/profile/actions/profileActions"
import { requestLeave } from "@/modules/personnel/actions/personnelActions"
import { LEAVE_TYPE_LABELS } from "@/modules/personnel/labels"
import { LeaveStatusBadge } from "@/modules/personnel/components/LeaveStatusBadge"
import { Avatar } from "@/components/Avatar"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Textarea } from "@/components/Textarea"
import { Button } from "@/components/Button"
import { Badge } from "@/components/Badge"
import { Dialog } from "@/components/Dialog"
import { Pagination } from "@/components/Pagination"

interface ProfileShellProps {
  profile: OwnProfile
  personnelId: string | null
  leaves: PersonnelLeavePage
  vacationDaysUsed: number
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

export function ProfileShell({ profile, personnelId, leaves, vacationDaysUsed }: ProfileShellProps) {
  const [name, setName] = useState(profile.name)
  const [profileMsg, setProfileMsg] = useState<FeedbackMsg | null>(null)
  const [isSavingProfile, startProfileTransition] = useTransition()
  const [requestOpen, setRequestOpen] = useState(false)

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

        {personnelId && (
          <Card className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  Vacaciones y licencias
                </h3>
                <Button variant="secondary" size="sm" onClick={() => setRequestOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Solicitar
                </Button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Días de vacaciones descontados hasta ahora: <span className="font-medium text-gray-900">{vacationDaysUsed}</span>
              </p>
              {leaves.leaves.length === 0 ? (
                <p className="text-sm text-gray-400">Todavía no hiciste ninguna solicitud.</p>
              ) : (
                <ul className="space-y-2">
                  {leaves.leaves.map((leave) => (
                    <li key={leave.id} className="px-3 py-2.5 rounded-xl border border-border">
                      <p className="text-sm text-gray-900 flex items-center flex-wrap gap-2">
                        <span className="font-medium">{LEAVE_TYPE_LABELS[leave.type]}</span>
                        · {leave.daysCount} {Number(leave.daysCount) === 1 ? "día" : "días"}
                        <LeaveStatusBadge status={leave.status} />
                      </p>
                      <p className="text-xs text-gray-400 break-words">
                        {leave.startDate} → {leave.endDate}
                        {leave.notes ? ` · ${leave.notes}` : ""}
                        {leave.status === "rejected" && leave.decisionNote ? ` · Motivo: ${leave.decisionNote}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Pagination page={leaves.page} totalPages={leaves.totalPages} basePath="/perfil" />
          </Card>
        )}

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
      {personnelId && <RequestLeaveDialog open={requestOpen} onClose={() => setRequestOpen(false)} />}
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

const EMPTY_REQUEST_FORM = {
  type: "vacaciones" as LeaveType,
  startDate: "",
  endDate: "",
  daysCount: "",
  notes: "",
}

function RequestLeaveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_REQUEST_FORM)
  const [prevOpen, setPrevOpen] = useState(open)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setForm(EMPTY_REQUEST_FORM)
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await requestLeave({ ...form, countsAsVacation: form.type === "vacaciones" })
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo enviar la solicitud")
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Solicitar vacaciones o licencia">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Tipo">
          <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LeaveType }))}>
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Desde">
            <Input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Field>
          <Field label="Hasta">
            <Input
              type="date"
              required
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Cantidad de días">
          <Input
            type="number"
            min="0.5"
            step="0.5"
            required
            value={form.daysCount}
            onChange={(e) => setForm((f) => ({ ...f, daysCount: e.target.value }))}
          />
        </Field>

        <Field label="Notas (opcional)">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            Enviar solicitud
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
