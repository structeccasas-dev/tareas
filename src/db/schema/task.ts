import { pgTable, uuid, varchar, text, integer, timestamp, type AnyPgColumn } from "drizzle-orm/pg-core"
import { users } from "./user"
import { teams } from "./team"
import { projects } from "./project"

export const tasks = pgTable("tasks", {
  id: uuid().defaultRandom().primaryKey(),

  title: varchar({ length: 255 }).notNull(),

  description: text(),

  category: varchar({ length: 50 }),

  // Proyecto al que pertenece — se bloquea borrar un proyecto con tareas en
  // curso, pero al borrarlo igual queda "set null" acá por si tenía tareas
  // finalizadas/canceladas colgando.
  projectId: uuid().references(() => projects.id, { onDelete: "set null" }),

  createdBy: uuid()
    .references(() => users.id)
    .notNull(),

  assignedTo: uuid().references(() => users.id),

  // Asignación grupal — excluyente con assignedTo.
  assignedTeamId: uuid().references(() => teams.id, { onDelete: "set null" }),

  // Quién hizo la última asignación (puede ser distinto del creador).
  assignedBy: uuid().references(() => users.id),

  status: varchar({ length: 20 })
    .$type<"todo" | "in_progress" | "done" | "cancelled">()
    .notNull()
    .default("todo"),

  priority: varchar({ length: 10 })
    .$type<"low" | "medium" | "high" | "urgent">()
    .notNull()
    .default("medium"),

  // Motivo obligatorio al pasar a "cancelled" — se limpia si vuelve a otro estado.
  cancelReason: text(),

  // Recurrencia — null en recurrenceFreq significa "no es una tarea cíclica".
  recurrenceFreq: varchar({ length: 10 }).$type<"daily" | "weekly" | "monthly" | "yearly">(),
  // CSV de días de semana (0=domingo..6=sábado), sólo para "weekly".
  recurrenceWeekdays: varchar({ length: 20 }),
  // Día del mes (1-31), para "monthly"/"yearly".
  recurrenceDayOfMonth: integer(),
  // Mes (1-12), sólo para "yearly".
  recurrenceMonth: integer(),
  // Hora del día "HH:mm" en que vence cada ocurrencia generada.
  recurrenceTime: varchar({ length: 5 }),
  recurrenceEndDate: timestamp(),
  // Encadena la instancia generada con la que le dio origen.
  recurrenceParentId: uuid().references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),

  startAt: timestamp(),
  dueAt: timestamp(),

  // Marca para no repetir el aviso de "vencida" en cada corrida del cron — se
  // resetea si el usuario cambia dueAt. Los avisos previos al vencimiento los
  // maneja la tabla task_reminders.
  overdueNotifiedAt: timestamp(),

  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
})
