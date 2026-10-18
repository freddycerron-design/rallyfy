import { describe, expect, it } from 'vitest'
import { esCampoEditable, interpretarTecla } from './atajos'

describe('interpretarTecla', () => {
  it.each([
    ['a', { tipo: 'aprobar' }],
    ['A', { tipo: 'aprobar' }],
    ['r', { tipo: 'abrir_rechazo' }],
    ['R', { tipo: 'abrir_rechazo' }],
    ['e', { tipo: 'corregir' }],
    ['j', { tipo: 'siguiente' }],
    ['ArrowDown', { tipo: 'siguiente' }],
    ['k', { tipo: 'anterior' }],
    ['ArrowUp', { tipo: 'anterior' }],
    ['x', null],
    ['1', null],
    ['Escape', null],
  ])('modo normal: %s', (tecla, comando) => {
    expect(interpretarTecla(tecla, 'normal')).toEqual(comando)
  })

  it.each([
    ['1', { tipo: 'rechazar', motivo: 'duplicado' }],
    ['2', { tipo: 'rechazar', motivo: 'no_es_del_evento' }],
    ['5', { tipo: 'rechazar', motivo: 'otro' }],
    ['6', null],
    ['0', null],
    ['a', null],
    ['Escape', { tipo: 'cancelar' }],
  ])('menú de rechazo: %s', (tecla, comando) => {
    expect(interpretarTecla(tecla, 'rechazo')).toEqual(comando)
  })

  it('corrigiendo: solo Escape', () => {
    expect(interpretarTecla('a', 'corrigiendo')).toBeNull()
    expect(interpretarTecla('Escape', 'corrigiendo')).toEqual({ tipo: 'cancelar' })
  })
})

describe('esCampoEditable', () => {
  it('detecta campos de texto y selects', () => {
    expect(esCampoEditable(document.createElement('input'))).toBe(true)
    expect(esCampoEditable(document.createElement('select'))).toBe(true)
    expect(esCampoEditable(document.createElement('textarea'))).toBe(true)
    expect(esCampoEditable(document.createElement('button'))).toBe(false)
    expect(esCampoEditable(null)).toBe(false)
  })
})
