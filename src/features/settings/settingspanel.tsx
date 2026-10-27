import { useRef, useState } from 'react'
import { Download, Plus, ShieldCheck, Trash2, Upload, Users } from 'lucide-react'
import type { Analyst } from '../scheduling/schedule'
import { parseSettings, type AppSettings } from './settings'

type SettingsPanelProps = {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
}

const lunchOptions = Array.from({ length: 12 }, (_, index) => (index + 1) * 15)

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder} min`
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [name, setName] = useState('')
  const [duration, setDuration] = useState(60)
  const [message, setMessage] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  function updateAnalyst(id: string, changes: Partial<Analyst>) {
    onChange({
      ...settings,
      analysts: settings.analysts.map((analyst) => analyst.id === id ? { ...analyst, ...changes } : analyst),
    })
  }

  function addAnalyst(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    if (settings.analysts.some((analyst) => analyst.name.toLocaleLowerCase('pt-BR') === trimmedName.toLocaleLowerCase('pt-BR'))) {
      setMessage('Esse analista já está cadastrado.')
      return
    }
    onChange({
      ...settings,
      analysts: [...settings.analysts, { id: crypto.randomUUID(), name: trimmedName, lunchMinutes: duration }],
    })
    setName('')
    setMessage('')
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify({ version: 1, settings }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'almoso-configuracoes.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Configurações exportadas.')
  }

  async function importSettings(file?: File) {
    if (!file) return
    try {
      const imported = parseSettings(JSON.parse(await file.text()))
      onChange(imported)
      setMessage('Configurações importadas.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o arquivo.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <section className="panel settings-panel" aria-labelledby="settings-title">
      <div className="panel-heading">
        <div className="section-icon"><Users size={17} /></div>
        <div>
          <h2 id="settings-title">Configurações</h2>
          <p>Janela e duração dos intervalos</p>
        </div>
      </div>

      <div className="window-fields">
        <label className="field-label" htmlFor="window-start">Janela de almoço</label>
        <div className="time-range">
          <label className="time-input-wrap">
            <span>Início</span>
            <input id="window-start" type="time" value={settings.start} onChange={(event) => onChange({ ...settings, start: event.target.value })} />
          </label>
          <span className="range-divider" aria-hidden="true">até</span>
          <label className="time-input-wrap">
            <span>Fim</span>
            <input type="time" value={settings.end} onChange={(event) => onChange({ ...settings, end: event.target.value })} />
          </label>
        </div>
      </div>

      <div className="analyst-heading">
        <div>
          <h3>Analistas</h3>
          <span className="count-badge">{settings.analysts.length}</span>
        </div>
        <span className="muted-label">{settings.analysts.length === 1 ? 'pessoa' : 'pessoas'}</span>
      </div>

      <form className="add-analyst-form" onSubmit={addAnalyst}>
        <label className="sr-only" htmlFor="analyst-name">Nome do analista</label>
        <input id="analyst-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do analista" maxLength={64} />
        <label className="sr-only" htmlFor="analyst-duration">Duração do almoço</label>
        <select id="analyst-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
          {lunchOptions.map((minutes) => <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>)}
        </select>
        <button className="icon-button add-button" type="submit" title="Adicionar analista" aria-label="Adicionar analista" disabled={!name.trim()}>
          <Plus size={18} />
        </button>
      </form>

      {settings.analysts.length > 0 ? (
        <ul className="analyst-list">
          {settings.analysts.map((analyst) => (
            <li className="analyst-row" key={analyst.id}>
              <span className="avatar-mark" aria-hidden="true">{analyst.name.trim().charAt(0).toLocaleUpperCase('pt-BR')}</span>
              <input
                className="analyst-name-input"
                aria-label={`Nome de ${analyst.name}`}
                value={analyst.name}
                maxLength={64}
                onChange={(event) => updateAnalyst(analyst.id, { name: event.target.value })}
                onBlur={(event) => {
                  const trimmed = event.target.value.trim()
                  if (trimmed) updateAnalyst(analyst.id, { name: trimmed })
                }}
              />
              <select aria-label={`Duração do almoço de ${analyst.name}`} value={analyst.lunchMinutes} onChange={(event) => updateAnalyst(analyst.id, { lunchMinutes: Number(event.target.value) })}>
                {lunchOptions.map((minutes) => <option key={minutes} value={minutes}>{formatDuration(minutes)}</option>)}
              </select>
              <button
                className="icon-button remove-button"
                type="button"
                title={`Remover ${analyst.name}`}
                aria-label={`Remover ${analyst.name}`}
                onClick={() => onChange({ ...settings, analysts: settings.analysts.filter((item) => item.id !== analyst.id) })}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-analysts">Adicione a equipe para começar a montar a escala.</p>
      )}

      {message && <p className="settings-message" role="status">{message}</p>}

      <div className="settings-actions">
        <button className="text-button" type="button" onClick={exportSettings}><Download size={15} /> Exportar</button>
        <button className="text-button" type="button" onClick={() => importRef.current?.click()}><Upload size={15} /> Importar</button>
        <input ref={importRef} className="sr-only" type="file" accept=".json,application/json" onChange={(event) => void importSettings(event.target.files?.[0])} />
      </div>

      <div className="privacy-note"><ShieldCheck size={15} /><span>Preferências salvas somente neste navegador</span></div>
    </section>
  )
}