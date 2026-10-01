"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Dialog } from "@/components/Dialog"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Select } from "@/components/Select"
import { ClientFormDialog } from "./ClientFormDialog"
import { OperationFormFields } from "./OperationFormFields"
import { clientDisplayName } from "@/modules/collections/format"
import type { Client, Currency, Project } from "@/types/collections"

type ClientOption = Pick<Client, "id" | "clientType" | "firstName" | "lastName" | "businessName">

interface CreateOperationDialogProps {
  open: boolean
  onClose: () => void
  clients: ClientOption[]
  currencies: Currency[]
  projects: Project[]
  onCreated: (id: string) => void
}

// Igual que CreateOperationForm (misma etapa/monto/inmueble), pero pensado
// para abrirse desde el dashboard sin un cliente ya elegido: agrega el
// selector de cliente (con atajo para crear uno nuevo sin salir del diálogo)
// arriba del formulario de OperationFormFields.
export function CreateOperationDialog({ open, onClose, clients, currencies, projects, onCreated }: CreateOperationDialogProps) {
  const [clientList, setClientList] = useState<ClientOption[]>(clients)
  const [clientId, setClientId] = useState("")
  const [newClientOpen, setNewClientOpen] = useState(false)

  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setClientList(clients)
      setClientId("")
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Nueva cobranza" size="lg">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="p-4 space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Cliente</label>
            <div className="flex gap-2">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="flex-1">
                <option value="">— Seleccionar cliente —</option>
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientDisplayName(c)}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="secondary" onClick={() => setNewClientOpen(true)}>
                <Plus className="w-4 h-4" />
                Nuevo
              </Button>
            </div>
            {clientList.length === 0 && <p className="text-xs text-gray-400">Todavía no hay clientes cargados — creá el primero con &quot;Nuevo&quot;.</p>}
          </Card>

          {clientId ? (
            <OperationFormFields key={clientId} clientId={clientId} currencies={currencies} projects={projects} onCreated={onCreated} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Elegí o creá un cliente para continuar con la operación.</p>
          )}
        </div>
      </Dialog>

      <ClientFormDialog
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onSaved={(id, summary) => {
          setClientList((prev) => [{ id, ...summary }, ...prev])
          setClientId(id)
          setNewClientOpen(false)
        }}
      />
    </>
  )
}
