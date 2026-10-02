import "server-only"
import webpush from "web-push"
import { eq, inArray } from "drizzle-orm"
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

type Subscription = typeof pushSubscriptions.$inferSelect

// Tope de envíos simultáneos al servicio push — evita abrir cientos de
// conexiones a la vez cuando el cron notifica a muchos usuarios.
const PUSH_CONCURRENCY = 20

// Si el dispositivo está offline, el servicio push descarta el aviso pasada
// esta ventana en vez de entregarlo horas tarde.
const PUSH_OPTIONS = { TTL: 60 * 60 }

// Envía a una suscripción; devuelve su id si el navegador ya la dio de baja
// (404/410) para que el caller la limpie en bloque.
async function deliver(subscription: Subscription, body: string): Promise<string | null> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      body,
      PUSH_OPTIONS,
    )
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) return subscription.id
    console.error("Error al enviar push:", err)
  }
  return null
}

async function deliverAll(deliveries: { subscription: Subscription; body: string }[]): Promise<void> {
  const staleIds: string[] = []
  let next = 0

  async function worker() {
    while (next < deliveries.length) {
      const { subscription, body } = deliveries[next++]
      const stale = await deliver(subscription, body)
      if (stale) staleIds.push(stale)
    }
  }

  await Promise.all(Array.from({ length: Math.min(PUSH_CONCURRENCY, deliveries.length) }, worker))

  if (staleIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, staleIds))
  }
}

// Envía una notificación push a todas las suscripciones activas de un usuario.
// Limpia las suscripciones que el navegador ya dio de baja (404/410).
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapidConfigured()) return

  // Tope defensivo: nadie tiene decenas de dispositivos reales, así que esto
  // solo protege contra una tabla que creció de forma anómala para un usuario.
  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).limit(20)
  const body = JSON.stringify(payload)
  await deliverAll(subscriptions.map((subscription) => ({ subscription, body })))
}

export interface PushJob {
  userId: string
  payload: PushPayload
}

// Igual que sendPushToUser, pero para muchos destinatarios a la vez: resuelve
// todas las suscripciones en una sola query en vez de una por usuario. Pensado
// para jobs batch (ej. el cron de tareas) donde sendPushToUser generaría N+1.
export async function sendPushToUsers(jobs: PushJob[]): Promise<void> {
  if (!ensureVapidConfigured() || jobs.length === 0) return

  const userIds = Array.from(new Set(jobs.map((j) => j.userId)))
  const subscriptions = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds))

  const subsByUser = new Map<string, Subscription[]>()
  for (const subscription of subscriptions) {
    const list = subsByUser.get(subscription.userId) ?? []
    if (list.length < 20) list.push(subscription) // mismo tope defensivo que sendPushToUser
    subsByUser.set(subscription.userId, list)
  }

  await deliverAll(
    jobs.flatMap((job) => {
      const body = JSON.stringify(job.payload)
      return (subsByUser.get(job.userId) ?? []).map((subscription) => ({ subscription, body }))
    }),
  )
}
