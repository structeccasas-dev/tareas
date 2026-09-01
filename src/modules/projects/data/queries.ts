import "server-only"
import { asc, count, inArray } from "drizzle-orm"
import { db } from "@/db"
import { projects } from "@/db/schema/project"
import { tasks } from "@/db/schema/task"
import type { Project } from "@/types/projects"
import type { ProjectOption } from "@/types/tasks"

// Estados que cuentan como "en curso" — un proyecto con tareas en alguno de
// estos estados no se puede borrar (ver deleteProject en projectActions).
const ACTIVE_TASK_STATUSES = ["todo", "in_progress"] as const

export async function getProjects(): Promise<Project[]> {
  try {
    const [allProjects, activeCounts] = await Promise.all([
      db.select({ id: projects.id, name: projects.name, createdAt: projects.createdAt }).from(projects).orderBy(asc(projects.name)),
      db
        .select({ projectId: tasks.projectId, value: count() })
        .from(tasks)
        .where(inArray(tasks.status, ACTIVE_TASK_STATUSES))
        .groupBy(tasks.projectId),
    ])

    const countByProject = new Map(activeCounts.map((r) => [r.projectId, Number(r.value)]))

    return allProjects.map((p) => ({ ...p, activeTaskCount: countByProject.get(p.id) ?? 0 }))
  } catch {
    return []
  }
}

export async function getProjectOptions(): Promise<ProjectOption[]> {
  try {
    return await db.select({ id: projects.id, name: projects.name }).from(projects).orderBy(asc(projects.name))
  } catch {
    return []
  }
}
