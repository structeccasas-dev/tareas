import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { users } from "@/db/schema/user"
import { teams } from "@/db/schema/team"
import type { TaskStatus } from "@/types/tasks"
import type {
  ActivityItem,
  MemberOverview,
  DailyPoint,
  DashboardMetrics,
  DashboardRange,
  TaskStatusPoint,
} from "@/types/dashboard"
import type { SessionPayload } from "@/lib/session"
import { hasFullAccess, ownershipCondition } from "@/lib/permissions"
import { getUserTeamIds, getTeamMembersByTeamIds } from "@/modules/teams/data/queries"
import type { TeamMemberEntry } from "@/modules/teams/data/queries"

type Scope = Pick<SessionPayload, "role" | "userId">

async function resolveOwnership(scope: Scope) {
  const userTeamIds = hasFullAccess(scope) ? [] : await getUserTeamIds(scope.userId)
  return ownershipCondition(scope, tasks.assignedTo, tasks.assignedTeamId, userTeamIds)
}

const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"]
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

export async function getDashboardMetrics(range: DashboardRange, scope: Scope): Promise<DashboardMetrics> {
  try {
    const owned = await resolveOwnership(scope)

    const [statusRows, [createdRow], [completedRow], [overdueRow]] = await Promise.all([
      db.select({ status: tasks.status, value: count() }).from(tasks).where(owned).groupBy(tasks.status),
      db
        .select({ value: count() })
        .from(tasks)
        .where(and(gte(tasks.createdAt, range.from), lte(tasks.createdAt, range.to), owned)),
      db
        .select({ value: count() })
        .from(tasks)
        .where(and(eq(tasks.status, "done"), gte(tasks.updatedAt, range.from), lte(tasks.updatedAt, range.to), owned)),
      db
        .select({ value: count() })
        .from(tasks)
        .where(
          and(
            sql`${tasks.dueAt} is not null`,
            lte(tasks.dueAt, new Date()),
            sql`${tasks.status} not in ('done', 'cancelled')`,
            owned,
          ),
        ),
    ])

    const countByStatus = new Map(statusRows.map((r) => [r.status, Number(r.value)]))

    return {
      totalTasks: statusRows.reduce((sum, r) => sum + Number(r.value), 0),
      todoTasks: countByStatus.get("todo") ?? 0,
      inProgressTasks: countByStatus.get("in_progress") ?? 0,
      doneTasks: countByStatus.get("done") ?? 0,
      cancelledTasks: countByStatus.get("cancelled") ?? 0,
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
      cancelledTasks: 0,
      overdueTasks: 0,
      createdInRange: 0,
      completedInRange: 0,
    }
  }
}

// ── Gráficos ──────────────────────────────────────────────────────────────────

export async function getTasksByDay(range: DashboardRange, scope: Scope): Promise<DailyPoint[]> {
  try {
    const dayExpr = sql<string>`to_char(date_trunc('day', ${tasks.createdAt}), 'YYYY-MM-DD')`
    const owned = await resolveOwnership(scope)
    const rows = await db
      .select({ day: dayExpr, value: count() })
      .from(tasks)
      .where(and(gte(tasks.createdAt, range.from), lte(tasks.createdAt, range.to), owned))
      .groupBy(dayExpr)
    return fillDayBuckets(range, rows)
  } catch {
    return []
  }
}

export async function getTasksByStatusDistribution(scope: Scope): Promise<TaskStatusPoint[]> {
  try {
    const owned = await resolveOwnership(scope)
    const rows = await db
      .select({ status: tasks.status, value: count() })
      .from(tasks)
      .where(owned)
      .groupBy(tasks.status)
    const byStatus = new Map(rows.map((r) => [r.status, Number(r.value)]))
    return TASK_STATUSES.map((status) => ({ status, count: byStatus.get(status) ?? 0 }))
  } catch {
    return TASK_STATUSES.map((status) => ({ status, count: 0 }))
  }
}

// Comparativa entre miembros — solo tiene sentido para quien puede ver las
// tareas de todos (admin/supervisor); no se llama para usuarios restringidos.
// Las tareas asignadas a un equipo no tienen un único dueño: se suman a cada
// integrante del equipo, igual que en getMembersOverview.
export async function getTasksByMember(): Promise<{ userId: string; userName: string; count: number }[]> {
  try {
    const [individualRows, teamRows] = await Promise.all([
      db
        .select({ userId: users.id, userName: users.name, value: count() })
        .from(tasks)
        .innerJoin(users, eq(tasks.assignedTo, users.id))
        .groupBy(users.id, users.name),
      db
        .select({ teamId: tasks.assignedTeamId, value: count() })
        .from(tasks)
        .where(isNotNull(tasks.assignedTeamId))
        .groupBy(tasks.assignedTeamId),
    ])

    const totals = new Map<string, { userName: string; count: number }>()
    for (const r of individualRows) {
      totals.set(r.userId, { userName: r.userName, count: Number(r.value) })
    }

    const teamIds = teamRows.map((r) => r.teamId).filter((id): id is string => id !== null)
    const members = await getTeamMembersByTeamIds(teamIds)
    const membersByTeam = new Map<string, TeamMemberEntry[]>()
    for (const m of members) {
      membersByTeam.set(m.teamId, [...(membersByTeam.get(m.teamId) ?? []), m])
    }

    for (const row of teamRows) {
      if (!row.teamId) continue
      for (const member of membersByTeam.get(row.teamId) ?? []) {
        const current = totals.get(member.userId) ?? { userName: member.userName, count: 0 }
        current.count += Number(row.value)
        totals.set(member.userId, current)
      }
    }

    return Array.from(totals.entries())
      .map(([userId, v]) => ({ userId, userName: v.userName, count: v.count }))
      .sort((a, b) => b.count - a.count)
  } catch {
    return []
  }
}

// ── Miembros ──────────────────────────────────────────────────────────────────

// Igual que getTasksByMember: vista de equipo, solo para admin/supervisor.
// Las tareas asignadas a un equipo se suman a cada integrante — no tienen un
// único dueño individual.
export async function getMembersOverview(): Promise<MemberOverview[]> {
  try {
    const [memberRows, activeRows, doneRows, activeTeamRows, doneTeamRows] = await Promise.all([
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
      db
        .select({ teamId: tasks.assignedTeamId, value: count() })
        .from(tasks)
        .where(and(isNotNull(tasks.assignedTeamId), inArray(tasks.status, ACTIVE_TASK_STATUSES)))
        .groupBy(tasks.assignedTeamId),
      db
        .select({ teamId: tasks.assignedTeamId, value: count() })
        .from(tasks)
        .where(and(isNotNull(tasks.assignedTeamId), eq(tasks.status, "done")))
        .groupBy(tasks.assignedTeamId),
    ])

    const activeByUser = new Map<string, number>()
    for (const r of activeRows) if (r.userId) activeByUser.set(r.userId, Number(r.value))
    const doneByUser = new Map<string, number>()
    for (const r of doneRows) if (r.userId) doneByUser.set(r.userId, Number(r.value))

    const teamIds = Array.from(
      new Set([...activeTeamRows, ...doneTeamRows].map((r) => r.teamId).filter((id): id is string => id !== null)),
    )
    const members = await getTeamMembersByTeamIds(teamIds)
    const memberIdsByTeam = new Map<string, string[]>()
    for (const m of members) {
      memberIdsByTeam.set(m.teamId, [...(memberIdsByTeam.get(m.teamId) ?? []), m.userId])
    }

    for (const row of activeTeamRows) {
      if (!row.teamId) continue
      for (const userId of memberIdsByTeam.get(row.teamId) ?? []) {
        activeByUser.set(userId, (activeByUser.get(userId) ?? 0) + Number(row.value))
      }
    }
    for (const row of doneTeamRows) {
      if (!row.teamId) continue
      for (const userId of memberIdsByTeam.get(row.teamId) ?? []) {
        doneByUser.set(userId, (doneByUser.get(userId) ?? 0) + Number(row.value))
      }
    }

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

export async function getRecentActivity(limit: number, scope: Scope): Promise<ActivityItem[]> {
  try {
    const owned = await resolveOwnership(scope)

    const [createdRows, assignedUserRows, assignedTeamRows] = await Promise.all([
      db
        .select({ id: tasks.id, title: tasks.title, createdAt: tasks.createdAt })
        .from(tasks)
        .where(owned)
        .orderBy(desc(tasks.createdAt))
        .limit(limit),
      db
        .select({ id: tasks.id, title: tasks.title, updatedAt: tasks.updatedAt, userName: users.name })
        .from(tasks)
        .innerJoin(users, eq(tasks.assignedTo, users.id))
        .where(owned)
        .orderBy(desc(tasks.updatedAt))
        .limit(limit),
      db
        .select({ id: tasks.id, title: tasks.title, updatedAt: tasks.updatedAt, teamName: teams.name })
        .from(tasks)
        .innerJoin(teams, eq(tasks.assignedTeamId, teams.id))
        .where(owned)
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
      ...assignedUserRows.map(
        (t): ActivityItem => ({
          id: `task-assigned-${t.id}`,
          type: "task_assigned",
          title: "Tarea asignada",
          subtitle: `${t.title} → ${t.userName}`,
          createdAt: t.updatedAt,
        }),
      ),
      ...assignedTeamRows.map(
        (t): ActivityItem => ({
          id: `task-assigned-team-${t.id}`,
          type: "task_assigned",
          title: "Tarea asignada",
          subtitle: `${t.title} → Equipo ${t.teamName}`,
          createdAt: t.updatedAt,
        }),
      ),
    ]

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)
  } catch {
    return []
  }
}
