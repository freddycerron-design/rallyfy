import type { Plataforma } from '@shared/urls.ts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { env } from './env'
import { supabase } from './supabase'

/** Fila de la vista `muro_publico`: solo publicaciones aprobadas y sin datos privados. */
export type PublicacionMuro = {
  id: string
  evento_id: string
  tramo_id: string
  tramo_codigo: string
  tramo_nombre: string
  tramo_orden: number
  plataforma: Plataforma
  id_externo: string
  url_canonica: string
  titulo: string | null
  autor: string | null
  alias: string | null
  es_en_vivo: boolean
  en_vivo_hasta: string | null
  en_vivo_ahora: boolean
  autos: number[]
  km_en_tramo: number | null
  punto_lon: number | null
  punto_lat: number | null
  hora_captura: string
  votos: number
  aprobada_en: string | null
}

export type OrdenMuro = 'km' | 'hora' | 'votos'

const LIMITE = 500
const SONDEO_MS = 30_000

/** Claves de TanStack Query del muro; el tiempo real invalida todo `['muro', eventoId]`. */
const claves = {
  tramo: (eventoId: string | undefined, tramoId: string) => ['muro', eventoId, 'tramo', tramoId],
  auto: (eventoId: string, numero: number) => ['muro', eventoId, 'auto', numero],
}

/** Ordena como pide la spec §7.2: por km (recorrido), por hora (recientes primero) o por votos. */
export function ordenarMuro(publicaciones: PublicacionMuro[], orden: OrdenMuro): PublicacionMuro[] {
  const copia = [...publicaciones]
  const porHora = (a: PublicacionMuro, b: PublicacionMuro) =>
    b.hora_captura.localeCompare(a.hora_captura)
  switch (orden) {
    case 'km':
      return copia.sort(
        (a, b) =>
          a.tramo_orden - b.tramo_orden ||
          (a.km_en_tramo ?? Infinity) - (b.km_en_tramo ?? Infinity) ||
          porHora(a, b),
      )
    case 'hora':
      return copia.sort(porHora)
    case 'votos':
      return copia.sort((a, b) => b.votos - a.votos || porHora(a, b))
  }
}

/** Publicaciones aprobadas de un tramo. Se ordenan y filtran en el cliente. */
export function useMuroTramo(tramoId: string, eventoId: string | undefined, sondeo: boolean) {
  return useQuery({
    queryKey: claves.tramo(eventoId, tramoId),
    refetchInterval: sondeo ? SONDEO_MS : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('muro_publico')
        .select('*')
        .eq('tramo_id', tramoId)
        .order('km_en_tramo')
        .limit(LIMITE)
      if (error) throw error
      return data as PublicacionMuro[]
    },
  })
}

/** Publicaciones aprobadas donde aparece un auto, en orden de tramo y km (spec §7.4). */
export function useMuroAuto(eventoId: string | undefined, numero: number, sondeo: boolean) {
  return useQuery({
    queryKey: claves.auto(eventoId ?? '', numero),
    enabled: !!eventoId,
    refetchInterval: sondeo ? SONDEO_MS : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('muro_publico')
        .select('*')
        .eq('evento_id', eventoId!)
        .contains('autos', [numero])
        .limit(LIMITE)
      if (error) throw error
      return ordenarMuro(data as PublicacionMuro[], 'km')
    },
  })
}

/**
 * Tiempo real para el público (spec §9): escucha el Broadcast `muro:{evento}` que emite
 * la base al aprobar o cambiar publicaciones, y vuelve a consultar. Nunca recibe filas.
 * Devuelve `true` si hay que sondear: Realtime desactivado por bandera o sin conexión
 * (por ejemplo, si se alcanzó el tope de 200 conexiones del plan gratuito).
 */
export function useMuroEnTiempoReal(eventoId: string | undefined): boolean {
  const qc = useQueryClient()
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    if (!eventoId || !env.realtimePublico) return
    let pendiente: ReturnType<typeof setTimeout> | undefined
    const canal = supabase
      .channel(`muro:${eventoId}`)
      .on('broadcast', { event: 'cambio' }, () => {
        clearTimeout(pendiente)
        pendiente = setTimeout(() => qc.invalidateQueries({ queryKey: ['muro', eventoId] }), 500)
      })
      .subscribe((estado) => setConectado(estado === 'SUBSCRIBED'))
    return () => {
      clearTimeout(pendiente)
      setConectado(false)
      supabase.removeChannel(canal)
    }
  }, [eventoId, qc])

  return !conectado
}
