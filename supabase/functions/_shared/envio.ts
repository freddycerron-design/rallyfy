// Reglas de negocio del envío de publicaciones (especificación §6).
// Función pura con dependencias inyectadas: la Edge Function aporta Supabase, fetch
// y Turnstile; las pruebas aportan dobles. Sin APIs exclusivas de Deno.

import { analizarUrl, ErrorUrl, type Plataforma, type UrlVideo } from './urls.ts'

export const LIMITE_POR_USUARIO_HORA = 10
export const LIMITE_POR_IP_HORA = 30
export const DURACION_EN_VIVO_MS = 2 * 60 * 60 * 1000
const MAX_AUTOS = 20
const TOLERANCIA_HORA_MS = 12 * 60 * 60 * 1000

export type SolicitudEnvio = {
  url: string
  eventoId: string
  tramoId: string
  autos: number[]
  ubicacion: { lat: number; lon: number; precisionM: number | null; origen: 'gps' | 'manual' }
  horaCaptura: string | null
  esEnVivo: boolean
  turnstileToken: string
}

export type CodigoRespuesta =
  | 'creada'
  | 'en_vivo_renovado'
  | 'solicitud_invalida'
  | 'captcha'
  | 'url_invalida'
  | 'duplicada'
  | 'evento_inactivo'
  | 'tramo_invalido'
  | 'autos_invalidos'
  | 'limite'
  | 'error'

export type Respuesta = {
  status: number
  cuerpo: { codigo: CodigoRespuesta; mensaje: string; [extra: string]: unknown }
}

export type FilaNueva = {
  evento_id: string
  tramo_id: string
  usuario_id: string
  url_original: string
  url_canonica: string
  plataforma: Plataforma
  id_externo: string
  titulo: string | null
  autor: string | null
  es_en_vivo: boolean
  autos: number[]
  /** EWKT del punto, por ejemplo `SRID=4326;POINT(-64.6 -31.4)`. */
  ubicacion: string
  origen_ubicacion: 'gps' | 'manual'
  precision_gps_m: number | null
  hora_captura: string
  ip_hash: string | null
}

export type Dependencias = {
  ahora: () => Date
  verificarTurnstile: (token: string, ip: string | null) => Promise<boolean>
  resolverEnlaceCorto: (url: string) => Promise<UrlVideo>
  obtenerOembed: (
    urlCanonica: string,
    plataforma: Plataforma,
  ) => Promise<{ titulo: string | null; autor: string | null } | null>
  hashIp: (ip: string) => Promise<string>
  db: {
    estadoTramo: (
      eventoId: string,
      tramoId: string,
    ) => Promise<'ok' | 'evento_inactivo' | 'tramo_invalido'>
    autosNoInscritos: (eventoId: string, autos: number[]) => Promise<number[]>
    contarEnviosDesde: (
      filtro: { usuarioId: string } | { ipHash: string },
      desde: Date,
    ) => Promise<number>
    buscarExistente: (
      eventoId: string,
      video: UrlVideo,
    ) => Promise<{ id: string; esEnVivo: boolean } | null>
    renovarEnVivo: (id: string, hasta: Date) => Promise<void>
    insertar: (
      fila: FilaNueva,
    ) => Promise<{ id: string; km_en_tramo: number | null; lejos_del_trazado: boolean | null }>
  }
}

const responder = (
  status: number,
  codigo: CodigoRespuesta,
  mensaje: string,
  extra: Record<string, unknown> = {},
): Respuesta => ({ status, cuerpo: { codigo, mensaje, ...extra } })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Valida la forma del cuerpo recibido. Devuelve la solicitud o un mensaje de error. */
export function validarSolicitud(cuerpo: unknown): SolicitudEnvio | string {
  if (!cuerpo || typeof cuerpo !== 'object') return 'El cuerpo debe ser un objeto JSON.'
  const c = cuerpo as Record<string, unknown>
  const u = (c.ubicacion ?? {}) as Record<string, unknown>

  if (typeof c.url !== 'string' || c.url.length > 2048) return 'Falta el enlace.'
  if (typeof c.eventoId !== 'string' || !UUID.test(c.eventoId)) return 'Evento inválido.'
  if (typeof c.tramoId !== 'string' || !UUID.test(c.tramoId)) return 'Elige un tramo.'
  if (typeof c.turnstileToken !== 'string' || !c.turnstileToken) {
    return 'Falta la verificación anti-spam.'
  }
  if (
    !Array.isArray(c.autos) ||
    c.autos.length > MAX_AUTOS ||
    !c.autos.every((a) => Number.isInteger(a) && a > 0 && a < 10_000)
  ) {
    return `Los autos deben ser hasta ${MAX_AUTOS} números válidos.`
  }
  const lat = u.lat
  const lon = u.lon
  if (
    typeof lat !== 'number' ||
    typeof lon !== 'number' ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  ) {
    return 'Falta la ubicación.'
  }
  const origen = u.origen === 'manual' ? 'manual' : u.origen === 'gps' ? 'gps' : null
  if (!origen) return 'Origen de ubicación inválido.'
  const precision =
    origen === 'gps' && typeof u.precisionM === 'number' && u.precisionM >= 0
      ? Math.min(u.precisionM, 100_000)
      : null

  return {
    url: c.url,
    eventoId: c.eventoId,
    tramoId: c.tramoId,
    autos: c.autos as number[],
    ubicacion: { lat, lon, precisionM: precision, origen },
    horaCaptura: typeof c.horaCaptura === 'string' ? c.horaCaptura : null,
    esEnVivo: c.esEnVivo === true,
    turnstileToken: c.turnstileToken,
  }
}

/** La hora del dispositivo, salvo que sea absurda (reloj mal configurado). */
function horaConfiable(hora: string | null, ahora: Date): string {
  const t = hora ? Date.parse(hora) : NaN
  return Number.isFinite(t) && Math.abs(t - ahora.getTime()) <= TOLERANCIA_HORA_MS
    ? new Date(t).toISOString()
    : ahora.toISOString()
}

export async function procesarEnvio(
  cuerpo: unknown,
  usuarioId: string,
  ip: string | null,
  deps: Dependencias,
): Promise<Respuesta> {
  const solicitud = validarSolicitud(cuerpo)
  if (typeof solicitud === 'string') return responder(400, 'solicitud_invalida', solicitud)

  // 1. Turnstile
  if (!(await deps.verificarTurnstile(solicitud.turnstileToken, ip))) {
    return responder(403, 'captcha', 'No pudimos verificar que no eres un robot. Intenta de nuevo.')
  }

  // 8. Límite de frecuencia (antes de las consultas externas, que cuestan más)
  const ahora = deps.ahora()
  const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000)
  const ipHash = ip ? await deps.hashIp(ip) : null
  const [porUsuario, porIp] = await Promise.all([
    deps.db.contarEnviosDesde({ usuarioId }, haceUnaHora),
    ipHash ? deps.db.contarEnviosDesde({ ipHash }, haceUnaHora) : Promise.resolve(0),
  ])
  if (porUsuario >= LIMITE_POR_USUARIO_HORA || porIp >= LIMITE_POR_IP_HORA) {
    return responder(429, 'limite', 'Enviaste muchos videos en la última hora. Prueba más tarde.')
  }

  // 2–4. Dominio, enlace corto y normalización
  let video: UrlVideo
  try {
    const analizada = analizarUrl(solicitud.url)
    video = analizada.tipo === 'corto' ? await deps.resolverEnlaceCorto(analizada.url) : analizada
  } catch (e) {
    if (e instanceof ErrorUrl)
      return responder(400, 'url_invalida', e.message, { motivo: e.codigo })
    throw e
  }

  // 5. Evento activo y tramo del evento
  const estado = await deps.db.estadoTramo(solicitud.eventoId, solicitud.tramoId)
  if (estado === 'evento_inactivo') {
    return responder(409, 'evento_inactivo', 'Este evento ya no recibe publicaciones.')
  }
  if (estado === 'tramo_invalido') {
    return responder(400, 'tramo_invalido', 'El tramo no pertenece al evento.')
  }

  // 4. Duplicados (dentro del evento). Una transmisión ya registrada se renueva.
  const existente = await deps.db.buscarExistente(solicitud.eventoId, video)
  if (existente) {
    if (existente.esEnVivo && (video.esEnVivo || solicitud.esEnVivo)) {
      await deps.db.renovarEnVivo(existente.id, new Date(ahora.getTime() + DURACION_EN_VIVO_MS))
      return responder(
        200,
        'en_vivo_renovado',
        'Tu transmisión ya estaba registrada: la marcamos en vivo otra vez.',
        {
          id: existente.id,
        },
      )
    }
    return responder(409, 'duplicada', 'Esta publicación ya fue enviada.', { id: existente.id })
  }

  // 6. Autos inscritos
  const autos = [...new Set(solicitud.autos)].sort((a, b) => a - b)
  const desconocidos = await deps.db.autosNoInscritos(solicitud.eventoId, autos)
  if (desconocidos.length > 0) {
    return responder(
      400,
      'autos_invalidos',
      `Estos números no están inscritos: ${desconocidos.join(', ')}.`,
      {
        autos: desconocidos,
      },
    )
  }

  // Metadatos opcionales: si oEmbed falla, la publicación se guarda igual.
  const oembed = await deps.obtenerOembed(video.urlCanonica, video.plataforma).catch(() => null)

  // 7 y 9. Insertar como pendiente; los triggers calculan km y distancia.
  const { lat, lon, precisionM, origen } = solicitud.ubicacion
  try {
    const creada = await deps.db.insertar({
      evento_id: solicitud.eventoId,
      tramo_id: solicitud.tramoId,
      usuario_id: usuarioId,
      url_original: solicitud.url.trim().slice(0, 2048),
      url_canonica: video.urlCanonica,
      plataforma: video.plataforma,
      id_externo: video.idExterno,
      titulo: oembed?.titulo?.slice(0, 300) ?? null,
      autor: oembed?.autor?.slice(0, 120) ?? null,
      es_en_vivo: video.esEnVivo || solicitud.esEnVivo,
      autos,
      ubicacion: `SRID=4326;POINT(${lon} ${lat})`,
      origen_ubicacion: origen,
      precision_gps_m: precisionM,
      hora_captura: horaConfiable(solicitud.horaCaptura, ahora),
      ip_hash: ipHash,
    })
    return responder(201, 'creada', '¡Listo! Tu publicación quedó pendiente de revisión.', {
      id: creada.id,
      kmEnTramo: creada.km_en_tramo,
      lejosDelTrazado: creada.lejos_del_trazado,
    })
  } catch (e) {
    // Carrera: otro envío del mismo video entró entre la búsqueda y el insert.
    if ((e as { code?: string })?.code === '23505') {
      return responder(409, 'duplicada', 'Esta publicación ya fue enviada.')
    }
    throw e
  }
}
