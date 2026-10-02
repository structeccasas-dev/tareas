import type { GracePeriodType, Periodicity, RateType, StageType } from "@/types/collections"

// Cuota "borrador" que devuelve el motor, antes de persistirse como fila de
// cob_installments (installmentNumber/planVersionId/stageId los agrega quien
// persiste, no el motor).
export interface InstallmentDraft {
  dueDate: string
  openingBalance: number
  principalAmount: number
  interestAmount: number
  otherChargesAmount: number
  totalAmount: number
  closingBalance: number
  engineMetadata?: Record<string, unknown>
}

// Parámetros de una etapa, ya normalizados a `number` (las columnas
// `numeric` de Postgres llegan como string; se convierten antes de entrar acá).
export interface StageScheduleInput {
  stageType: StageType
  installmentsCount: number | null
  periodicity: Periodicity
  interestRate: number | null
  rateType: RateType
  flatFeePerInstallment: number
  gracePeriodMonths: number
  gracePeriodType: GracePeriodType | null
  balloonAmount: number | null
  // Sólo para stageType='fixed_installment': monto fijo total por cuota
  // (capital + interés + cargo) pactado directamente por el usuario, en vez
  // de derivarlo dividiendo el capital entre `installmentsCount`. Cuando se
  // define, `installmentsCount` se ignora: la cantidad de cuotas sale de
  // cuánto capital cubre ese monto fijo cada período. La última cuota
  // absorbe lo que quede (puede ser menor al monto pactado).
  fixedInstallmentAmount?: number | null
  // Si se define, la etapa arranca con este capital en vez de heredar el
  // saldo final de la etapa anterior — permite representar tramos de capital
  // independientes (ver docs/cobranzas/DISENO.md, motor financiero).
  openingBalanceOverride?: number | null
  // Abonos adicionales planificados por número de cuota dentro de la etapa
  // (1-indexado). Se suman al principal de esa cuota, acelerando la
  // amortización; si el saldo llega a 0 antes de agotar `installmentsCount`,
  // las cuotas restantes no se generan (el plazo se acorta). Pensado para el
  // cotizador/simulador — un abono ya ejecutado sobre una operación real se
  // modela con pagos + refinanciamiento (nueva versión de plan), no con esto.
  plannedAdditionalPayments?: Record<number, number> | null
  // Sólo para stageType='custom'.
  config?: { manualInstallments?: Array<{ principal: number; interest?: number; otherCharges?: number }> } | null
}

export interface StageScheduleResult {
  installments: InstallmentDraft[]
  closingBalance: number
  nextStartDate: string
}
