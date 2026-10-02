import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { users } from "./user"

// Cliente del módulo de cobranzas — independiente de `users` (staff interno)
// y de `personnel` (empleados). No hay ninguna otra tabla de clientes en el
// sistema todavía; ésta es la fuente de verdad para este módulo.
export const cobClients = pgTable(
  "cob_clients",
  {
    id: uuid().defaultRandom().primaryKey(),

    clientType: varchar({ length: 20 }).$type<"person" | "company">().notNull().default("person"),

    // Persona natural.
    firstName: varchar({ length: 150 }),
    lastName: varchar({ length: 150 }),

    // Empresa.
    businessName: varchar({ length: 255 }),

    documentType: varchar({ length: 30 }).$type<"ci" | "nit" | "passport" | "other">().notNull(),
    documentNumber: varchar({ length: 50 }).notNull(),

    email: varchar({ length: 255 }),
    phone: varchar({ length: 50 }),
    secondaryPhone: varchar({ length: 50 }),
    address: text(),
    city: varchar({ length: 100 }),
    country: varchar({ length: 100 }),

    status: varchar({ length: 20 }).$type<"active" | "inactive" | "archived">().notNull().default("active"),
    notes: text(),

    createdBy: uuid()
      .references(() => users.id)
      .notNull(),

    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cob_clients_document_idx").on(t.documentType, t.documentNumber),
    index("cob_clients_email_idx").on(t.email),
    // GIN + pg_trgm: soporta ilike('%texto%') con wildcard inicial, que un
    // índice btree normal no puede usar. Requiere `CREATE EXTENSION pg_trgm`
    // (agregado a mano en la migración generada).
    index("cob_clients_first_name_trgm_idx").using("gin", sql`${t.firstName} gin_trgm_ops`),
    index("cob_clients_last_name_trgm_idx").using("gin", sql`${t.lastName} gin_trgm_ops`),
    index("cob_clients_business_name_trgm_idx").using("gin", sql`${t.businessName} gin_trgm_ops`),
    index("cob_clients_document_number_trgm_idx").using("gin", sql`${t.documentNumber} gin_trgm_ops`),
  ],
)
