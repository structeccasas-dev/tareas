"use client"

import { useState, useTransition } from "react"
import { createClient, updateClient } from "@/modules/collections/actions/collectionsActions"
import { clientDisplayName } from "@/modules/collections/format"
import { ClientStatusBadge } from "./ClientStatusBadge"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Avatar } from "@/components/Avatar"
import type { Client, ClientDocumentType, ClientType } from "@/types/collections"

interface FormState {
  clientType: ClientType
  firstName: string
  lastName: string
  businessName: string
  documentType: ClientDocumentType
  documentNumber: string
  email: string
  phone: string
  city: string
  country: string
}

const EMPTY_FORM: FormState = {
  clientType: "person",
  firstName: "",
  lastName: "",
  businessName: "",
  documentType: "ci",
  documentNumber: "",
  email: "",
  phone: "",
  city: "",
  country: "",
}

function formFromClient(client: Client): FormState {
  return {
    clientType: client.clientType,
    firstName: client.firstName ?? "",
    lastName: client.lastName ?? "",
    businessName: client.businessName ?? "",
    documentType: client.documentType,
    documentNumber: client.documentNumber,
    email: client.email ?? "",
    phone: client.phone ?? "",
    city: client.city ?? "",
    country: client.country ?? "",
  }
}

interface ClientFormDialogProps {
  open: boolean
  onClose: () => void
  client?: Client
  onSaved: (id: string, summary: Pick<Client, "clientType" | "firstName" | "lastName" | "businessName">) => void
}

export function ClientFormDialog({ open, onClose, client, onSaved }: ClientFormDialogProps) {
  const mode: "create" | "edit" = client ? "edit" : "create"
  const key = open ? (client?.id ?? "new") : null

  const [initializedKey, setInitializedKey] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  if (open && key !== initializedKey) {
    setInitializedKey(key)
    setForm(client ? formFromClient(client) : EMPTY_FORM)
  }

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const result = mode === "edit" ? await updateClient({ ...form, id: client!.id }) : await createClient(form)
        onSaved(result.id, {
          clientType: form.clientType,
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          businessName: form.businessName.trim() || null,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar")
      }
    })
  }

  const previewClient = { clientType: form.clientType, firstName: form.firstName, lastName: form.lastName, businessName: form.businessName }

  return (
    <Dialog open={open} onClose={onClose} title={mode === "edit" ? "Editar cliente" : "Nuevo cliente"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-3 flex items-center gap-3 bg-surface-alt/60">
          <Avatar name={clientDisplayName(previewClient) || "—"} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{clientDisplayName(previewClient) || "Así se vería el cliente"}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="truncate">{form.documentNumber || "Sin documento todavía"}</span>
              <ClientStatusBadge status={client?.status ?? "active"} />
            </div>
          </div>
        </Card>

        <Field label="Tipo de cliente">
          <Select value={form.clientType} onChange={(e) => setForm((f) => ({ ...f, clientType: e.target.value as ClientType }))}>
            <option value="person">Persona natural</option>
            <option value="company">Empresa</option>
          </Select>
        </Field>

        {form.clientType === "person" ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <Input required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </Field>
            <Field label="Apellido">
              <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </Field>
          </div>
        ) : (
          <Field label="Razón social">
            <Input required value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo de documento">
            <Select value={form.documentType} onChange={(e) => setForm((f) => ({ ...f, documentType: e.target.value as ClientDocumentType }))}>
              <option value="ci">Cédula de identidad</option>
              <option value="nit">NIT</option>
              <option value="passport">Pasaporte</option>
              <option value="other">Otro</option>
            </Select>
          </Field>
          <Field label="Número de documento">
            <Input required value={form.documentNumber} onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </Field>
          <Field label="País">
            <Input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          </Field>
        </div>

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
