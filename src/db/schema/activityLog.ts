import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

export const activityLog = pgTable("activity_log", {
  id: uuid().defaultRandom().primaryKey(),

  entityType: varchar({ length: 20 }).$type<"task">().notNull(),
  entityId: uuid().notNull(),

  action: varchar({ length: 20 }).$type<"created" | "updated" | "status_changed">().notNull(),
  description: text().notNull(),

  userId: uuid().references(() => users.id).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
})
