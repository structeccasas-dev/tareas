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
