import { z } from 'zod'
import type { Habit, SummaryDay } from './api'
import { addDays, dateObject } from '../utils/dates'

export const STORAGE_KEY = 'will-labs:habits:v1'
export const isBrowserMode = import.meta.env.VITE_STORAGE_MODE === 'browser'
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  })
const titleSchema = z.string().trim().min(1).max(100)
const daysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length)
const habitSchema = z.object({
  id: z.uuid(),
  title: titleSchema,
  created_at: z
    .string()
    .refine(
      (value) =>
        /^\d{4}-\d{2}-\d{2}T00:00:00.000Z$/.test(value) &&
        dateSchema.safeParse(value.slice(0, 10)).success
    ),
  weekDays: z
    .array(z.object({ week_day: z.number().int().min(0).max(6) }))
    .min(1)
    .max(7)
    .refine((days) => new Set(days.map((day) => day.week_day)).size === days.length),
})
const stateSchema = z
  .object({
    version: z.literal(1),
    habits: z.array(habitSchema).max(500),
    completions: z.record(dateSchema, z.array(z.uuid()).max(500)),
  })
  .superRefine((state, context) => {
    const habits = new Map(state.habits.map((habit) => [habit.id, habit]))
    if (habits.size !== state.habits.length)
      context.addIssue({ code: 'custom', message: 'Hábitos repetidos.' })
    for (const [date, ids] of Object.entries(state.completions)) {
      if (new Set(ids).size !== ids.length)
        context.addIssue({ code: 'custom', message: 'Marcações repetidas.' })
      for (const id of ids) {
        const habit = habits.get(id)
        if (
          !habit ||
          habit.created_at.slice(0, 10) > date ||
          !habit.weekDays.some((day) => day.week_day === dateObject(date).getUTCDay())
        ) {
          context.addIssue({ code: 'custom', message: 'Marcação incompatível com a recorrência.' })
        }
      }
    }
  })
export type BrowserState = z.infer<typeof stateSchema>
const empty = (): BrowserState => ({ version: 1, habits: [], completions: {} })
export function localToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseBackup(raw: string): BrowserState {
  try {
    if (raw.length > 1048576) throw new Error()
    return stateSchema.parse(JSON.parse(raw))
  } catch {
    throw new Error('Arquivo inválido. Escolha um backup JSON do Habits com até 1 MB.')
  }
}
function storage() {
  try {
    return window.localStorage
  } catch {
    throw new Error(
      'O navegador bloqueou o armazenamento. Permita salvar dados deste site para usar seus hábitos.'
    )
  }
}
function read(): BrowserState {
  const raw = storage().getItem(STORAGE_KEY)
  if (raw === null) return empty()
  try {
    return parseBackup(raw)
  } catch {
    throw new Error(
      'Não foi possível ler seus dados salvos. Exporte uma cópia antes de restaurar um backup válido.'
    )
  }
}
function write(state: BrowserState) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    throw new Error(
      'Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado. Exporte um backup e verifique as permissões do navegador.'
    )
  }
}
export function exportBackup() {
  return storage().getItem(STORAGE_KEY) ?? JSON.stringify(empty())
}
export function restoreBackup(raw: string) {
  write(parseBackup(raw))
}
const possibleOn = (habits: Habit[], date: string) =>
  habits.filter(
    (habit) =>
      habit.created_at.slice(0, 10) <= date &&
      habit.weekDays.some((day) => day.week_day === dateObject(date).getUTCDay())
  )

export async function browserApi<T>(path: string, options?: RequestInit): Promise<T> {
  options?.signal?.throwIfAborted()
  const url = new URL(path, 'https://habits.local')
  const method = options?.method || 'GET'
  const result = (): unknown => {
    if (url.pathname === '/health' && method === 'GET') return { status: 'ok', today: localToday() }
    const state = read()
    if (url.pathname === '/habits' && method === 'GET') return state.habits
    if (url.pathname === '/habits' && method === 'POST') {
      const { title, weekDays } = z
        .object({ title: titleSchema, weekDays: daysSchema })
        .parse(JSON.parse(String(options?.body)))
      if (state.habits.length >= 500) throw new Error('Você atingiu o limite de 500 hábitos.')
      const habit: Habit = {
        id: crypto.randomUUID(),
        title,
        created_at: `${localToday()}T00:00:00.000Z`,
        weekDays: weekDays.sort((a, b) => a - b).map((week_day) => ({ week_day })),
      }
      state.habits.push(habit)
      write(state)
      return habit
    }
    if (url.pathname === '/day' && method === 'GET') {
      const date = dateSchema.parse(url.searchParams.get('date'))
      const possibleHabits = possibleOn(state.habits, date)
      const ids = new Set(possibleHabits.map((habit) => habit.id))
      return {
        possibleHabits,
        completedHabits: (state.completions[date] || []).filter((id) => ids.has(id)),
      }
    }
    if (url.pathname === '/summary' && method === 'GET') {
      const year = z.coerce.number().int().min(2000).max(2100).parse(url.searchParams.get('year'))
      const summary: SummaryDay[] = []
      for (let date = `${year}-01-01`; date.startsWith(`${year}-`); date = addDays(date, 1)) {
        const possible = new Set(possibleOn(state.habits, date).map((habit) => habit.id))
        summary.push({
          date,
          amount: possible.size,
          completed: (state.completions[date] || []).filter((id) => possible.has(id)).length,
        })
      }
      return summary
    }
    const match = url.pathname.match(/^\/habits\/([^/]+)(\/completion)?$/)
    if (match) {
      const id = z.uuid().parse(match[1])
      const habit = state.habits.find((habit) => habit.id === id)
      if (!habit) throw new Error('Hábito não encontrado.')
      if (match[2] && method === 'PUT') {
        const { date, completed } = z
          .object({ date: dateSchema, completed: z.boolean() })
          .parse(JSON.parse(String(options?.body)))
        if (date > localToday()) throw new Error('Dias futuros ainda não podem ser marcados.')
        if (!possibleOn([habit], date).length)
          throw new Error('Este hábito não está previsto para essa data.')
        const ids = new Set(state.completions[date] || [])
        if (completed) ids.add(id)
        else ids.delete(id)
        if (ids.size) state.completions[date] = [...ids]
        else delete state.completions[date]
        write(state)
        return { completed }
      }
      if (!match[2] && method === 'PATCH') {
        const { title } = z.object({ title: titleSchema }).parse(JSON.parse(String(options?.body)))
        habit.title = title
        write(state)
        return habit
      }
      if (!match[2] && method === 'DELETE') {
        state.habits = state.habits.filter((habit) => habit.id !== id)
        for (const [date, ids] of Object.entries(state.completions)) {
          const remaining = ids.filter((value) => value !== id)
          if (remaining.length) state.completions[date] = remaining
          else delete state.completions[date]
        }
        write(state)
        return undefined
      }
    }
    throw new Error('Operação não disponível.')
  }
  return result() as T
}
