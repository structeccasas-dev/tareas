import { test } from "node:test"
import assert from "node:assert/strict"
import { calculateSettlementQuote, type SettlementInstallmentInput } from "./settlement"

function installment(overrides: Partial<SettlementInstallmentInput>): SettlementInstallmentInput {
  return {
    dueDate: "2026-10-01",
    status: "pending",
    principalAmount: 1000,
    interestAmount: 100,
    otherChargesAmount: 0,
    lateFeeAmount: 0,
    paidPrincipal: 0,
    paidInterest: 0,
    paidOther: 0,
    paidLateFee: 0,
    ...overrides,
  }
}

// Caso 10 del diseño: cancelación anticipada.
test("una cuota futura sólo aporta capital, no su interés no devengado", () => {
  const quote = calculateSettlementQuote([installment({ dueDate: "2027-01-01" })], "2026-09-17")
  assert.equal(quote.principal, 1000)
  assert.equal(quote.interest, 0)
  assert.equal(quote.total, 1000)
})

test("una cuota ya vencida aporta capital + interés + mora completos", () => {
  const quote = calculateSettlementQuote(
    [installment({ dueDate: "2026-09-01", lateFeeAmount: 20 })],
    "2026-09-17",
  )
  assert.equal(quote.principal, 1000)
  assert.equal(quote.interest, 100)
  assert.equal(quote.lateFee, 20)
  assert.equal(quote.total, 1120)
})

test("cuotas pagadas o canceladas no suman a la liquidación", () => {
  const quote = calculateSettlementQuote(
    [installment({ dueDate: "2026-01-01", status: "paid" }), installment({ dueDate: "2026-02-01", status: "cancelled" })],
    "2026-09-17",
  )
  assert.equal(quote.total, 0)
})

test("un descuento manual se resta del total sin bajar de cero", () => {
  const quote = calculateSettlementQuote([installment({ dueDate: "2026-09-01" })], "2026-09-17", 5000)
  assert.equal(quote.total, 0)
})
