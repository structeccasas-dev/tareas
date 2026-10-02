import { test } from "node:test"
import assert from "node:assert/strict"
import { generatePlanSchedule, generateStageSchedule } from "./schedule"
import { roundCents } from "./money"
import type { StageScheduleInput } from "./types"

function baseStage(overrides: Partial<StageScheduleInput> = {}): StageScheduleInput {
  return {
    stageType: "cash",
    installmentsCount: null,
    periodicity: "monthly",
    interestRate: null,
    rateType: "none",
    flatFeePerInstallment: 0,
    gracePeriodMonths: 0,
    gracePeriodType: null,
    balloonAmount: null,
    ...overrides,
  }
}

// Caso 1 del diseño: contado.
test("cash genera una sola cuota por el total", () => {
  const result = generateStageSchedule(baseStage({ stageType: "cash" }), 100_000, "2026-01-01")
  assert.equal(result.installments.length, 1)
  assert.equal(result.installments[0].totalAmount, 100_000)
  assert.equal(result.closingBalance, 0)
})

// Caso 2 del diseño: 24 cuotas fijas sin interés.
test("fixed_installment sin interés reparte el capital en partes iguales", () => {
  const stage = baseStage({ stageType: "fixed_installment", installmentsCount: 24 })
  const result = generateStageSchedule(stage, 60_000, "2026-01-01")

  assert.equal(result.installments.length, 24)
  assert.equal(result.closingBalance, 0)
  for (const inst of result.installments) {
    assert.equal(inst.interestAmount, 0)
    assert.equal(inst.principalAmount, 2500)
    assert.equal(inst.totalAmount, 2500)
  }
})

test("fixed_installment con interés simple cobra interés independiente del capital", () => {
  const stage = baseStage({
    stageType: "fixed_installment",
    installmentsCount: 12,
    interestRate: 0.12,
    rateType: "nominal_annual",
    flatFeePerInstallment: 5,
  })
  const result = generateStageSchedule(stage, 12_000, "2026-01-01")

  assert.equal(result.installments.length, 12)
  assert.equal(result.closingBalance, 0)
  // Con 0% no habría interés; acá debe haber interés > 0 en cada cuota.
  for (const inst of result.installments) {
    assert.ok(inst.interestAmount > 0)
    assert.equal(inst.otherChargesAmount, 5)
  }
})

// Caso real: el usuario pacta "USD 400 por mes" en vez de una cantidad de
// cuotas — la cantidad de cuotas sale de dividir el capital entre ese monto.
test("fixed_installment con monto fijo pactado reproduce el monto exacto por cuota", () => {
  const stage = baseStage({ stageType: "fixed_installment", fixedInstallmentAmount: 400 })
  const result = generateStageSchedule(stage, 9_600, "2026-10-14")

  assert.equal(result.installments.length, 24)
  assert.equal(result.closingBalance, 0)
  for (const inst of result.installments) {
    assert.equal(inst.interestAmount, 0)
    assert.equal(inst.principalAmount, 400)
    assert.equal(inst.totalAmount, 400)
  }
})

test("fixed_installment con monto fijo que no divide exacto: la última cuota absorbe el resto", () => {
  const stage = baseStage({ stageType: "fixed_installment", fixedInstallmentAmount: 400 })
  const result = generateStageSchedule(stage, 9_500, "2026-01-01")

  assert.equal(result.installments.length, 24)
  assert.equal(result.closingBalance, 0)
  for (const inst of result.installments.slice(0, -1)) {
    assert.equal(inst.totalAmount, 400)
  }
  assert.equal(result.installments.at(-1)!.totalAmount, 300)
})

// Regresión: una operación real (24 cuotas fijas de USD 400 + 96 cuotas al
// 5% nominal anual sistema francés sobre USD 75.600) comparada contra una
// planilla de referencia mostró que, tras 96 cuotas francesas, el saldo
// arrastraba ~58 centavos de más porque el motor redondeaba el saldo a
// centavos en cada período y ese redondeo se acumulaba (ver fix en
// generateFrenchSchedule: el saldo interno ya no se redondea entre cuotas).
// Este test fija los valores exactos de la planilla en los puntos clave.
test("french sobre muchas cuotas no acumula error de redondeo (regresión contra planilla real)", () => {
  const stages: StageScheduleInput[] = [
    baseStage({ stageType: "fixed_installment", installmentsCount: 24, fixedInstallmentAmount: 400 }),
    baseStage({ stageType: "french", installmentsCount: 96, interestRate: 0.05, rateType: "nominal_annual" }),
  ]

  const { perStage } = generatePlanSchedule(stages, 75_600, "2026-10-18")
  const installments = perStage.flatMap((s) => s.installments)

  assert.equal(installments.length, 120)
  assert.equal(installments[24].dueDate, "2028-10-18") // cuota #25, primera del tramo francés
  assert.equal(installments[24].principalAmount, 560.55)
  assert.equal(installments[24].interestAmount, 275)
  assert.equal(installments[24].closingBalance, 65_439.45)
  assert.equal(installments[25].closingBalance, 64_876.55)
  // Cuota #119: sin el fix acumulaba ~58 centavos de saldo de más acá.
  assert.equal(installments[118].openingBalance, 1_660.72)
  assert.equal(installments[118].principalAmount, 828.64)
  assert.equal(installments.at(-1)!.closingBalance, 0)

  // El total en USD ya va a centavos (835.55), pero para convertir a Bs sin
  // arrastrar ese redondeo (ver format.ts `preciseInstallmentTotal`) el
  // motor deja el total sin redondear en engineMetadata: 835.5547... — a
  // 6.96 da exactamente Bs 5.815,46, no los Bs 5.815,43 que da 835.55 x 6.96.
  const metadata = installments[24].engineMetadata as { preciseTotalAmount: number }
  assert.ok(Math.abs(metadata.preciseTotalAmount - 835.5547208) < 1e-6)
})

// Caso real reportado: "24 cuotas fijas de USD 4.000" + "72 cuotas al
// sistema francés con el resto" — `installmentsCount` junto con
// `fixedInstallmentAmount` es un TOPE, no algo que el motor ignore. Si el
// capital de la etapa es mayor a lo que esas 24 cuotas cubren, el resto
// tiene que pasar a la etapa siguiente y calcularse ahí con la fórmula
// francesa real — nunca seguir cobrando USD 4.000 fijos más allá del tope.
test("fixed_installment con monto fijo y cantidad de cuotas tope: lo que sobra pasa a la etapa siguiente en francés", () => {
  const stages: StageScheduleInput[] = [
    baseStage({ stageType: "fixed_installment", installmentsCount: 24, fixedInstallmentAmount: 4000 }),
    baseStage({ stageType: "french", installmentsCount: 72, interestRate: 0.05, rateType: "nominal_annual" }),
  ]

  const { perStage, finalBalance } = generatePlanSchedule(stages, 300_000, "2026-01-01")
  const [stage1, stage2] = perStage

  // Etapa 1: exactamente 24 cuotas de 4.000, tope respetado aunque el
  // capital (300.000) sea mucho mayor a lo que esas cuotas alcanzan a pagar.
  assert.equal(stage1.installments.length, 24)
  for (const inst of stage1.installments) {
    assert.equal(inst.totalAmount, 4000)
    assert.equal(inst.principalAmount, 4000)
  }
  assert.equal(stage1.closingBalance, 300_000 - 24 * 4000)

  // Etapa 2: arranca donde dejó la etapa 1 y se calcula con la fórmula
  // francesa real — la cuota constante NO puede seguir siendo 4.000.
  assert.equal(stage2.installments[0].openingBalance, stage1.closingBalance)
  const frenchPayment = stage2.installments[0].totalAmount
  assert.notEqual(frenchPayment, 4000)
  assert.ok(frenchPayment > 0)
  // Todas rondan la cuota constante pactada — pueden diferir por 1 centavo
  // entre sí (redondeo independiente del corte interés/capital de cada
  // período, normal en cualquier planilla real), y la última además fuerza
  // el saldo final exacto.
  for (const inst of stage2.installments.slice(0, -1)) {
    assert.ok(Math.abs(inst.totalAmount - frenchPayment) <= 0.01)
  }
  assert.equal(finalBalance, 0)
})

test("fixed_installment con monto fijo insuficiente para cubrir interés/cargos falla explícitamente", () => {
  const stage = baseStage({
    stageType: "fixed_installment",
    fixedInstallmentAmount: 10,
    interestRate: 0.5,
    rateType: "nominal_annual",
  })
  assert.throws(() => generateStageSchedule(stage, 100_000, "2026-01-01"))
})

// Sistema francés: la cuota debe amortizar exactamente el saldo a cero.
test("french amortiza el saldo completo a cero", () => {
  const stage = baseStage({
    stageType: "french",
    installmentsCount: 36,
    interestRate: 0.08,
    rateType: "nominal_annual",
  })
  const result = generateStageSchedule(stage, 45_000, "2026-01-01")

  assert.equal(result.installments.length, 36)
  assert.equal(result.closingBalance, 0)

  // La cuota debe ser aproximadamente constante (salvo la última, ajustada).
  const totals = result.installments.slice(0, -1).map((i) => i.totalAmount)
  const first = totals[0]
  for (const t of totals) assert.ok(Math.abs(t - first) < 0.05)

  // Auditable: cada cuota trae su propio desglose que reproduce el total.
  for (const inst of result.installments) {
    assert.equal(roundCents(inst.principalAmount + inst.interestAmount + inst.otherChargesAmount), inst.totalAmount)
  }
})

test("french con balloon deja el saldo final exactamente en el monto pactado", () => {
  const stage = baseStage({
    stageType: "french",
    installmentsCount: 12,
    interestRate: 0.1,
    rateType: "nominal_annual",
    balloonAmount: 5000,
  })
  const result = generateStageSchedule(stage, 20_000, "2026-01-01")
  const last = result.installments.at(-1)!
  assert.equal(last.closingBalance, 5000)
  assert.equal(result.closingBalance, 5000)
})

test("gracia total capitaliza interés sin cobrar nada hasta que empieza la etapa real", () => {
  const stage = baseStage({
    stageType: "fixed_installment",
    installmentsCount: 12,
    interestRate: 0.12,
    rateType: "nominal_annual",
    gracePeriodMonths: 2,
    gracePeriodType: "total",
  })
  const result = generateStageSchedule(stage, 10_000, "2026-01-01")

  assert.equal(result.installments.length, 14)
  const [grace1, grace2] = result.installments
  assert.equal(grace1.totalAmount, 0)
  assert.equal(grace2.totalAmount, 0)
  // El saldo creció durante la gracia (interés capitalizado).
  assert.ok(grace2.closingBalance > 10_000)
  // Al final del plan el saldo vuelve a cero.
  assert.equal(result.closingBalance, 0)
})

test("gracia de sólo interés no reduce capital pero sí cobra interés", () => {
  const stage = baseStage({
    stageType: "fixed_installment",
    installmentsCount: 12,
    interestRate: 0.12,
    rateType: "nominal_annual",
    gracePeriodMonths: 2,
    gracePeriodType: "interest_only",
  })
  const result = generateStageSchedule(stage, 10_000, "2026-01-01")
  const [grace1] = result.installments
  assert.equal(grace1.principalAmount, 0)
  assert.ok(grace1.interestAmount > 0)
  assert.equal(grace1.closingBalance, 10_000)
})

// Caso 3 del diseño: 24 meses sin interés (capital diferido, "gracia total"
// a tasa 0%) + 36 meses sistema francés al 8% sobre el capital completo.
test("generatePlanSchedule encadena etapas: el saldo final de una es el inicial de la siguiente", () => {
  const stages: StageScheduleInput[] = [
    baseStage({ stageType: "fixed_installment", installmentsCount: 0, gracePeriodMonths: 24, gracePeriodType: "total" }),
    baseStage({ stageType: "french", installmentsCount: 36, interestRate: 0.08, rateType: "nominal_annual" }),
  ]
  const { perStage, finalBalance } = generatePlanSchedule(stages, 60_000, "2026-01-01")

  assert.equal(perStage.length, 2)
  assert.equal(perStage[0].installments.length, 24)
  assert.equal(perStage[1].installments.length, 36)
  // Etapa 1 al 0%: no capitaliza nada, el capital pasa intacto a la etapa 2.
  assert.equal(perStage[0].closingBalance, 60_000)
  assert.equal(perStage[1].installments[0].openingBalance, 60_000)
  assert.equal(finalBalance, 0)
})

// Caso real: anticipo de USD 9.600 en 24 cuotas fijas sin interés, seguido
// de un crédito nuevo e independiente de USD 66.000 a 96 cuotas por sistema
// francés al 5% nominal anual — la etapa 2 NO hereda el saldo (que ya llegó
// a 0), arranca con su propio capital vía `openingBalanceOverride`. Números
// verificados contra una planilla de referencia real.
test("openingBalanceOverride: una etapa arranca con capital propio, no con el saldo heredado", () => {
  const stages: StageScheduleInput[] = [
    baseStage({ stageType: "fixed_installment", installmentsCount: 24 }),
    baseStage({
      stageType: "french",
      installmentsCount: 96,
      interestRate: 0.05,
      rateType: "nominal_annual",
      openingBalanceOverride: 66_000,
    }),
  ]

  const { perStage, finalBalance } = generatePlanSchedule(stages, 9_600, "2026-10-14")

  // Etapa 1: 9600 / 24 = 400 exactos, llega a 0.
  assert.equal(perStage[0].installments.length, 24)
  assert.equal(perStage[0].installments[0].principalAmount, 400)
  assert.equal(perStage[0].closingBalance, 0)

  // Etapa 2: arranca en 66000 (no en 0), cuota constante ~835.55.
  const stage2 = perStage[1].installments
  assert.equal(stage2.length, 96)
  assert.equal(stage2[0].openingBalance, 66_000)
  assert.equal(stage2[0].interestAmount, 275) // 66000 * 0.05/12
  assert.equal(roundCents(stage2[0].principalAmount + stage2[0].interestAmount), 835.55)
  assert.equal(stage2[0].closingBalance, 65_439.45)

  assert.equal(finalBalance, 0)
})

// Cotizador: un abono adicional planificado en una cuota específica acelera
// la amortización y acorta el plazo, en vez de recalcular la cuota.
test("plannedAdditionalPayments en fixed_installment adelanta el pago y acorta el plazo", () => {
  const stage = baseStage({
    stageType: "fixed_installment",
    installmentsCount: 12,
    plannedAdditionalPayments: { 1: 5000 },
  })
  const result = generateStageSchedule(stage, 12_000, "2026-01-01")

  // Con el abono de 5000 en la cuota 1, el saldo se agota en la cuota 7,
  // no en la 12 pactada originalmente.
  assert.equal(result.installments.length, 7)
  assert.equal(result.installments[0].principalAmount, 6000)
  assert.equal(result.closingBalance, 0)
})

test("plannedAdditionalPayments en french acorta el plazo sin tocar la cuota pactada", () => {
  const stage = baseStage({
    stageType: "french",
    installmentsCount: 10,
    plannedAdditionalPayments: { 1: 4000 },
  })
  const result = generateStageSchedule(stage, 10_000, "2026-01-01")

  assert.equal(result.installments.length, 6)
  assert.equal(result.installments[0].principalAmount, 5000)
  assert.equal(result.closingBalance, 0)
})
