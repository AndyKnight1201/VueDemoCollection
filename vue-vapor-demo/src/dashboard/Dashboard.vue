<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, version } from 'vue'
import { ROW_COUNTS } from '../shared/data.js'
import { ACTIONS, MESSAGE_TYPES, RENDERERS } from '../shared/protocol.js'
import { calculateRatio, calculateStats } from '../shared/stats.js'

const REQUEST_TIMEOUT_MS = 180_000
const TRANSLATIONS = Object.freeze({
  en: {
    settings: {
      rows: 'Rows',
      warmup: 'Warmup Runs',
      measured: 'Measured Runs',
      seed: 'Seed',
    },
    actions: {
      'initial-render': 'Initial Render',
      'update-10-percent': 'Update 10%',
      'update-all': 'Update All',
      'append-1000': 'Append 1,000',
      'remove-1000': 'Remove 1,000',
      shuffle: 'Shuffle',
    },
    stopTest: 'Stop Test',
    stopping: 'Stopping…',
    clearRecords: 'Clear Records',
    emptyResult: 'Run an action to measure this renderer.',
    emptyRatio: 'Complete a test to build the ratio trend.',
    ratio: 'RATIO',
    ratioFormula: 'Vapor avg / VDOM avg',
  },
  'zh-TW': {
    settings: {
      rows: '資料筆數',
      warmup: '暖身次數',
      measured: '測量次數',
      seed: '隨機種子',
    },
    actions: {
      'initial-render': '初始渲染',
      'update-10-percent': '更新 10%',
      'update-all': '全部更新',
      'append-1000': '新增 1,000',
      'remove-1000': '移除 1,000',
      shuffle: '重新排序',
    },
    stopTest: '停止測試',
    stopping: '停止中…',
    clearRecords: '清除紀錄',
    emptyResult: '執行一項操作以測量此渲染器。',
    emptyRatio: '完成測試後將顯示比率趨勢。',
    ratio: '比率',
    ratioFormula: 'Vapor 平均值 / VDOM 平均值',
  },
})
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
const history = ref([])
const busy = ref(false)
const stopping = ref(false)
const currentAction = ref('')
const currentRenderer = ref('')
const currentProgress = ref('Waiting for renderers')
const errorMessage = ref('')
const locale = ref('en')
const pending = new Map()
let requestSequence = 0
let operationSequence = 0
let historySequence = 0

const CHART_HEIGHT = 260
const CHART_HORIZONTAL_PADDING = 42
const CHART_TOP_PADDING = 38
const CHART_BOTTOM_PADDING = 26
const CHART_POINT_GAP = 84

const bothReady = computed(() => ready.vdom && ready.vapor)
const copy = computed(() => TRANSLATIONS[locale.value])
const vueVersion = computed(() => childVersions.vdom || childVersions.vapor || version)
const ratioChart = computed(() => {
  const entries = [...history.value].reverse()
  const width = Math.max(
    280,
    CHART_HORIZONTAL_PADDING * 2 + Math.max(entries.length - 1, 0) * CHART_POINT_GAP,
  )

  if (entries.length === 0) return { height: CHART_HEIGHT, points: [], polyline: '', width }

  const values = entries.map(({ ratio }) => ratio)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const span = maximum - minimum
  const drawableHeight = CHART_HEIGHT - CHART_TOP_PADDING - CHART_BOTTOM_PADDING

  const points = entries.map((entry, index) => {
    const firstPointX = (width - Math.max(entries.length - 1, 0) * CHART_POINT_GAP) / 2
    const x =
      entries.length === 1
        ? width / 2
        : firstPointX + index * CHART_POINT_GAP
    const y =
      span === 0
        ? CHART_TOP_PADDING + drawableHeight / 2
        : CHART_TOP_PADDING + ((maximum - entry.ratio) / span) * drawableHeight

    return {
      id: entry.id,
      label: entry.ratio.toFixed(3),
      value: entry.ratio,
      x,
      y,
    }
  })

  return {
    height: CHART_HEIGHT,
    points,
    polyline: points.map(({ x, y }) => `${x},${y}`).join(' '),
    width,
  }
})
const statusLabel = computed(() => {
  if (busy.value) return currentProgress.value
  if (bothReady.value) return 'Ready'
  const readyCount = Number(ready.vdom) + Number(ready.vapor)
  return `Loading ${readyCount} / 2`
})

function setFrameRef(renderer, element) {
  frameRefs[renderer].value = element
}

function toggleLanguage() {
  locale.value = locale.value === 'en' ? 'zh-TW' : 'en'
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
    case MESSAGE_TYPES.STOP_DONE:
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

function cancelPendingRequests(reason = 'Operation cancelled') {
  for (const [requestId, entry] of pending) {
    clearTimeout(entry.timeout)
    entry.reject(new Error(reason))
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
  const nextResult = {}

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
      nextResult[renderer] = {
        samples: response.values.length,
        stats: calculateStats(response.values),
      }
    }

    historySequence += 1
    history.value.unshift({
      id: historySequence,
      action,
      count: settings.count,
      runs: settings.runs,
      seed: settings.seed,
      vapor: nextResult.vapor,
      vdom: nextResult.vdom,
      ratio: calculateRatio(nextResult.vapor.stats, nextResult.vdom.stats),
    })
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

async function stopBenchmark() {
  if (!busy.value || stopping.value) return

  operationSequence += 1
  const operation = operationSequence
  const renderer = currentRenderer.value
  cancelPendingRequests('Operation stopped by user')
  stopping.value = true
  errorMessage.value = ''
  currentAction.value = ''
  currentProgress.value = copy.value.stopping

  try {
    if (renderer) {
      const requestId = createRequestId(renderer, 'stop')
      await sendRequest(renderer, MESSAGE_TYPES.STOP_BENCHMARK, { requestId })
    }
    if (operation === operationSequence) currentProgress.value = 'Ready'
  } catch (error) {
    if (operation === operationSequence) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      currentProgress.value = 'Stop failed'
    }
  } finally {
    if (operation === operationSequence) {
      busy.value = false
      stopping.value = false
      currentRenderer.value = ''
    }
  }
}

function clearRecords() {
  if (busy.value) return
  history.value = []
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
        <button
          class="language-toggle"
          type="button"
          :aria-label="locale === 'en' ? '切換為中文' : 'Switch to English'"
          @click="toggleLanguage"
        >
          {{ locale === 'en' ? '中文' : 'EN' }}
        </button>
      </div>
    </header>

    <section class="control-panel" aria-label="Benchmark controls">
      <div class="settings-grid">
        <label>
          <span>{{ copy.settings.rows }}</span>
          <select v-model.number="settings.count" :disabled="busy">
            <option v-for="count in ROW_COUNTS" :key="count" :value="count">
              {{ count.toLocaleString() }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ copy.settings.warmup }}</span>
          <input v-model.number="settings.warmup" type="number" min="0" max="10" :disabled="busy" />
        </label>
        <label>
          <span>{{ copy.settings.measured }}</span>
          <input v-model.number="settings.runs" type="number" min="1" max="30" :disabled="busy" />
        </label>
        <!-- <label>
          <span>{{ copy.settings.seed }}</span>
          <input
            v-model.number="settings.seed"
            type="number"
            min="0"
            max="4294967295"
            :disabled="busy"
          />
        </label> -->
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
          {{ copy.actions[action.id] }}
        </button>
        <button class="stop-button" type="button" :disabled="!busy || stopping" @click="stopBenchmark">
          {{ stopping ? copy.stopping : copy.stopTest }}
        </button>
        <button
          class="clear-button"
          type="button"
          :disabled="busy || history.length === 0"
          @click="clearRecords"
        >
          {{ copy.clearRecords }}
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
        </div>
        <div v-if="history.length" class="result-table-scroll">
          <table class="result-table">
            <thead>
              <tr>
                <th>samples</th>
                <th>avg</th>
                <th>median</th>
                <th>min</th>
                <th>max</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in history" :key="entry.id">
                <td>{{ entry[renderer].samples }}</td>
                <td>{{ formatMs(entry[renderer].stats.avg) }}</td>
                <td>{{ formatMs(entry[renderer].stats.median) }}</td>
                <td>{{ formatMs(entry[renderer].stats.min) }}</td>
                <td>{{ formatMs(entry[renderer].stats.max) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="empty-result">{{ copy.emptyResult }}</p>
      </article>

      <article class="ratio-card">
        <div class="result-heading">
          <span class="result-renderer">{{ copy.ratio }}</span>
        </div>
        <div v-if="history.length" class="ratio-chart-scroll">
          <svg
            class="ratio-chart"
            role="img"
            :aria-label="copy.ratioFormula"
            :viewBox="`0 0 ${ratioChart.width} ${ratioChart.height}`"
            :style="{ width: `${ratioChart.width}px` }"
          >
            <polyline
              v-if="ratioChart.points.length > 1"
              class="ratio-line"
              :points="ratioChart.polyline"
            />
            <g v-for="point in ratioChart.points" :key="point.id" class="ratio-point">
              <circle :cx="point.x" :cy="point.y" r="4" />
              <text :x="point.x" :y="Math.max(18, point.y - 12)">{{ point.label }}</text>
            </g>
          </svg>
        </div>
        <p v-else class="empty-result ratio-empty">{{ copy.emptyRatio }}</p>
        <span>{{ copy.ratioFormula }}</span>
      </article>
    </section>

    <footer>
      Relative comparison only · Not an official Vue benchmark · Results vary by workload and device
    </footer>
  </main>
</template>
