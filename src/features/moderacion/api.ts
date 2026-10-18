import type { Plataforma } from '@shared/urls.ts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export type MotivoRechazo =
  'duplicado' | 'no_es_del_evento' | 'contenido_inapropiado' | 'sin_autos_visibles' | 'otro'

export const MOTIVOS: { valor: MotivoRechazo; texto: string }[] = [
  { valor: 'duplicado', texto: 'Duplicado' },
  { valor: 'no_es_del_evento', texto: 'No es de este evento' },
  { valor: 'contenido_inapropiado', texto: 'Contenido inapropiado' },
  { valor: 'sin_autos_visibles', texto: 'No se ven autos' },
  { valor: 'otro', texto: 'Otro motivo' },
]

export type Pendiente = {
  id: string
  evento_id: string
  tramo_id: string
  plataforma: Plataforma
  id_externo: string
  url_canonica: string
  url_original: string
  titulo: string | null
  autor: string | null
  es_en_vivo: boolean
  en_vivo_hasta: string | null
  autos: number[]
  km_en_tramo: number | null
  distancia_al_trazado_m: number | null
  lejos_del_trazado: boolean | null
  origen_ubicacion: 'gps' | 'manual'
  precision_gps_m: number | null
  hora_captura: string
  creado_en: string
}

const COLUMNAS =
  'id, evento_id, tramo_id, plataforma, id_externo, url_canonica, url_original, titulo, autor, ' +
  'es_en_vivo, en_vivo_hasta, autos, km_en_tramo, distancia_al_trazado_m, lejos_del_trazado, ' +
  'origen_ubicacion, precision_gps_m, hora_captura, creado_en'

const claves = {
  pendientes: (eventoId: string) => ['moderacion', 'pendientes', eventoId] as const,
  enVivo: (eventoId: string) => ['moderacion', 'en-vivo', eventoId] as const,
}

/** Cola de pendientes del evento, la más antigua primero (spec §7.6). */
export function usePendientes(eventoId: string) {
  return useQuery({
    queryKey: claves.pendientes(eventoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publicaciones')
        .select(COLUMNAS)
        .eq('evento_id', eventoId)
        .eq('estado', 'pendiente')
        .order('creado_en', { ascending: true })
        .limit(100)
      if (error) throw error
      return data as unknown as Pendiente[]
    },
  })
}

/** Transmisiones aprobadas que siguen marcadas en vivo (para cerrarlas antes). */
export function useEnVivoActivos(eventoId: string) {
  return useQuery({
    queryKey: claves.enVivo(eventoId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('publicaciones')
        .select(COLUMNAS)
        .eq('evento_id', eventoId)
        .eq('estado', 'aprobada')
        .eq('es_en_vivo', true)
        .gt('en_vivo_hasta', new Date().toISOString())
        .order('en_vivo_hasta')
      if (error) throw error
      return data as unknown as Pendiente[]
    },
  })
}

export type AccionModeracion =
  | { accion: 'aprobar'; tramoId?: string; autos?: number[] }
  | { accion: 'rechazar'; motivo: MotivoRechazo }
  | { accion: 'corregir'; tramoId?: string; autos?: number[] }
  | { accion: 'cerrar_en_vivo' }

export function useModerar(eventoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...a }: AccionModeracion & { id: string }) => {
      const { data, error } = await supabase.rpc('moderar_publicacion', {
        p_id: id,
        p_accion: a.accion,
        p_motivo: a.accion === 'rechazar' ? a.motivo : null,
        p_tramo_id: 'tramoId' in a ? (a.tramoId ?? null) : null,
        p_autos: 'autos' in a ? (a.autos ?? null) : null,
      })
      if (error) throw error
      return data as string
    },
    // Quitar de la cola al instante; el refetch confirma.
    onMutate: ({ id, accion }) => {
      if (accion === 'aprobar' || accion === 'rechazar') {
        qc.setQueryData<Pendiente[]>(claves.pendientes(eventoId), (cola) =>
          cola?.filter((p) => p.id !== id),
        )
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: claves.pendientes(eventoId) })
      qc.invalidateQueries({ queryKey: claves.enVivo(eventoId) })
    },
  })
}

/**
 * Tiempo real (spec §9): cualquier cambio en `publicaciones` refresca la cola.
 * Realtime aplica RLS por suscriptor: solo moderadores reciben estas filas.
 * Sin filtro por estado, para enterarse también cuando otro moderador aprueba.
 */
export function useColaEnTiempoReal(eventoId: string) {
  const qc = useQueryClient()
  useEffect(() => {
    let pendiente: ReturnType<typeof setTimeout> | undefined
    const refrescar = () => {
      clearTimeout(pendiente)
      pendiente = setTimeout(() => {
        qc.invalidateQueries({ queryKey: claves.pendientes(eventoId) })
        qc.invalidateQueries({ queryKey: claves.enVivo(eventoId) })
      }, 300)
    }
    const canal = supabase
      .channel(`moderacion:${eventoId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'publicaciones',
          filter: `evento_id=eq.${eventoId}`,
        },
        refrescar,
      )
      .subscribe()
    return () => {
      clearTimeout(pendiente)
      supabase.removeChannel(canal)
    }
  }, [eventoId, qc])
}
