import { useEnLinea } from '@/lib/useEnLinea'

export function AvisoSinConexion() {
  const enLinea = useEnLinea()
  if (enLinea) return null

  return (
    <div role="status" className="bg-red-700 px-4 py-2 text-center text-sm font-medium text-white">
      Sin conexión. Mostramos lo último que se cargó; los cambios se verán al volver la señal.
    </div>
  )
}
