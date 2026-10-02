"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Building2, Pencil, Archive, ArchiveRestore } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { ProjectStatusBadge } from "./ProjectStatusBadge"
import { ProjectFormDialog } from "./ProjectFormDialog"
import { ConfirmDialog } from "./ConfirmDialog"
import { setProjectStatus } from "@/modules/collections/actions/collectionsActions"
import type { Project } from "@/types/collections"

export function ProjectsShell({ projects }: { projects: Project[] }) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Project | undefined>(undefined)
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(project: Project) {
    setEditing(project)
    setDialogOpen(true)
  }

  function handleToggleArchive() {
    if (!archiveTarget) return
    setError(null)
    startTransition(async () => {
      try {
        await setProjectStatus(archiveTarget.id, archiveTarget.status === "archived" ? "active" : "archived")
        setArchiveTarget(null)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar el estado")
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Proyectos"
        description={`${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"} cargados`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Nuevo proyecto
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-3xl mx-auto w-full">
        <Card className="overflow-hidden">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Building2 className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
              <p className="mt-3 text-sm">Todavía no hay proyectos cargados.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-primary-dark" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500 truncate">{[p.city, p.country].filter(Boolean).join(", ") || "Sin ubicación"}</p>
                  </div>
                  <ProjectStatusBadge status={p.status} />
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(p)}>
                      {p.status === "archived" ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ProjectFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        project={editing}
        onSaved={() => {
          setDialogOpen(false)
          router.refresh()
        }}
      />

      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleToggleArchive}
        title={archiveTarget?.status === "archived" ? "Reactivar proyecto" : "Archivar proyecto"}
        description={
          archiveTarget?.status === "archived"
            ? "El proyecto vuelve a estar disponible para vincularlo a nuevas operaciones."
            : "El proyecto deja de aparecer para vincularlo a operaciones nuevas, pero las operaciones e inmuebles que ya lo referencian no se ven afectados. No se borra nada."
        }
        confirmLabel={archiveTarget?.status === "archived" ? "Reactivar" : "Archivar"}
        danger={archiveTarget?.status !== "archived"}
        isLoading={isPending}
        error={error}
      />
    </div>
  )
}
