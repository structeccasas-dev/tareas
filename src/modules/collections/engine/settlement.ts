import type { InstallmentStatus } from "@/types/collections"
import { roundCents } from "./money"

export interface SettlementInstallmentInput {
  dueDate: string
  status: InstallmentStatus
  principalAmount: number
  interestAmount: number
  otherChargesAmount: number
  lateFeeAmount: number
  paidPrincipal: number
  paidInterest: number
  paidOther: number
  paidLateFee: number
}

export interface SettlementQuote {
  principal: number
  interest: number
  charges: number
  lateFee: number
  discount: number
  total: number
}

// ¿Cuánto debe pagar hoy el cliente para cancelar toda la operación? (§22)
// Regla: de las cuotas ya vencidas se cobra todo lo pendiente (incluye
// interés y cargos ya devengados); de las cuotas futuras sólo se cobra el
// capital remanente — el interés/cargos de un período que todavía no
// transcurrió no se le puede cobrar a alguien que cancela anticipadamente.
export function calculateSettlementQuote(
  installments: SettlementInstallmentInput[],
  asOfDate: string,
  discount = 0,
): SettlementQuote {
  let principal = 0
  let interest = 0
  let charges = 0
  let lateFee = 0

  for (const inst of installments) {
    if (inst.status !== "pending" && inst.status !== "partial") continue

    const remainingPrincipal = inst.principalAmount - inst.paidPrincipal
    const remainingLateFee = inst.lateFeeAmount - inst.paidLateFee
    principal += remainingPrincipal
    lateFee += remainingLateFee

    const isDue = inst.dueDate <= asOfDate
    if (isDue) {
      interest += inst.interestAmount - inst.paidInterest
      charges += inst.otherChargesAmount - inst.paidOther
    }
  }

  principal = roundCents(principal)
  interest = roundCents(Math.max(0, interest))
  charges = roundCents(Math.max(0, charges))
  lateFee = roundCents(Math.max(0, lateFee))
  const roundedDiscount = roundCents(discount)

  const total = Math.max(0, roundCents(principal + interest + charges + lateFee - roundedDiscount))

  return { principal, interest, charges, lateFee, discount: roundedDiscount, total }
}
