"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/PageHeader"
import { Button } from "@/components/Button"
import { OperationFormFields } from "@/modules/collections/components/OperationFormFields"
import type { Client, Currency, Project } from "@/types/collections"

interface CreateOperationFormProps {
  client: Client
  currencies: Currency[]
  projects: Project[]
}

export function CreateOperationForm({ client, currencies, projects }: CreateOperationFormProps) {
  const router = useRouter()

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Nueva operación financiera"
        description={`Cliente: ${client.firstName ?? client.businessName ?? ""} ${client.lastName ?? ""}`.trim()}
        actions={
          <Link href={`/cobranzas/clientes/${client.id}`}>
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
          </Link>
        }
      />

      <div className="p-6 max-w-3xl mx-auto w-full">
        <OperationFormFields
          clientId={client.id}
          currencies={currencies}
          projects={projects}
          onCreated={(id) => router.push(`/cobranzas/operaciones/${id}`)}
        />
      </div>
    </div>
  )
}
