import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core"

export const projects = pgTable("projects", {
  id: uuid().defaultRandom().primaryKey(),

  name: varchar({ length: 255 }).notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})
