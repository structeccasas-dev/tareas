export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export const UNASSIGNED_SENTINEL = "__unassigned__" as const

export interface Task {
  id: string
  title: string
  description: string | null
  assignedTo: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TaskWithRelations extends Task {
  assignedUser: {
    id: string
    name: string
  } | null
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
