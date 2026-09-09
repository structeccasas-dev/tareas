"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Check,
  FileText,
  Upload,
  Link as LinkIcon,
  Trash2,
  Pencil,
  History,
  Plane,
  Plus,
} from "lucide-react";
import type {
  DocumentType,
  Personnel,
  PersonnelDocument,
  PersonnelHistoryPage,
  PersonnelLeave,
  ContractType,
  LeaveType,
} from "@/types/personnel";
import {
  createInvitation,
  deletePersonnel,
  deleteDocument,
  uploadContract,
  updatePersonnel,
  createLeave,
  updateLeave,
  deleteLeave,
  type UpdatePersonnelInput,
} from "@/modules/personnel/actions/personnelActions";
import { LEAVE_TYPE_LABELS } from "@/modules/personnel/labels";
import { PersonnelStatusBadge } from "@/modules/personnel/components/PersonnelStatusBadge";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";

interface PersonnelDetailProps {
  personnel: Personnel;
  documents: PersonnelDocument[];
  activeInvitationToken: string | null;
  history: PersonnelHistoryPage;
  leaves: PersonnelLeave[];
}

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  id_front: "Carnet (frente)",
  id_back: "Carnet (reverso)",
  contract: "Contrato firmado",
  other: "Otro documento",
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  prueba: "Período de prueba",
  fijo: "Término fijo",
  indefinido: "Indefinido",
  prestacion_servicios: "Prestación de servicios",
};

const FIELD_LABELS: Record<string, string> = {
  fullName: "Nombre completo",
  position: "Cargo",
  contractType: "Tipo de contrato",
  startDate: "Fecha de ingreso",
  probationEndDate: "Fin período de prueba",
  salary: "Salario",
  documentType: "Tipo de documento",
  documentNumber: "Número de documento",
  birthDate: "Fecha de nacimiento",
  address: "Dirección",
  phone: "Teléfono",
  personalEmail: "Email personal",
  bankName: "Banco",
  bankAccountType: "Tipo de cuenta",
  bankAccountNumber: "Número de cuenta",
  emergencyContactName: "Contacto de emergencia",
  emergencyContactPhone: "Tel. contacto de emergencia",
  emergencyContactRelationship: "Parentesco contacto de emergencia",
  leave: "Licencia",
};

function formatHistoryValue(field: string, value: string | null): string {
  if (!value) return "—";
  if (field === "contractType") return CONTRACT_TYPE_LABELS[value] ?? value;
  return value;
}

export function PersonnelDetail({
  personnel,
  documents,
  activeInvitationToken,
  history,
  leaves,
}: PersonnelDetailProps) {
  const router = useRouter();
  const contract = documents.find((d) => d.type === "contract");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [leaveDialog, setLeaveDialog] = useState<"new" | PersonnelLeave | null>(
    null,
  );
  const vacationDaysUsed = leaves
    .filter((l) => l.countsAsVacation)
    .reduce((sum, l) => sum + Number(l.daysCount), 0);

  function handleDelete() {
    startDelete(async () => {
      await deletePersonnel(personnel.id);
      router.push("/personal");
    });
  }
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={personnel.fullName}
        description={personnel.position ?? undefined}
        actions={
          <>
            <PersonnelStatusBadge status={personnel.status} />
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
            <Link href="/personal">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
            </Link>
          </>
        }
      />
      <div className="p-6 max-w-3xl mx-auto w-full space-y-6">
        <InviteSection
          personnelId={personnel.id}
          activeToken={activeInvitationToken}
        />
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Datos del puesto
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Cargo" value={personnel.position} />
            <Field
              label="Tipo de contrato"
              value={
                personnel.contractType
                  ? CONTRACT_TYPE_LABELS[personnel.contractType]
                  : null
              }
            />
            <Field label="Fecha de ingreso" value={personnel.startDate} />
            {personnel.contractType === "prueba" && (
              <Field
                label="Fin período de prueba"
                value={personnel.probationEndDate}
              />
            )}
            <Field label="Salario" value={personnel.salary} />
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Datos personales
          </h2>
          {personnel.status === "invitado" ? (
            <p className="text-sm text-gray-400">
              Todavía no completó sus datos.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field
                label="Documento"
                value={
                  [personnel.documentType, personnel.documentNumber]
                    .filter(Boolean)
                    .join(" ") || null
                }
              />
              <Field label="Fecha de nacimiento" value={personnel.birthDate} />
              <Field label="Teléfono" value={personnel.phone} />
              <Field label="Email personal" value={personnel.personalEmail} />
              <Field
                label="Dirección"
                value={personnel.address}
                className="col-span-2"
              />
              <Field label="Banco" value={personnel.bankName} />
              <Field
                label="Cuenta"
                value={
                  [personnel.bankAccountType, personnel.bankAccountNumber]
                    .filter(Boolean)
                    .join(" ") || null
                }
              />
              <Field
                label="Contacto de emergencia"
                value={personnel.emergencyContactName}
              />
              <Field
                label="Tel. contacto emergencia"
                value={
                  [
                    personnel.emergencyContactPhone,
                    personnel.emergencyContactRelationship,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                }
              />
            </dl>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Documentos
          </h2>
          <ul className="space-y-2 mb-4">
            {documents.length === 0 && (
              <p className="text-sm text-gray-400">Sin documentos todavía.</p>
            )}
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:bg-surface-alt transition-colors duration-150"
              >
                <a
                  href={`/api/personnel/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">
                      {DOCUMENT_LABELS[doc.type]}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {doc.fileName}
                    </p>
                  </div>
                </a>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="text-gray-300 hover:text-red-600 transition-colors duration-150 flex-shrink-0"
                  aria-label="Eliminar documento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <ContractUploader
            personnelId={personnel.id}
            hasContract={!!contract}
          />
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Plane className="w-4 h-4 text-gray-400" />
              Licencias y días libres
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setLeaveDialog("new")}
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar
            </Button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Días de vacaciones descontados hasta ahora:{" "}
            <span className="font-medium text-gray-900">
              {vacationDaysUsed}
            </span>
          </p>
          {leaves.length === 0 ? (
            <p className="text-sm text-gray-400">
              Todavía no hay licencias ni días libres registrados.
            </p>
          ) : (
            <ul className="space-y-2">
              {leaves.map((leave) => (
                <li
                  key={leave.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-border"
                >
                  <button
                    className="min-w-0 text-left flex-1"
                    onClick={() => setLeaveDialog(leave)}
                    aria-label="Editar licencia"
                  >
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">
                        {LEAVE_TYPE_LABELS[leave.type]}
                      </span>{" "}
                      · {leave.daysCount}{" "}
                      {Number(leave.daysCount) === 1 ? "día" : "días"}
                      {leave.countsAsVacation && (
                        <span className="ml-2 text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">
                          Descuenta vacaciones
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {leave.startDate} → {leave.endDate}
                      {leave.notes ? ` · ${leave.notes}` : ""}
                    </p>
                  </button>
                  <button
                    onClick={() => deleteLeave(leave.id)}
                    className="text-gray-300 hover:text-red-600 transition-colors duration-150 flex-shrink-0"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-gray-400" />
            Historial de cambios
          </h2>
          {history.history.length === 0 ? (
            <p className="text-sm text-gray-400">
              Todavía no hay modificaciones registradas.
            </p>
          ) : (
            <ul className="space-y-3">
              {history.history.map((entry) => (
                <li
                  key={entry.id}
                  className="text-sm border-b border-border last:border-0 pb-3 last:pb-0"
                >
                  <p className="text-gray-900">
                    <span className="font-medium">
                      {FIELD_LABELS[entry.field] ?? entry.field}
                    </span>
                    : &quot;
                    {formatHistoryValue(entry.field, entry.oldValue)}&quot; →
                    &quot;
                    {formatHistoryValue(entry.field, entry.newValue)}&quot;
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.changedByName} ·{" "}
                    {new Date(entry.changedAt).toLocaleString("es-AR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Pagination page={history.page} totalPages={history.totalPages} basePath={`/personal/${personnel.id}`} />
        </Card>
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Eliminar persona"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            ¿Estás seguro que querés eliminar a{" "}
            <span className="font-medium text-gray-900">
              &quot;{personnel.fullName}&quot;
            </span>
            ? Se van a borrar también sus datos y documentos subidos.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={handleDelete}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
      <EditPersonnelDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        personnel={personnel}
      />
      <LeaveDialog
        open={leaveDialog !== null}
        onClose={() => setLeaveDialog(null)}
        personnelId={personnel.id}
        leave={leaveDialog !== "new" ? leaveDialog : null}
      />
    </div>
  );
}

function EditPersonnelDialog({
  open,
  onClose,
  personnel,
}: {
  open: boolean;
  onClose: () => void;
  personnel: Personnel;
}) {
  const [form, setForm] = useState<UpdatePersonnelInput>(() =>
    toFormState(personnel),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(toFormState(personnel));
      setError(null);
    }
  }

  function set<K extends keyof UpdatePersonnelInput>(
    key: K,
    value: UpdatePersonnelInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updatePersonnel(personnel.id, form);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron guardar los cambios",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Editar a ${personnel.fullName}`}
      size="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-6 max-w-2xl mx-auto pb-6"
      >
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Datos del puesto
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nombre completo">
              <Input
                value={form.fullName ?? ""}
                onChange={(e) => set("fullName", e.target.value)}
                required
              />
            </FormField>
            <FormField label="Cargo">
              <Input
                value={form.position ?? ""}
                onChange={(e) => set("position", e.target.value)}
              />
            </FormField>
            <FormField label="Tipo de contrato">
              <Select
                value={form.contractType ?? ""}
                onChange={(e) =>
                  set("contractType", e.target.value as ContractType)
                }
              >
                <option value="prueba">Período de prueba</option>
                <option value="fijo">Término fijo</option>
                <option value="indefinido">Indefinido</option>
                <option value="prestacion_servicios">
                  Prestación de servicios
                </option>
              </Select>
            </FormField>
            <FormField label="Fecha de ingreso">
              <Input
                type="date"
                value={form.startDate ?? ""}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </FormField>
            {form.contractType === "prueba" && (
              <FormField label="Fin período de prueba">
                <Input
                  type="date"
                  value={form.probationEndDate ?? ""}
                  onChange={(e) => set("probationEndDate", e.target.value)}
                />
              </FormField>
            )}
            <FormField label="Salario">
              <Input
                value={form.salary ?? ""}
                onChange={(e) => set("salary", e.target.value)}
              />
            </FormField>
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Datos personales
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo de documento">
              <Input
                value={form.documentType ?? ""}
                onChange={(e) => set("documentType", e.target.value)}
              />
            </FormField>
            <FormField label="Número de documento">
              <Input
                value={form.documentNumber ?? ""}
                onChange={(e) => set("documentNumber", e.target.value)}
              />
            </FormField>
            <FormField label="Fecha de nacimiento">
              <Input
                type="date"
                value={form.birthDate ?? ""}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </FormField>
            <FormField label="Teléfono">
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </FormField>
            <FormField label="Email personal">
              <Input
                type="email"
                value={form.personalEmail ?? ""}
                onChange={(e) => set("personalEmail", e.target.value)}
              />
            </FormField>
            <FormField label="Dirección" className="col-span-2">
              <Input
                value={form.address ?? ""}
                onChange={(e) => set("address", e.target.value)}
              />
            </FormField>
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Datos bancarios
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Banco">
              <Input
                value={form.bankName ?? ""}
                onChange={(e) => set("bankName", e.target.value)}
              />
            </FormField>
            <FormField label="Tipo de cuenta">
              <Input
                value={form.bankAccountType ?? ""}
                onChange={(e) => set("bankAccountType", e.target.value)}
              />
            </FormField>
            <FormField label="Número de cuenta" className="col-span-2">
              <Input
                value={form.bankAccountNumber ?? ""}
                onChange={(e) => set("bankAccountNumber", e.target.value)}
              />
            </FormField>
          </div>
        </section>
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Contacto de emergencia
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nombre">
              <Input
                value={form.emergencyContactName ?? ""}
                onChange={(e) => set("emergencyContactName", e.target.value)}
              />
            </FormField>
            <FormField label="Teléfono">
              <Input
                value={form.emergencyContactPhone ?? ""}
                onChange={(e) => set("emergencyContactPhone", e.target.value)}
              />
            </FormField>
            <FormField label="Parentesco" className="col-span-2">
              <Input
                value={form.emergencyContactRelationship ?? ""}
                onChange={(e) =>
                  set("emergencyContactRelationship", e.target.value)
                }
              />
            </FormField>
          </div>
        </section>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-surface/90 backdrop-blur-md">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function toFormState(personnel: Personnel): UpdatePersonnelInput {
  return {
    fullName: personnel.fullName,
    position: personnel.position,
    contractType: personnel.contractType,
    startDate: personnel.startDate,
    probationEndDate: personnel.probationEndDate,
    salary: personnel.salary,
    documentType: personnel.documentType,
    documentNumber: personnel.documentNumber,
    birthDate: personnel.birthDate,
    address: personnel.address,
    phone: personnel.phone,
    personalEmail: personnel.personalEmail,
    bankName: personnel.bankName,
    bankAccountType: personnel.bankAccountType,
    bankAccountNumber: personnel.bankAccountNumber,
    emergencyContactName: personnel.emergencyContactName,
    emergencyContactPhone: personnel.emergencyContactPhone,
    emergencyContactRelationship: personnel.emergencyContactRelationship,
  };
}

const EMPTY_LEAVE_FORM = {
  type: "vacaciones" as LeaveType,
  startDate: "",
  endDate: "",
  daysCount: "",
  countsAsVacation: true,
  notes: "",
};

function leaveToFormState(leave: PersonnelLeave) {
  return {
    type: leave.type,
    startDate: leave.startDate,
    endDate: leave.endDate,
    daysCount: leave.daysCount,
    countsAsVacation: leave.countsAsVacation,
    notes: leave.notes ?? "",
  };
}

function LeaveDialog({
  open,
  onClose,
  personnelId,
  leave,
}: {
  open: boolean;
  onClose: () => void;
  personnelId: string;
  leave: PersonnelLeave | null;
}) {
  const [form, setForm] = useState(() =>
    leave ? leaveToFormState(leave) : EMPTY_LEAVE_FORM,
  );
  const [prevOpen, setPrevOpen] = useState(open);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(leave ? leaveToFormState(leave) : EMPTY_LEAVE_FORM);
      setError(null);
    }
  }

  function handleTypeChange(type: LeaveType) {
    setForm((f) => ({ ...f, type, countsAsVacation: type === "vacaciones" }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (leave) {
          await updateLeave(leave.id, form);
        } else {
          await createLeave(personnelId, form);
        }
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        leave ? "Editar licencia o día libre" : "Registrar licencia o día libre"
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Tipo">
          <Select
            value={form.type}
            onChange={(e) => handleTypeChange(e.target.value as LeaveType)}
          >
            {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Desde">
            <Input
              type="date"
              required
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Hasta">
            <Input
              type="date"
              required
              value={form.endDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, endDate: e.target.value }))
              }
            />
          </FormField>
        </div>

        <FormField label="Cantidad de días">
          <Input
            type="number"
            min="0.5"
            step="0.5"
            required
            value={form.daysCount}
            onChange={(e) =>
              setForm((f) => ({ ...f, daysCount: e.target.value }))
            }
          />
        </FormField>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.countsAsVacation}
            onChange={(e) =>
              setForm((f) => ({ ...f, countsAsVacation: e.target.checked }))
            }
            className="rounded border-border"
          />
          Se descuenta del saldo de vacaciones
        </label>

        <FormField label="Notas (opcional)">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            {leave ? "Guardar cambios" : "Registrar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-gray-900 mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function FormField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function InviteSection({
  personnelId,
  activeToken,
}: {
  personnelId: string;
  activeToken: string | null;
}) {
  const [token, setToken] = useState(activeToken);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/onboarding/${token}`
      : null;

  function handleGenerate() {
    startTransition(async () => {
      const result = await createInvitation(personnelId);
      setToken(result.token);
      setCopied(false);
    });
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-gray-400" />
          Enlace de onboarding
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleGenerate}
          isLoading={isPending}
        >
          {token ? "Regenerar" : "Generar enlace"}
        </Button>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Compartí este enlace con la persona para que suba sus datos y las fotos
        del carnet. Vence a los 7 días.
      </p>
      {url && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            className="flex-1 min-w-0 px-3 py-2 text-xs text-gray-600 bg-surface-alt/60 border border-border rounded-xl truncate"
          />
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
    </Card>
  );
}

// Debe quedar por debajo de experimental.serverActions.bodySizeLimit
// (next.config.ts): si se sube un archivo más grande, Next.js no lo
// rechaza con un error claro sino que corta la request y tira "Unexpected
// end of form".
const MAX_CONTRACT_SIZE_BYTES = 20 * 1024 * 1024;

function ContractUploader({
  personnelId,
  hasContract,
}: {
  personnelId: string;
  hasContract: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Seleccioná el PDF del contrato");
      return;
    }
    if (file.size > MAX_CONTRACT_SIZE_BYTES) {
      setError(
        "El archivo es demasiado grande (máx. 20MB). Probá comprimir el PDF o escanearlo en menor calidad.",
      );
      return;
    }
    const formData = new FormData();
    formData.set("contract", file);
    startTransition(async () => {
      try {
        await uploadContract(personnelId, formData);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo subir el contrato",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 pt-3 border-t border-border"
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="flex-1 min-w-0 text-xs text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-surface-alt file:text-gray-700 file:text-xs"
      />
      <Button type="submit" size="sm" variant="secondary" isLoading={isPending}>
        <Upload className="w-3.5 h-3.5" />
        {hasContract ? "Reemplazar contrato" : "Subir contrato"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
