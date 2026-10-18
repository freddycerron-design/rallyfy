import { useState } from 'react'
import {
  nombrePlataforma,
  sePuedeIncrustar,
  urlEmbed,
  urlMiniatura,
  type VideoRef,
} from '@/lib/video'

type Props = VideoRef & {
  urlCanonica: string
  titulo?: string | null
  autor?: string | null
  /** Carga el reproductor de entrada (moderación). Por defecto, miniatura y clic (muro). */
  cargarDeEntrada?: boolean
}

/**
 * Video de TikTok o YouTube. En el muro muestra solo una miniatura y carga el iframe
 * al tocar: ahorra datos móviles (spec §8). Las transmisiones abren la red social.
 */
export function Video(props: Props) {
  const [activo, setActivo] = useState(props.cargarDeEntrada ?? false)
  const [miniaturaRota, setMiniaturaRota] = useState(false)
  const vertical = props.plataforma === 'tiktok'
  const marco = vertical
    ? 'mx-auto aspect-[9/16] max-h-[70vh] w-full max-w-sm'
    : 'aspect-video w-full'

  if (!sePuedeIncrustar(props)) return <TarjetaEnVivo {...props} />

  if (activo) {
    return (
      <div className={`${marco} overflow-hidden rounded-lg bg-black`}>
        <iframe
          src={urlEmbed(props, { autoplay: !props.cargarDeEntrada })!}
          title={props.titulo ?? `Video de ${nombrePlataforma(props.plataforma)}`}
          className="size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    )
  }

  const miniatura = miniaturaRota ? null : urlMiniatura(props)
  return (
    <button
      type="button"
      onClick={() => setActivo(true)}
      className={`${vertical ? 'aspect-video w-full' : marco} group relative overflow-hidden rounded-lg bg-tinta text-white`}
      aria-label={`Reproducir ${props.titulo ?? `video de ${nombrePlataforma(props.plataforma)}`}`}
    >
      {miniatura ? (
        <img
          src={miniatura}
          alt=""
          className="size-full object-cover opacity-90"
          loading="lazy"
          decoding="async"
          onError={() => setMiniaturaRota(true)}
        />
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
          <span className="text-sm text-gray-300">
            {nombrePlataforma(props.plataforma)}
            {props.autor ? ` · ${props.autor}` : ''}
          </span>
          {props.titulo && <span className="line-clamp-2 font-medium">{props.titulo}</span>}
        </span>
      )}
      <span
        aria-hidden
        className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-2xl transition-transform group-hover:scale-110"
      >
        ▶
      </span>
    </button>
  )
}

function TarjetaEnVivo({ plataforma, urlCanonica, autor, titulo }: Props) {
  return (
    <a
      href={urlCanonica}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-20 items-center gap-3 rounded-lg border-2 border-red-600 bg-white p-3"
    >
      <span className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-sm font-bold text-white">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-white" /> EN VIVO
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {titulo ?? autor ?? `Transmisión en ${nombrePlataforma(plataforma)}`}
        </span>
        <span className="text-sm text-gray-600">Abrir en {nombrePlataforma(plataforma)} ↗</span>
      </span>
    </a>
  )
}
