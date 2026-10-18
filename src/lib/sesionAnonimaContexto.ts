import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/** Devuelve la sesión actual o crea una anónima (con Turnstile) si no hay ninguna. */
export type AsegurarSesion = () => Promise<Session>

export const SesionAnonimaContexto = createContext<AsegurarSesion | null>(null)

export function useAsegurarSesion(): AsegurarSesion {
  const asegurar = useContext(SesionAnonimaContexto)
  if (!asegurar) throw new Error('Falta <SesionAnonimaProvider>')
  return asegurar
}
