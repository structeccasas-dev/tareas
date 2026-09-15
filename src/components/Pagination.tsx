import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  page: number
  totalPages: number
  basePath: string
  searchParams?: Record<string, string | undefined>
  // Nombre del query param a usar — permite tener más de una lista paginada
  // en la misma página sin que se pisen entre sí (ej. "page" e "leavesPage").
  paramName?: string
}

export function Pagination({ page, totalPages, basePath, searchParams = {}, paramName = "page" }: PaginationProps) {
  if (totalPages <= 1) return null

  function hrefFor(target: number) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value)
    }
    if (target > 1) params.set(paramName, String(target))
    else params.delete(paramName)
    const qs = params.toString()
    return `${basePath}${qs ? `?${qs}` : ""}`
  }

  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <PageLink href={hrefFor(page - 1)} disabled={!hasPrev}>
        <ChevronLeft className="w-4 h-4" />
        Anterior
      </PageLink>
      <span className="text-xs text-gray-500">
        Página {page} de {totalPages}
      </span>
      <PageLink href={hrefFor(page + 1)} disabled={!hasNext}>
        Siguiente
        <ChevronRight className="w-4 h-4" />
      </PageLink>
    </div>
  )
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-gray-300 cursor-not-allowed select-none">
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-primary-dark transition-colors duration-150"
    >
      {children}
    </Link>
  )
}
