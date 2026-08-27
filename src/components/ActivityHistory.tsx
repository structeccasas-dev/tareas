"use client"

import { useEffect, useState } from "react"
import type { ActivityEntry } from "@/types/activity"
import { formatRelativeTime } from "@/lib/format"

interface ActivityHistoryProps {
  entityId: string
  fetchAction: (entityId: string) => Promise<ActivityEntry[]>
  emptyLabel?: string
}

export function ActivityHistory({ entityId, fetchAction, emptyLabel = "Sin actividad registrada" }: ActivityHistoryProps) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAction(entityId).then((result) => {
      if (!cancelled) setEntries(result)
    })
    return () => {
      cancelled = true
    }
  }, [entityId, fetchAction])

  if (entries === null) {
    return (
      <div className="space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-black/[.06] animate-pulse" />
        <div className="h-3.5 w-1/2 rounded bg-black/[.06] animate-pulse" />
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-xs text-gray-400">{emptyLabel}</p>
  }

  return (
    <div className="max-h-48 overflow-y-auto">
      {entries.map((entry) => (
        <div key={entry.id} className="py-2 border-b border-border last:border-0">
          <p className="text-sm text-gray-900">{entry.description}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            por {entry.userName} · {formatRelativeTime(entry.createdAt)}
          </p>
        </div>
      ))}
    </div>
  )
}
