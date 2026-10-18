import { expect, type Page, type Route, test } from '@playwright/test'

// Mapa del evento contra una API simulada. Que el punto público esté sobre el trazado
// (y no en la ubicación del aficionado) lo garantiza la vista: pgTAP 01.

const EVENTO = 'e0000000-0000-4000-8000-000000000001'
const TC1 = 'a0000000-0000-4000-8000-000000000001'
const TC2 = 'a0000000-0000-4000-8000-000000000002'

const json = (route: Route, cuerpo: unknown) =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify(cuerpo) })

const tramo = (id: string, n: number, coords: [number, number][]) => ({
  id,
  evento_id: EVENTO,
  codigo: `TC${n}`,
  nombre: `Tramo ${n}`,
  orden: n,
  longitud_km: 10,
  hora_inicio_prevista: null,
  estado: 'en_curso',
  trazado_geojson: { type: 'LineString', coordinates: coords },
  publicaciones_aprobadas: 2,
})

const pub = (
  id: string,
  tramoId: string,
  km: number,
  lon: number,
  lat: number,
  autos: number[],
) => ({
  id,
  evento_id: EVENTO,
  tramo_id: tramoId,
  tramo_codigo: tramoId === TC1 ? 'TC1' : 'TC2',
  tramo_nombre: '',
  tramo_orden: tramoId === TC1 ? 1 : 2,
  plataforma: 'youtube',
  id_externo: `${id}xxxxxxxxxxx`.slice(0, 11),
  url_canonica: `https://www.youtube.com/watch?v=${id}`,
  titulo: null,
  autor: null,
  alias: null,
  es_en_vivo: false,
  en_vivo_hasta: null,
  en_vivo_ahora: false,
  autos,
  km_en_tramo: km,
  punto_lon: lon,
  punto_lat: lat,
  hora_captura: '2026-10-17T14:00:00Z',
  votos: 0,
  aprobada_en: null,
})

async function simular(page: Page) {
  const rutas: string[] = []
  await page.route(/youtube-nocookie\.com|i\.ytimg\.com/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html></html>' }),
  )
  await page.route('**/rest/v1/**', (route) => {
    const ruta = new URL(route.request().url()).pathname
    rutas.push(ruta)
    switch (ruta) {
      case '/rest/v1/eventos':
        return json(route, {
          id: EVENTO,
          nombre: 'Rally de Ejemplo',
          fecha_inicio: '2026-10-17',
          fecha_fin: '2026-10-17',
          activo: true,
          creado_en: '2026-10-01T00:00:00Z',
        })
      case '/rest/v1/tramos_publicos':
        return json(route, [
          tramo(TC1, 1, [
            [-64.6, -31.4],
            [-64.68, -31.34],
          ]),
          tramo(TC2, 2, [
            [-64.7, -31.3],
            [-64.78, -31.36],
          ]),
        ])
      case '/rest/v1/muro_publico':
        return json(route, [
          pub('km6', TC1, 6.1, -64.649, -31.363, [7]),
          pub('km1', TC1, 1.0, -64.608, -31.394, [3]),
          pub('km6b', TC1, 6.2, -64.6495, -31.3628, [3, 7]),
          pub('tc2', TC2, 4.0, -64.733, -31.323, [21]),
        ])
      case '/rest/v1/ultimo_visto_por_auto':
        return json(
          route,
          [
            [3, 'Piloto Tres', 'km6b', TC1, 'TC1', 6.2, -64.6495, -31.3628],
            [7, 'Ana Pérez', 'km6b', TC1, 'TC1', 6.2, -64.6495, -31.3628],
            [21, 'Piloto Veintiuno', 'tc2', TC2, 'TC2', 4.0, -64.733, -31.323],
          ].map(([numero, piloto, publicacion_id, tramo_id, tramo_codigo, km, lon, lat]) => ({
            evento_id: EVENTO,
            numero,
            piloto,
            copiloto: null,
            auto: null,
            clase: null,
            publicacion_id,
            tramo_id,
            tramo_codigo,
            tramo_orden: tramo_codigo === 'TC1' ? 1 : 2,
            km_en_tramo: km,
            punto_lon: lon,
            punto_lat: lat,
            hora_captura: '2026-10-17T15:00:00Z',
          })),
        )
      default:
        return json(route, [])
    }
  })
  return rutas
}

test('muestra los videos y abre la tarjeta desde la lista', async ({ page }) => {
  const rutas = await simular(page)
  await page.goto('/mapa')

  await expect(page.getByRole('region', { name: 'Mapa del evento' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Videos (4)' })).toBeChecked()

  await page.getByText('Ver como lista').click()
  const items = page.locator('details li')
  await expect(items).toHaveText([/TC1 · km 1.0/, /TC1 · km 6.1/, /TC1 · km 6.2/, /TC2 · km 4.0/])

  await items.nth(3).getByRole('button').click()
  const hoja = page.getByRole('dialog', { name: 'Video seleccionado' })
  await expect(hoja).toContainText('TC2 · km 4.0')
  await expect(hoja.getByRole('link', { name: 'Ver auto 21' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(hoja).toBeHidden()

  // El mapa solo usa las vistas públicas, nunca la tabla con la ubicación exacta.
  expect(rutas).not.toContain('/rest/v1/publicaciones')
})

test('modo último visto: un marcador por auto con su último km', async ({ page }) => {
  await simular(page)
  await page.goto('/mapa')
  await page.getByRole('radio', { name: 'Último visto' }).click()
  await expect(page).toHaveURL(/modo=ultimo/)

  const mapa = page.getByRole('region', { name: 'Mapa del evento' })
  // #3 y #7 salen en el mismo video: comparten marcador.
  await expect(mapa.getByRole('button', { name: /^Autos? / })).toHaveCount(2)
  await mapa.getByRole('button', { name: 'Autos 3, 7' }).click()
  const juntos = page.getByRole('dialog', { name: 'Auto seleccionado' })
  await expect(juntos).toContainText('#3 · Piloto Tres')
  await expect(juntos).toContainText('#7 · Ana Pérez')
  await page.keyboard.press('Escape')

  await mapa.getByRole('button', { name: 'Auto 21' }).click()
  const hoja = page.getByRole('dialog', { name: 'Auto seleccionado' })
  await expect(hoja).toContainText('#21 · Piloto Veintiuno')
  await expect(hoja).toContainText(/Último visto en TC2 · km 4.0/)
  await hoja.getByRole('link', { name: 'Ver todos sus videos' }).click()
  await expect(page).toHaveURL(/\/auto\/21$/)
})
