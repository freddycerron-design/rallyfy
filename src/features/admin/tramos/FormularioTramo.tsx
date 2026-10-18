import { Suspense, useMemo, useState } from 'react'
import { MapaTrazados } from '@/components/mapa'
import { Aviso, Boton, Campo, Cargando, Tarjeta } from '@/components/ui'
import { mensajeError } from '@/lib/errores'
import { useCrearTramo } from '../api'
import { deInputLocal } from '@/lib/formato'
import { aEwkt, ErrorTrazado, invertir, parsearTrazado, type Trazado } from './trazado'

type Props = { eventoId: string; ordenSugerido: number }

export function FormularioTramo({ eventoId, ordenSugerido }: Props) {
  const crear = useCrearTramo()
  const [trazado, setTrazado] = useState<Trazado | null>(null)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [orden, setOrden] = useState<number | ''>('')
  const [hora, setHora] = useState('')
  const [claveArchivo, setClaveArchivo] = useState(0)

  const lineas = useMemo(
    () => (trazado ? [{ id: 'vista-previa', coordenadas: trazado.coordenadas }] : []),
    [trazado],
  )

  async function leerArchivo(archivo: File | undefined) {
    setTrazado(null)
    setErrorArchivo(null)
    crear.reset()
    if (!archivo) return
    setNombreArchivo(archivo.name)
    try {
      const t = parsearTrazado(archivo.name, await archivo.text())
      setTrazado(t)
      if (!nombre) setNombre(archivo.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErrorArchivo(e instanceof ErrorTrazado ? e.message : 'No se pudo leer el archivo.')
    }
  }

  function limpiar() {
    setTrazado(null)
    setCodigo('')
    setNombre('')
    setOrden('')
    setHora('')
    setNombreArchivo('')
    setClaveArchivo((k) => k + 1)
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!trazado) return
    crear.mutate(
      {
        evento_id: eventoId,
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        orden: orden === '' ? ordenSugerido : orden,
        trazado: aEwkt(trazado.coordenadas),
        hora_inicio_prevista: deInputLocal(hora),
      },
      { onSuccess: limpiar },
    )
  }

  return (
    <Tarjeta>
      <h2 className="mb-1 text-lg font-semibold">Agregar tramo</h2>
      <p className="mb-3 text-sm text-gray-600">
        Sube un archivo GPX, KML o GeoJSON con el trazado de un tramo.
      </p>

      <form onSubmit={enviar} className="space-y-4">
        <Campo
          key={claveArchivo}
          etiqueta="Archivo del trazado"
          type="file"
          accept=".gpx,.kml,.geojson,.json"
          className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:font-medium"
          onChange={(e) => leerArchivo(e.target.files?.[0])}
        />

        {errorArchivo && <Aviso tipo="error">{errorArchivo}</Aviso>}

        {trazado && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              <strong>{nombreArchivo}</strong>: {trazado.coordenadas.length} puntos ·{' '}
              {trazado.longitudKm.toFixed(2)} km
            </p>
            {trazado.advertencias.map((a) => (
              <Aviso key={a} tipo="advertencia">
                {a}
              </Aviso>
            ))}
            <Suspense fallback={<Cargando texto="Cargando mapa…" />}>
              <MapaTrazados lineas={lineas} marcarExtremos />
            </Suspense>
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-gray-700">
                El km 0 es la <strong className="text-green-700">largada</strong>. ¿Está del lado
                correcto?
              </p>
              <Boton
                variante="secundario"
                onClick={() =>
                  setTrazado((t) => t && { ...t, coordenadas: invertir(t.coordenadas) })
                }
              >
                Invertir sentido
              </Boton>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo
            etiqueta="Código"
            required
            maxLength={12}
            placeholder="TC1"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Campo
              etiqueta="Nombre"
              required
              maxLength={120}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <Campo
            etiqueta="Orden"
            type="number"
            min={1}
            placeholder={String(ordenSugerido)}
            value={orden}
            onChange={(e) => setOrden(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <div className="sm:col-span-2">
            <Campo
              etiqueta="Largada prevista (opcional)"
              type="datetime-local"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        {crear.isError && <Aviso tipo="error">{mensajeError(crear.error)}</Aviso>}
        {crear.isSuccess && <Aviso tipo="exito">Tramo guardado.</Aviso>}

        <Boton type="submit" disabled={!trazado || crear.isPending}>
          {crear.isPending ? 'Guardando…' : 'Guardar tramo'}
        </Boton>
      </form>
    </Tarjeta>
  )
}
