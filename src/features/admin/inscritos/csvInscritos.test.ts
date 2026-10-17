import { describe, expect, it } from 'vitest'
import { parsearInscritosCsv } from './csvInscritos'

describe('parsearInscritosCsv', () => {
  it('lee filas válidas y deja null los opcionales vacíos', () => {
    const r = parsearInscritosCsv(
      'numero,piloto,copiloto,auto,clase\n1,Ana Pérez,Luis Gómez,Fabia,Rally2\n7,Juan,,,\n',
    )
    expect(r.errores).toEqual([])
    expect(r.validos).toEqual([
      { numero: 1, piloto: 'Ana Pérez', copiloto: 'Luis Gómez', auto: 'Fabia', clase: 'Rally2' },
      { numero: 7, piloto: 'Juan', copiloto: null, auto: null, clase: null },
    ])
  })

  it('acepta punto y coma, BOM y encabezados con tildes o mayúsculas', () => {
    const r = parsearInscritosCsv(
      '\uFEFFNúmero;Piloto;Copiloto;Auto;Clase\n3;Eva;Leo;Clio;Rally4\n',
    )
    expect(r.errores).toEqual([])
    expect(r.validos[0]).toMatchObject({ numero: 3, piloto: 'Eva', clase: 'Rally4' })
  })

  it('informa columnas faltantes', () => {
    const r = parsearInscritosCsv('num,nombre\n1,Ana\n')
    expect(r.validos).toEqual([])
    expect(r.errores[0]?.mensaje).toContain('Faltan columnas: numero, piloto')
  })

  it('marca errores por fila con el número de fila de la planilla', () => {
    const r = parsearInscritosCsv(
      [
        'numero,piloto,copiloto,auto,clase',
        '1,Ana,,,',
        'x,Bad,,,',
        '0,Cero,,,',
        '2,,,,',
        '1,Repetido,,,',
        `3,Ok,,,${'a'.repeat(41)}`,
        '4,Bien,,,',
      ].join('\n'),
    )
    expect(r.validos.map((v) => v.numero)).toEqual([1, 4])
    expect(r.errores).toEqual([
      { fila: 3, mensaje: 'Número inválido: "x"' },
      { fila: 4, mensaje: 'Número inválido: "0"' },
      { fila: 5, mensaje: 'Falta el piloto' },
      { fila: 6, mensaje: 'El número 1 ya está en la fila 2' },
      { fila: 7, mensaje: 'clase supera 40 caracteres' },
    ])
  })

  it('ignora líneas vacías', () => {
    const r = parsearInscritosCsv('numero,piloto\n\n5,Uno\n   \n')
    expect(r.validos).toHaveLength(1)
    expect(r.errores).toEqual([])
  })
})
