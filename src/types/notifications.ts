export type NotificationType =
  | "task_assigned"
  | "task_reminder"
  | "task_overdue"
  | "task_comment"
  | "task_notify_creator"
  | "leave_requested"
  | "leave_approved"
  | "leave_rejected"

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  body: string | null
  taskId: string | null
  personnelId: string | null
  read: boolean
  createdAt: Date
}
