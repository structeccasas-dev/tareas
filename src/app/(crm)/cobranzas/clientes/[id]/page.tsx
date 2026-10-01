import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getClientDetail } from "@/modules/collections/data/queries"
import { ClientDetailShell } from "@/modules/collections/components/ClientDetailShell"

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  const { id } = await params
  const detail = await getClientDetail(id)
  if (!detail) notFound()

  return <ClientDetailShell detail={detail} />
}
