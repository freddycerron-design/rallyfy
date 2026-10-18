import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('la app es instalable: manifest, íconos y service worker activo', async ({ page }) => {
  await page.goto('/enviar')

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href')
    return href ? (await fetch(href)).json() : null
  })
  expect(manifest).toMatchObject({ name: 'Muro Rally', display: 'standalone', lang: 'es-419' })
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  )
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)

  // `ready` se resuelve en 'activating'; activa del todo cuando termina el precache.
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated')
})

test('el app shell queda en la caché para abrir sin conexión', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  // Playwright intercepta las navegaciones antes que el service worker, así que en vez de
  // simular la caída se verifica la caché que usa el service worker para responder offline.
  const cache = await page.evaluate(async () => {
    const scriptPrincipal = document.querySelector<HTMLScriptElement>('script[type="module"]')?.src
    const urls = (
      await Promise.all(
        (await caches.keys()).map(async (n) =>
          (await (await caches.open(n)).keys()).map((r) => r.url),
        ),
      )
    ).flat()
    return {
      html: urls.some((u) => new URL(u).pathname === '/index.html'),
      script: !!scriptPrincipal && urls.some((u) => u.split('?')[0] === scriptPrincipal),
      sinMapLibre: !urls.some((u) => u.includes('/assets/mapaBase-')),
      sinPanelEquipo: !urls.some((u) => /\/assets\/Pagina(Admin|Moderacion)-/.test(u)),
    }
  })
  expect(cache).toEqual({ html: true, script: true, sinMapLibre: true, sinPanelEquipo: true })
})

test('avisa cuando se pierde la conexión', async ({ page, context }) => {
  await page.goto('/enviar')
  await expect(page.getByRole('heading', { level: 1, name: 'Enviar mi video' })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByText(/Sin conexión/)).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByText(/Sin conexión/)).toBeHidden()
})
