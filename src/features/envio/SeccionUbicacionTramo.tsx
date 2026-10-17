import { Suspense, useMemo } from 'react'
import { MapaTrazados } from '@/components/mapa'
import { Aviso, Boton, Cargando } from '@/components/ui'
import { type Coordenada, formatearDistancia, ordenarPorCercania } from '@/lib/geo'
import type { TramoPublico } from '@/lib/tipos'
import type { useUbicacion } from '@/lib/useUbicacion'

type Props = {
  tramos: TramoPublico[]
  ubicacion: ReturnType<typeof useUbicacion>
  tramoId: string | null
  alElegirTramo: (id: string) => void
  modoManual: boolean
  alCambiarModoManual: (manual: boolean) => void
  puntoManual: Coordenada | null
  alElegirPunto: (punto: Coordenada) => void
}

export function SeccionUbicacionTramo({
  tramos,
  ubicacion,
  tramoId,
  alElegirTramo,
  modoManual,
  alCambiarModoManual,
  puntoManual,
  alElegirPunto,
}: Props) {
  const gps = ubicacion.estado === 'ok' ? ubicacion : null

  const opciones = useMemo(
    () =>
      gps
        ? ordenarPorCercania(gps.punto, tramos, (t) => t.trazado_geojson.coordinates)
        : tramos.map((t) => ({ elemento: t, distanciaM: null })),
    [gps, tramos],
  )

  const tramoElegido = tramos.find((t) => t.id === tramoId)
  const lineasMapa = useMemo(
    () =>
      tramoElegido
        ? [
            {
              id: tramoElegido.id,
              etiqueta: tramoElegido.codigo,
              coordenadas: tramoElegido.trazado_geojson.coordinates,
            },
          ]
        : [],
    [tramoElegido],
  )

  return (
    <div className="space-y-4">
      <EstadoGps
        ubicacion={ubicacion}
        modoManual={modoManual}
        alCambiarModoManual={alCambiarModoManual}
      />

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">Tramo</legend>
        <div className="space-y-2">
          {opciones.map(({ elemento: t, distanciaM }, i) => (
            <label
              key={t.id}
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 ${
                t.id === tramoId ? 'border-marca-oscuro bg-amber-50' : 'border-gray-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name="tramo"
                value={t.id}
                checked={t.id === tramoId}
                onChange={() => alElegirTramo(t.id)}
                className="size-5 accent-marca-oscuro"
              />
              <span className="flex-1">
                <span className="font-semibold">{t.codigo}</span> · {t.nombre}
              </span>
              {distanciaM !== null && (
                <span className="text-sm text-gray-600">
                  {i === 0 && distanciaM < 2000 ? 'Estás aquí · ' : ''}
                  {formatearDistancia(distanciaM)}
                </span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {modoManual && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {tramoElegido
              ? 'Toca en el mapa el punto del tramo donde estás.'
              : 'Elige el tramo para marcar en el mapa dónde estás.'}
          </p>
          {tramoElegido && (
            <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
              <MapaTrazados
                lineas={lineasMapa}
                marcarExtremos
                punto={puntoManual}
                alTocar={alElegirPunto}
                className="h-80"
              />
            </Suspense>
          )}
          {puntoManual && <p className="text-sm text-green-700">✓ Punto marcado</p>}
        </div>
      )}
    </div>
  )
}

function EstadoGps({
  ubicacion,
  modoManual,
  alCambiarModoManual,
}: {
  ubicacion: Props['ubicacion']
  modoManual: boolean
  alCambiarModoManual: (manual: boolean) => void
}) {
  switch (ubicacion.estado) {
    case 'pidiendo':
      return <Aviso>📍 Buscando tu ubicación…</Aviso>
    case 'ok':
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-green-700">
            📍{' '}
            {modoManual
              ? 'Marcarás tu ubicación en el mapa.'
              : `Ubicación detectada (±${ubicacion.precisionM} m)`}
          </p>
          <button
            type="button"
            className="min-h-11 text-sm font-medium text-marca-oscuro underline"
            onClick={() => alCambiarModoManual(!modoManual)}
          >
            {modoManual ? 'Usar mi GPS' : 'Corregir en el mapa'}
          </button>
        </div>
      )
    default:
      return (
        <Aviso tipo="advertencia">
          {ubicacion.estado === 'denegada'
            ? 'No diste permiso de ubicación. '
            : 'No pudimos obtener tu ubicación. '}
          Elige el tramo y marca en el mapa dónde estás.
          {ubicacion.estado !== 'no_soportada' && (
            <Boton variante="secundario" className="mt-2 w-full" onClick={ubicacion.reintentar}>
              Volver a intentar con GPS
            </Boton>
          )}
        </Aviso>
      )
  }
}
