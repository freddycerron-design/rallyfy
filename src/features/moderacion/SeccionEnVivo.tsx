import { Boton, Tarjeta } from '@/components/ui'
import type { TramoPublico } from '@/lib/tipos'
import type { Pendiente } from './api'
import { horaCorta } from './formato'

type Props = {
  transmisiones: Pendiente[]
  tramos: TramoPublico[]
  ocupado: boolean
  alCerrar: (id: string) => void
}

/** Transmisiones aprobadas que aún figuran "en vivo" (vencen solas a las 2 horas). */
export function SeccionEnVivo({ transmisiones, tramos, ocupado, alCerrar }: Props) {
  return (
    <Tarjeta className="space-y-3">
      <h2 className="text-lg font-semibold">En vivo ahora ({transmisiones.length})</h2>
      <ul className="divide-y divide-gray-100">
        {transmisiones.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <a
              href={t.url_canonica}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-marca-oscuro underline"
            >
              {t.autor ?? t.url_canonica}
            </a>
            <span className="text-sm text-gray-600">
              {tramos.find((x) => x.id === t.tramo_id)?.codigo} · hasta{' '}
              {t.en_vivo_hasta ? horaCorta(t.en_vivo_hasta) : '—'}
            </span>
            <Boton variante="secundario" disabled={ocupado} onClick={() => alCerrar(t.id)}>
              Cerrar en vivo
            </Boton>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
