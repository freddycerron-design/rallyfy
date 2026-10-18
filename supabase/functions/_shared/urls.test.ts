import { describe, expect, it, vi } from 'vitest'
import { analizarUrl, ErrorUrl, esDominioPermitido, resolverEnlaceCorto } from './urls.ts'

const YT = 'dQw4w9WgXcQ'
const TT = '7400000000000000123'

describe('analizarUrl · YouTube', () => {
  it.each([
    `https://www.youtube.com/watch?v=${YT}`,
    `https://youtube.com/watch?v=${YT}&t=42s&si=abc`,
    `https://m.youtube.com/watch?feature=share&v=${YT}`,
    `https://youtu.be/${YT}?si=xyz`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://youtube.com/embed/${YT}`,
    `youtube.com/watch?v=${YT}`,
    `Miren esto!! https://youtu.be/${YT} 🔥`,
  ])('%s → canónica', (entrada) => {
    expect(analizarUrl(entrada)).toEqual({
      tipo: 'video',
      plataforma: 'youtube',
      idExterno: YT,
      urlCanonica: `https://www.youtube.com/watch?v=${YT}`,
      esEnVivo: false,
    })
  })

  it('marca /live/ como transmisión', () => {
    expect(analizarUrl(`https://www.youtube.com/live/${YT}?si=1`)).toMatchObject({
      idExterno: YT,
      esEnVivo: true,
    })
  })

  it.each([
    'https://www.youtube.com/@canal',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/watch?v=corto',
    'https://youtu.be/',
  ])('rechaza %s', (entrada) => {
    expect(() => analizarUrl(entrada)).toThrow(expect.objectContaining({ codigo: 'no_reconocida' }))
  })
})

describe('analizarUrl · TikTok', () => {
  it.each([
    `https://www.tiktok.com/@fan.rally/video/${TT}`,
    `https://www.tiktok.com/@fan.rally/video/${TT}?is_from_webapp=1&sender_device=pc`,
    `https://m.tiktok.com/@fan.rally/video/${TT}`,
    `tiktok.com/@fan.rally/video/${TT}`,
  ])('%s → canónica', (entrada) => {
    expect(analizarUrl(entrada)).toEqual({
      tipo: 'video',
      plataforma: 'tiktok',
      idExterno: TT,
      urlCanonica: `https://www.tiktok.com/@fan.rally/video/${TT}`,
      esEnVivo: false,
    })
  })

  it('acepta publicaciones de fotos', () => {
    expect(analizarUrl(`https://www.tiktok.com/@fan/photo/${TT}`)).toMatchObject({
      idExterno: TT,
      urlCanonica: `https://www.tiktok.com/@fan/photo/${TT}`,
    })
  })

  it('reconoce transmisiones en vivo', () => {
    expect(analizarUrl('https://www.tiktok.com/@Fan.Rally/live?enter_from=share')).toEqual({
      tipo: 'video',
      plataforma: 'tiktok',
      idExterno: 'live:@fan.rally',
      urlCanonica: 'https://www.tiktok.com/@fan.rally/live',
      esEnVivo: true,
    })
  })

  it.each([
    ['https://vm.tiktok.com/ZMabc123/', 'https://vm.tiktok.com/ZMabc123/'],
    ['https://vt.tiktok.com/ZSxyz', 'https://vt.tiktok.com/ZSxyz/'],
    // Código real con guion (los nuevos enlaces cortos lo usan)
    ['https://vt.tiktok.com/ZS9UaHaodEtrj-3qXBa/', 'https://vt.tiktok.com/ZS9UaHaodEtrj-3qXBa/'],
    ['https://www.tiktok.com/t/ZT8abc/', 'https://www.tiktok.com/t/ZT8abc/'],
    [
      'Mira este video de TikTok https://vm.tiktok.com/ZMabc123/ #rally',
      'https://vm.tiktok.com/ZMabc123/',
    ],
  ])('detecta el enlace corto %s', (entrada, url) => {
    expect(analizarUrl(entrada)).toEqual({ tipo: 'corto', plataforma: 'tiktok', url })
  })

  it.each([
    'https://www.tiktok.com/@fan',
    'https://www.tiktok.com/@fan/video/abc',
    'https://www.tiktok.com/explore',
    'https://vm.tiktok.com/',
  ])('rechaza %s', (entrada) => {
    expect(() => analizarUrl(entrada)).toThrow(ErrorUrl)
  })
})

describe('analizarUrl · errores generales', () => {
  it.each([
    ['', 'vacio'],
    ['   ', 'vacio'],
    ['hola', 'formato'],
    ['https://www.instagram.com/reel/abc/', 'dominio'],
    ['https://tiktok.com.evil.example/@a/video/123456789', 'dominio'],
    ['https://www.facebook.com/watch?v=1', 'dominio'],
  ])('%j → %s', (entrada, codigo) => {
    expect(() => analizarUrl(entrada)).toThrow(expect.objectContaining({ codigo }))
  })
})

describe('esDominioPermitido', () => {
  it.each([
    ['www.tiktok.com', true],
    ['vm.tiktok.com', true],
    ['m.youtube.com', true],
    ['youtu.be', true],
    ['evil-tiktok.com', false],
    ['tiktok.com.evil.example', false],
  ])('%s → %s', (host, esperado) => {
    expect(esDominioPermitido(host)).toBe(esperado)
  })
})

describe('resolverEnlaceCorto', () => {
  const redireccion = (location: string, status = 301) =>
    new Response(null, { status, headers: { location } })

  it('sigue las redirecciones hasta el video', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(redireccion('https://www.tiktok.com/t/ZT8abc/'))
      .mockResolvedValueOnce(
        redireccion(`https://www.tiktok.com/@fan/video/${TT}?_r=1&_t=abc`, 302),
      )
    await expect(resolverEnlaceCorto('https://vm.tiktok.com/ZMabc/', fetchFn)).resolves.toEqual({
      tipo: 'video',
      plataforma: 'tiktok',
      idExterno: TT,
      urlCanonica: `https://www.tiktok.com/@fan/video/${TT}`,
      esEnVivo: false,
    })
    expect(fetchFn).toHaveBeenCalledWith(
      'https://vm.tiktok.com/ZMabc/',
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('rechaza redirecciones a otros dominios', async () => {
    const fetchFn = vi.fn().mockResolvedValue(redireccion('https://phishing.example/login'))
    await expect(resolverEnlaceCorto('https://vm.tiktok.com/ZMabc/', fetchFn)).rejects.toThrow(
      expect.objectContaining({ codigo: 'dominio' }),
    )
  })

  it('avisa si el enlace corto redirige a una página que no es un video', async () => {
    const fetchFn = vi.fn().mockResolvedValue(redireccion('https://www.tiktok.com/'))
    await expect(resolverEnlaceCorto('https://vm.tiktok.com/ZMvencido/', fetchFn)).rejects.toThrow(
      'El enlace corto no lleva a un video de TikTok',
    )
  })

  it('pide el enlace completo si TikTok no redirige (por ejemplo, bloqueo)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('captcha', { status: 200 }))
    await expect(resolverEnlaceCorto('https://vm.tiktok.com/ZMabc/', fetchFn)).rejects.toThrow(
      'pega el enlace completo',
    )
  })

  it('corta los bucles de redirección', async () => {
    const fetchFn = vi.fn().mockResolvedValue(redireccion('https://vm.tiktok.com/ZMabc/'))
    await expect(resolverEnlaceCorto('https://vm.tiktok.com/ZMabc/', fetchFn, 3)).rejects.toThrow(
      ErrorUrl,
    )
    expect(fetchFn).toHaveBeenCalledTimes(3)
  })
})
