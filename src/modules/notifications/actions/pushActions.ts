"use server"

import { db } from "@/db"
import { pushSubscriptions } from "@/db/schema/pushSubscription"
import { getSession } from "@/lib/session"

interface PushSubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export async function saveSubscription(subscription: PushSubscriptionInput): Promise<{ ok: boolean }> {
  const session = await getSession()
  if (!session) return { ok: false }

  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: session.userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    })

  return { ok: true }
}
