import { test, expect } from '@playwright/test'

test.afterEach(async ({ request }) => {
  const response = await request.get('http://127.0.0.1:3334/api/habits')
  for (const habit of await response.json()) {
    await request.delete(`http://127.0.0.1:3334/api/habits/${habit.id}`)
  }
})

test('create, check, reload, uncheck, rename and delete a habit', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const name = `Ler um capítulo ${testInfo.project.name}`
  const renamed = `Leitura diária ${testInfo.project.name}`
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Vamos fazer acontecer?' })).toBeVisible()
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Qual hábito você quer cultivar?').fill(name)
  await page.getByRole('button', { name: 'Começar meu hábito' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const row = page.getByRole('checkbox', { name: new RegExp(name) })
  await expect(row).toHaveAttribute('aria-checked', 'false')
  await row.click()
  await expect(row).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await expect(row).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  )
  expect(overflow).toBe(false)
  await row.click()
  await expect(row).toHaveAttribute('aria-checked', 'false')
  await page.getByText('Gerenciar', { exact: true }).click()
  await page.getByRole('button', { name: `Renomear ${name}`, exact: true }).click()
  await page.getByLabel('Qual hábito você quer cultivar?').fill(renamed)
  await page.getByRole('button', { name: 'Salvar nome', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('checkbox', { name: new RegExp(renamed) })).toBeVisible()
  await page.getByRole('button', { name: `Excluir ${renamed}`, exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('também remove todas as suas marcações')
  await page.getByRole('button', { name: 'Manter hábito', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: new RegExp(renamed) })).toBeVisible()
  await page.getByRole('button', { name: `Excluir ${renamed}`, exact: true }).click()
  await page.getByRole('button', { name: 'Excluir hábito', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await expect(page.getByRole('checkbox', { name: new RegExp(renamed) })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('calendar, history and retry recover without stale checkboxes', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Vamos fazer acontecer?' })).toBeVisible()
  await page.getByRole('button', { name: 'Mês anterior' }).click()
  await expect(page.getByRole('heading', { name: 'Sua rotina nesse dia' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar para hoje' }).click()
  await expect(page.getByRole('heading', { name: 'Vamos fazer acontecer?' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Ano do histórico' }).selectOption('2024')
  await expect(page.getByRole('button', { name: /^Histórico 2024-/ })).toHaveCount(366)
  await expect(page.getByRole('button', { name: 'Histórico 2024-02-29: 0 de 0' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar para hoje' }).click()
  await expect(page.getByRole('heading', { name: 'Vamos fazer acontecer?' })).toBeVisible()
  await page.route('**/api/day?*', (route) =>
    route.fulfill({ status: 503, json: { message: 'Falha simulada de conexão.' } })
  )
  await page.getByRole('button', { name: 'Mês anterior' }).click()
  await expect(page.getByRole('alert')).toContainText('Falha simulada')
  await page.unroute('**/api/day?*')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('Atualizando sua rotina…')).toHaveCount(0)
})
