import { addPeriod } from "./dateMath"
import { distributeEvenly, roundCents } from "./money"
import { toPeriodRate } from "./rates"
import type { InstallmentDraft, StageScheduleInput, StageScheduleResult } from "./types"

function generateGraceInstallments(
  stage: StageScheduleInput,
  openingBalance: number,
  startDate: string,
): { installments: InstallmentDraft[]; balance: number; nextDate: string } {
  const installments: InstallmentDraft[] = []
  let balance = openingBalance
  let date = startDate
  const periodRate = toPeriodRate(stage.interestRate, stage.rateType, stage.periodicity)

  for (let i = 0; i < stage.gracePeriodMonths; i++) {
    if (stage.gracePeriodType === "interest_only") {
      const interest = roundCents(balance * periodRate)
      const otherCharges = roundCents(stage.flatFeePerInstallment)
      installments.push({
        dueDate: date,
        openingBalance: balance,
        principalAmount: 0,
        interestAmount: interest,
        otherChargesAmount: otherCharges,
        totalAmount: roundCents(interest + otherCharges),
        closingBalance: balance,
        engineMetadata: { kind: "grace_interest_only", periodRate },
      })
    } else {
      // Gracia total: no se cobra nada; el interés del período se capitaliza
      // sumándose al saldo, que crece hasta que empiece la etapa "real". El
      // saldo se mantiene con precisión completa entre iteraciones (mismo
      // motivo que en generateFrenchSchedule): redondear acá y arrastrar ese
      // redondeo compondría error si hay varios meses de gracia seguidos.
      const capitalizedInterest = balance * periodRate
      const nextBalance = balance + capitalizedInterest
      installments.push({
        dueDate: date,
        openingBalance: roundCents(balance),
        principalAmount: 0,
        interestAmount: 0,
        otherChargesAmount: 0,
        totalAmount: 0,
        closingBalance: roundCents(nextBalance),
        engineMetadata: { kind: "grace_total", periodRate, capitalizedInterest: roundCents(capitalizedInterest) },
      })
      balance = nextBalance
    }
    date = addPeriod(date, stage.periodicity)
  }

  return { installments, balance, nextDate: date }
}

function generateCashInstallment(openingBalance: number, startDate: string, flatFee: number): InstallmentDraft[] {
  const otherCharges = roundCents(flatFee)
  return [
    {
      dueDate: startDate,
      openingBalance,
      principalAmount: openingBalance,
      interestAmount: 0,
      otherChargesAmount: otherCharges,
      totalAmount: roundCents(openingBalance + otherCharges),
      closingBalance: 0,
    },
  ]
}

// Cuotas fijas, con interés simple/flat opcional (no amortización compuesta
// tipo francés): el capital se reparte en partes iguales y, si hay tasa, el
// interés total del tramo (calculado una sola vez sobre el saldo inicial) se
// reparte también en partes iguales. El 0% de interés no implica
// necesariamente "todo va a capital": `flatFeePerInstallment` es un cargo
// administrativo independiente que igual se cobra en cada cuota.
function generateFixedInstallmentSchedule(
  stage: StageScheduleInput,
  openingBalance: number,
  startDate: string,
): InstallmentDraft[] {
  const n = stage.installmentsCount ?? 0
  if (n <= 0) return []

  const periodRate = toPeriodRate(stage.interestRate, stage.rateType, stage.periodicity)
  const totalInterest = periodRate > 0 ? openingBalance * periodRate * n : 0

  const principals = distributeEvenly(openingBalance, n)
  const interests = totalInterest > 0 ? distributeEvenly(totalInterest, n) : new Array(n).fill(0)

  const installments: InstallmentDraft[] = []
  let balance = openingBalance
  let date = startDate

  for (let k = 0; k < n; k++) {
    if (balance <= 0) break

    const scheduled = principals[k]
    const extra = stage.plannedAdditionalPayments?.[k + 1] ?? 0
    const principal = roundCents(Math.min(scheduled + extra, balance))
    const interest = interests[k]
    const otherCharges = roundCents(stage.flatFeePerInstallment)
    const closingBalance = roundCents(balance - principal)
    installments.push({
      dueDate: date,
      openingBalance: balance,
      principalAmount: principal,
      interestAmount: interest,
      otherChargesAmount: otherCharges,
      totalAmount: roundCents(principal + interest + otherCharges),
      closingBalance,
      engineMetadata: extra > 0 ? { kind: "fixed_installment", periodRate, additionalPayment: extra } : { kind: "fixed_installment", periodRate },
    })
    balance = closingBalance
    date = addPeriod(date, stage.periodicity)
  }

  return installments
}

// Cuotas fijas con el monto pactado directamente por el usuario, en vez de
// derivarlo dividiendo el capital entre una cantidad de cuotas elegida: el
// cliente se compromete a pagar un monto constante por período (ej. "USD 400
// por mes"). El interés por cuota es constante (mismo modelo simple/flat que
// generateFixedInstallmentSchedule, calculado una sola vez sobre el saldo
// inicial), así que el capital por cuota también es constante.
//
// `installmentsCount`, si se define, es un TOPE: el compromiso es "USD 4.000
// por mes durante 24 meses", no necesariamente hasta terminar de pagar. Si
// el capital de la etapa es mayor a lo que esas cuotas alcanzan a cubrir, lo
// que queda pasa como saldo inicial a la siguiente etapa (ej. el resto a
// sistema francés) — es la misma cadena de `generatePlanSchedule` que ya usa
// cualquier otro tramo, no un caso especial. Sin `installmentsCount` (o en
// 0), se generan las cuotas que hagan falta hasta pagar todo el capital de
// esta etapa (comportamiento anterior, para cuando no hay etapa siguiente).
// En cualquier caso, si el saldo llega a cero antes de agotar el tope, la
// última cuota absorbe lo que quede.
function generateFixedInstallmentScheduleByAmount(
  stage: StageScheduleInput,
  openingBalance: number,
  startDate: string,
): InstallmentDraft[] {
  const targetAmount = stage.fixedInstallmentAmount ?? 0
  if (targetAmount <= 0 || openingBalance <= 0) return []

  const periodRate = toPeriodRate(stage.interestRate, stage.rateType, stage.periodicity)
  const interestPerInstallment = roundCents(openingBalance * periodRate)
  const otherCharges = roundCents(stage.flatFeePerInstallment)
  const principalPerInstallment = roundCents(targetAmount - interestPerInstallment - otherCharges)

  if (principalPerInstallment <= 0) {
    throw new Error("El monto fijo pactado no alcanza para cubrir el interés y los cargos de cada cuota")
  }

  const SANITY_CAP = 1200 // 100 años mensuales — tope de sanidad, no un límite de negocio real
  const maxInstallments = stage.installmentsCount && stage.installmentsCount > 0 ? stage.installmentsCount : SANITY_CAP
  if (maxInstallments > SANITY_CAP) {
    throw new Error("El monto fijo pactado genera demasiadas cuotas — revisá el monto o la tasa de interés")
  }

  const installments: InstallmentDraft[] = []
  let balance = openingBalance
  let date = startDate
  let k = 0

  while (balance > 0 && k < maxInstallments) {
    k++

    const extra = stage.plannedAdditionalPayments?.[k] ?? 0
    const principal = roundCents(Math.min(principalPerInstallment + extra, balance))
    const closingBalance = roundCents(balance - principal)

    installments.push({
      dueDate: date,
      openingBalance: balance,
      principalAmount: principal,
      interestAmount: interestPerInstallment,
      otherChargesAmount: otherCharges,
      totalAmount: roundCents(principal + interestPerInstallment + otherCharges),
      closingBalance,
      engineMetadata:
        extra > 0
          ? { kind: "fixed_installment_amount", periodRate, targetAmount, additionalPayment: extra }
          : { kind: "fixed_installment_amount", periodRate, targetAmount },
    })

    balance = closingBalance
    date = addPeriod(date, stage.periodicity)
  }

  return installments
}

// Sistema francés: cuota constante calculada con la fórmula estándar de
// anualidad, generalizada para admitir una cuota final/balloon (balloon=0 es
// el caso normal). La última cuota siempre fuerza el saldo final exacto
// (balloon), absorbiendo ahí cualquier residuo de redondeo.
function generateFrenchSchedule(stage: StageScheduleInput, openingBalance: number, startDate: string): InstallmentDraft[] {
  const n = stage.installmentsCount ?? 0
  if (n <= 0) return []

  const i = toPeriodRate(stage.interestRate, stage.rateType, stage.periodicity)
  const balloon = stage.balloonAmount ?? 0
  const P = openingBalance

  const payment = i === 0 ? (P - balloon) / n : ((P * Math.pow(1 + i, n) - balloon) * i) / (Math.pow(1 + i, n) - 1)

  const installments: InstallmentDraft[] = []
  // `balance` se mantiene con precisión completa (sin redondear) entre
  // iteraciones: el interés de cada cuota se calcula sobre el saldo real, no
  // sobre un saldo ya redondeado a centavos de la cuota anterior. Redondear
  // acá y arrastrar ese redondeo período a período compone error a lo largo
  // de muchas cuotas (con 96 cuotas al 5%, se acumulan varias decenas de
  // centavos de diferencia contra una planilla de referencia) — el
  // redondeo sólo debe pasar al armar cada `InstallmentDraft` para mostrar.
  let balance = P
  let date = startDate

  for (let k = 1; k <= n; k++) {
    if (balance <= balloon) break

    const interest = balance * i
    const isLast = k === n
    const scheduledPrincipal = isLast ? balance - balloon : payment - interest
    const extra = stage.plannedAdditionalPayments?.[k] ?? 0
    // Un abono adicional nunca reduce el saldo por debajo del balloon pactado.
    const principal = Math.min(scheduledPrincipal + extra, balance - balloon)
    const nextBalance = balance - principal
    const otherCharges = roundCents(stage.flatFeePerInstallment)
    const roundedInterest = roundCents(interest)
    const roundedPrincipal = roundCents(principal)
    // Total sin redondear (capital + interés a precisión completa + cargos):
    // el "total" en USD que se muestra siempre va a centavos, pero convertir
    // a una moneda de referencia (§18: puramente informativo) a partir de
    // este valor en vez del ya redondeado es lo que reproduce exactamente
    // una planilla de referencia calculada con la fórmula de cuota sin
    // redondeos intermedios (ver format.ts `preciseInstallmentTotal`).
    const preciseTotalAmount = principal + interest + otherCharges

    installments.push({
      dueDate: date,
      openingBalance: roundCents(balance),
      principalAmount: roundedPrincipal,
      interestAmount: roundedInterest,
      otherChargesAmount: otherCharges,
      totalAmount: roundCents(roundedPrincipal + roundedInterest + otherCharges),
      closingBalance: roundCents(nextBalance),
      engineMetadata:
        extra > 0
          ? { kind: "french", periodRate: i, constantPayment: roundCents(payment), preciseTotalAmount, additionalPayment: extra }
          : { kind: "french", periodRate: i, constantPayment: roundCents(payment), preciseTotalAmount },
    })

    balance = nextBalance
    date = addPeriod(date, stage.periodicity)
  }

  return installments
}

function generateCustomSchedule(stage: StageScheduleInput, openingBalance: number, startDate: string): InstallmentDraft[] {
  const manual = stage.config?.manualInstallments
  if (!manual || manual.length === 0) {
    throw new Error("La etapa 'custom' requiere config.manualInstallments con al menos una cuota")
  }

  const installments: InstallmentDraft[] = []
  let balance = openingBalance
  let date = startDate

  for (const row of manual) {
    const interest = roundCents(row.interest ?? 0)
    const otherCharges = roundCents(row.otherCharges ?? 0)
    const principal = roundCents(row.principal)
    const closingBalance = roundCents(balance - principal)
    installments.push({
      dueDate: date,
      openingBalance: balance,
      principalAmount: principal,
      interestAmount: interest,
      otherChargesAmount: otherCharges,
      totalAmount: roundCents(principal + interest + otherCharges),
      closingBalance,
      engineMetadata: { kind: "custom" },
    })
    balance = closingBalance
    date = addPeriod(date, stage.periodicity)
  }

  return installments
}

// Punto de entrada del motor para una etapa: aplica el período de gracia (si
// hay) y despacha al algoritmo correspondiente para el resto. El saldo final
// y la fecha siguiente quedan listos para encadenar con la próxima etapa.
export function generateStageSchedule(stage: StageScheduleInput, openingBalance: number, startDate: string): StageScheduleResult {
  const grace = stage.gracePeriodMonths > 0 ? generateGraceInstallments(stage, openingBalance, startDate) : null
  const balanceAfterGrace = grace?.balance ?? openingBalance
  const dateAfterGrace = grace?.nextDate ?? startDate

  let mainInstallments: InstallmentDraft[]
  switch (stage.stageType) {
    case "cash":
      mainInstallments = generateCashInstallment(balanceAfterGrace, dateAfterGrace, stage.flatFeePerInstallment)
      break
    case "fixed_installment":
      mainInstallments = stage.fixedInstallmentAmount
        ? generateFixedInstallmentScheduleByAmount(stage, balanceAfterGrace, dateAfterGrace)
        : generateFixedInstallmentSchedule(stage, balanceAfterGrace, dateAfterGrace)
      break
    case "french":
      mainInstallments = generateFrenchSchedule(stage, balanceAfterGrace, dateAfterGrace)
      break
    case "custom":
      mainInstallments = generateCustomSchedule(stage, balanceAfterGrace, dateAfterGrace)
      break
    default:
      throw new Error(`Tipo de etapa no soportado: ${stage.stageType satisfies never}`)
  }

  const installments = [...(grace?.installments ?? []), ...mainInstallments]
  const last = installments.at(-1)

  return {
    installments,
    closingBalance: last ? last.closingBalance : balanceAfterGrace,
    nextStartDate: last ? addPeriod(last.dueDate, stage.periodicity) : dateAfterGrace,
  }
}

// Índices (1-based) de etapas que no generaron ninguna cuota — típicamente
// porque no les llegó saldo pendiente (la etapa anterior ya amortizó todo el
// capital dentro de sí misma) o porque quedaron con "cantidad de cuotas" en
// 0. El motor no lo trata como error (una etapa vacía es válida), pero es la
// causa más común de "agregué una etapa y no me muestra cuotas" — se usa
// para avisar en la vista previa del formulario/cotizador.
export function findEmptyStages(perStage: StageScheduleResult[]): number[] {
  return perStage.map((s, i) => (s.installments.length === 0 ? i + 1 : null)).filter((n): n is number => n !== null)
}

// Encadena varias etapas de una misma versión de plan: el saldo inicial de la
// etapa N+1 es exactamente el saldo final de la etapa N (ver §7/§14 del
// diseño: "24 meses sin interés + 36 meses francés" son sólo dos etapas).
export function generatePlanSchedule(
  stages: StageScheduleInput[],
  openingBalance: number,
  startDate: string,
): { perStage: StageScheduleResult[]; finalBalance: number } {
  const perStage: StageScheduleResult[] = []
  let balance = openingBalance
  let date = startDate

  for (const stage of stages) {
    const stageOpeningBalance = stage.openingBalanceOverride ?? balance
    const result = generateStageSchedule(stage, stageOpeningBalance, date)
    perStage.push(result)
    balance = result.closingBalance
    date = result.nextStartDate
  }

  return { perStage, finalBalance: balance }
}
