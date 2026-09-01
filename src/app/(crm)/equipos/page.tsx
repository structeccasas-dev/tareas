import { notFound } from "next/navigation"
import { getTeams } from "@/modules/teams/data/queries"
import { getUsers } from "@/modules/users/data/queries"
import { TeamsShell } from "@/modules/teams/components/TeamsShell"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"

export default async function EquiposPage() {
  const session = await getSession()
  if (!session || !canManageUsers(session)) notFound()

  const [teams, users] = await Promise.all([getTeams(), getUsers()])
  return <TeamsShell teams={teams} users={users} />
}
