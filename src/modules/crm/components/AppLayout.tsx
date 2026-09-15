import { getSession } from "@/lib/session"
import { getSessionUserSummary } from "@/modules/profile/data/queries"
import { getDueTasksCount } from "@/modules/tasks/data/queries"
import { getUnreadNotificationsCount } from "@/modules/notifications/data/queries"
import { getPendingLeavesCount } from "@/modules/personnel/data/queries"
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
  const [user, dueTasksCount, unreadCount, pendingLeavesCount] = await Promise.all([
    session ? getSessionUserSummary() : Promise.resolve(null),
    session ? getDueTasksCount() : Promise.resolve(0),
    session ? getUnreadNotificationsCount() : Promise.resolve(0),
    role === "admin" ? getPendingLeavesCount() : Promise.resolve(0),
  ])

  return (
    <>
      {/* Tiene que ir antes que el contenido de la página: su barra usa
          sticky top-0, así que si quedara después en el documento (como
          estaba) no "engancharía" arriba hasta hacer scroll hasta el final. */}
      <div className="print:hidden">
        <MobileNav
          role={role}
          user={user}
          dueTasksCount={dueTasksCount}
          unreadCount={unreadCount}
          pendingLeavesCount={pendingLeavesCount}
        />
      </div>
      <DesktopSidebarShell
        sidebar={
          <Sidebar
            role={role}
            user={user}
            dueTasksCount={dueTasksCount}
            unreadCount={unreadCount}
            pendingLeavesCount={pendingLeavesCount}
          />
        }
      >
        {children}
      </DesktopSidebarShell>
      {session && <PushOptInLoader />}
    </>
  )
}
