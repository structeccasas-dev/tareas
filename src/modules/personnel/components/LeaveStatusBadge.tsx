import { Badge } from "@/components/Badge"
import { LEAVE_STATUS_LABELS } from "@/modules/personnel/labels"
import type { LeaveStatus } from "@/types/personnel"

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  if (status === "approved") return <Badge tone="success" dot>{LEAVE_STATUS_LABELS.approved}</Badge>
  if (status === "rejected") return <Badge tone="error" dot>{LEAVE_STATUS_LABELS.rejected}</Badge>
  return <Badge tone="warning" dot>{LEAVE_STATUS_LABELS.pending}</Badge>
}
