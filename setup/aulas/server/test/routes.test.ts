import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDatabase } from '../src/lib/database'
import { buildApp } from '../src/app'
import { asDate, dateSchema, todayKey } from '../src/dates'

const file = resolve('prisma', `test-${randomUUID()}.db`)
const url = `file:${file.replaceAll('\\', '/')}`
const db = createDatabase(url)
const app = buildApp(db)
const today = todayKey()
const weekday = asDate(today).getUTCDay()

before(async () => {
  writeFileSync(file, '')
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  })
  await app.ready()
})
beforeEach(async () => {
  await db.dayHabit.deleteMany()
  await db.habitWeekDays.deleteMany()
  await db.habit.deleteMany()
  await db.day.deleteMany()
})
after(async () => {
  await app.close()
  await db.$disconnect()
  rmSync(file, { force: true })
  rmSync(`${file}-journal`, { force: true })
})
async function create(weekDays = [weekday], title = 'Ler 20 minutos') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/habits',
    payload: { title, weekDays },
  })
  assert.equal(response.statusCode, 201, response.body)
  return response.json()
}
async function mark(id: string, completed: boolean, date = today) {
  return app.inject({
    method: 'PUT',
    url: `/api/habits/${id}/completion`,
    payload: { date, completed },
  })
}

test('today uses São Paulo even near the UTC midnight boundary', () => {
  const previous = process.env.APP_TIMEZONE
  process.env.APP_TIMEZONE = 'America/Sao_Paulo'
  assert.equal(todayKey(new Date('2026-11-06T01:30:00Z')), '2026-11-05')
  assert.equal(todayKey(new Date('2026-11-06T03:30:00Z')), '2026-11-06')
  if (previous === undefined) delete process.env.APP_TIMEZONE
  else process.env.APP_TIMEZONE = previous
})

test('rejects invalid calendar dates including leap days', async () => {
  for (const date of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-1-1', 'no-date']) {
    assert.equal(dateSchema.safeParse(date).success, false)
    assert.equal((await app.inject(`/api/day?date=${date}`)).statusCode, 400)
  }
  assert.equal(dateSchema.safeParse('2024-02-29').success, true)
})

test('validates and trims names and requires unique integer weekdays', async () => {
  for (const payload of [
    { title: ' ', weekDays: [1] },
    { title: 'x'.repeat(101), weekDays: [1] },
    { title: 'Ler', weekDays: [] },
    { title: 'Ler', weekDays: [1, 1] },
    { title: 'Ler', weekDays: [1.5] },
    { title: 'Ler', weekDays: [7] },
  ]) {
    assert.equal(
      (await app.inject({ method: 'POST', url: '/api/habits', payload })).statusCode,
      400
    )
  }
  assert.equal((await create([weekday], '  Ler  ')).title, 'Ler')
})

test('new day always returns completion array and only scheduled habits', async () => {
  const habit = await create()
  await create([(weekday + 1) % 7], 'Outro dia')
  const response = await app.inject(`/api/day?date=${today}`)
  assert.deepEqual(response.json().completedHabits, [])
  assert.deepEqual(
    response.json().possibleHabits.map((value: { id: string }) => value.id),
    [habit.id]
  )
})

test('completion is persisted, idempotent and reversible', async () => {
  const habit = await create()
  assert.equal((await mark(habit.id, true)).statusCode, 200)
  assert.equal((await mark(habit.id, true)).statusCode, 200)
  assert.equal(await db.dayHabit.count(), 1)
  assert.deepEqual((await app.inject(`/api/day?date=${today}`)).json().completedHabits, [habit.id])
  assert.equal((await mark(habit.id, false)).statusCode, 200)
  assert.equal((await mark(habit.id, false)).statusCode, 200)
  assert.equal(await db.dayHabit.count(), 0)
})

test('supports past check-ins without modifying today', async () => {
  const habit = await create([0, 1, 2, 3, 4, 5, 6])
  const yesterday = new Date(asDate(today).getTime() - 86400000).toISOString().slice(0, 10)
  await db.habit.update({ where: { id: habit.id }, data: { created_at: asDate(yesterday) } })
  assert.equal((await mark(habit.id, true, yesterday)).statusCode, 200)
  assert.deepEqual((await app.inject(`/api/day?date=${today}`)).json().completedHabits, [])
  assert.deepEqual((await app.inject(`/api/day?date=${yesterday}`)).json().completedHabits, [
    habit.id,
  ])
})

test('refuses future days, days before creation and unscheduled days', async () => {
  const habit = await create([(weekday + 1) % 7])
  assert.equal((await mark(habit.id, true)).statusCode, 400)
  assert.equal((await mark(habit.id, true, '2100-01-01')).statusCode, 400)
  assert.equal((await mark(habit.id, true, '2000-01-01')).statusCode, 400)
  assert.equal(await db.dayHabit.count(), 0)
})

test('unknown habit and invalid identifiers return useful status codes', async () => {
  assert.equal((await mark(randomUUID(), true)).statusCode, 404)
  assert.equal((await mark('invalid', true)).statusCode, 400)
  assert.equal(
    (await app.inject({ method: 'DELETE', url: `/api/habits/${randomUUID()}` })).statusCode,
    404
  )
})

test('summary includes scheduled days without check-ins and matches daily counts', async () => {
  const habit = await create()
  const year = Number(today.slice(0, 4))
  let entries = (await app.inject(`/api/summary?year=${year}`)).json()
  assert.equal(entries.length, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365)
  assert.deepEqual(
    entries.find((entry: { date: string }) => entry.date === today),
    { date: today, amount: 1, completed: 0 }
  )
  await mark(habit.id, true)
  entries = (await app.inject(`/api/summary?year=${year}`)).json()
  assert.deepEqual(
    entries.find((entry: { date: string }) => entry.date === today),
    { date: today, amount: 1, completed: 1 }
  )
  assert.equal((await app.inject('/api/summary?year=oops')).statusCode, 400)
})

test('renaming preserves recurrence and completion history', async () => {
  const habit = await create()
  await mark(habit.id, true)
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/habits/${habit.id}`,
    payload: { title: 'Ler um capítulo' },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.json().title, 'Ler um capítulo')
  assert.equal(await db.dayHabit.count(), 1)
  assert.equal(await db.habitWeekDays.count(), 1)
})

test('deleting removes dependent records without foreign-key errors', async () => {
  const habit = await create()
  await mark(habit.id, true)
  const response = await app.inject({ method: 'DELETE', url: `/api/habits/${habit.id}` })
  assert.equal(response.statusCode, 204)
  assert.equal(await db.dayHabit.count(), 0)
  assert.equal(await db.habitWeekDays.count(), 0)
  assert.equal(await db.habit.count(), 0)
})
