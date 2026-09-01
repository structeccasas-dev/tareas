export interface Project {
  id: string
  name: string
  createdAt: Date
  // Tareas "todo"/"in_progress" asociadas — si es > 0 no se puede borrar el proyecto.
  activeTaskCount: number
}
