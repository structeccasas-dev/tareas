import type { TaskStatus, TaskPriority } from "@/types/tasks"
import type { BadgeTone } from "@/components/Badge"

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Para hacer",
  in_progress: "En progreso",
  done: "Finalizado",
  cancelled: "Cancelada",
}

export const STATUS_TONE: Record<TaskStatus, "neutral" | "info" | "primary" | "error"> = {
  todo: "neutral",
  in_progress: "info",
  done: "primary",
  cancelled: "error",
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
}

export const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "error",
}

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-gray-300",
  medium: "bg-blue-400",
  high: "bg-amber-500",
  urgent: "bg-red-500",
}

export const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  in_progress: "bg-blue-400",
  done: "bg-primary",
  cancelled: "bg-red-400",
}

// Estados "terminales" — la tarea ya no está activa (usado para tachar el
// título y ocultar el vencimiento en las tarjetas/listas).
export function isClosedStatus(status: TaskStatus): boolean {
  return status === "done" || status === "cancelled"
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
