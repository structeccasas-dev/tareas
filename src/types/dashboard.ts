import type { TaskStatus } from "./tasks"

export type DashboardRangeKey = "today" | "7d" | "30d" | "custom"

export interface DashboardRange {
  key: DashboardRangeKey
  from: Date
  to: Date
}

export interface DashboardMetrics {
  totalTasks: number
  todoTasks: number
  inProgressTasks: number
  doneTasks: number
  overdueTasks: number
  createdInRange: number
  completedInRange: number
}

export interface DailyPoint {
  date: string
  count: number
}

export interface TaskStatusPoint {
  status: TaskStatus
  count: number
}

export interface MemberOverview {
  id: string
  name: string
  activeTasks: number
  doneTasks: number
}

export type ActivityType = "task_created" | "task_assigned" | "task_status_changed"

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  subtitle: string | null
  createdAt: Date
}
