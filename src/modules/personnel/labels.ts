import type { LeaveStatus, LeaveType } from "@/types/personnel"

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacaciones: "Vacaciones",
  enfermedad: "Enfermedad",
  maternidad: "Maternidad",
  paternidad: "Paternidad",
  matrimonio: "Matrimonio",
  duelo: "Duelo",
  estudio: "Estudio",
  sin_goce_sueldo: "Sin goce de sueldo",
  otra: "Otra",
}

interface LeaveSummaryInput {
  type: LeaveType
  startDate: string
  endDate: string
  daysCount: string
  countsAsVacation: boolean
  notes?: string | null
}

export function summarizeLeave(leave: LeaveSummaryInput): string {
  const days = Number(leave.daysCount)
  const parts = [
    `${LEAVE_TYPE_LABELS[leave.type]} · ${days} ${days === 1 ? "día" : "días"} (${leave.startDate} → ${leave.endDate})`,
  ]
  if (leave.countsAsVacation) parts.push("descuenta vacaciones")
  if (leave.notes) parts.push(leave.notes)
  return parts.join(" · ")
}
