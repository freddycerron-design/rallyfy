// Validación y normalización de enlaces de TikTok y YouTube.
// Compartido entre el navegador (validación inmediata) y la Edge Function (Deno):
// sin dependencias y usando solo APIs estándar (URL, fetch).

export type Plataforma = 'tiktok' | 'youtube'

export type UrlVideo = {
  tipo: 'video'
  plataforma: Plataforma
  /** Id del video en la plataforma; para transmisiones de TikTok, `live:@usuario`. */
  idExterno: string
  urlCanonica: string
  /** El enlace es de una transmisión en vivo. */
  esEnVivo: boolean
}

/** Enlace corto de TikTok: hay que seguir la redirección para saber a qué video apunta. */
export type UrlCorta = { tipo: 'corto'; plataforma: 'tiktok'; url: string }

export type UrlAnalizada = UrlVideo | UrlCorta

export type CodigoErrorUrl = 'vacio' | 'formato' | 'dominio' | 'no_reconocida'

export class ErrorUrl extends Error {
  constructor(
    readonly codigo: CodigoErrorUrl,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorUrl'
  }
}

const DOMINIOS_YOUTUBE = new Set(['youtube.com', 'youtu.be'])
const DOMINIOS_TIKTOK = new Set(['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'])

const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/
const ID_TIKTOK = /^\d{8,25}$/
const USUARIO_TIKTOK = /^@[A-Za-z0-9._]{1,30}$/

/** Quita `www.` y `m.` y pasa a minúsculas. */
function hostBase(host: string): string {
  return host.toLowerCase().replace(/^(www\.|m\.)/, '')
}

export function esDominioPermitido(host: string): boolean {
  const h = hostBase(host)
  return DOMINIOS_YOUTUBE.has(h) || DOMINIOS_TIKTOK.has(h)
}

/**
 * Extrae la URL de un texto pegado. Al compartir, TikTok copia
 * "Mira este video… https://vm.tiktok.com/XXXX/".
 */
function extraerUrl(texto: string): URL {
  const limpio = texto.trim()
  if (!limpio) throw new ErrorUrl('vacio', 'Pega el enlace de tu video.')

  const encontrada =
    limpio.match(/https?:\/\/[^\s<>"']+/i)?.[0] ??
    limpio.match(
      /(?:^|\s)((?:www\.|m\.|vm\.|vt\.)?(?:tiktok\.com|youtube\.com|youtu\.be)\/[^\s<>"']*)/i,
    )?.[1]
  if (!encontrada) {
    throw new ErrorUrl('formato', 'Eso no parece un enlace. Cópialo desde el botón Compartir.')
  }
  try {
    return new URL(/^https?:\/\//i.test(encontrada) ? encontrada : `https://${encontrada}`)
  } catch {
    throw new ErrorUrl('formato', 'El enlace no es válido.')
  }
}

/** Analiza un enlace pegado por el aficionado. Lanza `ErrorUrl` si no sirve. */
export function analizarUrl(texto: string): UrlAnalizada {
  const url = extraerUrl(texto)
  const host = hostBase(url.hostname)

  if (DOMINIOS_YOUTUBE.has(host)) return analizarYoutube(url, host)
  if (DOMINIOS_TIKTOK.has(host)) return analizarTiktok(url, host)

  throw new ErrorUrl('dominio', 'Por ahora solo aceptamos enlaces de TikTok o YouTube.')
}

function analizarYoutube(url: URL, host: string): UrlVideo {
  const partes = url.pathname.split('/').filter(Boolean)
  let id: string | null | undefined
  let esEnVivo = false

  if (host === 'youtu.be') {
    id = partes[0]
  } else if (partes[0] === 'watch') {
    id = url.searchParams.get('v')
  } else if (['shorts', 'embed', 'v', 'live'].includes(partes[0] ?? '')) {
    id = partes[1]
    esEnVivo = partes[0] === 'live'
  }

  if (!id || !ID_YOUTUBE.test(id)) {
    throw new ErrorUrl(
      'no_reconocida',
      'Necesitamos el enlace de un video o transmisión de YouTube, no de un canal o lista.',
    )
  }
  return {
    tipo: 'video',
    plataforma: 'youtube',
    idExterno: id,
    urlCanonica: `https://www.youtube.com/watch?v=${id}`,
    esEnVivo,
  }
}

function analizarTiktok(url: URL, host: string): UrlAnalizada {
  const partes = url.pathname.split('/').filter(Boolean)

  // Enlaces cortos: vm.tiktok.com/XXXX, vt.tiktok.com/XXXX, tiktok.com/t/XXXX
  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com' || partes[0] === 't') {
    const codigo = host === 'tiktok.com' ? partes[1] : partes[0]
    if (!codigo || !/^[A-Za-z0-9_-]{4,40}$/.test(codigo)) {
      throw new ErrorUrl('no_reconocida', 'El enlace corto de TikTok está incompleto.')
    }
    return {
      tipo: 'corto',
      plataforma: 'tiktok',
      url:
        host === 'tiktok.com'
          ? `https://www.tiktok.com/t/${codigo}/`
          : `https://${host}/${codigo}/`,
    }
  }

  const [usuario, seccion, id] = partes
  if (usuario && USUARIO_TIKTOK.test(usuario)) {
    if ((seccion === 'video' || seccion === 'photo') && id && ID_TIKTOK.test(id)) {
      return {
        tipo: 'video',
        plataforma: 'tiktok',
        idExterno: id,
        urlCanonica: `https://www.tiktok.com/${usuario}/${seccion}/${id}`,
        esEnVivo: false,
      }
    }
    if (seccion === 'live') {
      const u = usuario.toLowerCase()
      return {
        tipo: 'video',
        plataforma: 'tiktok',
        idExterno: `live:${u}`,
        urlCanonica: `https://www.tiktok.com/${u}/live`,
        esEnVivo: true,
      }
    }
  }

  throw new ErrorUrl(
    'no_reconocida',
    'Necesitamos el enlace de un video o transmisión de TikTok, no de un perfil.',
  )
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/**
 * Sigue las redirecciones de un enlace corto (en el servidor: el navegador no puede por CORS).
 * Cada salto debe quedarse en dominios permitidos.
 */
export async function resolverEnlaceCorto(
  url: string,
  fetchFn: FetchLike = fetch,
  maxSaltos = 5,
): Promise<UrlVideo> {
  let actual = url
  for (let salto = 0; salto < maxSaltos; salto++) {
    const respuesta = await fetchFn(actual, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MuroRally/1.0)' },
    })
    const destino = respuesta.headers.get('location')
    if (respuesta.status < 300 || respuesta.status >= 400 || !destino) break

    const siguiente = new URL(destino, actual)
    if (!esDominioPermitido(siguiente.hostname)) {
      throw new ErrorUrl('dominio', 'El enlace corto lleva a un sitio que no es TikTok.')
    }
    let analizada: UrlAnalizada
    try {
      analizada = analizarUrl(siguiente.href)
    } catch (e) {
      // Un código vencido o mal copiado redirige a la portada u otra página de TikTok.
      if (e instanceof ErrorUrl && e.codigo === 'no_reconocida') {
        throw new ErrorUrl(
          'no_reconocida',
          'El enlace corto no lleva a un video de TikTok. Revisa que esté completo o pega el enlace del video.',
        )
      }
      throw e
    }
    if (analizada.tipo === 'video') return analizada
    actual = analizada.url
  }
  throw new ErrorUrl(
    'no_reconocida',
    'No pudimos abrir el enlace corto. Abre el video en TikTok, toca Compartir → Copiar enlace y pega el enlace completo.',
  )
}
