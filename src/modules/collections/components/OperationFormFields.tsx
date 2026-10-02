"use client"

import { useMemo, useState, useTransition } from "react"
import { ChevronDown } from "lucide-react"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Textarea } from "@/components/Textarea"
import { createOperation } from "@/modules/collections/actions/collectionsActions"
import { findEmptyStages, generatePlanSchedule } from "@/modules/collections/engine/schedule"
import { convertCurrency, exchangeRateLabel, formatMoney, preciseInstallmentTotal } from "@/modules/collections/format"
import { StageBuilderCard, newStage, toStageScheduleInput, type StageForm } from "@/modules/collections/components/StageBuilder"
import { PropertyFieldsCard } from "@/modules/collections/components/PropertyFieldsCard"
import { readAndConsumePendingQuote } from "@/modules/collections/components/pendingQuote"
import type { Currency, Project, PropertyType } from "@/types/collections"

interface OperationFormFieldsProps {
  clientId: string
  currencies: Currency[]
  projects: Project[]
  onCreated: (id: string) => void
}

// Cuerpo del formulario de "nueva operación" (inmueble, montos, etapas y
// vista previa del cronograma), sin la cáscara de página — así lo puede
// envolver tanto la página dedicada (CreateOperationForm) como un diálogo
// (CreateOperationDialog) que ya tiene su propio título/cierre.
export function OperationFormFields({ clientId, currencies, projects, onCreated }: OperationFormFieldsProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [hasProperty, setHasProperty] = useState(true)
  const [projectsList, setProjectsList] = useState<Project[]>(projects)
  const [projectId, setProjectId] = useState("")
  const [projectNameSnapshot, setProjectNameSnapshot] = useState("")
  const [unitLabel, setUnitLabel] = useState("")
  const [propertyType, setPropertyType] = useState<PropertyType | "">("")
  const [areaM2, setAreaM2] = useState("")

  // Si venimos del cotizador con un escenario armado, lo tomamos una sola vez
  // como valores iniciales del formulario (ver pendingQuote.ts).
  const [pendingQuote] = useState(readAndConsumePendingQuote)

  const [currencyCode, setCurrencyCode] = useState(pendingQuote?.currencyCode ?? currencies[0]?.code ?? "USD")
  const [referenceCurrencyCode, setReferenceCurrencyCode] = useState(pendingQuote?.referenceCurrencyCode ?? "")
  const [referenceExchangeRate, setReferenceExchangeRate] = useState(pendingQuote?.referenceExchangeRate ?? "")
  const [originalAmount, setOriginalAmount] = useState(pendingQuote?.originalAmount ?? "")
  const [downPaymentAmount, setDownPaymentAmount] = useState(pendingQuote?.downPaymentAmount ?? "0")
  const [downPaymentCurrencyCode, setDownPaymentCurrencyCode] = useState(pendingQuote?.currencyCode ?? currencies[0]?.code ?? "USD")
  const [downPaymentExchangeRate, setDownPaymentExchangeRate] = useState("")
  const [startDate, setStartDate] = useState(pendingQuote?.startDate ?? (() => new Date().toISOString().slice(0, 10)))
  const [notes, setNotes] = useState(pendingQuote?.notes ?? "")
  const [stages, setStages] = useState<StageForm[]>(pendingQuote?.stages ?? [newStage()])

  const isForeignDownPaymentCurrency = downPaymentCurrencyCode !== currencyCode
  // El anticipo puede haberse cobrado en una moneda distinta a la de la
  // operación (ej. préstamo en BS, anticipo en efectivo en USD) — se
  // convierte a la moneda de la operación antes de restarlo del monto
  // original, igual que hace registerPayment con los pagos.
  const downPaymentAmountInOperationCurrency = useMemo(() => {
    const value = Number(downPaymentAmount || "0")
    if (!isForeignDownPaymentCurrency) return value
    const rate = Number(downPaymentExchangeRate)
    if (!(rate > 0)) return null
    return convertCurrency(value, rate, downPaymentCurrencyCode, currencyCode)
  }, [downPaymentAmount, isForeignDownPaymentCurrency, downPaymentExchangeRate, downPaymentCurrencyCode, currencyCode])

  // Mismo cálculo y misma forma que el cotizador (QuoteSimulator) — ambos
  // arman un plan a partir de las mismas etapas, así que la vista previa acá
  // muestra el mismo cronograma detallado en vez de sólo un resumen.
  const schedule = useMemo(() => {
    try {
      if (downPaymentAmountInOperationCurrency == null) return null
      const financed = Number(originalAmount || "0") - downPaymentAmountInOperationCurrency
      if (!(financed > 0) || !startDate) return null

      const stagesInput = stages.map(toStageScheduleInput)

      const { perStage, finalBalance } = generatePlanSchedule(stagesInput, financed, startDate)
      const installments = perStage.flatMap((s) => s.installments)
      if (installments.length === 0) return null

      const totalToPay = installments.reduce((sum, i) => sum + i.totalAmount, 0)
      // Suma real de capital involucrado: el de la etapa 1 más cualquier
      // capital nuevo declarado en etapas siguientes (openingBalanceOverride) —
      // no es simplemente `financed` cuando hay tramos de capital independientes.
      const totalPrincipal = financed + stages.slice(1).reduce((sum, s) => sum + (s.openingBalanceOverride ? Number(s.openingBalanceOverride) : 0), 0)
      return { financed, totalPrincipal, totalToPay, installments, finalBalance, emptyStages: findEmptyStages(perStage) }
    } catch {
      return null
    }
  }, [originalAmount, downPaymentAmountInOperationCurrency, startDate, stages])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (downPaymentAmountInOperationCurrency == null) {
      setError("Necesitás cargar el tipo de cambio del anticipo")
      return
    }

    startTransition(async () => {
      try {
        const created = await createOperation({
          clientId,
          propertyId: null,
          newProperty: hasProperty
            ? {
                origin: "catalog",
                projectId: projectId || null,
                projectNameSnapshot,
                unitLabel,
                propertyType: propertyType || null,
                areaM2: areaM2 ? Number(areaM2) : null,
              }
            : null,
          currencyCode,
          referenceCurrencyCode: referenceCurrencyCode || null,
          referenceExchangeRate: referenceExchangeRate ? Number(referenceExchangeRate) : null,
          originalAmount: Number(originalAmount),
          downPaymentAmount: downPaymentAmountInOperationCurrency,
          startDate,
          notes,
          stages: stages.map(toStageScheduleInput),
        })
        onCreated(created.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear la operación")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PropertyFieldsCard
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

      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Montos</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Moneda">
            <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha de inicio">
            <Input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto original">
            <Input type="number" step="0.01" required value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
          </Field>
          <Field label="Anticipo / cuota inicial">
            <div className="flex gap-2">
              <Input type="number" step="0.01" value={downPaymentAmount} onChange={(e) => setDownPaymentAmount(e.target.value)} className="flex-1" />
              <div className="w-24 flex-shrink-0">
                <Select uiSize="sm" value={downPaymentCurrencyCode} onChange={(e) => setDownPaymentCurrencyCode(e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </Field>
        </div>

        {isForeignDownPaymentCurrency && (
          <Card className="p-3 bg-surface-alt/60 space-y-1.5">
            <Field label={exchangeRateLabel(downPaymentCurrencyCode, currencyCode)}>
              <Input
                type="number"
                step="0.0001"
                required
                value={downPaymentExchangeRate}
                onChange={(e) => setDownPaymentExchangeRate(e.target.value)}
                placeholder="Ej. 6.96"
              />
            </Field>
            <p className="text-xs text-gray-500">
              El anticipo se cobró en {downPaymentCurrencyCode} y la operación es en {currencyCode} — se convierte con
              este tipo de cambio antes de restarlo del monto original.
              {downPaymentAmountInOperationCurrency != null && (
                <>
                  {" "}
                  Equivale a <strong>{formatMoney(downPaymentAmountInOperationCurrency, currencyCode)}</strong>.
                </>
              )}
            </p>
          </Card>
        )}

        {schedule && (
          <button
            type="button"
            onClick={() => document.getElementById("schedule-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="w-full flex items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm text-primary-dark hover:bg-primary/10 transition-colors duration-150"
          >
            <span className="text-left">
              Se generaron <strong>{schedule.installments.length}</strong> cuotas por un total de{" "}
              <strong>{formatMoney(schedule.totalToPay, currencyCode)}</strong>
            </span>
            <span className="flex items-center gap-1 font-medium shrink-0">
              Ver cronograma
              <ChevronDown className="w-4 h-4" />
            </span>
          </button>
        )}

        <Field label="Notas">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
          <Field label="Moneda de referencia para mostrar (opcional)">
            <Select value={referenceCurrencyCode} onChange={(e) => setReferenceCurrencyCode(e.target.value)}>
              <option value="">— Sin moneda de referencia —</option>
              {currencies
                .filter((c) => c.code !== currencyCode)
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          {referenceCurrencyCode && (
            <Field label={exchangeRateLabel(currencyCode, referenceCurrencyCode)}>
              <Input
                type="number"
                step="0.0001"
                required
                value={referenceExchangeRate}
                onChange={(e) => setReferenceExchangeRate(e.target.value)}
                placeholder="Ej. 6.96"
              />
            </Field>
          )}
        </div>
        {referenceCurrencyCode && (
          <p className="text-xs text-gray-500">
            Es sólo para mostrar en el cronograma cuánto equivale cada cuota en {referenceCurrencyCode} a este tipo de
            cambio fijo — no cambia la moneda de la operación ni cómo se registran los pagos reales.
          </p>
        )}
      </Card>

      <StageBuilderCard stages={stages} onChange={setStages} />

      {schedule && (
        <Card id="schedule-preview" className="p-4 space-y-3 scroll-mt-20">
          <h3 className="text-sm font-semibold text-gray-900">Cronograma de la operación</h3>
          <p className="text-sm text-gray-600">
            Se generarían <strong>{schedule.installments.length}</strong> cuotas por un total de{" "}
            <strong>{formatMoney(schedule.totalToPay, currencyCode)}</strong> sobre un capital total de{" "}
            {formatMoney(schedule.totalPrincipal, currencyCode)}
            {schedule.totalPrincipal !== schedule.financed && ` (${formatMoney(schedule.financed, currencyCode)} en la etapa 1 + capital nuevo en etapas siguientes)`}.
            {schedule.finalBalance !== 0 && (
              <span className="text-amber-700"> Atención: no llega a saldo cero (queda {formatMoney(schedule.finalBalance, currencyCode)}).</span>
            )}
          </p>
          {schedule.emptyStages.length > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Atención: {schedule.emptyStages.length === 1 ? `la etapa ${schedule.emptyStages[0]} no generó` : `las etapas ${schedule.emptyStages.join(", ")} no generaron`}{" "}
              ninguna cuota — probablemente porque no le{schedule.emptyStages.length === 1 ? "" : "s"} llegó saldo pendiente (la etapa anterior ya amortizó
              todo el capital). Si necesitás que esta etapa reciba capital, la anterior necesita gracia total en vez de cuotas fijas normales, o completá
              &quot;Capital nuevo para esta etapa&quot; acá.
            </p>
          )}
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg border border-border">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left">N°</th>
                  <th className="px-2 py-1.5 text-left">Fecha</th>
                  <th className="px-2 py-1.5 text-right">Saldo inicial</th>
                  <th className="px-2 py-1.5 text-right">Capital</th>
                  <th className="px-2 py-1.5 text-right">Interés</th>
                  <th className="px-2 py-1.5 text-right">Total</th>
                  {referenceCurrencyCode && referenceExchangeRate && <th className="px-2 py-1.5 text-right">Total ({referenceCurrencyCode})</th>}
                  <th className="px-2 py-1.5 text-right">Saldo final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schedule.installments.map((inst, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-2 py-1">{idx + 1}</td>
                    <td className="px-2 py-1">{inst.dueDate}</td>
                    <td className="px-2 py-1 text-right">{formatMoney(inst.openingBalance, currencyCode)}</td>
                    <td className="px-2 py-1 text-right">{formatMoney(inst.principalAmount, currencyCode)}</td>
                    <td className="px-2 py-1 text-right">{formatMoney(inst.interestAmount, currencyCode)}</td>
                    <td className="px-2 py-1 text-right font-medium">{formatMoney(inst.totalAmount, currencyCode)}</td>
                    {referenceCurrencyCode && referenceExchangeRate && (
                      <td className="px-2 py-1 text-right">
                        {formatMoney(
                          convertCurrency(preciseInstallmentTotal(inst.totalAmount, inst.engineMetadata), Number(referenceExchangeRate), currencyCode, referenceCurrencyCode),
                          referenceCurrencyCode,
                        )}
                      </td>
                    )}
                    <td className="px-2 py-1 text-right">{formatMoney(inst.closingBalance, currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isPending}>
          Crear operación
        </Button>
      </div>
    </form>
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
