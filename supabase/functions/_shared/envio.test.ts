import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import { type Dependencias, procesarEnvio, validarSolicitud } from './envio.ts'
import { ErrorUrl } from './urls.ts'

const EVENTO = 'e0000000-0000-4000-8000-000000000001'
const TRAMO = 'a0000000-0000-4000-8000-000000000001'
const USUARIO = '00000000-0000-4000-8000-0000000000f1'
const AHORA = new Date('2026-10-17T15:00:00Z')
const YT = 'dQw4w9WgXcQ'

const solicitudBase = () => ({
  url: `https://youtu.be/${YT}`,
  eventoId: EVENTO,
  tramoId: TRAMO,
  autos: [7, 3, 7],
  ubicacion: { lat: -31.4, lon: -64.6, precisionM: 12, origen: 'gps' },
  horaCaptura: '2026-10-17T14:55:00Z',
  esEnVivo: false,
  turnstileToken: 'token',
})

type DbFalsa = { [K in keyof Dependencias['db']]: Mock<Dependencias['db'][K]> }

function crearDeps(): Omit<Dependencias, 'db'> & { db: DbFalsa } {
  return {
    ahora: () => AHORA,
    verificarTurnstile: vi.fn().mockResolvedValue(true),
    resolverEnlaceCorto: vi.fn(),
    obtenerOembed: vi.fn().mockResolvedValue({ titulo: 'Pasada del 7', autor: 'Fan' }),
    hashIp: vi.fn().mockResolvedValue('hash-ip'),
    db: {
      estadoTramo: vi.fn().mockResolvedValue('ok'),
      autosNoInscritos: vi.fn().mockResolvedValue([]),
      contarEnviosDesde: vi.fn().mockResolvedValue(0),
      buscarExistente: vi.fn().mockResolvedValue(null),
      renovarEnVivo: vi.fn().mockResolvedValue(undefined),
      insertar: vi
        .fn()
        .mockResolvedValue({ id: 'nueva', km_en_tramo: 4.2, lejos_del_trazado: false }),
    },
  }
}

let deps: ReturnType<typeof crearDeps>
beforeEach(() => {
  deps = crearDeps()
})

const enviar = (cuerpo: unknown = solicitudBase(), ip: string | null = '200.1.2.3') =>
  procesarEnvio(cuerpo, USUARIO, ip, deps)

describe('procesarEnvio · camino feliz', () => {
  it('crea la publicación pendiente con datos normalizados', async () => {
    const r = await enviar()
    expect(r).toEqual({
      status: 201,
      cuerpo: {
        codigo: 'creada',
        mensaje: '¡Listo! Tu publicación quedó pendiente de revisión.',
        id: 'nueva',
        kmEnTramo: 4.2,
        lejosDelTrazado: false,
      },
    })
    expect(deps.db.insertar).toHaveBeenCalledWith({
      evento_id: EVENTO,
      tramo_id: TRAMO,
      usuario_id: USUARIO,
      url_original: `https://youtu.be/${YT}`,
      url_canonica: `https://www.youtube.com/watch?v=${YT}`,
      plataforma: 'youtube',
      id_externo: YT,
      titulo: 'Pasada del 7',
      autor: 'Fan',
      es_en_vivo: false,
      autos: [3, 7],
      ubicacion: 'SRID=4326;POINT(-64.6 -31.4)',
      origen_ubicacion: 'gps',
      precision_gps_m: 12,
      hora_captura: '2026-10-17T14:55:00.000Z',
      ip_hash: 'hash-ip',
    })
  })

  it('resuelve enlaces cortos de TikTok en el servidor', async () => {
    deps.resolverEnlaceCorto = vi.fn().mockResolvedValue({
      tipo: 'video',
      plataforma: 'tiktok',
      idExterno: '7400000000000000123',
      urlCanonica: 'https://www.tiktok.com/@fan/video/7400000000000000123',
      esEnVivo: false,
    })
    const r = await enviar({ ...solicitudBase(), url: 'https://vm.tiktok.com/ZMabc/' })
    expect(r.status).toBe(201)
    expect(deps.resolverEnlaceCorto).toHaveBeenCalledWith('https://vm.tiktok.com/ZMabc/')
    expect(deps.db.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ plataforma: 'tiktok', id_externo: '7400000000000000123' }),
    )
  })

  it('guarda igual si oEmbed falla', async () => {
    deps.obtenerOembed = vi.fn().mockRejectedValue(new Error('timeout'))
    expect((await enviar()).status).toBe(201)
    expect(deps.db.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: null, autor: null }),
    )
  })

  it('ubicación manual: sin precisión', async () => {
    await enviar({
      ...solicitudBase(),
      ubicacion: { lat: -31.4, lon: -64.6, precisionM: 30, origen: 'manual' },
    })
    expect(deps.db.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ origen_ubicacion: 'manual', precision_gps_m: null }),
    )
  })

  it('usa la hora del servidor si el reloj del celular está muy desfasado', async () => {
    await enviar({ ...solicitudBase(), horaCaptura: '2020-01-01T00:00:00Z' })
    expect(deps.db.insertar).toHaveBeenCalledWith(
      expect.objectContaining({ hora_captura: AHORA.toISOString() }),
    )
  })

  it('sin IP no aplica el límite por IP ni guarda hash', async () => {
    await enviar(solicitudBase(), null)
    expect(deps.db.contarEnviosDesde).toHaveBeenCalledTimes(1)
    expect(deps.db.insertar).toHaveBeenCalledWith(expect.objectContaining({ ip_hash: null }))
  })
})

describe('procesarEnvio · rechazos', () => {
  it('captcha inválido → 403 sin tocar la base', async () => {
    deps.verificarTurnstile = vi.fn().mockResolvedValue(false)
    const r = await enviar()
    expect(r.status).toBe(403)
    expect(r.cuerpo.codigo).toBe('captcha')
    expect(deps.db.contarEnviosDesde).not.toHaveBeenCalled()
  })

  it.each([
    [{ usuarioId: USUARIO }, 10],
    [{ ipHash: 'hash-ip' }, 30],
  ])('límite de frecuencia %o con %i envíos → 429', async (filtro, cantidad) => {
    deps.db.contarEnviosDesde.mockImplementation(async (f) =>
      JSON.stringify(f) === JSON.stringify(filtro) ? cantidad : 0,
    )
    const r = await enviar()
    expect(r.status).toBe(429)
    expect(deps.db.contarEnviosDesde).toHaveBeenCalledWith(filtro, new Date('2026-10-17T14:00:00Z'))
    expect(deps.db.insertar).not.toHaveBeenCalled()
  })

  it('dominio no permitido → 400 url_invalida', async () => {
    const r = await enviar({ ...solicitudBase(), url: 'https://www.instagram.com/reel/abc' })
    expect(r).toMatchObject({ status: 400, cuerpo: { codigo: 'url_invalida', motivo: 'dominio' } })
  })

  it('enlace corto que no se puede resolver → 400 con instrucciones', async () => {
    deps.resolverEnlaceCorto = vi
      .fn()
      .mockRejectedValue(new ErrorUrl('no_reconocida', 'pega el enlace completo'))
    const r = await enviar({ ...solicitudBase(), url: 'https://vm.tiktok.com/ZMabc/' })
    expect(r).toMatchObject({
      status: 400,
      cuerpo: { codigo: 'url_invalida', mensaje: 'pega el enlace completo' },
    })
  })

  it('duplicada → 409 sin insertar', async () => {
    deps.db.buscarExistente.mockResolvedValue({ id: 'vieja', esEnVivo: false })
    const r = await enviar()
    expect(r).toMatchObject({
      status: 409,
      cuerpo: { codigo: 'duplicada', mensaje: 'Esta publicación ya fue enviada.', id: 'vieja' },
    })
    expect(deps.db.insertar).not.toHaveBeenCalled()
  })

  it('transmisión ya registrada → renueva el en vivo por 2 horas', async () => {
    deps.db.buscarExistente.mockResolvedValue({ id: 'vivo', esEnVivo: true })
    const r = await enviar({ ...solicitudBase(), url: 'https://www.tiktok.com/@fan/live' })
    expect(r).toMatchObject({ status: 200, cuerpo: { codigo: 'en_vivo_renovado', id: 'vivo' } })
    expect(deps.db.renovarEnVivo).toHaveBeenCalledWith('vivo', new Date('2026-10-17T17:00:00Z'))
  })

  it('carrera en el insert (23505) → 409', async () => {
    deps.db.insertar.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }))
    expect((await enviar()).cuerpo.codigo).toBe('duplicada')
  })

  it.each([
    ['evento_inactivo', 409],
    ['tramo_invalido', 400],
  ] as const)('%s → %i', async (estado, status) => {
    deps.db.estadoTramo.mockResolvedValue(estado)
    const r = await enviar()
    expect(r).toMatchObject({ status, cuerpo: { codigo: estado } })
  })

  it('autos no inscritos → 400 con la lista', async () => {
    deps.db.autosNoInscritos.mockResolvedValue([99])
    const r = await enviar({ ...solicitudBase(), autos: [7, 99] })
    expect(r).toMatchObject({
      status: 400,
      cuerpo: {
        codigo: 'autos_invalidos',
        autos: [99],
        mensaje: 'Estos números no están inscritos: 99.',
      },
    })
    expect(deps.db.autosNoInscritos).toHaveBeenCalledWith(EVENTO, [7, 99])
  })

  it('errores inesperados de la base se propagan (la función responde 500)', async () => {
    deps.db.insertar.mockRejectedValue(new Error('conexión caída'))
    await expect(enviar()).rejects.toThrow('conexión caída')
  })
})

describe('validarSolicitud', () => {
  it.each([
    [null, 'objeto JSON'],
    [{ ...solicitudBase(), url: 1 }, 'Falta el enlace'],
    [{ ...solicitudBase(), eventoId: 'x' }, 'Evento inválido'],
    [{ ...solicitudBase(), tramoId: '' }, 'Elige un tramo'],
    [{ ...solicitudBase(), turnstileToken: '' }, 'anti-spam'],
    [{ ...solicitudBase(), autos: [1.5] }, 'números válidos'],
    [{ ...solicitudBase(), autos: Array.from({ length: 21 }, (_, i) => i + 1) }, 'hasta 20'],
    [{ ...solicitudBase(), ubicacion: { lat: 100, lon: 0, origen: 'gps' } }, 'ubicación'],
    [{ ...solicitudBase(), ubicacion: { lat: 1, lon: 1, origen: 'otro' } }, 'Origen'],
  ])('rechaza %j', (cuerpo, mensaje) => {
    const r = validarSolicitud(cuerpo)
    expect(typeof r).toBe('string')
    expect(r).toContain(mensaje)
  })

  it('acepta autos vacíos (el moderador puede completarlos)', () => {
    expect(typeof validarSolicitud({ ...solicitudBase(), autos: [] })).toBe('object')
  })
})
