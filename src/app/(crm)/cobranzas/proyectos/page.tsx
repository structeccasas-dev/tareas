import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getAllProjects } from "@/modules/collections/data/queries"
import { ProjectsShell } from "@/modules/collections/components/ProjectsShell"

export default async function CobranzasProyectosPage() {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  const projects = await getAllProjects()
  return <ProjectsShell projects={projects} />
}
