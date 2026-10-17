import Papa from 'papaparse'

export type InscritoCsv = {
  numero: number
  piloto: string
  copiloto: string | null
  auto: string | null
  clase: string | null
}

export type ErrorFila = { fila: number; mensaje: string }

export type ResultadoCsv = { validos: InscritoCsv[]; errores: ErrorFila[] }

const COLUMNAS = ['numero', 'piloto', 'copiloto', 'auto', 'clase'] as const
const LARGO_MAX = { piloto: 120, copiloto: 120, auto: 120, clase: 40 } as const

/** Normaliza un encabezado: minúsculas, sin tildes ni espacios ("Número" → "numero"). */
const normalizarEncabezado = (h: string) =>
  h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

/**
 * Valida un CSV `numero,piloto,copiloto,auto,clase` (detecta coma o punto y coma).
 * Las filas se numeran como en una planilla: la 1 es el encabezado.
 */
export function parsearInscritosCsv(contenido: string): ResultadoCsv {
  const { data, errors, meta } = Papa.parse<Record<string, string>>(
    contenido.replace(/^\uFEFF/, ''),
    {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizarEncabezado,
    },
  )

  const faltantes = ['numero', 'piloto'].filter((c) => !meta.fields?.includes(c))
  if (faltantes.length > 0) {
    return {
      validos: [],
      errores: [
        {
          fila: 1,
          mensaje: `Faltan columnas: ${faltantes.join(', ')}. Se esperan: ${COLUMNAS.join(', ')}.`,
        },
      ],
    }
  }

  const errores: ErrorFila[] = errors
    .filter((e) => e.row !== undefined)
    .map((e) => ({ fila: e.row! + 2, mensaje: `Formato: ${e.message}` }))
  const validos: InscritoCsv[] = []
  const vistos = new Map<number, number>()

  data.forEach((registro, i) => {
    const fila = i + 2
    const texto = (c: (typeof COLUMNAS)[number]) => registro[c]?.trim() ?? ''
    const opcional = (c: keyof typeof LARGO_MAX) => texto(c) || null

    const numeroTexto = texto('numero')
    const numero = Number(numeroTexto)
    if (!/^\d+$/.test(numeroTexto) || numero <= 0) {
      errores.push({ fila, mensaje: `Número inválido: "${numeroTexto}"` })
      return
    }
    if (!texto('piloto')) {
      errores.push({ fila, mensaje: 'Falta el piloto' })
      return
    }
    for (const [campo, maximo] of Object.entries(LARGO_MAX) as [keyof typeof LARGO_MAX, number][]) {
      if (texto(campo).length > maximo) {
        errores.push({ fila, mensaje: `${campo} supera ${maximo} caracteres` })
        return
      }
    }
    const filaAnterior = vistos.get(numero)
    if (filaAnterior !== undefined) {
      errores.push({ fila, mensaje: `El número ${numero} ya está en la fila ${filaAnterior}` })
      return
    }
    vistos.set(numero, fila)

    validos.push({
      numero,
      piloto: texto('piloto'),
      copiloto: opcional('copiloto'),
      auto: opcional('auto'),
      clase: opcional('clase'),
    })
  })

  errores.sort((a, b) => a.fila - b.fila)
  return { validos, errores }
}
