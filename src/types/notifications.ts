export type NotificationType = "task_assigned" | "task_due_soon" | "task_overdue"

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  taskId: string | null
  read: boolean
  createdAt: Date
}
