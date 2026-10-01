import { db } from "@/db"
import { cobEvents } from "@/db/schema/collectionsEvent"
import type { FinancialEventEntityType } from "@/types/collections"

// Tipo del `tx` que recibe el callback de `db.transaction(...)`, inferido
// directamente de la firma real en vez de fijar los genéricos a mano (evita
// que un cambio de versión de drizzle-orm rompa este tipo).
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Db = typeof db | Tx

interface LogEventParams {
  operationId?: string | null
  entityType: FinancialEventEntityType
  entityId: string
  eventType: string
  description: string
  amountDelta?: number | null
  balanceBefore?: number | null
  balanceAfter?: number | null
  metadata?: Record<string, unknown> | null
  performedBy?: string | null
}

// Ledger de auditoría del módulo — ver docs/cobranzas/DISENO.md §F. Se llama
// dentro de la misma transacción que la mutación que registra.
export async function logCollectionsEvent(tx: Db, params: LogEventParams): Promise<void> {
  await tx.insert(cobEvents).values({
    operationId: params.operationId ?? null,
    entityType: params.entityType,
    entityId: params.entityId,
    eventType: params.eventType,
    description: params.description,
    amountDelta: params.amountDelta != null ? String(params.amountDelta) : null,
    balanceBefore: params.balanceBefore != null ? String(params.balanceBefore) : null,
    balanceAfter: params.balanceAfter != null ? String(params.balanceAfter) : null,
    metadata: params.metadata ?? null,
    performedBy: params.performedBy ?? null,
  })
}
