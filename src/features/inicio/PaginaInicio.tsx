import { Link } from 'react-router'
import { EstadoTramo } from '@/components/EstadoTramo'
import { Aviso, Cargando } from '@/components/ui'
import { useEventoActivo, useTramosPublicos } from '@/lib/consultasPublicas'
import { mensajeError } from '@/lib/errores'
import { formatearFecha, formatearFechaHora } from '@/lib/formato'

export function PaginaInicio() {
  const evento = useEventoActivo()
  const tramos = useTramosPublicos(evento.data?.id)

  if (evento.isPending) return <Cargando />
  if (evento.isError) return <Aviso tipo="error">{mensajeError(evento.error)}</Aviso>
  if (!evento.data) {
    return (
      <section className="space-y-2 py-8 text-center">
        <h1 className="text-2xl font-bold">Muro Rally</h1>
        <p className="text-gray-600">
          No hay una fecha en curso. Vuelve el día del rally para ver los videos de los aficionados.
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{evento.data.nombre}</h1>
        <p className="text-gray-600">
          {formatearFecha(evento.data.fecha_inicio)}
          {evento.data.fecha_fin !== evento.data.fecha_inicio &&
            ` – ${formatearFecha(evento.data.fecha_fin)}`}
        </p>
      </header>

      <Link
        to="/enviar"
        className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-marca text-lg font-bold text-tinta shadow-sm hover:bg-amber-400"
      >
        <span aria-hidden>📹</span> Enviar mi video
      </Link>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Tramos</h2>
        {tramos.isPending && <Cargando />}
        {tramos.isError && <Aviso tipo="error">{mensajeError(tramos.error)}</Aviso>}
        {tramos.data?.length === 0 && (
          <p className="text-gray-600">Todavía no se cargaron los tramos.</p>
        )}
        <ul className="space-y-2">
          {tramos.data?.map((t) => (
            <li key={t.id}>
              <Link
                to={`/tramo/${t.id}`}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-gray-400"
              >
                <span className="w-12 shrink-0 text-lg font-bold">{t.codigo}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.nombre}</span>
                  <span className="text-sm text-gray-600">
                    {Number(t.longitud_km).toFixed(1)} km
                    {t.hora_inicio_prevista &&
                      ` · largada ${formatearFechaHora(t.hora_inicio_prevista)}`}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <EstadoTramo estado={t.estado} />
                  <span className="text-sm text-gray-600">
                    {t.publicaciones_aprobadas}{' '}
                    {t.publicaciones_aprobadas === 1 ? 'video' : 'videos'}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
