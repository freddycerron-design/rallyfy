import { describe, expect, it } from 'vitest'
import { aEwkt, distanciaM, ErrorTrazado, invertir, parsearTrazado } from './trazado'

const gpxDosSegmentos = `<?xml version="1.0"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>TC1</name>
    <trkseg>
      <trkpt lat="-31.4" lon="-64.6"><ele>800</ele></trkpt>
      <trkpt lat="-31.39" lon="-64.6"><ele>810</ele></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="-31.39" lon="-64.6"></trkpt>
      <trkpt lat="-31.38" lon="-64.6"></trkpt>
    </trkseg>
  </trk>
</gpx>`

const kmlSimple = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>Largada</name><Point><coordinates>-64.6,-31.4,0</coordinates></Point></Placemark>
  <Placemark><name>TC2</name><LineString>
    <coordinates>-64.7,-31.3,0 -64.71,-31.31,0 -64.72,-31.32,0</coordinates>
  </LineString></Placemark>
</Document></kml>`

describe('parsearTrazado', () => {
  it('lee GPX, une segmentos, quita la altura y los puntos repetidos', () => {
    const t = parsearTrazado('tc1.GPX', gpxDosSegmentos)
    expect(t.coordenadas).toEqual([
      [-64.6, -31.4],
      [-64.6, -31.39],
      [-64.6, -31.38],
    ])
    expect(t.advertencias).toEqual(['El archivo tiene 2 segmentos; se unieron en orden.'])
    expect(t.longitudKm).toBeCloseTo(2.224, 2)
  })

  it('lee KML e ignora los puntos sueltos', () => {
    const t = parsearTrazado('tc2.kml', kmlSimple)
    expect(t.coordenadas).toHaveLength(3)
    expect(t.coordenadas[0]).toEqual([-64.7, -31.3])
    expect(t.advertencias).toEqual([])
  })

  it('lee GeoJSON (FeatureCollection, Feature o geometría sola)', () => {
    const linea = {
      type: 'LineString',
      coordinates: [
        [-64, -31],
        [-64, -30.9],
      ],
    }
    const fc = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: linea }],
    }
    expect(parsearTrazado('a.geojson', JSON.stringify(fc)).coordenadas).toHaveLength(2)
    expect(parsearTrazado('a.json', JSON.stringify(linea)).coordenadas).toHaveLength(2)
  })

  it('avisa si hay un salto grande entre segmentos', () => {
    const multi = {
      type: 'MultiLineString',
      coordinates: [
        [
          [-64, -31],
          [-64, -30.99],
        ],
        [
          [-64, -30.98],
          [-64, -30.97],
        ],
      ],
    }
    const t = parsearTrazado('a.geojson', JSON.stringify(multi))
    expect(t.advertencias.some((a) => a.includes('salto de 1112 m'))).toBe(true)
  })

  it.each([
    ['a.txt', 'hola', 'Formato no soportado'],
    ['a.gpx', '<gpx><trk>', 'no es XML válido'],
    ['a.geojson', '{nope', 'no es JSON válido'],
    ['a.geojson', '{"type":"Point","coordinates":[0,0]}', 'ninguna línea'],
    ['a.geojson', '{"type":"LineString","coordinates":[[0,0],[0,0]]}', 'al menos 2 puntos'],
  ])('rechaza %s inválido', (nombre, contenido, mensaje) => {
    expect(() => parsearTrazado(nombre, contenido)).toThrow(ErrorTrazado)
    expect(() => parsearTrazado(nombre, contenido)).toThrow(mensaje)
  })
})

describe('utilidades', () => {
  it('invertir no modifica el original', () => {
    const original: [number, number][] = [
      [1, 2],
      [3, 4],
    ]
    expect(invertir(original)).toEqual([
      [3, 4],
      [1, 2],
    ])
    expect(original).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('aEwkt arma la geometría para PostGIS', () => {
    expect(
      aEwkt([
        [-64.6, -31.4],
        [-64.59, -31.39],
      ]),
    ).toBe('SRID=4326;LINESTRING(-64.6 -31.4,-64.59 -31.39)')
  })

  it('distanciaM: 0,01° de latitud ≈ 1112 m', () => {
    expect(distanciaM([-64, -31], [-64, -30.99])).toBeCloseTo(1112, -1)
  })
})
