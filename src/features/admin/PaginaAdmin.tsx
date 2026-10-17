import { useState } from 'react'
import { Link } from 'react-router'
import { RutaProtegida } from '@/components/RutaProtegida'
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import { supabase } from '@/lib/supabase'
import { useActivarEvento, useCrearEvento, useEventos } from './api'
import { formatearFecha } from './formato'

export function PaginaAdmin() {
  return (
    <RutaProtegida rol="admin">
      <Eventos />
    </RutaProtegida>
  )
}

function Eventos() {
  const eventos = useEventos()
  const activar = useActivarEvento()

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Administración</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/equipo"
            className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-medium"
          >
            Equipo
          </Link>
          <Boton variante="secundario" onClick={() => supabase.auth.signOut()}>
            Salir
          </Boton>
        </div>
      </header>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Eventos</h2>
        {eventos.isPending && <Cargando />}
        {eventos.isError && <Aviso tipo="error">{mensajeError(eventos.error)}</Aviso>}
        {activar.isError && <Aviso tipo="error">{mensajeError(activar.error)}</Aviso>}
        {eventos.data?.length === 0 && (
          <p className="text-gray-600">Todavía no hay eventos. Crea el primero abajo.</p>
        )}
        <ul className="space-y-3">
          {eventos.data?.map((ev) => (
            <li key={ev.id}>
              <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {ev.nombre}{' '}
                    {ev.activo && (
                      <span className="ml-1 rounded bg-green-100 px-2 py-0.5 text-sm text-green-800">
                        Activo
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatearFecha(ev.fecha_inicio)} – {formatearFecha(ev.fecha_fin)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {ev.activo ? (
                    <Boton
                      variante="secundario"
                      disabled={activar.isPending}
                      onClick={() => activar.mutate(null)}
                    >
                      Desactivar
                    </Boton>
                  ) : (
                    <Boton
                      variante="secundario"
                      disabled={activar.isPending}
                      onClick={() => activar.mutate(ev.id)}
                    >
                      Activar
                    </Boton>
                  )}
                  <Link
                    to={`/admin/evento/${ev.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg bg-tinta px-4 font-medium text-white"
                  >
                    Gestionar
                  </Link>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      </div>

      <FormularioEvento />
    </section>
  )
}

function FormularioEvento() {
  const crear = useCrearEvento()
  const [nombre, setNombre] = useState('')
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    crear.mutate(
      { nombre: nombre.trim(), fecha_inicio: inicio, fecha_fin: fin || inicio },
      {
        onSuccess: () => {
          setNombre('')
          setInicio('')
          setFin('')
        },
      },
    )
  }

  return (
    <Tarjeta>
      <h2 className="mb-3 text-lg font-semibold">Nuevo evento</h2>
      <form onSubmit={enviar} className="space-y-3">
        <Campo
          etiqueta="Nombre"
          required
          minLength={3}
          maxLength={120}
          placeholder="Rally de … · Fecha 3"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Desde"
            type="date"
            required
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
          <Campo
            etiqueta="Hasta"
            type="date"
            min={inicio}
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            ayuda="Vacío = el mismo día"
          />
        </div>
        {crear.isError && <Aviso tipo="error">{mensajeError(crear.error)}</Aviso>}
        <Boton type="submit" disabled={crear.isPending}>
          {crear.isPending ? 'Creando…' : 'Crear evento'}
        </Boton>
      </form>
    </Tarjeta>
  )
}
