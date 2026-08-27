import { notFound } from "next/navigation"
import { getUsers } from "@/modules/users/data/queries"
import { UsersShell } from "@/modules/users/components/UsersShell"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"

export default async function UsersPage() {
  const session = await getSession()
  if (!session || !canManageUsers(session)) notFound()

  const users = await getUsers()
  return <UsersShell users={users} />
}
