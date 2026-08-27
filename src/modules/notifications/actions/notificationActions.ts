"use server"

import { and, eq } from "drizzle-orm"
import { refresh } from "next/cache"
import { db } from "@/db"
import { notifications } from "@/db/schema/notification"
import { getSession } from "@/lib/session"
import { getNotifications } from "@/modules/notifications/data/queries"
import type { NotificationItem } from "@/types/notifications"

export async function fetchNotifications(): Promise<NotificationItem[]> {
  return getNotifications()
}

export async function markNotificationRead(id: string): Promise<void> {
  const session = await getSession()
  if (!session) return

  await db.update(notifications).set({ read: true }).where(and(eq(notifications.id, id), eq(notifications.userId, session.userId)))
  refresh()
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession()
  if (!session) return

  await db.update(notifications).set({ read: true }).where(and(eq(notifications.userId, session.userId), eq(notifications.read, false)))
  refresh()
}
