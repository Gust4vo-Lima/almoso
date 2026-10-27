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

  const match = String(value).trim().match(/^(\d{1,2})\s*[:h.]\s*(\d{2})$/i)
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

  const header = rows[0] ?? []
  const dayColumns: DayColumn[] = header
    .slice(1)
    .map((value, index) => ({ name: String(value).trim(), column: index + 1 }))
    .filter((day) => day.name.length > 0)
  if (dayColumns.length === 0) {
    throw new Error('Não encontrei os dias da semana no cabeçalho da primeira linha.')
  }

  const windowStart = parseClock(window.start)
  const windowEnd = parseClock(window.end)
  if (windowStart === null || windowEnd === null || windowEnd <= windowStart) {
    throw new Error('A janela de almoço configurada não é válida.')
  }

  const timeRows = rows.slice(1).flatMap((row) => {
    const time = parseClock(row[0])
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