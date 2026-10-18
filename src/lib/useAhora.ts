import { useEffect, useState } from 'react'

/** Hora actual (ms) que se actualiza cada `intervaloMs`. Para vencimientos en pantalla. */
export function useAhora(intervaloMs = 30_000): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), intervaloMs)
    return () => clearInterval(id)
  }, [intervaloMs])
  return ahora
}
