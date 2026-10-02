"use client"

import { Dialog } from "@/components/Dialog"
import { Button } from "@/components/Button"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  isLoading?: boolean
  error?: string | null
  danger?: boolean
}

// Confirmación deliberadamente separada de la acción principal — para que
// archivar/cancelar nunca sea "un clic de más" por error (ver feedback del
// usuario: las bajas deben ser más difíciles que crear/editar).
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  isLoading,
  error,
  danger = true,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "primary"} isLoading={isLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
