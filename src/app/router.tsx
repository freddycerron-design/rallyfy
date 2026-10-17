import { createBrowserRouter, type RouteObject } from 'react-router'
import { PaginaAdmin } from '@/features/admin/PaginaAdmin'
import { PaginaAuto } from '@/features/autos/PaginaAuto'
import { PaginaEnvio } from '@/features/envio/PaginaEnvio'
import { PaginaInicio } from '@/features/inicio/PaginaInicio'
import { PaginaMapa } from '@/features/mapa/PaginaMapa'
import { PaginaModeracion } from '@/features/moderacion/PaginaModeracion'
import { PaginaMuro } from '@/features/muro/PaginaMuro'
import { Layout } from './Layout'
import { PaginaError, PaginaNoEncontrada } from './PaginasError'

export const rutas: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <PaginaError />,
    children: [
      { index: true, element: <PaginaInicio /> },
      { path: 'tramo/:tramoId', element: <PaginaMuro /> },
      { path: 'mapa', element: <PaginaMapa /> },
      { path: 'auto/:numero', element: <PaginaAuto /> },
      { path: 'enviar', element: <PaginaEnvio /> },
      { path: 'moderacion', element: <PaginaModeracion /> },
      { path: 'admin', element: <PaginaAdmin /> },
      { path: '*', element: <PaginaNoEncontrada /> },
    ],
  },
]

export const crearRouter = () => createBrowserRouter(rutas)
