import { notFound } from "next/navigation"
import { getTeams } from "@/modules/teams/data/queries"
import { getUsers } from "@/modules/users/data/queries"
import { TeamsShell } from "@/modules/teams/components/TeamsShell"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"

export default async function EquiposPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session || !canManageUsers(session)) notFound()

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const page = Math.max(1, Number(params.page) || 1)

  const [data, users] = await Promise.all([getTeams({ page, search }), getUsers()])
  return <TeamsShell data={data} users={users} initialSearch={search} />
}
