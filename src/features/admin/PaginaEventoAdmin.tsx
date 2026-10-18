import { Link, useParams, useSearchParams } from 'react-router'
import { RutaProtegida } from '@/components/RutaProtegida'
import { Aviso, Cargando } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import { useEvento } from './api'
import { formatearFecha } from '@/lib/formato'
import { SeccionInscritos } from './inscritos/SeccionInscritos'
import { SeccionTramos } from './tramos/SeccionTramos'

const secciones = [
  { id: 'tramos', titulo: 'Tramos' },
  { id: 'inscritos', titulo: 'Inscritos' },
] as const

export function PaginaEventoAdmin() {
  return (
    <RutaProtegida rol="admin">
      <EventoAdmin />
    </RutaProtegida>
  )
}

function EventoAdmin() {
  const { eventoId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const seccion = params.get('seccion') === 'inscritos' ? 'inscritos' : 'tramos'
  const evento = useEvento(eventoId)

  if (evento.isPending) return <Cargando />
  if (evento.isError) return <Aviso tipo="error">{mensajeError(evento.error)}</Aviso>
  if (!evento.data) return <Aviso tipo="error">No existe ese evento.</Aviso>

  return (
    <section className="space-y-4">
      <Link to="/admin" className="text-sm font-medium text-marca-oscuro underline">
        ← Eventos
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{evento.data.nombre}</h1>
        <p className="text-gray-600">
          {formatearFecha(evento.data.fecha_inicio)} – {formatearFecha(evento.data.fecha_fin)}
          {evento.data.activo && ' · Activo'}
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Secciones del evento"
        className="flex gap-1 border-b border-gray-200"
      >
        {secciones.map((s) => (
          <button
            key={s.id}
            role="tab"
            type="button"
            aria-selected={seccion === s.id}
            onClick={() => setParams({ seccion: s.id }, { replace: true })}
            className={`-mb-px min-h-11 border-b-2 px-4 font-medium ${
              seccion === s.id
                ? 'border-marca-oscuro text-tinta'
                : 'border-transparent text-gray-500 hover:text-tinta'
            }`}
          >
            {s.titulo}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {seccion === 'tramos' ? (
          <SeccionTramos eventoId={eventoId} />
        ) : (
          <SeccionInscritos eventoId={eventoId} />
        )}
      </div>
    </section>
  )
}
