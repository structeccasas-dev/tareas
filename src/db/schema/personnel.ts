import { pgTable, uuid, varchar, text, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core"
import { users } from "./user"

export const personnel = pgTable("personnel", {
  id: uuid().defaultRandom().primaryKey(),

  fullName: varchar({ length: 255 }).notNull(),

  documentType: varchar({ length: 50 }),
  documentNumber: varchar({ length: 50 }),

  birthDate: date(),
  address: text(),
  phone: varchar({ length: 50 }),
  personalEmail: varchar({ length: 255 }),

  position: varchar({ length: 255 }),
  contractType: varchar({ length: 50 }).$type<"prueba" | "fijo" | "indefinido" | "prestacion_servicios">(),
  startDate: date(),
  probationEndDate: date(),
  salary: numeric({ precision: 12, scale: 2 }),

  bankName: varchar({ length: 255 }),
  bankAccountType: varchar({ length: 50 }),
  bankAccountNumber: varchar({ length: 100 }),

  emergencyContactName: varchar({ length: 255 }),
  emergencyContactPhone: varchar({ length: 50 }),
  emergencyContactRelationship: varchar({ length: 100 }),

  status: varchar({ length: 20 })
    .$type<"invitado" | "datos_completados" | "contrato_subido">()
    .notNull()
    .default("invitado"),

  // Si esta persona ya tiene (o luego recibe) una cuenta de acceso al sistema.
  linkedUserId: uuid().references(() => users.id, { onDelete: "set null" }),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),

  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
})

export const personnelInvitations = pgTable("personnel_invitations", {
  id: uuid().defaultRandom().primaryKey(),

  personnelId: uuid()
    .references(() => personnel.id, { onDelete: "cascade" })
    .notNull(),

  token: varchar({ length: 64 }).notNull().unique(),

  expiresAt: timestamp().notNull(),
  usedAt: timestamp(),

  createdAt: timestamp().defaultNow().notNull(),
})

export const personnelHistory = pgTable("personnel_history", {
  id: uuid().defaultRandom().primaryKey(),

  personnelId: uuid()
    .references(() => personnel.id, { onDelete: "cascade" })
    .notNull(),

  field: varchar({ length: 100 }).notNull(),
  oldValue: text(),
  newValue: text(),

  changedBy: uuid()
    .references(() => users.id)
    .notNull(),

  changedAt: timestamp().defaultNow().notNull(),
})

export const personnelLeaves = pgTable("personnel_leaves", {
  id: uuid().defaultRandom().primaryKey(),

  personnelId: uuid()
    .references(() => personnel.id, { onDelete: "cascade" })
    .notNull(),

  type: varchar({ length: 30 })
    .$type<
      | "vacaciones"
      | "enfermedad"
      | "maternidad"
      | "paternidad"
      | "matrimonio"
      | "duelo"
      | "estudio"
      | "sin_goce_sueldo"
      | "otra"
    >()
    .notNull(),

  startDate: date().notNull(),
  endDate: date().notNull(),
  // Cantidad de días tomados (permite medios días); no siempre coincide con
  // la diferencia de fechas si hay fines de semana/feriados de por medio.
  daysCount: numeric({ precision: 5, scale: 1 }).notNull(),

  // Si este período se descuenta del saldo de vacaciones de la persona.
  countsAsVacation: boolean().notNull().default(false),

  notes: text(),

  // "approved" para lo que carga directamente un admin; "pending" para lo
  // que el propio empleado solicita desde su perfil, hasta que se decide.
  status: varchar({ length: 20 })
    .$type<"pending" | "approved" | "rejected">()
    .notNull()
    .default("approved"),

  decidedBy: uuid().references(() => users.id),
  decidedAt: timestamp(),
  decisionNote: text(),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})

export const personnelDocuments = pgTable("personnel_documents", {
  id: uuid().defaultRandom().primaryKey(),

  personnelId: uuid()
    .references(() => personnel.id, { onDelete: "cascade" })
    .notNull(),

  type: varchar({ length: 20 })
    .$type<"id_front" | "id_back" | "contract" | "other">()
    .notNull(),

  fileName: varchar({ length: 255 }).notNull(),
  storedPath: varchar({ length: 500 }).notNull(),
  mimeType: varchar({ length: 100 }).notNull(),
  size: numeric({ precision: 12, scale: 0 }).notNull(),

  uploadedAt: timestamp().defaultNow().notNull(),
})
