import { pgTable, uuid, varchar, text, numeric, timestamp, jsonb, index } from "drizzle-orm/pg-core"
import { users } from "./user"
import { cobOperations } from "./collectionsOperation"

// Ledger de auditoría propio del módulo (no se reutiliza `activityLog`, que
// está tipado estrictamente a entityType "task"). Nada se borra físicamente
// en cobranzas: toda mutación relevante queda registrada acá.
export const cobEvents = pgTable(
  "cob_events",
  {
    id: uuid().defaultRandom().primaryKey(),

    // Denormalizado: casi todo evento cuelga de una operación y así se puede
    // listar "todo lo que pasó en esta operación" en una sola query.
    operationId: uuid().references(() => cobOperations.id, { onDelete: "set null" }),

    entityType: varchar({ length: 20 }).$type<
      "client" | "operation" | "plan_version" | "stage" | "installment" | "payment" | "late_fee_config"
    >().notNull(),
    entityId: uuid().notNull(),

    // Texto libre (no unión estricta) para no requerir migración cada vez
    // que se agregue un tipo de evento nuevo. Ej: "operation_created",
    // "installments_generated", "payment_registered", "plan_refinanced".
    eventType: varchar({ length: 50 }).notNull(),
    description: text().notNull(),

    amountDelta: numeric({ precision: 14, scale: 2 }),
    balanceBefore: numeric({ precision: 14, scale: 2 }),
    balanceAfter: numeric({ precision: 14, scale: 2 }),

    metadata: jsonb(),

    // Null sólo en eventos generados por cron (ej. recálculo de mora).
    performedBy: uuid().references(() => users.id),
    performedAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    index("cob_events_operation_idx").on(t.operationId),
    index("cob_events_entity_idx").on(t.entityType, t.entityId),
    index("cob_events_performed_at_idx").on(t.performedAt),
  ],
)
