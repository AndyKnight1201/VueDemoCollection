import { ROW_COUNTS } from './data.js'

export const MESSAGE_TYPES = Object.freeze({
  CHILD_READY: 'CHILD_READY',
  RUN_BENCHMARK: 'RUN_BENCHMARK',
  BENCHMARK_STARTED: 'BENCHMARK_STARTED',
  BENCHMARK_PROGRESS: 'BENCHMARK_PROGRESS',
  BENCHMARK_RESULT: 'BENCHMARK_RESULT',
  BENCHMARK_ERROR: 'BENCHMARK_ERROR',
  RESET: 'RESET',
  RESET_DONE: 'RESET_DONE',
})

export const RENDERERS = Object.freeze(['vdom', 'vapor'])
export const ACTIONS = Object.freeze([
  { id: 'initial-render', label: 'Initial Render' },
  { id: 'update-10-percent', label: 'Update 10%' },
  { id: 'update-all', label: 'Update All' },
  { id: 'append-1000', label: 'Append 1,000' },
  { id: 'remove-1000', label: 'Remove 1,000' },
  { id: 'shuffle', label: 'Shuffle' },
])

const ACTION_IDS = new Set(ACTIONS.map(({ id }) => id))
const MAX_SEED = 0xffff_ffff

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validateRunPayload(payload) {
  if (!isRecord(payload)) return { ok: false, error: 'Payload must be an object' }
  if (typeof payload.requestId !== 'string' || payload.requestId.length === 0) {
    return { ok: false, error: 'requestId is required' }
  }
  if (!ACTION_IDS.has(payload.action)) return { ok: false, error: 'Unknown benchmark action' }
  if (!ROW_COUNTS.includes(payload.count)) return { ok: false, error: 'Unsupported row count' }
  if (!Number.isInteger(payload.warmup) || payload.warmup < 0 || payload.warmup > 10) {
    return { ok: false, error: 'warmup must be an integer from 0 to 10' }
  }
  if (!Number.isInteger(payload.runs) || payload.runs < 1 || payload.runs > 30) {
    return { ok: false, error: 'runs must be an integer from 1 to 30' }
  }
  if (!Number.isInteger(payload.seed) || payload.seed < 0 || payload.seed > MAX_SEED) {
    return { ok: false, error: 'seed must be an unsigned 32-bit integer' }
  }
  return { ok: true }
}

export function validateResetPayload(payload) {
  if (!isRecord(payload)) return { ok: false, error: 'Payload must be an object' }
  if (typeof payload.requestId !== 'string' || payload.requestId.length === 0) {
    return { ok: false, error: 'requestId is required' }
  }
  if (!ROW_COUNTS.includes(payload.count)) return { ok: false, error: 'Unsupported row count' }
  if (!Number.isInteger(payload.seed) || payload.seed < 0 || payload.seed > MAX_SEED) {
    return { ok: false, error: 'seed must be an unsigned 32-bit integer' }
  }
  return { ok: true }
}
