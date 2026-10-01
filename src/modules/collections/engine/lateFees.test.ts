import { test } from "node:test"
import assert from "node:assert/strict"
import { calculateLateFee, isOverdue } from "./lateFees"

// Caso 8 del diseño: cuota vencida el 10/09, hoy 17/09.
test("isOverdue detecta una cuota vencida más allá de los días de gracia", () => {
  assert.equal(isOverdue("2026-09-10", "2026-09-17", 0, true), true)
  assert.equal(isOverdue("2026-09-10", "2026-09-17", 10, true), false)
  assert.equal(isOverdue("2026-09-10", "2026-09-17", 0, false), false)
})

test("calculateLateFee con porcentaje de la cuota", () => {
  const fee = calculateLateFee({
    installmentTotalAmount: 1500,
    installmentBalanceDue: 1500,
    dueDate: "2026-09-10",
    asOfDate: "2026-09-17",
    graceDays: 0,
    calculationMethod: "percentage_of_installment",
    rateValue: 0.05,
  })
  assert.equal(fee, 75)
})

test("calculateLateFee con tasa diaria sobre saldo vencido, respetando el tope", () => {
  const fee = calculateLateFee({
    installmentTotalAmount: 1000,
    installmentBalanceDue: 1000,
    dueDate: "2026-09-01",
    asOfDate: "2026-09-30",
    graceDays: 0,
    calculationMethod: "daily_rate_on_overdue_installment",
    rateValue: 0.001,
    maxCapAmount: 20,
  })
  // 29 días * 0.001 * 1000 = 29, pero el tope lo baja a 20.
  assert.equal(fee, 20)
})

test("calculateLateFee no cobra nada dentro del período de gracia", () => {
  const fee = calculateLateFee({
    installmentTotalAmount: 1000,
    installmentBalanceDue: 1000,
    dueDate: "2026-09-10",
    asOfDate: "2026-09-15",
    graceDays: 10,
    calculationMethod: "fixed_amount",
    rateValue: 50,
  })
  assert.equal(fee, 0)
})
