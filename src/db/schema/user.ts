import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),

  name: varchar({ length: 255 }).notNull(),

  email: varchar({ length: 255 }).notNull(),

  passwordHash: varchar({ length: 255 }).notNull().default(""),

  role: varchar({ length: 50 }).$type<"admin" | "agent" | "supervisor">().notNull(),

  active: boolean().default(true).notNull(),

  createdAt: timestamp().defaultNow().notNull(),

  updatedAt: timestamp().defaultNow().notNull(),
})
