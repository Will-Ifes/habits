import 'dotenv/config'
import { createDatabase } from '../src/lib/database'
import { asDate, asKey, todayKey } from '../src/dates'

const db = createDatabase()
const samples = [
  {
    id: '0730ffac-d039-4194-9571-01aa2aa0efbd',
    title: 'Ler por 20 minutos',
    days: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: '00880d75-a933-4fef-94ab-e05744435297',
    title: 'Movimentar o corpo',
    days: [1, 2, 3, 4, 5],
  },
  {
    id: 'fa1a1bcf-3d87-4626-8c0d-d7fd1255ac00',
    title: 'Beber 2 litros de água',
    days: [0, 1, 2, 3, 4, 5, 6],
  },
]
async function seed() {
  const today = asDate(todayKey())
  const start = new Date(today.getTime() - 60 * 86400000)
  for (const sample of samples) {
    // Existing habits and their history are never reset by the demo seed.
    if (await db.habit.findUnique({ where: { id: sample.id } })) continue
    await db.habit.create({
      data: {
        id: sample.id,
        title: sample.title,
        created_at: start,
        weekDays: { create: sample.days.map((week_day) => ({ week_day })) },
      },
    })
    for (let index = 0; index < 60; index++) {
      const date = new Date(start.getTime() + index * 86400000)
      if (!sample.days.includes(date.getUTCDay()) || (index + samples.indexOf(sample)) % 7 === 0)
        continue
      const day = await db.day.upsert({ where: { date }, update: {}, create: { date } })
      await db.dayHabit.create({ data: { day_id: day.id, habit_id: sample.id } })
    }
  }
  console.log(`Demonstração pronta até ${asKey(today)}. Seus hábitos existentes foram preservados.`)
}
seed()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
