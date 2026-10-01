"use client"

import { Plus, Trash2 } from "lucide-react"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import type { StageScheduleInput } from "@/modules/collections/engine/types"
import type { GracePeriodType, Periodicity, RateType, StageType } from "@/types/collections"

// Constructor de etapas del plan de pagos, compartido entre "Nueva operación"
// (CreateOperationForm) y el cotizador/simulador (QuoteSimulator) — ambos
// arman exactamente los mismos parámetros para el motor financiero.

export interface PlannedPaymentRow {
  installmentNumber: string
  amount: string
}

export interface StageForm {
  stageType: StageType
  installmentsCount: string
  periodicity: Periodicity
  interestRatePercent: string
  rateType: RateType
  flatFeePerInstallment: string
  gracePeriodMonths: string
  gracePeriodType: GracePeriodType | ""
  balloonAmount: string
  openingBalanceOverride: string
  // Sólo para stageType='fixed_installment': si se completa, el usuario está
  // pactando un monto fijo por cuota en vez de una cantidad de cuotas — la
  // cantidad sale de dividir el capital entre este monto (ver engine/schedule.ts).
  fixedInstallmentAmount: string
  // Abonos extra planificados por cuota (ver engine/schedule.ts): acortan el
  // plazo en vez de recalcular la cuota pactada.
  plannedAdditionalPayments: PlannedPaymentRow[]
}

export function newStage(): StageForm {
  return {
    stageType: "fixed_installment",
    installmentsCount: "12",
    periodicity: "monthly",
    interestRatePercent: "0",
    rateType: "none",
    flatFeePerInstallment: "0",
    gracePeriodMonths: "0",
    gracePeriodType: "",
    balloonAmount: "",
    openingBalanceOverride: "",
    fixedInstallmentAmount: "",
    plannedAdditionalPayments: [],
  }
}

export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  cash: "Contado",
  fixed_installment: "Cuotas fijas",
  french: "Sistema francés",
  custom: "Personalizada",
}

function plannedPaymentsToRecord(rows: PlannedPaymentRow[]): Record<number, number> | null {
  const entries = rows
    .map((r) => [Number(r.installmentNumber), Number(r.amount)] as const)
    .filter(([n, amount]) => Number.isInteger(n) && n > 0 && amount > 0)
  if (entries.length === 0) return null
  return Object.fromEntries(entries)
}

export function toStageScheduleInput(s: StageForm): StageScheduleInput {
  const fixedInstallmentAmount = s.stageType === "fixed_installment" && s.fixedInstallmentAmount ? Number(s.fixedInstallmentAmount) : null
  return {
    stageType: s.stageType,
    // Con monto fijo pactado, "cantidad de cuotas" pasa a ser un TOPE ("USD
    // 4.000 por mes durante 24 meses"), no algo que el motor derive — si
    // queda vacío, el motor genera las cuotas que hagan falta hasta pagar
    // todo el capital de la etapa (ver engine/schedule.ts).
    installmentsCount: s.stageType === "cash" ? null : Number(s.installmentsCount || "0"),
    periodicity: s.periodicity,
    interestRate: s.interestRatePercent ? Number(s.interestRatePercent) / 100 : null,
    rateType: s.rateType,
    flatFeePerInstallment: Number(s.flatFeePerInstallment || "0"),
    gracePeriodMonths: Number(s.gracePeriodMonths || "0"),
    gracePeriodType: s.gracePeriodType || null,
    balloonAmount: s.balloonAmount ? Number(s.balloonAmount) : null,
    openingBalanceOverride: s.openingBalanceOverride ? Number(s.openingBalanceOverride) : null,
    fixedInstallmentAmount,
    plannedAdditionalPayments: plannedPaymentsToRecord(s.plannedAdditionalPayments),
  }
}

interface StageBuilderCardProps {
  stages: StageForm[]
  onChange: (stages: StageForm[]) => void
}

export function StageBuilderCard({ stages, onChange }: StageBuilderCardProps) {
  function updateStage(index: number, patch: Partial<StageForm>) {
    onChange(stages.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Etapas del plan de pagos</h3>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...stages, newStage()])}>
          <Plus className="w-3.5 h-3.5" />
          Agregar etapa
        </Button>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Cada etapa amortiza el capital que recibe de la anterior. Si agregás una segunda etapa (ej. sistema francés) y
        querés que el capital le llegue completo, la primera etapa necesita gracia total (no cuotas fijas normales,
        que amortizan todo el capital dentro de esa misma etapa) — revisá la vista previa antes de guardar.
      </p>

      {stages.map((stage, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Etapa {i + 1}</span>
            {stages.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(stages.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <Field label="Modalidad">
            <Select value={stage.stageType} onChange={(e) => updateStage(i, { stageType: e.target.value as StageType })}>
              {(["cash", "fixed_installment", "french"] as StageType[]).map((t) => (
                <option key={t} value={t}>
                  {STAGE_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>

          {i > 0 && (
            <Field label="Capital nuevo para esta etapa (opcional)">
              <Input
                type="number"
                step="0.01"
                value={stage.openingBalanceOverride}
                onChange={(e) => updateStage(i, { openingBalanceOverride: e.target.value })}
                placeholder="Dejar vacío para continuar con el saldo de la etapa anterior"
              />
              <p className="text-xs text-gray-500 mt-1">
                Completalo sólo si esta etapa es un desembolso nuevo e independiente (ej. un crédito que arranca
                después de terminar de pagar un anticipo). Si lo dejás vacío, esta etapa amortiza lo que haya
                quedado pendiente de la anterior.
              </p>
            </Field>
          )}

          {stage.stageType !== "cash" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cantidad de cuotas">
                  <Input
                    type="number"
                    min={1}
                    value={stage.installmentsCount}
                    onChange={(e) => updateStage(i, { installmentsCount: e.target.value })}
                  />
                  {stage.stageType === "fixed_installment" && stage.fixedInstallmentAmount && (
                    <p className="text-xs text-gray-500 mt-1">
                      Con monto fijo pactado, esto es un tope: se generan como máximo esta cantidad de cuotas a ese monto
                      — lo que quede de capital pasa a la siguiente etapa. Dejalo vacío para que esta etapa pague todo
                      el capital que reciba, sin tope.
                    </p>
                  )}
                </Field>
                <Field label="Periodicidad">
                  <Select value={stage.periodicity} onChange={(e) => updateStage(i, { periodicity: e.target.value as Periodicity })}>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="annual">Anual</option>
                  </Select>
                </Field>
              </div>

              {stage.stageType === "fixed_installment" && (
                <Field label="Monto fijo por cuota (opcional)">
                  <Input
                    type="number"
                    step="0.01"
                    value={stage.fixedInstallmentAmount}
                    onChange={(e) => updateStage(i, { fixedInstallmentAmount: e.target.value })}
                    placeholder="Ej. 400 — un monto redondo pactado, no derivado del capital"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Para cuando el cliente se compromete a un monto redondo por período (ej. &quot;USD 400 por mes&quot;).
                    Combinalo con &quot;Cantidad de cuotas&quot; para un compromiso a plazo fijo (ej. 24 cuotas de USD
                    4.000, aunque no alcance a pagar todo el capital de esta etapa) — el resto sigue en la etapa
                    siguiente. La última cuota absorbe lo que quede si el capital sí alcanza a cubrirse antes.
                  </p>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tasa de interés (%)">
                  <Input
                    type="number"
                    step="0.01"
                    value={stage.interestRatePercent}
                    onChange={(e) => updateStage(i, { interestRatePercent: e.target.value })}
                  />
                </Field>
                <Field label="Tipo de tasa">
                  <Select value={stage.rateType} onChange={(e) => updateStage(i, { rateType: e.target.value as RateType })}>
                    <option value="none">Sin interés</option>
                    <option value="nominal_annual">Nominal anual</option>
                    <option value="effective_annual">Efectiva anual</option>
                    <option value="monthly">Mensual</option>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cargo administrativo por cuota">
                  <Input
                    type="number"
                    step="0.01"
                    value={stage.flatFeePerInstallment}
                    onChange={(e) => updateStage(i, { flatFeePerInstallment: e.target.value })}
                  />
                </Field>
                {stage.stageType === "french" && (
                  <Field label="Cuota final / balloon (opcional)">
                    <Input type="number" step="0.01" value={stage.balloonAmount} onChange={(e) => updateStage(i, { balloonAmount: e.target.value })} />
                  </Field>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Meses de gracia">
                  <Input
                    type="number"
                    min={0}
                    value={stage.gracePeriodMonths}
                    onChange={(e) => updateStage(i, { gracePeriodMonths: e.target.value })}
                  />
                </Field>
                {Number(stage.gracePeriodMonths || "0") > 0 && (
                  <Field label="Tipo de gracia">
                    <Select
                      value={stage.gracePeriodType}
                      onChange={(e) => updateStage(i, { gracePeriodType: e.target.value as GracePeriodType })}
                    >
                      <option value="">— Elegir —</option>
                      <option value="total">Total (no paga nada)</option>
                      <option value="interest_only">Sólo interés</option>
                    </Select>
                  </Field>
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">Abonos adicionales planificados (opcional)</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      updateStage(i, { plannedAdditionalPayments: [...stage.plannedAdditionalPayments, { installmentNumber: "", amount: "" }] })
                    }
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar abono
                  </Button>
                </div>
                {stage.plannedAdditionalPayments.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Un abono extra en una cuota puntual acorta el plazo — no cambia el monto de la cuota pactada.
                  </p>
                ) : (
                  stage.plannedAdditionalPayments.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder="N° de cuota"
                        className="w-28"
                        value={row.installmentNumber}
                        onChange={(e) =>
                          updateStage(i, {
                            plannedAdditionalPayments: stage.plannedAdditionalPayments.map((r, ri) =>
                              ri === rowIdx ? { ...r, installmentNumber: e.target.value } : r,
                            ),
                          })
                        }
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Monto extra"
                        value={row.amount}
                        onChange={(e) =>
                          updateStage(i, {
                            plannedAdditionalPayments: stage.plannedAdditionalPayments.map((r, ri) =>
                              ri === rowIdx ? { ...r, amount: e.target.value } : r,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateStage(i, { plannedAdditionalPayments: stage.plannedAdditionalPayments.filter((_, ri) => ri !== rowIdx) })
                        }
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      ))}
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
