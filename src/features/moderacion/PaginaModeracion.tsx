import { EnConstruccion } from '@/components/EnConstruccion'
import { RutaProtegida } from '@/components/RutaProtegida'

export function PaginaModeracion() {
  return (
    <RutaProtegida rol="moderador">
      <EnConstruccion
        titulo="Moderación"
        fase={4}
        descripcion="Cola de publicaciones pendientes para aprobar o rechazar."
      />
    </RutaProtegida>
  )
}
