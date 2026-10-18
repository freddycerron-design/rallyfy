const fecha = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short', year: 'numeric' })
const fechaHora = new Intl.DateTimeFormat('es-419', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** "2026-10-17" → "17 oct 2026" (sin desfase de zona horaria). */
export function formatearFecha(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number)
  return fecha.format(new Date(a!, m! - 1, d!))
}

export const formatearFechaHora = (iso: string) => fechaHora.format(new Date(iso))

/** ISO → valor de <input type="datetime-local"> en hora local. */
export function aInputLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const desfase = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - desfase).toISOString().slice(0, 16)
}

/** Valor de <input type="datetime-local"> (hora local) → ISO, o null si está vacío. */
export const deInputLocal = (valor: string): string | null =>
  valor ? new Date(valor).toISOString() : null

const hora = new Intl.DateTimeFormat('es-419', { hour: '2-digit', minute: '2-digit' })

export const horaCorta = (iso: string) => hora.format(new Date(iso))
