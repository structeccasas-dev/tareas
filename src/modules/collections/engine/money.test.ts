import { test } from "node:test"
import assert from "node:assert/strict"
import { distributeEvenly, roundCents } from "./money"

test("roundCents redondea a centavos", () => {
  assert.equal(roundCents(1.005), 1.01)
  assert.equal(roundCents(2.5000001), 2.5)
})

test("distributeEvenly reparte 60000 en 24 partes sin perder centavos", () => {
  const parts = distributeEvenly(60000, 24)
  assert.equal(parts.length, 24)
  const sum = parts.reduce((a, b) => a + b, 0)
  assert.equal(roundCents(sum), 60000)
  // 60000 / 24 = 2500 exacto, todas las partes iguales
  assert.ok(parts.every((p) => p === 2500))
})

test("distributeEvenly no pierde el residuo cuando no divide exacto", () => {
  const parts = distributeEvenly(100, 3)
  assert.equal(parts.length, 3)
  const sum = parts.reduce((a, b) => a + b, 0)
  assert.equal(roundCents(sum), 100)
})
