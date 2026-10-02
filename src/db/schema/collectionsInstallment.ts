import { pgTable, uuid, varchar, text, numeric, smallint, date, timestamp, jsonb, index } from "drizzle-orm/pg-core"
import { cobPaymentPlanVersions, cobPlanStages } from "./collectionsPlan"

// Cuota — obligación generada por una etapa. Guarda su propio desglose de
// cálculo para que sea auditable sin tener que re-ejecutar el motor.
export const cobInstallments = pgTable(
  "cob_installments",
  {
    id: uuid().defaultRandom().primaryKey(),

    // Denormalizado respecto a stageId para listar cuotas de una operación
    // sin tener que pasar por la etapa en cada query.
    planVersionId: uuid()
      .references(() => cobPaymentPlanVersions.id)
      .notNull(),
    stageId: uuid()
      .references(() => cobPlanStages.id)
      .notNull(),

    installmentNumber: smallint().notNull(),
    dueDate: date().notNull(),

    openingBalance: numeric({ precision: 14, scale: 2 }).notNull(),
    principalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    interestAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    otherChargesAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    closingBalance: numeric({ precision: 14, scale: 2 }).notNull(),

    // Mora acumulada a la fecha, recalculada por el servicio de mora.
    lateFeeAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),

    // A qué componente se aplicó lo pagado — trazabilidad de la imputación.
    paidPrincipal: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    paidInterest: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    paidOther: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    paidLateFee: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    paidAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),

    // total_amount + late_fee_amount - paid_amount, mantenido por el servicio.
    balanceDue: numeric({ precision: 14, scale: 2 }).notNull(),

    // "Vencida" NO es un valor de este status: se deriva de
    // `dueDate < hoy AND status IN ('pending','partial')` (ver engine/lateFees.ts),
    // para que nunca se desincronice de la fecha real.
    status: varchar({ length: 20 })
      .$type<"pending" | "partial" | "paid" | "cancelled" | "refinanced">()
      .notNull()
      .default("pending"),

    // Parámetros de cálculo usados (tasa aplicada, fracción de período,
    // versión de fórmula) — refuerza la auditabilidad del sistema francés.
    engineMetadata: jsonb(),

    notes: text(),

    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    index("cob_installments_plan_version_idx").on(t.planVersionId),
    index("cob_installments_due_date_idx").on(t.dueDate),
    index("cob_installments_status_idx").on(t.status),
  ],
)
