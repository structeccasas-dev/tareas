import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { getActiveClientsForSelect, getCurrencies } from "@/modules/collections/data/queries"
import { QuoteSimulator } from "@/modules/collections/components/QuoteSimulator"

export default async function CotizadorPage() {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  const [clients, currencies] = await Promise.all([getActiveClientsForSelect(), getCurrencies()])
  return <QuoteSimulator clients={clients} currencies={currencies} />
}
