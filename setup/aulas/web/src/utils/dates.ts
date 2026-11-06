export const dateObject = (date: string) => new Date(`${date}T12:00:00Z`)
export const dateKey = (date: Date) => date.toISOString().slice(0, 10)
export const addDays = (date: string, days: number) =>
  dateKey(new Date(dateObject(date).getTime() + days * 86400000))
export const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options }).format(dateObject(date))
export function monthDays(month: string) {
  const first = `${month}-01`
  const count = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  ).getUTCDate()
  return {
    offset: dateObject(first).getUTCDay(),
    days: Array.from({ length: count }, (_, i) => addDays(first, i)),
  }
}
export function moveMonth(month: string, direction: number) {
  const date = dateObject(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + direction)
  return dateKey(date).slice(0, 7)
}
export const weekDays = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]
export function level(completed = 0, amount = 0) {
  return completed === 0 || amount === 0 ? 0 : Math.min(4, Math.ceil((completed / amount) * 4))
}
