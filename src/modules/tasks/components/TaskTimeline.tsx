"use client"

import { useEffect, useState, useTransition } from "react"
import { Send } from "lucide-react"
import type { TimelineEntry } from "@/types/tasks"
import { getTaskTimeline, addTaskComment } from "@/modules/tasks/actions/taskActions"
import { Avatar } from "@/components/Avatar"
import { formatRelativeTime } from "@/lib/format"

interface TaskTimelineProps {
  taskId: string
}

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null)
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getTaskTimeline(taskId).then((result) => {
      if (!cancelled) setEntries(result)
    })
    return () => {
      cancelled = true
    }
  }, [taskId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    startTransition(async () => {
      await addTaskComment(taskId, body)
      setDraft("")
      const result = await getTaskTimeline(taskId)
      setEntries(result)
    })
  }

  return (
    <div className="space-y-3">
      {entries === null ? (
        <div className="space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-black/[.06] animate-pulse" />
          <div className="h-3.5 w-1/2 rounded bg-black/[.06] animate-pulse" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400">Sin actividad todavía.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
          {entries.map((entry) =>
            entry.type === "comment" ? (
              <div key={entry.id} className="flex items-start gap-2">
                <Avatar name={entry.userName} size="sm" />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-surface-alt px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-gray-900">{entry.userName}</span>
                    <span className="text-[11px] text-gray-400">{formatRelativeTime(entry.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{entry.description}</p>
                </div>
              </div>
            ) : (
              <p key={entry.id} className="text-xs text-gray-400 pl-1">
                {entry.userName} — {entry.description}
                <span className="text-gray-300"> · {formatRelativeTime(entry.createdAt)}</span>
              </p>
            ),
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribir comentario..."
          rows={2}
          className="flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="flex items-center justify-center w-9 h-9 flex-shrink-0 rounded-xl bg-primary text-white shadow-elevation-xs hover:bg-primary-hover transition-colors duration-150 disabled:opacity-50"
          title="Comentar"
        >
          <Send className="w-4 h-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  )
}
