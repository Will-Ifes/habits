import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarBlank,
  Check,
  CheckCircle,
  CircleNotch,
  Fire,
  Leaf,
  PencilSimple,
  Plus,
  Sparkle,
  Target,
  Trash,
  X,
  Sun,
  Moon,
} from 'phosphor-react'
import { api, Day, errorMessage, Habit, SummaryDay } from './lib/api'
import { addDays, formatDate, weekDays } from './utils/dates'
import { HabitForm } from './components/HabitForm'
import { Calendar } from './components/Calendar'
import { History } from './components/History'
import { BackupControls } from './components/BackupControls'
import { isBrowserMode, STORAGE_KEY } from './lib/browser-api'
import { useTheme } from './hooks/useTheme'
import './styles/tokens.css'
import './styles/global.css'

type Snapshot = { today: string; date: string; day: Day; habits: Habit[]; summary: SummaryDay[] }
type Modal = { kind: 'create' } | { kind: 'rename' | 'delete'; habit: Habit } | null

export function App() {
  const modalTrigger = useRef<HTMLElement | null>(null)
  const { theme, toggle } = useTheme()
  const [today, setToday] = useState('')
  const [selected, setSelected] = useState('')
  const [month, setMonth] = useState('')
  const [data, setData] = useState<Snapshot | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const year = Number(month.slice(0, 4))

  function openModal(value: Modal) {
    modalTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setModal(value)
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    async function load() {
      try {
        const health = await api<{ today: string }>('/health', { signal: controller.signal })
        const date = selected || health.today
        const currentMonth = month || date.slice(0, 7)
        const options = { signal: controller.signal }
        const [day, habits, summary] = await Promise.all([
          api<Day>(`/day?date=${date}`, options),
          api<Habit[]>('/habits', options),
          api<SummaryDay[]>(`/summary?year=${currentMonth.slice(0, 4)}`, options),
        ])
        if (controller.signal.aborted) return
        setToday(health.today)
        setData({ today: health.today, date, day, habits, summary })
        if (!selected) {
          setSelected(date)
          setMonth(currentMonth)
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(errorMessage(error))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [selected, month, revision])

  // Refresh when returning to the app, including across midnight.
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1)
    window.addEventListener('focus', refresh)
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(timer)
  }, [notice])

  function chooseDate(date: string) {
    setSelected(date)
    setMonth(date.slice(0, 7))
    setError('')
  }
  function chooseMonth(value: string) {
    chooseDate(value === today.slice(0, 7) ? today : `${value}-01`)
  }
  function saved(message: string) {
    setModal(null)
    setNotice(message)
    setRevision((value) => value + 1)
  }
  async function complete(habit: Habit) {
    if (!data || busy || loading) return
    const completed = !data.day.completedHabits.includes(habit.id)
    setBusy(true)
    setError('')
    try {
      await api(`/habits/${habit.id}/completion`, {
        method: 'PUT',
        body: JSON.stringify({ date: selected, completed }),
      })
      setRevision((value) => value + 1)
      setNotice(completed ? 'Mais um passo dado. Hábito concluído!' : 'Marcação removida.')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (modal?.kind !== 'delete') return
    setBusy(true)
    setError('')
    try {
      await api(`/habits/${modal.habit.id}`, { method: 'DELETE' })
      saved('Hábito excluído.')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const activeDay = data?.date === selected ? data.day : undefined
  const done = activeDay?.completedHabits.length || 0
  const amount = activeDay?.possibleHabits.length || 0
  const percent = amount ? Math.round((done / amount) * 100) : 0
  const elapsed = data?.summary.filter((day) => day.date <= today) || []
  const total = elapsed.reduce((sum, day) => sum + day.completed, 0)
  const perfect = elapsed.filter((day) => day.amount > 0 && day.completed === day.amount).length
  // A rest day neither extends nor breaks the sequence. Today can still be in progress.
  let streak = 0
  if (data) {
    const byDate = new Map(data.summary.map((day) => [day.date, day]))
    let cursor = data.today
    const current = byDate.get(cursor)
    if (!current || current.amount === 0 || current.completed !== current.amount)
      cursor = addDays(cursor, -1)
    while (cursor.startsWith(String(year))) {
      const entry = byDate.get(cursor)
      if (!entry || (entry.amount > 0 && entry.completed !== entry.amount)) break
      if (entry.amount > 0) streak++
      cursor = addDays(cursor, -1)
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Habits, início">
          <span className="brand-mark">
            <Check size={24} weight="bold" />
          </span>
          habits<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#rotina" className="active">
            Minha rotina
          </a>
          <a href="#historico">
            Histórico <ArrowUpRight size={13} />
          </a>
        </nav>
        <div className="header-actions">
          <span className="personal-badge">
            <span /> Will Labs
          </span>
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === 'paper' ? 'Usar tema Floresta' : 'Usar tema Papel'}
          >
            {theme === 'paper' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === 'paper' ? 'Papel' : 'Floresta'}</span>
          </button>
        </div>
      </header>

      <main id="conteudo" tabIndex={-1}>
        <section className="hero">
          <div>
            <span className="eyebrow accent">
              <span className="tiny-line" /> CONSTRUA A SUA MELHOR VERSÃO
            </span>
            <h1>
              Pequenos passos.
              <br />
              <span>Grandes mudanças.</span>
            </h1>
            <p>
              Não precisa mudar tudo de uma vez.
              <br className="mobile-break" /> Só continuar, um dia de cada vez.
            </p>
          </div>
          <button className="button primary" onClick={() => openModal({ kind: 'create' })}>
            <Plus size={20} weight="bold" /> Novo hábito
          </button>
        </section>

        {isBrowserMode && (
          <BackupControls
            disabled={busy}
            onUpdated={() => saved('Backup restaurado. Sua rotina está pronta.')}
          />
        )}

        {notice && (
          <div role="status" className="notice">
            <CheckCircle size={20} />
            {notice}
          </div>
        )}
        {error && (
          <div role="alert" className="error-banner">
            <span>{error}</span>
            <button className="text-button" onClick={() => setRevision((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
        {!data && loading && (
          <div className="initial-loading" role="status">
            <CircleNotch className="spin" size={28} /> Preparando seu espaço…
          </div>
        )}

        {data && (
          <>
            <section className="stats" aria-label="Seu progresso">
              <article className="stat">
                <span className="stat-icon violet">
                  <Target size={23} />
                </span>
                <div>
                  <span className="muted small">Hábitos na sua rotina</span>
                  <strong>
                    {data.habits.length}
                    <small>hábitos</small>
                  </strong>
                </div>
              </article>
              <article className="stat">
                <span className="stat-icon green">
                  <CheckCircle size={23} />
                </span>
                <div>
                  <span className="muted small">Conclusões em {year}</span>
                  <strong>
                    {total}
                    <small>passos dados</small>
                  </strong>
                </div>
              </article>
              <article className="stat">
                <span className="stat-icon orange">
                  <Fire size={23} />
                </span>
                <div>
                  <span className="muted small">
                    {year === Number(today.slice(0, 4))
                      ? 'Sequência atual no ano'
                      : 'Dias completos no ano'}
                  </span>
                  <strong>
                    {year === Number(today.slice(0, 4)) ? streak : perfect}
                    <small>dias completos</small>
                  </strong>
                </div>
              </article>
            </section>

            <div className="daily-layout" id="rotina">
              <section className="panel daily-panel" aria-busy={loading || busy}>
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      {selected === today ? 'O SEU FOCO DE HOJE' : 'UM PASSO NO SEU HISTÓRICO'}
                    </span>
                    <h2>
                      {selected === today ? 'Vamos fazer acontecer?' : 'Sua rotina nesse dia'}
                    </h2>
                  </div>
                  <span className="date-badge">
                    <CalendarBlank size={16} />
                    {formatDate(selected, { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <div className="daily-date">
                  <span>
                    {formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  {selected !== today && (
                    <button className="text-button" onClick={() => chooseDate(today)}>
                      Voltar para hoje <ArrowRight size={14} />
                    </button>
                  )}
                </div>
                <div className="progress-heading">
                  <span>Seu progresso</span>
                  <strong>
                    {done}
                    <span> / {amount} concluídos</span>
                  </strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Progresso do dia"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <div style={{ width: `${percent}%` }} />
                </div>
                {loading ? (
                  <div className="list-loading" role="status">
                    <CircleNotch className="spin" size={22} /> Atualizando sua rotina…
                  </div>
                ) : amount > 0 ? (
                  <div className="habit-list">
                    {activeDay?.possibleHabits.map((habit, index) => {
                      const checked = activeDay.completedHabits.includes(habit.id)
                      return (
                        <button
                          key={habit.id}
                          role="checkbox"
                          aria-checked={checked}
                          disabled={busy}
                          onClick={() => void complete(habit)}
                          className={`habit-row ${checked ? 'complete' : ''}`}
                        >
                          <span className="habit-check">
                            {checked && <Check size={17} weight="bold" />}
                          </span>
                          <span className="habit-row-title">
                            <span className="habit-title-text">{habit.title}</span>
                            <small>
                              {checked ? 'Você fez acontecer' : 'Um pequeno passo para hoje'}
                            </small>
                          </span>
                          <span className="habit-number">{String(index + 1).padStart(2, '0')}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Leaf size={32} />
                    </span>
                    <h3>
                      {data.habits.length
                        ? 'Um respiro na sua rotina'
                        : 'Toda mudança tem um começo'}
                    </h3>
                    <p>
                      {data.habits.length
                        ? 'Nenhum hábito previsto para este dia. Aproveite para recarregar.'
                        : 'Escolha algo pequeno que você quer fazer por você. Seu primeiro hábito começa aqui.'}
                    </p>
                    {!data.habits.length && (
                      <button className="text-button" onClick={() => openModal({ kind: 'create' })}>
                        Criar meu primeiro hábito <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                )}
                <div className="daily-note">
                  <Sparkle size={18} />
                  <span>
                    {percent === 100 && amount
                      ? 'Você concluiu tudo por hoje. Celebre esse passo!'
                      : 'A melhor rotina é aquela que cabe na sua vida.'}
                  </span>
                </div>
              </section>
              <Calendar
                month={month}
                today={today}
                selected={selected}
                summary={data.summary}
                onMonth={chooseMonth}
                onSelect={chooseDate}
              />
            </div>

            <div id="historico">
              <History
                year={year}
                today={today}
                selected={selected}
                summary={data.summary}
                onSelect={chooseDate}
                onYear={(value) =>
                  chooseMonth(
                    value === Number(today.slice(0, 4)) ? today.slice(0, 7) : `${value}-01`
                  )
                }
              />
            </div>

            <section className="panel manage-panel">
              <details>
                <summary>
                  <div>
                    <h2>
                      Meus hábitos <span className="count-badge">{data.habits.length}</span>
                    </h2>
                    <p className="muted small">Cuide da rotina que você está construindo.</p>
                  </div>
                  <span className="text-button">
                    Gerenciar <PencilSimple size={16} />
                  </span>
                </summary>
                <div className="manage-list">
                  {data.habits.length ? (
                    data.habits.map((habit) => (
                      <div className="manage-row" key={habit.id}>
                        <div>
                          <strong>{habit.title}</strong>
                          <span className="muted small">
                            {habit.weekDays.length === 7
                              ? 'Todos os dias'
                              : habit.weekDays
                                  .map((day) => weekDays[day.week_day].slice(0, 3))
                                  .join(' · ')}
                          </span>
                        </div>
                        <div className="manage-actions">
                          <button
                            className="icon-button"
                            aria-label={`Renomear ${habit.title}`}
                            onClick={() => openModal({ kind: 'rename', habit })}
                          >
                            <PencilSimple size={18} />
                          </button>
                          <button
                            className="icon-button danger"
                            aria-label={`Excluir ${habit.title}`}
                            onClick={() => openModal({ kind: 'delete', habit })}
                          >
                            <Trash size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Você ainda não tem hábitos cadastrados.</p>
                  )}
                </div>
              </details>
            </section>
          </>
        )}
        <footer>
          <span className="footer-brand">
            <CheckCircle size={16} /> habits.
          </span>
          <span>Feito para o seu ritmo. Um dia de cada vez.</span>
          <a href="https://github.com/Will-Ifes/habits" target="_blank" rel="noreferrer">
            Código no GitHub <ArrowUpRight size={14} />
          </a>
        </footer>
      </main>

      <Dialog.Root
        open={!!modal}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="dialog-content"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              modalTrigger.current?.focus()
            }}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault()
            }}
            onPointerDownOutside={(event) => {
              if (busy) event.preventDefault()
            }}
          >
            <Dialog.Close className="icon-button dialog-close" aria-label="Fechar" disabled={busy}>
              <X size={21} />
            </Dialog.Close>
            <span className="dialog-symbol">
              <Leaf size={26} />
            </span>
            <Dialog.Title>
              {modal?.kind === 'delete'
                ? 'Abrir espaço para o novo?'
                : modal?.kind === 'rename'
                  ? 'Um novo nome'
                  : 'Cultive um novo hábito'}
            </Dialog.Title>
            <Dialog.Description>
              {modal?.kind === 'delete'
                ? `Excluir “${modal.habit.title}” também remove todas as suas marcações do histórico. Essa ação não pode ser desfeita.`
                : modal?.kind === 'rename'
                  ? 'Ajuste o nome sem perder o caminho que já percorreu.'
                  : 'Comece pequeno. A constância faz o resto.'}
            </Dialog.Description>
            {modal?.kind === 'delete' ? (
              <div className="delete-actions">
                {error && (
                  <p className="error-text" role="alert">
                    {error}
                  </p>
                )}
                <button className="button secondary" disabled={busy} onClick={() => setModal(null)}>
                  Manter hábito
                </button>
                <button
                  className="button destructive"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {busy ? 'Excluindo…' : 'Excluir hábito'}
                </button>
              </div>
            ) : (
              modal && (
                <HabitForm
                  onBusy={setBusy}
                  key={modal.kind === 'rename' ? modal.habit.id : 'new'}
                  habit={modal.kind === 'rename' ? modal.habit : undefined}
                  onSaved={() =>
                    saved(
                      modal.kind === 'rename'
                        ? 'Nome atualizado.'
                        : 'Seu novo hábito já faz parte da rotina!'
                    )
                  }
                />
              )
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
