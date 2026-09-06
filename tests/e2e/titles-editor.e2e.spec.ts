import { test, expect } from '@playwright/test'
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100'
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'steve@volence.dev'
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'breakglass-dev-only-1'
// Deliberately NOT the break-glass admin's own id (764): that account's stored role is
// 'admin', so resolveAccess's staff bypass reports every department as 'lead' regardless
// of titles, which would make the member -> lead assertions below unobservable. This id
// is an existing plain 'user' row in the dev seed with no titles/departments set, so it
// starts every department at 'none' and shows the title-driven level changes we're testing.
const PERSON_ID = process.env.E2E_PERSON_ID || '182'

test.describe('Titles editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin/login?breakglass=1`)
    await page.getByLabel(/email|username/i).fill(EMAIL)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /log ?in/i }).click()
    // Not page.waitForURL(/\/admin(\/|$|\?)/): the login page itself is already at
    // /admin/login?breakglass=1, which that pattern matches, so it resolves before the
    // post-submit redirect happens and the next navigation races the login request.
    // Waiting for the login form to disappear (same signal identity-login.e2e.spec.ts
    // checks) actually waits for the session to take effect.
    await expect(page.locator('.login form')).toBeHidden()
  })

  test('titles section shows lead toggle only on lead-capable titles and computes effective access', async ({ page }) => {
    await page.goto(`${BASE}/admin/edit-person?id=${PERSON_ID}`)
    const titles = page.getByTestId('titles-section')
    await expect(titles).toBeVisible()
    await titles.getByRole('button', { name: /add title/i }).click()
    await titles.getByTestId('add-title-select').selectOption('caster')
    await expect(titles.getByTestId('title-row-caster').getByLabel(/lead/i)).toBeVisible()
    await titles.getByRole('button', { name: /add title/i }).click()
    await titles.getByTestId('add-title-select').selectOption('observer')
    await expect(titles.getByTestId('title-row-observer').getByLabel(/lead/i)).toHaveCount(0)
    await expect(page.getByTestId('effective-access').getByText(/production.*member/i)).toBeVisible()
    await titles.getByTestId('title-row-caster').getByLabel(/lead/i).check()
    await expect(page.getByTestId('effective-access').getByText(/production.*lead/i)).toBeVisible()
  })
})
