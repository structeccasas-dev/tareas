import { redirect } from "next/navigation"
import { getOwnProfile } from "@/modules/profile/data/queries"
import { getPersonnelByLinkedUser, getLeavesForPersonnel, getVacationDaysUsed } from "@/modules/personnel/data/queries"
import { ProfileShell } from "@/modules/profile/components/ProfileShell"

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const profile = await getOwnProfile()
  if (!profile) redirect("/login")

  const { page } = await searchParams
  const personnel = await getPersonnelByLinkedUser(profile.id)
  const [leaves, vacationDaysUsed] = personnel
    ? await Promise.all([
        getLeavesForPersonnel(personnel.id, { page: Math.max(1, Number(page) || 1) }),
        getVacationDaysUsed(personnel.id),
      ])
    : [{ leaves: [], total: 0, page: 1, totalPages: 1 }, 0]

  return (
    <ProfileShell profile={profile} personnelId={personnel?.id ?? null} leaves={leaves} vacationDaysUsed={vacationDaysUsed} />
  )
}
