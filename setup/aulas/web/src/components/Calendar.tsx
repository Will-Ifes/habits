import { CaretLeft, CaretRight } from 'phosphor-react'
import { SummaryDay } from '../lib/api'
import { formatDate, level, monthDays, moveMonth, weekDays } from '../utils/dates'

export function Calendar({
  month,
  today,
  selected,
  summary,
  onMonth,
  onSelect,
}: {
  month: string
  today: string
  selected: string
  summary: SummaryDay[]
  onMonth: (value: string) => void
  onSelect: (value: string) => void
}) {
  const { offset, days } = monthDays(month)
  const byDate = new Map(summary.map((day) => [day.date, day]))
  return (
    <section className="panel calendar-panel" aria-label="Calendário de hábitos">
      <div className="panel-heading">
        <h2>Sua constância</h2>
        <span className="eyebrow">UM DIA DE CADA VEZ</span>
      </div>
      <div className="month-navigation">
        <strong>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</strong>
        <div>
          <button
            className="icon-button"
            aria-label="Mês anterior"
            disabled={month <= '2000-01'}
            onClick={() => onMonth(moveMonth(month, -1))}
          >
            <CaretLeft />
          </button>
          <button
            className="icon-button"
            aria-label="Próximo mês"
            disabled={month >= today.slice(0, 7)}
            onClick={() => onMonth(moveMonth(month, 1))}
          >
            <CaretRight />
          </button>
        </div>
      </div>
      <div className="month-grid">
        {weekDays.map((day) => (
          <span className="weekday-label" key={day} title={day}>
            {day.slice(0, 3)}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={index} />
        ))}
        {days.map((date) => {
          const entry = byDate.get(date)
          return (
            <button
              key={date}
              disabled={date > today}
              aria-pressed={date === selected}
              aria-label={`${formatDate(date, { day: 'numeric', month: 'long' })}: ${entry?.completed || 0} de ${entry?.amount || 0} hábitos`}
              className={`calendar-day level-${level(entry?.completed, entry?.amount)} ${date === selected ? 'selected' : ''} ${date === today ? 'is-today' : ''}`}
              onClick={() => onSelect(date)}
            >
              {Number(date.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="calendar-legend">
        <span>Menos</span>
        {[0, 1, 2, 3, 4].map((value) => (
          <i key={value} className={`level-${value}`} />
        ))}
        <span>Mais</span>
      </div>
      <p className="calendar-hint muted small">
        Escolha um dia para ver ou registrar seus hábitos.
      </p>
    </section>
  )
}
