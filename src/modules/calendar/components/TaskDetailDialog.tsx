import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarClock, User } from "lucide-react"
import type { TaskWithRelations } from "@/types/tasks"
import { Dialog } from "@/components/Dialog"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { STATUS_LABELS, STATUS_TONE, PRIORITY_LABELS, PRIORITY_TONE } from "@/modules/tasks/lib/status"

interface TaskDetailDialogProps {
  task: TaskWithRelations | null
  onClose: () => void
}

export function TaskDetailDialog({ task, onClose }: TaskDetailDialogProps) {
  return (
    <Dialog open={task !== null} onClose={onClose} title="Detalle de la tarea">
      {task && (
        <div className="space-y-4">
          <div>
            <h3 className={`text-base font-semibold text-gray-900 ${task.status === "done" ? "line-through text-gray-400" : ""}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-2">
              <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABELS[task.status]}</Badge>
              <Badge tone={PRIORITY_TONE[task.priority]}>Prioridad {PRIORITY_LABELS[task.priority]}</Badge>
            </div>
          </div>

          {task.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>}

          <div className="space-y-2 pt-2 border-t border-border">
            {task.dueAt && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarClock className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.9} />
                {format(task.dueAt, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.9} />
              {task.assignedUser?.name ?? <span className="text-gray-400 italic">Sin asignar</span>}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Link href="/tareas">
              <Button variant="secondary" size="sm">
                Ver en Tareas
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Dialog>
  )
}
