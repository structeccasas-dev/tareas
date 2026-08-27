import { ListPlus, UserCheck } from "lucide-react"
import type { ActivityItem, ActivityType } from "@/types/dashboard"
import { Card } from "@/components/Card"
import { formatRelativeTime } from "@/lib/format"

const ICONS: Record<ActivityType, typeof ListPlus> = {
  task_created: ListPlus,
  task_assigned: UserCheck,
  task_status_changed: UserCheck,
}

const TONE_CLASSES: Record<ActivityType, string> = {
  task_created: "bg-primary/10 text-primary-dark",
  task_assigned: "bg-amber-50 text-amber-600",
  task_status_changed: "bg-blue-50 text-blue-600",
}

interface ActivityFeedProps {
  items: ActivityItem[]
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Actividad reciente</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Todavía no hay actividad para mostrar.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const Icon = ICONS[item.type]
            return (
              <li key={item.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${TONE_CLASSES[item.type]}`}>
                  <Icon className="w-4 h-4" strokeWidth={1.9} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  {item.subtitle && <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>}
                </div>
                {/* El texto depende de Date.now(): puede diferir entre SSR e hidratación. */}
                <span className="text-xs text-gray-400 flex-shrink-0" suppressHydrationWarning>
                  {formatRelativeTime(item.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
