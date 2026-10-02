import { pgTable, uuid, integer, timestamp, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
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
}, (t) => [
  index("task_reminders_task_idx").on(t.taskId),
  // Cron de recordatorios: sólo los que todavía no se avisaron.
  index("task_reminders_pending_idx").on(t.taskId).where(sql`${t.notifiedAt} is null`),
])
