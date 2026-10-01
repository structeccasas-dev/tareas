import { Badge } from "@/components/Badge"
import type { OperationStatus } from "@/types/collections"

export function OperationStatusBadge({ status }: { status: OperationStatus }) {
  if (status === "active") return <Badge tone="primary" dot>Activa</Badge>
  if (status === "completed") return <Badge tone="success" dot>Completada</Badge>
  if (status === "refinanced") return <Badge tone="info" dot>Refinanciada</Badge>
  return <Badge tone="neutral" dot>Cancelada</Badge>
}
