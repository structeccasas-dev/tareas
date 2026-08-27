import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { Card } from "@/components/Card"
import { Badge } from "@/components/Badge"
import type { DueTask } from "@/modules/tasks/data/queries"
import { getDueTone } from "@/modules/tasks/lib/status"

interface DueTasksCardProps {
  tasks: DueTask[]
}

const TONE_LABEL: Record<"overdue" | "today", string> = {
  overdue: "Vencida",
  today: "Hoy",
}

const TONE_BADGE: Record<"overdue" | "today", "error" | "warning"> = {
  overdue: "error",
  today: "warning",
}

export function DueTasksCard({ tasks }: DueTasksCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Tareas pendientes</h2>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No tenés tareas vencidas ni para hoy.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => {
            const rawTone = getDueTone(t.dueAt)
            // La query solo trae vencidas/hoy, "upcoming" no debería llegar acá.
            const tone = rawTone === "upcoming" ? "today" : rawTone
            return (
              <li key={t.id} className="py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-900 truncate min-w-0">{t.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge tone={TONE_BADGE[tone]}>{TONE_LABEL[tone]}</Badge>
                  <Link href="/tareas" className="text-xs font-medium text-primary-dark hover:underline">
                    Ver
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
