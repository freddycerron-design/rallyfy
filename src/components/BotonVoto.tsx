import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { mensajeError } from '@/lib/errores'
import { useAsegurarSesion } from '@/lib/sesionAnonimaContexto'
import { useSesion } from '@/lib/sesion'
import { supabase } from '@/lib/supabase'

/** Publicaciones que votó el usuario actual (RLS: cada uno ve solo sus votos). */
function useMisVotos() {
  const sesion = useSesion()
  const usuarioId = sesion?.user.id
  return useQuery({
    queryKey: ['mis-votos', usuarioId],
    enabled: !!usuarioId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('votos').select('publicacion_id')
      if (error) throw error
      return new Set((data as { publicacion_id: string }[]).map((v) => v.publicacion_id))
    },
  })
}

type Props = { publicacionId: string; votos: number }

/**
 * Voto optimista: cambia al instante y toma el conteo que devuelve el servidor.
 * La primera vez crea la sesión anónima. Un voto por persona y publicación (RPC votar).
 */
export function BotonVoto({ publicacionId, votos }: Props) {
  const qc = useQueryClient()
  const asegurarSesion = useAsegurarSesion()
  const misVotos = useMisVotos()
  // El valor local vale mientras el servidor no traiga un conteo nuevo (`base`).
  const [local, setLocal] = useState<{ base: number; votado: boolean; votos: number } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const vigente = local?.base === votos ? local : null
  const votado = vigente?.votado ?? misVotos.data?.has(publicacionId) ?? false
  const total = vigente?.votos ?? votos

  async function alternar() {
    if (ocupado) return
    const anterior = vigente
    const nuevo = !votado
    setError(null)
    setOcupado(true)
    setLocal({ base: votos, votado: nuevo, votos: Math.max(0, total + (nuevo ? 1 : -1)) })
    try {
      await asegurarSesion()
      const { data, error } = await supabase.rpc(nuevo ? 'votar' : 'quitar_voto', {
        p_publicacion_id: publicacionId,
      })
      if (error) throw error
      setLocal({ base: votos, votado: nuevo, votos: data as number })
      qc.invalidateQueries({ queryKey: ['mis-votos'] })
    } catch (e) {
      setLocal(anterior)
      setError(mensajeError(e))
      setTimeout(() => setError(null), 5000)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={alternar}
        aria-pressed={votado}
        aria-label={`${votado ? 'Quitar voto' : 'Votar'} (${total} votos)`}
        className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 font-medium tabular-nums transition-colors ${
          votado
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
        }`}
      >
        <span aria-hidden>{votado ? '♥' : '♡'}</span> {total}
      </button>
      {error && (
        <span
          role="alert"
          className="absolute right-0 bottom-full mb-1 w-56 rounded-md bg-tinta px-2 py-1 text-xs text-white"
        >
          {error}
        </span>
      )}
    </span>
  )
}
