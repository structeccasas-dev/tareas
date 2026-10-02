import { pgTable, varchar, smallint, boolean } from "drizzle-orm/pg-core"

// Catálogo de monedas soportadas por el módulo de cobranzas. Se resuelve por
// código (PK natural) en vez de uuid porque es un catálogo chico y estable.
export const cobCurrencies = pgTable("cob_currencies", {
  code: varchar({ length: 3 }).primaryKey(),

  name: varchar({ length: 100 }).notNull(),
  symbol: varchar({ length: 5 }).notNull(),
  decimalPlaces: smallint().notNull().default(2),

  active: boolean().notNull().default(true),
})
