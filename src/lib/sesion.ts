import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { RolUsuario } from './tipos'

/** Sesión actual de Supabase Auth. `undefined` mientras se lee. */
export function useSesion(): Session | null | undefined {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    let activo = true
    supabase.auth.getSession().then(({ data }) => {
      if (activo) setSesion(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva))
    return () => {
      activo = false
      data.subscription.unsubscribe()
    }
  }, [])

  return sesion
}

export type Perfil = { usuario_id: string; alias: string | null; rol: RolUsuario }

/** Perfil (alias y rol) del usuario con sesión. */
export function usePerfil(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ['perfil', usuarioId],
    enabled: !!usuarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('usuario_id, alias, rol')
        .eq('usuario_id', usuarioId!)
        .single()
      if (error) throw error
      return data as Perfil
    },
  })
}

const jerarquia: Record<RolUsuario, number> = { aficionado: 0, moderador: 1, admin: 2 }

export const tieneRol = (rol: RolUsuario | undefined, minimo: RolUsuario) =>
  rol !== undefined && jerarquia[rol] >= jerarquia[minimo]
