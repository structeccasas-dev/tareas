"use client"

import { useState, useTransition, useMemo } from "react"
import { Plus, Search, FolderKanban } from "lucide-react"
import type { Project } from "@/types/projects"
import { createProject, renameProject, deleteProject } from "@/modules/projects/actions/projectActions"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Badge } from "@/components/Badge"
import { PageHeader } from "@/components/PageHeader"

interface ProjectsShellProps {
  projects: Project[]
}

export function ProjectsShell({ projects }: ProjectsShellProps) {
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [name, setName] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => p.name.toLowerCase().includes(q))
  }, [projects, search])

  function openCreate() {
    setEditingProject(null)
    setName("")
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(project: Project) {
    setEditingProject(project)
    setName(project.name)
    setFormError(null)
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    startTransition(async () => {
      try {
        if (editingProject) {
          await renameProject(editingProject.id, name)
        } else {
          await createProject(name)
        }
        setDialogOpen(false)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "No se pudo guardar el proyecto.")
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    startTransition(async () => {
      try {
        await deleteProject(deleteTarget.id)
        setDeleteTarget(null)
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar el proyecto.")
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Proyectos"
        description={`${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"} en el sistema`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nuevo proyecto
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
                  <FolderKanban className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
                  <p className="mt-3 text-sm">No hay proyectos. Creá el primero.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Proyecto</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tareas en curso</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((project) => (
                    <tr key={project.id} className="hover:bg-surface-alt transition-colors duration-200 group">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900 truncate">{project.name}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {project.activeTaskCount === 0 ? (
                          <span className="text-xs text-gray-300 italic">Ninguna</span>
                        ) : (
                          <Badge tone="info">{project.activeTaskCount}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(project)} disabled={isPending}>
                            Editar
                          </Button>
                          <button
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteTarget(project)
                            }}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingProject ? "Editar proyecto" : "Nuevo proyecto"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre">
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Migración CRM, Rediseño web..."
            />
          </Field>

          {formError && (
            <p className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-3.5 py-2.5">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cerrar
            </Button>
            <Button type="submit" isLoading={isPending}>
              {editingProject ? "Guardar nombre" : "Crear proyecto"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar proyecto">
        <div className="space-y-4">
          {deleteTarget && deleteTarget.activeTaskCount > 0 ? (
            <p className="text-sm text-gray-600">
              No se puede eliminar <span className="font-medium text-gray-900">&quot;{deleteTarget.name}&quot;</span>: tiene{" "}
              <span className="font-medium text-gray-900">{deleteTarget.activeTaskCount}</span>{" "}
              {deleteTarget.activeTaskCount === 1 ? "tarea en curso" : "tareas en curso"}. Primero terminá o cancelá esas tareas, o
              cambiales el proyecto.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              ¿Estás seguro que querés eliminar el proyecto{" "}
              <span className="font-medium text-gray-900">&quot;{deleteTarget?.name}&quot;</span>? Las tareas finalizadas o canceladas
              que tenía quedarán sin proyecto.
            </p>
          )}
          {deleteError && (
            <p className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-3.5 py-2.5">{deleteError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              isLoading={isPending}
              onClick={handleDelete}
              disabled={!!deleteTarget && deleteTarget.activeTaskCount > 0}
            >
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
