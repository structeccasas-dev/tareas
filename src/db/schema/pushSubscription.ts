import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid().defaultRandom().primaryKey(),

  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  endpoint: text().unique().notNull(),
  p256dh: text().notNull(),
  auth: text().notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})
