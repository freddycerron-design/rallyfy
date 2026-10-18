import type { Plataforma } from '@shared/urls.ts'

export type VideoRef = {
  plataforma: Plataforma
  idExterno: string
  esEnVivo: boolean
}

/** Las transmisiones en vivo no se incrustan: se abren en la red social (spec §8). */
export const sePuedeIncrustar = (v: VideoRef) => !v.esEnVivo && !v.idExterno.startsWith('live:')

export function urlEmbed(v: VideoRef, { autoplay = true } = {}): string | null {
  if (!sePuedeIncrustar(v)) return null
  const auto = autoplay ? '1' : '0'
  return v.plataforma === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.idExterno)}?autoplay=${auto}&playsinline=1&rel=0`
    : `https://www.tiktok.com/player/v1/${encodeURIComponent(v.idExterno)}?autoplay=${auto}&rel=0&description=1&music_info=0`
}

/** Miniatura sin cargar el reproductor. TikTok no tiene una URL estable: se usa un marcador. */
export function urlMiniatura(v: VideoRef): string | null {
  return v.plataforma === 'youtube'
    ? `https://i.ytimg.com/vi/${encodeURIComponent(v.idExterno)}/hqdefault.jpg`
    : null
}

export const nombrePlataforma = (p: Plataforma) => (p === 'youtube' ? 'YouTube' : 'TikTok')
