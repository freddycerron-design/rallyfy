import { describe, expect, it } from 'vitest'
import { ordenarMuro, type PublicacionMuro } from './muro'

const pub = (id: string, extra: Partial<PublicacionMuro> = {}): PublicacionMuro => ({
  id,
  evento_id: 'e',
  tramo_id: 't1',
  tramo_codigo: 'TC1',
  tramo_nombre: 'Uno',
  tramo_orden: 1,
  plataforma: 'youtube',
  id_externo: id,
  url_canonica: '',
  titulo: null,
  autor: null,
  alias: null,
  es_en_vivo: false,
  en_vivo_hasta: null,
  en_vivo_ahora: false,
  autos: [],
  km_en_tramo: 0,
  punto_lon: null,
  punto_lat: null,
  hora_captura: '2026-10-17T10:00:00Z',
  votos: 0,
  aprobada_en: null,
  ...extra,
})

const datos = [
  pub('km8', { km_en_tramo: 8, hora_captura: '2026-10-17T10:05:00Z', votos: 1 }),
  pub('km2', { km_en_tramo: 2, hora_captura: '2026-10-17T10:20:00Z', votos: 5 }),
  pub('tc2km1', { tramo_orden: 2, km_en_tramo: 1, hora_captura: '2026-10-17T11:00:00Z' }),
  pub('sinkm', { km_en_tramo: null, hora_captura: '2026-10-17T09:00:00Z', votos: 5 }),
]

describe('ordenarMuro', () => {
  it('por km sigue el recorrido: tramo, luego km (sin km al final)', () => {
    expect(ordenarMuro(datos, 'km').map((p) => p.id)).toEqual(['km2', 'km8', 'sinkm', 'tc2km1'])
  })

  it('por hora pone primero lo más reciente', () => {
    expect(ordenarMuro(datos, 'hora').map((p) => p.id)).toEqual(['tc2km1', 'km2', 'km8', 'sinkm'])
  })

  it('por votos desempata por hora', () => {
    expect(ordenarMuro(datos, 'votos').map((p) => p.id)).toEqual(['km2', 'sinkm', 'km8', 'tc2km1'])
  })

  it('no modifica el arreglo original', () => {
    const copia = [...datos]
    ordenarMuro(datos, 'votos')
    expect(datos).toEqual(copia)
  })
})
