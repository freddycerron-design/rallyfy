import { expect, type Page, type Route, test } from '@playwright/test'

// Votos y vencimiento de "En vivo ahora" contra servicios simulados.
// Las reglas (un voto por persona, 60 por hora) se prueban en pgTAP 02.

const EVENTO = 'e0000000-0000-4000-8000-000000000001'
const TC1 = 'a0000000-0000-4000-8000-000000000001'
const PUB = 'b0000000-0000-4000-8000-000000000001'
const AHORA = new Date('2026-10-17T15:00:00Z')

const json = (route: Route, cuerpo: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) })

const pub = (id: string, km: number, extra: Record<string, unknown> = {}) => ({
  id,
  evento_id: EVENTO,
  tramo_id: TC1,
  tramo_codigo: 'TC1',
  tramo_nombre: 'Tramo 1',
  tramo_orden: 1,
  plataforma: 'youtube',
  id_externo: 'dQw4w9WgXcQ',
  url_canonica: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  titulo: null,
  autor: null,
  alias: null,
  es_en_vivo: false,
  en_vivo_hasta: null,
  en_vivo_ahora: false,
  autos: [7],
  km_en_tramo: km,
  punto_lon: -64.6,
  punto_lat: -31.4,
  hora_captura: '2026-10-17T14:00:00Z',
  votos: 9,
  aprobada_en: null,
  ...extra,
})

type Opciones = { respuestaVotar?: { status: number; cuerpo: unknown } }

async function simular(page: Page, { respuestaVotar }: Opciones = {}) {
  const registro = { signups: 0, rpc: [] as { ruta: string; cuerpo: unknown }[] }

  await page.route(/youtube-nocookie\.com|i\.ytimg\.com/, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<html></html>' }),
  )
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = { render(el, o) { setTimeout(() => o.callback('token-voto'), 20); return 'w' }, reset() {}, remove() {} }`,
    }),
  )
  await page.route('**/auth/v1/signup', (route) => {
    registro.signups++
    return json(route, {
      access_token: 'token-anonimo',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'r',
      user: {
        id: '00000000-0000-4000-8000-0000000000f9',
        aud: 'authenticated',
        role: 'authenticated',
        is_anonymous: true,
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    })
  })

  let votos = 9
  await page.route('**/rest/v1/**', (route) => {
    const ruta = new URL(route.request().url()).pathname
    switch (ruta) {
      case '/rest/v1/tramos_publicos':
        return json(route, {
          id: TC1,
          evento_id: EVENTO,
          codigo: 'TC1',
          nombre: 'Tramo 1',
          orden: 1,
          longitud_km: 10,
          hora_inicio_prevista: null,
          estado: 'en_curso',
          trazado_geojson: { type: 'LineString', coordinates: [] },
          publicaciones_aprobadas: 2,
        })
      case '/rest/v1/muro_publico':
        return json(route, [
          pub(PUB, 2.0),
          pub('b0000000-0000-4000-8000-000000000002', 4.0, {
            plataforma: 'tiktok',
            id_externo: 'live:@fan',
            url_canonica: 'https://www.tiktok.com/@fan/live',
            es_en_vivo: true,
            en_vivo_ahora: true,
            en_vivo_hasta: new Date(AHORA.getTime() + 5 * 60_000).toISOString(),
            votos: 0,
          }),
        ])
      case '/rest/v1/votos':
        return json(route, [])
      case '/rest/v1/rpc/votar':
        registro.rpc.push({ ruta, cuerpo: route.request().postDataJSON() })
        if (respuestaVotar) return json(route, respuestaVotar.cuerpo, respuestaVotar.status)
        return json(route, ++votos)
      case '/rest/v1/rpc/quitar_voto':
        registro.rpc.push({ ruta, cuerpo: route.request().postDataJSON() })
        return json(route, --votos)
      default:
        return json(route, [])
    }
  })
  return registro
}

test('votar crea la sesión anónima una sola vez y se puede quitar el voto', async ({ page }) => {
  const registro = await simular(page)
  await page.goto(`/tramo/${TC1}`)

  const boton = page.getByRole('button', { name: /^Votar \(9 votos\)$/ })
  await boton.click()
  const votado = page.getByRole('button', { name: 'Quitar voto (10 votos)' })
  await expect(votado).toHaveAttribute('aria-pressed', 'true')
  // El botón cambia antes de que responda el servidor (voto optimista).
  await expect.poll(() => registro.rpc.length).toBe(1)
  expect(registro.signups).toBe(1)
  expect(registro.rpc[0]).toEqual({
    ruta: '/rest/v1/rpc/votar',
    cuerpo: { p_publicacion_id: PUB },
  })

  await votado.click()
  await expect(page.getByRole('button', { name: 'Votar (9 votos)' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect.poll(() => registro.rpc[1]?.ruta).toBe('/rest/v1/rpc/quitar_voto')
  expect(registro.signups).toBe(1)
})

test('si se supera el límite de votos, avisa y vuelve atrás', async ({ page }) => {
  await simular(page, {
    respuestaVotar: {
      status: 429,
      cuerpo: {
        code: 'PT429',
        message: 'Demasiados votos en la última hora; intenta más tarde',
        details: null,
        hint: null,
      },
    },
  })
  await page.goto(`/tramo/${TC1}`)

  await page.getByRole('button', { name: 'Votar (9 votos)' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Demasiados votos en la última hora; intenta más tarde',
  )
  await expect(page.getByRole('button', { name: 'Votar (9 votos)' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
})

test('una transmisión sale de "En vivo ahora" al vencer, sin recargar', async ({ page }) => {
  await page.clock.install({ time: AHORA })
  await simular(page)
  await page.goto(`/tramo/${TC1}`)

  const enVivo = page.getByRole('region', { name: 'En vivo ahora' })
  await expect(enVivo).toBeVisible()
  await expect(enVivo).toContainText('km 4.0')

  await page.clock.fastForward('06:00')
  await expect(enVivo).toBeHidden()
  // Sigue en el muro como publicación, con su enlace a la red social.
  await expect(
    page.getByRole('list', { name: 'Publicaciones' }).getByRole('link', { name: /EN VIVO/ }),
  ).toBeVisible()
})
