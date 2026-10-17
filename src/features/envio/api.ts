import { FunctionsHttpError } from '@supabase/supabase-js'
import { useMutation } from '@tanstack/react-query'
import type { CodigoRespuesta, SolicitudEnvio } from '@shared/envio.ts'
import { mensajeError } from '@/lib/errores'
import { supabase } from '@/lib/supabase'

export type RespuestaEnvio = {
  codigo: CodigoRespuesta
  mensaje: string
  id?: string
  kmEnTramo?: number | null
  lejosDelTrazado?: boolean | null
  autos?: number[]
}

export class ErrorEnvio extends Error {
  constructor(readonly respuesta: RespuestaEnvio) {
    super(respuesta.mensaje)
  }
}

/** Llama a la Edge Function y normaliza la respuesta (éxito o error con mensaje). */
async function enviar(solicitud: SolicitudEnvio): Promise<RespuestaEnvio> {
  const { data, error } = await supabase.functions.invoke<RespuestaEnvio>('enviar-publicacion', {
    body: solicitud,
  })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const cuerpo = (await (error.context as Response)
        .json()
        .catch(() => null)) as RespuestaEnvio | null
      if (cuerpo?.mensaje) throw new ErrorEnvio(cuerpo)
    }
    throw new ErrorEnvio({ codigo: 'error', mensaje: mensajeError(error) })
  }
  return data!
}

export function useEnviarPublicacion() {
  return useMutation({ mutationFn: enviar })
}

export async function guardarAlias(usuarioId: string, alias: string) {
  const { error } = await supabase
    .from('perfiles')
    .update({ alias: alias || null })
    .eq('usuario_id', usuarioId)
  if (error) throw error
}

const CLAVE_ALIAS = 'muro-rally:alias'

/** El alias se recuerda en este dispositivo para no pedirlo en cada envío. */
export const aliasRecordado = {
  leer(): string {
    try {
      return localStorage.getItem(CLAVE_ALIAS) ?? ''
    } catch {
      return ''
    }
  },
  guardar(alias: string) {
    try {
      localStorage.setItem(CLAVE_ALIAS, alias)
    } catch {
      // almacenamiento no disponible (modo privado): no pasa nada
    }
  },
}
