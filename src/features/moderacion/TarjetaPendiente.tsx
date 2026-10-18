import { useState } from 'react'
import { SelectorAutos } from '@/components/SelectorAutos'
import { Boton, Selector, Tarjeta } from '@/components/ui'
import { Video } from '@/components/video/Video'
import type { InscritoPublico } from '@/lib/consultasPublicas'
import type { TramoPublico } from '@/lib/tipos'
import type { AccionModeracion, MOTIVOS, Pendiente } from './api'
import type { ModoModeracion } from './atajos'
import { Alertas } from './Alertas'
import { horaCorta } from '@/lib/formato'

type Props = {
  publicacion: Pendiente
  tramos: TramoPublico[]
  inscritos: InscritoPublico[]
  modo: ModoModeracion
  ocupado: boolean
  motivos: typeof MOTIVOS
  alCambiarModo: (modo: ModoModeracion) => void
  alEjecutar: (accion: AccionModeracion) => void
}

export function TarjetaPendiente({
  publicacion: p,
  tramos,
  inscritos,
  modo,
  ocupado,
  motivos,
  alCambiarModo,
  alEjecutar,
}: Props) {
  const tramo = tramos.find((t) => t.id === p.tramo_id)

  return (
    <Tarjeta className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Video
          plataforma={p.plataforma}
          idExterno={p.id_externo}
          esEnVivo={p.es_en_vivo}
          urlCanonica={p.url_canonica}
          titulo={p.titulo}
          autor={p.autor}
          cargarDeEntrada
        />

        <dl className="space-y-2 text-sm">
          <Dato titulo="Tramo">
            {tramo ? `${tramo.codigo} · ${tramo.nombre}` : '—'}
            {p.km_en_tramo != null && (
              <strong className="ml-1">km {Number(p.km_en_tramo).toFixed(1)}</strong>
            )}
          </Dato>
          <Dato titulo="Autos">
            {p.autos.length ? p.autos.map((a) => `#${a}`).join(', ') : 'ninguno indicado'}
          </Dato>
          <Dato titulo="Enviado">{horaCorta(p.creado_en)}</Dato>
          {p.titulo && <Dato titulo="Título">{p.titulo}</Dato>}
          {p.autor && <Dato titulo="Autor">{p.autor}</Dato>}
          <Dato titulo="Original">
            <a
              href={p.url_canonica}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-marca-oscuro underline"
            >
              Abrir en {p.plataforma === 'youtube' ? 'YouTube' : 'TikTok'} ↗
            </a>
          </Dato>
          <Alertas publicacion={p} />
        </dl>
      </div>

      {modo === 'rechazo' ? (
        <div className="space-y-2" role="group" aria-label="Motivo de rechazo">
          <p className="font-medium">¿Por qué se rechaza?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {motivos.map((m, i) => (
              <Boton
                key={m.valor}
                variante="peligro"
                disabled={ocupado}
                onClick={() => alEjecutar({ accion: 'rechazar', motivo: m.valor })}
              >
                <kbd className="mr-2 text-xs">{i + 1}</kbd> {m.texto}
              </Boton>
            ))}
          </div>
          <Boton variante="secundario" onClick={() => alCambiarModo('normal')}>
            Cancelar (Esc)
          </Boton>
        </div>
      ) : modo === 'corrigiendo' ? (
        <FormularioCorreccion
          publicacion={p}
          tramos={tramos}
          inscritos={inscritos}
          ocupado={ocupado}
          alCancelar={() => alCambiarModo('normal')}
          alGuardar={(accion) => alEjecutar(accion)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="exito"
            className="flex-1"
            disabled={ocupado}
            onClick={() => alEjecutar({ accion: 'aprobar' })}
          >
            Aprobar <kbd className="ml-2 text-xs opacity-80">A</kbd>
          </Boton>
          <Boton variante="peligro" className="flex-1" onClick={() => alCambiarModo('rechazo')}>
            Rechazar <kbd className="ml-2 text-xs opacity-80">R</kbd>
          </Boton>
          <Boton variante="secundario" onClick={() => alCambiarModo('corrigiendo')}>
            Corregir <kbd className="ml-2 text-xs opacity-80">E</kbd>
          </Boton>
        </div>
      )}
    </Tarjeta>
  )
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-gray-500">{titulo}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function FormularioCorreccion({
  publicacion,
  tramos,
  inscritos,
  ocupado,
  alCancelar,
  alGuardar,
}: {
  publicacion: Pendiente
  tramos: TramoPublico[]
  inscritos: InscritoPublico[]
  ocupado: boolean
  alCancelar: () => void
  alGuardar: (accion: AccionModeracion) => void
}) {
  const [tramoId, setTramoId] = useState(publicacion.tramo_id)
  const [autos, setAutos] = useState(publicacion.autos)
  const cambios = {
    tramoId: tramoId !== publicacion.tramo_id ? tramoId : undefined,
    autos,
  }

  return (
    <div className="space-y-3 rounded-lg bg-gray-50 p-3">
      <Selector etiqueta="Tramo" value={tramoId} onChange={(e) => setTramoId(e.target.value)}>
        {tramos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} · {t.nombre}
          </option>
        ))}
      </Selector>
      <SelectorAutos inscritos={inscritos} seleccionados={autos} alCambiar={setAutos} />
      <p className="text-sm text-gray-600">
        Al cambiar de tramo, el km se recalcula sobre el nuevo trazado.
      </p>
      <div className="flex flex-wrap gap-2">
        <Boton
          variante="exito"
          disabled={ocupado}
          onClick={() => alGuardar({ accion: 'aprobar', ...cambios })}
        >
          Corregir y aprobar
        </Boton>
        <Boton
          variante="secundario"
          disabled={ocupado}
          onClick={() => alGuardar({ accion: 'corregir', ...cambios })}
        >
          Solo corregir
        </Boton>
        <Boton variante="secundario" onClick={alCancelar}>
          Cancelar (Esc)
        </Boton>
      </div>
    </div>
  )
}
