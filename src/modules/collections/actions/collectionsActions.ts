"use server"

import { refresh } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { cobClients } from "@/db/schema/collectionsClient"
import { cobProjects, cobProperties } from "@/db/schema/collectionsProperty"
import { cobOperations } from "@/db/schema/collectionsOperation"
import { cobPaymentPlanVersions, cobPlanStages } from "@/db/schema/collectionsPlan"
import { cobInstallments } from "@/db/schema/collectionsInstallment"
import { cobPayments, cobPaymentAllocations } from "@/db/schema/collectionsPayment"
import { getSession } from "@/lib/session"
import { saveReceipt, deleteReceipt } from "@/lib/receiptStorage"
import { canManageCollections } from "@/lib/permissions"
import { generatePlanSchedule } from "@/modules/collections/engine/schedule"
import { allocatePayment, type AllocationTarget } from "@/modules/collections/engine/paymentAllocation"
import { calculateSettlementQuote } from "@/modules/collections/engine/settlement"
import type { StageScheduleInput } from "@/modules/collections/engine/types"
import { getPaymentDetail } from "@/modules/collections/data/queries"
import { logCollectionsEvent } from "@/modules/collections/data/events"
import { convertCurrency } from "@/modules/collections/format"
import { DEFAULT_APPLICATION_ORDER } from "@/types/collections"
import type {
  ClientDocumentType,
  ClientStatus,
  ClientType,
  GracePeriodType,
  PaymentCategory,
  PaymentComponent,
  PaymentMethod,
  Periodicity,
  PlanVersionReason,
  ProjectStatus,
  PropertyOrigin,
  PropertyType,
  RateType,
  StageType,
} from "@/types/collections"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function requireManage() {
  const session = await getSession()
  if (!session || !canManageCollections(session)) {
    throw new Error("No tenés permisos para administrar cobranzas")
  }
  return session
}

// --- Clientes ---------------------------------------------------------

interface CreateClientInput {
  clientType: ClientType
  firstName?: string
  lastName?: string
  businessName?: string
  documentType: ClientDocumentType
  documentNumber: string
  email?: string
  phone?: string
  city?: string
  country?: string
  notes?: string
}

export async function createClient(data: CreateClientInput): Promise<{ id: string }> {
  const session = await requireManage()

  const documentNumber = data.documentNumber.trim()
  if (!documentNumber) throw new Error("El documento es obligatorio")
  if (data.clientType === "company" && !data.businessName?.trim()) throw new Error("La razón social es obligatoria")
  if (data.clientType === "person" && !data.firstName?.trim()) throw new Error("El nombre es obligatorio")

  const [created] = await db
    .insert(cobClients)
    .values({
      clientType: data.clientType,
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      businessName: data.businessName?.trim() || null,
      documentType: data.documentType,
      documentNumber,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      notes: data.notes?.trim() || null,
      createdBy: session.userId,
    })
    .returning({ id: cobClients.id })

  await logCollectionsEvent(db, {
    entityType: "client",
    entityId: created.id,
    eventType: "client_created",
    description: "Cliente creado",
    performedBy: session.userId,
  })

  refresh()
  return created
}

interface UpdateClientInput extends CreateClientInput {
  id: string
}

export async function updateClient(data: UpdateClientInput): Promise<{ id: string }> {
  const session = await requireManage()

  const documentNumber = data.documentNumber.trim()
  if (!documentNumber) throw new Error("El documento es obligatorio")
  if (data.clientType === "company" && !data.businessName?.trim()) throw new Error("La razón social es obligatoria")
  if (data.clientType === "person" && !data.firstName?.trim()) throw new Error("El nombre es obligatorio")

  await db
    .update(cobClients)
    .set({
      clientType: data.clientType,
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      businessName: data.businessName?.trim() || null,
      documentType: data.documentType,
      documentNumber,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      notes: data.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(cobClients.id, data.id))

  await logCollectionsEvent(db, {
    entityType: "client",
    entityId: data.id,
    eventType: "client_updated",
    description: "Datos del cliente actualizados",
    performedBy: session.userId,
  })

  refresh()
  return { id: data.id }
}

// No hay DELETE físico de clientes: cambiar el estado preserva todo el
// historial de operaciones/pagos asociado (ver docs/cobranzas/DISENO.md §17).
export async function setClientStatus(id: string, status: ClientStatus): Promise<void> {
  const session = await requireManage()

  await db.update(cobClients).set({ status, updatedAt: new Date() }).where(eq(cobClients.id, id))

  await logCollectionsEvent(db, {
    entityType: "client",
    entityId: id,
    eventType: status === "archived" ? "client_archived" : "client_status_changed",
    description: `Cliente marcado como "${status}"`,
    performedBy: session.userId,
  })

  refresh()
}

// --- Proyectos ------------------------------------------------------------

interface CreateProjectInput {
  name: string
  description?: string
  address?: string
  city?: string
  country?: string
}

export async function createProject(data: CreateProjectInput): Promise<{ id: string }> {
  const session = await requireManage()

  const name = data.name.trim()
  if (!name) throw new Error("El nombre del proyecto es obligatorio")

  const [created] = await db
    .insert(cobProjects)
    .values({
      name,
      description: data.description?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      createdBy: session.userId,
    })
    .returning({ id: cobProjects.id })

  refresh()
  return created
}

interface UpdateProjectInput extends CreateProjectInput {
  id: string
}

export async function updateProject(data: UpdateProjectInput): Promise<{ id: string }> {
  await requireManage()

  const name = data.name.trim()
  if (!name) throw new Error("El nombre del proyecto es obligatorio")

  await db
    .update(cobProjects)
    .set({
      name,
      description: data.description?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(cobProjects.id, data.id))

  refresh()
  return { id: data.id }
}

// No hay DELETE físico: un proyecto archivado deja de aparecer para
// vincularlo a operaciones nuevas, pero las operaciones/inmuebles que ya lo
// referencian no se ven afectados.
export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  await requireManage()
  await db.update(cobProjects).set({ status, updatedAt: new Date() }).where(eq(cobProjects.id, id))
  refresh()
}

// --- Operaciones --------------------------------------------------------

interface StageInput {
  stageType: StageType
  installmentsCount: number | null
  periodicity: Periodicity
  interestRate: number | null
  rateType: RateType
  flatFeePerInstallment: number
  gracePeriodMonths: number
  gracePeriodType: GracePeriodType | null
  balloonAmount: number | null
  // Si se define, esta etapa arranca con este capital propio en vez de
  // heredar el saldo final de la etapa anterior (ver engine/types.ts).
  openingBalanceOverride?: number | null
  // Sólo para stageType='fixed_installment': monto fijo por cuota pactado
  // directamente por el usuario — la cantidad de cuotas se deriva en el
  // motor (ver engine/schedule.ts). Se guarda en `cob_plan_stages.config`.
  fixedInstallmentAmount?: number | null
  // Abonos extra planificados por número de cuota — acortan el plazo en vez
  // de recalcular la cuota pactada (ver engine/schedule.ts). Se guarda tal
  // cual en `cob_plan_stages.config` como trazabilidad de lo pactado; el
  // efecto real ya queda reflejado en las cuotas generadas.
  plannedAdditionalPayments?: Record<number, number> | null
}

// `cob_plan_stages.config` es el escape hatch documentado para parámetros de
// variantes que no ameritan columna propia (ver docs/cobranzas/DISENO.md
// C.7) — acá se agrupan los que ya usamos, para no repetir este armado en
// cada lugar que inserta una etapa.
function buildStageConfig(stageInput: Pick<StageInput, "plannedAdditionalPayments" | "fixedInstallmentAmount">): Record<string, unknown> | null {
  const config: Record<string, unknown> = {}
  if (stageInput.plannedAdditionalPayments) config.plannedAdditionalPayments = stageInput.plannedAdditionalPayments
  if (stageInput.fixedInstallmentAmount) config.fixedInstallmentAmount = stageInput.fixedInstallmentAmount
  return Object.keys(config).length > 0 ? config : null
}

interface NewPropertyInput {
  origin: PropertyOrigin
  projectId?: string | null
  projectNameSnapshot: string
  unitLabel: string
  propertyType?: PropertyType | null
  areaM2?: number | null
}

interface CreateOperationInput {
  clientId: string
  propertyId?: string | null
  newProperty?: NewPropertyInput | null
  currencyCode: string
  // Puramente informativo (§18): equivalente en otra moneda a un tipo de
  // cambio fijo, para mostrar en el cronograma. No afecta saldos ni pagos.
  referenceCurrencyCode?: string | null
  referenceExchangeRate?: number | null
  originalAmount: number
  downPaymentAmount: number
  startDate: string
  notes?: string
  stages: StageInput[]
}

export async function createOperation(data: CreateOperationInput): Promise<{ id: string }> {
  const session = await requireManage()

  if (data.stages.length === 0) throw new Error("La operación necesita al menos una etapa de pago")
  const financedAmount = data.originalAmount - data.downPaymentAmount
  if (financedAmount <= 0) throw new Error("El monto financiado debe ser mayor a cero")

  const stagesInput: StageScheduleInput[] = data.stages.map((s) => ({
    stageType: s.stageType,
    installmentsCount: s.installmentsCount,
    periodicity: s.periodicity,
    interestRate: s.interestRate,
    rateType: s.rateType,
    flatFeePerInstallment: s.flatFeePerInstallment,
    gracePeriodMonths: s.gracePeriodMonths,
    gracePeriodType: s.gracePeriodType,
    balloonAmount: s.balloonAmount,
    openingBalanceOverride: s.openingBalanceOverride,
    fixedInstallmentAmount: s.fixedInstallmentAmount,
    plannedAdditionalPayments: s.plannedAdditionalPayments,
  }))

  const { perStage } = generatePlanSchedule(stagesInput, financedAmount, data.startDate)

  const operationId = await db.transaction(async (tx) => {
    let propertyId = data.propertyId || null
    if (!propertyId && data.newProperty) {
      const [property] = await tx
        .insert(cobProperties)
        .values({
          origin: data.newProperty.origin,
          projectId: data.newProperty.projectId || null,
          projectNameSnapshot: data.newProperty.projectNameSnapshot.trim(),
          unitLabel: data.newProperty.unitLabel.trim(),
          propertyType: data.newProperty.propertyType || null,
          areaM2: data.newProperty.areaM2 != null ? String(data.newProperty.areaM2) : null,
          createdBy: session.userId,
        })
        .returning({ id: cobProperties.id })
      propertyId = property.id
    }

    const [operation] = await tx
      .insert(cobOperations)
      .values({
        clientId: data.clientId,
        propertyId,
        currencyCode: data.currencyCode,
        referenceCurrencyCode: data.referenceCurrencyCode || null,
        referenceExchangeRate: data.referenceExchangeRate != null ? String(data.referenceExchangeRate) : null,
        originalAmount: String(data.originalAmount),
        downPaymentAmount: String(data.downPaymentAmount),
        financedAmount: String(financedAmount),
        startDate: data.startDate,
        notes: data.notes?.trim() || null,
        createdBy: session.userId,
      })
      .returning({ id: cobOperations.id })

    const [planVersion] = await tx
      .insert(cobPaymentPlanVersions)
      .values({
        operationId: operation.id,
        versionNumber: 1,
        status: "active",
        reason: "initial",
        effectiveDate: data.startDate,
        createdBy: session.userId,
      })
      .returning({ id: cobPaymentPlanVersions.id })

    let installmentNumber = 1
    let totalScheduled = 0

    for (let i = 0; i < data.stages.length; i++) {
      const stageInput = data.stages[i]
      const stageResult = perStage[i]

      const [stageRow] = await tx
        .insert(cobPlanStages)
        .values({
          planVersionId: planVersion.id,
          sequenceNumber: i + 1,
          stageType: stageInput.stageType,
          // Se guarda la cantidad real de cuotas generadas, no lo que pidió
          // el usuario: con monto fijo pactado la cuenta la hace el motor, y
          // con abonos adicionales el plazo puede acortarse — en ambos casos
          // lo que quedó en `cob_installments` es la fuente de verdad.
          installmentsCount: stageInput.stageType === "cash" ? null : stageResult.installments.length,
          periodicity: stageInput.periodicity,
          interestRate: stageInput.interestRate != null ? String(stageInput.interestRate) : null,
          rateType: stageInput.rateType,
          flatFeePerInstallment: String(stageInput.flatFeePerInstallment),
          gracePeriodMonths: stageInput.gracePeriodMonths,
          gracePeriodType: stageInput.gracePeriodType,
          balloonAmount: stageInput.balloonAmount != null ? String(stageInput.balloonAmount) : null,
          openingBalanceOverride: stageInput.openingBalanceOverride != null ? String(stageInput.openingBalanceOverride) : null,
          config: buildStageConfig(stageInput),
          startDate: stageResult.installments[0]?.dueDate ?? data.startDate,
          endDate: stageResult.installments.at(-1)?.dueDate ?? null,
          status: "generated",
          createdBy: session.userId,
        })
        .returning({ id: cobPlanStages.id })

      if (stageResult.installments.length > 0) {
        await tx.insert(cobInstallments).values(
          stageResult.installments.map((draft) => {
            totalScheduled += draft.totalAmount
            return {
              planVersionId: planVersion.id,
              stageId: stageRow.id,
              installmentNumber: installmentNumber++,
              dueDate: draft.dueDate,
              openingBalance: String(draft.openingBalance),
              principalAmount: String(draft.principalAmount),
              interestAmount: String(draft.interestAmount),
              otherChargesAmount: String(draft.otherChargesAmount),
              totalAmount: String(draft.totalAmount),
              closingBalance: String(draft.closingBalance),
              balanceDue: String(draft.totalAmount),
              engineMetadata: draft.engineMetadata ?? null,
            }
          }),
        )
      }
    }

    await tx.update(cobOperations).set({ currentBalance: String(totalScheduled) }).where(eq(cobOperations.id, operation.id))

    await logCollectionsEvent(tx, {
      operationId: operation.id,
      entityType: "operation",
      entityId: operation.id,
      eventType: "operation_created",
      description: `Operación creada por ${financedAmount} ${data.currencyCode} a financiar`,
      balanceBefore: 0,
      balanceAfter: totalScheduled,
      performedBy: session.userId,
    })
    await logCollectionsEvent(tx, {
      operationId: operation.id,
      entityType: "plan_version",
      entityId: planVersion.id,
      eventType: "installments_generated",
      description: `Se generaron ${installmentNumber - 1} cuotas en ${data.stages.length} etapa(s)`,
      metadata: { stages: data.stages },
      performedBy: session.userId,
    })

    return operation.id
  })

  refresh()
  return { id: operationId }
}

// --- Pagos ---------------------------------------------------------------

interface RegisterPaymentInput {
  operationId: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  paymentCategory?: PaymentCategory
  currencyCode?: string
  exchangeRate?: number
  applicationOrder?: PaymentComponent[]
  // Cobrar también el interés/cargos de cuotas que todavía no vencen a la
  // fecha del pago. Por defecto no (pago adelantado = solo capital).
  chargeFutureInterest?: boolean
  referenceNumber?: string
  bankName?: string
  observations?: string
  // Mora cargada a mano al momento de cobrar (no hay todavía un cálculo
  // automático de mora — ver docs/cobranzas/DISENO.md y engine/lateFees.ts,
  // que está definido pero sin conectar). Se suma al lateFeeAmount de la
  // cuota elegida antes de aplicar el pago, así ese mismo pago ya la puede
  // cubrir si alcanza.
  lateFeeCharge?: {
    installmentId: string
    amount: number
  }
}

// El comprobante (imagen) viaja en un FormData aparte del resto de los datos,
// bajo la clave "receipt", porque un File no se puede mandar dentro de un
// objeto plano. Es obligatorio: cada pago tiene que quedar respaldado.
export async function registerPayment(data: RegisterPaymentInput, formData: FormData): Promise<{ id: string }> {
  const session = await requireManage()
  if (data.amount <= 0) throw new Error("El monto del pago debe ser mayor a cero")

  const receipt = formData.get("receipt")
  if (!(receipt instanceof File) || receipt.size === 0) {
    throw new Error("Adjuntá la imagen del comprobante de pago")
  }
  // Se sube antes de la transacción (no se puede hacer rollback de un blob);
  // si el pago falla por cualquier motivo, se borra para no dejarlo huérfano.
  const receiptUrl = await saveReceipt(receipt)

  let paymentId: string
  try {
    paymentId = await db.transaction((tx) => applyPayment(tx, data, receiptUrl, session.userId))
  } catch (err) {
    await deleteReceipt(receiptUrl).catch(() => {})
    throw err
  }

  refresh()
  return { id: paymentId }
}

async function applyPayment(tx: Tx, data: RegisterPaymentInput, receiptUrl: string, userId: string): Promise<string> {
  const [operation] = await tx.select().from(cobOperations).where(eq(cobOperations.id, data.operationId)).limit(1)
  if (!operation) throw new Error("Operación no encontrada")

  const currencyCode = data.currencyCode || operation.currencyCode
  const exchangeRate = currencyCode !== operation.currencyCode ? data.exchangeRate : null
  if (currencyCode !== operation.currencyCode && !exchangeRate) {
    throw new Error("Se requiere el tipo de cambio cuando el pago es en una moneda distinta a la de la operación")
  }
  // exchangeRateLabel/convertCurrency deciden la dirección (dividir o
  // multiplicar) según cuál de las dos monedas es USD, para que el tipo de
  // cambio que carga el usuario sea siempre el que se cotiza de memoria
  // (ver src/modules/collections/format.ts).
  const convertedAmount = exchangeRate ? convertCurrency(data.amount, exchangeRate, currencyCode, operation.currencyCode) : data.amount

  const [activeVersion] = await tx
    .select()
    .from(cobPaymentPlanVersions)
    .where(and(eq(cobPaymentPlanVersions.operationId, data.operationId), eq(cobPaymentPlanVersions.status, "active")))
    .limit(1)
  if (!activeVersion) throw new Error("La operación no tiene un plan de pagos activo")

  if (data.lateFeeCharge) {
    if (data.lateFeeCharge.amount <= 0) throw new Error("El monto de mora debe ser mayor a cero")

    const [chargedInstallment] = await tx
      .select()
      .from(cobInstallments)
      .where(and(eq(cobInstallments.id, data.lateFeeCharge.installmentId), eq(cobInstallments.planVersionId, activeVersion.id)))
      .limit(1)
    if (!chargedInstallment) throw new Error("La cuota indicada para la mora no pertenece a esta operación")

    const newLateFeeAmount = roundToCents(Number(chargedInstallment.lateFeeAmount) + data.lateFeeCharge.amount)
    const newBalanceDue = roundToCents(Number(chargedInstallment.balanceDue) + data.lateFeeCharge.amount)
    await tx
      .update(cobInstallments)
      .set({ lateFeeAmount: String(newLateFeeAmount), balanceDue: String(newBalanceDue), updatedAt: new Date() })
      .where(eq(cobInstallments.id, chargedInstallment.id))

    await logCollectionsEvent(tx, {
      operationId: operation.id,
      entityType: "installment",
      entityId: chargedInstallment.id,
      eventType: "late_fee_charged",
      description: `Se cargó mora de ${data.lateFeeCharge.amount} ${operation.currencyCode} a la cuota #${chargedInstallment.installmentNumber} por atraso`,
      performedBy: userId,
    })
  }

  const pendingInstallments = await tx
    .select()
    .from(cobInstallments)
    .where(and(eq(cobInstallments.planVersionId, activeVersion.id), inArray(cobInstallments.status, ["pending", "partial"])))

  // El interés y los cargos de una cuota que todavía no vence no se le
  // pueden cobrar a alguien que paga por adelantado — mismo criterio que ya
  // usa calculateSettlementQuote para la liquidación anticipada (§22 del
  // diseño, ver engine/settlement.ts). En una cuota vencida sí corresponde
  // cobrar todo lo pendiente, sea cual sea el orden que eligió el usuario.
  const targets: AllocationTarget[] = pendingInstallments.map((inst) => {
    const isDue = data.chargeFutureInterest === true || inst.dueDate <= data.paymentDate
    return {
      installmentId: inst.id,
      dueDate: inst.dueDate,
      lateFeeDue: Number(inst.lateFeeAmount) - Number(inst.paidLateFee),
      interestDue: isDue ? Number(inst.interestAmount) - Number(inst.paidInterest) - Number(inst.waivedInterest) : 0,
      otherDue: isDue ? Number(inst.otherChargesAmount) - Number(inst.paidOther) - Number(inst.waivedOther) : 0,
      principalDue: Number(inst.principalAmount) - Number(inst.paidPrincipal),
    }
  })

  const order = data.applicationOrder ?? DEFAULT_APPLICATION_ORDER
  const { allocations, unallocated } = allocatePayment(convertedAmount, targets, order)

  const [payment] = await tx
    .insert(cobPayments)
    .values({
      clientId: operation.clientId,
      operationId: operation.id,
      paymentCategory: data.paymentCategory ?? "regular",
      applicationMode: "auto_order",
      applicationOrder: order,
      amount: String(data.amount),
      currencyCode,
      exchangeRate: exchangeRate != null ? String(exchangeRate) : null,
      convertedAmount: exchangeRate != null ? String(convertedAmount) : null,
      paymentMethod: data.paymentMethod,
      paymentDate: data.paymentDate,
      referenceNumber: data.referenceNumber?.trim() || null,
      bankName: data.bankName?.trim() || null,
      receiptUrl,
      observations: data.observations?.trim() || null,
      registeredBy: userId,
    })
    .returning({ id: cobPayments.id })

  let totalWaived = 0

  for (const allocation of allocations) {
    const inst = pendingInstallments.find((i) => i.id === allocation.installmentId)!
    const isDue = data.chargeFutureInterest === true || inst.dueDate <= data.paymentDate
    const paidPrincipal = roundToCents(Number(inst.paidPrincipal) + allocation.appliedPrincipal)
    const paidInterest = roundToCents(Number(inst.paidInterest) + allocation.appliedInterest)
    const paidOther = roundToCents(Number(inst.paidOther) + allocation.appliedOther)
    const paidLateFee = roundToCents(Number(inst.paidLateFee) + allocation.appliedLateFee)

    // Si la cuota todavía no vencía y este pago le adelantó todo el capital,
    // el interés (y otros cargos) de ese período no se cobra. El plan no se
    // modifica: interestAmount/totalAmount quedan como estaban y lo no
    // cobrado se registra aparte (waived*), tanto en la cuota como en la
    // aplicación de este pago, para mostrarlo y poder revertirlo al anular.
    let waivedInterest = 0
    let waivedOther = 0
    if (!isDue && paidPrincipal >= Number(inst.principalAmount) - 0.005) {
      waivedInterest = Math.max(0, roundToCents(Number(inst.interestAmount) - paidInterest - Number(inst.waivedInterest)))
      waivedOther = Math.max(0, roundToCents(Number(inst.otherChargesAmount) - paidOther - Number(inst.waivedOther)))
      totalWaived += roundToCents(waivedInterest + waivedOther)
    }

    await tx.insert(cobPaymentAllocations).values({
      paymentId: payment.id,
      installmentId: allocation.installmentId,
      allocatedPrincipal: String(allocation.appliedPrincipal),
      allocatedInterest: String(allocation.appliedInterest),
      allocatedLateFee: String(allocation.appliedLateFee),
      allocatedOther: String(allocation.appliedOther),
      waivedInterest: String(waivedInterest),
      waivedOther: String(waivedOther),
      allocatedAmount: String(allocation.appliedTotal),
    })

    const installmentWaivedInterest = roundToCents(Number(inst.waivedInterest) + waivedInterest)
    const installmentWaivedOther = roundToCents(Number(inst.waivedOther) + waivedOther)
    const paidAmount = roundToCents(paidPrincipal + paidInterest + paidOther + paidLateFee)
    const balanceDue = roundToCents(
      Number(inst.totalAmount) + Number(inst.lateFeeAmount) - paidAmount - installmentWaivedInterest - installmentWaivedOther,
    )

    await tx
      .update(cobInstallments)
      .set({
        paidPrincipal: String(paidPrincipal),
        paidInterest: String(paidInterest),
        paidOther: String(paidOther),
        paidLateFee: String(paidLateFee),
        paidAmount: String(paidAmount),
        waivedInterest: String(installmentWaivedInterest),
        waivedOther: String(installmentWaivedOther),
        balanceDue: String(Math.max(0, balanceDue)),
        status: balanceDue <= 0 ? "paid" : paidAmount > 0 ? "partial" : "pending",
        updatedAt: new Date(),
      })
      .where(eq(cobInstallments.id, allocation.installmentId))
  }

  const balanceBefore = Number(operation.currentBalance)
  await recalcOperationCache(tx, operation.id)
  const [updatedOperation] = await tx.select().from(cobOperations).where(eq(cobOperations.id, operation.id)).limit(1)

  await logCollectionsEvent(tx, {
    operationId: operation.id,
    entityType: "payment",
    entityId: payment.id,
    eventType: "payment_registered",
    description: `Pago de ${data.amount} ${currencyCode} registrado${unallocated > 0 ? ` (${unallocated} sin aplicar, queda como saldo a favor)` : ""}`,
    amountDelta: -convertedAmount,
    balanceBefore,
    balanceAfter: Number(updatedOperation.currentBalance),
    performedBy: userId,
  })

  if (totalWaived > 0) {
    await logCollectionsEvent(tx, {
      operationId: operation.id,
      entityType: "payment",
      entityId: payment.id,
      eventType: "future_interest_waived",
      description: `No se cobraron ${roundToCents(totalWaived)} ${operation.currencyCode} de interés/cargos de cuotas futuras pagadas por adelantado`,
      performedBy: userId,
    })
  }

  return payment.id
}

// Anulación de un pago: nunca se borra nada (mismo criterio que
// cancelOperation), se marca el pago como "reversed" y se revierte lo que
// ese pago había cubierto en cada cuota — pensado para corregir un monto mal
// cargado u otro error de carga sin perder el historial de qué pasó. Las
// filas de cobPaymentAllocations quedan intactas como evidencia de lo que se
// había aplicado.
interface ReversePaymentInput {
  paymentId: string
  reason: string
}

export async function reversePayment(data: ReversePaymentInput): Promise<void> {
  const session = await requireManage()
  const reason = data.reason.trim()
  if (!reason) throw new Error("Necesitás indicar un motivo para anular el pago")

  await db.transaction((tx) => reversePaymentInTx(tx, data.paymentId, reason, session.userId))

  refresh()
}

async function reversePaymentInTx(tx: Tx, paymentId: string, reason: string, userId: string): Promise<typeof cobPayments.$inferSelect> {
  const [payment] = await tx.select().from(cobPayments).where(eq(cobPayments.id, paymentId)).limit(1)
  if (!payment) throw new Error("Pago no encontrado")
  if (payment.status !== "confirmed") throw new Error("Este pago ya fue anulado")
  if (!payment.operationId) throw new Error("El pago no está asociado a una operación")

  const allocations = await tx.select().from(cobPaymentAllocations).where(eq(cobPaymentAllocations.paymentId, payment.id))

  for (const allocation of allocations) {
    const [inst] = await tx.select().from(cobInstallments).where(eq(cobInstallments.id, allocation.installmentId)).limit(1)
    if (!inst) continue

    const paidPrincipal = roundToCents(Number(inst.paidPrincipal) - Number(allocation.allocatedPrincipal))
    const paidInterest = roundToCents(Number(inst.paidInterest) - Number(allocation.allocatedInterest))
    const paidOther = roundToCents(Number(inst.paidOther) - Number(allocation.allocatedOther))
    const paidLateFee = roundToCents(Number(inst.paidLateFee) - Number(allocation.allocatedLateFee))
    const paidAmount = roundToCents(paidPrincipal + paidInterest + paidOther + paidLateFee)
    // Lo que este pago había dejado sin cobrar vuelve a ser deuda.
    const waivedInterest = Math.max(0, roundToCents(Number(inst.waivedInterest) - Number(allocation.waivedInterest)))
    const waivedOther = Math.max(0, roundToCents(Number(inst.waivedOther) - Number(allocation.waivedOther)))
    const balanceDue = roundToCents(Number(inst.totalAmount) + Number(inst.lateFeeAmount) - paidAmount - waivedInterest - waivedOther)

    // Una cuota cancelada/refinanciada no vuelve a "pending"/"partial" sólo
    // porque se anuló un pago viejo — ese estado ya no depende de lo pagado
    // (y recalcOperationCache las ignora igual, ver más abajo).
    const status =
      inst.status === "cancelled" || inst.status === "refinanced"
        ? inst.status
        : balanceDue <= 0
          ? "paid"
          : paidAmount > 0
            ? "partial"
            : "pending"

    await tx
      .update(cobInstallments)
      .set({
        paidPrincipal: String(Math.max(0, paidPrincipal)),
        paidInterest: String(Math.max(0, paidInterest)),
        paidOther: String(Math.max(0, paidOther)),
        paidLateFee: String(Math.max(0, paidLateFee)),
        paidAmount: String(Math.max(0, paidAmount)),
        waivedInterest: String(waivedInterest),
        waivedOther: String(waivedOther),
        balanceDue: String(Math.max(0, balanceDue)),
        status,
        updatedAt: new Date(),
      })
      .where(eq(cobInstallments.id, allocation.installmentId))
  }

  await tx
    .update(cobPayments)
    .set({
      status: "reversed",
      reversalReason: reason,
      reversedBy: userId,
      reversedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cobPayments.id, payment.id))

  const [operationBefore] = await tx.select().from(cobOperations).where(eq(cobOperations.id, payment.operationId)).limit(1)
  const balanceBefore = operationBefore ? Number(operationBefore.currentBalance) : 0

  await recalcOperationCache(tx, payment.operationId)

  const [operationAfter] = await tx.select().from(cobOperations).where(eq(cobOperations.id, payment.operationId)).limit(1)

  await logCollectionsEvent(tx, {
    operationId: payment.operationId,
    entityType: "payment",
    entityId: payment.id,
    eventType: "payment_reversed",
    description: `Pago de ${payment.amount} ${payment.currencyCode} anulado: ${reason}`,
    amountDelta: Number(payment.convertedAmount ?? payment.amount),
    balanceBefore,
    balanceAfter: operationAfter ? Number(operationAfter.currentBalance) : balanceBefore,
    performedBy: userId,
  })
  return payment
}

// Edición de un pago ya registrado. Lo que no mueve números (método,
// referencia, banco, observaciones, comprobante) se corrige en el lugar y
// queda en el historial. Lo que sí los mueve (monto, moneda, tipo de cambio,
// fecha, categoría, orden de aplicación) cambia cómo se reparte el pago entre
// cuotas e intereses, así que se resuelve como una corrección: se anula el
// pago original y se registra uno nuevo con los datos corregidos, todo en una
// sola transacción (si algo falla no queda ni anulado ni duplicado). El pago
// original queda en el historial como "Anulado" con su comprobante.
interface UpdatePaymentInput extends Omit<RegisterPaymentInput, "operationId" | "lateFeeCharge"> {
  paymentId: string
}

export async function updatePayment(data: UpdatePaymentInput, formData: FormData): Promise<{ id: string }> {
  const session = await requireManage()
  if (data.amount <= 0) throw new Error("El monto del pago debe ser mayor a cero")

  const [current] = await db.select().from(cobPayments).where(eq(cobPayments.id, data.paymentId)).limit(1)
  if (!current) throw new Error("Pago no encontrado")
  if (current.status !== "confirmed") throw new Error("Un pago anulado no se puede editar")
  if (!current.operationId) throw new Error("El pago no está asociado a una operación")
  const operationId = current.operationId

  const receipt = formData.get("receipt")
  const newReceipt = receipt instanceof File && receipt.size > 0 ? receipt : null
  if (!newReceipt && !current.receiptUrl) {
    throw new Error("Adjuntá la imagen del comprobante de pago")
  }
  const newReceiptUrl = newReceipt ? await saveReceipt(newReceipt) : null
  const receiptUrl = newReceiptUrl ?? current.receiptUrl!

  try {
    const result = await db.transaction(async (tx) => {
      const [operation] = await tx.select().from(cobOperations).where(eq(cobOperations.id, operationId)).limit(1)
      if (!operation) throw new Error("Operación no encontrada")

      const newCurrency = data.currencyCode || operation.currencyCode
      const newRate = newCurrency !== operation.currencyCode ? data.exchangeRate ?? null : null
      const newOrder = data.applicationOrder ?? DEFAULT_APPLICATION_ORDER

      const financialChanged =
        roundToCents(Number(current.amount)) !== roundToCents(data.amount) ||
        current.currencyCode !== newCurrency ||
        (current.exchangeRate != null ? Number(current.exchangeRate) : null) !== newRate ||
        current.paymentDate !== data.paymentDate ||
        current.chargeFutureInterest !== (data.chargeFutureInterest === true) ||
        current.paymentCategory !== (data.paymentCategory ?? current.paymentCategory) ||
        JSON.stringify(current.applicationOrder ?? DEFAULT_APPLICATION_ORDER) !== JSON.stringify(newOrder)

      if (financialChanged) {
        await reversePaymentInTx(tx, current.id, "Corrección: reemplazado por un pago con los datos corregidos", session.userId)
        const newId = await applyPayment(tx, { ...data, operationId, paymentCategory: data.paymentCategory ?? current.paymentCategory }, receiptUrl, session.userId)
        await logCollectionsEvent(tx, {
          operationId,
          entityType: "payment",
          entityId: newId,
          eventType: "payment_corrected",
          description: `Pago corregido: reemplaza al pago de ${current.amount} ${current.currencyCode} del ${current.paymentDate}`,
          metadata: { replacedPaymentId: current.id },
          performedBy: session.userId,
        })
        return { id: newId, replacedReceipt: false }
      }

      const next = {
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber?.trim() || null,
        bankName: data.bankName?.trim() || null,
        observations: data.observations?.trim() || null,
      }
      const labels: Record<keyof typeof next, string> = {
        paymentMethod: "método",
        referenceNumber: "referencia",
        bankName: "banco",
        observations: "observaciones",
      }
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== current[k])
      if (changed.length === 0 && !newReceiptUrl) return { id: current.id, replacedReceipt: false }

      await tx
        .update(cobPayments)
        .set({ ...next, receiptUrl, updatedAt: new Date() })
        .where(eq(cobPayments.id, current.id))

      const changedLabels = [...changed.map((k) => labels[k]), ...(newReceiptUrl ? ["comprobante"] : [])]
      await logCollectionsEvent(tx, {
        operationId,
        entityType: "payment",
        entityId: current.id,
        eventType: "payment_updated",
        description: `Pago editado (${changedLabels.join(", ")})`,
        metadata: {
          before: Object.fromEntries(changed.map((k) => [k, current[k]])),
          after: Object.fromEntries(changed.map((k) => [k, next[k]])),
        },
        performedBy: session.userId,
      })
      return { id: current.id, replacedReceipt: newReceiptUrl != null }
    })

    // El blob viejo se borra recién con la transacción confirmada, y sólo si
    // quedó huérfano (la corrección financiera lo conserva en el pago anulado).
    if (result.replacedReceipt && current.receiptUrl) await deleteReceipt(current.receiptUrl).catch(() => {})
    refresh()
    return { id: result.id }
  } catch (err) {
    if (newReceiptUrl) await deleteReceipt(newReceiptUrl).catch(() => {})
    throw err
  }
}

export async function loadPaymentDetail(paymentId: string) {
  await requireManage()
  return getPaymentDetail(paymentId)
}

// Cancelación de una operación: nunca se borra nada, se marca cancelada
// (§17/§21 del diseño). Las cuotas pendientes/parciales de la versión activa
// pasan a "cancelled" también — las ya pagadas quedan intactas como
// historial. Es deliberadamente más "difícil" que un simple clic: la UI la
// hace pasar por un diálogo de confirmación con motivo obligatorio.
interface UpdateOperationPropertyInput {
  operationId: string
  hasProperty: boolean
  projectId?: string | null
  projectNameSnapshot?: string
  unitLabel?: string
  propertyType?: PropertyType | null
  areaM2?: number | null
}

// Edita el inmueble (proyecto/unidad) asociado a una operación ya creada.
// Cada operación tiene su propio `cob_properties` (nunca se comparte entre
// operaciones — ver createOperation), así que "editar el inmueble" es
// actualizar esa fila en el lugar; si la operación todavía no tenía ninguna,
// se crea una nueva y se vincula. Desmarcar "Asociar un inmueble" sólo
// desvincula (propertyId = null), no borra la fila — mismo criterio no
// destructivo que el resto del módulo (§17/F del diseño).
export async function updateOperationProperty(data: UpdateOperationPropertyInput): Promise<void> {
  const session = await requireManage()

  const [operation] = await db.select({ propertyId: cobOperations.propertyId }).from(cobOperations).where(eq(cobOperations.id, data.operationId)).limit(1)
  if (!operation) throw new Error("Operación no encontrada")

  await db.transaction(async (tx) => {
    if (!data.hasProperty) {
      if (operation.propertyId) {
        await tx.update(cobOperations).set({ propertyId: null, updatedAt: new Date() }).where(eq(cobOperations.id, data.operationId))
        await logCollectionsEvent(tx, {
          operationId: data.operationId,
          entityType: "operation",
          entityId: data.operationId,
          eventType: "operation_property_updated",
          description: "Inmueble desvinculado de la operación",
          performedBy: session.userId,
        })
      }
      return
    }

    const projectNameSnapshot = data.projectNameSnapshot?.trim()
    const unitLabel = data.unitLabel?.trim()
    if (!projectNameSnapshot) throw new Error("El nombre del proyecto es obligatorio")
    if (!unitLabel) throw new Error("La unidad/departamento es obligatoria")

    const propertyValues = {
      projectId: data.projectId || null,
      projectNameSnapshot,
      unitLabel,
      propertyType: data.propertyType || null,
      areaM2: data.areaM2 != null ? String(data.areaM2) : null,
      updatedAt: new Date(),
    }

    if (operation.propertyId) {
      await tx.update(cobProperties).set(propertyValues).where(eq(cobProperties.id, operation.propertyId))
    } else {
      const [property] = await tx
        .insert(cobProperties)
        .values({ origin: "catalog", ...propertyValues, createdBy: session.userId })
        .returning({ id: cobProperties.id })
      await tx.update(cobOperations).set({ propertyId: property.id, updatedAt: new Date() }).where(eq(cobOperations.id, data.operationId))
    }

    await logCollectionsEvent(tx, {
      operationId: data.operationId,
      entityType: "operation",
      entityId: data.operationId,
      eventType: "operation_property_updated",
      description: `Inmueble actualizado: ${projectNameSnapshot} - ${unitLabel}`,
      performedBy: session.userId,
    })
  })

  refresh()
}

export async function cancelOperation(operationId: string, reason: string): Promise<void> {
  const session = await requireManage()
  const cancellationReason = reason.trim()
  if (!cancellationReason) throw new Error("Necesitás indicar un motivo de cancelación")

  await db.transaction(async (tx) => {
    const [operation] = await tx.select().from(cobOperations).where(eq(cobOperations.id, operationId)).limit(1)
    if (!operation) throw new Error("Operación no encontrada")
    if (operation.status !== "active") throw new Error("Sólo se pueden cancelar operaciones activas")

    await tx
      .update(cobOperations)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: session.userId, cancellationReason, updatedAt: new Date() })
      .where(eq(cobOperations.id, operationId))

    const [activeVersion] = await tx
      .select()
      .from(cobPaymentPlanVersions)
      .where(and(eq(cobPaymentPlanVersions.operationId, operationId), eq(cobPaymentPlanVersions.status, "active")))
      .limit(1)

    if (activeVersion) {
      await tx.update(cobPaymentPlanVersions).set({ status: "cancelled" }).where(eq(cobPaymentPlanVersions.id, activeVersion.id))
      await tx
        .update(cobInstallments)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(cobInstallments.planVersionId, activeVersion.id), inArray(cobInstallments.status, ["pending", "partial"])))

      // Las cuotas canceladas no cuentan en el saldo/vencido — recalcular acá
      // evita que la operación quede mostrando un saldo pendiente fantasma.
      await recalcOperationCache(tx, operationId)
    }

    await logCollectionsEvent(tx, {
      operationId,
      entityType: "operation",
      entityId: operationId,
      eventType: "operation_cancelled",
      description: `Operación cancelada: ${cancellationReason}`,
      performedBy: session.userId,
    })
  })

  refresh()
}

// Borrado físico real (a diferencia de cancelOperation) — sólo permitido si
// la operación todavía no tiene ningún pago registrado. Con pagos de por
// medio hay que usar cancelOperation: borrar rompería la trazabilidad que
// pide el diseño (§17/F). Pensado para limpiar operaciones cargadas por
// error, no como alternativa a cancelar.
export async function deleteOperation(operationId: string): Promise<void> {
  const session = await requireManage()

  await db.transaction(async (tx) => {
    const [operation] = await tx.select().from(cobOperations).where(eq(cobOperations.id, operationId)).limit(1)
    if (!operation) throw new Error("Operación no encontrada")

    const [existingPayment] = await tx.select({ id: cobPayments.id }).from(cobPayments).where(eq(cobPayments.operationId, operationId)).limit(1)
    if (existingPayment) throw new Error("No se puede eliminar una operación con pagos registrados — cancelala en su lugar")

    const versions = await tx
      .select({ id: cobPaymentPlanVersions.id })
      .from(cobPaymentPlanVersions)
      .where(eq(cobPaymentPlanVersions.operationId, operationId))
    const versionIds = versions.map((v) => v.id)

    if (versionIds.length > 0) {
      await tx.delete(cobInstallments).where(inArray(cobInstallments.planVersionId, versionIds))
      await tx.delete(cobPlanStages).where(inArray(cobPlanStages.planVersionId, versionIds))
      await tx.delete(cobPaymentPlanVersions).where(eq(cobPaymentPlanVersions.operationId, operationId))
    }

    // El evento queda igual en cob_events con operation_id en NULL (FK
    // onDelete:"set null") — la auditoría de que existió y se borró no
    // desaparece, sólo pierde el vínculo directo a la fila ya eliminada.
    await logCollectionsEvent(tx, {
      operationId,
      entityType: "operation",
      entityId: operationId,
      eventType: "operation_deleted",
      description: "Operación eliminada (no tenía pagos registrados)",
      performedBy: session.userId,
    })

    await tx.delete(cobOperations).where(eq(cobOperations.id, operationId))
  })

  refresh()
}

// Replanteo del plan de pagos de una operación activa: cierra la versión
// vigente (pasa a "superseded") y crea una nueva sobre el capital pendiente
// (§E.3/E.5 del diseño). Es el mecanismo para "el cliente adelanta un pago y
// después se compromete a otra modalidad" — el adelanto se registra antes
// como un pago normal (registerPayment) y acá sólo se resuelve qué pasa con
// el capital que queda: mismas etapas (cash/fixed_installment/french) que al
// crear una operación nueva, reutilizando el mismo StageBuilder de la UI.
interface ReplanOperationInput {
  operationId: string
  effectiveDate: string
  reason: Exclude<PlanVersionReason, "initial">
  notes?: string
  stages: StageInput[]
}

export async function replanOperationPlan(data: ReplanOperationInput): Promise<{ id: string }> {
  const session = await requireManage()
  if (data.stages.length === 0) throw new Error("El nuevo plan necesita al menos una etapa")

  const newVersionId = await db.transaction(async (tx) => {
    const [operation] = await tx.select().from(cobOperations).where(eq(cobOperations.id, data.operationId)).limit(1)
    if (!operation) throw new Error("Operación no encontrada")
    if (operation.status !== "active") throw new Error("Sólo se puede replantear el plan de una operación activa")

    const [activeVersion] = await tx
      .select()
      .from(cobPaymentPlanVersions)
      .where(and(eq(cobPaymentPlanVersions.operationId, data.operationId), eq(cobPaymentPlanVersions.status, "active")))
      .limit(1)
    if (!activeVersion) throw new Error("La operación no tiene un plan de pagos activo")

    const currentInstallments = await tx.select().from(cobInstallments).where(eq(cobInstallments.planVersionId, activeVersion.id))
    const pendingOrPartial = currentInstallments.filter((i) => i.status === "pending" || i.status === "partial")

    // Capital pendiente = lo que todavía no se amortizó de las cuotas no
    // pagadas — mismo cálculo que la cotización de liquidación anticipada
    // (engine/settlement.ts), sin el interés/cargos futuros que no
    // corresponde cobrar todavía.
    const { principal: remainingPrincipal } = calculateSettlementQuote(
      pendingOrPartial.map((i) => ({
        dueDate: i.dueDate,
        status: i.status,
        principalAmount: Number(i.principalAmount),
        interestAmount: Number(i.interestAmount),
        otherChargesAmount: Number(i.otherChargesAmount),
        lateFeeAmount: Number(i.lateFeeAmount),
        paidPrincipal: Number(i.paidPrincipal),
        paidInterest: Number(i.paidInterest),
        paidOther: Number(i.paidOther),
        paidLateFee: Number(i.paidLateFee),
      })),
      data.effectiveDate,
    )
    if (remainingPrincipal <= 0) throw new Error("No queda capital pendiente para replantear")

    await tx
      .update(cobPaymentPlanVersions)
      .set({ status: "superseded", supersededBy: session.userId, supersededAt: new Date() })
      .where(eq(cobPaymentPlanVersions.id, activeVersion.id))
    await tx
      .update(cobInstallments)
      .set({ status: "refinanced", updatedAt: new Date() })
      .where(and(eq(cobInstallments.planVersionId, activeVersion.id), inArray(cobInstallments.status, ["pending", "partial"])))

    const stagesInput: StageScheduleInput[] = data.stages.map((s) => ({
      stageType: s.stageType,
      installmentsCount: s.installmentsCount,
      periodicity: s.periodicity,
      interestRate: s.interestRate,
      rateType: s.rateType,
      flatFeePerInstallment: s.flatFeePerInstallment,
      gracePeriodMonths: s.gracePeriodMonths,
      gracePeriodType: s.gracePeriodType,
      balloonAmount: s.balloonAmount,
      openingBalanceOverride: s.openingBalanceOverride,
      fixedInstallmentAmount: s.fixedInstallmentAmount,
      plannedAdditionalPayments: s.plannedAdditionalPayments,
    }))

    const { perStage } = generatePlanSchedule(stagesInput, remainingPrincipal, data.effectiveDate)

    const [newVersion] = await tx
      .insert(cobPaymentPlanVersions)
      .values({
        operationId: data.operationId,
        versionNumber: activeVersion.versionNumber + 1,
        status: "active",
        reason: data.reason,
        replacesVersionId: activeVersion.id,
        effectiveDate: data.effectiveDate,
        notes: data.notes?.trim() || null,
        createdBy: session.userId,
      })
      .returning({ id: cobPaymentPlanVersions.id })

    let installmentNumber = 1

    for (let i = 0; i < data.stages.length; i++) {
      const stageInput = data.stages[i]
      const stageResult = perStage[i]

      const [stageRow] = await tx
        .insert(cobPlanStages)
        .values({
          planVersionId: newVersion.id,
          sequenceNumber: i + 1,
          stageType: stageInput.stageType,
          installmentsCount: stageInput.stageType === "cash" ? null : stageResult.installments.length,
          periodicity: stageInput.periodicity,
          interestRate: stageInput.interestRate != null ? String(stageInput.interestRate) : null,
          rateType: stageInput.rateType,
          flatFeePerInstallment: String(stageInput.flatFeePerInstallment),
          gracePeriodMonths: stageInput.gracePeriodMonths,
          gracePeriodType: stageInput.gracePeriodType,
          balloonAmount: stageInput.balloonAmount != null ? String(stageInput.balloonAmount) : null,
          openingBalanceOverride: stageInput.openingBalanceOverride != null ? String(stageInput.openingBalanceOverride) : null,
          config: buildStageConfig(stageInput),
          startDate: stageResult.installments[0]?.dueDate ?? data.effectiveDate,
          endDate: stageResult.installments.at(-1)?.dueDate ?? null,
          status: "generated",
          createdBy: session.userId,
        })
        .returning({ id: cobPlanStages.id })

      if (stageResult.installments.length > 0) {
        await tx.insert(cobInstallments).values(
          stageResult.installments.map((draft) => ({
            planVersionId: newVersion.id,
            stageId: stageRow.id,
            installmentNumber: installmentNumber++,
            dueDate: draft.dueDate,
            openingBalance: String(draft.openingBalance),
            principalAmount: String(draft.principalAmount),
            interestAmount: String(draft.interestAmount),
            otherChargesAmount: String(draft.otherChargesAmount),
            totalAmount: String(draft.totalAmount),
            closingBalance: String(draft.closingBalance),
            balanceDue: String(draft.totalAmount),
            engineMetadata: draft.engineMetadata ?? null,
          })),
        )
      }
    }

    await recalcOperationCache(tx, data.operationId)

    await logCollectionsEvent(tx, {
      operationId: data.operationId,
      entityType: "plan_version",
      entityId: newVersion.id,
      eventType: "plan_replanned",
      description: `Plan replanteado (${data.reason}) sobre capital pendiente de ${remainingPrincipal} ${operation.currencyCode}`,
      metadata: { stages: data.stages, remainingPrincipal, replacesVersionId: activeVersion.id },
      performedBy: session.userId,
    })

    return newVersion.id
  })

  refresh()
  return { id: newVersionId }
}

function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Recalcula las columnas caché de la operación a partir de las cuotas de
// TODAS sus versiones de plan (no sólo la activa) — nunca se editan a mano
// (ver docs/cobranzas/DISENO.md C.5). Agregar sobre todas las versiones es
// necesario en cuanto existe más de una (replanteo/refinanciación): los pagos
// ya aplicados a cuotas de una versión superseded siguen contando para
// `totalPaid`, aunque esas cuotas ya no aparezcan como plan vigente.
async function recalcOperationCache(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  operationId: string,
): Promise<void> {
  const versions = await tx
    .select({ id: cobPaymentPlanVersions.id })
    .from(cobPaymentPlanVersions)
    .where(eq(cobPaymentPlanVersions.operationId, operationId))
  const versionIds = versions.map((v) => v.id)

  const installments =
    versionIds.length > 0 ? await tx.select().from(cobInstallments).where(inArray(cobInstallments.planVersionId, versionIds)) : []

  const today = new Date().toISOString().slice(0, 10)
  let currentBalance = 0
  let totalPaid = 0
  let overdueAmount = 0

  for (const inst of installments) {
    if (inst.status === "cancelled" || inst.status === "refinanced") continue
    currentBalance += Number(inst.balanceDue)
    totalPaid += Number(inst.paidAmount)
    if (inst.dueDate < today && (inst.status === "pending" || inst.status === "partial")) {
      overdueAmount += Number(inst.balanceDue)
    }
  }

  await tx
    .update(cobOperations)
    .set({
      currentBalance: String(roundToCents(currentBalance)),
      totalPaid: String(roundToCents(totalPaid)),
      overdueAmount: String(roundToCents(overdueAmount)),
      updatedAt: new Date(),
    })
    .where(eq(cobOperations.id, operationId))
}
