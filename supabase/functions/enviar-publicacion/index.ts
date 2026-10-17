// Edge Function: recibe el envío de una publicación (especificación §6).
// La lógica vive en ../_shared/envio.ts (probada con Vitest); acá solo se conecta
// con Supabase, Turnstile, oEmbed y el entorno de Deno.
//
// Secretos (supabase secrets set): TURNSTILE_SECRET_KEY, IP_HASH_SALT.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { type Dependencias, procesarEnvio } from '../_shared/envio.ts'
import { type Plataforma, resolverEnlaceCorto, type UrlVideo } from '../_shared/urls.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function lanzarSiError<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error
  return data
}

const deps: Dependencias = {
  ahora: () => new Date(),

  async verificarTurnstile(token, ip) {
    const form = new FormData()
    form.append('secret', Deno.env.get('TURNSTILE_SECRET_KEY') ?? '')
    form.append('response', token)
    if (ip) form.append('remoteip', ip)
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    })
    const datos = (await r.json()) as { success?: boolean }
    return datos.success === true
  },

  resolverEnlaceCorto: (url) =>
    resolverEnlaceCorto(url, (u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(5000) })),

  async obtenerOembed(urlCanonica: string, plataforma: Plataforma) {
    const base =
      plataforma === 'youtube'
        ? 'https://www.youtube.com/oembed?format=json&url='
        : 'https://www.tiktok.com/oembed?url='
    const r = await fetch(base + encodeURIComponent(urlCanonica), {
      signal: AbortSignal.timeout(4000),
    })
    if (!r.ok) return null
    const d = (await r.json()) as { title?: string; author_name?: string }
    return { titulo: d.title ?? null, autor: d.author_name ?? null }
  },

  async hashIp(ip) {
    const datos = new TextEncoder().encode(`${Deno.env.get('IP_HASH_SALT') ?? ''}:${ip}`)
    const hash = await crypto.subtle.digest('SHA-256', datos)
    return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
  },

  db: {
    async estadoTramo(eventoId, tramoId) {
      const evento = lanzarSiError(
        await supabase.from('eventos').select('activo').eq('id', eventoId).maybeSingle(),
      )
      if (!evento?.activo) return 'evento_inactivo'
      const tramo = lanzarSiError(
        await supabase
          .from('tramos')
          .select('id')
          .eq('id', tramoId)
          .eq('evento_id', eventoId)
          .maybeSingle(),
      )
      return tramo ? 'ok' : 'tramo_invalido'
    },

    async autosNoInscritos(eventoId, autos) {
      if (autos.length === 0) return []
      const filas = lanzarSiError(
        await supabase
          .from('inscritos')
          .select('numero')
          .eq('evento_id', eventoId)
          .in('numero', autos),
      ) as { numero: number }[]
      const inscritos = new Set(filas.map((f) => f.numero))
      return autos.filter((a) => !inscritos.has(a))
    },

    async contarEnviosDesde(filtro, desde) {
      let consulta = supabase
        .from('publicaciones')
        .select('id', { count: 'exact', head: true })
        .gte('creado_en', desde.toISOString())
      consulta =
        'usuarioId' in filtro
          ? consulta.eq('usuario_id', filtro.usuarioId)
          : consulta.eq('ip_hash', filtro.ipHash)
      const { count, error } = await consulta
      if (error) throw error
      return count ?? 0
    },

    async buscarExistente(eventoId, video: UrlVideo) {
      const columnas = 'id, es_en_vivo'
      const porId = lanzarSiError(
        await supabase
          .from('publicaciones')
          .select(columnas)
          .eq('evento_id', eventoId)
          .eq('plataforma', video.plataforma)
          .eq('id_externo', video.idExterno)
          .maybeSingle(),
      )
      const fila =
        porId ??
        lanzarSiError(
          await supabase
            .from('publicaciones')
            .select(columnas)
            .eq('evento_id', eventoId)
            .eq('url_canonica', video.urlCanonica)
            .maybeSingle(),
        )
      return fila ? { id: fila.id as string, esEnVivo: fila.es_en_vivo as boolean } : null
    },

    async renovarEnVivo(id, hasta) {
      lanzarSiError(
        await supabase
          .from('publicaciones')
          .update({ en_vivo_hasta: hasta.toISOString() })
          .eq('id', id),
      )
    },

    async insertar(fila) {
      const creada = lanzarSiError(
        await supabase
          .from('publicaciones')
          .insert(fila)
          .select('id, km_en_tramo, lejos_del_trazado')
          .single(),
      )
      if (!creada) throw new Error('El insert no devolvió la fila creada')
      return creada
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { codigo: 'error', mensaje: 'Método no permitido' })

  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { data: auth } = jwt ? await supabase.auth.getUser(jwt) : { data: { user: null } }
  if (!auth.user) {
    return json(401, { codigo: 'error', mensaje: 'Necesitas una sesión para enviar.' })
  }

  const ip =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return json(400, { codigo: 'solicitud_invalida', mensaje: 'El cuerpo debe ser JSON.' })
  }

  try {
    const { status, cuerpo: respuesta } = await procesarEnvio(cuerpo, auth.user.id, ip, deps)
    return json(status, respuesta)
  } catch (e) {
    console.error('enviar-publicacion', e)
    return json(500, { codigo: 'error', mensaje: 'Error del servidor. Intenta de nuevo.' })
  }
})
