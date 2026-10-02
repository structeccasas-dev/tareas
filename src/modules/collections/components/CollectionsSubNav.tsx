"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wallet, Users, Building2, Calculator } from "lucide-react"

const TABS = [
  { href: "/cobranzas", label: "Principal", icon: Wallet, exact: true },
  { href: "/cobranzas/clientes", label: "Clientes", icon: Users, exact: false },
  { href: "/cobranzas/proyectos", label: "Proyectos", icon: Building2, exact: false },
  { href: "/cobranzas/cotizador", label: "Cotizador", icon: Calculator, exact: false },
]

// Sub-navegación persistente del módulo de cobranzas — antes cada sección
// (Clientes/Proyectos/Cotizador) sólo tenía un botón "Volver" al dashboard,
// así que moverse entre secciones hermanas significaba pasar siempre por
// ahí. Con esto cualquier sección queda a un clic de las demás.
export function CollectionsSubNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1 border-b border-border bg-surface px-6 overflow-x-auto print:hidden">
      {TABS.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? "border-primary text-primary-dark"
                : "border-transparent text-gray-500 hover:text-gray-900 hover:border-border"
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
