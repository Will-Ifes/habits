import { FormEvent, useState } from 'react'
import { Check } from 'phosphor-react'
import { api, errorMessage, Habit } from '../lib/api'
import { weekDays } from '../utils/dates'

export function HabitForm({
  habit,
  onSaved,
  onBusy,
}: {
  habit?: Habit
  onSaved: () => void
  onBusy: (value: boolean) => void
}) {
  const [title, setTitle] = useState(habit?.title || '')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || (!habit && !days.length)) {
      setError('Preencha o nome e selecione ao menos um dia.')
      return
    }
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      await api(habit ? `/habits/${habit.id}` : '/habits', {
        method: habit ? 'PATCH' : 'POST',
        body: JSON.stringify({ title: title.trim(), weekDays: days }),
      })
      onSaved()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <form onSubmit={save} className="habit-form">
      <label htmlFor="habit-title">Qual hábito você quer cultivar?</label>
      <input
        id="habit-title"
        autoFocus
        required
        maxLength={100}
        placeholder="Ex.: Ler por 20 minutos"
        value={title}
        disabled={busy}
        onChange={(event) => setTitle(event.target.value)}
      />
      {!habit && (
        <fieldset disabled={busy}>
          <legend>Em quais dias?</legend>
          <div className="preset-days">
            <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
              Todos os dias
            </button>
            <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])}>
              Dias úteis
            </button>
          </div>
          <div className="weekday-picker">
            {weekDays.map((day, index) => (
              <label key={day} title={day} className={days.includes(index) ? 'chosen' : ''}>
                <input
                  type="checkbox"
                  aria-label={day}
                  checked={days.includes(index)}
                  onChange={() =>
                    setDays((current) =>
                      current.includes(index)
                        ? current.filter((value) => value !== index)
                        : [...current, index]
                    )
                  }
                />
                <span>{day.slice(0, 3)}</span>
              </label>
            ))}
          </div>
          <p className="muted small">Seu hábito começa hoje. Cada dia é uma nova oportunidade.</p>
        </fieldset>
      )}
      {habit && (
        <p className="muted small">
          A recorrência é preservada para manter seu histórico consistente.
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <button
        className="button primary full"
        disabled={busy || !title.trim() || (!habit && !days.length)}
      >
        <Check size={18} />
        {busy ? 'Salvando…' : habit ? 'Salvar nome' : 'Começar meu hábito'}
      </button>
    </form>
  )
}
