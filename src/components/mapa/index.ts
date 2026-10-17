import { lazy } from 'react'

export type { LineaMapa } from './MapaTrazados'

/** MapLibre se descarga solo cuando se muestra un mapa. Usar dentro de <Suspense>. */
export const MapaTrazados = lazy(() => import('./MapaTrazados'))
