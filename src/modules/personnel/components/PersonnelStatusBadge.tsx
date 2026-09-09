import { Badge } from "@/components/Badge"
import type { PersonnelStatus } from "@/types/personnel"

export function PersonnelStatusBadge({ status }: { status: PersonnelStatus }) {
  if (status === "contrato_subido") return <Badge tone="primary" dot>Contrato subido</Badge>
  if (status === "datos_completados") return <Badge tone="info" dot>Datos completados</Badge>
  return <Badge tone="warning" dot>Invitado</Badge>
}
