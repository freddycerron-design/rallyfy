// Tipos de filas de la base de datos que usa el frontend.
// TODO(Fase 3): reemplazar por los tipos generados con `supabase gen types typescript`.

export type RolUsuario = 'aficionado' | 'moderador' | 'admin'
export type EstadoTramo = 'por_iniciar' | 'en_curso' | 'finalizado'

export type Evento = {
  id: string
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  activo: boolean
  creado_en: string
}

/** Fila de la vista `tramos_publicos`. */
export type TramoPublico = {
  id: string
  evento_id: string
  codigo: string
  nombre: string
  orden: number
  longitud_km: number
  hora_inicio_prevista: string | null
  estado: EstadoTramo
  trazado_geojson: { type: 'LineString'; coordinates: [number, number][] }
  publicaciones_aprobadas: number
}

export type Inscrito = {
  id: string
  evento_id: string
  numero: number
  piloto: string
  copiloto: string | null
  auto: string | null
  clase: string | null
}

export type MiembroEquipo = {
  usuario_id: string
  email: string
  alias: string | null
  rol: RolUsuario
}
