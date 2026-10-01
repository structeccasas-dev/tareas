import { addDays, addMonths, formatISO, parseISO } from "date-fns"
import type { Periodicity } from "@/types/collections"

// Días "típicos" por periodicidad, usados sólo para convertir una tasa
// efectiva anual en una tasa por período (ver engine/rates.ts). Para el
// avance real de fechas se usan meses/días calendario exactos (addPeriod).
export const PERIOD_DAYS: Record<Periodicity, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 365 / 12,
  quarterly: 365 / 4,
  annual: 365,
}

export function addPeriod(dateIso: string, periodicity: Periodicity, count = 1): string {
  const date = parseISO(dateIso)
  const next =
    periodicity === "weekly"
      ? addDays(date, 7 * count)
      : periodicity === "biweekly"
        ? addDays(date, 14 * count)
        : periodicity === "monthly"
          ? addMonths(date, count)
          : periodicity === "quarterly"
            ? addMonths(date, 3 * count)
            : addMonths(date, 12 * count)
  return formatISO(next, { representation: "date" })
}
