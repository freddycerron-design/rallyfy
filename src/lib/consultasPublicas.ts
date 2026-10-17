import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Evento, Inscrito, TramoPublico } from './tipos'

// Consultas que puede hacer cualquiera (anon). Las comparten envío, muro y mapa.

export function useEventoActivo() {
  return useQuery({
    queryKey: ['publico', 'evento-activo'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('activo', true)
        .maybeSingle()
      if (error) throw error
      return data as Evento | null
    },
  })
}

export function useTramosPublicos(eventoId: string | undefined) {
  return useQuery({
    queryKey: ['publico', 'tramos', eventoId],
    enabled: !!eventoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tramos_publicos')
        .select('*')
        .eq('evento_id', eventoId!)
        .order('orden')
      if (error) throw error
      return data as TramoPublico[]
    },
  })
}

export type InscritoPublico = Pick<Inscrito, 'numero' | 'piloto' | 'copiloto' | 'auto' | 'clase'>

export function useInscritosPublicos(eventoId: string | undefined) {
  return useQuery({
    queryKey: ['publico', 'inscritos', eventoId],
    enabled: !!eventoId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inscritos')
        .select('numero, piloto, copiloto, auto, clase')
        .eq('evento_id', eventoId!)
        .order('numero')
      if (error) throw error
      return data as InscritoPublico[]
    },
  })
}
