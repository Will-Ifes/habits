export type Habit = {
  id: string
  title: string
  created_at: string
  weekDays: { week_day: number }[]
}
export type Day = { possibleHabits: Habit[]; completedHabits: string[] }
export type SummaryDay = { date: string; amount: number; completed: number }

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...options?.headers,
    },
    signal: options?.signal || AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      body.message || 'Não foi possível conectar. Verifique se a API está em execução.'
    )
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
export function errorMessage(error: unknown) {
  return error instanceof Error && error.message && error.name !== 'TypeError'
    ? error.message
    : 'Não foi possível conectar. Verifique sua conexão e tente novamente.'
}
