import { getTasksColumns, getTasksStats, getUserOptions } from "@/modules/tasks/data/queries"
import { TasksShell } from "@/modules/tasks/components/TasksShell"
import { getSession } from "@/lib/session"
import { hasFullAccess } from "@/lib/permissions"

const INITIAL_LIMIT = 12

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; assignedTo?: string }>
}) {
  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const assignedTo = typeof params.assignedTo === "string" ? params.assignedTo : ""

  const filters = { search, assignedTo }

  const session = await getSession()
  const isFullAccess = session ? hasFullAccess(session) : false

  const [board, stats, users] = await Promise.all([
    getTasksColumns({ limit: INITIAL_LIMIT, ...filters }),
    getTasksStats(filters),
    getUserOptions(),
  ])

  return (
    <TasksShell
      board={board}
      stats={stats}
      users={users}
      initialSearch={search}
      initialAssignedTo={assignedTo}
      currentUserId={session?.userId ?? ""}
      isFullAccess={isFullAccess}
    />
  )
}
