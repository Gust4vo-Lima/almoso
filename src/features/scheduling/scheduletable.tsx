import { AlertTriangle, CalendarDays, Clock3 } from 'lucide-react'
import type { Analyst, ScheduleResult } from './schedule'

type ScheduleTableProps = {
  result: ScheduleResult | null
  analysts: Analyst[]
}

export function ScheduleTable({ result, analysts }: ScheduleTableProps) {
  if (!result) {
    return (
      <section className="schedule-empty" aria-label="Resultado da escala">
        <div className="empty-illustration"><CalendarDays size={26} /></div>
        <h2>Sua escala aparece aqui</h2>
        <p>Cadastre os analistas e carregue a planilha de triagem para distribuir os horários de almoço.</p>
        <div className="empty-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      </section>
    )
  }

  const scheduledCount = result.days.reduce((total, day) => total + Object.values(day.assignments).filter(Boolean).length, 0)
  const overlapCount = result.warnings.filter((warning) => warning.includes('sobreposição')).length
  const blockedCount = result.warnings.filter((warning) => warning.includes('bloco livre')).length

  return (
    <section className="schedule-content" aria-labelledby="schedule-title">
      <div className="schedule-summary">
        <div className="summary-item"><span className="summary-number">{result.days.length}</span><span>dias na escala</span></div>
        <div className="summary-rule" />
        <div className="summary-item"><span className="summary-number">{scheduledCount}</span><span>almoços distribuídos</span></div>
        {(overlapCount > 0 || blockedCount > 0) && (
          <div className="summary-alert"><AlertTriangle size={15} /><span>{overlapCount + blockedCount} observações</span></div>
        )}
      </div>

      <div className="table-scroll">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="analyst-column" scope="col">Analista</th>
              {result.days.map((day) => <th key={day.name} scope="col">{day.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {analysts.map((analyst, rowIndex) => (
              <tr key={analyst.id}>
                <th scope="row" className="analyst-cell">
                  <span className={`row-marker marker-${rowIndex % 5}`} />
                  <span className="table-analyst-name">{analyst.name}</span>
                  <span className="table-duration">{analyst.lunchMinutes % 60 === 0 ? `${analyst.lunchMinutes / 60}h` : `${Math.floor(analyst.lunchMinutes / 60)}h${String(analyst.lunchMinutes % 60).padStart(2, '0')}`}</span>
                </th>
                {result.days.map((day) => {
                  const assignment = day.assignments[analyst.id]
                  return (
                    <td key={day.name}>
                      {assignment ? (
                        <span className={`lunch-chip${assignment.overlapMinutes > 0 ? ' has-overlap' : ''}`}>
                          <Clock3 size={13} /><span>{assignment.start}<i>–</i>{assignment.end}</span>
                        </span>
                      ) : (
                        <span className="unavailable-cell" title="Nenhum bloco livre encontrado">Indisponível</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {analysts.length === 0 && <tr><td className="no-analysts" colSpan={result.days.length + 1}>Cadastre pelo menos um analista para gerar horários.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="table-legend"><span><i className="legend-dot legend-free" /> Sem conflito</span><span><i className="legend-dot legend-overlap" /> Sobreposição permitida</span><span><i className="legend-outline" /> Sem horário livre</span></div>

      {result.warnings.length > 0 && (
        <aside className="warnings-box" aria-label="Observações da escala">
          <div className="warnings-title"><AlertTriangle size={16} /><strong>Observações</strong></div>
          <ul>{result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        </aside>
      )}
    </section>
  )
}