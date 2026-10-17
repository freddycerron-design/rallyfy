import { useState } from 'react'
import { Link } from 'react-router'
import { RutaProtegida } from '@/components/RutaProtegida'
import { Aviso, Boton, Campo, Cargando, Selector, Tarjeta } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import { useSesion } from '@/lib/sesion'
import type { RolUsuario } from '@/lib/tipos'
import { useCambiarRol, useEquipo } from './api'

export function PaginaEquipo() {
  return (
    <RutaProtegida rol="admin">
      <Equipo />
    </RutaProtegida>
  )
}

function Equipo() {
  const equipo = useEquipo()
  const cambiarRol = useCambiarRol()
  const sesion = useSesion()
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<RolUsuario>('moderador')

  function agregar(e: React.FormEvent) {
    e.preventDefault()
    cambiarRol.mutate({ email: email.trim(), rol }, { onSuccess: () => setEmail('') })
  }

  return (
    <section className="space-y-4">
      <Link to="/admin" className="text-sm font-medium text-marca-oscuro underline">
        ← Eventos
      </Link>
      <h1 className="text-2xl font-bold">Equipo</h1>

      <Tarjeta>
        <h2 className="mb-1 text-lg font-semibold">Agregar al equipo</h2>
        <p className="mb-3 text-sm text-gray-600">
          La persona debe haber iniciado sesión una vez con su correo (en Moderación o
          Administración) antes de asignarle un rol.
        </p>
        <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Campo
            etiqueta="Correo"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Selector
            etiqueta="Rol"
            value={rol}
            onChange={(e) => setRol(e.target.value as RolUsuario)}
          >
            <option value="moderador">Moderador</option>
            <option value="admin">Administrador</option>
          </Selector>
          <Boton type="submit" disabled={cambiarRol.isPending}>
            Asignar
          </Boton>
        </form>
      </Tarjeta>

      {cambiarRol.isError && <Aviso tipo="error">{mensajeError(cambiarRol.error)}</Aviso>}
      {equipo.isPending && <Cargando />}
      {equipo.isError && <Aviso tipo="error">{mensajeError(equipo.error)}</Aviso>}

      <ul className="space-y-2">
        {equipo.data?.map((m) => {
          const soyYo = m.usuario_id === sesion?.user.id
          return (
            <li key={m.usuario_id}>
              <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {m.email} {soyYo && <span className="text-gray-500">(tú)</span>}
                  </p>
                  <p className="text-sm text-gray-600">
                    {m.rol === 'admin' ? 'Administrador' : 'Moderador'}
                    {m.alias && ` · ${m.alias}`}
                  </p>
                </div>
                {!soyYo && (
                  <Boton
                    variante="peligro"
                    disabled={cambiarRol.isPending}
                    onClick={() => {
                      if (confirm(`¿Quitar a ${m.email} del equipo?`)) {
                        cambiarRol.mutate({ email: m.email, rol: 'aficionado' })
                      }
                    }}
                  >
                    Quitar
                  </Boton>
                )}
              </Tarjeta>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
