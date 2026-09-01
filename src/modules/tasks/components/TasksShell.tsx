"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, BellRing } from "lucide-react";
import type {
  TaskWithRelations,
  TaskStatus,
  TaskPriority,
  RecurrenceFreq,
  TasksBoard,
  TasksStats,
  UserOption,
  TeamOption,
  ProjectOption,
} from "@/types/tasks";
import { UNASSIGNED_SENTINEL, NO_PROJECT_SENTINEL } from "@/types/tasks";
import {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  changeTasksPage,
  getTaskReminders,
  notifyTaskCreator,
} from "@/modules/tasks/actions/taskActions";
import { Dialog } from "@/components/Dialog";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { PageHeader } from "@/components/PageHeader";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/modules/tasks/lib/status";
import { KanbanBoard } from "./KanbanBoard";
import { TaskTimeline } from "./TaskTimeline";

const ALL_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  daily: "Diaria",
  weekly: "Semanal (días específicos)",
  monthly: "Mensual",
  yearly: "Anual",
};

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "En el momento" },
  { value: 10, label: "10 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 día antes" },
  { value: 4320, label: "3 días antes" },
];

// Formatea en horario local (no toISOString, que corre a UTC y desfasa la hora mostrada).
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function encodeAssignee(assignedTo: string | null, assignedTeamId: string | null): string {
  if (assignedTo) return `user:${assignedTo}`;
  if (assignedTeamId) return `team:${assignedTeamId}`;
  return "";
}

function decodeAssignee(value: string): { assignedTo: string | null; assignedTeamId: string | null } {
  if (value.startsWith("user:")) return { assignedTo: value.slice(5), assignedTeamId: null };
  if (value.startsWith("team:")) return { assignedTo: null, assignedTeamId: value.slice(5) };
  return { assignedTo: null, assignedTeamId: null };
}

interface FormState {
  title: string;
  description: string;
  category: string;
  projectId: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  startAt: string;
  dueAt: string;
  cancelReason: string;
  recurrenceEnabled: boolean;
  recurrenceFreq: RecurrenceFreq;
  recurrenceWeekdays: number[];
  recurrenceDayOfMonth: number;
  recurrenceMonth: number;
  recurrenceTime: string;
  recurrenceEndDate: string;
  reminders: number[];
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  projectId: "",
  assignee: "",
  status: "todo",
  priority: "medium",
  startAt: "",
  dueAt: "",
  cancelReason: "",
  recurrenceEnabled: false,
  recurrenceFreq: "daily",
  recurrenceWeekdays: [],
  recurrenceDayOfMonth: 1,
  recurrenceMonth: 1,
  recurrenceTime: "09:00",
  recurrenceEndDate: "",
  reminders: [],
};

interface TasksShellProps {
  board: TasksBoard;
  stats: TasksStats;
  users: UserOption[];
  teams: TeamOption[];
  projects: ProjectOption[];
  initialSearch: string;
  initialAssignedTo: string;
  initialProject: string;
  currentUserId: string;
  isFullAccess: boolean;
}

export function TasksShell({
  board,
  stats,
  users,
  teams,
  projects,
  initialSearch,
  initialAssignedTo,
  initialProject,
  currentUserId,
  isFullAccess,
}: TasksShellProps) {
  const router = useRouter();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [localBoard, setLocalBoard] = useState<TasksBoard>(board);
  const [pageByStatus, setPageByStatus] = useState<Record<TaskStatus, number>>(
    () => Object.fromEntries(ALL_STATUSES.map((s) => [s, 1])) as Record<TaskStatus, number>,
  );
  const prevFiltersRef = useRef({ search: initialSearch, assignedTo: initialAssignedTo, project: initialProject });

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [assignedFilter, setAssignedFilter] = useState(initialAssignedTo);
  const [projectFilter, setProjectFilter] = useState(initialProject);

  useEffect(() => {
    const filtersChanged =
      prevFiltersRef.current.search !== initialSearch ||
      prevFiltersRef.current.assignedTo !== initialAssignedTo ||
      prevFiltersRef.current.project !== initialProject;
    prevFiltersRef.current = { search: initialSearch, assignedTo: initialAssignedTo, project: initialProject };

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
      const filters = { search: searchInput, assignedTo: assignedFilter, project: projectFilter };
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
  const [cancelTarget, setCancelTarget] = useState<{ taskId: string; fromStatus: TaskStatus } | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [isPending, startTransition] = useTransition();
  const [loadingPage, setLoadingPage] = useState<Set<TaskStatus>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  // ── URL filters ───────────────────────────────────────────────────────────────
  function pushUrl(next: { search?: string; assignedTo?: string; project?: string }) {
    const merged = {
      search: next.search ?? searchInput,
      assignedTo: next.assignedTo ?? assignedFilter,
      project: next.project ?? projectFilter,
    };
    const params = new URLSearchParams();
    if (merged.search) params.set("search", merged.search);
    if (merged.assignedTo) params.set("assignedTo", merged.assignedTo);
    if (merged.project) params.set("project", merged.project);
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
  function handleProjectChange(val: string) {
    setProjectFilter(val);
    pushUrl({ project: val });
  }
  function handleClearFilters() {
    clearTimeout(searchTimeoutRef.current);
    setSearchInput("");
    setAssignedFilter("");
    setProjectFilter("");
    pushUrl({ search: "", assignedTo: "", project: "" });
  }

  // ── DnD ──────────────────────────────────────────────────────────────────────

  function moveCardOptimistically(taskId: string, fromStatus: TaskStatus, newStatus: TaskStatus) {
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
  }

  function handleStatusChange(taskId: string, fromStatus: TaskStatus, newStatus: TaskStatus) {
    moveCardOptimistically(taskId, fromStatus, newStatus);
    startTransition(() => updateTaskStatus(taskId, newStatus));
  }

  function handleRequestCancel(taskId: string, fromStatus: TaskStatus) {
    setCancelReasonInput("");
    setCancelTarget({ taskId, fromStatus });
  }

  function handleConfirmCancel() {
    if (!cancelTarget) return;
    const reason = cancelReasonInput.trim();
    if (!reason) return;
    moveCardOptimistically(cancelTarget.taskId, cancelTarget.fromStatus, "cancelled");
    startTransition(() => updateTaskStatus(cancelTarget.taskId, "cancelled", reason));
    setCancelTarget(null);
  }

  // ── Paginación por columna ────────────────────────────────────────────────────

  async function handleChangePage(status: TaskStatus, page: number) {
    setLoadingPage((prev) => new Set([...prev, status]));
    try {
      const result = await changeTasksPage(status, page, { search: searchInput, assignedTo: assignedFilter, project: projectFilter });
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
    setNotifyStatus("idle");
    setFormOpen(true);
  }

  function openEdit(task: TaskWithRelations) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      category: task.category ?? "",
      projectId: task.projectId ?? "",
      assignee: encodeAssignee(task.assignedTo, task.assignedTeamId),
      status: task.status,
      priority: task.priority,
      startAt: task.startAt ? toDatetimeLocalValue(task.startAt) : "",
      dueAt: task.dueAt ? toDatetimeLocalValue(task.dueAt) : "",
      cancelReason: task.cancelReason ?? "",
      recurrenceEnabled: !!task.recurrenceFreq,
      recurrenceFreq: task.recurrenceFreq ?? "daily",
      recurrenceWeekdays: task.recurrenceWeekdays ? task.recurrenceWeekdays.split(",").map(Number) : [],
      recurrenceDayOfMonth: task.recurrenceDayOfMonth ?? 1,
      recurrenceMonth: task.recurrenceMonth ?? 1,
      recurrenceTime: task.recurrenceTime ?? "09:00",
      recurrenceEndDate: task.recurrenceEndDate ? toDateInputValue(task.recurrenceEndDate) : "",
      reminders: [],
    });
    setFormError(null);
    setNotifyStatus("idle");
    setFormOpen(true);
    getTaskReminders(task.id).then((reminders) => {
      setForm((f) => ({ ...f, reminders }));
    });
  }

  function toggleWeekday(day: number) {
    setForm((f) => ({
      ...f,
      recurrenceWeekdays: f.recurrenceWeekdays.includes(day)
        ? f.recurrenceWeekdays.filter((d) => d !== day)
        : [...f.recurrenceWeekdays, day],
    }));
  }

  function toggleReminder(offset: number) {
    setForm((f) => ({
      ...f,
      reminders: f.reminders.includes(offset) ? f.reminders.filter((r) => r !== offset) : [...f.reminders, offset],
    }));
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (form.status === "cancelled" && !form.cancelReason.trim()) {
      setFormError("Para cancelar la tarea tenés que indicar un motivo.");
      return;
    }
    if (form.recurrenceEnabled && form.recurrenceFreq === "weekly" && form.recurrenceWeekdays.length === 0) {
      setFormError("Elegí al menos un día de la semana para la recurrencia.");
      return;
    }
    if (form.recurrenceEnabled && !form.dueAt) {
      setFormError("Una tarea cíclica necesita una fecha límite inicial.");
      return;
    }

    const { assignedTo, assignedTeamId } = decodeAssignee(form.assignee);

    const data = {
      title: form.title,
      description: form.description || null,
      category: form.category || null,
      projectId: form.projectId || null,
      assignedTo,
      assignedTeamId,
      status: form.status,
      priority: form.priority,
      startAt: form.startAt ? new Date(form.startAt) : null,
      dueAt: form.dueAt ? new Date(form.dueAt) : null,
      cancelReason: form.status === "cancelled" ? form.cancelReason.trim() : null,
      recurrence: form.recurrenceEnabled
        ? {
            freq: form.recurrenceFreq,
            weekdays: form.recurrenceFreq === "weekly" ? form.recurrenceWeekdays : null,
            dayOfMonth: form.recurrenceFreq === "monthly" || form.recurrenceFreq === "yearly" ? form.recurrenceDayOfMonth : null,
            month: form.recurrenceFreq === "yearly" ? form.recurrenceMonth : null,
            time: form.recurrenceTime || null,
            endDate: form.recurrenceEndDate ? new Date(form.recurrenceEndDate) : null,
          }
        : null,
      reminders: form.reminders,
    };

    startTransition(async () => {
      try {
        if (editingTask) {
          await updateTask(editingTask.id, data);
        } else {
          await createTask(data);
        }
        setFormOpen(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "No se pudo guardar la tarea.");
      }
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

  function handleNotifyCreator() {
    if (!editingTask) return;
    setNotifyStatus("sending");
    startTransition(async () => {
      await notifyTaskCreator(editingTask.id);
      setNotifyStatus("sent");
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasFilters = !!searchInput || !!assignedFilter || !!projectFilter;

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
          {isFullAccess ? (
            <>
              <option value="">Todos los asignados</option>
              <option value={UNASSIGNED_SENTINEL}>Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </>
          ) : (
            <>
              <option value="">Todas (mías y sin asignar)</option>
              <option value={currentUserId}>Asignadas a mí</option>
              <option value={UNASSIGNED_SENTINEL}>Sin asignar</option>
            </>
          )}
        </Select>

        <Select value={projectFilter} onChange={(e) => handleProjectChange(e.target.value)} className="w-auto">
          <option value="">Todos los proyectos</option>
          <option value={NO_PROJECT_SENTINEL}>Sin proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
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
          onRequestCancel={handleRequestCancel}
          onPageChange={handleChangePage}
          loadingPage={loadingPage}
          isPending={isPending}
          canDelete={isFullAccess}
        />
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editingTask ? "Editar tarea" : "Nueva tarea"} size="lg">
        {editingTask && (
          <div className="flex items-center justify-between gap-2 mb-4">
            <p className="text-xs text-gray-400">
              Creado por {editingTask.createdByUser?.name ?? "—"}
              {editingTask.assignedByUser && <> · Asignado por {editingTask.assignedByUser.name}</>}
            </p>
            {editingTask.createdByUser?.id !== currentUserId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNotifyCreator}
                disabled={notifyStatus !== "idle"}
              >
                <BellRing className="w-3.5 h-3.5" />
                {notifyStatus === "sent" ? "Aviso enviado" : "Avisar al creador"}
              </Button>
            )}
          </div>
        )}
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoría (opcional)">
              <Input
                type="text"
                placeholder="Ej. Ventas, Soporte, Administración..."
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </Field>
            <Field label="Proyecto (opcional)">
              <Select value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

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
              <Select value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                <option value="">Sin asignar</option>
                {isFullAccess ? (
                  <>
                    <optgroup label="Personas">
                      {users.map((u) => (
                        <option key={u.id} value={`user:${u.id}`}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                    {teams.length > 0 && (
                      <optgroup label="Equipos">
                        {teams.map((t) => (
                          <option key={t.id} value={`team:${t.id}`}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  <option value={`user:${currentUserId}`}>Yo mismo</option>
                )}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha de inicio (opcional)">
              <Input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
              />
            </Field>
            <Field label="Fecha límite (opcional)">
              <Input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Descripción">
            <Textarea
              rows={6}
              placeholder="Detalles adicionales..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>

          {form.status === "cancelled" && (
            <Field label="Motivo de cancelación">
              <Textarea
                rows={2}
                required
                placeholder="Explicá por qué se cancela la tarea..."
                value={form.cancelReason}
                onChange={(e) => setForm((f) => ({ ...f, cancelReason: e.target.value }))}
              />
            </Field>
          )}

          {/* Recurrencia */}
          <div className="space-y-3 pt-2 border-t border-border">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={form.recurrenceEnabled}
                onChange={(e) => setForm((f) => ({ ...f, recurrenceEnabled: e.target.checked }))}
                className="rounded"
              />
              Repetir tarea
            </label>

            {form.recurrenceEnabled && (
              <div className="space-y-3 pl-1">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Frecuencia">
                    <Select
                      value={form.recurrenceFreq}
                      onChange={(e) => setForm((f) => ({ ...f, recurrenceFreq: e.target.value as RecurrenceFreq }))}
                    >
                      {(Object.keys(RECURRENCE_LABELS) as RecurrenceFreq[]).map((freq) => (
                        <option key={freq} value={freq}>
                          {RECURRENCE_LABELS[freq]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Hora">
                    <Input
                      type="time"
                      value={form.recurrenceTime}
                      onChange={(e) => setForm((f) => ({ ...f, recurrenceTime: e.target.value }))}
                    />
                  </Field>
                </div>

                {form.recurrenceFreq === "weekly" && (
                  <Field label="Días de la semana">
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_OPTIONS.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleWeekday(d.value)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 ${
                            form.recurrenceWeekdays.includes(d.value)
                              ? "bg-primary/10 border-primary/40 text-primary-dark hover:bg-primary/15"
                              : "border-border text-gray-500 hover:bg-surface-alt"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                {(form.recurrenceFreq === "monthly" || form.recurrenceFreq === "yearly") && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Día del mes">
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={form.recurrenceDayOfMonth}
                        onChange={(e) => setForm((f) => ({ ...f, recurrenceDayOfMonth: Number(e.target.value) || 1 }))}
                      />
                    </Field>
                    {form.recurrenceFreq === "yearly" && (
                      <Field label="Mes">
                        <Select
                          value={form.recurrenceMonth}
                          onChange={(e) => setForm((f) => ({ ...f, recurrenceMonth: Number(e.target.value) }))}
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <option key={m} value={m}>
                              {new Date(2000, m - 1, 1).toLocaleDateString("es-AR", { month: "long" })}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                  </div>
                )}

                <Field label="Repetir hasta (opcional)">
                  <Input
                    type="date"
                    value={form.recurrenceEndDate}
                    onChange={(e) => setForm((f) => ({ ...f, recurrenceEndDate: e.target.value }))}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Recordatorios */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="block text-sm font-medium text-gray-700">Recordatorios antes del vencimiento</label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => toggleReminder(r.value)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 ${
                    form.reminders.includes(r.value)
                      ? "bg-primary/10 border-primary/40 text-primary-dark hover:bg-primary/15"
                      : "border-border text-gray-500 hover:bg-surface-alt"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

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
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Actividad</h3>
            <TaskTimeline taskId={editingTask.id} />
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

      {/* Cancel reason dialog (drag & drop a la columna "Cancelada") */}
      <Dialog open={cancelTarget !== null} onClose={() => setCancelTarget(null)} title="Cancelar tarea">
        <div className="space-y-4">
          <Field label="Motivo de cancelación">
            <Textarea
              rows={3}
              autoFocus
              placeholder="Explicá por qué se cancela la tarea..."
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setCancelTarget(null)} disabled={isPending}>
              Volver
            </Button>
            <Button variant="danger" isLoading={isPending} onClick={handleConfirmCancel} disabled={!cancelReasonInput.trim()}>
              Cancelar tarea
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
