import { getTasksInRange } from "@/modules/tasks/data/queries"
import { getRangeForView } from "@/modules/calendar/lib/calendarDate"
import { CalendarShell } from "@/modules/calendar/components/CalendarShell"
import { getSession } from "@/lib/session"

export default async function CalendarPage() {
  const today = new Date()
  const { from, to } = getRangeForView("month", today)
  const [tasks, session] = await Promise.all([getTasksInRange(from, to), getSession()])

  return (
    <CalendarShell
      initialView="month"
      initialAnchor={today.toISOString()}
      initialTasks={tasks}
      currentUserId={session?.userId ?? ""}
    />
  )
}
