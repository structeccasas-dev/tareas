import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core"
import { users } from "./user"

export const teams = pgTable("teams", {
  id: uuid().defaultRandom().primaryKey(),

  name: varchar({ length: 255 }).notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})

export const teamMembers = pgTable("team_members", {
  id: uuid().defaultRandom().primaryKey(),

  teamId: uuid()
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),

  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  createdAt: timestamp().defaultNow().notNull(),
})
