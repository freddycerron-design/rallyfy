import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { EstadoTramo } from '@/components/EstadoTramo'
import { TarjetaPublicacion } from '@/components/TarjetaPublicacion'
import { Aviso, Cargando } from '@/components/ui'
import { Video } from '@/components/video/Video'
import { useTramoPublico } from '@/lib/consultasPublicas'
import { mensajeError } from '@/lib/errores'
import { type OrdenMuro, ordenarMuro, useMuroEnTiempoReal, useMuroTramo } from '@/lib/muro'

const ORDENES: { valor: OrdenMuro; texto: string }[] = [
  { valor: 'km', texto: 'Por km' },
  { valor: 'hora', texto: 'Recientes' },
  { valor: 'votos', texto: 'Más votados' },
]

export function PaginaMuro() {
  const { tramoId = '' } = useParams()
  const tramo = useTramoPublico(tramoId)

  if (tramo.isPending) return <Cargando />
  if (tramo.isError) return <Aviso tipo="error">{mensajeError(tramo.error)}</Aviso>
  if (!tramo.data) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Tramo no encontrado</h1>
        <Link to="/" className="font-medium text-marca-oscuro underline">
          Volver al inicio
        </Link>
      </section>
    )
  }

  const t = tramo.data
  return (
    <section className="space-y-4">
      <Link to="/" className="text-sm font-medium text-marca-oscuro underline">
        ← Tramos
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">
            {t.codigo} · {t.nombre}
          </h1>
          <p className="text-gray-600">{Number(t.longitud_km).toFixed(1)} km</p>
        </div>
        <EstadoTramo estado={t.estado} />
      </header>
      <Muro tramoId={t.id} eventoId={t.evento_id} />
    </section>
  )
}

function Muro({ tramoId, eventoId }: { tramoId: string; eventoId: string }) {
  const sondeo = useMuroEnTiempoReal(eventoId)
  const muro = useMuroTramo(tramoId, eventoId, sondeo)
  const [params, setParams] = useSearchParams()

  const orden: OrdenMuro = ORDENES.some((o) => o.valor === params.get('orden'))
    ? (params.get('orden') as OrdenMuro)
    : 'km'
  const auto = Number(params.get('auto')) || null

  function cambiar(clave: 'orden' | 'auto', valor: string | null) {
    const nuevos = new URLSearchParams(params)
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    setParams(nuevos, { replace: true })
  }

  const { enVivo, lista, autosPresentes } = useMemo(() => {
    const todas = muro.data ?? []
    const filtradas = auto ? todas.filter((p) => p.autos.includes(auto)) : todas
    return {
      enVivo: filtradas.filter((p) => p.en_vivo_ahora),
      lista: ordenarMuro(
        filtradas.filter((p) => !p.en_vivo_ahora),
        orden,
      ),
      autosPresentes: [...new Set(todas.flatMap((p) => p.autos))].sort((a, b) => a - b),
    }
  }, [muro.data, auto, orden])

  if (muro.isPending) return <Cargando />
  if (muro.isError) return <Aviso tipo="error">{mensajeError(muro.error)}</Aviso>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div
          role="radiogroup"
          aria-label="Ordenar"
          className="flex rounded-lg border border-gray-300 bg-white p-1"
        >
          {ORDENES.map((o) => (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={orden === o.valor}
              onClick={() => cambiar('orden', o.valor === 'km' ? null : o.valor)}
              className={`min-h-10 rounded-md px-3 text-sm font-medium ${
                orden === o.valor ? 'bg-tinta text-white' : 'text-gray-700'
              }`}
            >
              {o.texto}
            </button>
          ))}
        </div>
        {autosPresentes.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">Auto</span>
            <select
              value={auto ?? ''}
              onChange={(e) => cambiar('auto', e.target.value || null)}
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-2"
            >
              <option value="">Todos</option>
              {autosPresentes.map((n) => (
                <option key={n} value={n}>
                  #{n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {enVivo.length > 0 && (
        <section aria-labelledby="titulo-en-vivo" className="space-y-2">
          <h2
            id="titulo-en-vivo"
            className="flex items-center gap-2 text-lg font-semibold text-red-700"
          >
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-red-600" />
            En vivo ahora
          </h2>
          <ul className="space-y-2">
            {enVivo.map((p) => (
              <li key={p.id}>
                <Video
                  plataforma={p.plataforma}
                  idExterno={p.id_externo}
                  esEnVivo
                  urlCanonica={p.url_canonica}
                  titulo={p.km_en_tramo != null ? `km ${Number(p.km_en_tramo).toFixed(1)}` : null}
                  autor={p.alias ?? p.autor}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {lista.length === 0 && enVivo.length === 0 ? (
        <p className="py-8 text-center text-gray-600">
          {auto
            ? `Todavía no hay videos del auto #${auto} en este tramo.`
            : 'Todavía no hay videos aprobados en este tramo.'}{' '}
          <Link to="/enviar" className="font-medium text-marca-oscuro underline">
            ¿Envías el tuyo?
          </Link>
        </p>
      ) : (
        <ol className="space-y-3" aria-label="Publicaciones">
          {lista.map((p) => (
            <li key={p.id}>
              <TarjetaPublicacion publicacion={p} autoResaltado={auto ?? undefined} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
