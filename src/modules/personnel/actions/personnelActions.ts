"use server"

import crypto from "crypto"
import { and, eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { db } from "@/db"
import { personnel, personnelDocuments, personnelHistory, personnelInvitations, personnelLeaves } from "@/db/schema/personnel"
import { users } from "@/db/schema/user"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"
import { savePersonnelFile, deletePersonnelFiles, deletePersonnelFile } from "@/lib/personnelStorage"
import { notifyUser, notifyUsers } from "@/lib/notify"
import { getDocumentFile, getInvitationStatus, getPersonnelByLinkedUser } from "@/modules/personnel/data/queries"
import { summarizeLeave } from "@/modules/personnel/labels"
import type { ContractType, LeaveType, Personnel } from "@/types/personnel"

const INVITATION_VALID_DAYS = 7

async function requireManage() {
  const session = await getSession()
  if (!session || !canManageUsers(session)) {
    throw new Error("No tenés permisos para administrar personal")
  }
  return session
}

interface CreatePersonnelInput {
  fullName: string
  position: string
  contractType: ContractType
  startDate: string
  probationEndDate?: string
}

export async function createPersonnel(data: CreatePersonnelInput): Promise<{ id: string }> {
  const session = await requireManage()
  const fullName = data.fullName.trim()
  if (!fullName) throw new Error("El nombre no puede estar vacío")

  const [created] = await db
    .insert(personnel)
    .values({
      fullName,
      position: data.position.trim() || null,
      contractType: data.contractType,
      startDate: data.startDate || null,
      probationEndDate: data.contractType === "prueba" ? data.probationEndDate || null : null,
      createdBy: session.userId,
    })
    .returning({ id: personnel.id })

  refresh()
  return created
}

// Campos editables desde el detalle de la persona, en el orden en que se
// comparan para armar el historial de cambios.
const EDITABLE_FIELDS = [
  "fullName",
  "position",
  "contractType",
  "startDate",
  "probationEndDate",
  "salary",
  "documentType",
  "documentNumber",
  "birthDate",
  "address",
  "phone",
  "personalEmail",
  "bankName",
  "bankAccountType",
  "bankAccountNumber",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
] as const

type EditableField = (typeof EDITABLE_FIELDS)[number]

export type UpdatePersonnelInput = Partial<Record<EditableField, string | null>>

export async function updatePersonnel(id: string, data: UpdatePersonnelInput): Promise<void> {
  const session = await requireManage()

  const current = await db.select().from(personnel).where(eq(personnel.id, id)).limit(1)
  const existing = current[0]
  if (!existing) throw new Error("La persona no existe")

  const normalized: UpdatePersonnelInput = { ...data }
  if (normalized.fullName !== undefined) {
    const trimmed = normalized.fullName?.trim() || ""
    if (!trimmed) throw new Error("El nombre no puede estar vacío")
    normalized.fullName = trimmed
  }
  // El fin de período de prueba solo tiene sentido mientras el contrato sigue en prueba.
  const effectiveContractType = (normalized.contractType ?? existing.contractType) as ContractType | null
  if (effectiveContractType !== "prueba") {
    normalized.probationEndDate = null
  }

  const updateValues: Record<string, string | null> = {}
  const historyRows: (typeof personnelHistory.$inferInsert)[] = []

  for (const field of EDITABLE_FIELDS) {
    if (!(field in normalized)) continue
    const oldValue = (existing[field as keyof Personnel] as string | null) ?? null
    const newValue = normalized[field] ?? null
    if (oldValue === newValue) continue

    updateValues[field] = newValue
    historyRows.push({
      personnelId: id,
      field,
      oldValue,
      newValue,
      changedBy: session.userId,
    })
  }

  if (historyRows.length === 0) return

  await db
    .update(personnel)
    .set({ ...updateValues, updatedAt: new Date() } as Partial<typeof personnel.$inferInsert>)
    .where(eq(personnel.id, id))
  await db.insert(personnelHistory).values(historyRows)

  refresh()
}

interface CreateLeaveInput {
  type: LeaveType
  startDate: string
  endDate: string
  daysCount: string
  countsAsVacation: boolean
  notes?: string
}

function validateLeaveInput(data: CreateLeaveInput) {
  if (!data.startDate || !data.endDate) throw new Error("Indicá el rango de fechas")
  if (!data.daysCount || Number(data.daysCount) <= 0) throw new Error("Indicá la cantidad de días")
}

export async function createLeave(personnelId: string, data: CreateLeaveInput): Promise<void> {
  const session = await requireManage()
  validateLeaveInput(data)

  const notes = data.notes?.trim() || null

  // Lo que carga un admin directamente queda aprobado de una: no pasa por
  // el flujo de solicitud, que es solo para lo que pide el propio empleado.
  await db.insert(personnelLeaves).values({
    personnelId,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    daysCount: data.daysCount,
    countsAsVacation: data.countsAsVacation,
    notes,
    status: "approved",
    decidedBy: session.userId,
    decidedAt: new Date(),
    createdBy: session.userId,
  })

  await db.insert(personnelHistory).values({
    personnelId,
    field: "leave",
    oldValue: null,
    newValue: summarizeLeave({ ...data, notes }),
    changedBy: session.userId,
  })

  refresh()
}

// Autoservicio: lo usa el propio empleado desde /perfil para pedir vacaciones
// u otro tipo de licencia. Queda pendiente hasta que un admin la decida.
export async function requestLeave(data: CreateLeaveInput): Promise<void> {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")
  validateLeaveInput(data)

  const own = await getPersonnelByLinkedUser(session.userId)
  if (!own) throw new Error("Tu usuario no está vinculado a un legajo de personal")

  const notes = data.notes?.trim() || null

  await db.insert(personnelLeaves).values({
    personnelId: own.id,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    daysCount: data.daysCount,
    countsAsVacation: data.countsAsVacation,
    notes,
    status: "pending",
    createdBy: session.userId,
  })

  await db.insert(personnelHistory).values({
    personnelId: own.id,
    field: "leave",
    oldValue: null,
    newValue: `${summarizeLeave({ ...data, notes })} · solicitada por el empleado`,
    changedBy: session.userId,
  })

  const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.active, true)))
  await notifyUsers(
    admins.map((a) => a.id),
    {
      type: "leave_requested",
      title: "Nueva solicitud de vacaciones",
      body: `${session.name} solicitó ${summarizeLeave({ ...data, notes })}`,
      personnelId: own.id,
      url: `/personal/${own.id}`,
    },
  )

  refresh()
}

async function requireDecidablePendingLeave(id: string) {
  const [existing] = await db.select().from(personnelLeaves).where(eq(personnelLeaves.id, id)).limit(1)
  if (!existing) throw new Error("La solicitud no existe")
  if (existing.status !== "pending") throw new Error("Esta solicitud ya fue decidida")
  return existing
}

export async function approveLeave(id: string): Promise<void> {
  const session = await requireManage()
  const existing = await requireDecidablePendingLeave(id)

  await db
    .update(personnelLeaves)
    .set({ status: "approved", decidedBy: session.userId, decidedAt: new Date() })
    .where(eq(personnelLeaves.id, id))

  await db.insert(personnelHistory).values({
    personnelId: existing.personnelId,
    field: "leave",
    oldValue: `${summarizeLeave(existing)} · pendiente`,
    newValue: `${summarizeLeave(existing)} · aprobada`,
    changedBy: session.userId,
  })

  const [person] = await db.select({ linkedUserId: personnel.linkedUserId }).from(personnel).where(eq(personnel.id, existing.personnelId)).limit(1)
  if (person?.linkedUserId) {
    await notifyUser({
      userId: person.linkedUserId,
      type: "leave_approved",
      title: "Solicitud de vacaciones aprobada",
      body: summarizeLeave(existing),
      personnelId: existing.personnelId,
      url: "/perfil",
    })
  }

  refresh()
}

export async function rejectLeave(id: string, reason?: string): Promise<void> {
  const session = await requireManage()
  const existing = await requireDecidablePendingLeave(id)
  const decisionNote = reason?.trim() || null

  await db
    .update(personnelLeaves)
    .set({ status: "rejected", decidedBy: session.userId, decidedAt: new Date(), decisionNote })
    .where(eq(personnelLeaves.id, id))

  await db.insert(personnelHistory).values({
    personnelId: existing.personnelId,
    field: "leave",
    oldValue: `${summarizeLeave(existing)} · pendiente`,
    newValue: `${summarizeLeave(existing)} · rechazada${decisionNote ? ` (${decisionNote})` : ""}`,
    changedBy: session.userId,
  })

  const [person] = await db.select({ linkedUserId: personnel.linkedUserId }).from(personnel).where(eq(personnel.id, existing.personnelId)).limit(1)
  if (person?.linkedUserId) {
    await notifyUser({
      userId: person.linkedUserId,
      type: "leave_rejected",
      title: "Solicitud de vacaciones rechazada",
      body: decisionNote ? `${summarizeLeave(existing)} · ${decisionNote}` : summarizeLeave(existing),
      personnelId: existing.personnelId,
      url: "/perfil",
    })
  }

  refresh()
}

export async function updateLeave(id: string, data: CreateLeaveInput): Promise<void> {
  const session = await requireManage()
  validateLeaveInput(data)

  const [existing] = await db.select().from(personnelLeaves).where(eq(personnelLeaves.id, id)).limit(1)
  if (!existing) throw new Error("La licencia no existe")

  const notes = data.notes?.trim() || null
  const oldSummary = summarizeLeave(existing)
  const newSummary = summarizeLeave({ ...data, notes })

  await db
    .update(personnelLeaves)
    .set({
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      daysCount: data.daysCount,
      countsAsVacation: data.countsAsVacation,
      notes,
    })
    .where(eq(personnelLeaves.id, id))

  if (oldSummary !== newSummary) {
    await db.insert(personnelHistory).values({
      personnelId: existing.personnelId,
      field: "leave",
      oldValue: oldSummary,
      newValue: newSummary,
      changedBy: session.userId,
    })
  }

  refresh()
}

export async function deleteLeave(id: string): Promise<void> {
  const session = await requireManage()

  const [existing] = await db.select().from(personnelLeaves).where(eq(personnelLeaves.id, id)).limit(1)
  if (!existing) return

  await db.delete(personnelLeaves).where(eq(personnelLeaves.id, id))

  await db.insert(personnelHistory).values({
    personnelId: existing.personnelId,
    field: "leave",
    oldValue: summarizeLeave(existing),
    newValue: null,
    changedBy: session.userId,
  })

  refresh()
}

export async function linkUserToPersonnel(personnelId: string, userId: string): Promise<void> {
  const session = await requireManage()

  const [alreadyLinked] = await db.select({ id: personnel.id }).from(personnel).where(eq(personnel.linkedUserId, userId)).limit(1)
  if (alreadyLinked) throw new Error("Ese usuario ya está vinculado a otro legajo")

  const [targetUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1)
  if (!targetUser) throw new Error("El usuario no existe")

  await db.update(personnel).set({ linkedUserId: userId, updatedAt: new Date() }).where(eq(personnel.id, personnelId))

  await db.insert(personnelHistory).values({
    personnelId,
    field: "linkedUser",
    oldValue: null,
    newValue: targetUser.name,
    changedBy: session.userId,
  })

  refresh()
}

export async function unlinkUserFromPersonnel(personnelId: string): Promise<void> {
  const session = await requireManage()

  const [existing] = await db.select({ linkedUserId: personnel.linkedUserId }).from(personnel).where(eq(personnel.id, personnelId)).limit(1)
  if (!existing?.linkedUserId) return

  const [linkedUser] = await db.select({ name: users.name }).from(users).where(eq(users.id, existing.linkedUserId)).limit(1)

  await db.update(personnel).set({ linkedUserId: null, updatedAt: new Date() }).where(eq(personnel.id, personnelId))

  await db.insert(personnelHistory).values({
    personnelId,
    field: "linkedUser",
    oldValue: linkedUser?.name ?? null,
    newValue: null,
    changedBy: session.userId,
  })

  refresh()
}

export async function deletePersonnel(id: string): Promise<void> {
  await requireManage()
  await db.delete(personnel).where(eq(personnel.id, id))
  await deletePersonnelFiles(id)
  refresh()
}

export async function createInvitation(personnelId: string): Promise<{ token: string; expiresAt: Date }> {
  await requireManage()

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + INVITATION_VALID_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(personnelInvitations).values({ personnelId, token, expiresAt })
  refresh()

  return { token, expiresAt }
}

export async function uploadContract(personnelId: string, formData: FormData): Promise<void> {
  await requireManage()

  const file = formData.get("contract")
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Adjuntá el PDF del contrato firmado")
  }

  const saved = await savePersonnelFile(personnelId, file)
  await db.insert(personnelDocuments).values({
    personnelId,
    type: "contract",
    fileName: saved.fileName,
    storedPath: saved.storedPath,
    mimeType: saved.mimeType,
    size: String(saved.size),
  })
  await db.update(personnel).set({ status: "contrato_subido", updatedAt: new Date() }).where(eq(personnel.id, personnelId))

  refresh()
}

export async function deleteDocument(documentId: string): Promise<void> {
  await requireManage()

  const doc = await getDocumentFile(documentId)
  if (!doc) return

  await db.delete(personnelDocuments).where(eq(personnelDocuments.id, documentId))
  await deletePersonnelFile(doc.storedPath)

  // Si era el contrato y no queda ningún otro, el estado vuelve atrás.
  if (doc.type === "contract") {
    const [remainingContract] = await db
      .select({ id: personnelDocuments.id })
      .from(personnelDocuments)
      .where(and(eq(personnelDocuments.personnelId, doc.personnelId), eq(personnelDocuments.type, "contract")))
      .limit(1)
    if (!remainingContract) {
      await db
        .update(personnel)
        .set({ status: "datos_completados", updatedAt: new Date() })
        .where(eq(personnel.id, doc.personnelId))
    }
  }

  refresh()
}

// Server Action pública: la usa el trabajador desde /onboarding/[token], sin sesión.
// El token es la única credencial, así que se vuelve a validar acá (no confiar en
// lo que ya se validó al renderizar la página).
export async function submitOnboarding(token: string, formData: FormData): Promise<void> {
  const status = await getInvitationStatus(token)
  if (!status.valid) throw new Error("El enlace ya no es válido")

  const personnelId = status.invitation.personnelId

  const idFront = formData.get("idFront")
  const idBack = formData.get("idBack")

  if (!(idFront instanceof File) || idFront.size === 0 || !(idBack instanceof File) || idBack.size === 0) {
    throw new Error("Subí las dos fotos del carnet")
  }

  const get = (key: string) => (formData.get(key) as string | null)?.trim() || null

  await db
    .update(personnel)
    .set({
      documentType: get("documentType"),
      documentNumber: get("documentNumber"),
      birthDate: get("birthDate"),
      address: get("address"),
      phone: get("phone"),
      personalEmail: get("personalEmail"),
      bankName: get("bankName"),
      bankAccountType: get("bankAccountType"),
      bankAccountNumber: get("bankAccountNumber"),
      emergencyContactName: get("emergencyContactName"),
      emergencyContactPhone: get("emergencyContactPhone"),
      emergencyContactRelationship: get("emergencyContactRelationship"),
      status: "datos_completados",
      updatedAt: new Date(),
    })
    .where(eq(personnel.id, personnelId))

  for (const [type, file] of [
    ["id_front", idFront],
    ["id_back", idBack],
  ] as const) {
    const saved = await savePersonnelFile(personnelId, file)
    await db.insert(personnelDocuments).values({
      personnelId,
      type,
      fileName: saved.fileName,
      storedPath: saved.storedPath,
      mimeType: saved.mimeType,
      size: String(saved.size),
    })
  }

  await db
    .update(personnelInvitations)
    .set({ usedAt: new Date() })
    .where(eq(personnelInvitations.id, status.invitation.id))

  refresh()
}
