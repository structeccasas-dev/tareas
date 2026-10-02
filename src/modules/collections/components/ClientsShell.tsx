"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Search, Users } from "lucide-react"
import { clientDisplayName } from "@/modules/collections/format"
import { ClientStatusBadge } from "./ClientStatusBadge"
import { ClientFormDialog } from "./ClientFormDialog"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Avatar } from "@/components/Avatar"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import type { ClientPage } from "@/types/collections"

interface ClientsShellProps {
  data: ClientPage
  initialSearch: string
}

export function ClientsShell({ data, initialSearch }: ClientsShellProps) {
  const { clients, page, totalPages } = data
  const router = useRouter()
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [search, setSearch] = useState(initialSearch)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [prevInitialSearch, setPrevInitialSearch] = useState(initialSearch)
  if (initialSearch !== prevInitialSearch) {
    setPrevInitialSearch(initialSearch)
    setSearch(initialSearch)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (value) params.set("search", value)
      router.replace(`/cobranzas/clientes${params.toString() ? `?${params}` : ""}`)
    }, 350)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Clientes"
        description={`${data.total} ${data.total === 1 ? "cliente" : "clientes"} en cartera`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Nuevo cliente
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Input
              type="text"
              icon={<Search />}
              placeholder="Buscar por nombre, razón social o documento..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
              <p className="mt-3 text-sm">{search ? `Sin resultados para "${search}"` : "No hay clientes cargados. Agregá el primero."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Documento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-alt transition-colors duration-200 group">
                      <td className="px-4 py-3.5">
                        <Link href={`/cobranzas/clientes/${c.id}`} className="flex items-center gap-3">
                          <Avatar name={clientDisplayName(c)} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{clientDisplayName(c)}</p>
                            <p className="text-xs text-gray-400 truncate sm:hidden">{c.documentNumber}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell text-gray-600">{c.documentNumber}</td>
                      <td className="px-4 py-3.5">
                        <ClientStatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} basePath="/cobranzas/clientes" searchParams={{ search }} />
        </Card>
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={(id) => {
          setDialogOpen(false)
          router.push(`/cobranzas/clientes/${id}`)
        }}
      />
    </div>
  )
}
