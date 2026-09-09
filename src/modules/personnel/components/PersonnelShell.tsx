"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Search, IdCard } from "lucide-react"
import type { ContractType, PersonnelPage } from "@/types/personnel"
import { createPersonnel } from "@/modules/personnel/actions/personnelActions"
import { PersonnelStatusBadge } from "@/modules/personnel/components/PersonnelStatusBadge"
import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Select } from "@/components/Select"
import { Avatar } from "@/components/Avatar"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"

interface PersonnelShellProps {
  data: PersonnelPage
  initialSearch: string
}

interface FormState {
  fullName: string
  position: string
  contractType: ContractType
  startDate: string
  probationEndDate: string
}

const EMPTY_FORM: FormState = {
  fullName: "",
  position: "",
  contractType: "prueba",
  startDate: "",
  probationEndDate: "",
}

export function PersonnelShell({ data, initialSearch }: PersonnelShellProps) {
  const { personnel, page, totalPages } = data
  const router = useRouter()
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const [search, setSearch] = useState(initialSearch)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
      router.replace(`/personal${params.toString() ? `?${params}` : ""}`)
    }, 350)
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setError(null)
    setDialogOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await createPersonnel(form)
        setDialogOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear")
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Personal"
        description={`${data.total} ${data.total === 1 ? "persona" : "personas"} en seguimiento`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nueva persona
          </Button>
        }
      />

      <div className="p-6 max-w-5xl mx-auto w-full">
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Input
              type="text"
              icon={<Search />}
              placeholder="Buscar por nombre o cargo..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {personnel.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              {search ? (
                <>
                  <Search className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
                  <p className="mt-3 text-sm">Sin resultados para &quot;{search}&quot;</p>
                </>
              ) : (
                <>
                  <IdCard className="w-10 h-10 text-gray-300" strokeWidth={1.25} />
                  <p className="mt-3 text-sm">No hay personas cargadas. Agregá la primera.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-alt">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Persona</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">
                      Cargo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {personnel.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-alt transition-colors duration-200 group">
                      <td className="px-4 py-3.5">
                        <Link href={`/personal/${p.id}`} className="flex items-center gap-3">
                          <Avatar name={p.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{p.fullName}</p>
                            <p className="text-xs text-gray-400 truncate sm:hidden">{p.position ?? "—"}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell text-gray-600">{p.position ?? "—"}</td>
                      <td className="px-4 py-3.5">
                        <PersonnelStatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} totalPages={totalPages} basePath="/personal" searchParams={{ search }} />
        </Card>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nueva persona">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre completo">
            <Input
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Nombre y apellido"
            />
          </Field>

          <Field label="Cargo">
            <Input
              type="text"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              placeholder="Ej. Vendedor"
            />
          </Field>

          <Field label="Tipo de contrato">
            <Select
              value={form.contractType}
              onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value as ContractType }))}
            >
              <option value="prueba">Período de prueba</option>
              <option value="fijo">Término fijo</option>
              <option value="indefinido">Indefinido</option>
              <option value="prestacion_servicios">Prestación de servicios</option>
            </Select>
          </Field>

          <Field label="Fecha de ingreso">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </Field>

          {form.contractType === "prueba" && (
            <Field label="Fin del período de prueba">
              <Input
                type="date"
                value={form.probationEndDate}
                onChange={(e) => setForm((f) => ({ ...f, probationEndDate: e.target.value }))}
              />
            </Field>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Crear
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}

