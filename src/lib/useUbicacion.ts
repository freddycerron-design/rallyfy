import { useCallback, useEffect, useState } from 'react'
import type { Coordenada } from './geo'

export type EstadoUbicacion =
  | { estado: 'pidiendo' }
  | { estado: 'ok'; punto: Coordenada; precisionM: number }
  | { estado: 'denegada' | 'no_disponible' | 'no_soportada' }

/** Pide la ubicación del dispositivo al montar. `reintentar` vuelve a pedirla. */
export function useUbicacion(): EstadoUbicacion & { reintentar: () => void } {
  const [ubicacion, setUbicacion] = useState<EstadoUbicacion>(() =>
    'geolocation' in navigator ? { estado: 'pidiendo' } : { estado: 'no_soportada' },
  )

  const pedir = useCallback(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setUbicacion({
          estado: 'ok',
          punto: [p.coords.longitude, p.coords.latitude],
          precisionM: Math.round(p.coords.accuracy),
        }),
      (error) =>
        setUbicacion({
          estado: error.code === error.PERMISSION_DENIED ? 'denegada' : 'no_disponible',
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(pedir, [pedir])

  const reintentar = useCallback(() => {
    setUbicacion({ estado: 'pidiendo' })
    pedir()
  }, [pedir])

  return { ...ubicacion, reintentar }
}
