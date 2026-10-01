"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertTriangle, CalendarClock, Plus, Search, Receipt } from "lucide-react"
import { PageHeader } from "@/components/PageHeader"
import { Card } from "@/components/Card"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Pagination } from "@/components/Pagination"
import { OperationStatusBadge } from "./OperationStatusBadge"
import { ClientFormDialog } from "./ClientFormDialog"
import { CreateOperationDialog } from "./CreateOperationDialog"
import { clientDisplayName, formatMoney, formatOperationNumber } from "@/modules/collections/format"
import type { Client, Currency, DashboardSummary, OperationsPage, Project } from "@/types/collections"

interface CollectionsDashboardProps {
  summary: DashboardSummary
  operationsPage: OperationsPage
  initialSearch: string
  initialProject: string
  clients: Client[]
  currencies: Currency[]
  projects: Project[]
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function CollectionsDashboard({
  summary,
  operationsPage,
  initialSearch,
  initialProject,
  clients,
  currencies,
  projects,
}: CollectionsDashboardProps) {
  const { operations, page, totalPages } = operationsPage
  const router = useRouter()
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const today = todayIso()

  const [search, setSearch] = useState(initialSearch)
  const [projectFilter, setProjectFilter] = useState(initialProject)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [newOperationOpen, setNewOperationOpen] = useState(false)

  const [prevInitialSearch, setPrevInitialSearch] = useState(initialSearch)
  if (initialSearch !== prevInitialSearch) {
    setPrevInitialSearch(initialSearch)
    setSearch(initialSearch)
  }

  function pushFilters(nextSearch: string, nextProject: string) {
    const params = new URLSearchParams()
    if (nextSearch) params.set("search", nextSearch)
    if (nextProject) params.set("project", nextProject)
    router.replace(`/cobranzas${params.toString() ? `?${params}` : ""}`)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => pushFilters(value, projectFilter), 350)
  }

  function handleProjectFilterChange(value: string) {
    setProjectFilter(value)
    clearTimeout(searchTimeoutRef.current)
    pushFilters(search, value)
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Cobranzas"
        description="Cartera, cobranza y financiamiento"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setNewClientOpen(true)}>
              <Plus className="w-4 h-4" />
              Nuevo cliente
            </Button>
            <Button onClick={() => setNewOperationOpen(true)}>
              <Receipt className="w-4 h-4" />
              Nueva cobranza
            </Button>
          </div>
        }
      />
      <div className="p-6 max-w-7xl mx-auto w-full space-y-2.5">
        <div className="space-y-2">
          {summary.byCurrency.length === 0 ? (
            <Card className="p-4 text-center text-gray-400 text-sm">
              Todavía no hay operaciones registradas.
            </Card>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {summary.byCurrency.map((c) => (
                <Card key={c.currencyCode} className="p-2.5">
                  <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    {c.currencyCode}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <MiniStat label="Cartera" value={formatMoney(c.totalPortfolio, c.currencyCode)} />
                    <MiniStat label="Cobrado" value={formatMoney(c.totalCollected, c.currencyCode)} />
                    <MiniStat label="Pendiente" value={formatMoney(c.totalPending, c.currencyCode)} />
                    <MiniStat
                      label="Vencido"
                      value={formatMoney(c.totalOverdue, c.currencyCode)}
                      tone={Number(c.totalOverdue) > 0 ? "warning" : "default"}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1.5 pt-1.5 border-t border-border">
                    <MiniStat label="Hoy" value={formatMoney(c.collectedToday, c.currencyCode)} />
                    <MiniStat label="Este mes" value={formatMoney(c.collectedThisMonth, c.currencyCode)} />
                    <MiniStat label="Este año" value={formatMoney(c.collectedThisYear, c.currencyCode)} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
              <CalendarClock className="w-3.5 h-3.5" />
              Vencimientos
            </span>
            <MiniStat label="Hoy" value={String(summary.dueTodayCount)} />
            <MiniStat label="Próx. 7 días" value={String(summary.dueNext7DaysCount)} />
            <MiniStat label="Próx. 30 días" value={String(summary.dueNext30DaysCount)} />
            {summary.overdueOperationsCount > 0 && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {summary.overdueOperationsCount} operacion{summary.overdueOperationsCount === 1 ? "" : "es"} vencida{summary.overdueOperationsCount === 1 ? "" : "s"}
              </span>
            )}
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Préstamos</h3>
              <Input
                type="text"
                icon={<Search />}
                placeholder="Buscar por número de préstamo, cliente, documento, proyecto o departamento..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="sm:w-56">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 sm:invisible">Proyecto</h3>
              <Select value={projectFilter} onChange={(e) => handleProjectFilterChange(e.target.value)}>
                <option value="">Todos los proyectos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {operations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Receipt className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
              <p className="mt-3 text-sm">{search ? `Sin resultados para "${search}"` : "Todavía no hay préstamos cargados."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Préstamo</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Proyecto / Unidad</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Pagado</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Vencimiento</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {operations.map((op) => (
                    <tr key={op.id} className="hover:bg-surface-alt transition-colors duration-200">
                      <td className="px-4 py-3.5">
                        <Link href={`/cobranzas/operaciones/${op.id}`} className="font-medium text-gray-900 hover:text-primary-dark">
                          {formatOperationNumber(op.sequenceNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/cobranzas/clientes/${op.client.id}`} className="text-gray-700 hover:text-primary-dark">
                          {clientDisplayName(op.client)}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 hidden md:table-cell">
                        {op.property ? `${op.property.projectNameSnapshot} · ${op.property.unitLabel}` : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-600 hidden sm:table-cell">{formatMoney(op.totalPaid, op.currencyCode)}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-gray-900">
                        {formatMoney(op.currentBalance, op.currencyCode)}
                        {op.nextDueDate && (
                          <p className={`sm:hidden text-xs font-normal ${op.nextDueDate < today ? "text-red-600" : "text-gray-500"}`}>
                            Vence {op.nextDueDate}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                        {op.nextDueDate ? (
                          <span className={op.nextDueDate < today ? "font-medium text-red-600" : "text-gray-600"}>{op.nextDueDate}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <OperationStatusBadge status={op.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} basePath="/cobranzas" searchParams={{ search, project: projectFilter }} />
        </Card>
      </div>

      <ClientFormDialog
        open={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onSaved={() => {
          setNewClientOpen(false)
          router.refresh()
        }}
      />

      <CreateOperationDialog
        open={newOperationOpen}
        onClose={() => setNewOperationOpen(false)}
        clients={clients}
        currencies={currencies}
        projects={projects}
        onCreated={(id) => {
          setNewOperationOpen(false)
          router.push(`/cobranzas/operaciones/${id}`)
        }}
      />
    </div>
  )
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500 truncate">{label}</p>
      <p className={`text-sm font-semibold truncate ${tone === "warning" ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
    </div>
  )
}
