import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString } from 'geojson'
import {
  type GeoJSONSource,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl'
// MapLibre busca su worker junto a su propio módulo, que deja de existir al empaquetar;
// Vite publica el archivo y le pasamos la URL.
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { env } from '@/lib/env'

export type LineaMapa = {
  id: string
  coordenadas: [number, number][]
  etiqueta?: string
}

type Props = {
  lineas: LineaMapa[]
  /** Marca la largada y la llegada de cada línea. */
  marcarExtremos?: boolean
  className?: string
}

const FUENTE = 'trazados'

setWorkerUrl(urlWorker)

/**
 * Mapa con uno o más trazados. Se carga de forma diferida (React.lazy) porque
 * MapLibre pesa ~800 kB y solo lo necesitan algunas pantallas.
 */
export default function MapaTrazados({ lineas, marcarExtremos = false, className = '' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibre | null>(null)
  const marcadores = useRef<Marker[]>([])
  const [listo, setListo] = useState(false)

  useEffect(() => {
    if (!contenedor.current) return
    const m = new MapLibre({
      container: contenedor.current,
      style: env.estiloMapaUrl,
      center: [-64.5, -31.4],
      zoom: 9,
      attributionControl: { compact: true },
    })
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    // 'style.load' y no 'load': no hace falta esperar las teselas para dibujar el trazado.
    m.once('style.load', () => {
      m.addSource(FUENTE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: 'trazados-borde',
        type: 'line',
        source: FUENTE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#111827', 'line-width': 7 },
      })
      m.addLayer({
        id: 'trazados-linea',
        type: 'line',
        source: FUENTE,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f59e0b', 'line-width': 4 },
      })
      m.addLayer({
        id: 'trazados-etiqueta',
        type: 'symbol',
        source: FUENTE,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'etiqueta'],
          'text-size': 14,
          'text-font': ['Noto Sans Bold'],
        },
        paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      })
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

    const datos: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: lineas.map((l) => ({
        type: 'Feature',
        id: l.id,
        properties: { etiqueta: l.etiqueta ?? '' },
        geometry: { type: 'LineString', coordinates: l.coordenadas },
      })),
    }
    m.getSource<GeoJSONSource>(FUENTE)?.setData(datos)

    marcadores.current.forEach((mk) => mk.remove())
    marcadores.current = []
    if (marcarExtremos) {
      for (const l of lineas) {
        const inicio = l.coordenadas[0]
        const fin = l.coordenadas.at(-1)
        if (inicio) marcadores.current.push(marcador(inicio, 'Largada', '#15803d').addTo(m))
        if (fin) marcadores.current.push(marcador(fin, 'Llegada', '#b91c1c').addTo(m))
      }
    }

    const todos = lineas.flatMap((l) => l.coordenadas)
    if (todos.length > 0) {
      const limites = todos.reduce((b, c) => b.extend(c), new LngLatBounds(todos[0], todos[0]))
      // Más margen abajo: ahí va la atribución del mapa.
      m.fitBounds(limites, {
        padding: { top: 50, right: 60, bottom: 80, left: 50 },
        maxZoom: 15,
        duration: 0,
      })
    }
  }, [lineas, marcarExtremos, listo])

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa de trazados"
      className={`h-72 w-full overflow-hidden rounded-xl border border-gray-200 ${className}`}
    />
  )
}

function marcador(posicion: [number, number], texto: string, color: string) {
  const el = document.createElement('div')
  el.textContent = texto
  el.style.cssText = `background:${color};color:#fff;font:600 12px system-ui;padding:2px 6px;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.3)`
  return new Marker({ element: el, anchor: 'bottom', offset: [0, -4] }).setLngLat(posicion)
}
