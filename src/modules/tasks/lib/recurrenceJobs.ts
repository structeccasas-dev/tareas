import "server-only"
import { getDate, endOfMonth } from "date-fns"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { tasks } from "@/db/schema/task"
import { computeWeeklyBatchForMonth, nextMonthOf, monthKey, parseWeekdaysCsv } from "@/lib/recurrence"
import type { RecurrenceRule } from "@/types/tasks"

type WeeklyTaskRow = typeof tasks.$inferSelect

// Genera, sobre el final de cada mes, el lote de ocurrencias del mes
// siguiente para las tareas cíclicas "semanales con días específicos" — esas
// no se regeneran una por una al completarse, se arman de a lotes mensuales.
export async function generateUpcomingWeeklyBatches(): Promise<number> {
  const today = new Date()
  // Sólo vale la pena recorrer esto cerca de fin de mes.
  if (getDate(endOfMonth(today)) - getDate(today) > 6) return 0

  const rows = await db.select().from(tasks).where(eq(tasks.recurrenceFreq, "weekly"))
  if (rows.length === 0) return 0

  const groups = new Map<string, WeeklyTaskRow[]>()
  for (const row of rows) {
    const chainId = row.recurrenceParentId ?? row.id
    const group = groups.get(chainId) ?? []
    group.push(row)
    groups.set(chainId, group)
  }

  const nextMonthStart = nextMonthOf(today)
  const nextMonthTag = monthKey(nextMonthStart)
  let created = 0

  for (const [chainId, group] of groups) {
    const alreadyGenerated = group.some((r) => r.dueAt && monthKey(r.dueAt) === nextMonthTag)
    if (alreadyGenerated) continue

    const template = group[0]
    const rule: RecurrenceRule = {
      freq: "weekly",
      weekdays: parseWeekdaysCsv(template.recurrenceWeekdays),
      dayOfMonth: null,
      month: null,
      time: template.recurrenceTime,
      endDate: template.recurrenceEndDate,
    }
    if (!rule.weekdays) continue
    if (rule.endDate && nextMonthStart > rule.endDate) continue

    const dates = computeWeeklyBatchForMonth(rule, nextMonthStart, nextMonthStart).filter(
      (d) => !rule.endDate || d <= rule.endDate,
    )
    if (dates.length === 0) continue

    await db.insert(tasks).values(
      dates.map((dueAt) => ({
        title: template.title,
        description: template.description,
        category: template.category,
        projectId: template.projectId,
        createdBy: template.createdBy,
        assignedTo: template.assignedTo,
        assignedTeamId: template.assignedTeamId,
        assignedBy: template.assignedBy,
        status: "todo" as const,
        priority: template.priority,
        recurrenceFreq: template.recurrenceFreq,
        recurrenceWeekdays: template.recurrenceWeekdays,
        recurrenceTime: template.recurrenceTime,
        recurrenceEndDate: template.recurrenceEndDate,
        recurrenceParentId: chainId,
        dueAt,
      })),
    )
    created += dates.length
  }

  return created
}
