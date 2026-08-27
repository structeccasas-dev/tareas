export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"

export const UNASSIGNED_SENTINEL = "__unassigned__" as const

export interface Task {
  id: string
  title: string
  description: string | null
  category: string | null
  createdBy: string
  assignedTo: string | null
  assignedBy: string | null
  status: TaskStatus
  priority: TaskPriority
  startAt: Date | null
  dueAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TaskUserRef {
  id: string
  name: string
}

export interface TaskWithRelations extends Task {
  assignedUser: TaskUserRef | null
  createdByUser: TaskUserRef | null
  assignedByUser: TaskUserRef | null
}

export interface TasksStats {
  totalTasks: number
  createdToday: number
  overdue: number
  completionRate: number
  countsByStatus: Record<TaskStatus, number>
}

export interface TasksFilters {
  search?: string
  assignedTo?: string
}

export interface TaskColumn {
  tasks: TaskWithRelations[]
  total: number
  page: number
  totalPages: number
}

export type TasksBoard = Record<TaskStatus, TaskColumn>

export interface UserOption {
  id: string
  name: string
}

export type TimelineEntryType = "activity" | "comment"

export interface TimelineEntry {
  id: string
  type: TimelineEntryType
  description: string
  userName: string
  createdAt: Date
}
