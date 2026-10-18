import type { EstadoTramo as Estado } from '@/lib/tipos'

const estilos: Record<Estado, { texto: string; clase: string }> = {
  por_iniciar: { texto: 'Por iniciar', clase: 'bg-gray-200 text-gray-800' },
  en_curso: { texto: 'En curso', clase: 'bg-green-100 text-green-800' },
  finalizado: { texto: 'Finalizado', clase: 'bg-gray-800 text-white' },
}

export function EstadoTramo({ estado }: { estado: Estado }) {
  const { texto, clase } = estilos[estado]
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${clase}`}>{texto}</span>
}
