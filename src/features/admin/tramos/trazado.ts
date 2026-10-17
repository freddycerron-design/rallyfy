import { gpx, kml } from '@tmcw/togeojson'
import type { Feature, Geometry, Position } from 'geojson'
import { type Coordenada, distanciaM } from '@/lib/geo'

export { type Coordenada, distanciaM }

export type Trazado = {
  coordenadas: Coordenada[]
  longitudKm: number
  advertencias: string[]
}

export class ErrorTrazado extends Error {}

const SALTO_ADVERTENCIA_M = 200

/**
 * Lee un archivo GPX, KML o GeoJSON y devuelve un único trazado.
 * Si trae varios segmentos o trazados, los une en el orden del archivo.
 */
export function parsearTrazado(nombreArchivo: string, contenido: string): Trazado {
  const segmentos = extraerSegmentos(nombreArchivo, contenido)
  if (segmentos.length === 0) {
    throw new ErrorTrazado('El archivo no tiene ninguna línea (track, ruta o LineString).')
  }

  const advertencias: string[] = []
  if (segmentos.length > 1) {
    advertencias.push(`El archivo tiene ${segmentos.length} segmentos; se unieron en orden.`)
  }

  const coordenadas: Coordenada[] = []
  for (const segmento of segmentos) {
    const anterior = coordenadas.at(-1)
    const primero = segmento[0]
    if (anterior && primero) {
      const salto = distanciaM(anterior, primero)
      if (salto > SALTO_ADVERTENCIA_M) {
        advertencias.push(
          `Hay un salto de ${Math.round(salto)} m entre segmentos. Revisa que el orden sea correcto.`,
        )
      }
    }
    for (const punto of segmento) {
      const ultimo = coordenadas.at(-1)
      if (!ultimo || ultimo[0] !== punto[0] || ultimo[1] !== punto[1]) coordenadas.push(punto)
    }
  }

  if (coordenadas.length < 2) {
    throw new ErrorTrazado('El trazado necesita al menos 2 puntos distintos.')
  }

  return { coordenadas, longitudKm: longitudKm(coordenadas), advertencias }
}

function extraerSegmentos(nombreArchivo: string, contenido: string): Coordenada[][] {
  const extension = nombreArchivo.toLowerCase().split('.').pop()
  let features: Feature<Geometry | null>[]

  if (extension === 'gpx' || extension === 'kml') {
    const documento = new DOMParser().parseFromString(contenido, 'text/xml')
    if (documento.getElementsByTagName('parsererror').length > 0) {
      throw new ErrorTrazado(`El archivo ${extension.toUpperCase()} no es XML válido.`)
    }
    features = (extension === 'gpx' ? gpx(documento) : kml(documento)).features
  } else if (extension === 'geojson' || extension === 'json') {
    let datos: unknown
    try {
      datos = JSON.parse(contenido)
    } catch {
      throw new ErrorTrazado('El archivo GeoJSON no es JSON válido.')
    }
    features = featuresDeGeoJson(datos)
  } else {
    throw new ErrorTrazado('Formato no soportado. Usa un archivo .gpx, .kml o .geojson.')
  }

  return features.flatMap((f) => (f.geometry ? lineasDeGeometria(f.geometry) : []))
}

function featuresDeGeoJson(datos: unknown): Feature<Geometry | null>[] {
  if (!datos || typeof datos !== 'object' || !('type' in datos)) {
    throw new ErrorTrazado('El archivo no es GeoJSON.')
  }
  const tipo = (datos as { type: string }).type
  if (tipo === 'FeatureCollection')
    return (datos as unknown as { features: Feature<Geometry | null>[] }).features
  if (tipo === 'Feature') return [datos as Feature<Geometry | null>]
  return [{ type: 'Feature', properties: {}, geometry: datos as Geometry }]
}

function lineasDeGeometria(geometria: Geometry): Coordenada[][] {
  switch (geometria.type) {
    case 'LineString':
      return [normalizar(geometria.coordinates)]
    case 'MultiLineString':
      return geometria.coordinates.map(normalizar)
    case 'GeometryCollection':
      return geometria.geometries.flatMap(lineasDeGeometria)
    default:
      return []
  }
}

/** Descarta altura y tiempo, y redondea a 6 decimales (~10 cm). */
function normalizar(posiciones: Position[]): Coordenada[] {
  return posiciones
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [redondear(p[0]!), redondear(p[1]!)])
}

const redondear = (n: number) => Math.round(n * 1e6) / 1e6

export function invertir(coordenadas: Coordenada[]): Coordenada[] {
  return [...coordenadas].reverse()
}

/** Geometría para PostGIS: el campo `trazado` acepta EWKT. */
export function aEwkt(coordenadas: Coordenada[]): string {
  return `SRID=4326;LINESTRING(${coordenadas.map(([lon, lat]) => `${lon} ${lat}`).join(',')})`
}

export function longitudKm(coordenadas: Coordenada[]): number {
  let total = 0
  for (let i = 1; i < coordenadas.length; i++)
    total += distanciaM(coordenadas[i - 1]!, coordenadas[i]!)
  return Math.round(total) / 1000
}
