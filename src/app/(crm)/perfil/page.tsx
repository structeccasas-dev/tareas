import { redirect } from "next/navigation"
import { getOwnProfile } from "@/modules/profile/data/queries"
import { ProfileShell } from "@/modules/profile/components/ProfileShell"

export default async function ProfilePage() {
  const profile = await getOwnProfile()
  if (!profile) redirect("/login")

  return <ProfileShell profile={profile} />
}
