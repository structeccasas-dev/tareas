export type ContractType = "prueba" | "fijo" | "indefinido" | "prestacion_servicios"

export type PersonnelStatus = "invitado" | "datos_completados" | "contrato_subido"

export type DocumentType = "id_front" | "id_back" | "contract" | "other"

export type LeaveType =
  | "vacaciones"
  | "enfermedad"
  | "maternidad"
  | "paternidad"
  | "matrimonio"
  | "duelo"
  | "estudio"
  | "sin_goce_sueldo"
  | "otra"

export interface Personnel {
  id: string
  fullName: string
  documentType: string | null
  documentNumber: string | null
  birthDate: string | null
  address: string | null
  phone: string | null
  personalEmail: string | null
  position: string | null
  contractType: ContractType | null
  startDate: string | null
  probationEndDate: string | null
  salary: string | null
  bankName: string | null
  bankAccountType: string | null
  bankAccountNumber: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  status: PersonnelStatus
  linkedUserId: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface PersonnelDocument {
  id: string
  personnelId: string
  type: DocumentType
  fileName: string
  mimeType: string
  size: string
  uploadedAt: Date
}

export interface PersonnelInvitation {
  id: string
  personnelId: string
  token: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
}

export interface PersonnelLeave {
  id: string
  personnelId: string
  type: LeaveType
  startDate: string
  endDate: string
  daysCount: string
  countsAsVacation: boolean
  notes: string | null
  createdBy: string
  createdAt: Date
}

export interface PersonnelHistoryEntry {
  id: string
  personnelId: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedByName: string
  changedAt: Date
}

export interface PersonnelPage {
  personnel: Personnel[]
  total: number
  page: number
  totalPages: number
}

export interface PersonnelHistoryPage {
  history: PersonnelHistoryEntry[]
  total: number
  page: number
  totalPages: number
}
