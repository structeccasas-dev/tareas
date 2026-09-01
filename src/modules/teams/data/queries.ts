import "server-only"
import { asc, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { teams, teamMembers } from "@/db/schema/team"
import { users } from "@/db/schema/user"
import type { Team } from "@/types/teams"
import type { TeamOption } from "@/types/tasks"

export async function getTeams(): Promise<Team[]> {
  try {
    const rows = await db
      .select({
        teamId: teams.id,
        teamName: teams.name,
        createdAt: teams.createdAt,
        memberId: users.id,
        memberName: users.name,
        memberEmail: users.email,
      })
      .from(teams)
      .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .leftJoin(users, eq(users.id, teamMembers.userId))
      .orderBy(asc(teams.createdAt))

    const byId = new Map<string, Team>()
    for (const row of rows) {
      let team = byId.get(row.teamId)
      if (!team) {
        team = { id: row.teamId, name: row.teamName, createdAt: row.createdAt, members: [] }
        byId.set(row.teamId, team)
      }
      if (row.memberId && row.memberName && row.memberEmail) {
        team.members.push({ id: row.memberId, name: row.memberName, email: row.memberEmail })
      }
    }
    return Array.from(byId.values())
  } catch {
    return []
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
