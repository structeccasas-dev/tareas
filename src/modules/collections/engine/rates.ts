import type { Periodicity, RateType } from "@/types/collections"
import { PERIOD_DAYS } from "./dateMath"

// Normaliza cualquier combinación (interestRate, rateType) a una tasa
// efectiva anual, y de ahí deriva la tasa por período según la duración real
// del período (en días). Este único camino de conversión es lo que permite
// soportar cualquier periodicidad sin un caso especial por combinación.
export function toEffectiveAnnualRate(rate: number | null, rateType: RateType): number {
  if (!rate || rateType === "none") return 0
  if (rateType === "effective_annual") return rate
  if (rateType === "nominal_annual") return Math.pow(1 + rate / 12, 12) - 1
  // 'monthly': `rate` es una tasa mensual.
  return Math.pow(1 + rate, 12) - 1
}

export function toPeriodRate(rate: number | null, rateType: RateType, periodicity: Periodicity): number {
  const effectiveAnnual = toEffectiveAnnualRate(rate, rateType)
  if (effectiveAnnual === 0) return 0
  const periodDays = PERIOD_DAYS[periodicity]
  return Math.pow(1 + effectiveAnnual, periodDays / 365) - 1
}
