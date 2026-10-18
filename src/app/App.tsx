import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { SesionAnonimaProvider } from '@/components/SesionAnonimaProvider'
import { crearRouter } from './router'

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Señal débil en el borde del camino: reintentar y no refrescar de más.
            retry: 3,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  const [router] = useState(crearRouter)

  return (
    <QueryClientProvider client={queryClient}>
      <SesionAnonimaProvider>
        <RouterProvider router={router} />
      </SesionAnonimaProvider>
    </QueryClientProvider>
  )
}
