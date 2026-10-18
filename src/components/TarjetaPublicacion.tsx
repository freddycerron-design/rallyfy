import { Link } from 'react-router'
import { BotonVoto } from '@/components/BotonVoto'
import { Video } from '@/components/video/Video'
import { horaCorta } from '@/lib/formato'
import type { PublicacionMuro } from '@/lib/muro'

type Props = {
  publicacion: PublicacionMuro
  /** Mostrar el tramo (en la ficha del auto; en el muro del tramo sobra). */
  conTramo?: boolean
  /** Auto a resaltar entre los chips (filtro activo o ficha del auto). */
  autoResaltado?: number
}

export function TarjetaPublicacion({ publicacion: p, conTramo = false, autoResaltado }: Props) {
  return (
    <article className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">
          {conTramo && (
            <Link to={`/tramo/${p.tramo_id}`} className="text-marca-oscuro underline">
              {p.tramo_codigo}
            </Link>
          )}
          {conTramo && ' · '}
          {p.km_en_tramo != null ? `km ${Number(p.km_en_tramo).toFixed(1)}` : 'km —'}
        </p>
        {/* La hora es la del envío, no la del paso del auto (decisión 1 de docs/00). */}
        <p className="text-sm text-gray-600">visto aprox. {horaCorta(p.hora_captura)}</p>
      </header>

      <Video
        plataforma={p.plataforma}
        idExterno={p.id_externo}
        esEnVivo={p.es_en_vivo}
        urlCanonica={p.url_canonica}
        titulo={p.titulo}
        autor={p.autor}
      />

      <footer className="flex flex-wrap items-center gap-2 text-sm">
        {p.autos.map((n) => (
          <Link
            key={n}
            to={`/auto/${n}`}
            aria-label={`Ver auto ${n}`}
            className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border px-2 font-bold tabular-nums ${
              n === autoResaltado
                ? 'border-marca-oscuro bg-marca text-tinta'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            #{n}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-3 text-gray-600">
          {p.alias && <span>por {p.alias}</span>}
          <BotonVoto publicacionId={p.id} votos={p.votos} />
        </span>
      </footer>
    </article>
  )
}
