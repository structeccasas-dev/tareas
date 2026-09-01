import { getTasksColumns, getTasksStats, getUserOptions } from "@/modules/tasks/data/queries"
import { getTeamOptions } from "@/modules/teams/data/queries"
import { getProjectOptions } from "@/modules/projects/data/queries"
import { TasksShell } from "@/modules/tasks/components/TasksShell"
import { getSession } from "@/lib/session"
import { hasFullAccess } from "@/lib/permissions"

const INITIAL_LIMIT = 12

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; assignedTo?: string; project?: string }>
}) {
  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const assignedTo = typeof params.assignedTo === "string" ? params.assignedTo : ""
  const project = typeof params.project === "string" ? params.project : ""

  const filters = { search, assignedTo, project }

  const session = await getSession()
  const isFullAccess = session ? hasFullAccess(session) : false

  const [board, stats, users, teams, projects] = await Promise.all([
    getTasksColumns({ limit: INITIAL_LIMIT, ...filters }),
    getTasksStats(filters),
    getUserOptions(),
    getTeamOptions(),
    getProjectOptions(),
  ])

  return (
    <TasksShell
      board={board}
      stats={stats}
      users={users}
      teams={teams}
      projects={projects}
      initialSearch={search}
      initialAssignedTo={assignedTo}
      initialProject={project}
      currentUserId={session?.userId ?? ""}
      isFullAccess={isFullAccess}
    />
  )
}
