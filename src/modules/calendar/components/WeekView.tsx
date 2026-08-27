import { isSameDay, format } from "date-fns"
import { es } from "date-fns/locale"
import type { TaskWithRelations } from "@/types/tasks"
import { getWeekDays, dayKey } from "@/modules/calendar/lib/calendarDate"
import { TaskListItem } from "./TaskListItem"

interface WeekViewProps {
  anchor: Date
  tasksByDay: Map<string, TaskWithRelations[]>
  onSelectTask: (task: TaskWithRelations) => void
}

export function WeekView({ anchor, tasksByDay, onSelectTask }: WeekViewProps) {
  const days = getWeekDays(anchor)
  const today = new Date()

  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-start">
      {days.map((day) => {
        const key = dayKey(day)
        const dayTasks = tasksByDay.get(key) ?? []
        const isToday = isSameDay(day, today)

        return (
          <div key={key} className="rounded-xl border border-border overflow-hidden">
            <div className={`flex items-center justify-between gap-2 px-3 py-2 ${isToday ? "bg-primary/10" : "bg-surface-alt"}`}>
              <span className={`text-sm font-medium ${isToday ? "text-primary-dark" : "text-gray-700"}`}>
                {format(day, "EEEE d", { locale: es })}
              </span>
              {dayTasks.length > 0 && <span className="text-xs text-gray-400 flex-shrink-0">{dayTasks.length}</span>}
            </div>
            <div className="p-2 space-y-2 min-h-16">
              {dayTasks.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-3">Sin tareas</p>
              ) : (
                dayTasks.map((task) => <TaskListItem key={task.id} task={task} onClick={onSelectTask} compact />)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
