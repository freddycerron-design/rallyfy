import type { FeatureCollection, Point } from 'geojson'
import {
  type GeoJSONSource,
  type Map as MapLibre,
  type MapLayerMouseEvent,
  Marker,
} from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import {
  agregarCapasTrazados,
  crearMapa,
  datosTrazados,
  encuadrar,
  FUENTE_TRAZADOS,
  type LineaMapa,
} from './mapaBase'

export type PinMapa = { id: string; lon: number; lat: number }
/** Autos en un mismo punto (aparecen juntos en el mismo video) van en un solo marcador. */
export type AutoMapa = { numeros: number[]; lon: number; lat: number }

type Props = {
  lineas: LineaMapa[]
  /** Publicaciones aprobadas; se agrupan cuando se superponen (clustering). */
  pines: PinMapa[]
  /** Modo "último visto": un marcador por auto en su último km conocido. */
  autos: AutoMapa[] | null
  alElegirPin: (id: string) => void
  alElegirAutos: (numeros: number[]) => void
}

const FUENTE_PINES = 'publicaciones'

/** Mapa del evento: trazados, pines de publicaciones y "último visto" (spec §7.3). */
export default function MapaEvento({ lineas, pines, autos, alElegirPin, alElegirAutos }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapLibre | null>(null)
  const marcadoresAutos = useRef<Marker[]>([])
  const callbacks = useRef({ alElegirPin, alElegirAutos })
  const encuadrado = useRef(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    callbacks.current = { alElegirPin, alElegirAutos }
  })

  useEffect(() => {
    if (!contenedor.current) return
    const m = crearMapa(contenedor.current)
    m.once('style.load', () => {
      agregarCapasTrazados(m)
      m.addSource(FUENTE_PINES, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 40,
        clusterMaxZoom: 15,
      })
      m.addLayer({
        id: 'grupos',
        type: 'circle',
        source: FUENTE_PINES,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#111827',
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
          'circle-stroke-color': '#f59e0b',
          'circle-stroke-width': 3,
        },
      })
      m.addLayer({
        id: 'grupos-cantidad',
        type: 'symbol',
        source: FUENTE_PINES,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 13,
          'text-font': ['Noto Sans Bold'],
        },
        paint: { 'text-color': '#ffffff' },
      })
      m.addLayer({
        id: 'pines',
        type: 'circle',
        source: FUENTE_PINES,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#f59e0b',
          'circle-radius': 9,
          'circle-stroke-color': '#111827',
          'circle-stroke-width': 2,
        },
      })

      m.on('click', 'pines', (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') callbacks.current.alElegirPin(id)
      })
      m.on('click', 'grupos', async (e: MapLayerMouseEvent) => {
        const grupo = e.features?.[0]
        const fuente = m.getSource<GeoJSONSource>(FUENTE_PINES)
        if (!grupo || !fuente) return
        const zoom = await fuente.getClusterExpansionZoom(grupo.properties.cluster_id as number)
        m.easeTo({ center: (grupo.geometry as Point).coordinates as [number, number], zoom })
      })
      for (const capa of ['pines', 'grupos']) {
        m.on('mouseenter', capa, () => (m.getCanvas().style.cursor = 'pointer'))
        m.on('mouseleave', capa, () => (m.getCanvas().style.cursor = ''))
      }
      setListo(true)
    })
    mapa.current = m
    return () => {
      m.remove()
      mapa.current = null
      setListo(false)
    }
  }, [])

  // Trazados: se encuadran una sola vez para no mover el mapa en cada actualización.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    m.getSource<GeoJSONSource>(FUENTE_TRAZADOS)?.setData(datosTrazados(lineas))
    if (!encuadrado.current && lineas.length > 0) {
      encuadrar(
        m,
        lineas.flatMap((l) => l.coordenadas),
      )
      encuadrado.current = true
    }
  }, [lineas, listo])

  // Pines de publicaciones (ocultos en modo "último visto").
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    const datos: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: (autos ? [] : pines).map((p) => ({
        type: 'Feature',
        properties: { id: p.id },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      })),
    }
    m.getSource<GeoJSONSource>(FUENTE_PINES)?.setData(datos)
  }, [pines, autos, listo])

  // "Último visto": marcadores HTML con el número del auto.
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    marcadoresAutos.current.forEach((mk) => mk.remove())
    marcadoresAutos.current = (autos ?? []).map((a) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.textContent = a.numeros.join(' · ')
      el.setAttribute(
        'aria-label',
        a.numeros.length === 1 ? `Auto ${a.numeros[0]}` : `Autos ${a.numeros.join(', ')}`,
      )
      el.style.cssText =
        'min-width:32px;height:32px;padding:0 6px;border-radius:8px;border:2px solid #111827;background:#f59e0b;color:#111827;font:700 14px system-ui;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.35)'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        callbacks.current.alElegirAutos(a.numeros)
      })
      return new Marker({ element: el }).setLngLat([a.lon, a.lat]).addTo(m)
    })
  }, [autos, listo])

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa del evento"
      className="h-[60vh] min-h-80 w-full overflow-hidden rounded-xl border border-gray-200"
    />
  )
}
