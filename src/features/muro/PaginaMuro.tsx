import { EnConstruccion } from '@/components/EnConstruccion'

export function PaginaMuro() {
  return (
    <EnConstruccion
      titulo="Muro del tramo"
      fase={5}
      descripcion="Publicaciones aprobadas ordenadas por km, hora o votos."
    />
  )
}
