import "server-only"
import { eq, isNull, or, type SQL } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import type { SessionPayload } from "./session"

export function canManageUsers(session: Pick<SessionPayload, "role">): boolean {
  return session.role === "admin"
}

// admin y supervisor tienen acceso total a todas las tareas.
export function hasFullAccess(session: Pick<SessionPayload, "role">): boolean {
  return session.role === "admin" || session.role === "supervisor"
}

// Condición para filtrar listados por dueño: acceso total → sin filtro (ve todo);
// el resto → lo suyo + lo que no tiene dueño/asignar todavía.
export function ownershipCondition(
  session: Pick<SessionPayload, "role" | "userId">,
  ownerColumn: AnyPgColumn,
): SQL | undefined {
  if (hasFullAccess(session)) return undefined
  return or(eq(ownerColumn, session.userId), isNull(ownerColumn))
}

// Chequeo puntual antes de mutar un registro ya cargado.
export function canManageRecord(
  session: Pick<SessionPayload, "role" | "userId">,
  ownerId: string | null,
): boolean {
  if (hasFullAccess(session)) return true
  return ownerId === null || ownerId === session.userId
}
