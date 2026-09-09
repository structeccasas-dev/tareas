import "server-only"
import { and, asc, count, ilike, inArray } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema/project"
import { tasks } from "@/db/schema/task"
import type { ProjectsPage } from "@/types/projects"
import type { ProjectOption } from "@/types/tasks"

// Estados que cuentan como "en curso" — un proyecto con tareas en alguno de
// estos estados no se puede borrar (ver deleteProject en projectActions).
const ACTIVE_TASK_STATUSES = ["todo", "in_progress"] as const
const PAGE_LIMIT = 20

export async function getProjects(opts: { page: number; search?: string }): Promise<ProjectsPage> {
  const empty: ProjectsPage = { projects: [], total: 0, page: 1, totalPages: 1 }
  try {
    const page = Math.max(1, opts.page)
    const s = opts.search?.trim()
    const offset = (page - 1) * PAGE_LIMIT
    const whereClause = s ? ilike(projects.name, `%${s}%`) : undefined

    const [pageRows, [countRow]] = await Promise.all([
      db
        .select({ id: projects.id, name: projects.name, createdAt: projects.createdAt })
        .from(projects)
        .where(whereClause)
        .orderBy(asc(projects.name))
        .limit(PAGE_LIMIT)
        .offset(offset),
      db.select({ value: count() }).from(projects).where(whereClause),
    ])

    const pageIds = pageRows.map((p) => p.id)
    const activeCounts =
      pageIds.length === 0
        ? []
        : await db
            .select({ projectId: tasks.projectId, value: count() })
            .from(tasks)
            .where(and(inArray(tasks.status, ACTIVE_TASK_STATUSES), inArray(tasks.projectId, pageIds)))
            .groupBy(tasks.projectId)

    const countByProject = new Map(activeCounts.map((r) => [r.projectId, Number(r.value)]))
    const total = Number(countRow?.value ?? 0)

    return {
      projects: pageRows.map((p) => ({ ...p, activeTaskCount: countByProject.get(p.id) ?? 0 })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)),
    }
  } catch {
    return empty
  }
}

export async function getProjectOptions(): Promise<ProjectOption[]> {
  try {
    return await db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name))
  } catch {
    return []
  }
}
