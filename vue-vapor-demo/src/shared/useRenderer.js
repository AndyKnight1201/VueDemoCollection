import { computed, onBeforeUnmount, onMounted, ref, version } from 'vue'
import {
  BenchmarkCancelledError,
  resetRows,
  runBenchmark,
} from './benchmark.js'
import {
  MESSAGE_TYPES,
  validateRunPayload,
  validateStopPayload,
} from './protocol.js'

const DEFAULT_COUNT = 10_000
const DEFAULT_SEED = 2026

export function useRenderer(renderer) {
  const rows = ref([])
  const status = ref('Initializing')
  const progress = ref({ phase: 'idle', current: 0, total: 0 })
  const errorMessage = ref('')
  let generation = 0
  let running = false

  const rowCount = computed(() => rows.value.length)
  const progressLabel = computed(() => {
    if (progress.value.phase === 'idle') return status.value
    const phase = progress.value.phase === 'warmup' ? 'Warmup' : 'Measured'
    return `${phase} ${progress.value.current} / ${progress.value.total}`
  })

  function post(message) {
    window.parent.postMessage({ renderer, ...message }, window.location.origin)
  }

  function postError(requestId, error) {
    const message = error instanceof Error ? error.message : String(error)
    errorMessage.value = message
    status.value = 'Error'
    post({
      type: MESSAGE_TYPES.BENCHMARK_ERROR,
      requestId,
      error: message,
    })
  }

  async function handleRun(payload) {
    const validation = validateRunPayload(payload)
    if (!validation.ok) {
      postError(payload?.requestId ?? 'invalid-request', new TypeError(validation.error))
      return
    }
    if (running) {
      postError(payload.requestId, new Error('Renderer is already running a benchmark'))
      return
    }

    generation += 1
    const runGeneration = generation
    running = true
    errorMessage.value = ''
    status.value = 'Running'
    progress.value = { phase: 'idle', current: 0, total: 0 }
    post({ type: MESSAGE_TYPES.BENCHMARK_STARTED, requestId: payload.requestId })

    try {
      const values = await runBenchmark(rows, payload, {
        shouldCancel: () => generation !== runGeneration,
        onProgress: (nextProgress) => {
          progress.value = nextProgress
          post({
            type: MESSAGE_TYPES.BENCHMARK_PROGRESS,
            requestId: payload.requestId,
            ...nextProgress,
          })
        },
      })

      if (generation !== runGeneration) return
      status.value = 'Complete'
      progress.value = { phase: 'idle', current: 0, total: 0 }
      post({
        type: MESSAGE_TYPES.BENCHMARK_RESULT,
        requestId: payload.requestId,
        action: payload.action,
        values,
      })
    } catch (error) {
      if (!(error instanceof BenchmarkCancelledError) && generation === runGeneration) {
        postError(payload.requestId, error)
      }
    } finally {
      if (generation === runGeneration) running = false
    }
  }

  function handleStop(payload) {
    const validation = validateStopPayload(payload)
    if (!validation.ok) {
      postError(payload?.requestId ?? 'invalid-request', new TypeError(validation.error))
      return
    }

    generation += 1
    running = false
    errorMessage.value = ''
    status.value = 'Ready'
    progress.value = { phase: 'idle', current: 0, total: 0 }
    post({ type: MESSAGE_TYPES.STOP_DONE, requestId: payload.requestId })
  }

  function handleMessage(event) {
    if (event.source !== window.parent || event.origin !== window.location.origin) return
    if (event.data?.type === MESSAGE_TYPES.RUN_BENCHMARK) void handleRun(event.data)
    if (event.data?.type === MESSAGE_TYPES.STOP_BENCHMARK) handleStop(event.data)
  }

  onMounted(async () => {
    window.addEventListener('message', handleMessage)
    try {
      await resetRows(rows, DEFAULT_COUNT, DEFAULT_SEED)
      status.value = 'Ready'
      post({
        type: MESSAGE_TYPES.CHILD_READY,
        requestId: `ready-${renderer}`,
        vueVersion: version,
      })
    } catch (error) {
      postError(`ready-${renderer}`, error)
    }
  })

  onBeforeUnmount(() => {
    generation += 1
    window.removeEventListener('message', handleMessage)
  })

  return {
    errorMessage,
    progressLabel,
    rowCount,
    rows,
    status,
  }
}
