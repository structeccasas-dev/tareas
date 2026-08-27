import "server-only"
import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"
import webpush from "web-push"
import { db } from "@/db"
import { pushSubscriptions } from "@/db/schema/pushSubscription"
import { eq } from "drizzle-orm"
import { getDueTasksForNotification } from "@/modules/tasks/data/queries"

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

  const vapidSubject = process.env.VAPID_SUBJECT
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return new Response("Push no configurado", { status: 500 })
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  const dueTasks = await getDueTasksForNotification()
  if (dueTasks.length === 0) {
    return new Response("Sin tareas vencidas", { status: 200 })
  }

  const tasksByUser = new Map<string, typeof dueTasks>()
  for (const task of dueTasks) {
    const list = tasksByUser.get(task.assignedTo) ?? []
    list.push(task)
    tasksByUser.set(task.assignedTo, list)
  }

  let sent = 0
  let cleaned = 0

  for (const [userId, userTasks] of tasksByUser) {
    const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))

    for (const subscription of subscriptions) {
      for (const task of userTasks) {
        const payload = JSON.stringify({
          title: `Tarea vencida: ${task.title}`,
          body: "Tenés una tarea pendiente de vencimiento.",
          url: "/tareas",
          tag: task.id,
        })

        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
          )
          sent++
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode
          if (statusCode === 404 || statusCode === 410) {
            await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id))
            cleaned++
          } else {
            console.error("Error al enviar push:", err)
          }
        }
      }
    }
  }

  return new Response(`OK — ${sent} enviadas, ${cleaned} suscripciones expiradas eliminadas`, { status: 200 })
}
