import "server-only"
import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import type { SessionPayload } from "./session"

export function isAdmin(session: Pick<SessionPayload, "role">): boolean {
  return session.role === "admin"
}

// Usuarios, equipos y proyectos son de gestión exclusiva del admin;
// el supervisor no debe verlos ni administrarlos.
export function canManageUsers(session: Pick<SessionPayload, "role">): boolean {
  return isAdmin(session)
}

// admin y supervisor tienen acceso total a todas las tareas.
export function hasFullAccess(session: Pick<SessionPayload, "role">): boolean {
  return session.role === "admin" || session.role === "supervisor"
}

// Condición para filtrar listados por dueño: acceso total → sin filtro (ve todo);
// el resto → lo suyo + lo que no tiene dueño/asignar todavía + lo de sus equipos
// (si se pasa teamColumn/userTeamIds).
export function ownershipCondition(
  session: Pick<SessionPayload, "role" | "userId">,
  ownerColumn: AnyPgColumn,
  teamColumn?: AnyPgColumn,
  userTeamIds: string[] = [],
): SQL | undefined {
  if (hasFullAccess(session)) return undefined
  if (!teamColumn) return or(eq(ownerColumn, session.userId), isNull(ownerColumn))
  return or(
    eq(ownerColumn, session.userId),
    and(isNull(ownerColumn), isNull(teamColumn)),
    userTeamIds.length > 0 ? inArray(teamColumn, userTeamIds) : undefined,
  )
}

// Chequeo puntual antes de mutar un registro ya cargado.
export function canManageRecord(
  session: Pick<SessionPayload, "role" | "userId">,
  ownerId: string | null,
): boolean {
  if (hasFullAccess(session)) return true
  return ownerId === null || ownerId === session.userId
}

// Igual que canManageRecord, pero para tareas que también pueden estar
// asignadas a un equipo en vez de (o además de) un usuario individual.
export function canManageTask(
  session: Pick<SessionPayload, "role" | "userId">,
  task: { assignedTo: string | null; assignedTeamId: string | null },
  userTeamIds: string[],
): boolean {
  if (hasFullAccess(session)) return true
  if (task.assignedTo === session.userId) return true
  if (task.assignedTeamId) return userTeamIds.includes(task.assignedTeamId)
  return task.assignedTo === null
}
