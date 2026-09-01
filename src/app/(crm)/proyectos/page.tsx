import { notFound } from "next/navigation"
import { getProjects } from "@/modules/projects/data/queries"
import { ProjectsShell } from "@/modules/projects/components/ProjectsShell"
import { getSession } from "@/lib/session"
import { isAdmin } from "@/lib/permissions"

export default async function ProjectsPage() {
  const session = await getSession()
  if (!session || !isAdmin(session)) notFound()

  const projects = await getProjects()
  return <ProjectsShell projects={projects} />
}
