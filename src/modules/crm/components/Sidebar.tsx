"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, ListChecks, UserCog, LogOut, CheckSquare } from "lucide-react"
import { logout } from "@/lib/auth"
import { Avatar } from "@/components/Avatar"
import type { SessionUserSummary, UserRole } from "@/types/users"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid, roles: null },
  { href: "/tareas", label: "Tareas", icon: ListChecks, roles: null },
  { href: "/users", label: "Usuarios", icon: UserCog, roles: ["admin"] },
] as const satisfies { href: string; label: string; icon: unknown; roles: UserRole[] | null }[]

interface SidebarProps {
  role: UserRole
  user: SessionUserSummary | null
  dueTasksCount?: number
}

export function Sidebar({ role, user, dueTasksCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/")
  }

  const items = NAV_ITEMS.filter((item) => !item.roles || (item.roles as readonly UserRole[]).includes(role))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 h-14 flex-shrink-0">
        <div className="w-7 h-7 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-elevation-xs">
          <CheckSquare className="w-4 h-4 text-white" strokeWidth={2} />
        </div>
        <span className="font-semibold text-sm text-gray-900 tracking-tight">Gestión de Tareas</span>
      </div>

      <nav className="flex-1 px-2.5 py-2 overflow-y-auto scrollbar-thin">
        <ul className="space-y-0.5">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 ease-out ${
                    active
                      ? "bg-surface text-primary-dark font-medium shadow-elevation-xs"
                      : "text-gray-600 hover:bg-black/[.035] hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.9} />
                  {label}
                  {href === "/tareas" && dueTasksCount > 0 && (
                    <span className="ml-auto flex-shrink-0 min-w-[1.25rem] px-1 h-5 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center">
                      {dueTasksCount > 99 ? "99+" : dueTasksCount}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-2.5 py-3 border-t border-border space-y-1">
        {user && (
          <Link
            href="/perfil"
            className={`flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm transition-colors duration-150 ${
              isActive("/perfil")
                ? "bg-surface text-primary-dark font-medium shadow-elevation-xs"
                : "text-gray-600 hover:bg-black/[.035] hover:text-gray-900"
            }`}
          >
            <Avatar name={user.name} size="sm" />
            <span className="truncate">{user.name}</span>
          </Link>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-500/[.06] hover:text-red-600 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.9} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
