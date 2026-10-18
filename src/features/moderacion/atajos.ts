import { MOTIVOS, type MotivoRechazo } from './api'

export type ModoModeracion = 'normal' | 'rechazo' | 'corrigiendo'

export type Comando =
  | { tipo: 'aprobar' }
  | { tipo: 'abrir_rechazo' }
  | { tipo: 'rechazar'; motivo: MotivoRechazo }
  | { tipo: 'corregir' }
  | { tipo: 'siguiente' }
  | { tipo: 'anterior' }
  | { tipo: 'cancelar' }

/**
 * Traduce una tecla a un comando según el modo (spec §7.6: A = aprobar, R = rechazar).
 * J/K o flechas para moverse; en el menú de rechazo, 1–5 eligen el motivo.
 */
export function interpretarTecla(tecla: string, modo: ModoModeracion): Comando | null {
  if (tecla === 'Escape') return modo === 'normal' ? null : { tipo: 'cancelar' }

  if (modo === 'rechazo') {
    const indice = Number(tecla) - 1
    const motivo = Number.isInteger(indice) ? MOTIVOS[indice] : undefined
    return motivo ? { tipo: 'rechazar', motivo: motivo.valor } : null
  }
  if (modo === 'corrigiendo') return null

  switch (tecla.toLowerCase()) {
    case 'a':
      return { tipo: 'aprobar' }
    case 'r':
      return { tipo: 'abrir_rechazo' }
    case 'e':
      return { tipo: 'corregir' }
    case 'j':
    case 'arrowdown':
      return { tipo: 'siguiente' }
    case 'k':
    case 'arrowup':
      return { tipo: 'anterior' }
    default:
      return null
  }
}

/** No interceptar teclas mientras se escribe en un campo. */
export function esCampoEditable(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName)
}
