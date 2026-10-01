import type { StageForm } from "@/modules/collections/components/StageBuilder"

// Puente entre el cotizador/simulador (QuoteSimulator, sin persistencia en
// base de datos) y "Nueva operación" (CreateOperationForm): al convertir una
// cotización en operación real, el simulador deja acá el escenario armado y
// navega a la página de creación, que lo lee una sola vez al montar y lo
// borra. Es sólo un traspaso de UI en el navegador — la operación real recién
// existe cuando el usuario confirma el formulario y se guarda en la base.
export const PENDING_QUOTE_STORAGE_KEY = "cob_pending_quote"

export interface PendingQuote {
  currencyCode: string
  referenceCurrencyCode: string
  referenceExchangeRate: string
  originalAmount: string
  downPaymentAmount: string
  startDate: string
  notes: string
  stages: StageForm[]
}

export function readAndConsumePendingQuote(): PendingQuote | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PENDING_QUOTE_STORAGE_KEY)
    if (!raw) return null
    window.localStorage.removeItem(PENDING_QUOTE_STORAGE_KEY)
    return JSON.parse(raw) as PendingQuote
  } catch {
    return null
  }
}
