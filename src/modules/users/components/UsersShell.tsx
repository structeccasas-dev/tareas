"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Search, Users as UsersIcon } from "lucide-react"
import type { UserRole, User } from "@/types/users"
import { createUser, updateUser, toggleUserActive } from "@/modules/users/actions/userActions"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Badge } from "@/components/Badge"
import { Avatar } from "@/components/Avatar"
import { PageHeader } from "@/components/PageHeader"

interface UsersShellProps {
  users: User[]
}

interface FormState {
  name: string
  email: string
  role: UserRole
  active: boolean
  password: string
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  role: "agent",
  active: true,
  password: "",
}

export function UsersShell({ users }: UsersShellProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, search])

  function openCreate() {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      password: "",
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: form.name,
          email: form.email,
          role: form.role,
          active: form.active,
          password: form.password || undefined,
        })
      } else {
        await createUser({
          name: form.name,
          email: form.email,
          role: form.role,
          active: form.active,
          password: form.password,
        })
      }
      setDialogOpen(false)
    })
  }

  function handleToggle(user: User) {
    startTransition(() => toggleUserActive(user.id, !user.active))
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Usuarios"
        description={`${users.length} ${users.length === 1 ? "usuario" : "usuarios"} en el sistema`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </Button>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Input
              type="text"
              icon={<Search />}
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              {search ? (
                <>
                  <Search className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
                  <p className="mt-3 text-sm">Sin resultados para &quot;{search}&quot;</p>
                </>
              ) : (
                <>
                  <UsersIcon className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
                  <p className="mt-3 text-sm">No hay usuarios. Crea el primero.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Usuario</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Rol
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-alt transition-colors duration-200 group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{user.name}</p>
                            <p className="text-xs text-gray-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge active={user.active} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(user)} disabled={isPending}>
                            Editar
                          </Button>
                          <button
                            onClick={() => handleToggle(user)}
                            disabled={isPending}
                            className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-colors duration-200 disabled:opacity-40 whitespace-nowrap ${
                              user.active
                                ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                : "text-primary-dark hover:bg-primary/10"
                            }`}
                          >
                            {user.active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onClose={closeDialog} title={editingUser ? "Editar usuario" : "Nuevo usuario"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre">
            <Input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nombre completo"
            />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@ejemplo.com"
            />
          </Field>

          <Field label={editingUser ? "Nueva contraseña (opcional)" : "Contraseña"}>
            <Input
              type="password"
              required={!editingUser}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={editingUser ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
              minLength={editingUser && !form.password ? undefined : 8}
            />
          </Field>

          <Field label="Rol">
            <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
              <option value="agent">Miembro</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>

          <Field label="Estado">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.active}
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  form.active ? "bg-primary" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    form.active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">{form.active ? "Activo" : "Inactivo"}</span>
            </div>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              {editingUser ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </div>
        </form>
      </Dialog>
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

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "admin") {
    return (
      <Badge tone="neutral" className="!bg-purple-50 !text-purple-700">
        Admin
      </Badge>
    )
  }
  if (role === "supervisor") {
    return (
      <Badge tone="neutral" className="!bg-amber-50 !text-amber-700">
        Supervisor
      </Badge>
    )
  }
  return <Badge tone="info">Miembro</Badge>
}

function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <Badge tone="primary" dot>
        Activo
      </Badge>
    )
  }
  return (
    <Badge tone="neutral" dot>
      Inactivo
    </Badge>
  )
}
