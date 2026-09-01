"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import type { DashboardRangeKey } from "@/types/dashboard"

const OPTIONS: { key: DashboardRangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "Últimos 7 días" },
  { key: "30d", label: "Últimos 30 días" },
  { key: "custom", label: "Rango personalizado" },
]

interface RangeFilterProps {
  current: DashboardRangeKey
  from?: string
  to?: string
}

export function RangeFilter({ current, from, to }: RangeFilterProps) {
  const router = useRouter()
  const [customFrom, setCustomFrom] = useState(from ?? "")
  const [customTo, setCustomTo] = useState(to ?? "")
  const [showCustom, setShowCustom] = useState(current === "custom")

  function pushRange(key: DashboardRangeKey, f?: string, t?: string) {
    const params = new URLSearchParams()
    params.set("range", key)
    if (key === "custom" && f && t) {
      params.set("from", f)
      params.set("to", t)
    }
    router.replace(`/dashboard?${params.toString()}`)
  }

  function handleSelect(key: DashboardRangeKey) {
    if (key === "custom") {
      setShowCustom(true)
      if (customFrom && customTo) pushRange("custom", customFrom, customTo)
      return
    }
    setShowCustom(false)
    pushRange(key)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          onClick={() => handleSelect(opt.key)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors duration-200 ${
            current === opt.key
              ? "bg-primary/10 text-primary-dark border-primary/20 hover:bg-primary/15"
              : "bg-surface text-gray-500 border-border hover:border-border-strong"
          }`}
        >
          {opt.label}
        </button>
      ))}

      {showCustom && (
        <div className="flex items-center gap-2 pl-1">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="!w-auto"
          />
          <span className="text-xs text-gray-400">a</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="!w-auto"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => pushRange("custom", customFrom, customTo)}
            disabled={!customFrom || !customTo}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  )
}
