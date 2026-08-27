"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, UserPlus, Clock, AlertTriangle } from "lucide-react"
import type { NotificationItem, NotificationType } from "@/types/notifications"
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from "@/modules/notifications/actions/notificationActions"
import { formatRelativeTime } from "@/lib/format"

const ICONS: Record<NotificationType, typeof Bell> = {
  task_assigned: UserPlus,
  task_due_soon: Clock,
  task_overdue: AlertTriangle,
}

const noopSubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

interface NotificationsBellProps {
  initialUnreadCount: number
}

export function NotificationsBell({ initialUnreadCount }: NotificationsBellProps) {
  const router = useRouter()
  const isClient = useIsClient()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [isPending, startTransition] = useTransition()

  // El layout server-side revalida initialUnreadCount en cada navegación —
  // si cambió, es la fuente de verdad más reciente y reemplaza al estado local.
  const [prevInitialUnreadCount, setPrevInitialUnreadCount] = useState(initialUnreadCount)
  if (initialUnreadCount !== prevInitialUnreadCount) {
    setPrevInitialUnreadCount(initialUnreadCount)
    setUnreadCount(initialUnreadCount)
  }

  function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && items === null) {
      startTransition(async () => {
        const result = await fetchNotifications()
        setItems(result)
      })
    }
  }

  function handleSelect(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? null)
      setUnreadCount((c) => Math.max(0, c - 1))
      startTransition(() => markNotificationRead(item.id))
    }
    setOpen(false)
    router.push("/tareas")
  }

  function handleMarkAllRead() {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null)
    setUnreadCount(0)
    startTransition(() => markAllNotificationsRead())
  }

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:bg-black/[.045] transition-colors duration-150"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4" strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isClient &&
        open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <div className="fixed top-16 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface/95 shadow-elevation-lg backdrop-blur-xl">
              <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-surface/90">
                <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={isPending}
                    className="flex items-center gap-1 text-xs font-medium text-primary-dark hover:underline disabled:opacity-50"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marcar todas
                  </button>
                )}
              </div>

              {items === null ? (
                <div className="p-4 space-y-2">
                  <div className="h-10 rounded-xl bg-black/[.04] animate-pulse" />
                  <div className="h-10 rounded-xl bg-black/[.04] animate-pulse" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No tenés notificaciones.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => {
                    const Icon = ICONS[item.type]
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={`w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-alt ${
                            !item.read ? "bg-primary/[.04]" : ""
                          }`}
                        >
                          <span className="w-7 h-7 rounded-full bg-black/[.04] flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon className="w-3.5 h-3.5 text-gray-500" strokeWidth={1.9} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm ${!item.read ? "font-medium text-gray-900" : "text-gray-700"}`}>
                              {item.title}
                            </span>
                            {item.body && <span className="block text-xs text-gray-400 truncate">{item.body}</span>}
                            <span className="block text-[11px] text-gray-300 mt-0.5">{formatRelativeTime(item.createdAt)}</span>
                          </span>
                          {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
