"use client"

import { useState, useTransition } from "react"
import { createProject, updateProject } from "@/modules/collections/actions/collectionsActions"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Textarea } from "@/components/Textarea"
import { Building2 } from "lucide-react"
import type { Project } from "@/types/collections"

interface FormState {
  name: string
  description: string
  address: string
  city: string
  country: string
}

const EMPTY_FORM: FormState = { name: "", description: "", address: "", city: "", country: "" }

function formFromProject(project: Project): FormState {
  return {
    name: project.name,
    description: project.description ?? "",
    address: project.address ?? "",
    city: project.city ?? "",
    country: project.country ?? "",
  }
}

interface ProjectFormDialogProps {
  open: boolean
  onClose: () => void
  project?: Project
  onSaved: (id: string) => void
}

export function ProjectFormDialog({ open, onClose, project, onSaved }: ProjectFormDialogProps) {
  const mode: "create" | "edit" = project ? "edit" : "create"
  const key = open ? (project?.id ?? "new") : null

  const [initializedKey, setInitializedKey] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  if (open && key !== initializedKey) {
    setInitializedKey(key)
    setForm(project ? formFromProject(project) : EMPTY_FORM)
  }

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = mode === "edit" ? await updateProject({ ...form, id: project!.id }) : await createProject(form)
        onSaved(result.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar")
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={mode === "edit" ? "Editar proyecto" : "Nuevo proyecto"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-3 flex items-center gap-3 bg-surface-alt/60">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary-dark" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{form.name || "Así se vería el proyecto"}</p>
            <p className="text-xs text-gray-500 truncate">{[form.city, form.country].filter(Boolean).join(", ") || "Sin ubicación"}</p>
          </div>
        </Card>

        <Field label="Nombre del proyecto">
          <Input required autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej. Torre Orozco" />
        </Field>
        <Field label="Dirección">
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="País">
            <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </Field>
        </div>
        <Field label="Descripción">
          <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            {mode === "edit" ? "Guardar cambios" : "Crear"}
          </Button>
        </div>
      </form>
    </Dialog>
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
