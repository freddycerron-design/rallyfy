import type { Pendiente } from './api'

/** Señales para el moderador (spec §6.7 y §7.6). */
export function Alertas({ publicacion: p }: { publicacion: Pendiente }) {
  const alertas: { texto: string; clase: string }[] = []
  if (p.lejos_del_trazado) {
    alertas.push({
      texto: `A ${Math.round(Number(p.distancia_al_trazado_m))} m del trazado`,
      clase: 'bg-amber-100 text-amber-900',
    })
  }
  if (p.origen_ubicacion === 'manual') {
    alertas.push({ texto: 'Ubicación marcada a mano', clase: 'bg-blue-100 text-blue-900' })
  }
  if (p.es_en_vivo) alertas.push({ texto: 'En vivo', clase: 'bg-red-100 text-red-800' })
  if (p.autos.length === 0) alertas.push({ texto: 'Sin autos', clase: 'bg-gray-200 text-gray-800' })

  if (alertas.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Alertas">
      {alertas.map((a) => (
        <li key={a.texto} className={`rounded px-2 py-0.5 text-xs font-medium ${a.clase}`}>
          {a.texto}
        </li>
      ))}
    </ul>
  )
}
