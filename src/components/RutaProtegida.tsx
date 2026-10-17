import type { ReactNode } from 'react'
import { useState } from 'react'
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import { tieneRol, usePerfil, useSesion } from '@/lib/sesion'
import { supabase } from '@/lib/supabase'
import type { RolUsuario } from '@/lib/tipos'

const nombreRol: Record<RolUsuario, string> = {
  aficionado: 'aficionado',
  moderador: 'moderador',
  admin: 'administrador',
}

/**
 * Muestra `children` solo a quien tenga al menos `rol`. La seguridad real está en RLS;
 * esto solo evita mostrar pantallas que de todos modos fallarían.
 */
export function RutaProtegida({ rol, children }: { rol: RolUsuario; children: ReactNode }) {
  const sesion = useSesion()
  const esAnonima = sesion?.user.is_anonymous ?? false
  const perfil = usePerfil(sesion && !esAnonima ? sesion.user.id : undefined)

  if (sesion === undefined) return <Cargando />
  if (!sesion || esAnonima) return <FormularioLogin />
  if (perfil.isPending) return <Cargando texto="Verificando permisos…" />
  if (perfil.isError) return <Aviso tipo="error">{mensajeError(perfil.error)}</Aviso>

  if (!tieneRol(perfil.data.rol, rol)) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Sin permisos</h1>
        <p className="text-gray-600">
          Iniciaste sesión como <strong>{sesion.user.email}</strong>, pero esta sección es para{' '}
          {nombreRol[rol]}es. Pide a un administrador que te asigne el rol.
        </p>
        <Boton variante="secundario" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </Boton>
      </section>
    )
  }

  return children
}

function FormularioLogin() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'enviado'>('inicial')
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    })
    if (error) {
      setError(mensajeError(error))
      setEstado('inicial')
    } else {
      setEstado('enviado')
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Acceso para el equipo</h1>
      <p className="text-gray-600">
        Moderadores y administradores ingresan con un enlace que llega por correo.
      </p>
      <Tarjeta>
        {estado === 'enviado' ? (
          <Aviso tipo="exito">
            Te enviamos un enlace a <strong>{email}</strong>. Ábrelo en este mismo dispositivo.
          </Aviso>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <Campo
              etiqueta="Correo"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <Aviso tipo="error">{error}</Aviso>}
            <Boton type="submit" className="w-full" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}
            </Boton>
          </form>
        )}
      </Tarjeta>
    </section>
  )
}
