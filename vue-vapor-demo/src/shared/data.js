export const ROW_COUNTS = Object.freeze([1_000, 5_000, 10_000, 20_000])
export const APPEND_COUNT = 1_000
export const DEPARTMENTS = Object.freeze(['RD', 'Product', 'Design', 'Sales', 'Support'])

export function mulberry32(seed) {
  let value = seed >>> 0

  return function random() {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function generateRows(count, seed, startId = 1) {
  const random = mulberry32(seed)
  const rows = new Array(count)

  for (let index = 0; index < count; index += 1) {
    const id = startId + index
    rows[index] = {
      id,
      name: `User ${String(id).padStart(5, '0')}`,
      department: DEPARTMENTS[Math.floor(random() * DEPARTMENTS.length)],
      unread: Math.floor(random() * 10),
      score: Math.floor(random() * 100),
      active: random() >= 0.5,
    }
  }

  return rows
}

export function selectDeterministicIndices(length, amount, seed) {
  const indices = Array.from({ length }, (_, index) => index)
  const random = mulberry32(seed ^ 0x9e3779b9)

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[indices[index], indices[target]] = [indices[target], indices[index]]
  }

  return indices.slice(0, Math.min(amount, length)).sort((left, right) => left - right)
}

export function shuffleRowsInPlace(rows, seed) {
  const random = mulberry32(seed ^ 0x85ebca6b)

  for (let index = rows.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
  }

  return rows
}

export function getRemoveStart(length, removeCount, seed) {
  const actualCount = Math.min(removeCount, length)
  const maximumStart = length - actualCount

  if (maximumStart <= 0) return 0

  return Math.floor(mulberry32(seed ^ 0xc2b2ae35)() * (maximumStart + 1))
}

export function updateRow(row) {
  row.score = (row.score + 7) % 100
  row.unread = (row.unread + 1) % 10
  row.active = !row.active
}

export function applyAction(rows, action, count, seed) {
  switch (action) {
    case 'initial-render':
      return generateRows(count, seed)
    case 'update-10-percent': {
      const amount = Math.floor(rows.length * 0.1)
      const indices = selectDeterministicIndices(rows.length, amount, seed)
      for (const index of indices) updateRow(rows[index])
      return rows
    }
    case 'update-all':
      for (const row of rows) updateRow(row)
      return rows
    case 'append-1000': {
      const appended = generateRows(APPEND_COUNT, seed ^ 0x27d4eb2f, count + 1)
      rows.push(...appended)
      return rows
    }
    case 'remove-1000': {
      const start = getRemoveStart(rows.length, APPEND_COUNT, seed)
      rows.splice(start, Math.min(APPEND_COUNT, rows.length))
      return rows
    }
    case 'shuffle':
      return shuffleRowsInPlace(rows, seed)
    default:
      throw new Error(`Unsupported benchmark action: ${action}`)
  }
}
