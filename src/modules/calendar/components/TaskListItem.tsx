import { format } from "date-fns"
import type { TaskWithRelations } from "@/types/tasks"
import { Avatar } from "@/components/Avatar"
import { Badge } from "@/components/Badge"
import { PRIORITY_DOT, STATUS_DOT, STATUS_LABELS, STATUS_TONE } from "@/modules/tasks/lib/status"

interface TaskListItemProps {
  task: TaskWithRelations
  onClick: (task: TaskWithRelations) => void
  /** Fila reducida (una sola línea) para columnas angostas, como en la vista semana. */
  compact?: boolean
}

export function TaskListItem({ task, onClick, compact = false }: TaskListItemProps) {
  const isDone = task.status === "done"

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onClick(task)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-border bg-surface text-left transition-colors duration-150 hover:bg-surface-alt"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status]}`} />
        <span className="text-[11px] font-medium text-gray-400 flex-shrink-0 tabular-nums">
          {task.dueAt ? format(task.dueAt, "HH:mm") : "—"}
        </span>
        <span className={`text-xs text-gray-900 truncate ${isDone ? "line-through text-gray-400" : ""}`}>{task.title}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onClick(task)}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-surface text-left transition-colors duration-150 hover:bg-surface-alt"
    >
      <span className="text-xs font-medium text-gray-400 pt-0.5 w-11 flex-shrink-0 tabular-nums">
        {task.dueAt ? format(task.dueAt, "HH:mm") : "—"}
      </span>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${PRIORITY_DOT[task.priority]}`} />
      <span className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-gray-900 truncate ${isDone ? "line-through text-gray-400" : ""}`}>
          {task.title}
        </p>
        {task.assignedUser && <p className="text-xs text-gray-400 truncate">{task.assignedUser.name}</p>}
      </span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABELS[task.status]}</Badge>
        {task.assignedUser && <Avatar name={task.assignedUser.name} size="sm" />}
      </span>
    </button>
  )
}
