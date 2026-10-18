// Configuración común de MapLibre para los mapas de la app.
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, LineString } from 'geojson'
import { LngLatBounds, Map as MapLibre, NavigationControl, setWorkerUrl } from 'maplibre-gl'
// MapLibre busca su worker junto a su propio módulo, que deja de existir al empaquetar;
// Vite publica el archivo y le pasamos la URL.
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { env } from '@/lib/env'

setWorkerUrl(urlWorker)

export type LineaMapa = {
  id: string
  coordenadas: [number, number][]
  etiqueta?: string
}

export const FUENTE_TRAZADOS = 'trazados'

export function crearMapa(contenedor: HTMLElement): MapLibre {
  const m = new MapLibre({
    container: contenedor,
    style: env.estiloMapaUrl,
    center: [-64.5, -31.4],
    zoom: 9,
    attributionControl: { compact: true },
  })
  m.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  return m
}

/** Capas de los trazados (borde, línea y código del tramo). Llamar tras 'style.load'. */
export function agregarCapasTrazados(m: MapLibre) {
  m.addSource(FUENTE_TRAZADOS, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
  m.addLayer({
    id: 'trazados-borde',
    type: 'line',
    source: FUENTE_TRAZADOS,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#111827', 'line-width': 7 },
  })
  m.addLayer({
    id: 'trazados-linea',
    type: 'line',
    source: FUENTE_TRAZADOS,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#f59e0b', 'line-width': 4 },
  })
  m.addLayer({
    id: 'trazados-etiqueta',
    type: 'symbol',
    source: FUENTE_TRAZADOS,
    layout: {
      'symbol-placement': 'line-center',
      'text-field': ['get', 'etiqueta'],
      'text-size': 14,
      'text-font': ['Noto Sans Bold'],
    },
    paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
  })
}

export function datosTrazados(lineas: LineaMapa[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: lineas.map((l) => ({
      type: 'Feature',
      id: l.id,
      properties: { etiqueta: l.etiqueta ?? '' },
      geometry: { type: 'LineString', coordinates: l.coordenadas },
    })),
  }
}

/** Encuadra todas las coordenadas, con más margen abajo (ahí va la atribución). */
export function encuadrar(m: MapLibre, coordenadas: [number, number][]) {
  const primera = coordenadas[0]
  if (!primera) return
  const limites = coordenadas.reduce((b, c) => b.extend(c), new LngLatBounds(primera, primera))
  m.fitBounds(limites, {
    padding: { top: 50, right: 60, bottom: 80, left: 50 },
    maxZoom: 15,
    duration: 0,
  })
}
