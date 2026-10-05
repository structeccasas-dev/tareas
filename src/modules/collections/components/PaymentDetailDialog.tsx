"use client"

import { useEffect, useState } from "react"
import { Pencil, XCircle } from "lucide-react"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { loadPaymentDetail } from "@/modules/collections/actions/collectionsActions"
import { formatMoney } from "@/modules/collections/format"
import type { PaymentDetail, PaymentMethod, PaymentWithUsers } from "@/types/collections"

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Transferencia bancaria",
  deposit: "Depósito",
  cash: "Efectivo",
  card: "Tarjeta",
  check: "Cheque",
  other: "Otro",
}

const CATEGORY_LABEL: Record<string, string> = {
  regular: "Regular",
  extraordinary: "Extraordinario",
  down_payment: "Pie / anticipo",
  settlement: "Liquidación",
}

const formatDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })

interface PaymentDetailDialogProps {
  payment: PaymentWithUsers
  operationCurrencyCode: string
  onClose: () => void
  onEdit: () => void
  onReverse: () => void
}

// Se monta con `key={payment.id}` desde el padre, así el estado de carga se
// reinicia solo al abrir otro pago.
export function PaymentDetailDialog({ payment: p, operationCurrencyCode, onClose, onEdit, onReverse }: PaymentDetailDialogProps) {
  const [detail, setDetail] = useState<PaymentDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPaymentDetail(p.id)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "No se pudo cargar el detalle"))
    return () => {
      cancelled = true
    }
  }, [p.id])

  const isReversed = p.status === "reversed"
  const hasWaived = detail?.allocations.some((a) => Number(a.waivedInterest) + Number(a.waivedOther) > 0) ?? false

  return (
    <Dialog open onClose={onClose} title="Detalle del pago" size="lg">
      <div className="mx-auto max-w-2xl space-y-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="Monto">
            <span className={isReversed ? "line-through" : "font-semibold"}>{formatMoney(p.amount, p.currencyCode)}</span>
            {p.currencyCode !== operationCurrencyCode && p.convertedAmount && (
              <span className="block text-xs text-gray-500">
                ≈ {formatMoney(p.convertedAmount, operationCurrencyCode)} (T.C. {p.exchangeRate})
              </span>
            )}
          </Item>
          <Item label="Estado">
            {isReversed ? (
              <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Anulado</span>
            ) : (
              <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Confirmado</span>
            )}
          </Item>
          <Item label="Fecha de pago">{p.paymentDate}</Item>
          <Item label="Categoría">{CATEGORY_LABEL[p.paymentCategory] ?? p.paymentCategory}</Item>
          <Item label="Interés de cuotas futuras">{p.chargeFutureInterest ? "Cobrado" : "No cobrado (solo capital)"}</Item>
          <Item label="Método">{PAYMENT_METHOD_LABEL[p.paymentMethod]}</Item>
          <Item label="Banco">{p.bankName ?? "—"}</Item>
          <Item label="Referencia">{p.referenceNumber ?? "—"}</Item>
          <Item label="Registrado por">
            {p.registeredByName}
            <span className="block text-xs text-gray-500">{formatDateTime(p.createdAt)}</span>
          </Item>
          {p.observations && (
            <div className="col-span-2">
              <Item label="Observaciones">{p.observations}</Item>
            </div>
          )}
          {isReversed && (
            <div className="col-span-2">
              <Item label="Anulación">
                {p.reversedByName ? `Por ${p.reversedByName}` : "Anulado"}
                {p.reversedAt && ` · ${formatDateTime(p.reversedAt)}`}
                {p.reversalReason && <span className="block text-gray-600">{p.reversalReason}</span>}
              </Item>
            </div>
          )}
        </dl>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Comprobante</h3>
          {p.receiptUrl ? (
            <a href={`/api/cobranzas/receipts/${p.id}`} target="_blank" rel="noopener noreferrer" className="inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/cobranzas/receipts/${p.id}`}
                alt="Comprobante de pago"
                loading="lazy"
                className="max-h-80 rounded-xl border border-border object-contain"
              />
            </a>
          ) : (
            <p className="text-sm text-gray-400">Este pago no tiene comprobante adjunto.</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Cómo se aplicó</h3>
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {!detail && !loadError && <p className="text-sm text-gray-400">Cargando...</p>}
          {detail && detail.allocations.length === 0 && <p className="text-sm text-gray-400">No se aplicó a ninguna cuota.</p>}
          {detail && detail.allocations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-alt text-gray-500 uppercase tracking-wide">
                    <th className="px-2 py-2 text-left font-medium">Cuota</th>
                    <th className="px-2 py-2 text-right font-medium">Capital</th>
                    <th className="px-2 py-2 text-right font-medium">Interés</th>
                    <th className="px-2 py-2 text-right font-medium">Mora</th>
                    <th className="px-2 py-2 text-right font-medium">Cargos</th>
                    <th className="px-2 py-2 text-right font-medium">Total</th>
                    {hasWaived && <th className="px-2 py-2 text-right font-medium">No cobrado</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.allocations.map((a) => (
                    <tr key={a.id}>
                      <td className="px-2 py-2 text-gray-700">
                        #{a.installmentNumber}
                        <span className="block text-gray-400">vence {a.installmentDueDate}</span>
                      </td>
                      <td className="px-2 py-2 text-right">{formatMoney(a.allocatedPrincipal, operationCurrencyCode)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(a.allocatedInterest, operationCurrencyCode)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(a.allocatedLateFee, operationCurrencyCode)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(a.allocatedOther, operationCurrencyCode)}</td>
                      <td className="px-2 py-2 text-right font-medium text-gray-900">{formatMoney(a.allocatedAmount, operationCurrencyCode)}</td>
                      {hasWaived && (
                        <td className="px-2 py-2 text-right text-amber-700">
                          {Number(a.waivedInterest) + Number(a.waivedOther) > 0
                            ? formatMoney(Number(a.waivedInterest) + Number(a.waivedOther), operationCurrencyCode)
                            : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasWaived && (
            <p className="mt-2 text-xs text-gray-500">
              Las cuotas marcadas quedaron pagadas por adelantado: se cubrió el capital y el interés/cargos de ese período
              no se cobró. El plan de pagos conserva el interés original; si se anula este pago, vuelve a ser deuda.
            </p>
          )}
        </section>

        {detail && detail.events.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Historial</h3>
            <ul className="space-y-2">
              {detail.events.map((e) => (
                <li key={e.id} className="text-xs text-gray-600">
                  <span className="text-gray-400">{formatDateTime(e.performedAt)}</span> · {e.description}
                  {e.performedByName && <span className="text-gray-400"> — {e.performedByName}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          {!isReversed && (
            <>
              <Button type="button" variant="ghost" onClick={onReverse}>
                <XCircle className="w-4 h-4 mr-1.5" />
                Anular
              </Button>
              <Button type="button" onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-1.5" />
                Editar
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900">{children}</dd>
    </div>
  )
}
