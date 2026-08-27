import { ListTodo, Loader, CheckCircle2, XCircle, AlertTriangle, PlusCircle, CheckCheck } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { BarChart } from "@/components/BarChart"
import { DonutChart } from "@/components/DonutChart"
import { HorizontalBarList } from "@/components/HorizontalBarList"
import { RangeFilter } from "@/modules/dashboard/components/RangeFilter"
import { MetricCard } from "@/modules/dashboard/components/MetricCard"
import { ActivityFeed } from "@/modules/dashboard/components/ActivityFeed"
import { MembersTable } from "@/modules/dashboard/components/MembersTable"
import { DueTasksCard } from "@/modules/dashboard/components/DueTasksCard"
import { parseRange } from "@/modules/dashboard/lib/dateRange"
import {
  getDashboardMetrics,
  getTasksByDay,
  getTasksByStatusDistribution,
  getTasksByMember,
  getMembersOverview,
  getRecentActivity,
} from "@/modules/dashboard/data/queries"
import { getDueTasks } from "@/modules/tasks/data/queries"
import { STATUS_LABELS, STATUS_TONE } from "@/modules/tasks/lib/status"

const TONE_STROKE: Record<string, string> = {
  neutral: "stroke-gray-400",
  primary: "stroke-primary",
  info: "stroke-blue-500",
  error: "stroke-red-500",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const range = parseRange(params)

  const [metrics, tasksByDay, tasksByStatus, tasksByMember, members, activity, dueTasks] = await Promise.all([
    getDashboardMetrics(range),
    getTasksByDay(range),
    getTasksByStatusDistribution(),
    getTasksByMember(),
    getMembersOverview(),
    getRecentActivity(15),
    getDueTasks(8),
  ])

  const metricCards = [
    { label: "Total de tareas", value: metrics.totalTasks, icon: ListTodo },
    { label: "Para hacer", value: metrics.todoTasks, icon: ListTodo },
    { label: "En progreso", value: metrics.inProgressTasks, icon: Loader },
    { label: "Finalizadas", value: metrics.doneTasks, icon: CheckCircle2 },
    { label: "Canceladas", value: metrics.cancelledTasks, icon: XCircle },
    { label: "Vencidas", value: metrics.overdueTasks, icon: AlertTriangle },
    { label: "Creadas en el rango", value: metrics.createdInRange, icon: PlusCircle },
    { label: "Finalizadas en el rango", value: metrics.completedInRange, icon: CheckCheck },
  ]

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Dashboard" description="Resumen general de tareas." />

      <div className="p-6 space-y-6">
        <DueTasksCard tasks={dueTasks} />

        <RangeFilter current={range.key} from={params.from} to={params.to} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((m) => (
            <MetricCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tareas creadas por día</h2>
            <BarChart data={tasksByDay.map((d) => ({ label: d.date, value: d.count }))} />
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Distribución por estado</h2>
            <DonutChart
              data={tasksByStatus.map((s) => ({
                label: STATUS_LABELS[s.status],
                value: s.count,
                colorClassName: TONE_STROKE[STATUS_TONE[s.status]],
              }))}
            />
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tareas por miembro</h2>
            <HorizontalBarList data={tasksByMember.map((a) => ({ label: a.userName, value: a.count }))} />
          </Card>

          <ActivityFeed items={activity} />
        </div>

        <MembersTable members={members} />
      </div>
    </div>
  )
}
