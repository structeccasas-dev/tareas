import { pgTable, uuid, varchar, text, numeric, date, timestamp, serial, index } from "drizzle-orm/pg-core"
import { users } from "./user"
import { cobClients } from "./collectionsClient"
import { cobProperties } from "./collectionsProperty"
import { cobCurrencies } from "./collectionsCurrency"

// Entidad central del módulo: la obligación financiera de un cliente. No
// depende de ninguna "venta" ni de ningún otro sistema.
export const cobOperations = pgTable(
  "cob_operations",
  {
    id: uuid().defaultRandom().primaryKey(),

    // Correlativo autogenerado por Postgres (atómico, sin condiciones de
    // carrera). El código legible "OP-000123" se formatea a partir de esto en
    // la capa de aplicación, ver src/modules/collections/format.ts.
    sequenceNumber: serial().notNull().unique(),

    clientId: uuid()
      .references(() => cobClients.id)
      .notNull(),

    // Opcional: puede no haber ningún inmueble asociado (§4 del diseño).
    propertyId: uuid().references(() => cobProperties.id, { onDelete: "set null" }),

    currencyCode: varchar({ length: 3 })
      .references(() => cobCurrencies.code)
      .notNull(),

    // Puramente informativo: para mostrar en el cronograma el equivalente en
    // otra moneda a un tipo de cambio de referencia fijo (ej. operación en USD
    // pero el cliente paga en Bs al oficial). No participa en el cálculo de
    // saldos — un pago real siempre registra su propio tipo de cambio (§18).
    referenceCurrencyCode: varchar({ length: 3 }).references(() => cobCurrencies.code),
    referenceExchangeRate: numeric({ precision: 10, scale: 4 }),

    originalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    downPaymentAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    financedAmount: numeric({ precision: 14, scale: 2 }).notNull(),

    // Columnas caché: la fuente de verdad son las cuotas/pagos. Se recalculan
    // en la misma transacción que genera cuotas o registra un pago — nunca se
    // editan a mano. Existen sólo para que el listado/dashboard no tenga que
    // agregar sobre todas las cuotas en cada request.
    currentBalance: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    totalPaid: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    overdueAmount: numeric({ precision: 14, scale: 2 }).notNull().default("0"),

    status: varchar({ length: 20 })
      .$type<"active" | "completed" | "refinanced" | "cancelled">()
      .notNull()
      .default("active"),

    startDate: date().notNull(),

    // Preparado para integración futura (§26): de dónde vino la operación.
    source: varchar({ length: 20 }).$type<"manual" | "imported">().notNull().default("manual"),
    externalReference: varchar({ length: 100 }),

    notes: text(),

    createdBy: uuid()
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),

    cancelledAt: timestamp(),
    cancelledBy: uuid().references(() => users.id),
    cancellationReason: text(),
  },
  (t) => [index("cob_operations_client_idx").on(t.clientId), index("cob_operations_status_idx").on(t.status)],
)
