export type NotificationType = "task_assigned" | "task_reminder" | "task_overdue" | "task_comment" | "task_notify_creator"

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  taskId: string | null
  read: boolean
  createdAt: Date
}
