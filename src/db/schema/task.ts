import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

export const tasks = pgTable("tasks", {
  id: uuid().defaultRandom().primaryKey(),

  title: varchar({ length: 255 }).notNull(),

  description: text(),

  assignedTo: uuid().references(() => users.id),

  status: varchar({ length: 20 })
    .$type<"todo" | "in_progress" | "done">()
    .notNull()
    .default("todo"),

  priority: varchar({ length: 10 })
    .$type<"low" | "medium" | "high">()
    .notNull()
    .default("medium"),

  dueAt: timestamp(),

  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
})
