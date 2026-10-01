"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Save, Trash2, ArrowRight } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { findEmptyStages, generatePlanSchedule } from "@/modules/collections/engine/schedule"
import { formatMoney, clientDisplayName, preciseInstallmentTotal } from "@/modules/collections/format"
import { StageBuilderCard, newStage, toStageScheduleInput, type StageForm } from "@/modules/collections/components/StageBuilder"
import { PENDING_QUOTE_STORAGE_KEY, type PendingQuote } from "@/modules/collections/components/pendingQuote"
import type { Client, Currency } from "@/types/collections"

const SCENARIOS_STORAGE_KEY = "cob_quote_scenarios"

// crypto.randomUUID sólo existe en "contextos seguros" (HTTPS o localhost) —
// si se accede por IP o un proxy sin TLS, no está definido y rompe el botón
// de guardar. Acá sólo hace falta unicidad local (id de un escenario en
// localStorage), no aleatoriedad criptográfica, así que hay fallback.
function generateScenarioId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

interface SavedScenario {
  id: string
  name: string
  savedAt: string
  prospectName: string
  clientId: string
  currencyCode: string
  referenceCurrencyCode: string
  referenceExchangeRate: string
  originalAmount: string
  downPaymentAmount: string
  startDate: string
  notes: string
  stages: StageForm[]
}

function readSavedScenarios(): SavedScenario[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(SCENARIOS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface QuoteSimulatorProps {
  currencies: Currency[]
  clients: Client[]
}

export function QuoteSimulator({ currencies, clients }: QuoteSimulatorProps) {
  const router = useRouter()

  const [prospectName, setProspectName] = useState("")
  const [clientId, setClientId] = useState("")
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? "USD")
  const [referenceCurrencyCode, setReferenceCurrencyCode] = useState("")
  const [referenceExchangeRate, setReferenceExchangeRate] = useState("")
  const [originalAmount, setOriginalAmount] = useState("")
  const [downPaymentAmount, setDownPaymentAmount] = useState("0")
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState("")
  const [stages, setStages] = useState<StageForm[]>([newStage()])

  const [scenarioName, setScenarioName] = useState("")
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(readSavedScenarios)

  const schedule = useMemo(() => {
    try {
      const financed = Number(originalAmount || "0") - Number(downPaymentAmount || "0")
      if (!(financed > 0) || !startDate) return null

      const stagesInput = stages.map(toStageScheduleInput)
      const { perStage, finalBalance } = generatePlanSchedule(stagesInput, financed, startDate)
      const installments = perStage.flatMap((s) => s.installments)
      if (installments.length === 0) return null

      const totalToPay = installments.reduce((sum, i) => sum + i.totalAmount, 0)
      const totalPrincipal = financed + stages.slice(1).reduce((sum, s) => sum + (s.openingBalanceOverride ? Number(s.openingBalanceOverride) : 0), 0)

      return { financed, totalPrincipal, totalToPay, installments, finalBalance, emptyStages: findEmptyStages(perStage) }
    } catch {
      return null
    }
  }, [originalAmount, downPaymentAmount, startDate, stages])

  function buildScenarioPayload(): Omit<SavedScenario, "id" | "savedAt" | "name"> {
    return {
      prospectName,
      clientId,
      currencyCode,
      referenceCurrencyCode,
      referenceExchangeRate,
      originalAmount,
      downPaymentAmount,
      startDate,
      notes,
      stages,
    }
  }

  function saveScenario() {
    const name = scenarioName.trim()
    if (!name) return
    const next: SavedScenario[] = [
      { id: generateScenarioId(), name, savedAt: new Date().toISOString(), ...buildScenarioPayload() },
      ...savedScenarios,
    ].slice(0, 20)
    setSavedScenarios(next)
    window.localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(next))
    setScenarioName("")
  }

  function loadScenario(scenario: SavedScenario) {
    setProspectName(scenario.prospectName)
    setClientId(scenario.clientId)
    setCurrencyCode(scenario.currencyCode)
    setReferenceCurrencyCode(scenario.referenceCurrencyCode)
    setReferenceExchangeRate(scenario.referenceExchangeRate)
    setOriginalAmount(scenario.originalAmount)
    setDownPaymentAmount(scenario.downPaymentAmount)
    setStartDate(scenario.startDate)
    setNotes(scenario.notes)
    setStages(scenario.stages)
  }

  function removeScenario(id: string) {
    const next = savedScenarios.filter((s) => s.id !== id)
    setSavedScenarios(next)
    window.localStorage.setItem(SCENARIOS_STORAGE_KEY, JSON.stringify(next))
  }

  function convertToOperation() {
    if (!clientId) return
    const payload: PendingQuote = {
      currencyCode,
      referenceCurrencyCode,
      referenceExchangeRate,
      originalAmount,
      downPaymentAmount,
      startDate,
      notes,
      stages,
    }
    window.localStorage.setItem(PENDING_QUOTE_STORAGE_KEY, JSON.stringify(payload))
    router.push(`/cobranzas/clientes/${clientId}/operaciones/nueva`)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Cotizador de financiamiento"
        description="Simulá un escenario de financiamiento antes de crear la operación real. No se guarda nada en la base de datos hasta que la conviertas en una operación."
      />

      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        {savedScenarios.length > 0 && (
          <Card className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Escenarios guardados</h3>
            <div className="divide-y divide-border">
              {savedScenarios.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {s.prospectName || "Sin nombre de prospecto"} · guardado {new Date(s.savedAt).toLocaleDateString("es-BO")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => loadScenario(s)}>
                      Cargar
                    </Button>
                    <button type="button" onClick={() => removeScenario(s.id)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Cliente / prospecto</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre del prospecto">
              <Input value={prospectName} onChange={(e) => setProspectName(e.target.value)} placeholder="Para identificar el escenario, no requiere estar registrado" />
            </Field>
            <Field label="Cliente ya registrado (opcional)">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Ninguno todavía —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientDisplayName(c)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            Sólo se puede convertir el escenario en una operación real si elegís acá un cliente ya registrado — una
            operación siempre pertenece a un cliente del sistema.
          </p>
        </Card>

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
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto original">
              <Input type="number" step="0.01" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} />
            </Field>
            <Field label="Anticipo / cuota inicial">
              <Input type="number" step="0.01" value={downPaymentAmount} onChange={(e) => setDownPaymentAmount(e.target.value)} />
            </Field>
          </div>

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
              <Field label={`Tipo de cambio (1 ${currencyCode} = X ${referenceCurrencyCode})`}>
                <Input type="number" step="0.0001" value={referenceExchangeRate} onChange={(e) => setReferenceExchangeRate(e.target.value)} placeholder="Ej. 6.96" />
              </Field>
            )}
          </div>
        </Card>

        <StageBuilderCard stages={stages} onChange={setStages} />

        {schedule && (
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Cronograma simulado</h3>
            <p className="text-sm text-gray-600">
              {schedule.installments.length} cuotas por un total de {formatMoney(schedule.totalToPay, currencyCode)} sobre un
              capital de {formatMoney(schedule.totalPrincipal, currencyCode)}.
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
                          {formatMoney(preciseInstallmentTotal(inst.totalAmount, inst.engineMetadata) * Number(referenceExchangeRate), referenceCurrencyCode)}
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

        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Nombre para guardar este escenario">
              <Input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Ej. Oferta Torre Norte — 8 años" />
            </Field>
            <Button type="button" variant="secondary" onClick={saveScenario} disabled={!scenarioName.trim()}>
              <Save className="w-4 h-4" />
              Guardar escenario
            </Button>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <Button type="button" onClick={convertToOperation} disabled={!clientId || !schedule}>
              Convertir en operación real
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>
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
