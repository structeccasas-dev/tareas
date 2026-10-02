import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getClientsList } from "@/modules/collections/data/queries"
import { ClientsShell } from "@/modules/collections/components/ClientsShell"

export default async function CobranzasClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  const params = await searchParams
  const search = typeof params.search === "string" ? params.search : ""
  const page = Math.max(1, Number(params.page) || 1)

  const data = await getClientsList({ page, search })
  return <ClientsShell data={data} initialSearch={search} />
}
