import { Badge } from "@/components/Badge"
import type { InstallmentStatus } from "@/types/collections"

interface InstallmentStatusBadgeProps {
  status: InstallmentStatus
  dueDate: string
}

// "Vencida" no es un valor de `status`: se deriva acá mismo comparando con
// hoy (ver docs/cobranzas/DISENO.md, nota en C.8). Esta vista no aplica días
// de gracia — es sólo una señal visual rápida en la tabla de cuotas.
export function InstallmentStatusBadge({ status, dueDate }: InstallmentStatusBadgeProps) {
  if (status === "paid") return <Badge tone="success" dot>Pagada</Badge>
  if (status === "cancelled") return <Badge tone="neutral" dot>Cancelada</Badge>
  if (status === "refinanced") return <Badge tone="info" dot>Refinanciada</Badge>

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = dueDate < today
  if (isOverdue) return <Badge tone="error" dot>Vencida</Badge>
  if (status === "partial") return <Badge tone="warning" dot>Parcial</Badge>
  return <Badge tone="neutral" dot>Pendiente</Badge>
}
