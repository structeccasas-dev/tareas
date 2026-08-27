import { alias } from "drizzle-orm/pg-core"
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, not } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { users } from "@/db/schema/user"
import { taskComments } from "@/db/schema/taskComment"
import type {
  TaskStatus,
  TaskWithRelations,
  TaskColumn,
  TasksBoard,
  TasksFilters,
  TasksStats,
  TimelineEntry,
  UserOption,
} from "@/types/tasks"
import { UNASSIGNED_SENTINEL } from "@/types/tasks"
import { getActivity } from "@/lib/activityLog"
import { getSession } from "@/lib/session"
import type { SessionPayload } from "@/lib/session"
import { ownershipCondition } from "@/lib/permissions"

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"]

const creators = alias(users, "creators")
const assigners = alias(users, "assigners")

function assignedToCondition(assignedTo?: string) {
  if (!assignedTo) return undefined
  if (assignedTo === UNASSIGNED_SENTINEL) return isNull(tasks.assignedTo)
  return eq(tasks.assignedTo, assignedTo)
}

function rowToTask(row: {
  tasks: typeof tasks.$inferSelect
  users: typeof users.$inferSelect | null
  creators: typeof users.$inferSelect | null
  assigners: typeof users.$inferSelect | null
}): TaskWithRelations {
  const { tasks: t, users: u, creators: c, assigners: a } = row
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    category: t.category,
    createdBy: t.createdBy,
    assignedTo: t.assignedTo,
    assignedBy: t.assignedBy,
    status: t.status,
    priority: t.priority,
    startAt: t.startAt,
    dueAt: t.dueAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    assignedUser: u ? { id: u.id, name: u.name } : null,
    createdByUser: c ? { id: c.id, name: c.name } : null,
    assignedByUser: a ? { id: a.id, name: a.name } : null,
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
        .leftJoin(creators, eq(tasks.createdBy, creators.id))
        .leftJoin(assigners, eq(tasks.assignedBy, assigners.id))
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
      .leftJoin(creators, eq(tasks.createdBy, creators.id))
      .leftJoin(assigners, eq(tasks.assignedBy, assigners.id))
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
    countsByStatus: { todo: 0, in_progress: 0, done: 0, cancelled: 0 },
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

    const countsByStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0, cancelled: 0 }
    let createdToday = 0
    let overdue = 0
    for (const t of rows) {
      countsByStatus[t.status]++
      if (t.createdAt >= startOfToday) createdToday++
      if (t.status !== "done" && t.status !== "cancelled" && t.dueAt && t.dueAt < now) overdue++
    }

    const total = rows.length
    const completionRate = total > 0 ? Math.round((countsByStatus.done / total) * 1000) / 10 : 0

    return { totalTasks: total, createdToday, overdue, completionRate, countsByStatus }
  } catch {
    return empty
  }
}

export async function getTaskTimeline(taskId: string): Promise<TimelineEntry[]> {
  const [activity, comments] = await Promise.all([
    getActivity("task", taskId),
    db
      .select({ id: taskComments.id, body: taskComments.body, userName: users.name, createdAt: taskComments.createdAt })
      .from(taskComments)
      .innerJoin(users, eq(taskComments.userId, users.id))
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt)),
  ])

  const entries: TimelineEntry[] = [
    ...activity.map((a): TimelineEntry => ({ id: a.id, type: "activity", description: a.description, userName: a.userName, createdAt: a.createdAt })),
    ...comments.map((c): TimelineEntry => ({ id: c.id, type: "comment", description: c.body, userName: c.userName, createdAt: c.createdAt })),
  ]

  return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}

function dueTasksCondition(session: Pick<SessionPayload, "role" | "userId">, endOfToday: Date) {
  return and(
    isNotNull(tasks.dueAt),
    lte(tasks.dueAt, endOfToday),
    not(inArray(tasks.status, ["done", "cancelled"])),
    ownershipCondition(session, tasks.assignedTo),
  )
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

export interface DueSoonOrOverdueTask {
  id: string
  title: string
  dueAt: Date
  assignedTo: string
}

// Candidatos a notificación "vence pronto" (dentro de las próximas `hoursAhead`
// horas) que todavía no recibieron ese aviso. Sin scope de sesión: el cron
// recorre las tareas de todos los usuarios.
export async function getDueSoonCandidates(hoursAhead = 2): Promise<DueSoonOrOverdueTask[]> {
  const threshold = new Date(Date.now() + hoursAhead * 60 * 60 * 1000)
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, assignedTo: tasks.assignedTo })
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueAt),
        isNotNull(tasks.assignedTo),
        lte(tasks.dueAt, threshold),
        gte(tasks.dueAt, new Date()),
        isNull(tasks.dueSoonNotifiedAt),
        not(inArray(tasks.status, ["done", "cancelled"])),
      ),
    )
    .orderBy(asc(tasks.dueAt))

  return rows.map((r) => ({ ...r, dueAt: r.dueAt!, assignedTo: r.assignedTo! }))
}

// Candidatos a notificación "tarea vencida" que todavía no recibieron ese aviso.
export async function getOverdueCandidates(): Promise<DueSoonOrOverdueTask[]> {
  const rows = await db
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, assignedTo: tasks.assignedTo })
    .from(tasks)
    .where(
      and(
        isNotNull(tasks.dueAt),
        isNotNull(tasks.assignedTo),
        lte(tasks.dueAt, new Date()),
        isNull(tasks.overdueNotifiedAt),
        not(inArray(tasks.status, ["done", "cancelled"])),
      ),
    )
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
