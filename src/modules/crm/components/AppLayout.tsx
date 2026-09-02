import { getSession } from "@/lib/session"
import { getSessionUserSummary } from "@/modules/profile/data/queries"
import { getDueTasksCount } from "@/modules/tasks/data/queries"
import { getUnreadNotificationsCount } from "@/modules/notifications/data/queries"
import { PushOptInLoader } from "@/modules/notifications/components/PushOptInLoader"
import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"
import { DesktopSidebarShell } from "./DesktopSidebarShell"

interface AppLayoutProps {
  children: React.ReactNode
}

export async function AppLayout({ children }: AppLayoutProps) {
  const session = await getSession()
  const role = session?.role ?? "agent"
  const [user, dueTasksCount, unreadCount] = await Promise.all([
    session ? getSessionUserSummary() : Promise.resolve(null),
    session ? getDueTasksCount() : Promise.resolve(0),
    session ? getUnreadNotificationsCount() : Promise.resolve(0),
  ])

  return (
    <>
      <DesktopSidebarShell sidebar={<Sidebar role={role} user={user} dueTasksCount={dueTasksCount} unreadCount={unreadCount} />}>
        {children}
      </DesktopSidebarShell>
      <div className="print:hidden">
        <MobileNav role={role} user={user} dueTasksCount={dueTasksCount} unreadCount={unreadCount} />
      </div>
      {session && <PushOptInLoader />}
    </>
  )
}
