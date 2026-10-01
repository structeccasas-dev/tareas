import { pgTable, uuid, varchar, text, numeric, date, timestamp, jsonb, index } from "drizzle-orm/pg-core"
import { users } from "./user"
import { cobClients } from "./collectionsClient"
import { cobOperations } from "./collectionsOperation"
import { cobCurrencies } from "./collectionsCurrency"
import { cobInstallments } from "./collectionsInstallment"

// Pago recibido. Se distingue explícitamente de una cuota (obligación): una
// cuota es lo que se debe, un pago es dinero efectivamente recibido.
export const cobPayments = pgTable(
  "cob_payments",
  {
    id: uuid().defaultRandom().primaryKey(),

    clientId: uuid()
      .references(() => cobClients.id)
      .notNull(),

    // Denormalizado para el caso común (pago de una sola operación). La fuente
    // de verdad de a qué cuotas se aplicó es cobPaymentAllocations.
    operationId: uuid().references(() => cobOperations.id, { onDelete: "set null" }),

    paymentCategory: varchar({ length: 20 })
      .$type<"regular" | "extraordinary" | "down_payment" | "settlement">()
      .notNull()
      .default("regular"),

    // Cómo el usuario eligió distribuir este pago entre los componentes de
    // cada cuota (§10/§20 del diseño) — nunca es un orden fijo del sistema.
    applicationMode: varchar({ length: 20 }).$type<"auto_order" | "manual">().notNull().default("auto_order"),
    // Sólo si applicationMode = 'auto_order'. Ej: ["late_fee","interest","other_charges","principal"].
    applicationOrder: jsonb().$type<Array<"late_fee" | "interest" | "other_charges" | "principal">>(),

    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    currencyCode: varchar({ length: 3 })
      .references(() => cobCurrencies.code)
      .notNull(),

    // Sólo si currencyCode difiere de la moneda de la operación (§18): nunca
    // se convierte moneda implícitamente.
    exchangeRate: numeric({ precision: 10, scale: 4 }),
    convertedAmount: numeric({ precision: 14, scale: 2 }),

    paymentMethod: varchar({ length: 20 })
      .$type<"bank_transfer" | "deposit" | "cash" | "card" | "check" | "other">()
      .notNull(),
    paymentDate: date().notNull(),

    referenceNumber: varchar({ length: 100 }),
    bankName: varchar({ length: 100 }),
    receiptUrl: varchar({ length: 500 }),
    observations: text(),

    status: varchar({ length: 20 }).$type<"confirmed" | "reversed" | "cancelled">().notNull().default("confirmed"),
    reversalReason: text(),
    reversedBy: uuid().references(() => users.id),
    reversedAt: timestamp(),

    registeredBy: uuid()
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    index("cob_payments_client_idx").on(t.clientId),
    index("cob_payments_operation_idx").on(t.operationId),
    index("cob_payments_payment_date_idx").on(t.paymentDate),
    index("cob_payments_status_idx").on(t.status),
  ],
)

// Distribuye un pago entre una o más cuotas — permite que un pago cubra
// varias cuotas y que una cuota reciba aportes de varios pagos.
export const cobPaymentAllocations = pgTable(
  "cob_payment_allocations",
  {
    id: uuid().defaultRandom().primaryKey(),

    paymentId: uuid()
      .references(() => cobPayments.id)
      .notNull(),
    installmentId: uuid()
      .references(() => cobInstallments.id)
      .notNull(),

    allocatedPrincipal: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    allocatedInterest: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    allocatedLateFee: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    allocatedOther: numeric({ precision: 14, scale: 2 }).notNull().default("0"),
    allocatedAmount: numeric({ precision: 14, scale: 2 }).notNull(),

    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [index("cob_payment_allocations_payment_idx").on(t.paymentId), index("cob_payment_allocations_installment_idx").on(t.installmentId)],
)
