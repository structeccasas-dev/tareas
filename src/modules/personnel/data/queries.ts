import { and, count, desc, eq, ilike, isNull, or } from "drizzle-orm"
import { db } from "@/db"
import { personnel, personnelDocuments, personnelHistory, personnelInvitations, personnelLeaves } from "@/db/schema/personnel"
import { users } from "@/db/schema/user"
import type {
  Personnel,
  PersonnelDocument,
  PersonnelHistoryPage,
  PersonnelInvitation,
  PersonnelLeave,
  PersonnelPage,
} from "@/types/personnel"

const PAGE_LIMIT = 20
// Topes defensivos para sub-listas por persona (documentos, licencias): en la
// práctica nunca se acercan a este volumen, así que no justifican su propia
// paginación en la UI — solo evitan una consulta sin límite.
const SUBLIST_CAP = 200

export async function getPersonnelList(opts: { page: number; search?: string }): Promise<PersonnelPage> {
  const empty: PersonnelPage = { personnel: [], total: 0, page: 1, totalPages: 1 }
  try {
    const page = Math.max(1, opts.page)
    const s = opts.search?.trim()
    const offset = (page - 1) * PAGE_LIMIT
    const whereClause = s ? or(ilike(personnel.fullName, `%${s}%`), ilike(personnel.position, `%${s}%`)) : undefined

    const [rows, [countRow]] = await Promise.all([
      db.select().from(personnel).where(whereClause).orderBy(desc(personnel.createdAt)).limit(PAGE_LIMIT).offset(offset),
      db.select({ value: count() }).from(personnel).where(whereClause),
    ])

    const total = Number(countRow?.value ?? 0)
    return { personnel: rows, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)) }
  } catch {
    return empty
  }
}

export async function getPersonnelById(id: string): Promise<Personnel | null> {
  const [row] = await db.select().from(personnel).where(eq(personnel.id, id)).limit(1)
  return row ?? null
}

export async function getDocumentsForPersonnel(personnelId: string): Promise<PersonnelDocument[]> {
  return db
    .select({
      id: personnelDocuments.id,
      personnelId: personnelDocuments.personnelId,
      type: personnelDocuments.type,
      fileName: personnelDocuments.fileName,
      mimeType: personnelDocuments.mimeType,
      size: personnelDocuments.size,
      uploadedAt: personnelDocuments.uploadedAt,
    })
    .from(personnelDocuments)
    .where(eq(personnelDocuments.personnelId, personnelId))
    .orderBy(desc(personnelDocuments.uploadedAt))
    .limit(SUBLIST_CAP)
}

export interface DocumentFile {
  id: string
  personnelId: string
  type: PersonnelDocument["type"]
  storedPath: string
  fileName: string
  mimeType: string
  size: string
}

export async function getDocumentFile(documentId: string): Promise<DocumentFile | null> {
  const [row] = await db
    .select({
      id: personnelDocuments.id,
      personnelId: personnelDocuments.personnelId,
      type: personnelDocuments.type,
      storedPath: personnelDocuments.storedPath,
      fileName: personnelDocuments.fileName,
      mimeType: personnelDocuments.mimeType,
      size: personnelDocuments.size,
    })
    .from(personnelDocuments)
    .where(eq(personnelDocuments.id, documentId))
    .limit(1)
  return row ?? null
}

export type InvitationStatus =
  | { valid: true; invitation: PersonnelInvitation; personnelName: string }
  | { valid: false; reason: "not_found" | "expired" | "used" }

export async function getInvitationStatus(token: string): Promise<InvitationStatus> {
  const [row] = await db
    .select({
      invitation: personnelInvitations,
      personnelName: personnel.fullName,
    })
    .from(personnelInvitations)
    .innerJoin(personnel, eq(personnel.id, personnelInvitations.personnelId))
    .where(eq(personnelInvitations.token, token))
    .limit(1)

  if (!row) return { valid: false, reason: "not_found" }
  if (row.invitation.usedAt) return { valid: false, reason: "used" }
  if (row.invitation.expiresAt.getTime() < Date.now()) return { valid: false, reason: "expired" }

  return { valid: true, invitation: row.invitation, personnelName: row.personnelName }
}

export async function getLeavesForPersonnel(personnelId: string): Promise<PersonnelLeave[]> {
  return db
    .select()
    .from(personnelLeaves)
    .where(eq(personnelLeaves.personnelId, personnelId))
    .orderBy(desc(personnelLeaves.startDate))
    .limit(SUBLIST_CAP)
}

const HISTORY_PAGE_LIMIT = 20

// El historial crece indefinidamente (cada edición agrega una fila), así que
// a diferencia de documentos/licencias sí necesita paginación real.
export async function getHistoryForPersonnel(personnelId: string, opts: { page: number }): Promise<PersonnelHistoryPage> {
  const empty: PersonnelHistoryPage = { history: [], total: 0, page: 1, totalPages: 1 }
  try {
    const page = Math.max(1, opts.page)
    const offset = (page - 1) * HISTORY_PAGE_LIMIT
    const whereClause = eq(personnelHistory.personnelId, personnelId)

    const [rows, [countRow]] = await Promise.all([
      db
        .select({
          id: personnelHistory.id,
          personnelId: personnelHistory.personnelId,
          field: personnelHistory.field,
          oldValue: personnelHistory.oldValue,
          newValue: personnelHistory.newValue,
          changedBy: personnelHistory.changedBy,
          changedByName: users.name,
          changedAt: personnelHistory.changedAt,
        })
        .from(personnelHistory)
        .innerJoin(users, eq(users.id, personnelHistory.changedBy))
        .where(whereClause)
        .orderBy(desc(personnelHistory.changedAt))
        .limit(HISTORY_PAGE_LIMIT)
        .offset(offset),
      db.select({ value: count() }).from(personnelHistory).where(whereClause),
    ])

    const total = Number(countRow?.value ?? 0)
    return { history: rows, total, page, totalPages: Math.max(1, Math.ceil(total / HISTORY_PAGE_LIMIT)) }
  } catch {
    return empty
  }
}

// Última invitación vigente (sin usar y no vencida) de una persona, si existe.
export async function getActiveInvitation(personnelId: string): Promise<PersonnelInvitation | null> {
  const [row] = await db
    .select()
    .from(personnelInvitations)
    .where(and(eq(personnelInvitations.personnelId, personnelId), isNull(personnelInvitations.usedAt)))
    .orderBy(desc(personnelInvitations.createdAt))
    .limit(1)
  if (!row || row.expiresAt.getTime() < Date.now()) return null
  return row
}
