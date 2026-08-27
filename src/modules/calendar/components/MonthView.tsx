import { isSameDay, isSameMonth } from "date-fns"
import type { TaskWithRelations } from "@/types/tasks"
import { getMonthGridDays, dayKey } from "@/modules/calendar/lib/calendarDate"
import { STATUS_DOT } from "@/modules/tasks/lib/status"

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MAX_DOTS = 3
const MAX_CHIPS = 3

interface MonthViewProps {
  anchor: Date
  tasksByDay: Map<string, TaskWithRelations[]>
  onSelectDay: (date: Date) => void
  onSelectTask: (task: TaskWithRelations) => void
}

export function MonthView({ anchor, tasksByDay, onSelectDay, onSelectTask }: MonthViewProps) {
  const days = getMonthGridDays(anchor)
  const today = new Date()

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-surface-alt">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-1 py-2 text-center text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = dayKey(day)
          const dayTasks = tasksByDay.get(key) ?? []
          const inMonth = isSameMonth(day, anchor)
          const isToday = isSameDay(day, today)

          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => onSelectDay(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelectDay(day)
              }}
              className={`flex flex-col items-stretch min-h-16 sm:min-h-28 p-1 sm:p-1.5 border-b border-r border-border text-left cursor-pointer transition-colors duration-150 hover:bg-surface-alt/70 [&:nth-child(7n)]:border-r-0 ${
                inMonth ? "bg-surface" : "bg-black/[.015]"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${
                  isToday ? "bg-primary text-white" : inMonth ? "text-gray-700" : "text-gray-300"
                }`}
              >
                {day.getDate()}
              </span>

              {/* Mobile: indicadores compactos */}
              {dayTasks.length > 0 && (
                <div className="flex sm:hidden items-center gap-1 mt-1 flex-wrap">
                  {dayTasks.slice(0, MAX_DOTS).map((t) => (
                    <span key={t.id} className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
                  ))}
                  {dayTasks.length > MAX_DOTS && <span className="text-[10px] text-gray-400">+{dayTasks.length - MAX_DOTS}</span>}
                </div>
              )}

              {/* Desktop: chips con título */}
              <div className="hidden sm:flex sm:flex-col gap-1 mt-1.5 min-w-0">
                {dayTasks.slice(0, MAX_CHIPS).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectTask(t)
                    }}
                    className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[11px] truncate text-left hover:opacity-80 ${
                      t.status === "done" ? "line-through text-gray-400 bg-black/[.03]" : "text-gray-700 bg-black/[.035]"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[t.status]}`} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {dayTasks.length > MAX_CHIPS && (
                  <span className="text-[11px] text-gray-400 px-1.5">+{dayTasks.length - MAX_CHIPS} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
