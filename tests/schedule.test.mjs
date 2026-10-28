import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import ts from 'typescript'

const source = fs.readFileSync('src/features/scheduling/schedule.ts', 'utf8')
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
const { adjustLunchAssignment, createSchedule, splitAnalystCell } = await import(moduleUrl)

const sharedFormats = [
  'Renan/Ronald',
  'Renan /Ronald',
  'Renan/ Ronald',
  'Renan / Ronald',
]

test('aceita ajuste manual em bloco de 15 minutos dentro da janela', () => {
  const adjusted = adjustLunchAssignment(null, { id: 'renan', name: 'Renan', lunchMinutes: 60 }, { start: '11:00', end: '15:00' }, '13:30')
  assert.deepEqual(adjusted, { start: '13:30', end: '14:30', overlapMinutes: 0, manuallyAdjusted: true })
})

for (const invalidStart of ['14:45', '10:45', '13:10']) {
  test(`rejeita ajuste manual inválido em ${invalidStart}`, () => {
    assert.throws(
      () => adjustLunchAssignment(null, { id: 'renan', name: 'Renan', lunchMinutes: 60 }, { start: '11:00', end: '15:00' }, invalidStart),
      /horário deve caber|Informe um horário válido/i,
    )
  })
}

for (const sharedFormat of sharedFormats) {
  test(`separa nomes em "${sharedFormat}"`, () => {
    assert.deepEqual(splitAnalystCell(sharedFormat), ['renan', 'ronald'])
  })

  test(`bloqueia 12:00-13:00 para ambos em "${sharedFormat}"`, () => {
    const rows = [
      [null, 'Horário', '26.10.2026', '27.10.2026', '28.10.2026', '29.10.2026', '30.10.2026'],
      [null, '12:00 - 13:00', null, sharedFormat, null, null, null],
      [null, '13:00 - 14:00', null, null, null, null, null],
    ]

    const result = createSchedule(rows, 'teste.xlsx', [
      { id: 'renan', name: 'Renan', lunchMinutes: 60 },
      { id: 'ronald', name: 'Ronald', lunchMinutes: 60 },
    ], { start: '11:00', end: '15:00' })

    const tuesday = result.days.find((day) => day.name === '27.10.2026')
    assert.ok(tuesday)

    for (const assignment of Object.values(tuesday.assignments)) {
      assert.ok(assignment)
      assert.equal(assignment.overlapMinutes, 0)
      const [hour, minute] = assignment.start.split(':').map(Number)
      const lunchStart = hour * 60 + minute
      assert.ok(lunchStart >= 780 || lunchStart + 60 <= 720, assignment.start)
    }
  })
}
