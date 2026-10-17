import { expect, type Page, type Route, test } from '@playwright/test'

// El panel se prueba contra una API de Supabase simulada (page.route): verifica la
// interfaz y lo que se envía. Las reglas de la base las cubren las pruebas pgTAP.

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const EVENTO = 'e0000000-0000-4000-8000-000000000001'

async function iniciarComoAdmin(page: Page) {
  const ahora = Math.floor(Date.now() / 1000)
  const sesion = {
    access_token: 'token-de-prueba',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: ahora + 3600,
    refresh_token: 'refresh-de-prueba',
    user: {
      id: ADMIN,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@rallyfy.test',
      is_anonymous: false,
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }
  // Clave de supabase-js para http://127.0.0.1:54321 (URL por defecto sin .env).
  await page.addInitScript((valor) => {
    localStorage.setItem('sb-127-auth-token', valor)
  }, JSON.stringify(sesion))
}

const json = (route: Route, cuerpo: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(cuerpo) })

async function simularApi(page: Page) {
  const enviados: { url: string; metodo: string; cuerpo: unknown }[] = []

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const metodo = req.method()
    if (metodo !== 'GET' && metodo !== 'HEAD') {
      enviados.push({ url: url.pathname, metodo, cuerpo: req.postDataJSON() })
    }

    switch (url.pathname) {
      case '/rest/v1/perfiles':
        return json(route, { usuario_id: ADMIN, alias: 'Admin', rol: 'admin' })
      case '/rest/v1/eventos':
        return json(route, [
          {
            id: EVENTO,
            nombre: 'Rally de Ejemplo · Fecha 1',
            fecha_inicio: '2026-10-17',
            fecha_fin: '2026-10-18',
            activo: true,
            creado_en: '2026-10-01T00:00:00Z',
          },
        ])
      case '/rest/v1/tramos_publicos':
      case '/rest/v1/inscritos':
        return metodo === 'GET' ? json(route, []) : route.fulfill({ status: 201 })
      case '/rest/v1/tramos':
        return route.fulfill({ status: 201 })
      default:
        return json(route, { message: `ruta no simulada: ${url.pathname}` }, 404)
    }
  })

  return enviados
}

const gpx = `<?xml version="1.0"?>
<gpx version="1.1" creator="e2e" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
  <trkpt lat="-31.40" lon="-64.60"/><trkpt lat="-31.39" lon="-64.61"/><trkpt lat="-31.38" lon="-64.62"/>
</trkseg></trk></gpx>`

test.beforeEach(async ({ page }) => {
  await iniciarComoAdmin(page)
})

test('lista eventos y carga un tramo desde GPX invirtiendo el sentido', async ({ page }) => {
  const enviados = await simularApi(page)
  const erroresConsola: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') erroresConsola.push(m.text())
  })
  await page.goto('/admin')

  await expect(page.getByRole('heading', { level: 1, name: 'Administración' })).toBeVisible()
  await expect(page.getByText('Rally de Ejemplo · Fecha 1')).toBeVisible()
  await expect(page.getByText('Activo', { exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Gestionar' }).click()
  await expect(page.getByText('Este evento todavía no tiene tramos.')).toBeVisible()

  await page.getByLabel('Archivo del trazado').setInputFiles({
    name: 'tc1.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(gpx),
  })
  await expect(page.getByText(/tc1\.gpx: 3 puntos · 2\.\d\d km/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Mapa de trazados' })).toBeVisible()
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('tc1')

  await page.getByRole('button', { name: 'Invertir sentido' }).click()
  await page.getByLabel('Código').fill('tc1')
  await page.getByRole('button', { name: 'Guardar tramo' }).click()
  await expect(page.getByText('Tramo guardado.')).toBeVisible()
  // Por ejemplo, "Worker failed to load" si MapLibre no encuentra su worker.
  expect(erroresConsola).toEqual([])

  const alta = enviados.find((e) => e.url === '/rest/v1/tramos' && e.metodo === 'POST')
  expect(alta?.cuerpo).toEqual({
    evento_id: EVENTO,
    codigo: 'TC1',
    nombre: 'tc1',
    orden: 1,
    trazado: 'SRID=4326;LINESTRING(-64.62 -31.38,-64.61 -31.39,-64.6 -31.4)',
    hora_inicio_prevista: null,
  })
})

test('importa inscritos desde CSV mostrando los errores por fila', async ({ page }) => {
  const enviados = await simularApi(page)
  await page.goto(`/admin/evento/${EVENTO}?seccion=inscritos`)

  await page.getByLabel('Archivo CSV').setInputFiles({
    name: 'inscritos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'numero,piloto,copiloto,auto,clase\n1,Ana,Leo,Fabia,Rally2\nx,Mal,,,\n7,Juan,,,\n',
    ),
  })
  await expect(page.getByText('Fila 3: Número inválido: "x"')).toBeVisible()

  await page.getByRole('button', { name: 'Importar 2 inscritos' }).click()
  await expect(page.getByText('Inscritos importados.')).toBeVisible()

  const upsert = enviados.find((e) => e.url === '/rest/v1/inscritos' && e.metodo === 'POST')
  expect(upsert?.cuerpo).toEqual([
    {
      numero: 1,
      piloto: 'Ana',
      copiloto: 'Leo',
      auto: 'Fabia',
      clase: 'Rally2',
      evento_id: EVENTO,
    },
    { numero: 7, piloto: 'Juan', copiloto: null, auto: null, clase: null, evento_id: EVENTO },
  ])
})

test('sin sesión de equipo pide el correo', async ({ page, context }) => {
  await context.clearCookies()
  await page.addInitScript(() => localStorage.clear())
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Acceso para el equipo' })).toBeVisible()
})
