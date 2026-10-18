import { expect, type Page, type Route, test } from '@playwright/test'

// Panel de moderación contra una API simulada con estado: cada acción cambia la cola.
// Los permisos reales (solo moderadores) se prueban en supabase/tests (pgTAP).

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

const MOD = '00000000-0000-4000-8000-0000000000a2'
const EVENTO = 'e0000000-0000-4000-8000-000000000001'
const TC1 = 'a0000000-0000-4000-8000-000000000001'
const TC2 = 'a0000000-0000-4000-8000-000000000002'

const json = (route: Route, cuerpo: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) })

const publicacion = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`,
  evento_id: EVENTO,
  tramo_id: TC1,
  plataforma: 'youtube',
  id_externo: `Video000000${n}`.slice(0, 11),
  url_canonica: `https://www.youtube.com/watch?v=Video${n}`,
  url_original: `https://youtu.be/Video${n}`,
  titulo: `Pasada ${n}`,
  autor: null,
  es_en_vivo: false,
  en_vivo_hasta: null,
  autos: [7],
  km_en_tramo: n,
  distancia_al_trazado_m: 20,
  lejos_del_trazado: false,
  origen_ubicacion: 'gps',
  precision_gps_m: 10,
  hora_captura: `2026-10-17T14:0${n}:00Z`,
  creado_en: `2026-10-17T14:0${n}:00Z`,
  ...extra,
})

async function preparar(page: Page) {
  const ahora = Math.floor(Date.now() / 1000)
  await page.addInitScript(
    (valor) => localStorage.setItem('sb-127-auth-token', valor),
    JSON.stringify({
      access_token: 'token-mod',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: ahora + 3600,
      refresh_token: 'r',
      user: {
        id: MOD,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'moderador@rallyfy.test',
        is_anonymous: false,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    }),
  )

  // Los reproductores no se cargan de verdad en las pruebas.
  await page.route(/youtube-nocookie\.com|tiktok\.com\/player|i\.ytimg\.com/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html><body>video</body></html>' }),
  )

  let pendientes = [
    publicacion(1),
    publicacion(2, {
      lejos_del_trazado: true,
      distancia_al_trazado_m: 950,
      origen_ubicacion: 'manual',
      precision_gps_m: null,
    }),
    publicacion(3, { autos: [] }),
  ]
  const enVivo = [
    publicacion(9, {
      plataforma: 'tiktok',
      id_externo: 'live:@fan',
      url_canonica: 'https://www.tiktok.com/@fan/live',
      autor: '@fan',
      es_en_vivo: true,
      en_vivo_hasta: new Date(Date.now() + 3600_000).toISOString(),
    }),
  ]
  const llamadas: Record<string, unknown>[] = []

  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    switch (url.pathname) {
      case '/rest/v1/perfiles':
        return json(route, { usuario_id: MOD, alias: 'Mod', rol: 'moderador' })
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
        return json(
          route,
          [TC1, TC2].map((id, i) => ({
            id,
            evento_id: EVENTO,
            codigo: `TC${i + 1}`,
            nombre: `Tramo ${i + 1}`,
            orden: i + 1,
            longitud_km: 10,
            hora_inicio_prevista: null,
            estado: 'en_curso',
            trazado_geojson: {
              type: 'LineString',
              coordinates: [
                [-64.6, -31.4],
                [-64.7, -31.3],
              ],
            },
            publicaciones_aprobadas: 0,
          })),
        )
      case '/rest/v1/inscritos':
        return json(
          route,
          [3, 7, 9].map((n) => ({
            numero: n,
            piloto: `P${n}`,
            copiloto: null,
            auto: null,
            clase: null,
          })),
        )
      case '/rest/v1/publicaciones':
        return json(route, url.searchParams.get('estado') === 'eq.pendiente' ? pendientes : enVivo)
      case '/rest/v1/rpc/moderar_publicacion': {
        const cuerpo = route.request().postDataJSON()
        llamadas.push(cuerpo)
        if (cuerpo.p_accion === 'aprobar' || cuerpo.p_accion === 'rechazar') {
          pendientes = pendientes.filter((p) => p.id !== cuerpo.p_id)
        }
        return json(route, cuerpo.p_accion === 'rechazar' ? 'rechazada' : 'aprobada')
      }
      default:
        return json(route, { message: `no simulada: ${url.pathname}` }, 404)
    }
  })
  return llamadas
}

test('aprueba con A y rechaza con R + número, la más antigua primero', async ({ page }) => {
  const llamadas = await preparar(page)
  await page.goto('/moderacion')

  await expect(page.getByText('3 pendientes')).toBeVisible()
  await expect(page.getByText('Pasada 1').first()).toBeVisible()

  await page.keyboard.press('a')
  await expect(page.getByText('2 pendientes')).toBeVisible()
  expect(llamadas[0]).toEqual({
    p_id: publicacion(1).id,
    p_accion: 'aprobar',
    p_motivo: null,
    p_tramo_id: null,
    p_autos: null,
  })

  // La siguiente (antes la 2) muestra sus alertas.
  await expect(page.getByText('A 950 m del trazado').first()).toBeVisible()
  await expect(page.getByText('Ubicación marcada a mano').first()).toBeVisible()

  await page.keyboard.press('r')
  await expect(page.getByRole('group', { name: 'Motivo de rechazo' })).toBeVisible()
  await page.keyboard.press('2')
  await expect(page.getByText('1 pendiente', { exact: true })).toBeVisible()
  expect(llamadas[1]).toMatchObject({
    p_id: publicacion(2).id,
    p_accion: 'rechazar',
    p_motivo: 'no_es_del_evento',
  })
})

test('Escape cancela el rechazo y J/K mueven la selección', async ({ page }) => {
  const llamadas = await preparar(page)
  await page.goto('/moderacion')
  await expect(page.getByText('3 pendientes')).toBeVisible()

  await page.keyboard.press('r')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: 'Motivo de rechazo' })).toBeHidden()

  const cola = page.getByRole('navigation', { name: 'Cola de pendientes' })
  await page.keyboard.press('j')
  await page.keyboard.press('j')
  await expect(cola.locator('[aria-current="true"]')).toContainText('km 3.0')
  await page.keyboard.press('k')
  await expect(cola.locator('[aria-current="true"]')).toContainText('km 2.0')
  expect(llamadas).toHaveLength(0)
})

test('corrige tramo y autos y aprueba', async ({ page }) => {
  const llamadas = await preparar(page)
  await page.goto('/moderacion')
  await expect(page.getByText('3 pendientes')).toBeVisible()

  await page.keyboard.press('e')
  await page.getByLabel('Tramo').selectOption({ label: 'TC2 · Tramo 2' })
  await page.getByRole('button', { name: '9', exact: true }).click()
  // Escribir en el formulario no dispara atajos.
  await page.getByLabel('Tramo').press('a')
  expect(llamadas).toHaveLength(0)

  await page.getByRole('button', { name: 'Corregir y aprobar' }).click()
  await expect(page.getByText('2 pendientes')).toBeVisible()
  expect(llamadas[0]).toEqual({
    p_id: publicacion(1).id,
    p_accion: 'aprobar',
    p_motivo: null,
    p_tramo_id: TC2,
    p_autos: [7, 9],
  })
})

test('cierra una transmisión en vivo antes de tiempo', async ({ page }) => {
  const llamadas = await preparar(page)
  await page.goto('/moderacion')

  await expect(page.getByRole('heading', { name: 'En vivo ahora (1)' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar en vivo' }).click()
  await expect
    .poll(() => llamadas.at(-1))
    .toMatchObject({
      p_id: publicacion(9).id,
      p_accion: 'cerrar_en_vivo',
    })
})
