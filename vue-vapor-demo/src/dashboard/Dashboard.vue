<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, version } from 'vue'
import { ROW_COUNTS } from '../shared/data.js'
import { ACTIONS, MESSAGE_TYPES, RENDERERS } from '../shared/protocol.js'
import { calculateRatio, calculateStats } from '../shared/stats.js'

const REQUEST_TIMEOUT_MS = 180_000
const frameRefs = {
  vdom: ref(null),
  vapor: ref(null),
}
const ready = reactive({ vdom: false, vapor: false })
const childVersions = reactive({ vdom: '', vapor: '' })
const settings = reactive({
  count: 10_000,
  warmup: 2,
  runs: 10,
  seed: 2026,
})
const results = reactive({ vdom: null, vapor: null })
const busy = ref(false)
const currentAction = ref('')
const currentRenderer = ref('')
const currentProgress = ref('Waiting for renderers')
const errorMessage = ref('')
const pending = new Map()
let requestSequence = 0
let operationSequence = 0

const bothReady = computed(() => ready.vdom && ready.vapor)
const vueVersion = computed(() => childVersions.vdom || childVersions.vapor || version)
const ratio = computed(() => calculateRatio(results.vapor, results.vdom))
const statusLabel = computed(() => {
  if (busy.value) return currentProgress.value
  if (bothReady.value) return 'Ready'
  const readyCount = Number(ready.vdom) + Number(ready.vapor)
  return `Loading ${readyCount} / 2`
})

function setFrameRef(renderer, element) {
  frameRefs[renderer].value = element
}

function rendererForSource(source) {
  return RENDERERS.find((renderer) => frameRefs[renderer].value?.contentWindow === source)
}

function createRequestId(renderer, kind) {
  requestSequence += 1
  return `${kind}-${renderer}-${Date.now()}-${requestSequence}`
}

function settlePending(message, error = null) {
  const entry = pending.get(message.requestId)
  if (!entry || entry.renderer !== message.renderer) return

  clearTimeout(entry.timeout)
  pending.delete(message.requestId)
  if (error) entry.reject(error)
  else entry.resolve(message)
}

function handleMessage(event) {
  if (event.origin !== window.location.origin) return
  const renderer = rendererForSource(event.source)
  if (!renderer || event.data?.renderer !== renderer) return

  const message = event.data
  switch (message.type) {
    case MESSAGE_TYPES.CHILD_READY:
      ready[renderer] = true
      childVersions[renderer] = message.vueVersion ?? ''
      if (bothReady.value && !busy.value) currentProgress.value = 'Ready'
      break
    case MESSAGE_TYPES.BENCHMARK_STARTED:
      currentProgress.value = `${renderer.toUpperCase()} started`
      break
    case MESSAGE_TYPES.BENCHMARK_PROGRESS: {
      const phase = message.phase === 'warmup' ? 'Warmup' : 'Measured'
      currentProgress.value = `${renderer.toUpperCase()} · ${phase} ${message.current} / ${message.total}`
      break
    }
    case MESSAGE_TYPES.BENCHMARK_RESULT:
    case MESSAGE_TYPES.RESET_DONE:
      settlePending(message)
      break
    case MESSAGE_TYPES.BENCHMARK_ERROR:
      settlePending(message, new Error(`${renderer.toUpperCase()}: ${message.error}`))
      break
    default:
      break
  }
}

function sendRequest(renderer, type, payload) {
  const frameWindow = frameRefs[renderer].value?.contentWindow
  if (!frameWindow) return Promise.reject(new Error(`${renderer.toUpperCase()} iframe is unavailable`))

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(payload.requestId)
      reject(new Error(`${renderer.toUpperCase()} timed out after 180 seconds`))
    }, REQUEST_TIMEOUT_MS)

    pending.set(payload.requestId, { renderer, resolve, reject, timeout })
    frameWindow.postMessage({ type, ...payload }, window.location.origin)
  })
}

function cancelPendingRequests() {
  for (const [requestId, entry] of pending) {
    clearTimeout(entry.timeout)
    entry.reject(new Error('Operation cancelled by reset'))
    pending.delete(requestId)
  }
}

async function runAction(action) {
  if (!bothReady.value || busy.value) return

  operationSequence += 1
  const operation = operationSequence
  busy.value = true
  errorMessage.value = ''
  currentAction.value = action
  results.vdom = null
  results.vapor = null

  try {
    for (const renderer of RENDERERS) {
      if (operation !== operationSequence) return
      currentRenderer.value = renderer
      currentProgress.value = `${renderer.toUpperCase()} · Preparing`
      const requestId = createRequestId(renderer, 'benchmark')
      const response = await sendRequest(renderer, MESSAGE_TYPES.RUN_BENCHMARK, {
        requestId,
        action,
        count: settings.count,
        warmup: settings.warmup,
        runs: settings.runs,
        seed: settings.seed,
      })
      results[renderer] = calculateStats(response.values)
    }

    currentProgress.value = 'Complete'
  } catch (error) {
    if (operation === operationSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      currentProgress.value = 'Failed'
    }
  } finally {
    if (operation === operationSequence) {
      busy.value = false
      currentRenderer.value = ''
    }
  }
}

async function resetBenchmark() {
  operationSequence += 1
  const operation = operationSequence
  cancelPendingRequests()
  busy.value = true
  errorMessage.value = ''
  currentAction.value = ''
  currentRenderer.value = ''
  currentProgress.value = 'Resetting both renderers'
  results.vdom = null
  results.vapor = null

  try {
    await Promise.all(
      RENDERERS.map((renderer) => {
        const requestId = createRequestId(renderer, 'reset')
        return sendRequest(renderer, MESSAGE_TYPES.RESET, {
          requestId,
          count: settings.count,
          seed: settings.seed,
        })
      }),
    )
    if (operation === operationSequence) currentProgress.value = 'Ready'
  } catch (error) {
    if (operation === operationSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      currentProgress.value = 'Reset failed'
    }
  } finally {
    if (operation === operationSequence) busy.value = false
  }
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`
}

onMounted(() => window.addEventListener('message', handleMessage))
onBeforeUnmount(() => {
  operationSequence += 1
  cancelPendingRequests()
  window.removeEventListener('message', handleMessage)
})
</script>

<template>
  <main class="dashboard-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">2026 Frontend Technology Meeting</p>
        <h1>Vue 3.6 Rendering Benchmark</h1>
      </div>
      <div class="topbar-meta">
        <span class="version-badge">Vue {{ vueVersion }}</span>
        <span class="status-badge" :class="{ active: busy, ready: bothReady && !busy }">
          <span class="status-dot"></span>
          {{ statusLabel }}
        </span>
      </div>
    </header>

    <section class="control-panel" aria-label="Benchmark controls">
      <div class="settings-grid">
        <label>
          <span>Rows</span>
          <select v-model.number="settings.count" :disabled="busy">
            <option v-for="count in ROW_COUNTS" :key="count" :value="count">
              {{ count.toLocaleString() }}
            </option>
          </select>
        </label>
        <label>
          <span>Warmup Runs</span>
          <input v-model.number="settings.warmup" type="number" min="0" max="10" :disabled="busy" />
        </label>
        <label>
          <span>Measured Runs</span>
          <input v-model.number="settings.runs" type="number" min="1" max="30" :disabled="busy" />
        </label>
        <label>
          <span>Seed</span>
          <input
            v-model.number="settings.seed"
            type="number"
            min="0"
            max="4294967295"
            :disabled="busy"
          />
        </label>
      </div>

      <div class="action-bar">
        <button
          v-for="action in ACTIONS"
          :key="action.id"
          type="button"
          :disabled="!bothReady || busy"
          :class="{ selected: currentAction === action.id }"
          @click="runAction(action.id)"
        >
          {{ action.label }}
        </button>
        <button class="reset-button" type="button" :disabled="!bothReady" @click="resetBenchmark">
          Reset
        </button>
      </div>
    </section>

    <p v-if="errorMessage" class="dashboard-error" role="alert">{{ errorMessage }}</p>

    <section class="renderer-grid" aria-label="Renderer previews">
      <article class="renderer-card vdom-card">
        <iframe
          :ref="(element) => setFrameRef('vdom', element)"
          src="/vdom.html"
          title="Virtual DOM renderer"
        ></iframe>
      </article>
      <article class="renderer-card vapor-card">
        <iframe
          :ref="(element) => setFrameRef('vapor', element)"
          src="/vapor.html"
          title="Vapor renderer"
        ></iframe>
      </article>
    </section>

    <section class="results-panel" aria-label="Benchmark results">
      <article v-for="renderer in RENDERERS" :key="renderer" class="result-card">
        <div class="result-heading">
          <span class="result-renderer">{{ renderer.toUpperCase() }}</span>
          <span v-if="results[renderer]" class="sample-count">{{ settings.runs }} samples</span>
        </div>
        <dl v-if="results[renderer]" class="stats-grid">
          <div><dt>avg</dt><dd>{{ formatMs(results[renderer].avg) }}</dd></div>
          <div><dt>median</dt><dd>{{ formatMs(results[renderer].median) }}</dd></div>
          <div><dt>min</dt><dd>{{ formatMs(results[renderer].min) }}</dd></div>
          <div><dt>max</dt><dd>{{ formatMs(results[renderer].max) }}</dd></div>
        </dl>
        <p v-else class="empty-result">Run an action to measure this renderer.</p>
      </article>

      <article class="ratio-card">
        <span class="result-renderer">RATIO</span>
        <strong>{{ ratio === null ? '—' : ratio.toFixed(3) }}</strong>
        <span>Vapor avg / VDOM avg</span>
      </article>
    </section>

    <footer>
      Relative comparison only · Not an official Vue benchmark · Results vary by workload and device
    </footer>
  </main>
</template>
