import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResetPayload, validateRunPayload } from '../src/shared/protocol.js'

const validRun = Object.freeze({
  requestId: 'benchmark-vdom-1',
  action: 'update-10-percent',
  count: 10_000,
  warmup: 2,
  runs: 10,
  seed: 2026,
})

test('validateRunPayload accepts a complete benchmark command', () => {
  assert.deepEqual(validateRunPayload(validRun), { ok: true })
})

test('validateRunPayload rejects unknown actions and row counts', () => {
  assert.equal(validateRunPayload({ ...validRun, action: 'fake' }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, count: 999 }).ok, false)
})

test('validateRunPayload enforces warmup and measured run ranges', () => {
  assert.equal(validateRunPayload({ ...validRun, warmup: -1 }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, warmup: 11 }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, runs: 0 }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, runs: 31 }).ok, false)
})

test('validateRunPayload enforces unsigned 32-bit seeds and request IDs', () => {
  assert.equal(validateRunPayload({ ...validRun, requestId: '' }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, seed: -1 }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, seed: 0x1_0000_0000 }).ok, false)
  assert.equal(validateRunPayload({ ...validRun, seed: 1.5 }).ok, false)
})

test('validateResetPayload validates count, seed, and request ID', () => {
  assert.deepEqual(
    validateResetPayload({ requestId: 'reset-1', count: 1_000, seed: 0 }),
    { ok: true },
  )
  assert.equal(validateResetPayload({ requestId: 'reset-1', count: 2_000, seed: 0 }).ok, false)
  assert.equal(validateResetPayload({ requestId: '', count: 1_000, seed: 0 }).ok, false)
})
