import { pgTable, uuid, varchar, text, numeric, smallint, date, timestamp, jsonb, index, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users } from "./user"
import { cobOperations } from "./collectionsOperation"

// Versión de un plan de pagos. Nunca se edita una versión activa para
// refinanciar/recalcular: se crea una versión nueva que reemplaza a la
// anterior (`replacesVersionId`), preservando el historial completo.
export const cobPaymentPlanVersions = pgTable(
  "cob_payment_plan_versions",
  {
    id: uuid().defaultRandom().primaryKey(),

    operationId: uuid()
      .references(() => cobOperations.id)
      .notNull(),

    versionNumber: smallint().notNull(),

    status: varchar({ length: 20 }).$type<"draft" | "active" | "superseded" | "cancelled">().notNull().default("draft"),

    reason: varchar({ length: 30 })
      .$type<"initial" | "refinancing" | "prepayment_recalculation" | "restructuring" | "correction">()
      .notNull()
      .default("initial"),

    replacesVersionId: uuid().references((): AnyPgColumn => cobPaymentPlanVersions.id, { onDelete: "set null" }),

    // Referencia blanda (sin FK física) al pago que disparó esta versión,
    // cuando `reason = 'prepayment_recalculation'`. Evita un ciclo de
    // importación entre este archivo y collectionsPayment.ts; no es crítico
    // para la integridad referencial porque es sólo trazabilidad/auditoría.
    triggeringPaymentId: uuid(),

    effectiveDate: date().notNull(),
    notes: text(),

    createdBy: uuid()
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp().defaultNow().notNull(),

    supersededBy: uuid().references(() => users.id),
    supersededAt: timestamp(),
  },
  (t) => [
    index("cob_payment_plan_versions_operation_idx").on(t.operationId),
    // Refuerza a nivel de DB la regla de negocio "sólo una versión `active`
    // por operación" (antes sólo validada en la capa de servicio, ver
    // docs/cobranzas/DISENO.md C.6).
    uniqueIndex("cob_payment_plan_versions_one_active_idx")
      .on(t.operationId)
      .where(sql`${t.status} = 'active'`),
  ],
)

// Etapa/tramo dentro de una versión de plan. Cada etapa define su propio
// algoritmo (`stageType`) y sus propios parámetros — es lo que permite
// encadenar, por ejemplo, "24 meses sin interés" + "36 meses francés".
export const cobPlanStages = pgTable(
  "cob_plan_stages",
  {
    id: uuid().defaultRandom().primaryKey(),

    planVersionId: uuid()
      .references(() => cobPaymentPlanVersions.id)
      .notNull(),

    sequenceNumber: smallint().notNull(),

    // Selecciona el algoritmo del motor financiero (src/modules/collections/engine).
    stageType: varchar({ length: 30 }).$type<"cash" | "fixed_installment" | "french" | "custom">().notNull(),

    installmentsCount: smallint(),
    periodicity: varchar({ length: 20 })
      .$type<"weekly" | "biweekly" | "monthly" | "quarterly" | "annual">()
      .notNull()
      .default("monthly"),

    interestRate: numeric({ precision: 8, scale: 5 }),
    rateType: varchar({ length: 20 }).$type<"none" | "nominal_annual" | "effective_annual" | "monthly">().notNull().default("none"),

    // Cargo administrativo fijo por cuota, independiente del interés — el 0%
    // de interés no implica necesariamente que todo el pago va a capital.
    flatFeePerInstallment: numeric({ precision: 14, scale: 2 }).notNull().default("0"),

    gracePeriodMonths: smallint().notNull().default(0),
    gracePeriodType: varchar({ length: 20 }).$type<"total" | "interest_only">(),

    balloonAmount: numeric({ precision: 14, scale: 2 }),

    // Si se define, esta etapa arranca con este capital en vez de heredar el
    // saldo final de la etapa anterior. Sirve para representar tramos de
    // capital independientes dentro de una misma operación (ej. un anticipo a
    // 24 cuotas sin interés seguido de un crédito nuevo de otro monto a
    // sistema francés, no la continuación del mismo saldo).
    openingBalanceOverride: numeric({ precision: 14, scale: 2 }),

    // Escape hatch para parámetros específicos de variantes futuras (cuotas
    // variables, reglas custom) sin tener que migrar el esquema.
    config: jsonb(),

    startDate: date(),
    endDate: date(),

    status: varchar({ length: 20 })
      .$type<"pending" | "generated" | "active" | "completed" | "cancelled">()
      .notNull()
      .default("pending"),

    createdBy: uuid()
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("cob_plan_stages_plan_version_idx").on(t.planVersionId)],
)
