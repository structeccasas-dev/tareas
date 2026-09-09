import { notFound } from "next/navigation"
import { getProjects } from "@/modules/projects/data/queries"
import { ProjectsShell } from "@/modules/projects/components/ProjectsShell"
import { getSession } from "@/lib/session"
import { isAdmin } from "@/lib/permissions"

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session || !isAdmin(session)) notFound()

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const page = Math.max(1, Number(params.page) || 1)

  const data = await getProjects({ page, search })
  return <ProjectsShell data={data} initialSearch={search} />
}
