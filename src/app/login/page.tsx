"use client"

import { useActionState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, CheckSquare } from "lucide-react"
import { login } from "@/lib/auth"
import { Card } from "@/components/Card"
import { Input } from "@/components/Input"
import { Button } from "@/components/Button"

export default function LoginPage() {
  const [error, action, isPending] = useActionState(login, undefined)

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-bg px-4 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgba(37,211,102,0.08),transparent)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-elevation-md">
            <CheckSquare className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Gestión de Tareas</h1>
          <p className="mt-1 text-sm text-gray-500">Iniciá sesión para continuar</p>
        </div>

        {/* Card */}
        <Card className="p-8 shadow-elevation-md">
          <form action={action} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@email.com" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-error/8 border border-error/15 rounded-xl text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" isLoading={isPending} className="w-full mt-1">
              {isPending ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
