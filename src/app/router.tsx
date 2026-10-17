import { createBrowserRouter, type RouteObject } from 'react-router'
import { PaginaAuto } from '@/features/autos/PaginaAuto'
import { PaginaEnvio } from '@/features/envio/PaginaEnvio'
import { PaginaInicio } from '@/features/inicio/PaginaInicio'
import { PaginaMapa } from '@/features/mapa/PaginaMapa'
import { PaginaMuro } from '@/features/muro/PaginaMuro'
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
      { index: true, element: <PaginaInicio /> },
      { path: 'tramo/:tramoId', element: <PaginaMuro /> },
      { path: 'mapa', element: <PaginaMapa /> },
      { path: 'auto/:numero', element: <PaginaAuto /> },
      { path: 'enviar', element: <PaginaEnvio /> },
      // Pantallas del equipo: se descargan solo cuando se visitan.
      {
        path: 'moderacion',
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
