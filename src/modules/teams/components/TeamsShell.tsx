"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Search, Users as UsersIcon, X } from "lucide-react"
import type { Team } from "@/types/teams"
import type { User } from "@/types/users"
import { createTeam, renameTeam, deleteTeam, addTeamMember, removeTeamMember } from "@/modules/teams/actions/teamActions"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Badge } from "@/components/Badge"
import { Avatar } from "@/components/Avatar"
import { PageHeader } from "@/components/PageHeader"

interface TeamsShellProps {
  teams: Team[]
  users: User[]
}

export function TeamsShell({ teams, users }: TeamsShellProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [name, setName] = useState("")
  const [addUserId, setAddUserId] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [teams, search])

  function openCreate() {
    setEditingTeam(null)
    setName("")
    setAddUserId("")
    setDialogOpen(true)
  }

  function openEdit(team: Team) {
    setEditingTeam(team)
    setName(team.name)
    setAddUserId("")
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (editingTeam) {
        await renameTeam(editingTeam.id, name)
      } else {
        // Se queda en el diálogo, ahora en modo edición del equipo recién creado,
        // para poder agregarle miembros sin tener que reabrirlo.
        const created = await createTeam(name)
        setEditingTeam({ id: created.id, name: name.trim(), createdAt: new Date(), members: [] })
      }
    })
  }

  function handleAddMember() {
    if (!editingTeam || !addUserId) return
    const teamId = editingTeam.id
    const userId = addUserId
    setAddUserId("")
    startTransition(() => addTeamMember(teamId, userId))
  }

  function handleRemoveMember(userId: string) {
    if (!editingTeam) return
    startTransition(() => removeTeamMember(editingTeam.id, userId))
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      await deleteTeam(deleteTarget.id)
      setDeleteTarget(null)
    })
  }

  const editingTeamLive = editingTeam ? (teams.find((t) => t.id === editingTeam.id) ?? editingTeam) : null
  const availableUsers = editingTeamLive
    ? users.filter((u) => !editingTeamLive.members.some((m) => m.id === u.id))
    : []

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Equipos"
        description={`${teams.length} ${teams.length === 1 ? "equipo" : "equipos"} en el sistema`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nuevo equipo
          </Button>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Input
              type="text"
              icon={<Search />}
              placeholder="Buscar por nombre..."
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
                  <p className="mt-3 text-sm">No hay equipos. Creá el primero.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Equipo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Miembros</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((team) => (
                    <tr key={team.id} className="hover:bg-surface-alt transition-colors duration-200 group">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900 truncate">{team.name}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {team.members.length === 0 ? (
                          <span className="text-xs text-gray-300 italic">Sin miembros</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {team.members.slice(0, 4).map((m) => (
                              <Badge key={m.id} tone="neutral">
                                {m.name}
                              </Badge>
                            ))}
                            {team.members.length > 4 && (
                              <Badge tone="neutral">+{team.members.length - 4}</Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(team)} disabled={isPending}>
                            Editar
                          </Button>
                          <button
                            onClick={() => setDeleteTarget(team)}
                            disabled={isPending}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors duration-200 disabled:opacity-40 whitespace-nowrap"
                          >
                            Eliminar
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

      <Dialog open={dialogOpen} onClose={closeDialog} title={editingTeam ? "Editar equipo" : "Nuevo equipo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre">
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Soporte, Ventas..."
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeDialog} disabled={isPending}>
              Cerrar
            </Button>
            <Button type="submit" isLoading={isPending}>
              {editingTeam ? "Guardar nombre" : "Crear equipo"}
            </Button>
          </div>
        </form>

        {editingTeamLive && (
          <div className="mt-5 pt-4 border-t border-border space-y-3">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Miembros</h3>

            {editingTeamLive.members.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin miembros todavía.</p>
            ) : (
              <ul className="space-y-1.5">
                {editingTeamLive.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-surface-alt/60">
                    <span className="flex items-center gap-2 min-w-0">
                      <Avatar name={m.name} size="sm" />
                      <span className="text-sm text-gray-700 truncate">{m.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={isPending}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors duration-150 disabled:opacity-40"
                      title="Quitar del equipo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {availableUsers.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} uiSize="sm">
                  <option value="">Agregar usuario...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <Button type="button" variant="secondary" size="sm" onClick={handleAddMember} disabled={!addUserId || isPending}>
                  Agregar
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar equipo">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro que querés eliminar el equipo <span className="font-medium text-gray-900">&quot;{deleteTarget?.name}&quot;</span>?
            Las tareas asignadas a este equipo quedarán sin asignar.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="danger" isLoading={isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </div>
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
