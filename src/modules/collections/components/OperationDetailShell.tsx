"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { ArrowLeft, DollarSign, Ban, Trash2, Repeat, XCircle, AlertTriangle, Pencil, Building2, Eye } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { compressImage } from "@/lib/clientImage"
import { PaymentDetailDialog, PAYMENT_METHOD_LABEL } from "./PaymentDetailDialog"

// Mismo tope que RECEIPT_MAX_BYTES en src/lib/receiptStorage.ts (server-only,
// no se puede importar desde un componente cliente).
const RECEIPT_MAX_BYTES = 1024 * 1024
import { Textarea } from "@/components/Textarea"
import { Dialog } from "@/components/Dialog"
import { StatTile } from "@/components/StatTile"
import { Tooltip } from "@/components/Tooltip"
import { OperationStatusBadge } from "./OperationStatusBadge"
import { InstallmentStatusBadge } from "./InstallmentStatusBadge"
import { PropertyFieldsCard } from "./PropertyFieldsCard"
import {
  registerPayment,
  updatePayment,
  reversePayment,
  cancelOperation,
  deleteOperation,
  replanOperationPlan,
  updateOperationProperty,
} from "@/modules/collections/actions/collectionsActions"
import { findEmptyStages, generatePlanSchedule } from "@/modules/collections/engine/schedule"
import { clientDisplayName, convertCurrency, exchangeRateLabel, formatMoney, formatOperationNumber, preciseInstallmentTotal } from "@/modules/collections/format"
import { StageBuilderCard, newStage, toStageScheduleInput, type StageForm } from "./StageBuilder"
import { DEFAULT_APPLICATION_ORDER } from "@/types/collections"
import type { Currency, OperationDetail, PaymentComponent, PaymentMethod, PaymentWithUsers, PlanVersionReason, Project, PropertyType } from "@/types/collections"

const REPLAN_REASON_LABEL: Record<Exclude<PlanVersionReason, "initial">, string> = {
  prepayment_recalculation: "Recálculo por pago adelantado",
  refinancing: "Refinanciación",
  restructuring: "Reestructuración",
  correction: "Corrección",
}

const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  departamento: "Departamento",
  casa: "Casa",
  oficina: "Oficina",
  local: "Local",
  terreno: "Terreno",
  parqueo: "Parqueo",
  otro: "Otro",
}

const STAGE_TYPE_LABEL: Record<string, string> = {
  cash: "Contado",
  fixed_installment: "Cuotas fijas",
  french: "Sistema francés",
  custom: "Personalizada",
}

const COMPONENT_LABEL: Record<PaymentComponent, string> = {
  late_fee: "Mora",
  interest: "Interés",
  other_charges: "Cargos",
  principal: "Capital",
}

export function OperationDetailShell({ detail, currencies, projects }: { detail: OperationDetail; currencies: Currency[]; projects: Project[] }) {
  const { operation, client, property, stages, installments, payments, activePlanVersion } = detail
  const isHistoricalPlan = activePlanVersion != null && activePlanVersion.status !== "active"
  const router = useRouter()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState("")
  const [paymentCurrencyCode, setPaymentCurrencyCode] = useState(operation.currencyCode)
  const [exchangeRate, setExchangeRate] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer")
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [referenceNumber, setReferenceNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [observations, setObservations] = useState("")
  const [order, setOrder] = useState<PaymentComponent[]>(DEFAULT_APPLICATION_ORDER)
  const [chargeFutureInterest, setChargeFutureInterest] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [detailPayment, setDetailPayment] = useState<PaymentWithUsers | null>(null)
  // Si no es null, el diálogo de pago edita ese pago en vez de registrar uno nuevo.
  const [editingPayment, setEditingPayment] = useState<PaymentWithUsers | null>(null)

  const [lateFeeEnabled, setLateFeeEnabled] = useState(false)
  const [lateFeeInstallmentId, setLateFeeInstallmentId] = useState("")
  const [lateFeeMode, setLateFeeMode] = useState<"amount" | "percent">("amount")
  const [lateFeeValue, setLateFeeValue] = useState("")

  // Cuotas vencidas a la fecha del pago — no hay todavía un cálculo
  // automático de mora (ver engine/lateFees.ts), así que acá sólo se avisa y
  // se deja cargar un monto a mano si corresponde.
  const overdueInstallments = useMemo(
    () => installments.filter((i) => (i.status === "pending" || i.status === "partial") && i.dueDate < paymentDate),
    [installments, paymentDate],
  )
  const lateFeeInstallment = overdueInstallments.find((i) => i.id === lateFeeInstallmentId) ?? overdueInstallments[0]
  const lateFeeAmountComputed = useMemo(() => {
    if (!lateFeeEnabled || !lateFeeInstallment) return null
    const value = Number(lateFeeValue)
    if (!(value > 0)) return null
    return lateFeeMode === "percent" ? (Number(lateFeeInstallment.totalAmount) * value) / 100 : value
  }, [lateFeeEnabled, lateFeeInstallment, lateFeeMode, lateFeeValue])

  const isForeignPaymentCurrency = paymentCurrencyCode !== operation.currencyCode
  // Vista previa de a cuánto equivale el pago en la moneda de la operación —
  // mismo cálculo que hace registerPayment (ver convertCurrency en format.ts).
  const convertedAmountPreview = useMemo(() => {
    if (!isForeignPaymentCurrency) return null
    const rate = Number(exchangeRate)
    const value = Number(amount)
    if (!(rate > 0) || !(value > 0)) return null
    return convertCurrency(value, rate, paymentCurrencyCode, operation.currencyCode)
  }, [isForeignPaymentCurrency, exchangeRate, amount, paymentCurrencyCode, operation.currencyCode])

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelError, setCancelError] = useState<string | null>(null)

  const hasPayments = payments.length > 0

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [reverseTarget, setReverseTarget] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState("")
  const [reverseError, setReverseError] = useState<string | null>(null)

  const [propertyEditOpen, setPropertyEditOpen] = useState(false)
  const [propertyError, setPropertyError] = useState<string | null>(null)
  const [projectsList, setProjectsList] = useState<Project[]>(projects)
  const [hasProperty, setHasProperty] = useState(property != null)
  const [projectId, setProjectId] = useState(property?.projectId ?? "")
  const [projectNameSnapshot, setProjectNameSnapshot] = useState(property?.projectNameSnapshot ?? "")
  const [unitLabel, setUnitLabel] = useState(property?.unitLabel ?? "")
  const [propertyType, setPropertyType] = useState<PropertyType | "">(property?.propertyType ?? "")
  const [areaM2, setAreaM2] = useState(property?.areaM2 ?? "")

  const [replanOpen, setReplanOpen] = useState(false)
  const [replanError, setReplanError] = useState<string | null>(null)
  const [replanEffectiveDate, setReplanEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [replanReason, setReplanReason] = useState<Exclude<PlanVersionReason, "initial">>("prepayment_recalculation")
  const [replanNotes, setReplanNotes] = useState("")
  const [replanStages, setReplanStages] = useState<StageForm[]>([newStage()])

  // Capital que todavía no se amortizó de las cuotas pendientes/parciales del
  // plan vigente — es lo que se replantea en las nuevas etapas (mismo cálculo
  // que hace el server action, para poder mostrar una vista previa acá).
  const remainingPrincipal = useMemo(
    () =>
      installments
        .filter((i) => i.status === "pending" || i.status === "partial")
        .reduce((sum, i) => sum + (Number(i.principalAmount) - Number(i.paidPrincipal)), 0),
    [installments],
  )

  const replanPreview = useMemo(() => {
    if (!(remainingPrincipal > 0) || !replanEffectiveDate) return null
    try {
      const stagesInput = replanStages.map(toStageScheduleInput)
      const { perStage, finalBalance } = generatePlanSchedule(stagesInput, remainingPrincipal, replanEffectiveDate)
      const installmentDrafts = perStage.flatMap((s) => s.installments)
      if (installmentDrafts.length === 0) return null
      const totalToPay = installmentDrafts.reduce((sum, i) => sum + i.totalAmount, 0)
      return { installments: installmentDrafts, totalToPay, finalBalance, emptyStages: findEmptyStages(perStage) }
    } catch {
      return null
    }
  }, [remainingPrincipal, replanEffectiveDate, replanStages])

  function handleCancelOperation(e: React.FormEvent) {
    e.preventDefault()
    setCancelError(null)
    startTransition(async () => {
      try {
        await cancelOperation(operation.id, cancelReason)
        setCancelOpen(false)
        router.refresh()
      } catch (err) {
        setCancelError(err instanceof Error ? err.message : "No se pudo cancelar la operación")
      }
    })
  }

  function handleReversePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!reverseTarget) return
    setReverseError(null)
    startTransition(async () => {
      try {
        await reversePayment({ paymentId: reverseTarget, reason: reverseReason })
        setReverseTarget(null)
        router.refresh()
      } catch (err) {
        setReverseError(err instanceof Error ? err.message : "No se pudo anular el pago")
      }
    })
  }

  function handleDeleteOperation() {
    setDeleteError(null)
    startTransition(async () => {
      try {
        await deleteOperation(operation.id)
        router.push(`/cobranzas/clientes/${client.id}`)
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar la operación")
      }
    })
  }

  function openPropertyEditDialog() {
    setHasProperty(property != null)
    setProjectId(property?.projectId ?? "")
    setProjectNameSnapshot(property?.projectNameSnapshot ?? "")
    setUnitLabel(property?.unitLabel ?? "")
    setPropertyType(property?.propertyType ?? "")
    setAreaM2(property?.areaM2 ?? "")
    setPropertyError(null)
    setPropertyEditOpen(true)
  }

  function handleUpdateProperty(e: React.FormEvent) {
    e.preventDefault()
    setPropertyError(null)
    startTransition(async () => {
      try {
        await updateOperationProperty({
          operationId: operation.id,
          hasProperty,
          projectId: projectId || null,
          projectNameSnapshot,
          unitLabel,
          propertyType: propertyType || null,
          areaM2: areaM2 ? Number(areaM2) : null,
        })
        setPropertyEditOpen(false)
        router.refresh()
      } catch (err) {
        setPropertyError(err instanceof Error ? err.message : "No se pudo actualizar el inmueble")
      }
    })
  }

  function openReplanDialog() {
    setReplanEffectiveDate(new Date().toISOString().slice(0, 10))
    setReplanReason("prepayment_recalculation")
    setReplanNotes("")
    setReplanStages([newStage()])
    setReplanError(null)
    setReplanOpen(true)
  }

  function handleReplan(e: React.FormEvent) {
    e.preventDefault()
    setReplanError(null)
    startTransition(async () => {
      try {
        await replanOperationPlan({
          operationId: operation.id,
          effectiveDate: replanEffectiveDate,
          reason: replanReason,
          notes: replanNotes,
          stages: replanStages.map(toStageScheduleInput),
        })
        setReplanOpen(false)
        router.refresh()
      } catch (err) {
        setReplanError(err instanceof Error ? err.message : "No se pudo replantear el plan")
      }
    })
  }

  function setOrderPosition(position: number, component: PaymentComponent) {
    setOrder((prev) => {
      const next = [...prev]
      const otherIndex = next.indexOf(component)
      const current = next[position]
      next[position] = component
      if (otherIndex !== -1 && otherIndex !== position) next[otherIndex] = current
      return next
    })
  }

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    setReceiptFile(null)
    setReceiptPreview(null)
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("El comprobante tiene que ser una imagen")
      input.value = ""
      return
    }
    setError(null)
    setIsCompressing(true)
    // Se comprime apenas se elige, así se ve el peso final y el submit no espera.
    const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.75, maxBytes: RECEIPT_MAX_BYTES })
    setReceiptFile(compressed)
    setReceiptPreview(URL.createObjectURL(compressed))
    setIsCompressing(false)
  }

  function openEditDialog(p: PaymentWithUsers) {
    openDialog()
    setEditingPayment(p)
    setAmount(p.amount)
    setChargeFutureInterest(p.chargeFutureInterest)
    setPaymentCurrencyCode(p.currencyCode)
    setExchangeRate(p.exchangeRate ?? "")
    setPaymentMethod(p.paymentMethod)
    setPaymentDate(p.paymentDate)
    setReferenceNumber(p.referenceNumber ?? "")
    setBankName(p.bankName ?? "")
    setObservations(p.observations ?? "")
    setOrder(p.applicationOrder ?? DEFAULT_APPLICATION_ORDER)
    setDetailPayment(null)
  }

  function openDialog() {
    setEditingPayment(null)
    setReceiptFile(null)
    setReceiptPreview(null)
    setChargeFutureInterest(false)
    setAmount("")
    setPaymentCurrencyCode(operation.currencyCode)
    setExchangeRate("")
    setPaymentMethod("bank_transfer")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setReferenceNumber("")
    setBankName("")
    setObservations("")
    setOrder(DEFAULT_APPLICATION_ORDER)
    setLateFeeEnabled(false)
    setLateFeeInstallmentId("")
    setLateFeeMode("amount")
    setLateFeeValue("")
    setError(null)
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!receiptFile && !editingPayment?.receiptUrl) {
      setError("Adjuntá la imagen del comprobante de pago")
      return
    }
    const formData = new FormData()
    if (receiptFile) formData.set("receipt", receiptFile)
    startTransition(async () => {
      try {
        const base = {
          amount: Number(amount),
          currencyCode: isForeignPaymentCurrency ? paymentCurrencyCode : undefined,
          exchangeRate: isForeignPaymentCurrency ? Number(exchangeRate) : undefined,
          paymentMethod,
          paymentDate,
          referenceNumber,
          bankName,
          observations,
          applicationOrder: order,
          chargeFutureInterest,
        }
        if (editingPayment) {
          await updatePayment({ ...base, paymentId: editingPayment.id }, formData)
        } else {
          await registerPayment(
            {
              ...base,
              operationId: operation.id,
              lateFeeCharge:
                lateFeeEnabled && lateFeeInstallment && lateFeeAmountComputed != null
                  ? { installmentId: lateFeeInstallment.id, amount: lateFeeAmountComputed }
                  : undefined,
            },
            formData,
          )
        }
        setDialogOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : editingPayment ? "No se pudo editar el pago" : "No se pudo registrar el pago")
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={formatOperationNumber(operation.sequenceNumber)}
        description={
          <>
            Cliente:{" "}
            <Link href={`/cobranzas/clientes/${client.id}`} className="text-primary-dark hover:underline">
              {clientDisplayName(client)}
            </Link>
            {property && ` · ${property.projectNameSnapshot} - ${property.unitLabel}`}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/cobranzas/clientes/${client.id}`}>
              <Button variant="ghost">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
            {operation.status === "active" && (
              <>
                <Button variant="ghost" onClick={openReplanDialog}>
                  <Repeat className="w-4 h-4" />
                  Replantear plan
                </Button>
                <Tooltip content="Cancelar operación">
                  <button
                    type="button"
                    aria-label="Cancelar operación"
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl p-2 text-gray-500 transition-colors duration-150 hover:bg-black/[.04] hover:text-gray-900"
                    onClick={() => {
                      setCancelReason("")
                      setCancelError(null)
                      setCancelOpen(true)
                    }}
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </Tooltip>
                <Button onClick={openDialog}>
                  <DollarSign className="w-4 h-4" />
                  Registrar pago
                </Button>
              </>
            )}
            {!hasPayments && (
              <Tooltip content="Eliminar operación">
                <button
                  type="button"
                  aria-label="Eliminar operación"
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl p-2 text-gray-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  onClick={() => {
                    setDeleteError(null)
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
          </div>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <OperationStatusBadge status={operation.status} />
            <span className="text-sm text-gray-500">{operation.currencyCode}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatTile label="Monto original" value={formatMoney(operation.originalAmount, operation.currencyCode)} />
            <StatTile label="Financiado" value={formatMoney(operation.financedAmount, operation.currencyCode)} />
            <StatTile label="Pagado" value={formatMoney(operation.totalPaid, operation.currencyCode)} />
            <StatTile label="Saldo" value={formatMoney(operation.currentBalance, operation.currencyCode)} />
            <StatTile
              label="Vencido"
              value={formatMoney(operation.overdueAmount, operation.currencyCode)}
              tone={Number(operation.overdueAmount) > 0 ? "warning" : "default"}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-gray-400" />
              Inmueble
            </h3>
            <Button variant="ghost" size="sm" onClick={openPropertyEditDialog}>
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Button>
          </div>
          {property ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Proyecto" value={property.projectNameSnapshot} />
              <StatTile label="Unidad" value={property.unitLabel} />
              <StatTile label="Tipo" value={property.propertyType ? PROPERTY_TYPE_LABEL[property.propertyType] : "—"} />
              <StatTile label="Superficie" value={property.areaM2 ? `${property.areaM2} m²` : "—"} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">Esta operación no tiene ningún inmueble asociado.</p>
          )}
        </Card>

        {stages.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Plan de pagos</h3>
            <div className="space-y-2">
              {stages.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 rounded-lg bg-surface-alt px-3 py-2">
                  <span className="font-medium text-gray-900">Etapa {s.sequenceNumber}</span>
                  <span>{STAGE_TYPE_LABEL[s.stageType]}</span>
                  {s.installmentsCount && <span>{s.installmentsCount} cuotas</span>}
                  {s.interestRate && Number(s.interestRate) > 0 && <span>{(Number(s.interestRate) * 100).toFixed(2)}% ({s.rateType})</span>}
                  {s.gracePeriodMonths > 0 && <span>{s.gracePeriodMonths} meses de gracia</span>}
                  {s.openingBalanceOverride && (
                    <span>capital nuevo: {formatMoney(s.openingBalanceOverride, operation.currencyCode)}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-gray-900">Cuotas</h3>
            {isHistoricalPlan && (
              <p className="text-xs text-gray-500 mt-0.5">
                Este plan ya no está vigente ({activePlanVersion?.status}) — se muestra como historial, no se borró nada.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-alt">
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Vence</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Capital</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Interés</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Mora</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                  {operation.referenceCurrencyCode && (
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
                      Total ({operation.referenceCurrencyCode})
                    </th>
                  )}
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {installments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-surface-alt transition-colors duration-200">
                    <td className="px-3 py-2.5 text-gray-500">{inst.installmentNumber}</td>
                    <td className="px-3 py-2.5 text-gray-700">{inst.dueDate}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 hidden sm:table-cell">{formatMoney(inst.principalAmount, operation.currencyCode)}</td>
                    <td className="px-3 py-2.5 text-right text-gray-600 hidden sm:table-cell">
                      {formatMoney(inst.interestAmount, operation.currencyCode)}
                      {Number(inst.waivedInterest) > 0 && (
                        <span className="block text-[11px] text-amber-700">no cobrado: {formatMoney(inst.waivedInterest, operation.currencyCode)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 hidden md:table-cell">{formatMoney(inst.lateFeeAmount, operation.currencyCode)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-900">{formatMoney(inst.totalAmount, operation.currencyCode)}</td>
                    {operation.referenceCurrencyCode && (
                      <td className="px-3 py-2.5 text-right text-gray-500 hidden md:table-cell">
                        {operation.referenceExchangeRate
                          ? formatMoney(
                              convertCurrency(
                                preciseInstallmentTotal(inst.totalAmount, inst.engineMetadata),
                                Number(operation.referenceExchangeRate),
                                operation.currencyCode,
                                operation.referenceCurrencyCode,
                              ),
                              operation.referenceCurrencyCode,
                            )
                          : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-right text-gray-900">{formatMoney(inst.balanceDue, operation.currencyCode)}</td>
                    <td className="px-3 py-2.5">
                      <InstallmentStatusBadge status={inst.status} dueDate={inst.dueDate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-gray-900">Pagos</h3>
          </div>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm">Todavía no se registraron pagos.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Monto</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Método</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Referencia</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Registrado por</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id} className={p.status === "reversed" ? "opacity-60" : undefined}>
                      <td className="px-3 py-2.5 text-gray-700">{p.paymentDate}</td>
                      <td className={`px-3 py-2.5 text-right font-medium text-gray-900 ${p.status === "reversed" ? "line-through" : ""}`}>
                        {formatMoney(p.amount, p.currencyCode)}
                        {p.currencyCode !== operation.currencyCode && p.convertedAmount && (
                          <span className="block text-xs font-normal text-gray-500">≈ {formatMoney(p.convertedAmount, operation.currencyCode)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{PAYMENT_METHOD_LABEL[p.paymentMethod]}</td>
                      <td className="px-3 py-2.5 text-gray-600 hidden sm:table-cell">{p.referenceNumber ?? "—"}</td>
                      <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell">{p.registeredByName}</td>
                      <td className="px-3 py-2.5">
                        {p.status === "reversed" ? (
                          <Tooltip
                            content={
                              <div className="space-y-0.5">
                                {p.reversedByName && <p>Anulado por {p.reversedByName}</p>}
                                {p.reversalReason && <p className="font-normal text-gray-300">{p.reversalReason}</p>}
                              </div>
                            }
                          >
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-100">
                              Anulado
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Confirmado</span>
                        )}
                        {p.status === "reversed" && p.reversedByName && (
                          <p className="md:hidden mt-0.5 text-[11px] text-gray-400">por {p.reversedByName}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-primary-dark transition-colors duration-150 hover:bg-surface-alt"
                          onClick={() => setDetailPayment(p)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                        {p.status === "confirmed" && (
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setReverseReason("")
                              setReverseError(null)
                              setReverseTarget(p.id)
                            }}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {detailPayment && (
        <PaymentDetailDialog
          key={detailPayment.id}
          payment={detailPayment}
          operationCurrencyCode={operation.currencyCode}
          onClose={() => setDetailPayment(null)}
          onEdit={() => openEditDialog(detailPayment)}
          onReverse={() => {
            setReverseReason("")
            setReverseError(null)
            setReverseTarget(detailPayment.id)
            setDetailPayment(null)
          }}
        />
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingPayment ? "Editar pago" : "Registrar pago"} size="lg">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto">
              <Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Moneda del pago">
              <Select value={paymentCurrencyCode} onChange={(e) => { setPaymentCurrencyCode(e.target.value); setExchangeRate("") }}>
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {isForeignPaymentCurrency && (
            <Card className="p-3 bg-surface-alt/60 space-y-2">
              <Field label={exchangeRateLabel(paymentCurrencyCode, operation.currencyCode)}>
                <Input
                  type="number"
                  step="0.0001"
                  required
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="Ej. 7.97"
                />
              </Field>
              <p className="text-xs text-gray-500">
                La operación está en {operation.currencyCode}. Este pago se registra en {paymentCurrencyCode} y se
                convierte con este tipo de cambio para aplicarse a las cuotas.
                {convertedAmountPreview != null && (
                  <>
                    {" "}
                    Equivale a <strong>{formatMoney(convertedAmountPreview, operation.currencyCode)}</strong>.
                  </>
                )}
              </p>
            </Card>
          )}

          <Field label="Fecha">
            <Input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </Field>

          <label className="flex items-start gap-2 rounded-xl bg-surface-alt/60 p-3 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={chargeFutureInterest}
              onChange={(e) => setChargeFutureInterest(e.target.checked)}
            />
            <span>
              Cobrar interés de cuotas que todavía no vencen
              <span className="block text-xs text-gray-500">
                Desmarcado (por defecto), un pago adelantado solo cubre capital en las cuotas futuras y su interés se
                condona cuando el capital queda saldado. Marcado, se cobra el interés y los cargos completos de cada
                cuota alcanzada, aunque no haya vencido.
              </span>
            </span>
          </label>

          {editingPayment && (
            <p className="rounded-xl bg-surface-alt/60 p-3 text-xs text-gray-600">
              Corregir referencia, banco, observaciones, método o comprobante se guarda directo. Si cambiás monto, fecha,
              moneda u orden de aplicación, el pago original se anula y se registra uno nuevo con los datos corregidos
              (el original queda en el historial).
            </p>
          )}

          {!editingPayment && overdueInstallments.length > 0 && (
            <Card className="p-3 border-amber-200/70 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-700">
                  Esta operación tiene <strong>{overdueInstallments.length}</strong> cuota{overdueInstallments.length === 1 ? "" : "s"} vencida
                  {overdueInstallments.length === 1 ? "" : "s"} a la fecha del pago — la más antigua venció el{" "}
                  {overdueInstallments[0].dueDate} (hace {differenceInCalendarDays(parseISO(paymentDate), parseISO(overdueInstallments[0].dueDate))} días).
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={lateFeeEnabled} onChange={(e) => setLateFeeEnabled(e.target.checked)} />
                Cargar mora por el atraso
              </label>

              {lateFeeEnabled && lateFeeInstallment && (
                <div className="space-y-3 pl-6">
                  <Field label="Cuota a cargar">
                    <Select value={lateFeeInstallment.id} onChange={(e) => setLateFeeInstallmentId(e.target.value)}>
                      {overdueInstallments.map((i) => (
                        <option key={i.id} value={i.id}>
                          Cuota #{i.installmentNumber} — venció {i.dueDate}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tipo">
                      <Select value={lateFeeMode} onChange={(e) => setLateFeeMode(e.target.value as "amount" | "percent")}>
                        <option value="amount">Monto fijo</option>
                        <option value="percent">% de la cuota</option>
                      </Select>
                    </Field>
                    <Field label={lateFeeMode === "percent" ? "Porcentaje" : `Monto (${operation.currencyCode})`}>
                      <Input
                        type="number"
                        step="0.01"
                        value={lateFeeValue}
                        onChange={(e) => setLateFeeValue(e.target.value)}
                        placeholder={lateFeeMode === "percent" ? "Ej. 5" : "Ej. 100"}
                      />
                    </Field>
                  </div>
                  {lateFeeAmountComputed != null && (
                    <p className="text-xs text-gray-500">
                      Se va a cargar <strong>{formatMoney(lateFeeAmountComputed, operation.currencyCode)}</strong> de mora a la cuota #
                      {lateFeeInstallment.installmentNumber} antes de aplicar este pago.
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}

          <Field label="Método de pago">
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="bank_transfer">Transferencia bancaria</option>
              <option value="deposit">Depósito</option>
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="check">Cheque</option>
              <option value="other">Otro</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referencia">
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </Field>
            <Field label="Banco">
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </Field>
          </div>
          <Field label="Comprobante (imagen)">
            <input
              type="file"
              accept="image/*"
              required={!editingPayment?.receiptUrl}
              onChange={handleReceiptChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface-alt file:text-gray-700 file:text-xs"
            />
            {editingPayment?.receiptUrl && !receiptFile && !isCompressing && (
              <p className="mt-1 text-xs text-gray-500">
                Ya tiene un comprobante adjunto. Elegí otra imagen solo si querés reemplazarlo.
              </p>
            )}
            {isCompressing && <p className="mt-1 text-xs text-gray-500">Optimizando imagen...</p>}
            {receiptFile && receiptPreview && !isCompressing && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptPreview} alt="Vista previa del comprobante" className="h-16 w-16 rounded-lg border border-border object-cover" />
                <p className="text-xs text-gray-500">Se subirá optimizada ({Math.max(1, Math.round(receiptFile.size / 1024))} KB).</p>
              </div>
            )}
          </Field>
          <Field label="Observaciones">
            <Textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </Field>

          <Card className="p-4 space-y-3 bg-surface-alt/60">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Orden de aplicación del pago</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Elegí en qué orden se cubre cada componente de las cuotas más antiguas antes de pasar a la siguiente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ComponentExplainer
                label="Mora"
                description="Cargo adicional por pagar la cuota después de su vencimiento."
              />
              <ComponentExplainer
                label="Interés"
                description="El interés pactado que corresponde a esa cuota."
              />
              <ComponentExplainer
                label="Cargos"
                description="Otros conceptos incluidos en la cuota, distintos del interés y el capital."
              />
              <ComponentExplainer
                label="Capital"
                description="Amortización del monto prestado — es lo que reduce la deuda real."
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {order.map((component, position) => (
                <Select key={position} uiSize="sm" value={component} onChange={(e) => setOrderPosition(position, e.target.value as PaymentComponent)}>
                  {(Object.keys(COMPONENT_LABEL) as PaymentComponent[]).map((c) => (
                    <option key={c} value={c}>
                      {position + 1}° {COMPONENT_LABEL[c]}
                    </option>
                  ))}
                </Select>
              ))}
            </div>
          </Card>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending} disabled={isCompressing}>
              {editingPayment ? "Guardar" : "Registrar"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={propertyEditOpen} onClose={() => setPropertyEditOpen(false)} title="Editar inmueble" size="lg">
        <form onSubmit={handleUpdateProperty} className="mx-auto max-w-2xl space-y-4">
          <PropertyFieldsCard
            title="Inmueble asociado"
            hasProperty={hasProperty}
            setHasProperty={setHasProperty}
            projectsList={projectsList}
            setProjectsList={setProjectsList}
            projectId={projectId}
            setProjectId={setProjectId}
            projectNameSnapshot={projectNameSnapshot}
            setProjectNameSnapshot={setProjectNameSnapshot}
            unitLabel={unitLabel}
            setUnitLabel={setUnitLabel}
            propertyType={propertyType}
            setPropertyType={setPropertyType}
            areaM2={areaM2}
            setAreaM2={setAreaM2}
          />
          {propertyError && <p className="text-sm text-red-600">{propertyError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPropertyEditOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar operación">
        <form onSubmit={handleCancelOperation} className="space-y-4">
          <p className="text-sm text-gray-600">
            No se borra nada: la operación y sus cuotas pendientes quedan marcadas como canceladas, pero las cuotas ya
            pagadas y todo el historial de pagos siguen intactos.
          </p>
          <Field label="Motivo de cancelación">
            <Textarea
              rows={3}
              autoFocus
              required
              placeholder="Explicá por qué se cancela la operación..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </Field>
          {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setCancelOpen(false)} disabled={isPending}>
              Volver
            </Button>
            <Button type="submit" variant="danger" isLoading={isPending} disabled={!cancelReason.trim()}>
              Cancelar operación
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={reverseTarget != null} onClose={() => setReverseTarget(null)} title="Anular pago">
        <form onSubmit={handleReversePayment} className="space-y-4">
          <p className="text-sm text-gray-600">
            No se borra nada: el pago queda marcado como anulado y lo que había cubierto en las cuotas se revierte,
            dejando el saldo de la operación como si nunca se hubiera aplicado. Usalo para corregir un monto mal
            cargado u otro error de carga.
          </p>
          <Field label="Motivo de la anulación">
            <Textarea
              rows={3}
              autoFocus
              required
              placeholder="Ej. se cargó un monto incorrecto..."
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </Field>
          {reverseError && <p className="text-sm text-red-600">{reverseError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setReverseTarget(null)} disabled={isPending}>
              Volver
            </Button>
            <Button type="submit" variant="danger" isLoading={isPending} disabled={!reverseReason.trim()}>
              Anular pago
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar operación">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Esta operación todavía no tiene pagos registrados, así que se puede eliminar por completo — a diferencia de
            cancelar, esto sí borra la operación y su plan de pagos. No se puede deshacer.
          </p>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Volver
            </Button>
            <Button type="button" variant="danger" isLoading={isPending} onClick={handleDeleteOperation}>
              Eliminar operación
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={replanOpen} onClose={() => setReplanOpen(false)} title="Replantear plan de pagos">
        <form onSubmit={handleReplan} className="space-y-4">
          <p className="text-sm text-gray-600">
            Cierra el plan vigente y arma uno nuevo sobre el capital que todavía queda pendiente — por ejemplo, después
            de un pago adelantado. Si el cliente todavía no hizo ese pago, registralo primero con &quot;Registrar
            pago&quot; y después volvé acá.
          </p>
          <Card className="p-3 bg-surface-alt">
            <p className="text-sm text-gray-700">
              Capital pendiente a replantear: <strong>{formatMoney(remainingPrincipal, operation.currencyCode)}</strong>
            </p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha efectiva del nuevo plan">
              <Input type="date" required value={replanEffectiveDate} onChange={(e) => setReplanEffectiveDate(e.target.value)} />
            </Field>
            <Field label="Motivo">
              <Select value={replanReason} onChange={(e) => setReplanReason(e.target.value as Exclude<PlanVersionReason, "initial">)}>
                {(Object.keys(REPLAN_REASON_LABEL) as Exclude<PlanVersionReason, "initial">[]).map((r) => (
                  <option key={r} value={r}>
                    {REPLAN_REASON_LABEL[r]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notas">
            <Textarea rows={2} value={replanNotes} onChange={(e) => setReplanNotes(e.target.value)} placeholder="Ej. acuerdo verbal con el cliente, referencia del pago adelantado..." />
          </Field>

          <StageBuilderCard stages={replanStages} onChange={setReplanStages} />

          {replanPreview && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Vista previa del nuevo cronograma</h3>
              <p className="text-sm text-gray-600">
                {replanPreview.installments.length} cuotas nuevas por un total de{" "}
                {formatMoney(replanPreview.totalToPay, operation.currencyCode)}.
              </p>
              {replanPreview.finalBalance !== 0 && (
                <p className="text-sm text-amber-700 mt-1">
                  Atención: el plan no llega a saldo cero (queda {formatMoney(replanPreview.finalBalance, operation.currencyCode)} pendiente).
                </p>
              )}
              {replanPreview.emptyStages.length > 0 && (
                <p className="text-sm text-amber-700 mt-1">
                  Atención:{" "}
                  {replanPreview.emptyStages.length === 1
                    ? `la etapa ${replanPreview.emptyStages[0]} no generó`
                    : `las etapas ${replanPreview.emptyStages.join(", ")} no generaron`}{" "}
                  ninguna cuota — probablemente porque no le{replanPreview.emptyStages.length === 1 ? "" : "s"} llegó saldo pendiente (la etapa anterior
                  ya amortizó todo el capital). Si necesitás que esta etapa reciba capital, la anterior necesita gracia total en vez de cuotas fijas
                  normales, o completá &quot;Capital nuevo para esta etapa&quot; acá.
                </p>
              )}
            </Card>
          )}

          {replanError && <p className="text-sm text-red-600">{replanError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setReplanOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending} disabled={!replanPreview}>
              Guardar nuevo plan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function ComponentExplainer({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2 border border-border">
      <p className="text-xs font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
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
