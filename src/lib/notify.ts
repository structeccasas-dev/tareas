import "server-only"
import { db } from "@/db"
import { notifications } from "@/db/schema/notification"
import { sendPushToUser, sendPushToUsers } from "@/lib/push"
import type { NotificationType } from "@/types/notifications"

interface NotifyUserParams {
  userId: string
  type: NotificationType
  title: string
  body: string
  taskId?: string
  personnelId?: string
  url?: string
}

// Crea el registro de notificación in-app y, si el usuario tiene push
// habilitado, también le manda la notificación del sistema operativo.
export async function notifyUser({ userId, type, title, body, taskId, personnelId, url }: NotifyUserParams): Promise<void> {
  await db.insert(notifications).values({ userId, type, title, body, taskId: taskId ?? null, personnelId: personnelId ?? null })
  await sendPushToUser(userId, { title, body, url: url ?? "/tareas", tag: taskId ?? personnelId })
}

// Igual que notifyUser, pero a varios destinatarios a la vez (ej. todos los
// miembros de un equipo), salteando opcionalmente al que disparó la acción.
export async function notifyUsers(
  userIds: string[],
  params: Omit<NotifyUserParams, "userId">,
  excludeUserId?: string,
): Promise<void> {
  const recipients = userIds.filter((id) => id !== excludeUserId)
  await notifyUsersBatch([{ ...params, userIds: recipients }])
}

export interface NotifyBatchJob {
  userIds: string[]
  type: NotificationType
  title: string
  body: string
  taskId?: string
  personnelId?: string
  url?: string
}

// Versión batcheada de notifyUsers para cuando hay muchos jobs de notificación
// a la vez (ej. el cron de tareas recorriendo varios recordatorios/vencidas):
// un solo INSERT y una sola query de suscripciones push en vez de uno por
// destinatario, evitando el N+1 de llamar notifyUsers dentro de un loop.
export async function notifyUsersBatch(jobs: NotifyBatchJob[]): Promise<void> {
  const rows = jobs.flatMap((job) =>
    job.userIds.map((userId) => ({
      userId,
      type: job.type,
      title: job.title,
      body: job.body,
      taskId: job.taskId ?? null,
      personnelId: job.personnelId ?? null,
    })),
  )
  if (rows.length === 0) return

  await db.insert(notifications).values(rows)

  await sendPushToUsers(
    jobs.flatMap((job) =>
      job.userIds.map((userId) => ({
        userId,
        payload: { title: job.title, body: job.body, url: job.url ?? "/tareas", tag: job.taskId ?? job.personnelId },
      })),
    ),
  )
}
