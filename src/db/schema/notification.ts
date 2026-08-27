import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core"
import { tasks } from "./task"
import { users } from "./user"

export const notifications = pgTable("notifications", {
  id: uuid().defaultRandom().primaryKey(),

  // Destinatario.
  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  type: varchar({ length: 30 })
    .$type<"task_assigned" | "task_due_soon" | "task_overdue">()
    .notNull(),

  title: varchar({ length: 255 }).notNull(),
  body: text(),

  taskId: uuid().references(() => tasks.id, { onDelete: "cascade" }),

  read: boolean().default(false).notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})
