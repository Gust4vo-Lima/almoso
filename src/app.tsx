import { useState } from 'react'
import { CalendarClock, RefreshCw, Sparkles } from 'lucide-react'
import { ScheduleTable } from './features/scheduling/scheduletable'
import { UploadPanel } from './features/scheduling/uploadpanel'
import { readScheduleFile, type LunchAssignment, type ScheduleResult } from './features/scheduling/schedule'
import { SettingsPanel } from './features/settings/settingspanel'
import { loadSettings, saveSettings, type AppSettings } from './features/settings/settings'
import './app.css'

function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [result, setResult] = useState<ScheduleResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [busy, setBusy] = useState(false)
  const manualAssignmentsKey = 'almoso.manual-assignments.v1'
  const manualAssignmentsSourceKey = 'almoso.manual-assignments-source.v1'

  function loadManualAssignments(): Record<string, LunchAssignment> {
    try {
      const stored = localStorage.getItem(manualAssignmentsKey)
      return stored ? JSON.parse(stored) as Record<string, LunchAssignment> : {}
    } catch {
      return {}
    }
  }

  function handleAdjustment(dayName: string, analystId: string, assignment: LunchAssignment) {
    setResult((current) => {
      if (!current) return current
      const next = {
        ...current,
        days: current.days.map((day) => day.name === dayName
          ? { ...day, assignments: { ...day.assignments, [analystId]: assignment } }
          : day),
      }
      const stored = loadManualAssignments()
      stored[`${dayName}:${analystId}`] = assignment
      localStorage.setItem(manualAssignmentsKey, JSON.stringify(stored))
      return next
    })
  }

  async function processFile(file: File) {
    setUploadError('')
    setResult(null)
    if (settings.analysts.length === 0) {
      setUploadError('Cadastre ao menos um analista antes de carregar a planilha.')
      return
    }
    if (settings.end <= settings.start) {
      setUploadError('O fim da janela de almoço deve ser posterior ao início.')
      return
    }
    setBusy(true)
    const previousSource = localStorage.getItem(manualAssignmentsSourceKey)
    if (previousSource && previousSource !== file.name) {
      localStorage.removeItem(manualAssignmentsKey)
    }
    localStorage.setItem(manualAssignmentsSourceKey, file.name)

    try {
      const generated = await readScheduleFile(file, settings.analysts, settings)
      const manualAssignments = loadManualAssignments()
      setResult({
        ...generated,
        days: generated.days.map((day) => ({
          ...day,
          assignments: Object.fromEntries(Object.entries(day.assignments).map(([analystId, assignment]) => [
            analystId,
            manualAssignments[`${day.name}:${analystId}`] ?? assignment,
          ])),
        })),
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Não foi possível ler a planilha.')
    } finally {
      setBusy(false)
    }
  }

  function updateSettings(nextSettings: AppSettings) {
    setSettings(nextSettings)
    setResult(null)
    try {
      saveSettings(nextSettings)
      setUploadError('')
    } catch {
      setUploadError('Não foi possível salvar as configurações neste navegador.')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Almoso, início">
          <span className="brand-icon"><CalendarClock size={20} strokeWidth={2.2} /></span>
          <span>almoso<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-right">
          <span className="privacy-pill"><span className="privacy-indicator" />Dados privados neste dispositivo</span>
          <span className="topbar-divider" />
          <span className="workspace-label">Planejamento de equipe</span>
        </div>
      </header>

      <main id="inicio" className="workspace">
        <section className="page-intro">
          <div>
            <div className="eyebrow"><Sparkles size={13} /> PLANEJAMENTO SEMANAL</div>
            <h1>Escala de almoço</h1>
            <p>Uma pausa bem distribuída começa com uma escala clara.</p>
          </div>
          {result && <button className="reset-button" type="button" onClick={() => { setResult(null); setUploadError('') }}><RefreshCw size={15} /> Nova escala</button>}
        </section>

        <div className="work-layout">
          <aside className="control-rail" aria-label="Configurações da escala">
            <UploadPanel busy={busy} error={uploadError} sourceName={result?.sourceName} onFile={(file) => void processFile(file)} />
            <SettingsPanel settings={settings} onChange={updateSettings} />
          </aside>
          <section className="results-panel" aria-labelledby="schedule-title">
            <div className="results-heading">
              <div><div className="eyebrow results-eyebrow">VISÃO DA EQUIPE</div><h2 id="schedule-title">Horários por dia</h2></div>
              {result && <span className="source-label" title={result.sourceName}>{result.sourceName}</span>}
            </div>
            <ScheduleTable result={result} analysts={settings.analysts} window={{ start: settings.start, end: settings.end }} onAdjust={handleAdjustment} />
          </section>
        </div>
        <footer className="page-footer"><span>ALMOSO <i>·</i> ESCALA SEMANAL</span><span>Feito para uma pausa tranquila.</span></footer>
      </main>
    </div>
  )
}

export default App