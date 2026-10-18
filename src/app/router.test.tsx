import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { rutas } from './router'

function renderEn(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('router', () => {
  it.each([
    ['/mapa', 'Mapa'],
    ['/enviar', 'Enviar mi video'],
  ])('muestra la página de %s', async (ruta, titulo) => {
    renderEn(ruta)
    expect(await screen.findByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })

  it.each(['/', '/tramo/abc', '/auto/7'])('%s carga datos sin caer en 404', (ruta) => {
    renderEn(ruta)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByText('Página no encontrada')).not.toBeInTheDocument()
  })

  it.each(['/moderacion', '/admin', '/admin/equipo', '/admin/evento/abc'])(
    'pide iniciar sesión en %s',
    async (ruta) => {
      renderEn(ruta)
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Acceso para el equipo' }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    },
  )

  it('muestra 404 en rutas desconocidas', () => {
    renderEn('/no-existe')
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })

  it('incluye la navegación inferior', () => {
    renderEn('/')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(nav).toHaveTextContent('Inicio')
    expect(nav).toHaveTextContent('Enviar')
  })
})
