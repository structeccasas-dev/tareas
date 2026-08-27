import { and, asc, count, desc, eq, gte, ilike, isNotNull, isNull, lte, not } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { users } from "@/db/schema/user"
import type {
  TaskStatus,
  TaskWithRelations,
  TaskColumn,
  TasksBoard,
  TasksFilters,
  TasksStats,
  UserOption,
} from "@/types/tasks"
import { UNASSIGNED_SENTINEL } from "@/types/tasks"
import { getActivity } from "@/lib/activityLog"
import type { ActivityEntry } from "@/types/activity"
import { getSession } from "@/lib/session"
import type { SessionPayload } from "@/lib/session"
import { ownershipCondition } from "@/lib/permissions"

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"]

function assignedToCondition(assignedTo?: string) {
  if (!assignedTo) return undefined
  if (assignedTo === UNASSIGNED_SENTINEL) return isNull(tasks.assignedTo)
  return eq(tasks.assignedTo, assignedTo)
}

function rowToTask(row: { tasks: typeof tasks.$inferSelect; users: typeof users.$inferSelect | null }): TaskWithRelations {
  const { tasks: t, users: u } = row
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    assignedTo: t.assignedTo,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    assignedUser: u ? { id: u.id, name: u.name } : null,
  }
}

export interface PageOptions extends TasksFilters {
  status: TaskStatus
  limit: number
  page: number
}

export async function getTasksPage(opts: PageOptions): Promise<TaskColumn> {
  const empty: TaskColumn = { tasks: [], total: 0, page: 1, totalPages: 1 }
  try {
    const { status, limit, page, search, assignedTo } = opts
    const s = search?.trim()
    const offset = (Math.max(1, page) - 1) * limit

    const session = await getSession()
    if (!session) return empty

    const whereClause = and(
      eq(tasks.status, status),
      s ? ilike(tasks.title, `%${s}%`) : undefined,
      assignedToCondition(assignedTo),
      ownershipCondition(session, tasks.assignedTo),
    )

    const [rows, [countRow]] = await Promise.all([
      db
        .select()
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedTo, users.id))
        .where(whereClause)
        .orderBy(desc(tasks.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(tasks).where(whereClause),
    ])

    const total = Number(countRow?.value ?? 0)

    return {
      tasks: rows.map(rowToTask),
      total,
      page: Math.max(1, page),
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  } catch {
    return empty
  }
}

// Tareas con vencimiento dentro de un rango de fechas — usado por la vista de
// calendario (día/semana/mes). A diferencia de getTasksPage, no pagina: el
// rango de fechas ya acota el volumen de resultados.
export async function getTasksInRange(from: Date, to: Date, filters: TasksFilters = {}): Promise<TaskWithRelations[]> {
  try {
    const { search, assignedTo } = filters
    const s = search?.trim()

    const session = await getSession()
    if (!session) return []

    const rows = await db
      .select()
      .from(tasks)
      .leftJoin(users, eq(tasks.assignedTo, users.id))
      .where(
        and(
          isNotNull(tasks.dueAt),
          gte(tasks.dueAt, from),
          lte(tasks.dueAt, to),
          s ? ilike(tasks.title, `%${s}%`) : undefined,
          assignedToCondition(assignedTo),
          ownershipCondition(session, tasks.assignedTo),
        ),
      )
      .orderBy(asc(tasks.dueAt))

    return rows.map(rowToTask)
  } catch {
    return []
  }
}

export async function getTasksColumns(opts: { limit: number } & TasksFilters): Promise<TasksBoard> {
  const results = await Promise.all(STATUSES.map((status) => getTasksPage({ status, page: 1, ...opts })))
  return Object.fromEntries(STATUSES.map((status, i) => [status, results[i]])) as TasksBoard
}

export async function getTasksStats(filters: TasksFilters): Promise<TasksStats> {
  const empty: TasksStats = {
    totalTasks: 0,
    createdToday: 0,
    overdue: 0,
    completionRate: 0,
    countsByStatus: { todo: 0, in_progress: 0, done: 0 },
  }

  try {
    const { search, assignedTo } = filters
    const s = search?.trim()
    const now = new Date()

    const session = await getSession()
    if (!session) return empty

    const whereClause = and(
      s ? ilike(tasks.title, `%${s}%`) : undefined,
      assignedToCondition(assignedTo),
      ownershipCondition(session, tasks.assignedTo),
    )

    const rows = await db.select().from(tasks).where(whereClause)

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const countsByStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
    let createdToday = 0
    let overdue = 0
    for (const t of rows) {
      countsByStatus[t.status]++
      if (t.createdAt >= startOfToday) createdToday++
      if (t.status !== "done" && t.dueAt && t.dueAt < now) overdue++
    }

    const total = rows.length
    const completionRate = total > 0 ? Math.round((countsByStatus.done / total) * 1000) / 10 : 0

    return { totalTasks: total, createdToday, overdue, completionRate, countsByStatus }
  } catch {
    return empty
  }
}

export async function getTaskActivity(taskId: string): Promise<ActivityEntry[]> {
  return getActivity("task", taskId)
}

function dueTasksCondition(session: Pick<SessionPayload, "role" | "userId">, endOfToday: Date) {
  return and(isNotNull(tasks.dueAt), lte(tasks.dueAt, endOfToday), not(eq(tasks.status, "done")), ownershipCondition(session, tasks.assignedTo))
}

export interface DueTask {
  id: string
  title: string
  status: TaskStatus
  dueAt: Date
}

// Tareas vencidas o de hoy — lo que un usuario necesita ver sin tener que
// entrar al Kanban a buscarlo. "Vencido" incluye cualquier fecha pasada, no solo hoy.
export async function getDueTasks(limit = 8): Promise<DueTask[]> {
  try {
    const session = await getSession()
    if (!session) return []

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const rows = await db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, dueAt: tasks.dueAt })
      .from(tasks)
      .where(dueTasksCondition(session, endOfToday))
      .orderBy(asc(tasks.dueAt))
      .limit(limit)

    return rows.map((r) => ({ ...r, dueAt: r.dueAt! }))
  } catch {
    return []
  }
}

export async function getDueTasksCount(): Promise<number> {
  try {
    const session = await getSession()
    if (!session) return 0

    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const [row] = await db.select({ value: count() }).from(tasks).where(dueTasksCondition(session, endOfToday))
    return Number(row?.value ?? 0)
  } catch {
    return 0
  }
}

export interface DueTaskForNotification {
  id: string
  title: string
  dueAt: Date
  assignedTo: string
}

// Variante sin scope de sesión, para el cron de notificaciones push: trae las
// tareas vencidas de TODOS los usuarios (no solo el que hace la consulta),
// agrupables por asignado. A diferencia del badge in-app, compara contra el
// instante actual (no el fin del día) porque acá sí importa la hora exacta.
export async function getDueTasksForNotification(): Promise<DueTaskForNotification[]> {
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, assignedTo: tasks.assignedTo })
    .from(tasks)
    .where(and(isNotNull(tasks.dueAt), isNotNull(tasks.assignedTo), lte(tasks.dueAt, new Date()), not(eq(tasks.status, "done"))))
    .orderBy(asc(tasks.dueAt))

  return rows.map((r) => ({ ...r, dueAt: r.dueAt!, assignedTo: r.assignedTo! }))
}

export async function getUserOptions(): Promise<UserOption[]> {
  try {
    return await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name))
  } catch {
    return []
  }
}
