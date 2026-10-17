import { expect, type Page, type Route, test } from '@playwright/test'

// Flujo del aficionado contra servicios simulados (Supabase, Turnstile y la Edge
// Function). La lógica del servidor se prueba en supabase/functions/_shared/*.test.ts.

const EVENTO = 'e0000000-0000-4000-8000-000000000001'
const TC1 = 'a0000000-0000-4000-8000-000000000001'
const TC2 = 'a0000000-0000-4000-8000-000000000002'
const FAN = '00000000-0000-4000-8000-0000000000f9'

const json = (route: Route, cuerpo: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) })

const tramo = (id: string, codigo: string, orden: number, coords: [number, number][]) => ({
  id,
  evento_id: EVENTO,
  codigo,
  nombre: `Tramo ${codigo}`,
  orden,
  longitud_km: 10,
  hora_inicio_prevista: null,
  estado: 'en_curso',
  trazado_geojson: { type: 'LineString', coordinates: coords },
  publicaciones_aprobadas: 0,
})

type Simulacion = {
  envios: Record<string, unknown>[]
  registrosAnonimos: Record<string, unknown>[]
}

async function simular(page: Page, respuestaFuncion?: { status: number; cuerpo: unknown }) {
  const sim: Simulacion = { envios: [], registrosAnonimos: [] }

  // Turnstile: entrega un token nuevo al renderizar y en cada reset.
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = {
        n: 0,
        render(el, o) { this.o = o; this.emitir(); return 'w1' },
        emitir() { const t = 'token-' + (++this.n); setTimeout(() => this.o.callback(t), 30) },
        reset() { this.emitir() },
        remove() {},
      }`,
    }),
  )

  await page.route('**/auth/v1/signup', async (route) => {
    sim.registrosAnonimos.push(route.request().postDataJSON())
    const ahora = Math.floor(Date.now() / 1000)
    return json(route, {
      access_token: 'token-anonimo',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: ahora + 3600,
      refresh_token: 'refresh',
      user: {
        id: FAN,
        aud: 'authenticated',
        role: 'authenticated',
        is_anonymous: true,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    })
  })

  await page.route('**/rest/v1/**', (route) => {
    const ruta = new URL(route.request().url()).pathname
    switch (ruta) {
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
        return json(route, [
          tramo(TC1, 'TC1', 1, [
            [-64.6, -31.4],
            [-64.68, -31.34],
          ]),
          tramo(TC2, 'TC2', 2, [
            [-64.7, -31.3],
            [-64.78, -31.36],
          ]),
        ])
      case '/rest/v1/inscritos':
        return json(
          route,
          [1, 2, 3, 7, 21].map((n) => ({
            numero: n,
            piloto: `Piloto ${n}`,
            copiloto: null,
            auto: null,
            clase: null,
          })),
        )
      case '/rest/v1/perfiles':
        return route.fulfill({ status: 204 })
      default:
        return json(route, { message: `no simulada: ${ruta}` }, 404)
    }
  })

  await page.route('**/functions/v1/enviar-publicacion', (route) => {
    sim.envios.push(route.request().postDataJSON())
    const r = respuestaFuncion ?? {
      status: 201,
      cuerpo: {
        codigo: 'creada',
        mensaje: '¡Listo! Tu publicación quedó pendiente de revisión.',
        id: 'nueva',
        kmEnTramo: 3.4,
        lejosDelTrazado: false,
      },
    }
    return json(route, r.cuerpo, r.status)
  })

  return sim
}

test.describe('con GPS', () => {
  // A ~30 m del TC2.
  test.use({ geolocation: { latitude: -31.33, longitude: -64.74 }, permissions: ['geolocation'] })

  test('envía un TikTok en menos de 30 segundos con el tramo preseleccionado', async ({ page }) => {
    const sim = await simular(page)
    const inicio = Date.now()
    await page.goto('/enviar')

    await page
      .getByLabel('Enlace')
      .fill('Miren! https://www.tiktok.com/@fan.rally/video/7400000000000000123?x=1')
    await expect(page.getByText('Video de TikTok · @fan.rally')).toBeVisible()

    await expect(page.getByText(/Ubicación detectada \(±\d+ m\)/)).toBeVisible()
    await expect(page.getByRole('radio', { name: /TC2/ })).toBeChecked()
    await expect(page.getByText(/Estás aquí/)).toBeVisible()

    await page.getByRole('button', { name: '7', exact: true }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()
    await expect(page.getByText('Elegiste: #3, #7')).toBeVisible()
    await page.getByLabel('Tu alias (opcional)').fill('La Curva TV')

    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByRole('heading', { name: '¡Gracias!' })).toBeVisible()
    await expect(page.getByText('La ubicamos en el km 3.4 del tramo.')).toBeVisible()
    expect(Date.now() - inicio).toBeLessThan(30_000)

    expect(sim.registrosAnonimos).toHaveLength(1)
    expect(sim.registrosAnonimos[0]).toMatchObject({
      gotrue_meta_security: { captcha_token: 'token-1' },
    })
    expect(sim.envios).toHaveLength(1)
    expect(sim.envios[0]).toMatchObject({
      url: 'Miren! https://www.tiktok.com/@fan.rally/video/7400000000000000123?x=1',
      eventoId: EVENTO,
      tramoId: TC2,
      autos: [3, 7],
      ubicacion: { lat: -31.33, lon: -64.74, origen: 'gps' },
      esEnVivo: false,
      turnstileToken: 'token-2',
    })
  })

  test('muestra el error del servidor si la publicación ya existe', async ({ page }) => {
    await simular(page, {
      status: 409,
      cuerpo: { codigo: 'duplicada', mensaje: 'Esta publicación ya fue enviada.' },
    })
    await page.goto('/enviar')
    await page.getByLabel('Enlace').fill('https://youtu.be/dQw4w9WgXcQ')
    await expect(page.getByText('Video de YouTube')).toBeVisible()
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText('Esta publicación ya fue enviada.')).toBeVisible()
  })

  test('valida el enlace al pegarlo y marca transmisiones en vivo', async ({ page }) => {
    await simular(page)
    await page.goto('/enviar')
    const enlace = page.getByLabel('Enlace')

    await enlace.fill('https://www.instagram.com/reel/abc')
    await expect(
      page.getByText('Por ahora solo aceptamos enlaces de TikTok o YouTube.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled()

    await enlace.fill('https://www.tiktok.com/@fan/live')
    await expect(page.getByText('En vivo de @fan')).toBeVisible()
    await expect(page.getByLabel('Estoy transmitiendo en vivo')).toBeChecked()
  })
})

test('sin permiso de ubicación se marca el punto en el mapa', async ({ page }) => {
  const sim = await simular(page)
  await page.goto('/enviar')

  await page.getByLabel('Enlace').fill('https://youtu.be/dQw4w9WgXcQ')
  await expect(
    page.getByText(/No diste permiso de ubicación|No pudimos obtener tu ubicación/),
  ).toBeVisible()

  await page.getByRole('radio', { name: /TC1/ }).check()
  const mapa = page.getByRole('region', { name: 'Mapa de trazados' })
  await expect(mapa).toBeVisible()
  await page.waitForTimeout(1500) // el estilo del mapa termina de cargar
  await mapa.click({ position: { x: 150, y: 150 } })
  await expect(page.getByText('✓ Punto marcado')).toBeVisible()

  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(page.getByRole('heading', { name: '¡Gracias!' })).toBeVisible()
  expect(sim.envios[0]).toMatchObject({
    tramoId: TC1,
    autos: [],
    ubicacion: { origen: 'manual', precisionM: null },
  })
})
