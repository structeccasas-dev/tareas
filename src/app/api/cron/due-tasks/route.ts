import "server-only"
import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { notifyUser } from "@/lib/notify"
import { getDueSoonCandidates, getOverdueCandidates } from "@/modules/tasks/data/queries"

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

  const [dueSoon, overdue] = await Promise.all([getDueSoonCandidates(), getOverdueCandidates()])

  let sent = 0

  for (const task of dueSoon) {
    await notifyUser({
      userId: task.assignedTo,
      type: "task_due_soon",
      title: `Tarea próxima a vencer: ${task.title}`,
      body: `Vence a las ${task.dueAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
      taskId: task.id,
    })
    await db.update(tasks).set({ dueSoonNotifiedAt: new Date() }).where(eq(tasks.id, task.id))
    sent++
  }

  for (const task of overdue) {
    await notifyUser({
      userId: task.assignedTo,
      type: "task_overdue",
      title: `Tarea vencida: ${task.title}`,
      body: "Esta tarea pasó su fecha límite.",
      taskId: task.id,
    })
    await db.update(tasks).set({ overdueNotifiedAt: new Date() }).where(eq(tasks.id, task.id))
    sent++
  }

  return new Response(`OK — ${sent} notificaciones enviadas (${dueSoon.length} por vencer, ${overdue.length} vencidas)`, {
    status: 200,
  })
}
