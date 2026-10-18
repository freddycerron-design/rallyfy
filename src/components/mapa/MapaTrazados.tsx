import { type GeoJSONSource, type Map as MapLibre, Marker } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import {
  agregarCapasTrazados,
  crearMapa,
  datosTrazados,
  encuadrar,
  FUENTE_TRAZADOS,
  type LineaMapa,
} from './base'

export type { LineaMapa }

type Props = {
  lineas: LineaMapa[]
  /** Marca la largada y la llegada de cada línea. */
  marcarExtremos?: boolean
  /** Punto a destacar (por ejemplo, la ubicación elegida por el aficionado). */
  punto?: [number, number] | null
  /** Si se pasa, tocar el mapa devuelve la coordenada [lon, lat]. */
  alTocar?: (coordenada: [number, number]) => void
  className?: string
}

/**
 * Mapa con uno o más trazados. Se carga de forma diferida (React.lazy) porque
 * MapLibre pesa ~800 kB y solo lo necesitan algunas pantallas.
 */
export default function MapaTrazados({
  lineas,
  marcarExtremos = false,
  punto = null,
  alTocar,
  className = '',
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibre | null>(null)
  const marcadores = useRef<Marker[]>([])
  const marcadorPunto = useRef<Marker | null>(null)
  const alTocarActual = useRef(alTocar)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    alTocarActual.current = alTocar
  })

  useEffect(() => {
    if (!contenedor.current) return
    const m = crearMapa(contenedor.current)
    m.on('click', (e) => alTocarActual.current?.([e.lngLat.lng, e.lngLat.lat]))
    // 'style.load' y no 'load': no hace falta esperar las teselas para dibujar el trazado.
    m.once('style.load', () => {
      agregarCapasTrazados(m)
      setListo(true)
    })
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      setListo(false)
    }
  }, [])

  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    m.getSource<GeoJSONSource>(FUENTE_TRAZADOS)?.setData(datosTrazados(lineas))

    marcadores.current.forEach((mk) => mk.remove())
    marcadores.current = []
    if (marcarExtremos) {
      for (const l of lineas) {
        const inicio = l.coordenadas[0]
        const fin = l.coordenadas.at(-1)
        if (inicio) marcadores.current.push(etiqueta(inicio, 'Largada', '#15803d').addTo(m))
        if (fin) marcadores.current.push(etiqueta(fin, 'Llegada', '#b91c1c').addTo(m))
      }
    }
    encuadrar(
      m,
      lineas.flatMap((l) => l.coordenadas),
    )
  }, [lineas, marcarExtremos, listo])

  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    marcadorPunto.current?.remove()
    marcadorPunto.current = punto
      ? new Marker({ color: '#2563eb' }).setLngLat(punto).addTo(m)
      : null
  }, [punto, listo])

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa de trazados"
      className={`h-72 w-full overflow-hidden rounded-xl border border-gray-200 ${alTocar ? 'cursor-crosshair' : ''} ${className}`}
    />
  )
}

function etiqueta(posicion: [number, number], texto: string, color: string) {
  const el = document.createElement('div')
  el.textContent = texto
  el.style.cssText = `background:${color};color:#fff;font:600 12px system-ui;padding:2px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.3)`
  return new Marker({ element: el, anchor: 'bottom', offset: [0, -4] }).setLngLat(posicion)
}
