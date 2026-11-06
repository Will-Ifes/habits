import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript((theme) => {
    if (!localStorage.getItem('will-labs:habits:theme'))
      localStorage.setItem('will-labs:habits:theme', theme)
  }, String(testInfo.project.metadata.theme))
})

test('static app persists habits, uses the project base and never requests an API', async ({
  page,
}) => {
  const apiRequests: string[] = []
  const errors: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api')) apiRequests.push(request.url())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('./')
  await expect(page.getByText('Toda mudança tem um começo')).toBeVisible()
  await expect(page.getByText('Seus hábitos ficam neste navegador', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  await page.getByLabel('Qual hábito você quer cultivar?').fill('Ler por 20 minutos')
  await page.getByRole('button', { name: 'Começar meu hábito' }).click()
  const row = page.getByRole('checkbox', { name: /Ler por 20 minutos/ })
  await expect(row).toHaveAttribute('aria-checked', 'false')
  await row.click()
  await expect(row).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(row).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await page.getByRole('link', { name: 'Habits, início' }).click()
  await expect(page).toHaveURL(/\/habits\/$/)
  await expect(row).toHaveAttribute('aria-checked', 'true')
  await page.getByText('Gerenciar', { exact: true }).click()
  await page.getByRole('button', { name: 'Renomear Ler por 20 minutos' }).click()
  await page.getByLabel('Qual hábito você quer cultivar?').fill('Ler um capítulo')
  await page.getByRole('button', { name: 'Salvar nome' }).click()
  await expect(page.getByRole('checkbox', { name: /Ler um capítulo/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await page.getByRole('button', { name: 'Excluir Ler um capítulo' }).click()
  await page.getByRole('button', { name: 'Excluir hábito', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /Ler um capítulo/ })).toHaveCount(0)
  expect(apiRequests).toEqual([])
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test('backup round-trip restores habits and check-ins with explicit confirmation', async ({
  page,
}, testInfo) => {
  await page.goto('./')
  const today = await page.evaluate(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const id = '0730ffac-d039-4194-9571-01aa2aa0efbd'
  const backup = {
    version: 1,
    habits: [
      {
        id,
        title: 'Beber água',
        created_at: `${today}T00:00:00.000Z`,
        weekDays: [0, 1, 2, 3, 4, 5, 6].map((week_day) => ({ week_day })),
      },
    ],
    completions: { [today]: [id] },
  }
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'habits.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await expect(page.getByRole('dialog')).toContainText('A importação substitui')
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /Beber água/ })).toHaveCount(0)
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'habits.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await page.getByRole('button', { name: 'Restaurar backup' }).click()
  await expect(page.getByRole('checkbox', { name: /Beber água/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup' }).click()
  const download = await downloadEvent
  const file = testInfo.outputPath('backup.json')
  await download.saveAs(file)
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(backup)
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /Beber água/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await page.getByLabel('Arquivo de backup').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  })
  await expect(page.getByRole('alert')).toContainText('Arquivo inválido')
  await expect(page.getByRole('checkbox', { name: /Beber água/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )
})

test('theme persists and axe finds no violations on the populated dashboard and form', async ({
  page,
}, testInfo) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Vamos fazer acontecer?' })).toBeVisible()
  const theme = String(testInfo.project.metadata.theme)
  await expect(page.locator('html')).toHaveAttribute('data-tema', theme)
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  await page.getByLabel('Qual hábito você quer cultivar?').fill('Caminhar no parque')
  await page.getByRole('button', { name: 'Começar meu hábito' }).click()
  await expect(page.getByRole('checkbox', { name: /Caminhar no parque/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const dashboard = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(dashboard.violations).toEqual([])
  await page
    .getByRole('button', { name: theme === 'paper' ? 'Usar tema Floresta' : 'Usar tema Papel' })
    .click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute(
    'data-tema',
    theme === 'paper' ? 'forest' : 'paper'
  )
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  const form = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(form.violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Novo hábito', exact: true })).toBeFocused()
})

test('corrupted or blocked storage never pretends a habit was saved', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('will-labs:habits:v1', '{invalid')
  })
  await page.goto('./')
  await expect(page.getByRole('alert')).toContainText('Não foi possível ler seus dados salvos')
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar backup' }).click()
  await exported
  expect(await page.evaluate(() => localStorage.getItem('will-labs:habits:v1'))).toBe('{invalid')
  await page.evaluate(() => localStorage.removeItem('will-labs:habits:v1'))
  // Reload without repeating the corrupt-storage setup script.
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('heading', { name: 'Vamos fazer acontecer?' })).toBeVisible()
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
  })
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  await page.getByLabel('Qual hábito você quer cultivar?').fill('Não deve ser perdido')
  await page.getByRole('button', { name: 'Começar meu hábito' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Não foi possível salvar')
  expect(await page.evaluate(() => localStorage.getItem('will-labs:habits:v1'))).toBeNull()
})
