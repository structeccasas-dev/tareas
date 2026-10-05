import { alias } from "drizzle-orm/pg-core"
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, min, or, sum } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema/user"
import { cobClients } from "@/db/schema/collectionsClient"
import { cobProjects, cobProperties } from "@/db/schema/collectionsProperty"
import { cobOperations } from "@/db/schema/collectionsOperation"
import { cobPaymentPlanVersions, cobPlanStages } from "@/db/schema/collectionsPlan"
import { cobInstallments } from "@/db/schema/collectionsInstallment"
import { cobPayments, cobPaymentAllocations } from "@/db/schema/collectionsPayment"
import { cobEvents } from "@/db/schema/collectionsEvent"
import { cobCurrencies } from "@/db/schema/collectionsCurrency"
import type {
  Client,
  ClientDetail,
  ClientPage,
  Currency,
  DashboardCurrencyTotals,
  DashboardSummary,
  Installment,
  Operation,
  OperationDetail,
  OperationListItem,
  OperationsPage,
  OperationSummary,
  PaymentAllocationDetail,
  PaymentDetail,
  PaymentWithUsers,
  Project,
  Property,
} from "@/types/collections"

const registeredByUsers = alias(users, "cob_payments_registered_by")
const reversedByUsers = alias(users, "cob_payments_reversed_by")

const PAGE_LIMIT = 20
// Más chico que PAGE_LIMIT a propósito: esta lista vive en el dashboard,
// arriba de los KPIs — una página larga empujaría todo lo demás fuera de
// vista en mobile.
const OPERATIONS_PAGE_LIMIT = 10

export async function getClientsList(opts: { page: number; search?: string }): Promise<ClientPage> {
  const page = Math.max(1, opts.page)
  const s = opts.search?.trim()
  const offset = (page - 1) * PAGE_LIMIT
  const whereClause = s
    ? or(
        ilike(cobClients.firstName, `%${s}%`),
        ilike(cobClients.lastName, `%${s}%`),
        ilike(cobClients.businessName, `%${s}%`),
        ilike(cobClients.documentNumber, `%${s}%`),
      )
    : undefined

  const [rows, total] = await Promise.all([
    db.select().from(cobClients).where(whereClause).orderBy(desc(cobClients.createdAt)).limit(PAGE_LIMIT).offset(offset),
    db.$count(cobClients, whereClause),
  ])

  return {
    clients: rows as Client[],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)),
  }
}

// Condición de filtro común a toda vista que liste/agregue operaciones:
// nombre/documento del cliente o proyecto/unidad del inmueble asociado (si
// `search` es puramente numérico, también matchea el número de operación),
// más un filtro opcional por proyecto del catálogo. Requiere que la query
// haya joineado cobClients y cobProperties (leftJoin, el inmueble es
// opcional) sobre cobOperations. Se comparte entre getOperationsList y
// getDashboardSummary para que el buscador y los KPIs siempre respondan al
// mismo filtro.
//
// El filtro por proyecto matchea por `projectId` (FK) O por nombre exacto
// (case-insensitive): hay inmuebles "históricos" (docs/cobranzas/DISENO.md
// Caso 4) cargados sólo con el nombre como texto libre, sin vincular al
// catálogo — si no se los incluye acá, elegir un proyecto del dropdown deja
// afuera operaciones que en los hechos son del mismo proyecto.
async function operationFilterClause(search: string | undefined, projectId: string | undefined) {
  const s = search?.trim()
  const numericSearch = s && /^\d+$/.test(s) ? Number(s) : null
  const searchClause = s
    ? or(
        ilike(cobClients.firstName, `%${s}%`),
        ilike(cobClients.lastName, `%${s}%`),
        ilike(cobClients.businessName, `%${s}%`),
        ilike(cobClients.documentNumber, `%${s}%`),
        ilike(cobProperties.projectNameSnapshot, `%${s}%`),
        ilike(cobProperties.unitLabel, `%${s}%`),
        numericSearch != null ? eq(cobOperations.sequenceNumber, numericSearch) : undefined,
      )
    : undefined

  let projectClause = undefined
  if (projectId) {
    const [project] = await db.select({ name: cobProjects.name }).from(cobProjects).where(eq(cobProjects.id, projectId)).limit(1)
    projectClause = or(eq(cobProperties.projectId, projectId), project ? ilike(cobProperties.projectNameSnapshot, project.name) : undefined)
  }

  return and(searchClause, projectClause)
}

// Listado de todas las operaciones (préstamos) con el nombre del cliente ya
// resuelto — pensado para el dashboard de cobranzas, donde se quiere ver
// todo sin tener que entrar cliente por cliente. Busca por nombre/documento
// del cliente, proyecto/departamento del inmueble asociado, y si la búsqueda
// es puramente numérica también matchea contra el número de operación (ej.
// buscar "123" encuentra OP-000123). `projectId` filtra exacto por proyecto
// del catálogo (además del match de texto libre en `search`).
//
// Siempre paginado con LIMIT/OFFSET a nivel de query — nunca traer todas las
// operaciones a memoria, la tabla puede crecer indefinidamente.
export async function getOperationsList(opts: { page: number; search?: string; projectId?: string }): Promise<OperationsPage> {
  const page = Math.max(1, opts.page)
  const offset = (page - 1) * OPERATIONS_PAGE_LIMIT
  const whereClause = await operationFilterClause(opts.search, opts.projectId)

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({ operation: cobOperations, client: cobClients, property: cobProperties })
      .from(cobOperations)
      .innerJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
      .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
      .where(whereClause)
      .orderBy(desc(cobOperations.createdAt))
      .limit(OPERATIONS_PAGE_LIMIT)
      .offset(offset),
    db
      .select({ value: count() })
      .from(cobOperations)
      .innerJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
      .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
      .where(whereClause),
  ])

  const operationIds = rows.map((r) => r.operation.id)
  const nextDueDateRows = operationIds.length
    ? await db
        .select({ operationId: cobPaymentPlanVersions.operationId, nextDueDate: min(cobInstallments.dueDate) })
        .from(cobInstallments)
        .innerJoin(cobPaymentPlanVersions, eq(cobInstallments.planVersionId, cobPaymentPlanVersions.id))
        .where(
          and(
            inArray(cobPaymentPlanVersions.operationId, operationIds),
            eq(cobPaymentPlanVersions.status, "active"),
            inArray(cobInstallments.status, ["pending", "partial"]),
          ),
        )
        .groupBy(cobPaymentPlanVersions.operationId)
    : []

  const operations: OperationListItem[] = rows.map((r) => ({
    ...(r.operation as Operation),
    client: r.client as Client,
    property: r.property ? { projectNameSnapshot: r.property.projectNameSnapshot, unitLabel: r.property.unitLabel } : null,
    nextDueDate: nextDueDateRows.find((n) => n.operationId === r.operation.id)?.nextDueDate ?? null,
  }))
  const total = totalRow?.value ?? 0

  return { operations, total, page, totalPages: Math.max(1, Math.ceil(total / OPERATIONS_PAGE_LIMIT)) }
}

// Lista completa (sin paginar) de clientes activos, para selects — ej. el
// cotizador, que necesita elegir un cliente ya registrado sin pasar por la
// paginación de getClientsList.
export async function getActiveClientsForSelect(): Promise<Client[]> {
  return (await db
    .select()
    .from(cobClients)
    .where(eq(cobClients.status, "active"))
    .orderBy(asc(cobClients.firstName), asc(cobClients.businessName))) as Client[]
}

export async function getClientById(id: string): Promise<Client | null> {
  const [row] = await db.select().from(cobClients).where(eq(cobClients.id, id)).limit(1)
  return (row as Client) ?? null
}

export async function searchClientsForSelect(query: string): Promise<Client[]> {
  const s = query.trim()
  const whereClause = s
    ? or(ilike(cobClients.firstName, `%${s}%`), ilike(cobClients.lastName, `%${s}%`), ilike(cobClients.businessName, `%${s}%`), ilike(cobClients.documentNumber, `%${s}%`))
    : undefined
  const rows = await db.select().from(cobClients).where(whereClause).orderBy(asc(cobClients.firstName)).limit(20)
  return rows as Client[]
}

export async function getClientDetail(clientId: string): Promise<ClientDetail | null> {
  const client = await getClientById(clientId)
  if (!client) return null

  const operationRows = await db
    .select({
      operation: cobOperations,
      propertyUnitLabel: cobProperties.unitLabel,
      propertyProjectName: cobProperties.projectNameSnapshot,
    })
    .from(cobOperations)
    .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
    .where(eq(cobOperations.clientId, clientId))
    .orderBy(desc(cobOperations.createdAt))

  const operations: OperationSummary[] = operationRows.map((r) => ({
    ...(r.operation as Operation),
    propertyLabel: r.propertyUnitLabel ? `${r.propertyProjectName} - ${r.propertyUnitLabel}` : null,
  }))

  const totalBalanceByCurrency: Record<string, string> = {}
  const totalPaidByCurrency: Record<string, string> = {}
  for (const op of operations) {
    if (op.status === "cancelled") continue
    totalBalanceByCurrency[op.currencyCode] = String(
      Number(totalBalanceByCurrency[op.currencyCode] ?? "0") + Number(op.currentBalance),
    )
    totalPaidByCurrency[op.currencyCode] = String(Number(totalPaidByCurrency[op.currencyCode] ?? "0") + Number(op.totalPaid))
  }

  return { client, operations, totalBalanceByCurrency, totalPaidByCurrency }
}

export async function getOperationDetail(operationId: string): Promise<OperationDetail | null> {
  const [row] = await db
    .select({ operation: cobOperations, client: cobClients, property: cobProperties })
    .from(cobOperations)
    .innerJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
    .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
    .where(eq(cobOperations.id, operationId))
    .limit(1)

  if (!row) return null

  const planVersions = await db
    .select()
    .from(cobPaymentPlanVersions)
    .where(eq(cobPaymentPlanVersions.operationId, operationId))
    .orderBy(desc(cobPaymentPlanVersions.versionNumber))

  // Para mostrar cuotas: la versión activa si existe: si la operación está
  // cancelada/completada ya no hay ninguna "active", pero igual se muestra
  // la última versión (por versionNumber) para no perder de vista el
  // historial — nada se borra, así que nada debería desaparecer de la UI.
  const activePlanVersion = planVersions.find((v) => v.status === "active") ?? planVersions[0] ?? null

  const stages = activePlanVersion
    ? await db.select().from(cobPlanStages).where(eq(cobPlanStages.planVersionId, activePlanVersion.id)).orderBy(asc(cobPlanStages.sequenceNumber))
    : []

  const installmentRows = activePlanVersion
    ? await db
        .select({ installment: cobInstallments, stageType: cobPlanStages.stageType })
        .from(cobInstallments)
        .innerJoin(cobPlanStages, eq(cobInstallments.stageId, cobPlanStages.id))
        .where(eq(cobInstallments.planVersionId, activePlanVersion.id))
        .orderBy(asc(cobInstallments.installmentNumber))
    : []

  const paymentRows = await db
    .select({
      payment: cobPayments,
      registeredByName: registeredByUsers.name,
      reversedByName: reversedByUsers.name,
    })
    .from(cobPayments)
    .innerJoin(registeredByUsers, eq(cobPayments.registeredBy, registeredByUsers.id))
    .leftJoin(reversedByUsers, eq(cobPayments.reversedBy, reversedByUsers.id))
    .where(eq(cobPayments.operationId, operationId))
    .orderBy(desc(cobPayments.paymentDate))

  return {
    operation: row.operation as Operation,
    client: row.client as Client,
    property: (row.property as Property) ?? null,
    activePlanVersion,
    planVersions,
    stages,
    installments: installmentRows.map((r) => ({ ...(r.installment as Installment), stageType: r.stageType })),
    payments: paymentRows.map((r) => ({
      ...(r.payment as unknown as PaymentWithUsers),
      registeredByName: r.registeredByName,
      reversedByName: r.reversedByName,
    })),
  }
}

export async function getProjectsList(): Promise<Project[]> {
  return (await db.select().from(cobProjects).where(eq(cobProjects.status, "active")).orderBy(asc(cobProjects.name))) as Project[]
}

// Incluye proyectos archivados/inactivos — para la pantalla de gestión de
// proyectos (a diferencia de getProjectsList, que sólo trae los que se
// pueden vincular a una operación nueva).
export async function getAllProjects(): Promise<Project[]> {
  return (await db.select().from(cobProjects).orderBy(asc(cobProjects.name))) as Project[]
}

export async function searchProperties(query: string): Promise<Property[]> {
  const s = query.trim()
  const whereClause = s ? or(ilike(cobProperties.unitLabel, `%${s}%`), ilike(cobProperties.projectNameSnapshot, `%${s}%`)) : undefined
  const rows = await db.select().from(cobProperties).where(whereClause).orderBy(desc(cobProperties.createdAt)).limit(20)
  return rows as Property[]
}

export async function getCurrencies(): Promise<Currency[]> {
  return (await db.select().from(cobCurrencies).where(eq(cobCurrencies.active, true)).orderBy(asc(cobCurrencies.code))) as Currency[]
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function monthStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function yearStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

// KPIs del dashboard. `search`/`projectId` son el mismo filtro que aplica el
// buscador y el dropdown de proyecto del listado (ver operationFilterClause)
// — así los totales/contadores siempre reflejan lo que se está viendo en la
// tabla de abajo, no la cartera completa. Todo sigue siendo agregación SQL
// (sum/count), nunca se traen filas de operaciones/cuotas/pagos a memoria.
export async function getDashboardSummary(opts: { search?: string; projectId?: string } = {}): Promise<DashboardSummary> {
  const today = todayIso()
  const filterClause = await operationFilterClause(opts.search, opts.projectId)

  const operationTotals = await db
    .select({
      currencyCode: cobOperations.currencyCode,
      financedAmount: sum(cobOperations.financedAmount),
      currentBalance: sum(cobOperations.currentBalance),
      totalPaid: sum(cobOperations.totalPaid),
      overdueAmount: sum(cobOperations.overdueAmount),
    })
    .from(cobOperations)
    .innerJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
    .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
    .where(and(inArray(cobOperations.status, ["active", "completed"]), filterClause))
    .groupBy(cobOperations.currencyCode)

  // Pagos: se llega a cliente/inmueble a través de la operación del pago
  // (leftJoin porque un pago puede no estar atado a ninguna operación —
  // en ese caso sólo lo excluye el filtro si hay search/projectId activo).
  function paymentTotalsQuery(extraWhere: ReturnType<typeof eq> | ReturnType<typeof gte>) {
    return db
      .select({ currencyCode: cobPayments.currencyCode, total: sum(cobPayments.amount) })
      .from(cobPayments)
      .leftJoin(cobOperations, eq(cobPayments.operationId, cobOperations.id))
      .leftJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
      .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
      .where(and(eq(cobPayments.status, "confirmed"), extraWhere, filterClause))
      .groupBy(cobPayments.currencyCode)
  }

  const [paymentTotals, paymentTotalsMonth, paymentTotalsYear] = await Promise.all([
    paymentTotalsQuery(eq(cobPayments.paymentDate, today)),
    paymentTotalsQuery(gte(cobPayments.paymentDate, monthStartIso())),
    paymentTotalsQuery(gte(cobPayments.paymentDate, yearStartIso())),
  ])

  const byCurrency: DashboardCurrencyTotals[] = operationTotals.map((op) => ({
    currencyCode: op.currencyCode,
    totalPortfolio: op.financedAmount ?? "0",
    totalCollected: op.totalPaid ?? "0",
    totalPending: op.currentBalance ?? "0",
    totalOverdue: op.overdueAmount ?? "0",
    collectedToday: paymentTotals.find((p) => p.currencyCode === op.currencyCode)?.total ?? "0",
    collectedThisMonth: paymentTotalsMonth.find((p) => p.currencyCode === op.currencyCode)?.total ?? "0",
    collectedThisYear: paymentTotalsYear.find((p) => p.currencyCode === op.currencyCode)?.total ?? "0",
  }))

  const [overdueRow] = await db
    .select({ value: count() })
    .from(cobOperations)
    .innerJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
    .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
    .where(and(eq(cobOperations.status, "active"), gte(cobOperations.overdueAmount, "0.01"), filterClause))
  const overdueOperationsCount = overdueRow?.value ?? 0

  // Cuotas: se llega a cliente/inmueble a través de operación <- versión de
  // plan <- cuota (todas las relaciones intermedias son NOT NULL).
  function dueInstallmentsCountQuery(untilDate?: string) {
    return db
      .select({ value: count() })
      .from(cobInstallments)
      .innerJoin(cobPaymentPlanVersions, eq(cobInstallments.planVersionId, cobPaymentPlanVersions.id))
      .innerJoin(cobOperations, eq(cobPaymentPlanVersions.operationId, cobOperations.id))
      .innerJoin(cobClients, eq(cobOperations.clientId, cobClients.id))
      .leftJoin(cobProperties, eq(cobOperations.propertyId, cobProperties.id))
      .where(
        and(
          inArray(cobInstallments.status, ["pending", "partial"]),
          untilDate ? gte(cobInstallments.dueDate, today) : eq(cobInstallments.dueDate, today),
          untilDate ? lte(cobInstallments.dueDate, untilDate) : undefined,
          filterClause,
        ),
      )
  }

  const [[dueTodayRow], [dueNext7Row], [dueNext30Row]] = await Promise.all([
    dueInstallmentsCountQuery(),
    dueInstallmentsCountQuery(daysFromToday(7)),
    dueInstallmentsCountQuery(daysFromToday(30)),
  ])

  return {
    byCurrency,
    overdueOperationsCount,
    dueTodayCount: dueTodayRow?.value ?? 0,
    dueNext7DaysCount: dueNext7Row?.value ?? 0,
    dueNext30DaysCount: dueNext30Row?.value ?? 0,
  }
}

// Versión liviana para el badge del menú lateral — evita calcular el
// dashboard completo en cada carga de página.
export async function getOverdueOperationsCount(): Promise<number> {
  return db.$count(cobOperations, and(eq(cobOperations.status, "active"), gte(cobOperations.overdueAmount, "0.01")))
}

// Detalle de un pago: cómo se repartió entre cuotas y qué le pasó (alta,
// ediciones, anulación). Se carga bajo demanda al abrir el detalle en vez de
// traerlo para todos los pagos de la operación.
export async function getPaymentDetail(paymentId: string): Promise<PaymentDetail> {
  const allocationRows = await db
    .select({
      allocation: cobPaymentAllocations,
      installmentNumber: cobInstallments.installmentNumber,
      installmentDueDate: cobInstallments.dueDate,
    })
    .from(cobPaymentAllocations)
    .innerJoin(cobInstallments, eq(cobPaymentAllocations.installmentId, cobInstallments.id))
    .where(eq(cobPaymentAllocations.paymentId, paymentId))
    .orderBy(asc(cobInstallments.installmentNumber))

  const eventRows = await db
    .select({
      id: cobEvents.id,
      eventType: cobEvents.eventType,
      description: cobEvents.description,
      performedAt: cobEvents.performedAt,
      performedByName: users.name,
    })
    .from(cobEvents)
    .leftJoin(users, eq(cobEvents.performedBy, users.id))
    .where(and(eq(cobEvents.entityType, "payment"), eq(cobEvents.entityId, paymentId)))
    .orderBy(asc(cobEvents.performedAt))

  return {
    allocations: allocationRows.map(
      (r) => ({ ...r.allocation, installmentNumber: r.installmentNumber, installmentDueDate: r.installmentDueDate }) as PaymentAllocationDetail,
    ),
    events: eventRows,
  }
}
