import assert from 'node:assert/strict'
import test from 'node:test'
import { GROUPS, TEXT_FIT_CASES } from '../src/textFitCases.js'

const EXPECTED_DECLARATIONS = [
  'none',
  'grow',
  'grow consistent',
  'grow per-line',
  'grow per-line-all',
  'grow consistent 200%',
  'grow per-line 200%',
  'grow per-line-all 200%',
  'shrink',
  'shrink consistent',
  'shrink per-line',
  'shrink per-line-all',
  'shrink consistent 50%',
  'shrink per-line 50%',
  'shrink per-line-all 50%',
]

test('catalog 恰好包含 15 個唯一案例', () => {
  assert.equal(TEXT_FIT_CASES.length, 15)
  assert.equal(new Set(TEXT_FIT_CASES.map((entry) => entry.id)).size, 15)
  assert.equal(new Set(TEXT_FIT_CASES.map((entry) => entry.declaration)).size, 15)
  assert.deepEqual(TEXT_FIT_CASES.map((entry) => entry.declaration), EXPECTED_DECLARATIONS)
})

test('none、grow、shrink 三組均有案例', () => {
  assert.deepEqual(GROUPS.map((group) => group.id), ['none', 'grow', 'shrink'])
  for (const group of GROUPS) {
    assert.ok(TEXT_FIT_CASES.some((entry) => entry.group === group.id))
  }
})

test('grow 與 shrink 完整涵蓋三種行策略', () => {
  for (const direction of ['grow', 'shrink']) {
    for (const strategy of ['consistent', 'per-line', 'per-line-all']) {
      assert.ok(
        TEXT_FIT_CASES.some((entry) => entry.declaration === `${direction} ${strategy}`),
        `缺少 ${direction} ${strategy}`,
      )
    }
  }
})

test('grow 200% 與 shrink 50% 完整涵蓋三種行策略', () => {
  for (const strategy of ['consistent', 'per-line', 'per-line-all']) {
    assert.ok(TEXT_FIT_CASES.some(
      (entry) => entry.declaration === `grow ${strategy} 200%`,
    ))
    assert.ok(TEXT_FIT_CASES.some(
      (entry) => entry.declaration === `shrink ${strategy} 50%`,
    ))
  }
})

test('每張卡片都有繁中教學內容與完整欄位', () => {
  const containsHan = /[\u3400-\u9fff]/u

  for (const entry of TEXT_FIT_CASES) {
    assert.match(entry.title, containsHan)
    assert.match(entry.explanation, containsHan)
    assert.match(entry.observation, containsHan)
    assert.equal(typeof entry.fixture, 'string')
    assert.ok(entry.fixture.length > 0)
    assert.equal(typeof entry.baseFontSize, 'number')
    assert.ok(entry.baseFontSize > 0)
  }
})

