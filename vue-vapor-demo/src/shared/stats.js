function assertValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('At least one measured value is required')
  }

  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Measured values must be finite non-negative numbers')
  }
}

export function calculateStats(values) {
  assertValues(values)
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]

  return {
    avg: values.reduce((total, value) => total + value, 0) / values.length,
    median,
    min: sorted[0],
    max: sorted.at(-1),
  }
}

export function calculateRatio(vaporStats, vdomStats) {
  if (!vaporStats || !vdomStats || vdomStats.avg === 0) return null
  return vaporStats.avg / vdomStats.avg
}
