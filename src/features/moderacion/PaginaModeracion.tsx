import { useCallback, useEffect, useRef, useState } from 'react'
import { RutaProtegida } from '@/components/RutaProtegida'
import { Aviso, Boton, Cargando } from '@/components/ui'
import { useEventoActivo, useInscritosPublicos, useTramosPublicos } from '@/lib/consultasPublicas'
import { mensajeError } from '@/lib/errores'
import { supabase } from '@/lib/supabase'
import {
  type AccionModeracion,
  MOTIVOS,
  useColaEnTiempoReal,
  useEnVivoActivos,
  useModerar,
  usePendientes,
} from './api'
import { esCampoEditable, interpretarTecla, type ModoModeracion } from './atajos'
import { ListaCola } from './ListaCola'
import { SeccionEnVivo } from './SeccionEnVivo'
import { TarjetaPendiente } from './TarjetaPendiente'

export function PaginaModeracion() {
  return (
    <RutaProtegida rol="moderador">
      <Moderacion />
    </RutaProtegida>
  )
}

function Moderacion() {
  const evento = useEventoActivo()
  if (evento.isPending) return <Cargando />
  if (evento.isError) return <Aviso tipo="error">{mensajeError(evento.error)}</Aviso>
  if (!evento.data) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-bold">Moderación</h1>
        <p className="text-gray-600">No hay un evento activo.</p>
      </section>
    )
  }
  return <ColaModeracion eventoId={evento.data.id} nombreEvento={evento.data.nombre} />
}

function ColaModeracion({ eventoId, nombreEvento }: { eventoId: string; nombreEvento: string }) {
  const pendientes = usePendientes(eventoId)
  const enVivo = useEnVivoActivos(eventoId)
  const tramos = useTramosPublicos(eventoId)
  const inscritos = useInscritosPublicos(eventoId)
  const moderar = useModerar(eventoId)
  useColaEnTiempoReal(eventoId)

  const [seleccion, setSeleccion] = useState(0)
  const [modo, setModo] = useState<ModoModeracion>('normal')
  const [anuncio, setAnuncio] = useState('')
  const zonaPrincipal = useRef<HTMLDivElement>(null)

  const cola = pendientes.data ?? []
  const indice = Math.min(seleccion, Math.max(cola.length - 1, 0))
  const actual = cola[indice]

  const ejecutar = useCallback(
    (accion: AccionModeracion, id = actual?.id) => {
      if (!id) return
      moderar.mutate(
        { id, ...accion },
        {
          onSuccess: () => {
            setAnuncio(
              accion.accion === 'aprobar'
                ? 'Publicación aprobada'
                : accion.accion === 'rechazar'
                  ? 'Publicación rechazada'
                  : accion.accion === 'cerrar_en_vivo'
                    ? 'Transmisión cerrada'
                    : 'Corrección guardada',
            )
            setModo('normal')
            zonaPrincipal.current?.focus()
          },
        },
      )
    },
    [actual?.id, moderar],
  )

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || esCampoEditable(e.target)) return
      const comando = interpretarTecla(e.key, modo)
      if (!comando) return
      e.preventDefault()
      switch (comando.tipo) {
        case 'aprobar':
          return ejecutar({ accion: 'aprobar' })
        case 'abrir_rechazo':
          return actual && setModo('rechazo')
        case 'rechazar':
          return ejecutar({ accion: 'rechazar', motivo: comando.motivo })
        case 'corregir':
          return actual && setModo('corrigiendo')
        case 'siguiente':
          return setSeleccion(Math.min(indice + 1, cola.length - 1))
        case 'anterior':
          return setSeleccion(Math.max(indice - 1, 0))
        case 'cancelar':
          return setModo('normal')
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [modo, ejecutar, actual, indice, cola.length])

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Moderación</h1>
          <p className="text-gray-600">
            {nombreEvento} ·{' '}
            <strong>
              {cola.length} pendiente{cola.length === 1 ? '' : 's'}
            </strong>
          </p>
        </div>
        <Boton variante="secundario" onClick={() => supabase.auth.signOut()}>
          Salir
        </Boton>
      </header>

      <p className="hidden text-sm text-gray-500 md:block">
        Atajos: <kbd>A</kbd> aprobar · <kbd>R</kbd> rechazar (luego <kbd>1</kbd>–<kbd>5</kbd>) ·{' '}
        <kbd>E</kbd> corregir · <kbd>J</kbd>/<kbd>K</kbd> moverse · <kbd>Esc</kbd> cancelar
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>

      {pendientes.isPending && <Cargando />}
      {pendientes.isError && <Aviso tipo="error">{mensajeError(pendientes.error)}</Aviso>}
      {moderar.isError && <Aviso tipo="error">{mensajeError(moderar.error)}</Aviso>}

      {pendientes.isSuccess && cola.length === 0 && (
        <Aviso tipo="exito">¡Cola vacía! Las nuevas publicaciones aparecerán solas.</Aviso>
      )}

      {actual && (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div ref={zonaPrincipal} tabIndex={-1} className="outline-none">
            <TarjetaPendiente
              key={actual.id}
              publicacion={actual}
              tramos={tramos.data ?? []}
              inscritos={inscritos.data ?? []}
              modo={modo}
              ocupado={moderar.isPending}
              alCambiarModo={setModo}
              alEjecutar={ejecutar}
              motivos={MOTIVOS}
            />
          </div>
          <ListaCola
            cola={cola}
            indice={indice}
            tramos={tramos.data ?? []}
            alElegir={(i) => {
              setSeleccion(i)
              setModo('normal')
            }}
          />
        </div>
      )}

      {!!enVivo.data?.length && (
        <SeccionEnVivo
          transmisiones={enVivo.data}
          tramos={tramos.data ?? []}
          ocupado={moderar.isPending}
          alCerrar={(id) => ejecutar({ accion: 'cerrar_en_vivo' }, id)}
        />
      )}
    </section>
  )
}
