import "server-only"
import webpush from "web-push"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { pushSubscriptions } from "@/db/schema/pushSubscription"

let vapidConfigured = false

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true
  const vapidSubject = process.env.VAPID_SUBJECT
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) return false
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  vapidConfigured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

// Envía una notificación push a todas las suscripciones activas de un usuario.
// Limpia las suscripciones que el navegador ya dio de baja (404/410).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return

  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  const body = JSON.stringify(payload)

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        body,
      )
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id))
      } else {
        console.error("Error al enviar push:", err)
      }
    }
  }
}
