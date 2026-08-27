import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  format,
} from "date-fns"
import { es } from "date-fns/locale"
import type { TaskWithRelations } from "@/types/tasks"

export type CalendarViewMode = "day" | "week" | "month"

// Semana arranca el lunes (convención habitual en es-AR/LatAm).
const WEEK_STARTS_ON = 1 as const

export function getRangeForView(view: CalendarViewMode, anchor: Date): { from: Date; to: Date } {
  if (view === "day") {
    return { from: startOfDay(anchor), to: endOfDay(anchor) }
  }
  if (view === "week") {
    return {
      from: startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }),
      to: endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }),
    }
  }
  // month: incluye los días de relleno de la semana anterior/siguiente para
  // completar la grilla, así las tareas que caen ahí también se muestran.
  return {
    from: startOfWeek(startOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON }),
    to: endOfWeek(endOfMonth(anchor), { weekStartsOn: WEEK_STARTS_ON }),
  }
}

export function getMonthGridDays(anchor: Date): Date[] {
  const { from, to } = getRangeForView("month", anchor)
  return eachDayOfInterval({ start: from, end: to })
}

export function getWeekDays(anchor: Date): Date[] {
  const { from, to } = getRangeForView("week", anchor)
  return eachDayOfInterval({ start: from, end: to })
}

export function navigate(view: CalendarViewMode, anchor: Date, direction: 1 | -1): Date {
  if (view === "day") return direction === 1 ? addDays(anchor, 1) : subDays(anchor, 1)
  if (view === "week") return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1)
  return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1)
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function getRangeLabel(view: CalendarViewMode, anchor: Date): string {
  if (view === "day") return capitalize(format(anchor, "EEEE d 'de' MMMM", { locale: es }))
  if (view === "week") {
    const { from, to } = getRangeForView("week", anchor)
    const sameMonth = from.getMonth() === to.getMonth()
    const fromLabel = format(from, sameMonth ? "d" : "d MMM", { locale: es })
    return `${fromLabel} – ${format(to, "d MMM yyyy", { locale: es })}`
  }
  return capitalize(format(anchor, "MMMM yyyy", { locale: es }))
}

export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function groupTasksByDay(tasks: TaskWithRelations[]): Map<string, TaskWithRelations[]> {
  const map = new Map<string, TaskWithRelations[]>()
  for (const task of tasks) {
    if (!task.dueAt) continue
    const key = dayKey(task.dueAt)
    const list = map.get(key) ?? []
    list.push(task)
    map.set(key, list)
  }
  return map
}
