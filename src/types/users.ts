export type UserRole = "admin" | "agent" | "supervisor"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type OwnProfile = User

export interface SessionUserSummary {
  id: string
  name: string
}
