import "server-only"
import { and, count, desc, eq } from "drizzle-orm"
import { db } from "@/db"
import { notifications } from "@/db/schema/notification"
import { getSession } from "@/lib/session"
import type { NotificationItem } from "@/types/notifications"

export async function getNotifications(limit = 20): Promise<NotificationItem[]> {
  try {
    const session = await getSession()
    if (!session) return []

    return await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        taskId: notifications.taskId,
        read: notifications.read,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, session.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
  } catch {
    return []
  }
}

export async function getUnreadNotificationsCount(): Promise<number> {
  try {
    const session = await getSession()
    if (!session) return 0

    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, session.userId), eq(notifications.read, false)))
    return Number(row?.value ?? 0)
  } catch {
    return 0
  }
}
