import { pgTable, uuid, varchar, numeric, smallint, date, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

// Configuración de mora, con jerarquía de alcance (operación > proyecto >
// global) e historial de vigencias: nunca se edita una fila existente para
// cambiar una tasa, se cierra (effectiveTo) y se crea una nueva.
export const cobLateFeeConfigurations = pgTable("cob_late_fee_configurations", {
  id: uuid().defaultRandom().primaryKey(),

  scope: varchar({ length: 20 }).$type<"global" | "project" | "operation">().notNull(),
  // Id de cob_projects o cob_operations según `scope`; null si scope='global'.
  // Sin FK física porque es polimórfico (ver docs/cobranzas/DISENO.md C.11).
  scopeId: uuid(),

  graceDays: smallint().notNull().default(0),

  calculationMethod: varchar({ length: 30 })
    .$type<"fixed_amount" | "percentage_of_installment" | "daily_rate_on_balance" | "daily_rate_on_overdue_installment">()
    .notNull(),
  rateValue: numeric({ precision: 10, scale: 5 }).notNull(),

  maxCapAmount: numeric({ precision: 14, scale: 2 }),
  maxCapPercentage: numeric({ precision: 6, scale: 3 }),

  effectiveFrom: date().notNull(),
  effectiveTo: date(),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp().defaultNow().notNull(),
})
