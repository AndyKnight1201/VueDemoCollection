import { nextTick } from 'vue'
import { applyAction, generateRows } from './data.js'
import { validateRunPayload } from './protocol.js'

export class BenchmarkCancelledError extends Error {
  constructor() {
    super('Benchmark cancelled')
    this.name = 'BenchmarkCancelledError'
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

export async function settleRender() {
  await nextTick()
  await nextFrame()
}

function assertNotCancelled(shouldCancel) {
  if (shouldCancel()) throw new BenchmarkCancelledError()
}

async function prepareBaseline(rows, config) {
  rows.value = config.action === 'initial-render' ? [] : generateRows(config.count, config.seed)
  await settleRender()
}

async function measureSample(rows, config, shouldCancel) {
  await prepareBaseline(rows, config)
  assertNotCancelled(shouldCancel)

  const start = performance.now()
  if (config.action === 'initial-render') {
    rows.value = generateRows(config.count, config.seed)
  } else {
    applyAction(rows.value, config.action, config.count, config.seed)
  }
  await settleRender()
  const duration = performance.now() - start

  assertNotCancelled(shouldCancel)
  return duration
}

export async function resetRows(rows, count, seed) {
  rows.value = generateRows(count, seed)
  await settleRender()
}

export async function runBenchmark(rows, config, options = {}) {
  const validation = validateRunPayload(config)
  if (!validation.ok) throw new TypeError(validation.error)

  const onProgress = options.onProgress ?? (() => {})
  const shouldCancel = options.shouldCancel ?? (() => false)
  const values = []

  for (let index = 0; index < config.warmup; index += 1) {
    assertNotCancelled(shouldCancel)
    onProgress({ phase: 'warmup', current: index + 1, total: config.warmup })
    await measureSample(rows, config, shouldCancel)
  }

  for (let index = 0; index < config.runs; index += 1) {
    assertNotCancelled(shouldCancel)
    onProgress({ phase: 'measured', current: index + 1, total: config.runs })
    values.push(await measureSample(rows, config, shouldCancel))
  }

  return values
}
