import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { tasks } from "./task"
import { users } from "./user"
import { personnel } from "./personnel"

export const notifications = pgTable("notifications", {
  id: uuid().defaultRandom().primaryKey(),

  // Destinatario.
  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  type: varchar({ length: 30 }).$type<
    | "task_assigned"
    | "task_reminder"
    | "task_overdue"
    | "task_comment"
    | "task_notify_creator"
    | "leave_requested"
    | "leave_approved"
    | "leave_rejected"
  >().notNull(),

  title: varchar({ length: 255 }).notNull(),
  body: text(),

  taskId: uuid().references(() => tasks.id, { onDelete: "cascade" }),
  personnelId: uuid().references(() => personnel.id, { onDelete: "cascade" }),

  read: boolean().default(false).notNull(),

  createdAt: timestamp().defaultNow().notNull(),
}, (t) => [
  // Listado de la campanita: últimas N del usuario.
  index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
  // Contador de no leídas.
  index("notifications_user_unread_idx").on(t.userId).where(sql`${t.read} = false`),
  index("notifications_task_idx").on(t.taskId),
])
