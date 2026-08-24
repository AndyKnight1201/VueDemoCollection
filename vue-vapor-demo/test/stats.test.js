import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRatio, calculateStats } from '../src/shared/stats.js'

test('calculateStats handles odd-sized samples without mutating input', () => {
  const values = [9, 1, 5]
  assert.deepEqual(calculateStats(values), { avg: 5, median: 5, min: 1, max: 9 })
  assert.deepEqual(values, [9, 1, 5])
})

test('calculateStats calculates an even-sized median', () => {
  assert.deepEqual(calculateStats([2, 8, 4, 6]), { avg: 5, median: 5, min: 2, max: 8 })
})

test('calculateStats rejects empty or invalid samples', () => {
  assert.throws(() => calculateStats([]), /At least one measured value/)
  assert.throws(() => calculateStats([1, Number.NaN]), /finite non-negative/)
})

test('calculateRatio uses Vapor average divided by VDOM average', () => {
  assert.equal(calculateRatio({ avg: 10 }, { avg: 20 }), 0.5)
  assert.equal(calculateRatio({ avg: 10 }, { avg: 0 }), null)
  assert.equal(calculateRatio(null, { avg: 20 }), null)
})
