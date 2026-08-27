export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (mins < 1) return "Ahora mismo"
  if (mins < 60) return `hace ${mins} min`
  if (hours < 24) return `hace ${hours}h`
  if (days === 1) return "hace 1 día"
  return `hace ${days} días`
}
