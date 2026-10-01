import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"
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
}, (t) => [index("push_subscriptions_user_idx").on(t.userId)])
