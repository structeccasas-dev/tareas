"use server"

import { and, eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { db } from "@/db"
import { teams, teamMembers } from "@/db/schema/team"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"

async function requireManage() {
  const session = await getSession()
  if (!session || !canManageUsers(session)) {
    throw new Error("No tenés permisos para administrar equipos")
  }
}

export async function createTeam(name: string): Promise<{ id: string }> {
  await requireManage()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("El nombre del equipo no puede estar vacío")
  const [created] = await db.insert(teams).values({ name: trimmed }).returning({ id: teams.id })
  refresh()
  return created
}

export async function renameTeam(id: string, name: string): Promise<void> {
  await requireManage()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("El nombre del equipo no puede estar vacío")
  await db.update(teams).set({ name: trimmed }).where(eq(teams.id, id))
  refresh()
}

export async function deleteTeam(id: string): Promise<void> {
  await requireManage()
  await db.delete(teams).where(eq(teams.id, id))
  refresh()
}

export async function addTeamMember(teamId: string, userId: string): Promise<void> {
  await requireManage()
  const [existing] = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  if (existing) return
  await db.insert(teamMembers).values({ teamId, userId })
  refresh()
}

export async function removeTeamMember(teamId: string, userId: string): Promise<void> {
  await requireManage()
  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
  refresh()
}
