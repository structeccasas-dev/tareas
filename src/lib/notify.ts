import "server-only"
import { db } from "@/db"
import { notifications } from "@/db/schema/notification"
import { sendPushToUser } from "@/lib/push"
import type { NotificationType } from "@/types/notifications"

interface NotifyUserParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  taskId?: string
  url?: string
}

// Crea el registro de notificación in-app y, si el usuario tiene push
// habilitado, también le manda la notificación del sistema operativo.
export async function notifyUser({ userId, type, title, body, taskId, url }: NotifyUserParams): Promise<void> {
  await db.insert(notifications).values({ userId, type, title, body, taskId: taskId ?? null })
  await sendPushToUser(userId, { title, body, url: url ?? "/tareas", tag: taskId })
}
