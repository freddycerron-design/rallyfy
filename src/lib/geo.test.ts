import { describe, expect, it } from 'vitest'
import {
  type Coordenada,
  distanciaAPolilineaM,
  distanciaM,
  formatearDistancia,
  ordenarPorCercania,
} from './geo'

// Tramo recto sur→norte de ≈ 11,1 km.
const recta: Coordenada[] = [
  [-64, -31],
  [-64, -30.9],
]

describe('distanciaAPolilineaM', () => {
  it('a mitad del tramo, 0,001° al este ≈ 95 m (como PostGIS en las pruebas pgTAP)', () => {
    expect(distanciaAPolilineaM([-63.999, -30.95], recta)).toBeCloseTo(95.4, 0)
  })

  it('más allá del final mide hasta el extremo', () => {
    const d = distanciaAPolilineaM([-64, -30.89], recta)
    expect(d).toBeCloseTo(distanciaM([-64, -30.89], [-64, -30.9]), 0)
  })

  it('sobre la línea es 0', () => {
    expect(distanciaAPolilineaM([-64, -30.95], recta)).toBeCloseTo(0, 6)
  })

  it('casos borde', () => {
    expect(distanciaAPolilineaM([0, 0], [])).toBe(Infinity)
    expect(distanciaAPolilineaM([0, 0], [[0, 0.001]])).toBeCloseTo(111.2, 0)
  })
})

describe('ordenarPorCercania', () => {
  it('ordena tramos del más cercano al más lejano', () => {
    const tramos = [
      {
        codigo: 'LEJOS',
        coords: [
          [-65, -31],
          [-65, -30.9],
        ] as Coordenada[],
      },
      { codigo: 'CERCA', coords: recta },
    ]
    const r = ordenarPorCercania([-64.001, -30.95], tramos, (t) => t.coords)
    expect(r.map((x) => x.elemento.codigo)).toEqual(['CERCA', 'LEJOS'])
    expect(r[0]!.distanciaM).toBeLessThan(100)
  })
})

describe('formatearDistancia', () => {
  it.each([
    [43, '40 m'],
    [999, '1000 m'],
    [1234, '1.2 km'],
    [25_400, '25 km'],
  ])('%i → %s', (m, texto) => {
    expect(formatearDistancia(m)).toBe(texto)
  })
})
