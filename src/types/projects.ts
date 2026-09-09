export interface Project {
  id: string
  name: string
  createdAt: Date
  // Tareas "todo"/"in_progress" asociadas — si es > 0 no se puede borrar el proyecto.
  activeTaskCount: number
}

export interface ProjectsPage {
  projects: Project[]
  total: number
  page: number
  totalPages: number
}
