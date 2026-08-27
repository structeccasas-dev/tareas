interface HorizontalBarItem {
  label: string
  value: number
  colorClassName?: string
}

interface HorizontalBarListProps {
  data: HorizontalBarItem[]
  emptyLabel?: string
}

export function HorizontalBarList({
  data,
  emptyLabel = "Sin datos en este período",
}: HorizontalBarListProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        {emptyLabel}
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-gray-600">{d.label}</span>
            <span className="flex-shrink-0 font-medium text-gray-900">{d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[.05]">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${d.colorClassName ?? "bg-primary"}`}
              style={{ width: `${Math.max((d.value / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
