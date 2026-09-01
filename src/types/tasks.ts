export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly"

export const UNASSIGNED_SENTINEL = "__unassigned__" as const
export const NO_PROJECT_SENTINEL = "__no_project__" as const

export interface RecurrenceRule {
  freq: RecurrenceFreq
  weekdays: number[] | null // 0-6, sólo "weekly"
  dayOfMonth: number | null // 1-31, "monthly"/"yearly"
  month: number | null // 1-12, sólo "yearly"
  time: string | null // "HH:mm"
  endDate: Date | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  category: string | null
  projectId: string | null
  createdBy: string
  assignedTo: string | null
  assignedTeamId: string | null
  assignedBy: string | null
  status: TaskStatus
  priority: TaskPriority
  cancelReason: string | null
  recurrenceFreq: RecurrenceFreq | null
  recurrenceWeekdays: string | null
  recurrenceDayOfMonth: number | null
  recurrenceMonth: number | null
  recurrenceTime: string | null
  recurrenceEndDate: Date | null
  recurrenceParentId: string | null
  startAt: Date | null
  dueAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface TaskUserRef {
  id: string
  name: string
}

export interface TaskTeamRef {
  id: string
  name: string
}

export interface TaskProjectRef {
  id: string
  name: string
}

export interface TaskWithRelations extends Task {
  assignedUser: TaskUserRef | null
  assignedTeam: TaskTeamRef | null
  project: TaskProjectRef | null
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
  project?: string
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

export interface TeamOption {
  id: string
  name: string
}

export interface ProjectOption {
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
