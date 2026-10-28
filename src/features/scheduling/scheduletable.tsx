import { useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock3, Pencil, X } from 'lucide-react'
import { adjustLunchAssignment, type Analyst, type LunchAssignment, type LunchWindow, type ScheduleResult } from './schedule'

type ScheduleTableProps = {
  result: ScheduleResult | null
  analysts: Analyst[]
  window: LunchWindow
  onAdjust: (dayName: string, analystId: string, assignment: LunchAssignment) => void
}

export function ScheduleTable({ result, analysts, window, onAdjust }: ScheduleTableProps) {
  const [editing, setEditing] = useState<{ dayName: string; analystId: string } | null>(null)
  const [draftStart, setDraftStart] = useState('')
  const [editError, setEditError] = useState('')
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
  function beginEdit(dayName: string, analyst: Analyst, assignment: LunchAssignment) {
    setEditing({ dayName, analystId: analyst.id })
    setDraftStart(assignment.start)
    setEditError('')
  }

  function cancelEdit() {
    setEditing(null)
    setDraftStart('')
    setEditError('')
  }

  function saveEdit(dayName: string, analyst: Analyst, assignment: LunchAssignment) {
    try {
      onAdjust(dayName, analyst.id, adjustLunchAssignment(assignment, analyst, window, draftStart))
      cancelEdit()
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Não foi possível ajustar o horário.')
    }
  }

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
                        editing?.dayName === day.name && editing.analystId === analyst.id ? (
                          <div className="lunch-editor">
                            <input
                              aria-label={`Novo início do almoço de ${analyst.name} em ${day.name}`}
                              type="time"
                              step="900"
                              value={draftStart}
                              onChange={(event) => setDraftStart(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') saveEdit(day.name, analyst, assignment)
                                if (event.key === 'Escape') cancelEdit()
                              }}
                            />
                            <button type="button" className="lunch-edit-action confirm" aria-label="Confirmar horário" onClick={() => saveEdit(day.name, analyst, assignment)}><Check size={15} /></button>
                            <button type="button" className="lunch-edit-action" aria-label="Cancelar ajuste" onClick={cancelEdit}><X size={15} /></button>
                            {editError && <small className="lunch-edit-error">{editError}</small>}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={`lunch-chip lunch-chip-editable${assignment.overlapMinutes > 0 ? ' has-overlap' : ''}${assignment.manuallyAdjusted ? ' is-manual' : ''}`}
                            title="Clique para ajustar manualmente"
                            onClick={() => beginEdit(day.name, analyst, assignment)}
                          >
                            <Clock3 size={13} /><span>{assignment.start}<i>–</i>{assignment.end}</span>
                            {assignment.manuallyAdjusted ? <Pencil size={11} className="manual-pencil" /> : <Pencil size={11} />}
                          </button>
                        )
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