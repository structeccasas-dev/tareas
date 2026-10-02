import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getClientById, getCurrencies, getProjectsList } from "@/modules/collections/data/queries"
import { CreateOperationForm } from "@/modules/collections/components/CreateOperationForm"

export default async function NuevaOperacionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  const { id } = await params
  const [client, currencies, projects] = await Promise.all([getClientById(id), getCurrencies(), getProjectsList()])
  if (!client) notFound()

  return <CreateOperationForm client={client} currencies={currencies} projects={projects} />
}
