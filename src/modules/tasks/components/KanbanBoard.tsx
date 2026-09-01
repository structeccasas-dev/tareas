"use client"

import { useEffect, useRef, useState } from "react"
import { User, Clock, Loader2, ChevronLeft, ChevronRight, Maximize2, X, CalendarClock } from "lucide-react"
import type { TaskWithRelations, TaskStatus, TasksBoard } from "@/types/tasks"
import { Button } from "@/components/Button"
import { Avatar } from "@/components/Avatar"
import { STATUS_LABELS, PRIORITY_LABELS, PRIORITY_DOT, getDueTone, isClosedStatus } from "@/modules/tasks/lib/status"
import { formatRelativeTime } from "@/lib/format"

const DUE_TONE_CLASS: Record<"overdue" | "today" | "upcoming", string> = {
  overdue: "text-red-500",
  today: "text-amber-600",
  upcoming: "text-gray-400",
}

function formatDueDate(date: Date): string {
  // Node y los navegadores usan distintos caracteres de espacio invisibles antes de
  // "a. m."/"p. m." (U+00A0 vs U+202F) para el mismo texto — normalizamos a un
  // espacio común para que el SSR y el cliente rindan exactamente lo mismo y no
  // dispare un mismatch de hidratación en React.
  return date
    .toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .replace(/[  ]/g, " ")
}

const COLUMNS: {
  status: TaskStatus
  headerColor: string
  headerBg: string
  dropBg: string
  dotColor: string
  borderColor: string
}[] = [
  {
    status: "todo",
    headerColor: "text-gray-700",
    headerBg: "bg-gray-100",
    dropBg: "bg-gray-100",
    dotColor: "bg-gray-400",
    borderColor: "border-gray-300",
  },
  {
    status: "in_progress",
    headerColor: "text-blue-700",
    headerBg: "bg-blue-50",
    dropBg: "bg-blue-50",
    dotColor: "bg-blue-400",
    borderColor: "border-blue-300",
  },
  {
    status: "done",
    headerColor: "text-primary-dark",
    headerBg: "bg-primary/10",
    dropBg: "bg-primary/10",
    dotColor: "bg-primary",
    borderColor: "border-primary/50",
  },
  {
    status: "cancelled",
    headerColor: "text-red-600",
    headerBg: "bg-red-50",
    dropBg: "bg-red-50",
    dotColor: "bg-red-400",
    borderColor: "border-red-300",
  },
]

interface KanbanBoardProps {
  board: TasksBoard
  totalTasks: number
  countsByStatus: Record<TaskStatus, number>
  onEdit: (task: TaskWithRelations) => void
  onDelete: (task: TaskWithRelations) => void
  onStatusChange: (taskId: string, fromStatus: TaskStatus, newStatus: TaskStatus) => void
  onRequestCancel: (taskId: string, fromStatus: TaskStatus) => void
  onPageChange: (status: TaskStatus, page: number) => void
  loadingPage: Set<TaskStatus>
  isPending: boolean
  canDelete: boolean
}

export function KanbanBoard({
  board,
  totalTasks,
  countsByStatus,
  onEdit,
  onDelete,
  onStatusChange,
  onRequestCancel,
  onPageChange,
  loadingPage,
  isPending,
  canDelete,
}: KanbanBoardProps) {
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [maximizedStatus, setMaximizedStatus] = useState<TaskStatus | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (!maximizedStatus) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMaximizedStatus(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [maximizedStatus])

  const maximizedCol = maximizedStatus ? COLUMNS.find((c) => c.status === maximizedStatus) : undefined
  const maximizedColumn = maximizedStatus ? board[maximizedStatus] : undefined

  function handleDragStart(e: React.DragEvent, task: TaskWithRelations) {
    e.dataTransfer.setData("taskId", task.id)
    e.dataTransfer.setData("fromStatus", task.status)
    e.dataTransfer.effectAllowed = "move"
    setDraggingId(task.id)
  }

  function handleDragEnd() {
    setDraggingId(null)
    setDragOverStatus(null)
    clearTimeout(leaveTimerRef.current)
  }

  function handleDragOver(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    clearTimeout(leaveTimerRef.current)
    setDragOverStatus(status)
  }

  function handleDragLeave() {
    leaveTimerRef.current = setTimeout(() => setDragOverStatus(null), 60)
  }

  function handleDrop(e: React.DragEvent, toStatus: TaskStatus) {
    e.preventDefault()
    clearTimeout(leaveTimerRef.current)
    const taskId = e.dataTransfer.getData("taskId")
    const fromStatus = e.dataTransfer.getData("fromStatus") as TaskStatus
    setDragOverStatus(null)
    setDraggingId(null)
    if (taskId && fromStatus !== toStatus) {
      if (toStatus === "cancelled") {
        onRequestCancel(taskId, fromStatus)
      } else {
        onStatusChange(taskId, fromStatus, toStatus)
      }
    }
  }

  return (
    <>
      <div className="flex gap-3 min-w-max">
        {COLUMNS.map((col) => {
          const column = board[col.status]
          const isOver = dragOverStatus === col.status
          const isLoadingPage = loadingPage.has(col.status)
          const realCount = countsByStatus[col.status] ?? 0
          const pct = totalTasks > 0 ? Math.round((realCount / totalTasks) * 100) : 0

          return (
            <div
              key={col.status}
              className={`flex flex-col w-72 rounded-xl border-2 transition-all duration-200 ease-out ${
                isOver ? `${col.borderColor} shadow-elevation-md` : "border-border"
              }`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-[10px] ${col.headerBg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dotColor}`} />
                  <span className={`text-sm font-semibold truncate ${col.headerColor}`}>{STATUS_LABELS[col.status]}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white/80 ${col.headerColor}`}>
                    {realCount}
                  </span>
                  {totalTasks > 0 && <span className="text-[10px] text-gray-400">{pct}%</span>}
                  <button
                    type="button"
                    onClick={() => setMaximizedStatus(col.status)}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
                    title={`Ver ${STATUS_LABELS[col.status]} en pantalla completa`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div
                className={`flex-1 p-2 space-y-2 min-h-28 transition-colors duration-150 ${
                  column.totalPages <= 1 ? "rounded-b-[10px]" : ""
                } ${isOver ? col.dropBg : "bg-black/[.015]"}`}
              >
                {column.tasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isDragging={draggingId === task.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    disabled={isPending}
                    canDelete={canDelete}
                  />
                ))}

                {column.tasks.length === 0 && (
                  <div
                    className={`flex items-center justify-center h-16 rounded-xl border-2 border-dashed text-xs transition-colors duration-150 ${
                      isOver ? "border-primary/40 text-primary/70" : "border-border text-gray-300"
                    }`}
                  >
                    {isOver ? "Soltar aquí" : "Sin tareas"}
                  </div>
                )}
              </div>

              {column.totalPages > 1 && (
                <ColumnPager
                  status={col.status}
                  page={column.page}
                  totalPages={column.totalPages}
                  loading={isLoadingPage}
                  onPageChange={onPageChange}
                />
              )}
            </div>
          )
        })}
      </div>

      {maximizedStatus && maximizedCol && maximizedColumn && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${STATUS_LABELS[maximizedStatus]} en pantalla completa`}
          className="fixed inset-0 z-50 flex flex-col bg-surface"
        >
          <div className={`flex items-center justify-between gap-2 px-4 sm:px-6 py-3 flex-shrink-0 ${maximizedCol.headerBg}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${maximizedCol.dotColor}`} />
              <span className={`text-base font-semibold truncate ${maximizedCol.headerColor}`}>
                {STATUS_LABELS[maximizedStatus]}
              </span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full bg-white/80 flex-shrink-0 ${maximizedCol.headerColor}`}>
                {countsByStatus[maximizedStatus] ?? 0}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMaximizedStatus(null)}
              className="flex items-center justify-center w-8 h-8 flex-shrink-0 text-gray-500 hover:text-gray-800 hover:bg-black/[.06] rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              title="Cerrar"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
            {maximizedColumn.tasks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {maximizedColumn.tasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    isDragging={false}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    disabled={isPending}
                    canDelete={canDelete}
                    draggable={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed border-border text-sm text-gray-300">
                Sin tareas
              </div>
            )}
          </div>

          {maximizedColumn.totalPages > 1 && (
            <div className="flex-shrink-0 border-t border-border px-4 sm:px-6 py-2">
              <ColumnPager
                status={maximizedStatus}
                page={maximizedColumn.page}
                totalPages={maximizedColumn.totalPages}
                loading={loadingPage.has(maximizedStatus)}
                onPageChange={onPageChange}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Pager ─────────────────────────────────────────────────────────────────────

interface ColumnPagerProps {
  status: TaskStatus
  page: number
  totalPages: number
  loading: boolean
  onPageChange: (status: TaskStatus, page: number) => void
}

function ColumnPager({ status, page, totalPages, loading, onPageChange }: ColumnPagerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function commit() {
    const raw = Number(inputRef.current?.value)
    const parsed = Math.min(totalPages, Math.max(1, Math.round(raw) || page))
    if (parsed !== page) onPageChange(status, parsed)
    else if (inputRef.current) inputRef.current.value = String(page)
  }

  return (
    <div className="flex items-center justify-center gap-2 px-2 py-1.5 border-t border-border rounded-b-[10px] bg-surface">
      <button
        type="button"
        onClick={() => onPageChange(status, page - 1)}
        disabled={loading || page <= 1}
        title="Página anterior"
        className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-700 hover:bg-black/[.045] rounded-lg transition-colors duration-150 disabled:opacity-30"
      >
        <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
      </button>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
        className="flex items-center gap-1"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
        ) : (
          <input
            key={page}
            ref={inputRef}
            type="number"
            min={1}
            max={totalPages}
            defaultValue={page}
            onBlur={commit}
            className="w-9 text-center text-xs rounded-md border border-border py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        )}
        <span className="text-[11px] text-gray-400 whitespace-nowrap">/ {totalPages}</span>
      </form>

      <button
        type="button"
        onClick={() => onPageChange(status, page + 1)}
        disabled={loading || page >= totalPages}
        title="Página siguiente"
        className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-700 hover:bg-black/[.045] rounded-lg transition-colors duration-150 disabled:opacity-30"
      >
        <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  task: TaskWithRelations
  isDragging: boolean
  onDragStart: (e: React.DragEvent, task: TaskWithRelations) => void
  onDragEnd: () => void
  onEdit: (task: TaskWithRelations) => void
  onDelete: (task: TaskWithRelations) => void
  disabled: boolean
  canDelete: boolean
  draggable?: boolean
}

function KanbanCard({ task, isDragging, onDragStart, onDragEnd, onEdit, onDelete, disabled, canDelete, draggable = true }: KanbanCardProps) {
  const isDone = isClosedStatus(task.status)

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart(e, task) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={() => onEdit(task)}
      className={`group bg-surface rounded-xl border border-border p-3 select-none transition-all duration-150 ease-out ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragging
          ? "opacity-30 scale-[0.97] -rotate-1 shadow-elevation-sm ring-2 ring-primary/20"
          : "opacity-100 shadow-elevation-xs hover:shadow-elevation-sm hover:-translate-y-px"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className={`font-medium text-sm text-gray-900 leading-snug ${isDone ? "line-through text-gray-400" : ""}`}>{task.title}</p>
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${PRIORITY_DOT[task.priority]}`}
          title={`Prioridad ${PRIORITY_LABELS[task.priority]}`}
        />
      </div>

      {task.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{task.description}</p>}

      <div className="mt-2.5 pt-2 border-t border-border space-y-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={2} />
          {task.assignedUser ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <Avatar name={task.assignedUser.name} size="sm" />
              <span className="text-xs text-gray-500 truncate">{task.assignedUser.name}</span>
            </span>
          ) : task.assignedTeam ? (
            <span className="text-xs text-gray-500 truncate">Equipo {task.assignedTeam.name}</span>
          ) : (
            <span className="text-xs text-gray-300 italic">Sin asignar</span>
          )}
        </div>
        {task.dueAt && !isDone ? (
          <div className={`flex items-center gap-1.5 min-w-0 ${DUE_TONE_CLASS[getDueTone(task.dueAt)]}`}>
            <CalendarClock className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
            <span className="text-xs truncate">{formatDueDate(task.dueAt)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" strokeWidth={2} />
            {/* El texto depende de Date.now(): puede diferir entre SSR e hidratación. */}
            <span className="text-xs text-gray-400" suppressHydrationWarning>
              {formatRelativeTime(task.updatedAt)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Button
          draggable={false}
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(task)
          }}
          disabled={disabled}
          className="flex-1"
        >
          Editar
        </Button>
        {canDelete && (
        <button
          draggable={false}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(task)
          }}
          disabled={disabled}
          className="flex-1 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors duration-200 disabled:opacity-40"
        >
          Eliminar
        </button>
        )}
      </div>
    </div>
  )
}
