// Utilidades de redondeo para el motor financiero. Todo monto interno se
// maneja en `number` (no en `numeric` de Postgres) hasta el momento de
// persistir, para poder hacer aritmética simple; se redondea a centavos en
// cada paso para no acumular error de punto flotante.

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Reparte `total` en `n` partes que suman exactamente `roundCents(total)`,
// usando la técnica de "residuo acumulado" (evita que el redondeo de cada
// parte individual haga que la suma final no cuadre).
export function distributeEvenly(total: number, n: number): number[] {
  if (n <= 0) return []
  const rounded = roundCents(total)
  const parts: number[] = []
  let previousCumulative = 0
  for (let i = 1; i <= n; i++) {
    const cumulative = roundCents((rounded * i) / n)
    parts.push(roundCents(cumulative - previousCumulative))
    previousCumulative = cumulative
  }
  return parts
}
