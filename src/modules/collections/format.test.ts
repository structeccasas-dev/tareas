import { test } from "node:test"
import assert from "node:assert/strict"
import { preciseInstallmentTotal } from "./format"

// Regresión: convertir a la moneda de referencia (Bs) multiplicando el total
// YA redondeado a centavos en USD por el tipo de cambio no reproduce una
// planilla de referencia calculada con la cuota francesa sin redondeos
// intermedios — la diferencia se nota justo cuando el tipo de cambio es alto
// (ver conversación: USD 835.55 redondeado x 6.96 = Bs 5.815,43, pero la
// planilla de referencia trae Bs 5.815,46 porque partió de la cuota exacta,
// 835.5547..., antes de redondear a centavos).
test("preciseInstallmentTotal usa el total sin redondear cuando el motor lo dejó en engineMetadata", () => {
  const preciseTotal = preciseInstallmentTotal("835.55", { kind: "french", preciseTotalAmount: 835.5547208001727 })
  const bs = Math.round(preciseTotal * 6.96 * 100) / 100
  assert.equal(bs, 5815.46)
})

test("preciseInstallmentTotal cae al total redondeado cuando no hay metadata (cash, monto fijo exacto, etc.)", () => {
  assert.equal(preciseInstallmentTotal("400.00", { kind: "fixed_installment_amount" }), 400)
  assert.equal(preciseInstallmentTotal("400.00", null), 400)
  assert.equal(preciseInstallmentTotal(400, undefined), 400)
})
