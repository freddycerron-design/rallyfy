import { useSyncExternalStore } from 'react'

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

/** Indica si el navegador cree tener conexión. */
export function useEnLinea() {
  return useSyncExternalStore(
    suscribir,
    () => navigator.onLine,
    () => true,
  )
}
