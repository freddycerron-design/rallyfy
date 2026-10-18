import { lazy } from 'react'

export type { LineaMapa } from './mapaBase'
export type { AutoMapa, PinMapa } from './MapaEvento'

// MapLibre se descarga solo cuando se muestra un mapa. Usar dentro de <Suspense>.
export const MapaTrazados = lazy(() => import('./MapaTrazados'))
export const MapaEvento = lazy(() => import('./MapaEvento'))
