import { expect, test } from '@playwright/test'

test('la navegación inferior lleva a cada sección', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Página no encontrada')).toBeHidden()

  const nav = page.getByRole('navigation', { name: 'Principal' })
  await nav.getByRole('link', { name: 'Mapa' }).click()
  await expect(page).toHaveURL(/\/mapa$/)

  await nav.getByRole('link', { name: 'Enviar' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Enviar mi video' })).toBeVisible()
})

test('no hay scroll horizontal en el celular', async ({ page }) => {
  await page.goto('/')
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(desborde).toBe(false)
})
