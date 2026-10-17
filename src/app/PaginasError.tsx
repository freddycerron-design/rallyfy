import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export function PaginaNoEncontrada() {
  return (
    <section className="py-12 text-center">
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="mt-2 text-gray-600">El enlace no existe o cambió.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-marca-oscuro underline">
        Volver al inicio
      </Link>
    </section>
  )
}

export function PaginaError() {
  const error = useRouteError()
  const detalle = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'Ocurrió un error inesperado.'

  return (
    <section className="px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-gray-600">{detalle}</p>
      <a href="/" className="mt-6 inline-block font-medium text-marca-oscuro underline">
        Volver al inicio
      </a>
    </section>
  )
}
