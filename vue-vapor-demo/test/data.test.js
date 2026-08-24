import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyAction,
  generateRows,
  getRemoveStart,
  mulberry32,
  selectDeterministicIndices,
} from '../src/shared/data.js'

test('mulberry32 produces a repeatable sequence', () => {
  const left = mulberry32(2026)
  const right = mulberry32(2026)
  assert.deepEqual(
    Array.from({ length: 8 }, () => left()),
    Array.from({ length: 8 }, () => right()),
  )
})

test('generateRows is deterministic and seed-sensitive', () => {
  assert.deepEqual(generateRows(20, 2026), generateRows(20, 2026))
  assert.notDeepEqual(generateRows(20, 2026), generateRows(20, 2027))
})

test('deterministic indices are unique, sorted, and in range', () => {
  const indices = selectDeterministicIndices(1_000, 100, 2026)
  assert.equal(indices.length, 100)
  assert.equal(new Set(indices).size, 100)
  assert.ok(indices.every((index) => index >= 0 && index < 1_000))
  assert.deepEqual(indices, [...indices].sort((left, right) => left - right))
  assert.deepEqual(indices, selectDeterministicIndices(1_000, 100, 2026))
})

test('initial render replaces the list with the requested deterministic data', () => {
  const result = applyAction([], 'initial-render', 1_000, 2026)
  assert.equal(result.length, 1_000)
  assert.deepEqual(result, generateRows(1_000, 2026))
})

test('update 10 percent changes exactly the selected rows', () => {
  const baseline = generateRows(1_000, 2026)
  const rows = structuredClone(baseline)
  applyAction(rows, 'update-10-percent', 1_000, 2026)

  const changed = rows.filter((row, index) => {
    const previous = baseline[index]
    return row.score !== previous.score || row.unread !== previous.unread || row.active !== previous.active
  })
  assert.equal(changed.length, 100)
  assert.ok(rows.every((row, index) => row.id === baseline[index].id))
})

test('update all applies the documented field formulas', () => {
  const baseline = generateRows(25, 2026)
  const rows = structuredClone(baseline)
  applyAction(rows, 'update-all', 25, 2026)

  rows.forEach((row, index) => {
    assert.equal(row.score, (baseline[index].score + 7) % 100)
    assert.equal(row.unread, (baseline[index].unread + 1) % 10)
    assert.equal(row.active, !baseline[index].active)
  })
})

test('append 1000 adds stable IDs after the baseline', () => {
  const rows = generateRows(1_000, 2026)
  applyAction(rows, 'append-1000', 1_000, 2026)
  assert.equal(rows.length, 2_000)
  assert.equal(rows[1_000].id, 1_001)
  assert.equal(rows.at(-1).id, 2_000)
})

test('remove 1000 uses a valid deterministic start and supports an empty result', () => {
  assert.equal(getRemoveStart(1_000, 1_000, 2026), 0)
  assert.equal(getRemoveStart(5_000, 1_000, 2026), getRemoveStart(5_000, 1_000, 2026))

  const rows = generateRows(1_000, 2026)
  applyAction(rows, 'remove-1000', 1_000, 2026)
  assert.equal(rows.length, 0)
})

test('shuffle preserves the row identity set and changes order deterministically', () => {
  const baseline = generateRows(1_000, 2026)
  const left = structuredClone(baseline)
  const right = structuredClone(baseline)
  applyAction(left, 'shuffle', 1_000, 2026)
  applyAction(right, 'shuffle', 1_000, 2026)

  assert.deepEqual(left, right)
  assert.notDeepEqual(
    left.map(({ id }) => id),
    baseline.map(({ id }) => id),
  )
  assert.deepEqual(
    left.map(({ id }) => id).sort((a, b) => a - b),
    baseline.map(({ id }) => id),
  )
})

test('unknown actions are rejected', () => {
  assert.throws(() => applyAction([], 'unknown', 1_000, 2026), /Unsupported benchmark action/)
})
