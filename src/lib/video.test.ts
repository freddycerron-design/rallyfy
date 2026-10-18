import { describe, expect, it } from 'vitest'
import { sePuedeIncrustar, urlEmbed, urlMiniatura } from './video'

const yt = { plataforma: 'youtube' as const, idExterno: 'dQw4w9WgXcQ', esEnVivo: false }
const tt = { plataforma: 'tiktok' as const, idExterno: '7400000000000000123', esEnVivo: false }
const vivo = { plataforma: 'tiktok' as const, idExterno: 'live:@fan', esEnVivo: true }

describe('video', () => {
  it('YouTube usa el dominio sin cookies', () => {
    expect(urlEmbed(yt)).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0',
    )
    expect(urlMiniatura(yt)).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('TikTok usa el reproductor oficial y no tiene miniatura estable', () => {
    expect(urlEmbed(tt, { autoplay: false })).toBe(
      'https://www.tiktok.com/player/v1/7400000000000000123?autoplay=0&rel=0&description=1&music_info=0',
    )
    expect(urlMiniatura(tt)).toBeNull()
  })

  it('las transmisiones en vivo nunca se incrustan', () => {
    expect(sePuedeIncrustar(vivo)).toBe(false)
    expect(urlEmbed(vivo)).toBeNull()
    expect(sePuedeIncrustar({ ...yt, esEnVivo: true })).toBe(false)
  })
})
