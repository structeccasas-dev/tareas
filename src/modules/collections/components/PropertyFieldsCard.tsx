"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { createProject } from "@/modules/collections/actions/collectionsActions"
import type { Project, PropertyType } from "@/types/collections"

interface PropertyFieldsCardProps {
  hasProperty: boolean
  setHasProperty: (value: boolean) => void
  projectsList: Project[]
  setProjectsList: (updater: (prev: Project[]) => Project[]) => void
  projectId: string
  setProjectId: (value: string) => void
  projectNameSnapshot: string
  setProjectNameSnapshot: (value: string) => void
  unitLabel: string
  setUnitLabel: (value: string) => void
  propertyType: PropertyType | ""
  setPropertyType: (value: PropertyType | "") => void
  areaM2: string
  setAreaM2: (value: string) => void
  title?: string
}

// Bloque "Inmueble" (proyecto/unidad/tipo/superficie) del formulario de
// operación — lo comparten el alta (OperationFormFields) y la edición del
// inmueble ya asociado a una operación existente (OperationDetailShell), así
// que vive acá una sola vez en vez de duplicar el manejo del selector de
// proyecto + alta rápida de proyecto nuevo.
export function PropertyFieldsCard({
  hasProperty,
  setHasProperty,
  projectsList,
  setProjectsList,
  projectId,
  setProjectId,
  projectNameSnapshot,
  setProjectNameSnapshot,
  unitLabel,
  setUnitLabel,
  propertyType,
  setPropertyType,
  areaM2,
  setAreaM2,
  title = "Inmueble",
}: PropertyFieldsCardProps) {
  const [, startTransition] = useTransition()
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)

  function handleProjectSelect(id: string) {
    setProjectId(id)
    // Al vincular un proyecto del catálogo, el nombre snapshot se toma de
    // ahí (y queda bloqueado) — sólo es de carga libre para inmuebles
    // "históricos" sin proyecto en el catálogo (ver — Sin vincular —).
    const selected = projectsList.find((p) => p.id === id)
    setProjectNameSnapshot(selected ? selected.name : "")
  }

  function handleCreateProject() {
    const name = newProjectName.trim()
    if (!name) return
    setIsCreatingProject(true)
    startTransition(async () => {
      try {
        const created = await createProject({ name })
        const newProject: Project = {
          id: created.id,
          name,
          description: null,
          address: null,
          city: null,
          country: null,
          status: "active",
          createdBy: "",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        setProjectsList((prev) => [...prev, newProject])
        setProjectId(created.id)
        setProjectNameSnapshot(name)
        setShowNewProject(false)
        setNewProjectName("")
      } catch (err) {
        setProjectError(err instanceof Error ? err.message : "No se pudo crear el proyecto")
      } finally {
        setIsCreatingProject(false)
      }
    })
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={hasProperty} onChange={(e) => setHasProperty(e.target.checked)} />
          Asociar un inmueble
        </label>
      </div>

      {hasProperty && (
        <div className="space-y-3">
          <div>
            <Field label="Proyecto existente (opcional)">
              {!showNewProject ? (
                <div className="flex gap-2">
                  <Select value={projectId} onChange={(e) => handleProjectSelect(e.target.value)} className="flex-1">
                    <option value="">— Sin vincular —</option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowNewProject(true)}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Nombre del nuevo proyecto"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <Button type="button" size="sm" onClick={handleCreateProject} isLoading={isCreatingProject}>
                    Crear
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewProject(false)}>
                    Cancelar
                  </Button>
                </div>
              )}
              {projectError && <p className="text-xs text-red-600">{projectError}</p>}
              {projectsList.length === 0 && !showNewProject && (
                <p className="text-xs text-gray-400">Todavía no hay proyectos cargados — usá el botón + para crear el primero.</p>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del proyecto">
              <Input
                required
                readOnly={!!projectId}
                value={projectNameSnapshot}
                onChange={(e) => setProjectNameSnapshot(e.target.value)}
                placeholder="Ej. Torre Orozco"
              />
            </Field>
            <Field label="Unidad / departamento">
              <Input required value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="Ej. 502" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de inmueble">
              <Select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType | "")}>
                <option value="">—</option>
                <option value="departamento">Departamento</option>
                <option value="casa">Casa</option>
                <option value="oficina">Oficina</option>
                <option value="local">Local</option>
                <option value="terreno">Terreno</option>
                <option value="parqueo">Parqueo</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Superficie (m²)">
              <Input type="number" step="0.01" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Card>
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
