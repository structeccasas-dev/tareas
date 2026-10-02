import "server-only"
import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"
import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { taskReminders } from "@/db/schema/taskReminder"
import { notifyUsersBatch, type NotifyBatchJob } from "@/lib/notify"
import { getPendingReminders, getOverdueCandidates } from "@/modules/tasks/data/queries"
import { getTeamMembersGroupedByTeam } from "@/modules/teams/data/queries"
import { generateUpcomingWeeklyBatches } from "@/modules/tasks/lib/recurrenceJobs"

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get("authorization")
  if (!secret || !header) return false

  const provided = header.replace(/^Bearer\s+/i, "")
  const secretBuf = Buffer.from(secret)
  const providedBuf = Buffer.from(provided)
  if (secretBuf.length !== providedBuf.length) return false

  return timingSafeEqual(secretBuf, providedBuf)
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const [reminders, overdue] = await Promise.all([getPendingReminders(), getOverdueCandidates()])

  // Resuelve los equipos involucrados con una sola query en vez de una por
  // reminder/tarea (evita el N+1 que disparaba una query de teamMembers por ítem).
  const teamIds = Array.from(
    new Set([...reminders, ...overdue].map((r) => r.assignedTeamId).filter((id): id is string => id !== null)),
  )
  const teamMembers = await getTeamMembersGroupedByTeam(teamIds)

  function recipientsFor(assignedTo: string | null, assignedTeamId: string | null): string[] {
    if (assignedTo) return [assignedTo]
    if (assignedTeamId) return teamMembers.get(assignedTeamId) ?? []
    return []
  }

  let sent = 0
  const jobs: NotifyBatchJob[] = []

  for (const reminder of reminders) {
    const recipients = recipientsFor(reminder.assignedTo, reminder.assignedTeamId)
    if (recipients.length > 0) {
      jobs.push({
        userIds: recipients,
        type: "task_reminder",
        title: `Recordatorio: ${reminder.title}`,
        body: `Vence a las ${reminder.dueAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
        taskId: reminder.taskId,
      })
      sent += recipients.length
    }
  }

  for (const task of overdue) {
    const recipients = recipientsFor(task.assignedTo, task.assignedTeamId)
    if (recipients.length > 0) {
      jobs.push({
        userIds: recipients,
        type: "task_overdue",
        title: `Tarea vencida: ${task.title}`,
        body: "Esta tarea pasó su fecha límite.",
        taskId: task.id,
      })
      sent += recipients.length
    }
  }

  // Un solo INSERT batcheado de notifications + una sola query de push
  // subscriptions, en vez de uno por destinatario dentro de cada loop.
  await notifyUsersBatch(jobs)

  if (reminders.length > 0) {
    await db
      .update(taskReminders)
      .set({ notifiedAt: new Date() })
      .where(
        inArray(
          taskReminders.id,
          reminders.map((r) => r.reminderId),
        ),
      )
  }

  if (overdue.length > 0) {
    await db
      .update(tasks)
      .set({ overdueNotifiedAt: new Date() })
      .where(
        inArray(
          tasks.id,
          overdue.map((t) => t.id),
        ),
      )
  }

  const weeklyBatchesCreated = await generateUpcomingWeeklyBatches()

  return new Response(
    `OK — ${sent} notificaciones enviadas (${reminders.length} recordatorios, ${overdue.length} vencidas), ${weeklyBatchesCreated} ocurrencias semanales generadas`,
    { status: 200 },
  )
}
