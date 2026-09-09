import "server-only"
import { asc, count, eq, ilike, inArray } from "drizzle-orm"
import { db } from "@/db"
import { teams, teamMembers } from "@/db/schema/team"
import { users } from "@/db/schema/user"
import type { Team, TeamsPage } from "@/types/teams"
import type { TeamOption } from "@/types/tasks"

const PAGE_LIMIT = 20

export async function getTeams(opts: { page: number; search?: string }): Promise<TeamsPage> {
  const empty: TeamsPage = { teams: [], total: 0, page: 1, totalPages: 1 }
  try {
    const page = Math.max(1, opts.page)
    const s = opts.search?.trim()
    const offset = (page - 1) * PAGE_LIMIT
    const whereClause = s ? ilike(teams.name, `%${s}%`) : undefined

    const [pageTeams, [countRow]] = await Promise.all([
      db.select({ id: teams.id, name: teams.name, createdAt: teams.createdAt }).from(teams).where(whereClause).orderBy(asc(teams.createdAt)).limit(PAGE_LIMIT).offset(offset),
      db.select({ value: count() }).from(teams).where(whereClause),
    ])

    const pageIds = pageTeams.map((t) => t.id)
    const memberRows =
      pageIds.length === 0
        ? []
        : await db
            .select({ teamId: teamMembers.teamId, memberId: users.id, memberName: users.name, memberEmail: users.email })
            .from(teamMembers)
            .innerJoin(users, eq(users.id, teamMembers.userId))
            .where(inArray(teamMembers.teamId, pageIds))

    const membersByTeam = new Map<string, Team["members"]>()
    for (const row of memberRows) {
      const list = membersByTeam.get(row.teamId) ?? []
      list.push({ id: row.memberId, name: row.memberName, email: row.memberEmail })
      membersByTeam.set(row.teamId, list)
    }

    const total = Number(countRow?.value ?? 0)
    return {
      teams: pageTeams.map((t) => ({ ...t, members: membersByTeam.get(t.id) ?? [] })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)),
    }
  } catch {
    return empty
  }
}

export async function getTeamOptions(): Promise<TeamOption[]> {
  try {
    return await db.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name))
  } catch {
    return []
  }
}

export async function getUserTeamIds(userId: string): Promise<string[]> {
  try {
    const rows = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId))
    return rows.map((r) => r.teamId)
  } catch {
    return []
  }
}

export async function getTeamMemberIds(teamId: string): Promise<string[]> {
  try {
    const rows = await db.select({ userId: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.teamId, teamId))
    return rows.map((r) => r.userId)
  } catch {
    return []
  }
}

export async function getTeamMemberIdsBulk(teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return []
  try {
    const rows = await db.select({ userId: teamMembers.userId }).from(teamMembers).where(inArray(teamMembers.teamId, teamIds))
    return Array.from(new Set(rows.map((r) => r.userId)))
  } catch {
    return []
  }
}

export interface TeamMemberEntry {
  teamId: string
  userId: string
  userName: string
}

// Miembros (id + nombre) de varios equipos a la vez, con el equipo de cada uno —
// para repartir entre sus integrantes algo calculado a nivel de equipo (ej. conteos
// de tareas asignadas al equipo) sin perder de qué equipo salió cada fila.
export async function getTeamMembersByTeamIds(teamIds: string[]): Promise<TeamMemberEntry[]> {
  if (teamIds.length === 0) return []
  try {
    return await db
      .select({ teamId: teamMembers.teamId, userId: users.id, userName: users.name })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(inArray(teamMembers.teamId, teamIds))
  } catch {
    return []
  }
}
