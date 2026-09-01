import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  getDate,
  getDay,
  getDaysInMonth,
  getMonth,
  setDate,
  setMonth,
  startOfMonth,
} from "date-fns"
import type { RecurrenceRule } from "@/types/tasks"

function applyTime(date: Date, time: string | null): Date {
  const [h, m] = (time ?? "09:00").split(":").map(Number)
  const next = new Date(date)
  next.setHours(h || 0, m || 0, 0, 0)
  return next
}

function clampDayOfMonth(date: Date, dayOfMonth: number): Date {
  const clamped = Math.min(dayOfMonth, getDaysInMonth(date))
  return setDate(date, clamped)
}

// Próxima ocurrencia para tareas cíclicas "de un solo día por ciclo"
// (diaria/mensual/anual). No aplica a "weekly", que se genera en lote.
export function computeNextSingleOccurrence(rule: RecurrenceRule, afterDate: Date): Date {
  if (rule.freq === "daily") {
    return applyTime(addDays(afterDate, 1), rule.time)
  }

  if (rule.freq === "monthly") {
    const nextMonth = addMonths(afterDate, 1)
    const dayOfMonth = rule.dayOfMonth ?? getDate(afterDate)
    return applyTime(clampDayOfMonth(nextMonth, dayOfMonth), rule.time)
  }

  // yearly
  const nextYear = addYears(afterDate, 1)
  const withMonth = rule.month ? setMonth(nextYear, rule.month - 1) : nextYear
  const dayOfMonth = rule.dayOfMonth ?? getDate(afterDate)
  return applyTime(clampDayOfMonth(withMonth, dayOfMonth), rule.time)
}

// Todas las fechas del mes de `monthDate` que matchean los días de semana de
// la regla, a partir de (e incluyendo) `notBefore`. Usado para el caso
// "semanal con días específicos", que se genera de una vez para todo el mes.
export function computeWeeklyBatchForMonth(rule: RecurrenceRule, monthDate: Date, notBefore: Date): Date[] {
  const weekdays = rule.weekdays ?? []
  if (weekdays.length === 0) return []

  const start = startOfMonth(monthDate)
  const end = endOfMonth(monthDate)
  const days = eachDayOfInterval({ start, end })

  return days
    .filter((d) => weekdays.includes(getDay(d)))
    .map((d) => applyTime(d, rule.time))
    .filter((d) => d >= notBefore)
    .sort((a, b) => a.getTime() - b.getTime())
}

export function parseWeekdaysCsv(csv: string | null): number[] | null {
  if (!csv) return null
  const parsed = csv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  return parsed.length > 0 ? parsed : null
}

export function nextMonthOf(date: Date): Date {
  return addMonths(startOfMonth(date), 1)
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${getMonth(date)}`
}
