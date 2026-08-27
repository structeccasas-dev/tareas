import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { users } from "@/db/schema/user"
import type { TaskStatus } from "@/types/tasks"
import type {
  ActivityItem,
  MemberOverview,
  DailyPoint,
  DashboardMetrics,
  DashboardRange,
  TaskStatusPoint,
} from "@/types/dashboard"

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"]
const ACTIVE_TASK_STATUSES: TaskStatus[] = ["todo", "in_progress"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDayBuckets(range: DashboardRange): string[] {
  const days: string[] = []
  const cursor = new Date(range.from)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(range.to)
  end.setHours(0, 0, 0, 0)
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function formatShortDay(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
}

function fillDayBuckets(range: DashboardRange, rows: { day: string; value: number }[]): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day, Number(r.value)]))
  return buildDayBuckets(range).map((day) => ({ date: formatShortDay(day), count: byDay.get(day) ?? 0 }))
}

// ── Tarjetas ──────────────────────────────────────────────────────────────────

export async function getDashboardMetrics(range: DashboardRange): Promise<DashboardMetrics> {
  try {
    const [statusRows, [createdRow], [completedRow], [overdueRow]] = await Promise.all([
      db.select({ status: tasks.status, value: count() }).from(tasks).groupBy(tasks.status),
      db
        .select({ value: count() })
        .from(tasks)
        .where(and(gte(tasks.createdAt, range.from), lte(tasks.createdAt, range.to))),
      db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.status, "done"), gte(tasks.updatedAt, range.from), lte(tasks.updatedAt, range.to))),
      db
        .select({ value: count() })
        .from(tasks)
        .where(and(sql`${tasks.dueAt} is not null`, lte(tasks.dueAt, new Date()), sql`${tasks.status} != 'done'`)),
    ])

    const countByStatus = new Map(statusRows.map((r) => [r.status, Number(r.value)]))

    return {
      totalTasks: statusRows.reduce((sum, r) => sum + Number(r.value), 0),
      todoTasks: countByStatus.get("todo") ?? 0,
      inProgressTasks: countByStatus.get("in_progress") ?? 0,
      doneTasks: countByStatus.get("done") ?? 0,
      overdueTasks: Number(overdueRow?.value ?? 0),
      createdInRange: Number(createdRow?.value ?? 0),
      completedInRange: Number(completedRow?.value ?? 0),
    }
  } catch {
    return {
      totalTasks: 0,
      todoTasks: 0,
      inProgressTasks: 0,
      doneTasks: 0,
      overdueTasks: 0,
      createdInRange: 0,
      completedInRange: 0,
    }
  }
}

// ── Gráficos ──────────────────────────────────────────────────────────────────

export async function getTasksByDay(range: DashboardRange): Promise<DailyPoint[]> {
  try {
    const dayExpr = sql<string>`to_char(date_trunc('day', ${tasks.createdAt}), 'YYYY-MM-DD')`
    const rows = await db
      .select({ day: dayExpr, value: count() })
      .from(tasks)
      .where(and(gte(tasks.createdAt, range.from), lte(tasks.createdAt, range.to)))
      .groupBy(dayExpr)
    return fillDayBuckets(range, rows)
  } catch {
    return []
  }
}

export async function getTasksByStatusDistribution(): Promise<TaskStatusPoint[]> {
  try {
    const rows = await db.select({ status: tasks.status, value: count() }).from(tasks).groupBy(tasks.status)
    const byStatus = new Map(rows.map((r) => [r.status, Number(r.value)]))
    return TASK_STATUSES.map((status) => ({ status, count: byStatus.get(status) ?? 0 }))
  } catch {
    return TASK_STATUSES.map((status) => ({ status, count: 0 }))
  }
}

export async function getTasksByMember(): Promise<{ userId: string; userName: string; count: number }[]> {
  try {
    const valueExpr = count()
    const rows = await db
      .select({ userId: users.id, userName: users.name, value: valueExpr })
      .from(tasks)
      .innerJoin(users, eq(tasks.assignedTo, users.id))
      .groupBy(users.id, users.name)
      .orderBy(desc(valueExpr))

    return rows.map((r) => ({ userId: r.userId, userName: r.userName, count: Number(r.value) }))
  } catch {
    return []
  }
}

// ── Miembros ──────────────────────────────────────────────────────────────────

export async function getMembersOverview(): Promise<MemberOverview[]> {
  try {
    const [memberRows, activeRows, doneRows] = await Promise.all([
      db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(asc(users.name)),
      db
        .select({ userId: tasks.assignedTo, value: count() })
        .from(tasks)
        .where(inArray(tasks.status, ACTIVE_TASK_STATUSES))
        .groupBy(tasks.assignedTo),
      db
        .select({ userId: tasks.assignedTo, value: count() })
        .from(tasks)
        .where(eq(tasks.status, "done"))
        .groupBy(tasks.assignedTo),
    ])

    const activeByUser = new Map<string, number>()
    for (const r of activeRows) if (r.userId) activeByUser.set(r.userId, Number(r.value))
    const doneByUser = new Map<string, number>()
    for (const r of doneRows) if (r.userId) doneByUser.set(r.userId, Number(r.value))

    return memberRows.map((member) => ({
      id: member.id,
      name: member.name,
      activeTasks: activeByUser.get(member.id) ?? 0,
      doneTasks: doneByUser.get(member.id) ?? 0,
    }))
  } catch {
    return []
  }
}

// ── Actividad reciente ────────────────────────────────────────────────────────

export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
  try {
    const [createdRows, assignedRows] = await Promise.all([
      db
        .select({ id: tasks.id, title: tasks.title, createdAt: tasks.createdAt })
        .from(tasks)
        .orderBy(desc(tasks.createdAt))
        .limit(limit),
      db
        .select({ id: tasks.id, title: tasks.title, updatedAt: tasks.updatedAt, userName: users.name })
        .from(tasks)
        .innerJoin(users, eq(tasks.assignedTo, users.id))
        .orderBy(desc(tasks.updatedAt))
        .limit(limit),
    ])

    const items: ActivityItem[] = [
      ...createdRows.map(
        (t): ActivityItem => ({
          id: `task-created-${t.id}`,
          type: "task_created",
          title: "Tarea creada",
          subtitle: t.title,
          createdAt: t.createdAt,
        }),
      ),
      ...assignedRows.map(
        (t): ActivityItem => ({
          id: `task-assigned-${t.id}`,
          type: "task_assigned",
          title: "Tarea asignada",
          subtitle: `${t.title} → ${t.userName}`,
          createdAt: t.updatedAt,
        }),
      ),
    ]

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)
  } catch {
    return []
  }
}
