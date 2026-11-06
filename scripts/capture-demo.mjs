import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4175/habits/'
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1366, height: 1100 },
  timezoneId: 'America/Sao_Paulo',
})
const page = await context.newPage()
const frames = '.tools/demo-frames'
await mkdir(frames, { recursive: true })
await mkdir('.github/screenshots', { recursive: true })
let frame = 0
async function capture() {
  await page.screenshot({ path: `${frames}/${String(frame++).padStart(2, '0')}.png` })
}
try {
  await page.goto(base)
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).waitFor()
  const state = await page.evaluate(() => {
    const date = new Date()
    const key = (value) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    const today = key(date)
    const start = new Date(date)
    start.setDate(start.getDate() - 60)
    const definitions = [
      ['0730ffac-d039-4194-9571-01aa2aa0efbd', 'Ler por 20 minutos', [0, 1, 2, 3, 4, 5, 6]],
      ['00880d75-a933-4fef-94ab-e05744435297', 'Movimentar o corpo', [1, 2, 3, 4, 5]],
      ['fa1a1bcf-3d87-4626-8c0d-d7fd1255ac00', 'Beber 2 litros de água', [0, 1, 2, 3, 4, 5, 6]],
    ]
    const habits = definitions.map(([id, title, days]) => ({
      id,
      title,
      created_at: `${key(start)}T00:00:00.000Z`,
      weekDays: days.map((week_day) => ({ week_day })),
    }))
    const completions = {}
    for (let index = 0; index < 60; index++) {
      const current = new Date(start)
      current.setDate(current.getDate() + index)
      const ids = habits
        .filter(
          (habit, position) =>
            habit.weekDays.some((day) => day.week_day === current.getDay()) &&
            (index + position) % 7 !== 0
        )
        .map((habit) => habit.id)
      if (ids.length) completions[key(current)] = ids
    }
    completions[today] = [habits[0].id, habits[2].id]
    return { version: 1, habits, completions }
  })
  await page.evaluate((state) => {
    localStorage.setItem('will-labs:habits:v1', JSON.stringify(state))
    localStorage.setItem('will-labs:habits:theme', 'paper')
  }, state)
  await page.reload()
  await page.getByRole('checkbox').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '.github/screenshots/desktop.png', fullPage: true })
  await capture()
  await page.getByRole('checkbox', { name: /Movimentar o corpo/ }).click()
  await page.waitForFunction(
    () => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '100'
  )
  await capture()
  await page.getByRole('button', { name: 'Novo hábito', exact: true }).click()
  await capture()
  await page.getByLabel('Qual hábito você quer cultivar?').fill('Reservar 10 minutos para mim')
  await capture()
  await page.getByRole('button', { name: 'Começar meu hábito' }).click()
  await page.getByRole('checkbox', { name: /Reservar 10 minutos/ }).waitFor()
  await capture()
  await page.getByRole('button', { name: 'Usar tema Floresta' }).click()
  await page.waitForFunction(() => document.documentElement.dataset.tema === 'forest')
  await page.screenshot({ path: '.github/screenshots/forest.png', fullPage: true })
  await capture()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '.github/screenshots/mobile.png', fullPage: true })
  console.log('Capturas e seis quadros reais da demonstração salvos.')
} finally {
  await browser.close()
}
