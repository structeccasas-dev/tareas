import { test } from "node:test"
import assert from "node:assert/strict"
import { allocatePayment, type AllocationTarget } from "./paymentAllocation"
import { DEFAULT_APPLICATION_ORDER } from "@/types/collections"

function target(overrides: Partial<AllocationTarget>): AllocationTarget {
  return {
    installmentId: "x",
    dueDate: "2026-01-01",
    lateFeeDue: 0,
    interestDue: 0,
    otherDue: 0,
    principalDue: 0,
    ...overrides,
  }
}

// Caso 6 del diseño: pago parcial de una cuota.
test("un pago parcial cubre lo que alcanza, en el orden elegido", () => {
  const { allocations, unallocated } = allocatePayment(
    1000,
    [target({ installmentId: "c1", interestDue: 300, principalDue: 1200 })],
    DEFAULT_APPLICATION_ORDER,
  )
  assert.equal(allocations.length, 1)
  assert.equal(allocations[0].appliedInterest, 300)
  assert.equal(allocations[0].appliedPrincipal, 700)
  assert.equal(unallocated, 0)
})

// Un pago que cubre varias cuotas — necesita una tabla puente (payment_allocations).
test("un pago cubre varias cuotas, empezando por la más antigua", () => {
  const targets: AllocationTarget[] = [
    target({ installmentId: "c2", dueDate: "2026-02-01", principalDue: 1500 }),
    target({ installmentId: "c1", dueDate: "2026-01-01", principalDue: 1500 }),
    target({ installmentId: "c3", dueDate: "2026-03-01", principalDue: 1500 }),
  ]
  const { allocations, unallocated } = allocatePayment(4500, targets, ["principal"])

  assert.equal(allocations.length, 3)
  assert.deepEqual(
    allocations.map((a) => a.installmentId),
    ["c1", "c2", "c3"],
  )
  assert.ok(allocations.every((a) => a.appliedPrincipal === 1500))
  assert.equal(unallocated, 0)
})

test("un pago que excede lo adeudado deja un remanente sin aplicar", () => {
  const { allocations, unallocated } = allocatePayment(1000, [target({ installmentId: "c1", principalDue: 600 })], ["principal"])
  assert.equal(allocations[0].appliedPrincipal, 600)
  assert.equal(unallocated, 400)
})

test("el orden de aplicación lo decide quien llama, no un valor fijo", () => {
  const t = target({ installmentId: "c1", lateFeeDue: 50, interestDue: 100, principalDue: 1000 })
  const { allocations } = allocatePayment(120, [t], ["principal", "interest", "late_fee"])
  // Con este orden, primero se intenta capital: no alcanza para cubrirlo del
  // todo, así que interés y mora quedan en 0.
  assert.equal(allocations[0].appliedPrincipal, 120)
  assert.equal(allocations[0].appliedInterest, 0)
  assert.equal(allocations[0].appliedLateFee, 0)
})
