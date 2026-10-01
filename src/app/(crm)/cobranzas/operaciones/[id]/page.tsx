import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getCurrencies, getOperationDetail, getProjectsList } from "@/modules/collections/data/queries"
import { OperationDetailShell } from "@/modules/collections/components/OperationDetailShell"

export default async function OperacionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  const { id } = await params
  const [detail, currencies, projects] = await Promise.all([getOperationDetail(id), getCurrencies(), getProjectsList()])
  if (!detail) notFound()

  return <OperationDetailShell detail={detail} currencies={currencies} projects={projects} />
}
