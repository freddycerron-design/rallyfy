import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { TarjetaPublicacion } from '@/components/TarjetaPublicacion'
import { Aviso, Cargando, Tarjeta } from '@/components/ui'
import { useEventoActivo, useInscritosPublicos } from '@/lib/consultasPublicas'
import { mensajeError } from '@/lib/errores'
import { horaCorta } from '@/lib/formato'
import { useMuroAuto, useMuroEnTiempoReal } from '@/lib/muro'
import { supabase } from '@/lib/supabase'

type UltimoVisto = {
  tramo_id: string
  tramo_codigo: string
  km_en_tramo: number | null
  hora_captura: string
}

function useUltimoVisto(eventoId: string | undefined, numero: number) {
  return useQuery({
    queryKey: ['muro', eventoId, 'ultimo-visto', numero],
    enabled: !!eventoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ultimo_visto_por_auto')
        .select('tramo_id, tramo_codigo, km_en_tramo, hora_captura')
        .eq('evento_id', eventoId!)
        .eq('numero', numero)
        .maybeSingle()
      if (error) throw error
      return data as UltimoVisto | null
    },
  })
}

export function PaginaAuto() {
  const numero = Number(useParams().numero)
  const evento = useEventoActivo()
  const eventoId = evento.data?.id
  const inscritos = useInscritosPublicos(eventoId)
  const sondeo = useMuroEnTiempoReal(eventoId)
  const publicaciones = useMuroAuto(eventoId, numero, sondeo)
  const ultimo = useUltimoVisto(eventoId, numero)

  if (!Number.isInteger(numero) || numero <= 0) {
    return <Aviso tipo="error">Número de auto inválido.</Aviso>
  }
  if (evento.isPending || inscritos.isPending) return <Cargando />
  if (evento.isError) return <Aviso tipo="error">{mensajeError(evento.error)}</Aviso>
  if (!evento.data) return <Aviso>No hay una fecha en curso.</Aviso>

  const inscrito = inscritos.data?.find((i) => i.numero === numero)
  if (!inscrito) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Auto #{numero}</h1>
        <p className="text-gray-600">Este número no está inscrito en {evento.data.nombre}.</p>
        <Link to="/" className="font-medium text-marca-oscuro underline">
          Volver al inicio
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <header className="flex items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-tinta text-2xl font-bold text-white tabular-nums">
          {numero}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{inscrito.piloto}</h1>
          {inscrito.copiloto && <p className="text-gray-700">{inscrito.copiloto}</p>}
          <p className="text-gray-600">
            {[inscrito.auto, inscrito.clase].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      {ultimo.data && (
        <Tarjeta className="flex flex-wrap items-center justify-between gap-2">
          <p>
            <span className="text-gray-600">Último visto: </span>
            <Link to={`/tramo/${ultimo.data.tramo_id}`} className="font-semibold underline">
              {ultimo.data.tramo_codigo}
            </Link>
            {ultimo.data.km_en_tramo != null &&
              ` · km ${Number(ultimo.data.km_en_tramo).toFixed(1)}`}
          </p>
          <p className="text-sm text-gray-600">aprox. {horaCorta(ultimo.data.hora_captura)}</p>
        </Tarjeta>
      )}

      <h2 className="text-lg font-semibold">
        Videos{publicaciones.data ? ` (${publicaciones.data.length})` : ''}
      </h2>
      {publicaciones.isPending && <Cargando />}
      {publicaciones.isError && <Aviso tipo="error">{mensajeError(publicaciones.error)}</Aviso>}
      {publicaciones.data?.length === 0 && (
        <p className="text-gray-600">Todavía no hay videos aprobados de este auto.</p>
      )}
      <ol className="space-y-3" aria-label="Publicaciones del auto">
        {publicaciones.data?.map((p) => (
          <li key={p.id}>
            <TarjetaPublicacion publicacion={p} conTramo autoResaltado={numero} />
          </li>
        ))}
      </ol>
    </section>
  )
}
