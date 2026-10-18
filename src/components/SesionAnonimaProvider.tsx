import type { Session } from '@supabase/supabase-js'
import { type ReactNode, useCallback, useRef, useState } from 'react'
import { Turnstile } from '@/components/Turnstile'
import { SesionAnonimaContexto } from '@/lib/sesionAnonimaContexto'
import { supabase } from '@/lib/supabase'

type Espera = { resolver: (s: Session) => void; rechazar: (e: unknown) => void }

/**
 * Crea la sesión anónima recién cuando hace falta (por ejemplo, al votar), con un único
 * widget de Turnstile. Así quien solo mira el muro no genera usuarios ni consume captchas.
 */
export function SesionAnonimaProvider({ children }: { children: ReactNode }) {
  const [pidiendo, setPidiendo] = useState(false)
  const esperas = useRef<Espera[]>([])
  const creando = useRef(false)

  const asegurar = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
    return new Promise<Session>((resolver, rechazar) => {
      esperas.current.push({ resolver, rechazar })
      setPidiendo(true)
    })
  }, [])

  function terminar(resultado: { sesion: Session } | { error: unknown }) {
    const pendientes = esperas.current
    esperas.current = []
    setPidiendo(false)
    for (const e of pendientes) {
      if ('sesion' in resultado) e.resolver(resultado.sesion)
      else e.rechazar(resultado.error)
    }
  }

  async function alRecibirToken(token: string | null) {
    if (!token || creando.current) return
    creando.current = true
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { captchaToken: token },
    })
    creando.current = false
    if (error || !data.session) terminar({ error: error ?? new Error('No se pudo iniciar sesión') })
    else terminar({ sesion: data.session })
  }

  return (
    <SesionAnonimaContexto.Provider value={asegurar}>
      {children}
      {pidiendo && (
        // Casi siempre invisible: Cloudflare solo muestra algo si necesita un clic.
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center">
          <Turnstile
            alCambiarToken={alRecibirToken}
            alFallarCarga={(mensaje) => terminar({ error: new Error(mensaje) })}
          />
        </div>
      )}
    </SesionAnonimaContexto.Provider>
  )
}
