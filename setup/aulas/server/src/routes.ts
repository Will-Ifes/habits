import { FastifyInstance } from 'fastify'
import { PrismaClient } from './generated/prisma/client'
import { z } from 'zod'
import { asDate, asKey, dateSchema, todayKey } from './dates'

const titleSchema = z.string().trim().min(1, 'Dê um nome ao hábito.').max(100)
const idSchema = z.object({ id: z.string().uuid() })
const habitSchema = z.object({
  title: titleSchema,
  weekDays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((days) => new Set(days).size === days.length, 'Não repita dias da semana.'),
})

export function registerRoutes(app: FastifyInstance, db: PrismaClient) {
  app.get('/health', async () => ({ status: 'ok', today: todayKey() }))
  app.post('/habits', async (request, reply) => {
    const { title, weekDays } = habitSchema.parse(request.body)
    const habit = await db.habit.create({
      data: {
        title,
        created_at: asDate(todayKey()),
        weekDays: { create: weekDays.map((week_day) => ({ week_day })) },
      },
      include: { weekDays: true },
    })
    return reply.code(201).send(habit)
  })
  app.get('/habits', async () =>
    db.habit.findMany({
      include: { weekDays: true },
      orderBy: [{ created_at: 'asc' }, { title: 'asc' }],
    })
  )
  app.patch('/habits/:id', async (request, reply) => {
    const { id } = idSchema.parse(request.params)
    const { title } = z.object({ title: titleSchema }).parse(request.body)
    if (!(await db.habit.findUnique({ where: { id } })))
      return reply.code(404).send({ message: 'Hábito não encontrado.' })
    return db.habit.update({ where: { id }, data: { title } })
  })
  app.delete('/habits/:id', async (request, reply) => {
    const { id } = idSchema.parse(request.params)
    if (!(await db.habit.findUnique({ where: { id } })))
      return reply.code(404).send({ message: 'Hábito não encontrado.' })
    await db.$transaction([
      db.dayHabit.deleteMany({ where: { habit_id: id } }),
      db.habitWeekDays.deleteMany({ where: { habit_id: id } }),
      db.habit.delete({ where: { id } }),
    ])
    return reply.code(204).send()
  })
  app.get('/day', async (request) => {
    const { date } = z.object({ date: dateSchema }).parse(request.query)
    const parsed = asDate(date)
    const possibleHabits = await db.habit.findMany({
      where: { created_at: { lte: parsed }, weekDays: { some: { week_day: parsed.getUTCDay() } } },
      orderBy: [{ created_at: 'asc' }, { title: 'asc' }],
    })
    const day = await db.day.findUnique({ where: { date: parsed }, include: { dayHabits: true } })
    const possible = new Set(possibleHabits.map((habit) => habit.id))
    return {
      possibleHabits,
      completedHabits: (day?.dayHabits || [])
        .map((habit) => habit.habit_id)
        .filter((id) => possible.has(id)),
    }
  })
  // Idempotent completion: retries cannot undo a check-in.
  app.put('/habits/:id/completion', async (request, reply) => {
    const { id } = idSchema.parse(request.params)
    const { date, completed } = z
      .object({ date: dateSchema, completed: z.boolean() })
      .parse(request.body)
    if (date > todayKey())
      return reply.code(400).send({ message: 'Dias futuros ainda não podem ser marcados.' })
    const parsed = asDate(date)
    const habit = await db.habit.findUnique({ where: { id }, include: { weekDays: true } })
    if (!habit) return reply.code(404).send({ message: 'Hábito não encontrado.' })
    if (
      habit.created_at > parsed ||
      !habit.weekDays.some((day) => day.week_day === parsed.getUTCDay())
    ) {
      return reply.code(400).send({ message: 'Este hábito não está previsto para essa data.' })
    }
    await db.$transaction(async (tx) => {
      const day = await tx.day.upsert({
        where: { date: parsed },
        update: {},
        create: { date: parsed },
      })
      const key = { day_id: day.id, habit_id: id }
      if (completed)
        await tx.dayHabit.upsert({ where: { day_id_habit_id: key }, update: {}, create: key })
      else await tx.dayHabit.deleteMany({ where: key })
    })
    return { completed }
  })
  app.get('/summary', async (request) => {
    const { year } = z
      .object({
        year: z.coerce
          .number()
          .int()
          .min(2000)
          .max(2100)
          .default(Number(todayKey().slice(0, 4))),
      })
      .parse(request.query)
    const start = asDate(`${year}-01-01`)
    const end = asDate(`${year + 1}-01-01`)
    const [habits, days] = await Promise.all([
      db.habit.findMany({ where: { created_at: { lt: end } }, include: { weekDays: true } }),
      db.day.findMany({ where: { date: { gte: start, lt: end } }, include: { dayHabits: true } }),
    ])
    const recorded = new Map(days.map((day) => [asKey(day.date), day]))
    const summary = []
    for (let date = start; date < end; date = new Date(date.getTime() + 86400000)) {
      const key = asKey(date)
      const possible = habits.filter(
        (habit) =>
          habit.created_at <= date &&
          habit.weekDays.some((day) => day.week_day === date.getUTCDay())
      )
      const ids = new Set(possible.map((habit) => habit.id))
      summary.push({
        date: key,
        amount: possible.length,
        completed:
          recorded.get(key)?.dayHabits.filter((habit) => ids.has(habit.habit_id)).length || 0,
      })
    }
    return summary
  })
}
