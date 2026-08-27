import { getSession } from "@/lib/session"
import { getSessionUserSummary } from "@/modules/profile/data/queries"
import { getDueTasksCount } from "@/modules/tasks/data/queries"
import { PushOptInLoader } from "@/modules/notifications/components/PushOptInLoader"
import { Sidebar } from "./Sidebar"
import { MobileNav } from "./MobileNav"

interface AppLayoutProps {
  children: React.ReactNode
}

export async function AppLayout({ children }: AppLayoutProps) {
  const session = await getSession()
  const role = session?.role ?? "agent"
  const [user, dueTasksCount] = await Promise.all([
    session ? getSessionUserSummary() : Promise.resolve(null),
    session ? getDueTasksCount() : Promise.resolve(0),
  ])

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 w-60 hidden md:flex flex-col bg-sidebar shadow-[1px_0_0_rgba(0,0,0,.04),4px_0_16px_rgba(17,24,39,.03)] overflow-y-auto print:hidden">
        <Sidebar role={role} user={user} dueTasksCount={dueTasksCount} />
      </aside>
      <div className="print:hidden">
        <MobileNav role={role} user={user} dueTasksCount={dueTasksCount} />
      </div>
      <main className="md:pl-60 print:pl-0 bg-bg min-h-dvh">{children}</main>
      {session && <PushOptInLoader />}
    </>
  )
}
