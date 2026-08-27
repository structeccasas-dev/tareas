import type { DashboardRange, DashboardRangeKey } from "@/types/dashboard"

const RANGE_KEYS: DashboardRangeKey[] = ["today", "7d", "30d", "custom"]

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return startOfDay(d)
}

function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseRange(params: {
  range?: string
  from?: string
  to?: string
}): DashboardRange {
  const key = RANGE_KEYS.includes(params.range as DashboardRangeKey)
    ? (params.range as DashboardRangeKey)
    : "7d"

  const now = new Date()

  if (key === "today") {
    return { key, from: startOfDay(now), to: endOfDay(now) }
  }

  if (key === "30d") {
    return { key, from: daysAgo(29), to: endOfDay(now) }
  }

  if (key === "custom") {
    const from = parseDateParam(params.from)
    const to = parseDateParam(params.to)
    if (from && to) {
      return { key, from: startOfDay(from), to: endOfDay(to) }
    }
    // Fallback to 7d if the custom range is incomplete or invalid.
    return { key: "7d", from: daysAgo(6), to: endOfDay(now) }
  }

  return { key: "7d", from: daysAgo(6), to: endOfDay(now) }
}
