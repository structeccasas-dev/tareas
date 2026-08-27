import { CalendarX2 } from "lucide-react"
import type { TaskWithRelations } from "@/types/tasks"
import { dayKey } from "@/modules/calendar/lib/calendarDate"
import { TaskListItem } from "./TaskListItem"

interface DayViewProps {
  anchor: Date
  tasksByDay: Map<string, TaskWithRelations[]>
  onSelectTask: (task: TaskWithRelations) => void
}

export function DayView({ anchor, tasksByDay, onSelectTask }: DayViewProps) {
  const tasks = tasksByDay.get(dayKey(anchor)) ?? []

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400 rounded-xl border border-dashed border-border">
        <CalendarX2 className="w-8 h-8 text-gray-300" strokeWidth={1.25} />
        <p className="mt-3 text-sm">No hay tareas con vencimiento este día.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskListItem key={task.id} task={task} onClick={onSelectTask} />
      ))}
    </div>
  )
}
