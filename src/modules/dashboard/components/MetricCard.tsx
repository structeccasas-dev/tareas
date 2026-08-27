import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/Card"

interface MetricCardProps {
  label: string
  value: string | number
  icon: LucideIcon
}

export function MetricCard({ label, value, icon: Icon }: MetricCardProps) {
  return (
    <Card hoverable className="p-5">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary-dark" strokeWidth={1.9} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900 tracking-tight">{value}</p>
    </Card>
  )
}
