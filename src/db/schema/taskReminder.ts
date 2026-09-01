import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core"
import { tasks } from "./task"

export const taskReminders = pgTable("task_reminders", {
  id: uuid().defaultRandom().primaryKey(),

  taskId: uuid()
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),

  // Minutos antes del vencimiento en que se debe avisar. 0 = "en el momento".
  offsetMinutes: integer().notNull(),

  notifiedAt: timestamp(),

  createdAt: timestamp().defaultNow().notNull(),
})
