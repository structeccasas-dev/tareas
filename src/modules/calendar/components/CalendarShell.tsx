"use client"

import { useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import type { TaskWithRelations } from "@/types/tasks"
import { getCalendarTasks } from "@/modules/tasks/actions/taskActions"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/Button"
import {
  type CalendarViewMode,
  getRangeForView,
  getRangeLabel,
  groupTasksByDay,
  navigate,
} from "@/modules/calendar/lib/calendarDate"
import { MonthView } from "./MonthView"
import { WeekView } from "./WeekView"
import { DayView } from "./DayView"
import { TaskDetailDialog } from "./TaskDetailDialog"

const VIEW_OPTIONS: { key: CalendarViewMode; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
]

interface CalendarShellProps {
  initialView: CalendarViewMode
  initialAnchor: string
  initialTasks: TaskWithRelations[]
  currentUserId: string
}

export function CalendarShell({ initialView, initialAnchor, initialTasks, currentUserId }: CalendarShellProps) {
  const [view, setView] = useState<CalendarViewMode>(initialView)
  const [anchor, setAnchor] = useState(() => new Date(initialAnchor))
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [isPending, startTransition] = useTransition()

  function loadRange(nextView: CalendarViewMode, nextAnchor: Date) {
    const { from, to } = getRangeForView(nextView, nextAnchor)
    startTransition(async () => {
      const result = await getCalendarTasks(from, to)
      setTasks(result)
    })
  }

  function handleViewChange(nextView: CalendarViewMode) {
    setView(nextView)
    loadRange(nextView, anchor)
  }

  function handleNavigate(direction: 1 | -1) {
    const nextAnchor = navigate(view, anchor, direction)
    setAnchor(nextAnchor)
    loadRange(view, nextAnchor)
  }

  function handleToday() {
    const today = new Date()
    setAnchor(today)
    loadRange(view, today)
  }

  function handleSelectDay(date: Date) {
    setView("day")
    setAnchor(date)
    loadRange("day", date)
  }

  const tasksByDay = groupTasksByDay(tasks)

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Calendario" description="Visualizá tus tareas por día, semana o mes." />

      <div className="px-6 pt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-full border border-border bg-surface-alt">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleViewChange(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 ${
                view === opt.key ? "bg-surface text-primary-dark shadow-elevation-xs" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full border border-border">
            <button
              type="button"
              onClick={() => handleNavigate(-1)}
              className="flex items-center justify-center w-8 h-8 text-gray-500 hover:bg-black/[.04] rounded-l-full transition-colors duration-150"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(1)}
              className="flex items-center justify-center w-8 h-8 text-gray-500 hover:bg-black/[.04] rounded-r-full transition-colors duration-150"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleToday}>
            Hoy
          </Button>
        </div>
      </div>

      <div className="px-6 pt-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900 capitalize">{getRangeLabel(view, anchor)}</h2>
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      </div>

      <div className="p-6 flex-1 overflow-x-auto">
        {view === "month" && (
          <MonthView anchor={anchor} tasksByDay={tasksByDay} onSelectDay={handleSelectDay} onSelectTask={setSelectedTask} />
        )}
        {view === "week" && <WeekView anchor={anchor} tasksByDay={tasksByDay} onSelectTask={setSelectedTask} />}
        {view === "day" && <DayView anchor={anchor} tasksByDay={tasksByDay} onSelectTask={setSelectedTask} />}
      </div>

      <TaskDetailDialog task={selectedTask} onClose={() => setSelectedTask(null)} currentUserId={currentUserId} />
    </div>
  )
}
