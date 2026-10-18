import type { TramoPublico } from '@/lib/tipos'
import type { Pendiente } from './api'
import { Alertas } from './Alertas'
import { horaCorta } from '@/lib/formato'

type Props = {
  cola: Pendiente[]
  indice: number
  tramos: TramoPublico[]
  alElegir: (indice: number) => void
}

export function ListaCola({ cola, indice, tramos, alElegir }: Props) {
  const codigo = (id: string) => tramos.find((t) => t.id === id)?.codigo ?? '—'

  return (
    <nav aria-label="Cola de pendientes" className="lg:max-h-[75vh] lg:overflow-y-auto">
      <ol className="space-y-2">
        {cola.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              aria-current={i === indice ? 'true' : undefined}
              onClick={() => alElegir(i)}
              className={`w-full rounded-lg border p-2 text-left text-sm ${
                i === indice
                  ? 'border-marca-oscuro bg-amber-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="flex justify-between gap-2">
                <span className="font-medium">
                  {codigo(p.tramo_id)}
                  {p.km_en_tramo != null && ` · km ${Number(p.km_en_tramo).toFixed(1)}`}
                </span>
                <span className="text-gray-500">{horaCorta(p.creado_en)}</span>
              </span>
              <span className="block truncate text-gray-600">
                {p.plataforma === 'youtube' ? 'YouTube' : 'TikTok'}
                {p.autos.length > 0 && ` · ${p.autos.map((a) => `#${a}`).join(' ')}`}
              </span>
              <span className="mt-1 block">
                <Alertas publicacion={p} />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
