"use server"

import { and, count, eq, inArray } from "drizzle-orm"
import { refresh } from "next/cache"
import { db } from "@/db"
import { projects } from "@/db/schema/project"
import { tasks } from "@/db/schema/task"
import { getSession } from "@/lib/session"
import { isAdmin } from "@/lib/permissions"

// Igual criterio que en las queries: "en curso" = todo/in_progress.
const ACTIVE_TASK_STATUSES = ["todo", "in_progress"] as const

async function requireManage() {
  const session = await getSession()
  if (!session || !isAdmin(session)) {
    throw new Error("No tenés permisos para administrar proyectos")
  }
}

export async function createProject(name: string): Promise<{ id: string }> {
  await requireManage()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("El nombre del proyecto no puede estar vacío")
  const [created] = await db.insert(projects).values({ name: trimmed }).returning({ id: projects.id })
  refresh()
  return created
}

export async function renameProject(id: string, name: string): Promise<void> {
  await requireManage()
  const trimmed = name.trim()
  if (!trimmed) throw new Error("El nombre del proyecto no puede estar vacío")
  await db.update(projects).set({ name: trimmed }).where(eq(projects.id, id))
  refresh()
}

export async function deleteProject(id: string): Promise<void> {
  await requireManage()

  const [activeRow] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, id), inArray(tasks.status, ACTIVE_TASK_STATUSES)))

  const activeCount = Number(activeRow?.value ?? 0)
  if (activeCount > 0) {
    throw new Error(`No se puede eliminar: tiene ${activeCount} ${activeCount === 1 ? "tarea en curso" : "tareas en curso"} asociada${activeCount === 1 ? "" : "s"}.`)
  }

  await db.delete(projects).where(eq(projects.id, id))
  refresh()
}
