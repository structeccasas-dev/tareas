"use client"

import { useRef, useState, useTransition } from "react"
import { CheckCircle2, AlertCircle } from "lucide-react"
import { submitOnboarding } from "@/modules/personnel/actions/personnelActions"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Button } from "@/components/Button"

interface OnboardingFormProps {
  token: string
  personnelName: string
}

export function OnboardingForm({ token, personnelName }: OnboardingFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await submitOnboarding(token, formData)
        setDone(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo enviar")
      }
    })
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg px-4">
        <Card className="p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900">¡Listo!</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Tus datos y documentos fueron recibidos correctamente. Podés cerrar esta ventana.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Bienvenido/a, {personnelName}</h1>
          <p className="mt-1 text-sm text-gray-500">Completá tus datos y subí las fotos de tu carnet de identidad.</p>
        </div>

        <Card className="p-6">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <Section title="Documento de identidad">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de documento">
                  <Input name="documentType" placeholder="Ej. Cédula" />
                </Field>
                <Field label="Número de documento">
                  <Input name="documentNumber" required placeholder="Número" />
                </Field>
              </div>
            </Section>

            <Section title="Datos personales">
              <Field label="Fecha de nacimiento">
                <Input name="birthDate" type="date" required />
              </Field>
              <Field label="Dirección">
                <Input name="address" required placeholder="Dirección completa" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono">
                  <Input name="phone" required placeholder="Teléfono" />
                </Field>
                <Field label="Email personal">
                  <Input name="personalEmail" type="email" placeholder="email@ejemplo.com" />
                </Field>
              </div>
            </Section>

            <Section title="Datos bancarios (opcional)">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Banco">
                  <Input name="bankName" placeholder="Nombre del banco" />
                </Field>
                <Field label="Tipo de cuenta">
                  <Input name="bankAccountType" placeholder="Ahorros / Corriente" />
                </Field>
              </div>
              <Field label="Número de cuenta">
                <Input name="bankAccountNumber" placeholder="Número de cuenta" />
              </Field>
            </Section>

            <Section title="Contacto de emergencia">
              <Field label="Nombre">
                <Input name="emergencyContactName" required placeholder="Nombre completo" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Teléfono">
                  <Input name="emergencyContactPhone" required placeholder="Teléfono" />
                </Field>
                <Field label="Parentesco">
                  <Input name="emergencyContactRelationship" placeholder="Ej. Madre" />
                </Field>
              </div>
            </Section>

            <Section title="Fotos del carnet">
              <Field label="Frente">
                <input
                  name="idFront"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  required
                  className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface-alt file:text-gray-700 file:text-xs"
                />
              </Field>
              <Field label="Reverso">
                <input
                  name="idBack"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  required
                  className="w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface-alt file:text-gray-700 file:text-xs"
                />
              </Field>
            </Section>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-error/8 border border-error/15 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" isLoading={isPending} className="w-full">
              Enviar
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 pb-5 border-b border-border last:border-b-0 last:pb-0">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      {children}
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
