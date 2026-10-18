import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MapaEvento } from '@/components/mapa'
import { TarjetaPublicacion } from '@/components/TarjetaPublicacion'
import { Aviso, Cargando } from '@/components/ui'
import { useEventoActivo, useTramosPublicos } from '@/lib/consultasPublicas'
import { mensajeError } from '@/lib/errores'
import { horaCorta } from '@/lib/formato'
import {
  ordenarMuro,
  type UltimoVisto,
  useMuroEnTiempoReal,
  useMuroEvento,
  useUltimosVistos,
} from '@/lib/muro'

type Seleccion = { tipo: 'publicacion'; id: string } | { tipo: 'autos'; numeros: number[] } | null

export function PaginaMapa() {
  const evento = useEventoActivo()

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold">Mapa</h1>
      {evento.isPending ? (
        <Cargando />
      ) : evento.isError ? (
        <Aviso tipo="error">{mensajeError(evento.error)}</Aviso>
      ) : !evento.data ? (
        <p className="text-gray-600">No hay una fecha en curso.</p>
      ) : (
        <MapaDelEvento eventoId={evento.data.id} />
      )}
    </section>
  )
}

function MapaDelEvento({ eventoId }: { eventoId: string }) {
  const [params, setParams] = useSearchParams()
  const modoUltimo = params.get('modo') === 'ultimo'
  const [seleccion, setSeleccion] = useState<Seleccion>(null)

  const sondeo = useMuroEnTiempoReal(eventoId)
  const tramos = useTramosPublicos(eventoId)
  const publicaciones = useMuroEvento(eventoId, sondeo)
  const ultimos = useUltimosVistos(eventoId, sondeo)

  const lineas = useMemo(
    () =>
      (tramos.data ?? []).map((t) => ({
        id: t.id,
        etiqueta: t.codigo,
        coordenadas: t.trazado_geojson.coordinates,
      })),
    [tramos.data],
  )
  // Puntos públicos: la proyección sobre el trazado, nunca la ubicación del aficionado.
  const pines = useMemo(
    () =>
      (publicaciones.data ?? [])
        .filter((p) => p.punto_lon != null && p.punto_lat != null)
        .map((p) => ({ id: p.id, lon: p.punto_lon!, lat: p.punto_lat! })),
    [publicaciones.data],
  )
  const autos = useMemo(
    () => (modoUltimo ? agruparPorPunto(ultimos.data ?? []) : null),
    [modoUltimo, ultimos.data],
  )

  useEffect(() => {
    if (!seleccion) return
    const cerrar = (e: KeyboardEvent) => e.key === 'Escape' && setSeleccion(null)
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [seleccion])

  function cambiarModo(ultimo: boolean) {
    setSeleccion(null)
    setParams(ultimo ? { modo: 'ultimo' } : {}, { replace: true })
  }

  const publicacionElegida =
    seleccion?.tipo === 'publicacion'
      ? publicaciones.data?.find((p) => p.id === seleccion.id)
      : undefined
  const autosElegidos =
    seleccion?.tipo === 'autos'
      ? (ultimos.data ?? []).filter((u) => seleccion.numeros.includes(u.numero))
      : []

  const error = tramos.error ?? publicaciones.error ?? ultimos.error

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Qué mostrar"
        className="inline-flex rounded-lg border border-gray-300 bg-white p-1"
      >
        {[
          { ultimo: false, texto: `Videos${publicaciones.data ? ` (${pines.length})` : ''}` },
          { ultimo: true, texto: 'Último visto' },
        ].map((o) => (
          <button
            key={String(o.ultimo)}
            type="button"
            role="radio"
            aria-checked={modoUltimo === o.ultimo}
            onClick={() => cambiarModo(o.ultimo)}
            className={`min-h-10 rounded-md px-3 text-sm font-medium ${
              modoUltimo === o.ultimo ? 'bg-tinta text-white' : 'text-gray-700'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>

      {error && <Aviso tipo="error">{mensajeError(error)}</Aviso>}
      {modoUltimo && (
        <p className="text-sm text-gray-600">
          Cada auto en el último km donde aparece en un video aprobado. La hora es la del envío.
        </p>
      )}

      <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
        <MapaEvento
          lineas={lineas}
          pines={pines}
          autos={autos}
          alElegirPin={(id) => setSeleccion({ tipo: 'publicacion', id })}
          alElegirAutos={(numeros) => setSeleccion({ tipo: 'autos', numeros })}
        />
      </Suspense>

      <ListaAccesible
        modoUltimo={modoUltimo}
        publicaciones={ordenarMuro(publicaciones.data ?? [], 'km')}
        ultimos={ultimos.data ?? []}
        alElegir={setSeleccion}
      />

      {(publicacionElegida || autosElegidos.length > 0) && (
        <div
          role="dialog"
          aria-label={publicacionElegida ? 'Video seleccionado' : 'Auto seleccionado'}
          className="fixed inset-x-0 bottom-14 z-20 max-h-[65vh] overflow-y-auto rounded-t-2xl border-t border-gray-200 bg-fondo p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
        >
          <div className="mx-auto max-w-3xl space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSeleccion(null)}
                className="min-h-10 rounded-lg px-3 text-sm font-medium text-gray-700"
              >
                Cerrar ✕
              </button>
            </div>
            {publicacionElegida && <TarjetaPublicacion publicacion={publicacionElegida} conTramo />}
            {autosElegidos.map((a) => (
              <FichaUltimoVisto key={a.numero} auto={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Agrupa los autos cuyo último visto cae en el mismo punto, para no tapar marcadores. */
function agruparPorPunto(ultimos: UltimoVisto[]) {
  const grupos = new Map<string, { numeros: number[]; lon: number; lat: number }>()
  for (const u of ultimos) {
    if (u.punto_lon == null || u.punto_lat == null) continue
    const clave = `${u.punto_lon.toFixed(5)},${u.punto_lat.toFixed(5)}`
    const grupo = grupos.get(clave)
    if (grupo) grupo.numeros.push(u.numero)
    else grupos.set(clave, { numeros: [u.numero], lon: u.punto_lon, lat: u.punto_lat })
  }
  return [...grupos.values()].map((g) => ({ ...g, numeros: g.numeros.sort((a, b) => a - b) }))
}

function FichaUltimoVisto({ auto }: { auto: UltimoVisto }) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-lg font-bold">
        #{auto.numero} · {auto.piloto}
      </p>
      {auto.copiloto && <p className="text-gray-700">{auto.copiloto}</p>}
      <p>
        Último visto en <strong>{auto.tramo_codigo}</strong>
        {auto.km_en_tramo != null && ` · km ${Number(auto.km_en_tramo).toFixed(1)}`}{' '}
        <span className="text-gray-600">(aprox. {horaCorta(auto.hora_captura)})</span>
      </p>
      <Link to={`/auto/${auto.numero}`} className="font-medium text-marca-oscuro underline">
        Ver todos sus videos
      </Link>
    </div>
  )
}

function ListaAccesible({
  modoUltimo,
  publicaciones,
  ultimos,
  alElegir,
}: {
  modoUltimo: boolean
  publicaciones: ReturnType<typeof ordenarMuro>
  ultimos: UltimoVisto[]
  alElegir: (s: Seleccion) => void
}) {
  return (
    <details className="rounded-xl border border-gray-200 bg-white">
      <summary className="min-h-11 cursor-pointer px-4 py-3 font-medium">Ver como lista</summary>
      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {modoUltimo
          ? ultimos.map((u) => (
              <li key={u.numero}>
                <button
                  type="button"
                  onClick={() => alElegir({ tipo: 'autos', numeros: [u.numero] })}
                  className="flex min-h-11 w-full justify-between gap-2 px-4 py-2 text-left"
                >
                  <span>
                    <strong>#{u.numero}</strong> {u.piloto}
                  </span>
                  <span className="text-gray-600">
                    {u.tramo_codigo}
                    {u.km_en_tramo != null && ` · km ${Number(u.km_en_tramo).toFixed(1)}`}
                  </span>
                </button>
              </li>
            ))
          : publicaciones.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => alElegir({ tipo: 'publicacion', id: p.id })}
                  className="flex min-h-11 w-full justify-between gap-2 px-4 py-2 text-left"
                >
                  <span>
                    <strong>{p.tramo_codigo}</strong>
                    {p.km_en_tramo != null && ` · km ${Number(p.km_en_tramo).toFixed(1)}`}
                  </span>
                  <span className="text-gray-600">
                    {p.autos.map((n) => `#${n}`).join(' ') || '—'}
                  </span>
                </button>
              </li>
            ))}
      </ul>
    </details>
  )
}
