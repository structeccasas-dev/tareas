interface DonutSegment {
  label: string
  value: number
  colorClassName: string
}

interface DonutChartProps {
  data: DonutSegment[]
  emptyLabel?: string
}

interface DonutSegmentOffset extends DonutSegment {
  pct: number
  dashoffset: number
}

// Plain helper (not a component/hook) so the running-total accumulation
// doesn't trip the React Compiler's render-purity checks.
function withOffsets(data: DonutSegment[], total: number): DonutSegmentOffset[] {
  let cumulative = 0
  return data.map((d) => {
    const pct = (d.value / total) * 100
    const dashoffset = -cumulative
    cumulative += pct
    return { ...d, pct, dashoffset }
  })
}

export function DonutChart({ data, emptyLabel = "Sin datos" }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        {emptyLabel}
      </div>
    )
  }

  const segments = withOffsets(data, total)

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 36 36" className="w-32 h-32 flex-shrink-0 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          className="text-black/[.05]"
          strokeWidth="4"
        />
        {segments.map((seg) => {
          if (seg.value === 0) return null
          return (
            <circle
              key={seg.label}
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              strokeWidth="4"
              strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
              strokeDashoffset={seg.dashoffset}
              strokeLinecap="round"
              className={`${seg.colorClassName} transition-all duration-300`}
            />
          )
        })}
      </svg>
      <ul className="flex-1 min-w-0 space-y-2">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 truncate text-gray-600">
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${d.colorClassName.replace("stroke-", "bg-")}`}
              />
              {d.label}
            </span>
            <span className="flex-shrink-0 font-medium text-gray-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
