import "server-only"
import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { taskReminders } from "@/db/schema/taskReminder"
import { notifyUsers } from "@/lib/notify"
import { getPendingReminders, getOverdueCandidates, resolveTaskRecipients } from "@/modules/tasks/data/queries"
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

  let sent = 0

  for (const reminder of reminders) {
    const recipients = await resolveTaskRecipients(reminder.assignedTo, reminder.assignedTeamId)
    if (recipients.length > 0) {
      await notifyUsers(recipients, {
        type: "task_reminder",
        title: `Recordatorio: ${reminder.title}`,
        body: `Vence a las ${reminder.dueAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
        taskId: reminder.taskId,
      })
      sent += recipients.length
    }
    await db.update(taskReminders).set({ notifiedAt: new Date() }).where(eq(taskReminders.id, reminder.reminderId))
  }

  for (const task of overdue) {
    const recipients = await resolveTaskRecipients(task.assignedTo, task.assignedTeamId)
    if (recipients.length > 0) {
      await notifyUsers(recipients, {
        type: "task_overdue",
        title: `Tarea vencida: ${task.title}`,
        body: "Esta tarea pasó su fecha límite.",
        taskId: task.id,
      })
      sent += recipients.length
    }
    await db.update(tasks).set({ overdueNotifiedAt: new Date() }).where(eq(tasks.id, task.id))
  }

  const weeklyBatchesCreated = await generateUpcomingWeeklyBatches()

  return new Response(
    `OK — ${sent} notificaciones enviadas (${reminders.length} recordatorios, ${overdue.length} vencidas), ${weeklyBatchesCreated} ocurrencias semanales generadas`,
    { status: 200 },
  )
}
