export type ClientType = "person" | "company"
export type ClientDocumentType = "ci" | "nit" | "passport" | "other"
export type ClientStatus = "active" | "inactive" | "archived"

export interface Client {
  id: string
  clientType: ClientType
  firstName: string | null
  lastName: string | null
  businessName: string | null
  documentType: ClientDocumentType
  documentNumber: string
  email: string | null
  phone: string | null
  secondaryPhone: string | null
  address: string | null
  city: string | null
  country: string | null
  status: ClientStatus
  notes: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type PropertyOrigin = "catalog" | "historical"
export type PropertyType = "departamento" | "casa" | "oficina" | "local" | "terreno" | "parqueo" | "otro"
export type ProjectStatus = "active" | "inactive" | "archived"

export interface Project {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  country: string | null
  status: ProjectStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface Property {
  id: string
  origin: PropertyOrigin
  projectId: string | null
  projectNameSnapshot: string
  unitLabel: string
  propertyType: PropertyType | null
  areaM2: string | null
  floor: string | null
  description: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type OperationStatus = "active" | "completed" | "refinanced" | "cancelled"
export type OperationSource = "manual" | "imported"

export interface Operation {
  id: string
  sequenceNumber: number
  clientId: string
  propertyId: string | null
  currencyCode: string
  referenceCurrencyCode: string | null
  referenceExchangeRate: string | null
  originalAmount: string
  downPaymentAmount: string
  financedAmount: string
  currentBalance: string
  totalPaid: string
  overdueAmount: string
  status: OperationStatus
  startDate: string
  source: OperationSource
  externalReference: string | null
  notes: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  cancelledAt: Date | null
  cancelledBy: string | null
  cancellationReason: string | null
}

export type PlanVersionStatus = "draft" | "active" | "superseded" | "cancelled"
export type PlanVersionReason = "initial" | "refinancing" | "prepayment_recalculation" | "restructuring" | "correction"

export interface PaymentPlanVersion {
  id: string
  operationId: string
  versionNumber: number
  status: PlanVersionStatus
  reason: PlanVersionReason
  replacesVersionId: string | null
  triggeringPaymentId: string | null
  effectiveDate: string
  notes: string | null
  createdBy: string
  createdAt: Date
  supersededBy: string | null
  supersededAt: Date | null
}

export type StageType = "cash" | "fixed_installment" | "french" | "custom"
export type Periodicity = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual"
export type RateType = "none" | "nominal_annual" | "effective_annual" | "monthly"
export type GracePeriodType = "total" | "interest_only"
export type PlanStageStatus = "pending" | "generated" | "active" | "completed" | "cancelled"

export interface PlanStage {
  id: string
  planVersionId: string
  sequenceNumber: number
  stageType: StageType
  installmentsCount: number | null
  periodicity: Periodicity
  interestRate: string | null
  rateType: RateType
  flatFeePerInstallment: string
  gracePeriodMonths: number
  gracePeriodType: GracePeriodType | null
  balloonAmount: string | null
  openingBalanceOverride: string | null
  config: unknown
  startDate: string | null
  endDate: string | null
  status: PlanStageStatus
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export type InstallmentStatus = "pending" | "partial" | "paid" | "cancelled" | "refinanced"

export interface Installment {
  id: string
  planVersionId: string
  stageId: string
  installmentNumber: number
  dueDate: string
  openingBalance: string
  principalAmount: string
  interestAmount: string
  otherChargesAmount: string
  totalAmount: string
  closingBalance: string
  lateFeeAmount: string
  paidPrincipal: string
  paidInterest: string
  paidOther: string
  paidLateFee: string
  waivedInterest: string
  waivedOther: string
  paidAmount: string
  balanceDue: string
  status: InstallmentStatus
  engineMetadata: unknown
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type PaymentCategory = "regular" | "extraordinary" | "down_payment" | "settlement"
export type PaymentApplicationMode = "auto_order" | "manual"
export type PaymentComponent = "late_fee" | "interest" | "other_charges" | "principal"
export type PaymentMethod = "bank_transfer" | "deposit" | "cash" | "card" | "check" | "other"
export type PaymentStatus = "confirmed" | "reversed" | "cancelled"

export const DEFAULT_APPLICATION_ORDER: PaymentComponent[] = ["late_fee", "interest", "other_charges", "principal"]

export interface Payment {
  id: string
  clientId: string
  operationId: string | null
  paymentCategory: PaymentCategory
  applicationMode: PaymentApplicationMode
  chargeFutureInterest: boolean
  applicationOrder: PaymentComponent[] | null
  amount: string
  currencyCode: string
  exchangeRate: string | null
  convertedAmount: string | null
  paymentMethod: PaymentMethod
  paymentDate: string
  referenceNumber: string | null
  bankName: string | null
  receiptUrl: string | null
  observations: string | null
  status: PaymentStatus
  reversalReason: string | null
  reversedBy: string | null
  reversedAt: Date | null
  registeredBy: string
  createdAt: Date
  updatedAt: Date
}

export interface PaymentWithUsers extends Payment {
  registeredByName: string
  reversedByName: string | null
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  installmentId: string
  allocatedPrincipal: string
  allocatedInterest: string
  allocatedLateFee: string
  allocatedOther: string
  waivedInterest: string
  waivedOther: string
  allocatedAmount: string
  createdAt: Date
}

export interface PaymentAllocationDetail extends PaymentAllocation {
  installmentNumber: number
  installmentDueDate: string
}

export interface PaymentEventDetail {
  id: string
  eventType: string
  description: string
  performedByName: string | null
  performedAt: Date
}

export interface PaymentDetail {
  allocations: PaymentAllocationDetail[]
  events: PaymentEventDetail[]
}

export type LateFeeScope = "global" | "project" | "operation"
export type LateFeeCalculationMethod =
  | "fixed_amount"
  | "percentage_of_installment"
  | "daily_rate_on_balance"
  | "daily_rate_on_overdue_installment"

export interface LateFeeConfiguration {
  id: string
  scope: LateFeeScope
  scopeId: string | null
  graceDays: number
  calculationMethod: LateFeeCalculationMethod
  rateValue: string
  maxCapAmount: string | null
  maxCapPercentage: string | null
  effectiveFrom: string
  effectiveTo: string | null
  createdBy: string
  createdAt: Date
}

export type FinancialEventEntityType =
  | "client"
  | "operation"
  | "plan_version"
  | "stage"
  | "installment"
  | "payment"
  | "late_fee_config"

export interface FinancialEvent {
  id: string
  operationId: string | null
  entityType: FinancialEventEntityType
  entityId: string
  eventType: string
  description: string
  amountDelta: string | null
  balanceBefore: string | null
  balanceAfter: string | null
  metadata: unknown
  performedBy: string | null
  performedAt: Date
}

export interface Currency {
  code: string
  name: string
  symbol: string
  decimalPlaces: number
  active: boolean
}

// --- Formas compuestas para las queries de lectura (data/queries.ts) ---

export interface ClientPage {
  clients: Client[]
  total: number
  page: number
  totalPages: number
}

export interface OperationSummary extends Operation {
  propertyLabel: string | null
}

export interface OperationListItem extends Operation {
  client: Pick<Client, "id" | "clientType" | "firstName" | "lastName" | "businessName">
  property: Pick<Property, "projectNameSnapshot" | "unitLabel"> | null
  // Vencimiento de la cuota pendiente/parcial más próxima (de la versión de
  // plan activa). `null` si no tiene cuotas pendientes (ej. completada).
  nextDueDate: string | null
}

export interface OperationsPage {
  operations: OperationListItem[]
  total: number
  page: number
  totalPages: number
}

export interface ClientDetail {
  client: Client
  operations: OperationSummary[]
  totalBalanceByCurrency: Record<string, string>
  totalPaidByCurrency: Record<string, string>
}

export interface InstallmentWithStage extends Installment {
  stageType: StageType
}

export interface OperationDetail {
  operation: Operation
  client: Client
  property: Property | null
  activePlanVersion: PaymentPlanVersion | null
  planVersions: PaymentPlanVersion[]
  stages: PlanStage[]
  installments: InstallmentWithStage[]
  payments: PaymentWithUsers[]
}

// Los totales del dashboard se agrupan por moneda a propósito: nunca se
// suman USD y BOB entre sí (§18 del diseño).
export interface DashboardCurrencyTotals {
  currencyCode: string
  totalPortfolio: string
  totalCollected: string
  totalPending: string
  totalOverdue: string
  collectedToday: string
  collectedThisMonth: string
  collectedThisYear: string
}

export interface DashboardSummary {
  byCurrency: DashboardCurrencyTotals[]
  overdueOperationsCount: number
  dueTodayCount: number
  dueNext7DaysCount: number
  dueNext30DaysCount: number
}
