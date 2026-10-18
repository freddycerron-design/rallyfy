import { useState } from 'react'
import type { InscritoPublico } from '@/lib/consultasPublicas'

type Props = {
  inscritos: InscritoPublico[]
  seleccionados: number[]
  alCambiar: (autos: number[]) => void
}

const UMBRAL_FILTRO = 24

/** Botones grandes con el número de cada auto, pensados para el pulgar. */
export function SelectorAutos({ inscritos, seleccionados, alCambiar }: Props) {
  const [filtro, setFiltro] = useState('')
  const elegidos = new Set(seleccionados)

  const visibles = filtro
    ? inscritos.filter(
        (i) =>
          String(i.numero).startsWith(filtro.trim()) ||
          i.piloto.toLowerCase().includes(filtro.trim().toLowerCase()),
      )
    : inscritos

  function alternar(numero: number) {
    const nuevo = new Set(elegidos)
    if (nuevo.has(numero)) nuevo.delete(numero)
    else nuevo.add(numero)
    alCambiar([...nuevo].sort((a, b) => a - b))
  }

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-gray-700">
        ¿Qué autos aparecen? <span className="font-normal text-gray-500">(opcional)</span>
      </legend>

      {inscritos.length > UMBRAL_FILTRO && (
        <input
          type="search"
          inputMode="numeric"
          placeholder="Buscar número o piloto"
          aria-label="Buscar auto"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-gray-300 px-3"
        />
      )}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {visibles.map((i) => {
          const activo = elegidos.has(i.numero)
          return (
            <button
              key={i.numero}
              type="button"
              aria-pressed={activo}
              title={`${i.piloto}${i.auto ? ` · ${i.auto}` : ''}`}
              onClick={() => alternar(i.numero)}
              className={`min-h-14 rounded-lg border-2 text-xl font-bold tabular-nums transition-colors ${
                activo
                  ? 'border-marca-oscuro bg-marca text-tinta'
                  : 'border-gray-300 bg-white text-tinta hover:border-gray-400'
              }`}
            >
              {i.numero}
            </button>
          )
        })}
      </div>

      {seleccionados.length > 0 && (
        <p className="text-sm text-gray-700" aria-live="polite">
          Elegiste: {seleccionados.map((n) => `#${n}`).join(', ')}
        </p>
      )}
    </fieldset>
  )
}
