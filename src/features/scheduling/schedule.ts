export type Analyst = {
  id: string
  name: string
  lunchMinutes: number
}

export type LunchWindow = {
  start: string
  end: string
}

export type LunchAssignment = {
  start: string
  end: string
  overlapMinutes: number
}

export type ScheduledDay = {
  name: string
  assignments: Record<string, LunchAssignment | null>
}

export type ScheduleResult = {
  sourceName: string
  days: ScheduledDay[]
  warnings: string[]
}

type DayColumn = {
  name: string
  column: number
}

const SLOT_MINUTES = 15
const TRIAGE_DURATION_MINUTES = 60

function parseClock(value: unknown): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getHours() * 60 + value.getMinutes()
  }

  if (typeof value === 'number' && value >= 0) {
    return Math.round((value % 1) * 24 * 60)
  }

  const match = String(value).trim().match(/^(\d{1,2})\s*[:h.]\s*(\d{2})(?:\s*-\s*\d{1,2}\s*[:h.]\s*\d{2})?$/i)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function normalizeName(value: unknown): string {
  return String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

function overlaps(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB))
}

function findBestStart(
  candidates: number[],
  duration: number,
  assigned: Array<{ start: number; end: number }>,
  windowStart: number,
  windowEnd: number,
): { start: number; overlapMinutes: number } {
  const midpoint = (windowStart + windowEnd) / 2
  return candidates
    .map((start) => {
      const end = start + duration
      const overlapMinutes = assigned.reduce(
        (total, lunch) => total + overlaps(start, end, lunch.start, lunch.end),
        0,
      )
      return { start, overlapMinutes, centerDistance: Math.abs(start + duration / 2 - midpoint) }
    })
    .sort((a, b) => a.overlapMinutes - b.overlapMinutes || a.centerDistance - b.centerDistance || a.start - b.start)[0]
}

export function createSchedule(
  rows: unknown[][],
  sourceName: string,
  analysts: Analyst[],
  window: LunchWindow,
): ScheduleResult {
  if (rows.length < 2) throw new Error('A planilha não contém linhas de horários.')

  const table = findActiveTable(rows)
  const dayColumns = table.dayColumns
  const tableRows = table.rows.slice(1)
  if (dayColumns.length === 0) {
    throw new Error('Não encontrei os dias da semana no cabeçalho da tabela ativa.')
  }

  const windowStart = parseClock(window.start)
  const windowEnd = parseClock(window.end)
  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) {
    throw new Error('A janela de almoço configurada não é válida.')
  }

  const timeRows = tableRows.flatMap((row) => {
    const time = parseClock(row[table.firstColumn - 1])
    return time === null ? [] : [{ time, row }]
  })
  if (timeRows.length === 0) throw new Error('Não encontrei horários válidos na primeira coluna.')

  const analystNames = new Map(analysts.map((analyst) => [normalizeName(analyst.name), analyst]))
  const warnings: string[] = []
  const days = dayColumns.map(({ name, column }) => {
    const occupiedByAnalyst = new Map<string, Set<number>>()

    for (const { time, row } of timeRows) {
      const cellNames = String(row[column] ?? '').split(/[\n;,]+/).map(normalizeName)
      for (const cellName of cellNames) {
        const analyst = analystNames.get(cellName)
        if (!analyst) continue
        const occupied = occupiedByAnalyst.get(analyst.id) ?? new Set<number>()
        for (let minute = time; minute < time + TRIAGE_DURATION_MINUTES; minute += SLOT_MINUTES) {
          occupied.add(minute)
        }
        occupiedByAnalyst.set(analyst.id, occupied)
      }
    }

    const options = analysts.map((analyst, order) => {
      const duration = Math.ceil(analyst.lunchMinutes / SLOT_MINUTES) * SLOT_MINUTES
      const occupied = occupiedByAnalyst.get(analyst.id) ?? new Set<number>()
      const candidates: number[] = []
      for (let start = windowStart; start + duration <= windowEnd; start += SLOT_MINUTES) {
        let isFree = true
        for (let minute = start; minute < start + duration; minute += SLOT_MINUTES) {
          if (occupied.has(minute)) {
            isFree = false
            break
          }
        }
        if (isFree) candidates.push(start)
      }
      return { analyst, duration, candidates, order }
    })

    const assigned: Array<{ analyst: Analyst; start: number; end: number; overlapMinutes: number }> = []
    const unschedulable = options.filter((option) => option.candidates.length === 0)
    const schedulable = options
      .filter((option) => option.candidates.length > 0)
      .sort((a, b) => a.candidates.length - b.candidates.length || b.duration - a.duration || a.order - b.order)

    for (const option of schedulable) {
      const choice = findBestStart(
        option.candidates,
        option.duration,
        assigned,
        windowStart,
        windowEnd,
      )
      assigned.push({
        analyst: option.analyst,
        start: choice.start,
        end: choice.start + option.duration,
        overlapMinutes: choice.overlapMinutes,
      })
    }

    for (const option of unschedulable) {
      warnings.push(`${option.analyst.name} não tem um bloco livre na janela de ${name}.`)
    }
    for (const lunch of assigned) {
      if (lunch.overlapMinutes > 0) {
        warnings.push(`${lunch.analyst.name} tem sobreposição de almoço na janela de ${name}.`)
      }
    }

    const assignments: Record<string, LunchAssignment | null> = Object.fromEntries(
      analysts.map((analyst) => [analyst.id, null]),
    )
    for (const lunch of assigned) {
      assignments[lunch.analyst.id] = {
        start: formatClock(lunch.start),
        end: formatClock(lunch.end),
        overlapMinutes: lunch.overlapMinutes,
      }
    }

    return { name, assignments }
  })

  return { sourceName, days, warnings }
}

export async function readScheduleFile(
  file: File,
  analysts: Analyst[],
  window: LunchWindow,
): Promise<ScheduleResult> {
  const readXlsxFile = (await import('read-excel-file/browser')).default
  const sheets = await readXlsxFile(file)
  const rows = sheets[0]?.data as unknown[][] | undefined
  if (!rows) throw new Error('O arquivo Excel não contém planilhas.')
  return createSchedule(rows, file.name, analysts, window)
}

const WEEKDAY_NAMES = /^(segunda|terça|terça-feira|quarta|quarta-feira|quinta|quinta-feira|sexta|sexta-feira|sábado|sabado|domingo)/i
const DATE_HEADER = /(\d{1,2})[/.:-](\d{1,2})(?:[/.:-](\d{2,4}))?/u

function parseDateHeader(value: unknown, referenceYear: number): number | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  }

  if (typeof value === 'number' && value >= 1) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const milliseconds = excelEpoch + value * 24 * 60 * 60 * 1000
    const date = new Date(milliseconds)
    if (!Number.isNaN(date.getTime())) {
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    }
  }

  const match = String(value).match(DATE_HEADER)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2]) - 1
  const date = new Date(referenceYear, month, day)
  return date.getTime()
}

function dayName(value: unknown): string | null {
  const text = String(value).trim()
  if (!text) return null
  if (WEEKDAY_NAMES.test(text)) return text
  const date = parseDateHeader(text, new Date().getFullYear())
  return date === null ? null : text
}

function startOfWeek(date: Date): number {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - offset)
  return result.getTime()
}

function findActiveTable(rows: unknown[][]): { headerRow: number; firstColumn: number; dayColumns: DayColumn[]; rows: unknown[][] } {
  const now = new Date()
  const currentWeek = startOfWeek(now)
  const candidates: Array<{ headerRow: number; firstColumn: number; dayColumns: DayColumn[]; tableDateScore: number }> = []

  for (let headerRow = 0; headerRow < rows.length; headerRow += 1) {
    const row = rows[headerRow] ?? []
    for (let firstColumn = 1; firstColumn < row.length - 3; firstColumn += 1) {
      let runLength = 0
      for (let column = firstColumn; column < row.length && dayName(row[column]); column += 1) runLength += 1
      if (runLength < 5) continue

      const possibleRanges: Array<DayColumn[]> = []
      for (let offset = 0; offset + 5 <= runLength; offset += 1) {
        possibleRanges.push(Array.from({ length: 5 }, (_, index) => {
          const column = firstColumn + offset + index
          return { name: formatDateHeader(row[column], now.getFullYear()), column }
        }))
      }

      for (const dayColumns of possibleRanges) {
        const dates = dayColumns
          .map(({ name }) => parseDateHeader(name, now.getFullYear()))
          .filter((date): date is number => date !== null)
        const tableDateScore = dates.length
          ? Math.abs(startOfWeek(new Date(dates[0])) - currentWeek)
          : Number.MAX_SAFE_INTEGER
        candidates.push({ headerRow, firstColumn, dayColumns, tableDateScore })
      }
      break
    }
  }

  if (candidates.length === 0) throw new Error('Não encontrei uma tabela semanal válida de dias da semana.')

  const active = [...candidates].sort((left, right) => left.tableDateScore - right.tableDateScore || right.headerRow - left.headerRow)[0]
  const nextHeaderIndex = rows.findIndex((_, index) => {
    if (index <= active.headerRow) return false
    return (rows[index] ?? []).slice(1).filter((value) => dayName(value)).length >= 5
  })
  const tableRows = rows.slice(active.headerRow, nextHeaderIndex === -1 ? rows.length : nextHeaderIndex)
  return { ...active, rows: tableRows }
}

function formatDateHeader(value: unknown, referenceYear: number): string {
  const timestamp = parseDateHeader(value, referenceYear)
  if (timestamp === null) return String(value).trim()
  const date = new Date(timestamp)
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`
}