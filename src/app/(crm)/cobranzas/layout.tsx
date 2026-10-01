import { notFound } from "next/navigation"
import { getSession } from "@/lib/session"
import { canManageCollections } from "@/lib/permissions"
import { CollectionsSubNav } from "@/modules/collections/components/CollectionsSubNav"

export default async function CobranzasLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !canManageCollections(session)) notFound()

  return (
    <>
      <CollectionsSubNav />
      {children}
    </>
  )
}
