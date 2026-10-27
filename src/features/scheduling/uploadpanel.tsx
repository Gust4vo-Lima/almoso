import { useRef, useState } from 'react'
import { FileSpreadsheet, FolderUp, LockKeyhole } from 'lucide-react'

type UploadPanelProps = {
  busy: boolean
  error: string
  sourceName?: string
  onFile: (file: File) => void
}

export function UploadPanel({ busy, error, sourceName, onFile }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  function selectFile(file?: File) {
    if (!file) return
    if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) {
      setFileError('Selecione uma planilha no formato .xlsx.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setFileError('O arquivo deve ter no máximo 20 MB.')
      return
    }
    setFileError('')
    onFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="panel upload-panel" aria-labelledby="upload-title">
      <div className="panel-heading">
        <div className="section-icon spreadsheet-icon"><FileSpreadsheet size={17} /></div>
        <div>
          <h2 id="upload-title">Planilha de triagem</h2>
          <p>Linhas de triagem por hora; cada nome ocupa 1h</p>
        </div>
      </div>
      <div
        className={`drop-zone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          selectFile(event.dataTransfer.files[0])
        }}
      >
        <div className="upload-symbol"><FolderUp size={21} /></div>
        <p className="drop-title">{busy ? 'Lendo planilha...' : 'Solte o arquivo aqui'}</p>
        <p className="drop-subtitle">ou selecione do seu dispositivo</p>
        <button className="browse-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          Escolher arquivo
        </button>
        <input ref={inputRef} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => selectFile(event.target.files?.[0])} />
        <span className="file-hint">XLSX · almoço em blocos de 15 min</span>
      </div>
      {(error || fileError) && <p className="upload-error" role="alert">{error || fileError}</p>}
      {sourceName && !error && !fileError && (
        <div className="file-status"><FileSpreadsheet size={16} /><span title={sourceName}>{sourceName}</span><strong>Pronto</strong></div>
      )}
      <div className="local-processing"><LockKeyhole size={14} /><span>Arquivo processado localmente, sem envio</span></div>
    </section>
  )
}