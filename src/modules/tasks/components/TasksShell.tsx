"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type {
  TaskWithRelations,
  TaskStatus,
  TaskPriority,
  TasksBoard,
  TasksStats,
  UserOption,
} from "@/types/tasks";
import { UNASSIGNED_SENTINEL } from "@/types/tasks";
import {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  changeTasksPage,
  getTaskActivity,
} from "@/modules/tasks/actions/taskActions";
import { Dialog } from "@/components/Dialog";
import { ActivityHistory } from "@/components/ActivityHistory";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { PageHeader } from "@/components/PageHeader";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/modules/tasks/lib/status";
import { KanbanBoard } from "./KanbanBoard";

const ALL_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

// Formatea en horario local (no toISOString, que corre a UTC y desfasa la hora mostrada).
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface FormState {
  title: string;
  description: string;
  assignedTo: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  assignedTo: "",
  status: "todo",
  priority: "medium",
  dueAt: "",
};

interface TasksShellProps {
  board: TasksBoard;
  stats: TasksStats;
  users: UserOption[];
  initialSearch: string;
  initialAssignedTo: string;
}

export function TasksShell({ board, stats, users, initialSearch, initialAssignedTo }: TasksShellProps) {
  const router = useRouter();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [localBoard, setLocalBoard] = useState<TasksBoard>(board);
  const [pageByStatus, setPageByStatus] = useState<Record<TaskStatus, number>>(
    () => Object.fromEntries(ALL_STATUSES.map((s) => [s, 1])) as Record<TaskStatus, number>,
  );
  const prevFiltersRef = useRef({ search: initialSearch, assignedTo: initialAssignedTo });

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [assignedFilter, setAssignedFilter] = useState(initialAssignedTo);

  useEffect(() => {
    const filtersChanged =
      prevFiltersRef.current.search !== initialSearch || prevFiltersRef.current.assignedTo !== initialAssignedTo;
    prevFiltersRef.current = { search: initialSearch, assignedTo: initialAssignedTo };

    if (filtersChanged) {
      setPageByStatus(Object.fromEntries(ALL_STATUSES.map((s) => [s, 1])) as Record<TaskStatus, number>);
      setLocalBoard(board);
      return;
    }

    // El tablero se refrescó por otra razón (una mutación) — si el usuario había
    // navegado más allá de la página 1 en alguna columna, se vuelve a pedir esa
    // misma página en vez de aceptar la página 1 que trae el prop, para no
    // hacerlo volver al principio sin que lo haya pedido.
    const staleStatuses = ALL_STATUSES.filter((s) => pageByStatus[s] > 1);
    if (staleStatuses.length === 0) {
      setLocalBoard(board);
      return;
    }

    let cancelled = false;
    (async () => {
      const filters = { search: searchInput, assignedTo: assignedFilter };
      const refetched = await Promise.all(staleStatuses.map((s) => changeTasksPage(s, pageByStatus[s], filters)));
      if (cancelled) return;
      setLocalBoard(() => {
        const next = { ...board };
        staleStatuses.forEach((s, i) => {
          next[s] = refetched[i];
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<TaskWithRelations | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingPage, setLoadingPage] = useState<Set<TaskStatus>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  // ── URL filters ───────────────────────────────────────────────────────────────
  function pushUrl(next: { search?: string; assignedTo?: string }) {
    const merged = { search: next.search ?? searchInput, assignedTo: next.assignedTo ?? assignedFilter };
    const params = new URLSearchParams();
    if (merged.search) params.set("search", merged.search);
    if (merged.assignedTo) params.set("assignedTo", merged.assignedTo);
    const qs = params.toString();
    router.replace(`/tareas${qs ? `?${qs}` : ""}`);
  }
  function handleSearchChange(val: string) {
    setSearchInput(val);
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => pushUrl({ search: val }), 350);
  }
  function handleAssignedChange(val: string) {
    setAssignedFilter(val);
    pushUrl({ assignedTo: val });
  }
  function handleClearFilters() {
    clearTimeout(searchTimeoutRef.current);
    setSearchInput("");
    setAssignedFilter("");
    pushUrl({ search: "", assignedTo: "" });
  }

  // ── DnD ──────────────────────────────────────────────────────────────────────

  function handleStatusChange(taskId: string, fromStatus: TaskStatus, newStatus: TaskStatus) {
    setLocalBoard((prev) => {
      const task = prev[fromStatus].tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const moved = { ...task, status: newStatus, updatedAt: new Date() };
      const isDestinationOnFirstPage = pageByStatus[newStatus] === 1;
      return {
        ...prev,
        [fromStatus]: { ...prev[fromStatus], tasks: prev[fromStatus].tasks.filter((t) => t.id !== taskId) },
        [newStatus]: isDestinationOnFirstPage
          ? { ...prev[newStatus], tasks: [moved, ...prev[newStatus].tasks] }
          : prev[newStatus],
      };
    });
    startTransition(() => updateTaskStatus(taskId, newStatus));
  }

  // ── Paginación por columna ────────────────────────────────────────────────────

  async function handleChangePage(status: TaskStatus, page: number) {
    setLoadingPage((prev) => new Set([...prev, status]));
    try {
      const result = await changeTasksPage(status, page, { search: searchInput, assignedTo: assignedFilter });
      setLocalBoard((prev) => ({ ...prev, [status]: result }));
      setPageByStatus((prev) => ({ ...prev, [status]: result.page }));
    } finally {
      setLoadingPage((prev) => {
        const next = new Set(prev);
        next.delete(status);
        return next;
      });
    }
  }

  // ── Form ──────────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(task: TaskWithRelations) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      assignedTo: task.assignedTo ?? "",
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt ? toDatetimeLocalValue(task.dueAt) : "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const data = {
      title: form.title,
      description: form.description || null,
      assignedTo: form.assignedTo || null,
      status: form.status,
      priority: form.priority,
      dueAt: form.dueAt ? new Date(form.dueAt) : null,
    };
    startTransition(async () => {
      if (editingTask) {
        await updateTask(editingTask.id, data);
      } else {
        await createTask(data);
      }
      setFormOpen(false);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startTransition(async () => {
      try {
        await deleteTask(deleteTarget.id);
        setDeleteTarget(null);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar la tarea.");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasFilters = !!searchInput || !!assignedFilter;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Tareas"
        description={`${stats.totalTasks} ${stats.totalTasks === 1 ? "tarea" : "tareas"}`}
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nueva tarea
          </Button>
        }
      />

      {/* Buscador */}
      <div className="px-6 pt-4">
        <Input
          type="text"
          icon={<Search />}
          placeholder="Buscar por título..."
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="text-sm py-2.5 max-w-xl"
        />
      </div>

      {/* Filtros */}
      <div className="px-6 pt-3 flex flex-wrap items-center gap-2">
        <Select value={assignedFilter} onChange={(e) => handleAssignedChange(e.target.value)} className="w-auto">
          <option value="">Todos los asignados</option>
          <option value={UNASSIGNED_SENTINEL}>Sin asignar</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Limpiar
          </Button>
        )}
      </div>

      {/* Kanban */}
      <div className="px-6 py-4 overflow-x-auto flex-1">
        <KanbanBoard
          board={localBoard}
          totalTasks={stats.totalTasks}
          countsByStatus={stats.countsByStatus}
          onEdit={openEdit}
          onDelete={(task) => {
            setDeleteError(null);
            setDeleteTarget(task);
          }}
          onStatusChange={handleStatusChange}
          onPageChange={handleChangePage}
          loadingPage={loadingPage}
          isPending={isPending}
        />
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editingTask ? "Editar tarea" : "Nueva tarea"} size="lg">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Field label="Título">
            <Input
              type="text"
              required
              placeholder="Ej. Preparar reporte mensual"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Estado">
              <Select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridad">
              <Select
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              >
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Asignado a">
              <Select value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Vencimiento (opcional)">
            <Input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
            />
          </Field>

          <Field label="Descripción">
            <Textarea
              rows={8}
              placeholder="Detalles adicionales..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>

          {formError && (
            <p className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-3.5 py-2.5">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              {editingTask ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </div>
        </form>
        {editingTask && (
          <div className="mt-5 pt-4 border-t border-border">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Historial de actividad</h3>
            <ActivityHistory entityId={editingTask.id} fetchAction={getTaskActivity} />
          </div>
        )}
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar tarea">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro que querés eliminar la tarea <span className="font-medium text-gray-900">&quot;{deleteTarget?.title}&quot;</span>?
            Esta acción no se puede deshacer.
          </p>
          {deleteError && (
            <p className="text-sm text-error bg-error/8 border border-error/15 rounded-xl px-3.5 py-2.5">{deleteError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="danger" isLoading={isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
