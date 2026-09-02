import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

test.describe('Admin login screen', () => {
  test('shows only the Discord button by default', async ({ page }) => {
    await page.goto(`${BASE}/admin/login`)
    await expect(page.getByRole('link', { name: /login with discord/i })).toBeVisible()
    await expect(page.locator('.login form')).toBeHidden()
  })

  test('shows the password form with ?breakglass=1', async ({ page }) => {
    await page.goto(`${BASE}/admin/login?breakglass=1`)
    await expect(page.locator('.login form')).toBeVisible()
    await expect(page.getByRole('link', { name: /login with discord/i })).toBeVisible()
  })
})
