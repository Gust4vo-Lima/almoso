import type { Analyst, LunchWindow } from '../scheduling/schedule'

export type AppSettings = LunchWindow & {
  analysts: Analyst[]
}

export const SETTINGS_KEY = 'almoso.settings.v1'

export const DEFAULT_SETTINGS: AppSettings = {
  start: '11:00',
  end: '15:00',
  analysts: [],
}

function isClock(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function parseSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') throw new Error('O arquivo não contém configurações válidas.')
  const data = value as Record<string, unknown>
  const source = data.settings && typeof data.settings === 'object'
    ? data.settings as Record<string, unknown>
    : data

  if (!isClock(source.start) || !isClock(source.end)) {
    throw new Error('Informe horários válidos para a janela de almoço.')
  }
  if (source.end <= source.start) throw new Error('O fim da janela deve ser posterior ao início.')
  if (!Array.isArray(source.analysts)) throw new Error('A lista de analistas não é válida.')

  const analysts = source.analysts.map((item, index): Analyst => {
    if (!item || typeof item !== 'object') throw new Error(`O analista ${index + 1} não é válido.`)
    const analyst = item as Record<string, unknown>
    const name = typeof analyst.name === 'string' ? analyst.name.trim() : ''
    const lunchMinutes = Number(analyst.lunchMinutes)
    if (!name || !Number.isInteger(lunchMinutes) || lunchMinutes < 15 || lunchMinutes > 240 || lunchMinutes % 15 !== 0) {
      throw new Error(`Revise o nome e a duração do almoço do analista ${index + 1}.`)
    }
    return {
      id: typeof analyst.id === 'string' && analyst.id ? analyst.id : crypto.randomUUID(),
      name,
      lunchMinutes,
    }
  })

  const names = new Set<string>()
  for (const analyst of analysts) {
    const normalized = analyst.name.toLocaleLowerCase('pt-BR')
    if (names.has(normalized)) throw new Error(`O nome "${analyst.name}" está duplicado.`)
    names.add(normalized)
  }

  return { start: source.start, end: source.end, analysts }
}

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    return stored ? parseSettings(JSON.parse(stored)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}