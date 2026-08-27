import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"
import { tasks } from "./task"
import { users } from "./user"

export const taskComments = pgTable("task_comments", {
  id: uuid().defaultRandom().primaryKey(),

  taskId: uuid()
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),

  userId: uuid()
    .references(() => users.id)
    .notNull(),

  body: text().notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})
