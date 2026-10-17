type ErrorPostgrest = { code?: string; message?: string; details?: string }

/** Convierte errores de Supabase/PostgREST en un mensaje para el usuario. */
export function mensajeError(error: unknown): string {
  if (!error) return 'Ocurrió un error inesperado.'
  const e = error as ErrorPostgrest
  switch (e.code) {
    case '23505':
      return 'Ya existe un registro con esos datos (código, orden o número repetido).'
    case '23503':
      return 'No se puede borrar porque tiene datos asociados (por ejemplo, publicaciones).'
    case '42501':
      return 'No tienes permisos para esta acción.'
    case 'PGRST301':
    case 'PGRST303':
      return 'Tu sesión venció. Vuelve a iniciar sesión.'
  }
  if (e.message?.includes('Failed to fetch')) return 'Sin conexión con el servidor.'
  return e.message || 'Ocurrió un error inesperado.'
}
