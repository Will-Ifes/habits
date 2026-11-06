import { z } from 'zod'

// Calendar days use UTC midnight for storage; today follows the app timezone.
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Informe uma data válida no formato AAAA-MM-DD.')

export function todayKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.APP_TIMEZONE || 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (name: string) => parts.find((value) => value.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const asDate = (key: string) => new Date(`${key}T00:00:00.000Z`)
export const asKey = (date: Date) => date.toISOString().slice(0, 10)
