import { notFound } from "next/navigation"
import {
  getPersonnelById,
  getDocumentsForPersonnel,
  getActiveInvitation,
  getHistoryForPersonnel,
  getLeavesForPersonnel,
  getVacationDaysUsed,
  getLinkedUser,
  getUnlinkedUsers,
} from "@/modules/personnel/data/queries"
import { PersonnelDetail } from "@/modules/personnel/components/PersonnelDetail"
import { getSession } from "@/lib/session"
import { canManageUsers } from "@/lib/permissions"

export default async function PersonalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; leavesPage?: string }>
}) {
  const session = await getSession()
  if (!session || !canManageUsers(session)) notFound()

  const { id } = await params
  const { page, leavesPage } = await searchParams
  const personnel = await getPersonnelById(id)
  if (!personnel) notFound()

  const [documents, activeInvitation, history, leaves, vacationDaysUsed, linkedUser, unlinkedUsers] = await Promise.all([
    getDocumentsForPersonnel(id),
    getActiveInvitation(id),
    getHistoryForPersonnel(id, { page: Math.max(1, Number(page) || 1) }),
    getLeavesForPersonnel(id, { page: Math.max(1, Number(leavesPage) || 1) }),
    getVacationDaysUsed(id),
    getLinkedUser(personnel.linkedUserId),
    getUnlinkedUsers(),
  ])

  return (
    <PersonnelDetail
      personnel={personnel}
      documents={documents}
      activeInvitationToken={activeInvitation?.token ?? null}
      history={history}
      leaves={leaves}
      vacationDaysUsed={vacationDaysUsed}
      linkedUser={linkedUser}
      unlinkedUsers={unlinkedUsers}
    />
  )
}
