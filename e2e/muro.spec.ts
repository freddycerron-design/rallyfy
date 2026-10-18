import { expect, type Page, type Route, test } from '@playwright/test'

// Inicio, muro del tramo y ficha del auto contra una API simulada.
// Que lo pendiente no aparezca lo garantiza la vista muro_publico (pgTAP 01).

const EVENTO = 'e0000000-0000-4000-8000-000000000001'
const TC1 = 'a0000000-0000-4000-8000-000000000001'
const TC2 = 'a0000000-0000-4000-8000-000000000002'

const json = (route: Route, cuerpo: unknown) =>
  route.fulfill({ contentType: 'application/json', body: JSON.stringify(cuerpo) })

const tramo = (id: string, n: number, extra: Record<string, unknown> = {}) => ({
  id,
  evento_id: EVENTO,
  codigo: `TC${n}`,
  nombre: `Tramo ${n}`,
  orden: n,
  longitud_km: 10.2,
  hora_inicio_prevista: null,
  estado: 'en_curso',
  trazado_geojson: {
    type: 'LineString',
    coordinates: [
      [-64.6, -31.4],
      [-64.7, -31.3],
    ],
  },
  publicaciones_aprobadas: 4,
  ...extra,
})

const pub = (id: string, tramoId: string, km: number, extra: Record<string, unknown> = {}) => ({
  id,
  evento_id: EVENTO,
  tramo_id: tramoId,
  tramo_codigo: tramoId === TC1 ? 'TC1' : 'TC2',
  tramo_nombre: '',
  tramo_orden: tramoId === TC1 ? 1 : 2,
  plataforma: 'youtube',
  id_externo: `${id}xxxxxxxxxxx`.slice(0, 11),
  url_canonica: `https://www.youtube.com/watch?v=${id}`,
  titulo: `Video ${id}`,
  autor: null,
  alias: 'La Curva TV',
  es_en_vivo: false,
  en_vivo_hasta: null,
  en_vivo_ahora: false,
  autos: [7],
  km_en_tramo: km,
  punto_lon: -64.6,
  punto_lat: -31.4,
  hora_captura: '2026-10-17T14:00:00Z',
  votos: 0,
  aprobada_en: '2026-10-17T14:05:00Z',
  ...extra,
})

// Desordenadas a propósito: el muro debe ordenarlas.
const MURO_TC1 = [
  pub('km8', TC1, 8.1, { hora_captura: '2026-10-17T14:30:00Z', votos: 1 }),
  pub('km2', TC1, 2.4, { hora_captura: '2026-10-17T14:10:00Z', votos: 4, autos: [3] }),
  pub('km5', TC1, 5.0, { hora_captura: '2026-10-17T14:20:00Z', votos: 9, autos: [3, 7] }),
  pub('vivo', TC1, 3.3, {
    plataforma: 'tiktok',
    id_externo: 'live:@fan',
    url_canonica: 'https://www.tiktok.com/@fan/live',
    es_en_vivo: true,
    en_vivo_ahora: true,
    autos: [],
  }),
]

async function simular(page: Page) {
  await page.route(/youtube-nocookie\.com|i\.ytimg\.com|tiktok\.com\/player/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html><body>video</body></html>' }),
  )
  await page.route('**/rest/v1/**', (route) => {
    const url = new URL(route.request().url())
    const p = url.searchParams
    switch (url.pathname) {
      case '/rest/v1/eventos':
        return json(route, {
          id: EVENTO,
          nombre: 'Rally de Ejemplo · Fecha 1',
          fecha_inicio: '2026-10-17',
          fecha_fin: '2026-10-18',
          activo: true,
          creado_en: '2026-10-01T00:00:00Z',
        })
      case '/rest/v1/tramos_publicos':
        if (p.get('id') === `eq.${TC1}`) return json(route, tramo(TC1, 1))
        return json(route, [
          tramo(TC1, 1),
          tramo(TC2, 2, { estado: 'por_iniciar', publicaciones_aprobadas: 1 }),
        ])
      case '/rest/v1/muro_publico':
        if (p.get('autos') === 'cs.{7}') {
          return json(route, [
            pub('tc2', TC2, 1.2, { autos: [7] }),
            ...MURO_TC1.filter((x) => x.autos.includes(7)),
          ])
        }
        return json(route, MURO_TC1)
      case '/rest/v1/inscritos':
        return json(route, [
          { numero: 3, piloto: 'Piloto Tres', copiloto: null, auto: 'Clio', clase: 'Rally4' },
          { numero: 7, piloto: 'Ana Pérez', copiloto: 'Leo Díaz', auto: 'Fabia', clase: 'Rally2' },
        ])
      case '/rest/v1/ultimo_visto_por_auto':
        return json(route, {
          tramo_id: TC2,
          tramo_codigo: 'TC2',
          km_en_tramo: 1.2,
          hora_captura: '2026-10-17T15:00:00Z',
        })
      default:
        return json(route, [])
    }
  })
}

const kms = (page: Page) =>
  page
    .getByRole('list', { name: 'Publicaciones' })
    .locator('article header p:first-child')
    .allTextContents()

test('inicio lista los tramos con estado y cantidad de videos', async ({ page }) => {
  await simular(page)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Rally de Ejemplo · Fecha 1' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Enviar mi video' })).toBeVisible()

  const tc2 = page.getByRole('link', { name: /TC2/ })
  await expect(tc2).toContainText('Por iniciar')
  await expect(tc2).toContainText('1 video')
  await page.getByRole('link', { name: /TC1/ }).click()
  await expect(page).toHaveURL(new RegExp(`/tramo/${TC1}$`))
})

test('el muro ordena por km, por votos y filtra por auto', async ({ page }) => {
  await simular(page)
  await page.goto(`/tramo/${TC1}`)
  await expect(page.getByRole('heading', { level: 1, name: 'TC1 · Tramo 1' })).toBeVisible()

  // Por km: el orden del recorrido. La transmisión va aparte, arriba.
  await expect.poll(() => kms(page)).toEqual(['km 2.4', 'km 5.0', 'km 8.1'])
  const vivo = page.getByRole('region', { name: 'En vivo ahora' })
  await expect(vivo.getByRole('link', { name: /EN VIVO/ })).toHaveAttribute(
    'href',
    'https://www.tiktok.com/@fan/live',
  )

  await page.getByRole('radio', { name: 'Más votados' }).click()
  await expect(page).toHaveURL(/orden=votos/)
  await expect.poll(() => kms(page)).toEqual(['km 5.0', 'km 2.4', 'km 8.1'])

  await page.getByRole('radio', { name: 'Recientes' }).click()
  await expect.poll(() => kms(page)).toEqual(['km 8.1', 'km 5.0', 'km 2.4'])

  await page.getByRole('combobox').selectOption('7')
  await expect(page).toHaveURL(/auto=7/)
  await expect.poll(() => kms(page)).toEqual(['km 8.1', 'km 5.0'])

  // Recargar conserva orden y filtro (están en la URL).
  await page.reload()
  await expect.poll(() => kms(page)).toEqual(['km 8.1', 'km 5.0'])
})

test('el video se carga recién al tocar la miniatura', async ({ page }) => {
  await simular(page)
  await page.goto(`/tramo/${TC1}`)
  const primera = page.getByRole('list', { name: 'Publicaciones' }).locator('article').first()
  await expect(primera.locator('iframe')).toHaveCount(0)
  await primera.getByRole('button', { name: /Reproducir/ }).click()
  await expect(primera.locator('iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie\.com\/embed\/km2/,
  )
})

test('la ficha del auto muestra tripulación, último visto y videos por tramo y km', async ({
  page,
}) => {
  await simular(page)
  await page.goto('/auto/7')
  await expect(page.getByRole('heading', { level: 1, name: 'Ana Pérez' })).toBeVisible()
  await expect(page.getByText('Leo Díaz')).toBeVisible()
  await expect(page.getByText('Fabia · Rally2')).toBeVisible()
  await expect(page.getByText(/Último visto:\s*TC2 · km 1.2/)).toBeVisible()

  const lista = page.getByRole('list', { name: 'Publicaciones del auto' })
  await expect
    .poll(() => lista.locator('article header p:first-child').allTextContents())
    .toEqual(['TC1 · km 5.0', 'TC1 · km 8.1', 'TC2 · km 1.2'])
})
