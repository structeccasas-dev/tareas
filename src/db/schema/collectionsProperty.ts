import { pgTable, uuid, varchar, text, numeric, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

// Catálogo de proyectos inmobiliarios. Deliberadamente distinto de la tabla
// `projects` existente (esa es de proyectos de trabajo internos, sin relación
// con inmuebles).
export const cobProjects = pgTable("cob_projects", {
  id: uuid().defaultRandom().primaryKey(),

  name: varchar({ length: 255 }).notNull(),
  description: text(),
  address: text(),
  city: varchar({ length: 100 }),
  country: varchar({ length: 100 }),

  status: varchar({ length: 20 }).$type<"active" | "inactive" | "archived">().notNull().default("active"),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
})

// Inmueble — de catálogo actual o histórico/referencial (`origin`). Una sola
// tabla sirve para ambos casos: evita duplicar el modelo y evita columnas
// "historical_*" sueltas en la operación (ver docs/cobranzas/DISENO.md §4).
export const cobProperties = pgTable("cob_properties", {
  id: uuid().defaultRandom().primaryKey(),

  origin: varchar({ length: 20 }).$type<"catalog" | "historical">().notNull().default("catalog"),

  // Nullable: puede no existir (o no haberse registrado) el proyecto.
  projectId: uuid().references(() => cobProjects.id, { onDelete: "set null" }),
  // Snapshot legible del nombre del proyecto, se llena siempre (incluso con
  // projectId presente) para que el dato quede fijo aunque el proyecto se
  // renombre después.
  projectNameSnapshot: varchar({ length: 255 }).notNull(),

  unitLabel: varchar({ length: 50 }).notNull(),
  propertyType: varchar({ length: 30 }).$type<
    "departamento" | "casa" | "oficina" | "local" | "terreno" | "parqueo" | "otro"
  >(),
  areaM2: numeric({ precision: 8, scale: 2 }),
  floor: varchar({ length: 20 }),
  description: text(),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
})
