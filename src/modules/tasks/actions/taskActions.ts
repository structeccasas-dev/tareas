"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { users } from "@/db/schema/user"
import { projects } from "@/db/schema/project"
import { taskComments } from "@/db/schema/taskComment"
import { taskReminders } from "@/db/schema/taskReminder"
import { getSession } from "@/lib/session"
import type { SessionPayload } from "@/lib/session"
import { logActivity } from "@/lib/activityLog"
import { hasFullAccess, canManageTask } from "@/lib/permissions"
import { notifyUser, notifyUsers } from "@/lib/notify"
import { computeNextSingleOccurrence, computeWeeklyBatchForMonth, parseWeekdaysCsv } from "@/lib/recurrence"
import { STATUS_LABELS, PRIORITY_LABELS } from "@/modules/tasks/lib/status"
import type {
  TaskStatus,
  TaskPriority,
  TaskColumn,
  TasksFilters,
  TaskWithRelations,
  TimelineEntry,
  RecurrenceRule,
  RecurrenceFreq,
} from "@/types/tasks"
import { getTasksPage, getTasksInRange, getTaskTimeline as fetchTaskTimeline, resolveTaskRecipients } from "@/modules/tasks/data/queries"
import { getUserTeamIds } from "@/modules/teams/data/queries"

function buildStatusChangeDescription(oldStatus: TaskStatus, newStatus: TaskStatus, cancelReason?: string | null): string {
  const base = `Cambió el estado de "${STATUS_LABELS[oldStatus]}" a "${STATUS_LABELS[newStatus]}"`
  if (newStatus === "cancelled" && cancelReason) return `${base} — Motivo: "${cancelReason}"`
  return base
}

async function maybeLogStatusChange(taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus, userId: string, cancelReason?: string | null) {
  if (oldStatus === newStatus) return
  await logActivity({
    entityType: "task",
    entityId: taskId,
    action: "status_changed",
    description: buildStatusChangeDescription(oldStatus, newStatus, cancelReason),
    userId,
  })
}

interface TaskDiffRow {
  title: string
  priority: TaskPriority
  assignedTo: string | null
  description: string | null
  category: string | null
  projectId: string | null
  startAt: Date | null
  dueAt: Date | null
}

async function resolveUserName(userId: string | null): Promise<string> {
  if (!userId) return "Sin asignar"
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1)
  return u?.name ?? "Sin asignar"
}

async function resolveProjectName(projectId: string | null): Promise<string> {
  if (!projectId) return "Sin proyecto"
  const [p] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1)
  return p?.name ?? "Sin proyecto"
}

function formatDate(date: Date | null): string {
  return date
    ? date.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—"
}

async function buildTaskDiffDescription(old: TaskDiffRow, next: TaskDiffRow): Promise<string | null> {
  const changes: string[] = []

  if (old.title !== next.title) changes.push(`Título: "${old.title}" → "${next.title}"`)
  if (old.priority !== next.priority) changes.push(`Prioridad: ${PRIORITY_LABELS[old.priority]} → ${PRIORITY_LABELS[next.priority]}`)
  if ((old.assignedTo ?? null) !== (next.assignedTo ?? null)) {
    const [oldName, newName] = await Promise.all([resolveUserName(old.assignedTo), resolveUserName(next.assignedTo)])
    changes.push(`Asignado: ${oldName} → ${newName}`)
  }
  if ((old.category ?? null) !== (next.category ?? null)) {
    changes.push(`Categoría: "${old.category ?? "—"}" → "${next.category ?? "—"}"`)
  }
  if ((old.projectId ?? null) !== (next.projectId ?? null)) {
    const [oldName, newName] = await Promise.all([resolveProjectName(old.projectId), resolveProjectName(next.projectId)])
    changes.push(`Proyecto: ${oldName} → ${newName}`)
  }
  if ((old.description ?? null) !== (next.description ?? null)) {
    changes.push(`Descripción: "${old.description ?? "—"}" → "${next.description ?? "—"}"`)
  }
  if ((old.startAt?.getTime() ?? null) !== (next.startAt?.getTime() ?? null)) {
    changes.push(`Inicio: ${formatDate(old.startAt)} → ${formatDate(next.startAt)}`)
  }
  if ((old.dueAt?.getTime() ?? null) !== (next.dueAt?.getTime() ?? null)) {
    changes.push(`Vencimiento: ${formatDate(old.dueAt)} → ${formatDate(next.dueAt)}`)
  }

  return changes.length > 0 ? changes.join(", ") : null
}

async function maybeLogTaskEdit(taskId: string, old: TaskDiffRow, next: TaskDiffRow, userId: string) {
  const description = await buildTaskDiffDescription(old, next)
  if (!description) return
  await logActivity({ entityType: "task", entityId: taskId, action: "updated", description, userId })
}

async function maybeNotifyAssignment(
  taskId: string,
  title: string,
  assignedTo: string | null,
  assignedTeamId: string | null,
  actingUserId: string,
  actorName: string,
) {
  const recipients = await resolveTaskRecipients(assignedTo, assignedTeamId)
  if (recipients.length === 0) return
  await notifyUsers(
    recipients,
    { type: "task_assigned", title: "Nueva tarea asignada", body: `${actorName} te asignó "${title}"` , taskId },
    actingUserId,
  )
}

// Un usuario sin acceso total solo puede dejar la tarea sin asignar o
// asignársela a sí mismo — asignarle trabajo a otro o a un equipo es cosa de admin/supervisor.
function assertCanAssign(session: { role: SessionPayload["role"]; userId: string }, assignedTo: string | null, assignedTeamId: string | null) {
  if (hasFullAccess(session)) return
  if (assignedTeamId) throw new Error("No podés asignar tareas a un equipo")
  if (assignedTo && assignedTo !== session.userId) throw new Error("No podés asignar tareas a otros usuarios")
}

async function resolveUserTeamIds(session: Pick<SessionPayload, "role" | "userId">): Promise<string[]> {
  if (hasFullAccess(session)) return []
  return getUserTeamIds(session.userId)
}

function weekdaysToCsv(weekdays: number[] | null): string | null {
  return weekdays && weekdays.length > 0 ? weekdays.join(",") : null
}

function buildRecurrenceRule(row: {
  recurrenceFreq: RecurrenceFreq | null
  recurrenceWeekdays: string | null
  recurrenceDayOfMonth: number | null
  recurrenceMonth: number | null
  recurrenceTime: string | null
  recurrenceEndDate: Date | null
}): RecurrenceRule | null {
  if (!row.recurrenceFreq) return null
  return {
    freq: row.recurrenceFreq,
    weekdays: parseWeekdaysCsv(row.recurrenceWeekdays),
    dayOfMonth: row.recurrenceDayOfMonth,
    month: row.recurrenceMonth,
    time: row.recurrenceTime,
    endDate: row.recurrenceEndDate,
  }
}

async function replaceReminders(taskId: string, offsets: number[]) {
  await db.delete(taskReminders).where(eq(taskReminders.taskId, taskId))
  const unique = Array.from(new Set(offsets)).filter((n) => Number.isFinite(n) && n >= 0)
  if (unique.length === 0) return
  await db.insert(taskReminders).values(unique.map((offsetMinutes) => ({ taskId, offsetMinutes })))
}

interface GeneratedTaskTemplate {
  title: string
  description: string | null
  category: string | null
  projectId: string | null
  createdBy: string
  assignedTo: string | null
  assignedTeamId: string | null
  assignedBy: string | null
  priority: TaskPriority
  recurrenceFreq: RecurrenceFreq | null
  recurrenceWeekdays: string | null
  recurrenceDayOfMonth: number | null
  recurrenceMonth: number | null
  recurrenceTime: string | null
  recurrenceEndDate: Date | null
  startAt: Date | null
  dueAt: Date | null
}

// Al completar una tarea diaria/mensual/anual se genera la siguiente
// ocurrencia. La semanal-con-días-específicos se genera en lote (al crearla
// y por el cron de fin de mes), así que no pasa por acá.
async function maybeGenerateNextOccurrence(taskId: string, template: GeneratedTaskTemplate) {
  const rule = buildRecurrenceRule(template)
  if (!rule || rule.freq === "weekly") return

  const nextDueAt = computeNextSingleOccurrence(rule, template.dueAt ?? template.startAt ?? new Date())
  if (rule.endDate && nextDueAt > rule.endDate) return

  const delta = template.dueAt ? nextDueAt.getTime() - template.dueAt.getTime() : 0
  const nextStartAt = template.startAt ? new Date(template.startAt.getTime() + delta) : null

  const [created] = await db
    .insert(tasks)
    .values({
      title: template.title,
      description: template.description,
      category: template.category,
      projectId: template.projectId,
      createdBy: template.createdBy,
      assignedTo: template.assignedTo,
      assignedTeamId: template.assignedTeamId,
      assignedBy: template.assignedBy,
      status: "todo",
      priority: template.priority,
      recurrenceFreq: template.recurrenceFreq,
      recurrenceWeekdays: template.recurrenceWeekdays,
      recurrenceDayOfMonth: template.recurrenceDayOfMonth,
      recurrenceMonth: template.recurrenceMonth,
      recurrenceTime: template.recurrenceTime,
      recurrenceEndDate: template.recurrenceEndDate,
      recurrenceParentId: taskId,
      startAt: nextStartAt,
      dueAt: nextDueAt,
    })
    .returning({ id: tasks.id })

  const recipients = await resolveTaskRecipients(template.assignedTo, template.assignedTeamId)
  if (recipients.length > 0) {
    await notifyUsers(recipients, {
      type: "task_assigned",
      title: "Nueva tarea recurrente",
      body: `Se generó la siguiente ocurrencia de "${template.title}"`,
      taskId: created.id,
    })
  }
}

// El primer lote de una tarea "semanal con días específicos": el resto de
// las fechas de ese mes que matchean los días elegidos, además de la ya creada.
async function maybeCreateWeeklyBatch(rootId: string, template: GeneratedTaskTemplate) {
  const rule = buildRecurrenceRule(template)
  if (!rule || rule.freq !== "weekly" || !template.dueAt || !rule.weekdays) return

  const dates = computeWeeklyBatchForMonth(rule, template.dueAt, template.dueAt).filter(
    (d) => d.getTime() !== template.dueAt!.getTime() && (!rule.endDate || d <= rule.endDate),
  )
  if (dates.length === 0) return

  await db.insert(tasks).values(
    dates.map((dueAt) => ({
      title: template.title,
      description: template.description,
      category: template.category,
      projectId: template.projectId,
      createdBy: template.createdBy,
      assignedTo: template.assignedTo,
      assignedTeamId: template.assignedTeamId,
      assignedBy: template.assignedBy,
      status: "todo" as const,
      priority: template.priority,
      recurrenceFreq: template.recurrenceFreq,
      recurrenceWeekdays: template.recurrenceWeekdays,
      recurrenceTime: template.recurrenceTime,
      recurrenceEndDate: template.recurrenceEndDate,
      recurrenceParentId: rootId,
      dueAt,
    })),
  )
}

interface TaskFormData {
  title: string
  description: string | null
  category: string | null
  projectId: string | null
  assignedTo: string | null
  assignedTeamId: string | null
  status: TaskStatus
  priority: TaskPriority
  startAt: Date | null
  dueAt: Date | null
  cancelReason: string | null
  recurrence: RecurrenceRule | null
  reminders: number[]
}

function assertExclusiveAssignment(assignedTo: string | null, assignedTeamId: string | null) {
  if (assignedTo && assignedTeamId) {
    throw new Error("Una tarea no puede estar asignada a un usuario y a un equipo a la vez")
  }
}

function resolveCancelReason(status: TaskStatus, cancelReason: string | null): string | null {
  if (status !== "cancelled") return null
  const trimmed = cancelReason?.trim() ?? ""
  if (!trimmed) throw new Error("Para cancelar una tarea tenés que indicar un motivo")
  return trimmed
}

export async function createTask(data: TaskFormData) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")
  assertExclusiveAssignment(data.assignedTo, data.assignedTeamId)
  assertCanAssign(session, data.assignedTo || null, data.assignedTeamId || null)
  const cancelReason = resolveCancelReason(data.status, data.cancelReason)

  const [created] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description || null,
      category: data.category || null,
      projectId: data.projectId || null,
      createdBy: session.userId,
      assignedTo: data.assignedTo || null,
      assignedTeamId: data.assignedTeamId || null,
      assignedBy: data.assignedTo || data.assignedTeamId ? session.userId : null,
      status: data.status,
      priority: data.priority,
      cancelReason,
      recurrenceFreq: data.recurrence?.freq ?? null,
      recurrenceWeekdays: weekdaysToCsv(data.recurrence?.weekdays ?? null),
      recurrenceDayOfMonth: data.recurrence?.dayOfMonth ?? null,
      recurrenceMonth: data.recurrence?.month ?? null,
      recurrenceTime: data.recurrence?.time ?? null,
      recurrenceEndDate: data.recurrence?.endDate ?? null,
      startAt: data.startAt,
      dueAt: data.dueAt,
    })
    .returning({ id: tasks.id })

  await logActivity({
    entityType: "task",
    entityId: created.id,
    action: "created",
    description: `Creó la tarea "${data.title}"`,
    userId: session.userId,
  })

  await maybeNotifyAssignment(created.id, data.title, data.assignedTo, data.assignedTeamId, session.userId, session.name)
  await replaceReminders(created.id, data.reminders)

  if (data.recurrence?.freq === "weekly") {
    await maybeCreateWeeklyBatch(created.id, {
      title: data.title,
      description: data.description || null,
      category: data.category || null,
      projectId: data.projectId || null,
      createdBy: session.userId,
      assignedTo: data.assignedTo || null,
      assignedTeamId: data.assignedTeamId || null,
      assignedBy: data.assignedTo || data.assignedTeamId ? session.userId : null,
      priority: data.priority,
      recurrenceFreq: data.recurrence.freq,
      recurrenceWeekdays: weekdaysToCsv(data.recurrence.weekdays),
      recurrenceDayOfMonth: data.recurrence.dayOfMonth,
      recurrenceMonth: data.recurrence.month,
      recurrenceTime: data.recurrence.time,
      recurrenceEndDate: data.recurrence.endDate,
      startAt: data.startAt,
      dueAt: data.dueAt,
    })
  }

  refresh()
}

export async function updateTask(id: string, data: TaskFormData) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const [current] = await db
    .select({
      status: tasks.status,
      title: tasks.title,
      priority: tasks.priority,
      assignedTo: tasks.assignedTo,
      assignedTeamId: tasks.assignedTeamId,
      description: tasks.description,
      category: tasks.category,
      projectId: tasks.projectId,
      startAt: tasks.startAt,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)

  const userTeamIds = await resolveUserTeamIds(session)
  if (current && !canManageTask(session, current, userTeamIds)) {
    throw new Error("No autorizado")
  }
  assertExclusiveAssignment(data.assignedTo, data.assignedTeamId)
  assertCanAssign(session, data.assignedTo || null, data.assignedTeamId || null)
  const cancelReason = resolveCancelReason(data.status, data.cancelReason)

  const assignmentChanged =
    (current?.assignedTo ?? null) !== (data.assignedTo || null) || (current?.assignedTeamId ?? null) !== (data.assignedTeamId || null)
  const dueAtChanged = (current?.dueAt?.getTime() ?? null) !== (data.dueAt?.getTime() ?? null)

  await db
    .update(tasks)
    .set({
      title: data.title,
      description: data.description || null,
      category: data.category || null,
      projectId: data.projectId || null,
      assignedTo: data.assignedTo || null,
      assignedTeamId: data.assignedTeamId || null,
      assignedBy: assignmentChanged ? (data.assignedTo || data.assignedTeamId ? session.userId : null) : undefined,
      status: data.status,
      priority: data.priority,
      cancelReason,
      recurrenceFreq: data.recurrence?.freq ?? null,
      recurrenceWeekdays: weekdaysToCsv(data.recurrence?.weekdays ?? null),
      recurrenceDayOfMonth: data.recurrence?.dayOfMonth ?? null,
      recurrenceMonth: data.recurrence?.month ?? null,
      recurrenceTime: data.recurrence?.time ?? null,
      recurrenceEndDate: data.recurrence?.endDate ?? null,
      startAt: data.startAt,
      dueAt: data.dueAt,
      // Si cambia el vencimiento, hay que volver a avisar "vencida".
      overdueNotifiedAt: dueAtChanged ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))

  await replaceReminders(id, data.reminders)

  if (current) {
    await maybeLogStatusChange(id, current.status, data.status, session.userId, cancelReason)
    await maybeLogTaskEdit(
      id,
      current,
      {
        title: data.title,
        priority: data.priority,
        assignedTo: data.assignedTo || null,
        description: data.description || null,
        category: data.category || null,
        projectId: data.projectId || null,
        startAt: data.startAt,
        dueAt: data.dueAt,
      },
      session.userId,
    )

    if (current.status !== "done" && data.status === "done") {
      await maybeGenerateNextOccurrence(id, {
        title: data.title,
        description: data.description || null,
        category: data.category || null,
        projectId: data.projectId || null,
        createdBy: session.userId,
        assignedTo: data.assignedTo || null,
        assignedTeamId: data.assignedTeamId || null,
        assignedBy: data.assignedTo || data.assignedTeamId ? session.userId : null,
        priority: data.priority,
        recurrenceFreq: data.recurrence?.freq ?? null,
        recurrenceWeekdays: weekdaysToCsv(data.recurrence?.weekdays ?? null),
        recurrenceDayOfMonth: data.recurrence?.dayOfMonth ?? null,
        recurrenceMonth: data.recurrence?.month ?? null,
        recurrenceTime: data.recurrence?.time ?? null,
        recurrenceEndDate: data.recurrence?.endDate ?? null,
        startAt: data.startAt,
        dueAt: data.dueAt,
      })
    }
  }

  if (assignmentChanged) {
    await maybeNotifyAssignment(id, data.title, data.assignedTo, data.assignedTeamId, session.userId, session.name)
  }

  refresh()
}

export async function deleteTask(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")
  if (!hasFullAccess(session)) throw new Error("No tenés permisos para eliminar tareas")

  const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).limit(1)
  if (!task) throw new Error("Tarea no encontrada")

  await db.delete(tasks).where(eq(tasks.id, id))
  refresh()
}

export async function updateTaskStatus(id: string, status: TaskStatus, cancelReason?: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const [current] = await db
    .select({
      status: tasks.status,
      assignedTo: tasks.assignedTo,
      assignedTeamId: tasks.assignedTeamId,
      assignedBy: tasks.assignedBy,
      createdBy: tasks.createdBy,
      title: tasks.title,
      description: tasks.description,
      category: tasks.category,
      projectId: tasks.projectId,
      priority: tasks.priority,
      startAt: tasks.startAt,
      dueAt: tasks.dueAt,
      recurrenceFreq: tasks.recurrenceFreq,
      recurrenceWeekdays: tasks.recurrenceWeekdays,
      recurrenceDayOfMonth: tasks.recurrenceDayOfMonth,
      recurrenceMonth: tasks.recurrenceMonth,
      recurrenceTime: tasks.recurrenceTime,
      recurrenceEndDate: tasks.recurrenceEndDate,
    })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)

  const userTeamIds = await resolveUserTeamIds(session)
  if (current && !canManageTask(session, current, userTeamIds)) {
    throw new Error("No autorizado")
  }

  const resolvedReason = resolveCancelReason(status, cancelReason ?? null)

  await db.update(tasks).set({ status, cancelReason: resolvedReason, updatedAt: new Date() }).where(eq(tasks.id, id))

  if (current) {
    await maybeLogStatusChange(id, current.status, status, session.userId, resolvedReason)

    if (current.status !== "done" && status === "done") {
      await maybeGenerateNextOccurrence(id, {
        title: current.title,
        description: current.description,
        category: current.category,
        projectId: current.projectId,
        createdBy: current.createdBy,
        assignedTo: current.assignedTo,
        assignedTeamId: current.assignedTeamId,
        assignedBy: current.assignedBy,
        priority: current.priority,
        recurrenceFreq: current.recurrenceFreq,
        recurrenceWeekdays: current.recurrenceWeekdays,
        recurrenceDayOfMonth: current.recurrenceDayOfMonth,
        recurrenceMonth: current.recurrenceMonth,
        recurrenceTime: current.recurrenceTime,
        recurrenceEndDate: current.recurrenceEndDate,
        startAt: current.startAt,
        dueAt: current.dueAt,
      })
    }
  }

  refresh()
}

export async function addTaskComment(id: string, body: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const trimmed = body.trim()
  if (!trimmed) throw new Error("El comentario no puede estar vacío")

  const [task] = await db
    .select({ assignedTo: tasks.assignedTo, assignedTeamId: tasks.assignedTeamId, createdBy: tasks.createdBy, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)
  if (!task) throw new Error("Tarea no encontrada")

  const userTeamIds = await resolveUserTeamIds(session)
  if (!canManageTask(session, task, userTeamIds)) throw new Error("No autorizado")

  await db.insert(taskComments).values({ taskId: id, userId: session.userId, body: trimmed })

  const recipients = new Set(await resolveTaskRecipients(task.assignedTo, task.assignedTeamId))
  recipients.add(task.createdBy)
  await notifyUsers(
    Array.from(recipients),
    { type: "task_comment", title: "Nuevo comentario", body: `${session.name} comentó en "${task.title}"`, taskId: id },
    session.userId,
  )

  refresh()
}

export async function notifyTaskCreator(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const [task] = await db
    .select({ createdBy: tasks.createdBy, title: tasks.title, assignedTo: tasks.assignedTo, assignedTeamId: tasks.assignedTeamId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)
  if (!task) throw new Error("Tarea no encontrada")

  const userTeamIds = await resolveUserTeamIds(session)
  if (!canManageTask(session, task, userTeamIds)) throw new Error("No autorizado")

  if (task.createdBy === session.userId) return

  await notifyUser({
    userId: task.createdBy,
    type: "task_notify_creator",
    title: "Aviso sobre tu tarea",
    body: `${session.name} te avisa sobre la tarea "${task.title}"`,
    taskId: id,
  })
}

export async function getTaskReminders(id: string): Promise<number[]> {
  const session = await getSession()
  if (!session) return []

  const [task] = await db
    .select({ assignedTo: tasks.assignedTo, assignedTeamId: tasks.assignedTeamId })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)
  if (!task) return []

  const userTeamIds = await resolveUserTeamIds(session)
  if (!canManageTask(session, task, userTeamIds)) return []

  const rows = await db.select({ offsetMinutes: taskReminders.offsetMinutes }).from(taskReminders).where(eq(taskReminders.taskId, id))
  return rows.map((r) => r.offsetMinutes).sort((a, b) => b - a)
}

export async function getTaskTimeline(id: string): Promise<TimelineEntry[]> {
  const session = await getSession()
  if (!session) return []

  const [task] = await db.select({ assignedTo: tasks.assignedTo, assignedTeamId: tasks.assignedTeamId }).from(tasks).where(eq(tasks.id, id)).limit(1)
  if (!task) return []

  const userTeamIds = await resolveUserTeamIds(session)
  if (!canManageTask(session, task, userTeamIds)) return []

  return fetchTaskTimeline(id)
}

export async function changeTasksPage(status: TaskStatus, page: number, filters: TasksFilters): Promise<TaskColumn> {
  return getTasksPage({ status, limit: 12, page, ...filters })
}

export async function getCalendarTasks(from: Date, to: Date): Promise<TaskWithRelations[]> {
  return getTasksInRange(from, to)
}
