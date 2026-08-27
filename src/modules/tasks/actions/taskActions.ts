"use server"

import { eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { users } from "@/db/schema/user"
import { getSession } from "@/lib/session"
import { logActivity } from "@/lib/activityLog"
import { canManageRecord } from "@/lib/permissions"
import { STATUS_LABELS, PRIORITY_LABELS } from "@/modules/tasks/lib/status"
import type { TaskStatus, TaskPriority, TaskColumn, TasksFilters } from "@/types/tasks"
import type { ActivityEntry } from "@/types/activity"
import { getTasksPage, getTaskActivity as fetchTaskActivity } from "@/modules/tasks/data/queries"

function buildStatusChangeDescription(oldStatus: TaskStatus, newStatus: TaskStatus): string {
  return `Cambió el estado de "${STATUS_LABELS[oldStatus]}" a "${STATUS_LABELS[newStatus]}"`
}

async function maybeLogStatusChange(taskId: string, oldStatus: TaskStatus, newStatus: TaskStatus, userId: string) {
  if (oldStatus === newStatus) return
  await logActivity({
    entityType: "task",
    entityId: taskId,
    action: "status_changed",
    description: buildStatusChangeDescription(oldStatus, newStatus),
    userId,
  })
}

interface TaskDiffRow {
  title: string
  priority: TaskPriority
  assignedTo: string | null
  description: string | null
  dueAt: Date | null
}

async function resolveUserName(userId: string | null): Promise<string> {
  if (!userId) return "Sin asignar"
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1)
  return u?.name ?? "Sin asignar"
}

function formatDueDate(date: Date | null): string {
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
  if ((old.description ?? null) !== (next.description ?? null)) {
    changes.push(`Descripción: "${old.description ?? "—"}" → "${next.description ?? "—"}"`)
  }
  if ((old.dueAt?.getTime() ?? null) !== (next.dueAt?.getTime() ?? null)) {
    changes.push(`Vencimiento: ${formatDueDate(old.dueAt)} → ${formatDueDate(next.dueAt)}`)
  }

  return changes.length > 0 ? changes.join(", ") : null
}

async function maybeLogTaskEdit(taskId: string, old: TaskDiffRow, next: TaskDiffRow, userId: string) {
  const description = await buildTaskDiffDescription(old, next)
  if (!description) return
  await logActivity({ entityType: "task", entityId: taskId, action: "updated", description, userId })
}

interface TaskFormData {
  title: string
  description: string | null
  assignedTo: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt: Date | null
}

export async function createTask(data: TaskFormData) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const [created] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description || null,
      assignedTo: data.assignedTo || null,
      status: data.status,
      priority: data.priority,
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
      description: tasks.description,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1)

  if (current && !canManageRecord(session, current.assignedTo)) {
    throw new Error("No autorizado")
  }

  await db
    .update(tasks)
    .set({
      title: data.title,
      description: data.description || null,
      assignedTo: data.assignedTo || null,
      status: data.status,
      priority: data.priority,
      dueAt: data.dueAt,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))

  if (current) {
    await maybeLogStatusChange(id, current.status, data.status, session.userId)
    await maybeLogTaskEdit(
      id,
      current,
      {
        title: data.title,
        priority: data.priority,
        assignedTo: data.assignedTo || null,
        description: data.description || null,
        dueAt: data.dueAt,
      },
      session.userId,
    )
  }

  refresh()
}

export async function deleteTask(id: string) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const [task] = await db.select({ assignedTo: tasks.assignedTo }).from(tasks).where(eq(tasks.id, id)).limit(1)
  if (!task) throw new Error("Tarea no encontrada")
  if (!canManageRecord(session, task.assignedTo)) throw new Error("No autorizado")

  await db.delete(tasks).where(eq(tasks.id, id))
  refresh()
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const session = await getSession()
  if (!session) throw new Error("No autenticado")

  const [current] = await db.select({ status: tasks.status, assignedTo: tasks.assignedTo }).from(tasks).where(eq(tasks.id, id)).limit(1)

  if (current && !canManageRecord(session, current.assignedTo)) {
    throw new Error("No autorizado")
  }

  await db.update(tasks).set({ status, updatedAt: new Date() }).where(eq(tasks.id, id))

  if (current) {
    await maybeLogStatusChange(id, current.status, status, session.userId)
  }

  refresh()
}

export async function getTaskActivity(id: string): Promise<ActivityEntry[]> {
  const session = await getSession()
  if (!session) return []

  const [task] = await db.select({ assignedTo: tasks.assignedTo }).from(tasks).where(eq(tasks.id, id)).limit(1)
  if (!task || !canManageRecord(session, task.assignedTo)) return []

  return fetchTaskActivity(id)
}

export async function changeTasksPage(status: TaskStatus, page: number, filters: TasksFilters): Promise<TaskColumn> {
  return getTasksPage({ status, limit: 12, page, ...filters })
}
