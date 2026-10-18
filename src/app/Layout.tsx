import { Link, NavLink, Outlet, useMatches } from 'react-router'
import { AvisoSinConexion } from './AvisoSinConexion'

const navegacion = [
  { to: '/', etiqueta: 'Inicio', end: true },
  { to: '/mapa', etiqueta: 'Mapa', end: false },
  { to: '/enviar', etiqueta: 'Enviar', end: false },
]

/** Una ruta puede pedir más ancho con `handle: { ancho: 'amplio' }` (por ejemplo, moderación). */
function useAnchoAmplio() {
  return useMatches().some((m) => (m.handle as { ancho?: string } | undefined)?.ancho === 'amplio')
}

export function Layout() {
  const ancho = useAnchoAmplio() ? 'max-w-6xl' : 'max-w-3xl'
  return (
    <div className="flex min-h-dvh flex-col">
      <AvisoSinConexion />

      <header className="sticky top-0 z-10 bg-tinta text-white">
        <div className={`mx-auto flex h-14 ${ancho} items-center px-4`}>
          <Link to="/" className="text-lg font-bold tracking-tight">
            Muro <span className="text-marca">Rally</span>
          </Link>
        </div>
      </header>

      <main className={`mx-auto w-full ${ancho} flex-1 px-4 py-4 pb-24`}>
        <Outlet />
      </main>

      {/* Navegación inferior: al alcance del pulgar en el celular. */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-3">
          {navegacion.map(({ to, etiqueta, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex h-14 items-center justify-center text-base font-medium ${
                    isActive ? 'text-marca-oscuro' : 'text-gray-600'
                  }`
                }
              >
                {etiqueta}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
