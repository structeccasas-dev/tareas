import { differenceInCalendarDays, parseISO } from "date-fns"
import type { LateFeeCalculationMethod } from "@/types/collections"
import { roundCents } from "./money"

// "Vencida" nunca se guarda como una transición manual de estado: se deriva
// siempre con esta misma función, tanto en listados como en el dashboard,
// para que no haya dos criterios distintos de qué es mora (ver
// docs/cobranzas/DISENO.md, nota en C.8).
export function isOverdue(dueDate: string, asOfDate: string, graceDays: number, hasBalance: boolean): boolean {
  if (!hasBalance) return false
  return differenceInCalendarDays(parseISO(asOfDate), parseISO(dueDate)) > graceDays
}

export interface LateFeeInput {
  // Total de la cuota (capital+interés+cargos, sin mora) — usado por los
  // métodos basados en porcentaje de la cuota.
  installmentTotalAmount: number
  // Saldo pendiente de la cuota (sin mora) — usado por los métodos diarios.
  installmentBalanceDue: number
  // Saldo de capital de toda la operación — sólo lo usa 'daily_rate_on_balance'.
  // Si no se provee, cae a installmentBalanceDue.
  operationBalance?: number
  dueDate: string
  asOfDate: string
  graceDays: number
  calculationMethod: LateFeeCalculationMethod
  rateValue: number
  maxCapAmount?: number | null
  maxCapPercentage?: number | null
}

export function calculateLateFee(input: LateFeeInput): number {
  const daysLate = differenceInCalendarDays(parseISO(input.asOfDate), parseISO(input.dueDate)) - input.graceDays
  if (daysLate <= 0 || input.installmentBalanceDue <= 0) return 0

  let fee: number
  switch (input.calculationMethod) {
    case "fixed_amount":
      fee = input.rateValue
      break
    case "percentage_of_installment":
      fee = input.installmentTotalAmount * input.rateValue
      break
    case "daily_rate_on_balance":
      fee = (input.operationBalance ?? input.installmentBalanceDue) * input.rateValue * daysLate
      break
    case "daily_rate_on_overdue_installment":
      fee = input.installmentBalanceDue * input.rateValue * daysLate
      break
  }

  fee = roundCents(fee)
  if (input.maxCapAmount != null) fee = Math.min(fee, input.maxCapAmount)
  if (input.maxCapPercentage != null) fee = Math.min(fee, roundCents(input.installmentTotalAmount * input.maxCapPercentage))
  return Math.max(0, fee)
}
