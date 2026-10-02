import type { Client } from "@/types/collections"

export function formatOperationNumber(sequenceNumber: number): string {
  return `OP-${String(sequenceNumber).padStart(6, "0")}`
}

export function formatMoney(amount: string | number, currencyCode: string): string {
  const value = typeof amount === "string" ? Number(amount) : amount
  return `${currencyCode} ${value.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Para convertir una cuota a la moneda de referencia (§18 del diseño:
// puramente informativo, no afecta saldos ni pagos reales). Usa el total sin
// redondear cuando el motor lo dejó en `engineMetadata.preciseTotalAmount`
// (sistema francés) en vez del total ya redondeado a centavos en USD — así
// el equivalente en Bs coincide con una planilla de referencia calculada con
// la cuota exacta, sin el redondeo intermedio a centavos de por medio. Si no
// hay ese dato (cash, cuotas fijas con monto exacto, etc.), no hace falta:
// ahí el total ya es exacto.
export function preciseInstallmentTotal(totalAmount: string | number, engineMetadata: unknown): number {
  const fallback = typeof totalAmount === "string" ? Number(totalAmount) : totalAmount
  if (engineMetadata && typeof engineMetadata === "object" && "preciseTotalAmount" in engineMetadata) {
    const precise = (engineMetadata as Record<string, unknown>).preciseTotalAmount
    if (typeof precise === "number") return precise
  }
  return fallback
}

export function clientDisplayName(client: Pick<Client, "clientType" | "firstName" | "lastName" | "businessName">): string {
  if (client.clientType === "company") return client.businessName?.trim() || "—"
  return [client.firstName, client.lastName].filter(Boolean).join(" ").trim() || "—"
}

// La gente siempre cotiza el tipo de cambio como "1 USD = X <moneda local>"
// (ej. "el dólar está a 6.96"), nunca al revés — sea cual sea la dirección
// real de la conversión que haga falta (de `from` a `to`). Si no hay USD de
// por medio (par de monedas sin ancla natural), se usa la convención literal
// "1 from = X to".
function isUsdAnchoredRate(from: string, to: string): boolean {
  return to === "USD" && from !== "USD"
}

export function exchangeRateLabel(from: string, to: string): string {
  return isUsdAnchoredRate(from, to) ? `Tipo de cambio (1 ${to} = X ${from})` : `Tipo de cambio (1 ${from} = X ${to})`
}

// Convierte `amount` (en moneda `from`) a moneda `to`, usando el tipo de
// cambio tal como lo pide exchangeRateLabel — dividir cuando la tasa está
// anclada al USD como destino, multiplicar en el resto de los casos.
export function convertCurrency(amount: number, exchangeRate: number, from: string, to: string): number {
  return isUsdAnchoredRate(from, to) ? amount / exchangeRate : amount * exchangeRate
}
