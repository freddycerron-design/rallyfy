import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { rutas } from './router'

function renderEn(ruta: string) {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] })
  render(<RouterProvider router={router} />)
}

describe('router', () => {
  it.each([
    ['/', 'Fecha en curso'],
    ['/tramo/abc', 'Muro del tramo'],
    ['/mapa', 'Mapa'],
    ['/auto/7', 'Ficha del auto'],
    ['/enviar', 'Enviar mi video'],
    ['/moderacion', 'Moderación'],
    ['/admin', 'Administración'],
  ])('muestra la página de %s', (ruta, titulo) => {
    renderEn(ruta)
    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeInTheDocument()
  })

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
