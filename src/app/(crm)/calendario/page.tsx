import { getTasksInRange } from "@/modules/tasks/data/queries"
import { getRangeForView } from "@/modules/calendar/lib/calendarDate"
import { CalendarShell } from "@/modules/calendar/components/CalendarShell"

export default async function CalendarPage() {
  const today = new Date()
  const { from, to } = getRangeForView("month", today)
  const tasks = await getTasksInRange(from, to)

  return <CalendarShell initialView="month" initialAnchor={today.toISOString()} initialTasks={tasks} />
}
