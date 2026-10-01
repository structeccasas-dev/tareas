import type { PaymentComponent } from "@/types/collections"
import { roundCents } from "./money"

export interface AllocationTarget {
  installmentId: string
  dueDate: string
  lateFeeDue: number
  interestDue: number
  otherDue: number
  principalDue: number
}

export interface AllocationResult {
  installmentId: string
  appliedLateFee: number
  appliedInterest: number
  appliedOther: number
  appliedPrincipal: number
  appliedTotal: number
}

type DueKey = "lateFeeDue" | "interestDue" | "otherDue" | "principalDue"
type AppliedKey = "appliedLateFee" | "appliedInterest" | "appliedOther" | "appliedPrincipal"

const DUE_KEY_BY_COMPONENT: Record<PaymentComponent, DueKey> = {
  late_fee: "lateFeeDue",
  interest: "interestDue",
  other_charges: "otherDue",
  principal: "principalDue",
}

const APPLIED_KEY_BY_COMPONENT: Record<PaymentComponent, AppliedKey> = {
  late_fee: "appliedLateFee",
  interest: "appliedInterest",
  other_charges: "appliedOther",
  principal: "appliedPrincipal",
}

// Distribuye `amount` entre las cuotas objetivo: más antigua primero, y
// dentro de cada cuota en el orden de componentes que haya elegido el
// usuario (§10/§20 del diseño — no hay un orden fijo del sistema). Devuelve
// también lo que no se pudo aplicar (si el pago supera lo adeudado).
export function allocatePayment(
  amount: number,
  targets: AllocationTarget[],
  order: PaymentComponent[],
): { allocations: AllocationResult[]; unallocated: number } {
  let remaining = roundCents(amount)
  const sorted = [...targets].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const allocations: AllocationResult[] = []

  for (const target of sorted) {
    if (remaining <= 0) break

    const result: AllocationResult = {
      installmentId: target.installmentId,
      appliedLateFee: 0,
      appliedInterest: 0,
      appliedOther: 0,
      appliedPrincipal: 0,
      appliedTotal: 0,
    }

    for (const component of order) {
      if (remaining <= 0) break
      const due = target[DUE_KEY_BY_COMPONENT[component]]
      if (due <= 0) continue
      const applied = roundCents(Math.min(due, remaining))
      result[APPLIED_KEY_BY_COMPONENT[component]] = applied
      remaining = roundCents(remaining - applied)
    }

    result.appliedTotal = roundCents(result.appliedLateFee + result.appliedInterest + result.appliedOther + result.appliedPrincipal)
    if (result.appliedTotal > 0) allocations.push(result)
  }

  return { allocations, unallocated: remaining }
}
