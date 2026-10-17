import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  EstadoTramo,
  Evento,
  Inscrito,
  MiembroEquipo,
  RolUsuario,
  TramoPublico,
} from '@/lib/tipos'
import type { InscritoCsv } from './inscritos/csvInscritos'

const claves = {
  eventos: ['admin', 'eventos'] as const,
  tramos: (eventoId: string) => ['admin', 'tramos', eventoId] as const,
  inscritos: (eventoId: string) => ['admin', 'inscritos', eventoId] as const,
  equipo: ['admin', 'equipo'] as const,
}

/** Lanza el error de Supabase o devuelve los datos. */
function datos<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error
  return data as T
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
export function useEventos() {
  return useQuery({
    queryKey: claves.eventos,
    queryFn: async () =>
      datos<Evento[]>(
        await supabase.from('eventos').select('*').order('fecha_inicio', { ascending: false }),
      ),
  })
}

export function useEvento(id: string) {
  const eventos = useEventos()
  return { ...eventos, data: eventos.data?.find((e) => e.id === id) }
}

export type NuevoEvento = Pick<Evento, 'nombre' | 'fecha_inicio' | 'fecha_fin'>

export function useCrearEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (evento: NuevoEvento) =>
      datos<Evento>(await supabase.from('eventos').insert(evento).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.eventos }),
  })
}

export function useActivarEvento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventoId: string | null) =>
      datos(await supabase.rpc('activar_evento', { p_evento_id: eventoId })),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.eventos }),
  })
}

// ---------------------------------------------------------------------------
// Tramos
// ---------------------------------------------------------------------------
export function useTramos(eventoId: string) {
  return useQuery({
    queryKey: claves.tramos(eventoId),
    queryFn: async () =>
      datos<TramoPublico[]>(
        await supabase.from('tramos_publicos').select('*').eq('evento_id', eventoId).order('orden'),
      ),
  })
}

export type NuevoTramo = {
  evento_id: string
  codigo: string
  nombre: string
  orden: number
  /** Geometría en EWKT (ver `aEwkt`). */
  trazado: string
  hora_inicio_prevista: string | null
}

export function useCrearTramo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tramo: NuevoTramo) => datos(await supabase.from('tramos').insert(tramo)),
    onSuccess: (_d, tramo) => qc.invalidateQueries({ queryKey: claves.tramos(tramo.evento_id) }),
  })
}

export function useActualizarTramo(eventoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      cambios,
    }: {
      id: string
      cambios: { estado?: EstadoTramo | null; hora_inicio_prevista?: string | null }
    }) => datos(await supabase.from('tramos').update(cambios).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.tramos(eventoId) }),
  })
}

export function useEliminarTramo(eventoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(await supabase.from('tramos').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.tramos(eventoId) }),
  })
}

// ---------------------------------------------------------------------------
// Inscritos
// ---------------------------------------------------------------------------
export function useInscritos(eventoId: string) {
  return useQuery({
    queryKey: claves.inscritos(eventoId),
    queryFn: async () =>
      datos<Inscrito[]>(
        await supabase.from('inscritos').select('*').eq('evento_id', eventoId).order('numero'),
      ),
  })
}

/** Inserta o actualiza por número; no borra los que no vienen en el CSV. */
export function useImportarInscritos(eventoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (filas: InscritoCsv[]) =>
      datos(
        await supabase.from('inscritos').upsert(
          filas.map((f) => ({ ...f, evento_id: eventoId })),
          { onConflict: 'evento_id,numero' },
        ),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.inscritos(eventoId) }),
  })
}

export function useEliminarInscrito(eventoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => datos(await supabase.from('inscritos').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.inscritos(eventoId) }),
  })
}

// ---------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------
export function useEquipo() {
  return useQuery({
    queryKey: claves.equipo,
    queryFn: async () => datos<MiembroEquipo[]>(await supabase.rpc('listar_equipo')),
  })
}

export function useCambiarRol() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, rol }: { email: string; rol: RolUsuario }) =>
      datos(await supabase.rpc('cambiar_rol', { p_email: email, p_rol: rol })),
    onSuccess: () => qc.invalidateQueries({ queryKey: claves.equipo }),
  })
}
