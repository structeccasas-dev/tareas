import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

export const tasks = pgTable("tasks", {
  id: uuid().defaultRandom().primaryKey(),

  title: varchar({ length: 255 }).notNull(),

  description: text(),

  category: varchar({ length: 50 }),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),

  assignedTo: uuid().references(() => users.id),

  // Quién hizo la última asignación (puede ser distinto del creador).
  assignedBy: uuid().references(() => users.id),

  status: varchar({ length: 20 })
    .$type<"todo" | "in_progress" | "done" | "cancelled">()
    .notNull()
    .default("todo"),

  priority: varchar({ length: 10 })
    .$type<"low" | "medium" | "high" | "urgent">()
    .notNull()
    .default("medium"),

  startAt: timestamp(),
  dueAt: timestamp(),

  // Marcas para no repetir el aviso de "vence pronto" / "vencida" en cada
  // corrida del cron — se resetean si el usuario cambia dueAt.
  dueSoonNotifiedAt: timestamp(),
  overdueNotifiedAt: timestamp(),

  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
})
