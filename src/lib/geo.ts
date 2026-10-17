/** [longitud, latitud] en WGS84. */
export type Coordenada = [number, number]

const RADIO_TIERRA_M = 6_371_008.8
const RAD = Math.PI / 180

/** Distancia haversine en metros. */
export function distanciaM([lon1, lat1]: Coordenada, [lon2, lat2]: Coordenada): number {
  const dLat = (lat2 - lat1) * RAD
  const dLon = (lon2 - lon1) * RAD
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a))
}

/**
 * Distancia en metros de un punto a una polilínea. Usa una proyección
 * equirectangular local: el error es despreciable a la escala de un tramo.
 */
export function distanciaAPolilineaM(punto: Coordenada, linea: Coordenada[]): number {
  if (linea.length === 0) return Infinity
  if (linea.length === 1) return distanciaM(punto, linea[0]!)

  const kx = Math.cos(punto[1] * RAD) * RAD * RADIO_TIERRA_M
  const ky = RAD * RADIO_TIERRA_M
  const proyectar = ([lon, lat]: Coordenada) => [(lon - punto[0]) * kx, (lat - punto[1]) * ky]

  let minimo = Infinity
  for (let i = 1; i < linea.length; i++) {
    const [ax, ay] = proyectar(linea[i - 1]!) as [number, number]
    const [bx, by] = proyectar(linea[i]!) as [number, number]
    const dx = bx - ax
    const dy = by - ay
    const largo2 = dx * dx + dy * dy
    // Proyección del origen (el punto) sobre el segmento, acotada a [0, 1].
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / largo2))
    const px = ax + t * dx
    const py = ay + t * dy
    minimo = Math.min(minimo, Math.hypot(px, py))
  }
  return minimo
}

/** Ordena elementos con trazado por cercanía al punto. */
export function ordenarPorCercania<T>(
  punto: Coordenada,
  elementos: T[],
  trazado: (e: T) => Coordenada[],
): { elemento: T; distanciaM: number }[] {
  return elementos
    .map((elemento) => ({ elemento, distanciaM: distanciaAPolilineaM(punto, trazado(elemento)) }))
    .sort((a, b) => a.distanciaM - b.distanciaM)
}

export function formatearDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`
}
