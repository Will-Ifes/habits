import { SummaryDay } from '../lib/api'
import { dateObject, formatDate, level } from '../utils/dates'

export function History({
  year,
  today,
  summary,
  selected,
  onSelect,
  onYear,
}: {
  year: number
  today: string
  summary: SummaryDay[]
  selected: string
  onSelect: (date: string) => void
  onYear: (year: number) => void
}) {
  const offset = dateObject(`${year}-01-01`).getUTCDay()
  return (
    <section className="panel history-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CADA QUADRADO CONTA</span>
          <h2>Seu ano em hábitos</h2>
        </div>
        <label className="year-select">
          Ano{' '}
          <select
            aria-label="Ano do histórico"
            value={year}
            onChange={(event) => onYear(Number(event.target.value))}
          >
            {Array.from(
              { length: Number(today.slice(0, 4)) - 1999 },
              (_, index) => Number(today.slice(0, 4)) - index
            ).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="heatmap-scroll">
        <div className="heatmap-layout">
          <div className="heatmap-labels">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((value, index) => (
              <span key={index}>{value}</span>
            ))}
          </div>
          <div className="heatmap" aria-label={`Histórico de ${year}`}>
            {Array.from({ length: offset }, (_, index) => (
              <span key={index} />
            ))}
            {summary.map((day) => (
              <button
                key={day.date}
                disabled={day.date > today}
                title={`${formatDate(day.date, { day: 'numeric', month: 'long' })} · ${day.completed}/${day.amount} concluídos`}
                aria-label={`Histórico ${day.date}: ${day.completed} de ${day.amount}`}
                aria-pressed={selected === day.date}
                className={`level-${level(day.completed, day.amount)} ${selected === day.date ? 'selected' : ''}`}
                onClick={() => onSelect(day.date)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="history-footer">
        <span className="muted small">Consistência vale mais que perfeição.</span>
        <div className="calendar-legend">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((value) => (
            <i key={value} className={`level-${value}`} />
          ))}
          <span>Mais</span>
        </div>
      </div>
    </section>
  )
}
