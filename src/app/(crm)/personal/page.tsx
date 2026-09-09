import { notFound } from "next/navigation"
import { getPersonnelList } from "@/modules/personnel/data/queries"
import { PersonnelShell } from "@/modules/personnel/components/PersonnelShell"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session || !canManageUsers(session)) notFound()

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const page = Math.max(1, Number(params.page) || 1)

  const data = await getPersonnelList({ page, search })
  return <PersonnelShell data={data} initialSearch={search} />
}
