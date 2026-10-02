"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Mail, Phone, MapPin, FileText, Pencil, Archive, ArchiveRestore, ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Avatar } from "@/components/Avatar"
import { StatTile } from "@/components/StatTile"
import { ClientStatusBadge } from "./ClientStatusBadge"
import { OperationStatusBadge } from "./OperationStatusBadge"
import { ClientFormDialog } from "./ClientFormDialog"
import { ConfirmDialog } from "./ConfirmDialog"
import { setClientStatus } from "@/modules/collections/actions/collectionsActions"
import { clientDisplayName, formatMoney, formatOperationNumber } from "@/modules/collections/format"
import type { ClientDetail } from "@/types/collections"

export function ClientDetailShell({ detail }: { detail: ClientDetail }) {
  const { client, operations, totalBalanceByCurrency, totalPaidByCurrency } = detail
  const currencies = Object.keys(totalBalanceByCurrency)
  const router = useRouter()

  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isArchived = client.status === "archived"

  function handleToggleArchive() {
    setError(null)
    startTransition(async () => {
      try {
        await setClientStatus(client.id, isArchived ? "active" : "archived")
        setArchiveOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar el estado")
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={clientDisplayName(client)}
        description={`Documento ${client.documentNumber}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/cobranzas/clientes">
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
            <Button variant="ghost" onClick={() => setArchiveOpen(true)}>
              {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {isArchived ? "Reactivar" : "Archivar"}
            </Button>
            <Link href={`/cobranzas/clientes/${client.id}/operaciones/nueva`}>
              <Button>
                <Plus className="w-4 h-4" />
                Nueva operación
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar name={clientDisplayName(client)} size="lg" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-900">{clientDisplayName(client)}</h2>
              <ClientStatusBadge status={client.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> {client.phone}
                </span>
              )}
              {(client.city || client.country) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {[client.city, client.country].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
            {client.notes && (
              <p className="flex items-start gap-1.5 text-sm text-gray-500 pt-1">
                <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {client.notes}
              </p>
            )}
          </div>
        </Card>

        {currencies.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {currencies.map((code) => (
              <Card key={code} className="p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{code}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Saldo total" value={formatMoney(totalBalanceByCurrency[code], code)} />
                  <StatTile label="Pagado" value={formatMoney(totalPaidByCurrency[code], code)} />
                </div>
              </Card>
            ))}
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-gray-900">Operaciones</h3>
          </div>
          {operations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <p className="text-sm">Este cliente todavía no tiene operaciones financieras.</p>
              <p className="text-xs text-gray-400 max-w-sm text-center">
                Una operación es la obligación financiera del cliente (ej. la venta de un departamento a plazos): ahí se
                define el inmueble, el monto y el plan de pagos, y desde ahí se registran las cuotas y los cobros.
              </p>
              <Link href={`/cobranzas/clientes/${client.id}/operaciones/nueva`}>
                <Button size="sm">
                  <Plus className="w-3.5 h-3.5" />
                  Crear la primera operación
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Operación</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Inmueble</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {operations.map((op) => (
                    <tr key={op.id} className="hover:bg-surface-alt transition-colors duration-200">
                      <td className="px-4 py-3.5">
                        <Link href={`/cobranzas/operaciones/${op.id}`} className="font-medium text-gray-900 hover:text-primary-dark">
                          {formatOperationNumber(op.sequenceNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell text-gray-600">{op.propertyLabel ?? "—"}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-900">{formatMoney(op.currentBalance, op.currencyCode)}</td>
                      <td className="px-4 py-3.5">
                        <OperationStatusBadge status={op.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <ClientFormDialog open={editOpen} onClose={() => setEditOpen(false)} client={client} onSaved={() => { setEditOpen(false); router.refresh() }} />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleToggleArchive}
        title={isArchived ? "Reactivar cliente" : "Archivar cliente"}
        description={
          isArchived
            ? "El cliente vuelve a aparecer como activo. Sus operaciones y su historial no se ven afectados."
            : "El cliente pasa a estado archivado, pero no se borra nada: sus operaciones, cuotas y pagos siguen intactos y podés reactivarlo cuando quieras."
        }
        confirmLabel={isArchived ? "Reactivar" : "Archivar"}
        danger={!isArchived}
        isLoading={isPending}
        error={error}
      />
    </div>
  )
}
