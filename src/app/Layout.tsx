import { Link, NavLink, Outlet } from 'react-router'
import { AvisoSinConexion } from './AvisoSinConexion'

const navegacion = [
  { to: '/', etiqueta: 'Inicio', end: true },
  { to: '/mapa', etiqueta: 'Mapa', end: false },
  { to: '/enviar', etiqueta: 'Enviar', end: false },
]

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AvisoSinConexion />

      <header className="sticky top-0 z-10 bg-tinta text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            Muro <span className="text-marca">Rally</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-24">
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
