import type { TaskStatus, TaskPriority } from "@/types/tasks"
import type { BadgeTone } from "@/components/Badge"

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Para hacer",
  in_progress: "En progreso",
  done: "Finalizado",
}

export const STATUS_TONE: Record<TaskStatus, "neutral" | "info" | "primary"> = {
  todo: "neutral",
  in_progress: "info",
  done: "primary",
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
}

export const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "error",
}

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-gray-300",
  medium: "bg-blue-400",
  high: "bg-red-400",
}

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-400",
  done: "bg-primary",
}

export type DueTone = "overdue" | "today" | "upcoming"

export function getDueTone(date: Date): DueTone {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setHours(23, 59, 59, 999)

  if (date < startOfToday) return "overdue"
  if (date <= endOfToday) return "today"
  return "upcoming"
}
