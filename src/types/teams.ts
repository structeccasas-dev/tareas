export interface TeamMemberRef {
  id: string
  name: string
  email: string
}

export interface Team {
  id: string
  name: string
  createdAt: Date
  members: TeamMemberRef[]
}

export interface TeamsPage {
  teams: Team[]
  total: number
  page: number
  totalPages: number
}
