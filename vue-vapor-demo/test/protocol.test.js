import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MESSAGE_TYPES,
  validateRunPayload,
  validateStopPayload,
} from '../src/shared/protocol.js'

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

test('stop protocol exposes the expected message types', () => {
  assert.equal(MESSAGE_TYPES.STOP_BENCHMARK, 'STOP_BENCHMARK')
  assert.equal(MESSAGE_TYPES.STOP_DONE, 'STOP_DONE')
})

test('validateStopPayload requires a non-empty request ID', () => {
  assert.deepEqual(validateStopPayload({ requestId: 'stop-1' }), { ok: true })
  assert.equal(validateStopPayload({ requestId: '' }).ok, false)
  assert.equal(validateStopPayload(null).ok, false)
})
