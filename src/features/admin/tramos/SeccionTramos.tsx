import { Suspense, useMemo } from 'react'
import { MapaTrazados } from '@/components/mapa'
import { Aviso, Boton, Cargando, Selector, Tarjeta } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import type { EstadoTramo } from '@/lib/tipos'
import { useActualizarTramo, useEliminarTramo, useTramos } from '../api'
import { formatearFechaHora } from '@/lib/formato'
import { FormularioTramo } from './FormularioTramo'

const nombreEstado: Record<EstadoTramo, string> = {
  por_iniciar: 'Por iniciar',
  en_curso: 'En curso',
  finalizado: 'Finalizado',
}

export function SeccionTramos({ eventoId }: { eventoId: string }) {
  const tramos = useTramos(eventoId)
  const actualizar = useActualizarTramo(eventoId)
  const eliminar = useEliminarTramo(eventoId)

  const lineas = useMemo(
    () =>
      (tramos.data ?? []).map((t) => ({
        id: t.id,
        etiqueta: t.codigo,
        coordenadas: t.trazado_geojson.coordinates,
      })),
    [tramos.data],
  )
  const siguienteOrden = Math.max(0, ...(tramos.data ?? []).map((t) => t.orden)) + 1

  if (tramos.isPending) return <Cargando />
  if (tramos.isError) return <Aviso tipo="error">{mensajeError(tramos.error)}</Aviso>

  return (
    <div className="space-y-4">
      {lineas.length > 0 && (
        <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
          <MapaTrazados lineas={lineas} />
        </Suspense>
      )}

      {actualizar.isError && <Aviso tipo="error">{mensajeError(actualizar.error)}</Aviso>}
      {eliminar.isError && <Aviso tipo="error">{mensajeError(eliminar.error)}</Aviso>}

      {tramos.data.length === 0 ? (
        <p className="text-gray-600">Este evento todavía no tiene tramos.</p>
      ) : (
        <ul className="space-y-3">
          {tramos.data.map((t) => (
            <li key={t.id}>
              <Tarjeta className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {t.orden}. {t.codigo} · {t.nombre}
                  </p>
                  <p className="text-sm text-gray-600">
                    {Number(t.longitud_km).toFixed(2)} km · {t.publicaciones_aprobadas}{' '}
                    publicaciones
                  </p>
                </div>
                {t.hora_inicio_prevista && (
                  <p className="text-sm text-gray-600">
                    Largada prevista: {formatearFechaHora(t.hora_inicio_prevista)}
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1">
                    <Selector
                      etiqueta={`Estado (ahora: ${nombreEstado[t.estado]})`}
                      value=""
                      disabled={actualizar.isPending}
                      onChange={(e) =>
                        actualizar.mutate({
                          id: t.id,
                          cambios: {
                            estado:
                              e.target.value === 'auto' ? null : (e.target.value as EstadoTramo),
                          },
                        })
                      }
                    >
                      <option value="" disabled>
                        Cambiar…
                      </option>
                      <option value="auto">Automático (según la hora)</option>
                      <option value="por_iniciar">Por iniciar</option>
                      <option value="en_curso">En curso</option>
                      <option value="finalizado">Finalizado</option>
                    </Selector>
                  </div>
                  <Boton
                    variante="peligro"
                    disabled={eliminar.isPending || t.publicaciones_aprobadas > 0}
                    title={
                      t.publicaciones_aprobadas > 0
                        ? 'No se puede borrar un tramo con publicaciones'
                        : undefined
                    }
                    onClick={() => {
                      if (confirm(`¿Borrar el tramo ${t.codigo}?`)) eliminar.mutate(t.id)
                    }}
                  >
                    Borrar
                  </Boton>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}

      <FormularioTramo eventoId={eventoId} ordenSugerido={siguienteOrden} />
    </div>
  )
}
