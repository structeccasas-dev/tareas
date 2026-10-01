import { Badge } from "@/components/Badge"
import type { ClientStatus } from "@/types/collections"

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  if (status === "active") return <Badge tone="success" dot>Activo</Badge>
  if (status === "inactive") return <Badge tone="warning" dot>Inactivo</Badge>
  return <Badge tone="neutral" dot>Archivado</Badge>
}
