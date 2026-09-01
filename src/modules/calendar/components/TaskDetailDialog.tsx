"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarClock, User, Repeat, BellRing } from "lucide-react"
import type { TaskWithRelations } from "@/types/tasks"
import { Dialog } from "@/components/Dialog"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { notifyTaskCreator } from "@/modules/tasks/actions/taskActions"
import { STATUS_LABELS, STATUS_TONE, PRIORITY_LABELS, PRIORITY_TONE, isClosedStatus } from "@/modules/tasks/lib/status"

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Diaria",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
}

interface TaskDetailDialogProps {
  task: TaskWithRelations | null
  onClose: () => void
  currentUserId: string
}

export function TaskDetailDialog({ task, onClose, currentUserId }: TaskDetailDialogProps) {
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [isPending, startTransition] = useTransition()

  function handleNotifyCreator() {
    if (!task) return
    setNotifyStatus("sending")
    startTransition(async () => {
      await notifyTaskCreator(task.id)
      setNotifyStatus("sent")
    })
  }

  return (
    <Dialog open={task !== null} onClose={onClose} title="Detalle de la tarea">
      {task && (
        <div className="space-y-4">
          <div>
            <h3 className={`text-base font-semibold text-gray-900 ${isClosedStatus(task.status) ? "line-through text-gray-400" : ""}`}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABELS[task.status]}</Badge>
              <Badge tone={PRIORITY_TONE[task.priority]}>Prioridad {PRIORITY_LABELS[task.priority]}</Badge>
              {task.category && <Badge tone="neutral">{task.category}</Badge>}
              {task.project && <Badge tone="neutral">{task.project.name}</Badge>}
              {task.recurrenceFreq && (
                <Badge tone="info">
                  <Repeat className="w-3 h-3" strokeWidth={2} />
                  Se repite: {RECURRENCE_LABELS[task.recurrenceFreq]}
                </Badge>
              )}
            </div>
          </div>

          {task.description && <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>}

          {task.status === "cancelled" && task.cancelReason && (
            <p className="text-sm text-red-600 bg-red-500/8 border border-red-500/15 rounded-xl px-3.5 py-2.5">
              Motivo de cancelación: {task.cancelReason}
            </p>
          )}

          <div className="space-y-2 pt-2 border-t border-border">
            {task.dueAt && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CalendarClock className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.9} />
                {format(task.dueAt, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.9} />
              {task.assignedUser?.name ??
                (task.assignedTeam ? `Equipo ${task.assignedTeam.name}` : <span className="text-gray-400 italic">Sin asignar</span>)}
            </div>
            <p className="text-xs text-gray-400">
              Creado por {task.createdByUser?.name ?? "—"}
              {task.assignedByUser && <> · Asignado por {task.assignedByUser.name}</>}
            </p>
          </div>

          <div className="flex justify-end items-center gap-2 pt-2">
            {task.createdByUser && task.createdByUser.id !== currentUserId && (
              <Button variant="ghost" size="sm" onClick={handleNotifyCreator} disabled={notifyStatus !== "idle" || isPending}>
                <BellRing className="w-3.5 h-3.5" />
                {notifyStatus === "sent" ? "Aviso enviado" : "Avisar al creador"}
              </Button>
            )}
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
