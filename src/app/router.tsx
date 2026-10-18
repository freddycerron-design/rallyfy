import { createBrowserRouter, type RouteObject } from 'react-router'
import { PaginaInicio } from '@/features/inicio/PaginaInicio'
import { Cargando } from '@/components/ui'
import { Layout } from './Layout'
import { PaginaError, PaginaNoEncontrada } from './PaginasError'

export const rutas: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <PaginaError />,
    // Se muestra mientras se descarga una ruta diferida en la primera carga.
    HydrateFallback: () => <Cargando />,
    children: [
      // El inicio va en el bundle principal; el resto se descarga al visitarlo, para que la
      // primera carga con poca señal sea lo más liviana posible.
      { index: true, element: <PaginaInicio /> },
      {
        path: 'tramo/:tramoId',
        lazy: async () => ({ Component: (await import('@/features/muro/PaginaMuro')).PaginaMuro }),
      },
      {
        path: 'mapa',
        lazy: async () => ({ Component: (await import('@/features/mapa/PaginaMapa')).PaginaMapa }),
      },
      {
        path: 'auto/:numero',
        lazy: async () => ({ Component: (await import('@/features/autos/PaginaAuto')).PaginaAuto }),
      },
      {
        path: 'enviar',
        lazy: async () => ({
          Component: (await import('@/features/envio/PaginaEnvio')).PaginaEnvio,
        }),
      },
      // Pantallas del equipo: se descargan solo cuando se visitan.
      {
        path: 'moderacion',
        handle: { ancho: 'amplio' },
        lazy: async () => ({
          Component: (await import('@/features/moderacion/PaginaModeracion')).PaginaModeracion,
        }),
      },
      {
        path: 'admin',
        lazy: async () => ({
          Component: (await import('@/features/admin/PaginaAdmin')).PaginaAdmin,
        }),
      },
      {
        path: 'admin/evento/:eventoId',
        lazy: async () => ({
          Component: (await import('@/features/admin/PaginaEventoAdmin')).PaginaEventoAdmin,
        }),
      },
      {
        path: 'admin/equipo',
        lazy: async () => ({
          Component: (await import('@/features/admin/PaginaEquipo')).PaginaEquipo,
        }),
      },
      { path: '*', element: <PaginaNoEncontrada /> },
    ],
  },
]

export const crearRouter = () => createBrowserRouter(rutas)
