interface BarChartPoint {
  label: string
  value: number
}

interface BarChartProps {
  data: BarChartPoint[]
  emptyLabel?: string
}

export function BarChart({ data, emptyLabel = "Sin datos en este período" }: BarChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        {emptyLabel}
      </div>
    )
  }

  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-medium text-gray-500">{d.value}</span>
          <div className="w-full flex-1 flex items-end">
            <div
              className="w-full rounded-lg bg-primary/70 transition-all duration-300 ease-out hover:bg-primary"
              style={{ height: `${Math.max((d.value / max) * 100, 4)}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
