type Props = {
  titulo: string
  fase: number
  descripcion: string
}

/** Marcador temporal para las pantallas que se construyen en fases posteriores. */
export function EnConstruccion({ titulo, fase, descripcion }: Props) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="mt-2 text-gray-600">{descripcion}</p>
      <p className="mt-4 inline-block rounded bg-gray-200 px-2 py-1 text-sm text-gray-700">
        En construcción · Fase {fase}
      </p>
    </section>
  )
}
