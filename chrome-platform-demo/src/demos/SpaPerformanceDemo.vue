<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { getPerformanceSupport } from '../browserSupport.js'
import { SPA_VIEWS } from '../config.js'
import { useLocale } from '../i18n.js'
import {
  beginNavigationRun,
  cancelNavigationRun,
  clearPerformanceTimeline,
  completeNavigationRun,
  navigationRuns,
  performanceTimeline,
  startPerformanceObservers,
} from '../services/performanceTimeline.js'

const { copy } = useLocale()
const route = useRoute()
const router = useRouter()
const support = getPerformanceSupport()
const navigating = ref(false)

const views = computed(() => SPA_VIEWS.map((view) => ({
  ...view,
  label: copy.value.spa[view.id],
})))
const sortedTimeline = computed(() => [...performanceTimeline.value].sort((a, b) => a.startTime - b.startTime))
const history = computed(() => [...navigationRuns.value].reverse())
const lastRun = computed(() => navigationRuns.value.at(-1) ?? null)
const browserMetricsSupported = computed(
  () => support.softNavigation && support.interactionContentfulPaint,
)
const stageIndex = computed(() => {
  if (!lastRun.value) return -1
  return {
    'click-captured': 0,
    waiting: 1,
    'content-rendered': 2,
    'browser-received': 3,
    cancelled: 0,
  }[lastRun.value.status] ?? -1
})
const stageItems = computed(() => [
  copy.value.spa.stages.click,
  copy.value.spa.stages.waiting,
  copy.value.spa.stages.content,
  copy.value.spa.stages.browser,
])

async function navigate(view) {
  if (route.name === view.name || navigating.value) return
  navigating.value = true
  const transitionId = beginNavigationRun(view, route.fullPath)
  try {
    const failure = await router.push({ name: view.name })
    if (failure) cancelNavigationRun(transitionId)
  } catch (error) {
    cancelNavigationRun(transitionId)
    console.error('SPA demo navigation failed', error)
  } finally {
    navigating.value = false
  }
}

function formatWallTime(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
  }).format(new Date(value))
}

function formatMetric(value) {
  return value === null || value === undefined ? '—' : `${Math.round(value)} ms`
}

function browserMetric(run, key) {
  const metricSupported = key === 'fcp'
    ? support.softNavigation
    : support.softNavigation && support.interactionContentfulPaint
  if (!metricSupported) return copy.value.spa.unavailable
  if (!run.browser.detected) return copy.value.spa.pending
  return run.browser[key] === null ? copy.value.spa.notReported : formatMetric(run.browser[key])
}

function detectionLabel(run) {
  if (run.status === 'cancelled') return copy.value.spa.cancelled
  if (!support.softNavigation) return copy.value.spa.unavailable
  return run.browser.detected ? copy.value.spa.detected : copy.value.spa.pending
}

function displayName(entry) {
  return entry.source === 'app' ? entry.name.replace(/^demo:/, '') : entry.entryType
}

watch(
  () => route.name,
  async (name, previousName) => {
    if (!route.meta.spaView || !previousName) return
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    completeNavigationRun(route.path)
  },
  { flush: 'post' },
)

onMounted(() => startPerformanceObservers())
</script>

<template>
  <main class="page demo-page spa-page">
    <section class="page-heading spa-heading">
      <div>
        <span class="version-pill lime">{{ copy.spa.version }}</span>
        <h1>{{ copy.spa.title }}</h1>
        <p>{{ copy.spa.lead }}</p>
      </div>
      <div class="support-stack">
        <span :class="support.softNavigation ? 'supported' : 'unsupported'">
          <i class="status-dot"></i> soft-navigation ·
          {{ support.softNavigation ? copy.spa.supported : copy.spa.unsupported }}
        </span>
        <span :class="support.interactionContentfulPaint ? 'supported' : 'unsupported'">
          <i class="status-dot"></i> interaction-contentful-paint ·
          {{ support.interactionContentfulPaint ? copy.spa.supported : copy.spa.unsupported }}
        </span>
      </div>
    </section>

    <div v-if="!browserMetricsSupported" class="warning-banner">
      <p v-if="!support.softNavigation">{{ copy.spa.softNavUnsupported }}</p>
      <p v-if="!support.interactionContentfulPaint">{{ copy.spa.icpUnsupported }}</p>
      <strong>{{ copy.common.chromeRequired.replace('{version}', '151') }}.</strong>
    </div>

    <section class="measurement-intro">
      <div>
        <span class="comparison-label">SPA MEASUREMENT</span>
        <h2>{{ copy.spa.measurementTitle }}</h2>
        <p>{{ copy.spa.measurementIntro }}</p>
      </div>
      <ol class="measurement-stages" aria-label="Navigation measurement progress">
        <li
          v-for="(stage, index) in stageItems"
          :key="stage"
          :class="{ complete: index <= stageIndex, current: index === stageIndex }"
        >
          <i>{{ index + 1 }}</i><span>{{ stage }}</span>
        </li>
      </ol>
    </section>

    <nav class="spa-route-nav" aria-label="SPA demo routes">
      <span>{{ copy.spa.artificialDelay }}</span>
      <button
        v-for="view in views"
        :key="view.id"
        type="button"
        :disabled="navigating || route.name === view.name"
        :class="{ active: route.name === view.name }"
        @click="navigate(view)"
      >
        {{ view.label }} <strong>{{ view.delay }}ms</strong>
      </button>
    </nav>

    <section class="spa-measurement-grid">
      <div class="route-content" aria-live="polite">
        <RouterView />
      </div>

      <aside class="last-navigation-card" aria-live="polite">
        <header>
          <span class="comparison-label">{{ copy.spa.lastNavigation }}</span>
          <button
            type="button"
            :disabled="!history.length"
            @click="clearPerformanceTimeline"
          >{{ copy.spa.clearTimeline }}</button>
        </header>
        <template v-if="lastRun">
          <div class="last-route">
            <span>{{ copy.spa.route }}</span>
            <strong>{{ lastRun.targetPath }}</strong>
          </div>
          <dl class="navigation-metrics">
            <div>
              <dt>{{ copy.spa.configuredDelay }}</dt>
              <dd>{{ lastRun.configuredDelay }} ms</dd>
            </div>
            <div class="metric-app">
              <dt>{{ copy.spa.appDuration }}</dt>
              <dd>{{ formatMetric(lastRun.app.duration) }}</dd>
            </div>
            <div class="metric-browser">
              <dt>{{ copy.spa.browserFcp }}</dt>
              <dd>{{ browserMetric(lastRun, 'fcp') }}</dd>
            </div>
            <div class="metric-browser">
              <dt>{{ copy.spa.browserLcp }}</dt>
              <dd>{{ browserMetric(lastRun, 'lcp') }}</dd>
            </div>
          </dl>
          <div class="detection-result" :class="{ detected: lastRun.browser.detected }">
            <span>{{ copy.spa.chromeDetection }}</span>
            <strong><i class="status-dot"></i>{{ detectionLabel(lastRun) }}</strong>
          </div>
        </template>
        <p v-else class="empty-state">{{ copy.spa.noNavigation }}</p>
      </aside>
    </section>

    <section class="history-panel">
      <header>
        <div>
          <span class="comparison-label">RESULTS</span>
          <h2>{{ copy.spa.resultHistory }}</h2>
        </div>
        <span>{{ history.length }}</span>
      </header>
      <div v-if="history.length" class="history-scroll">
        <table>
          <thead>
            <tr>
              <th>{{ copy.spa.route }}</th>
              <th>{{ copy.spa.configuredDelay }}</th>
              <th>{{ copy.spa.appDuration }}</th>
              <th>{{ copy.spa.browserFcp }}</th>
              <th>{{ copy.spa.browserLcp }}</th>
              <th>{{ copy.spa.chromeDetection }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in history" :key="run.id">
              <td><strong>{{ run.view }}</strong><small>{{ run.targetPath }}</small></td>
              <td>{{ run.configuredDelay }} ms</td>
              <td>{{ formatMetric(run.app.duration) }}</td>
              <td>{{ browserMetric(run, 'fcp') }}</td>
              <td>{{ browserMetric(run, 'lcp') }}</td>
              <td :class="run.browser.detected ? 'supported' : 'pending-result'">
                {{ detectionLabel(run) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">{{ copy.spa.historyEmpty }}</p>
    </section>

    <details class="raw-details-panel">
      <summary>
        <span>
          <strong>{{ copy.spa.rawDetails }}</strong>
          <small>{{ copy.spa.rawDetailsHint }}</small>
        </span>
        <b>{{ sortedTimeline.length }}</b>
      </summary>
      <p class="timeline-note">{{ copy.spa.navigationNote }}</p>
      <ol v-if="sortedTimeline.length" class="timeline-list">
        <li v-for="entry in sortedTimeline" :key="entry.id" :class="`source-${entry.source}`">
          <details>
            <summary>
              <time>{{ formatWallTime(entry.wallTime) }}</time>
              <span class="source-pill">
                {{ entry.source === 'app' ? copy.spa.appMark : copy.spa.browserEntry }}
              </span>
              <strong>{{ displayName(entry) }}</strong>
            </summary>
            <dl class="entry-detail">
              <div><dt>startTime</dt><dd>{{ entry.startTime.toFixed(2) }}ms</dd></div>
              <div><dt>duration</dt><dd>{{ entry.duration.toFixed(2) }}ms</dd></div>
              <div v-if="entry.interactionId !== undefined">
                <dt>interactionId</dt><dd>{{ entry.interactionId }}</dd>
              </div>
              <div v-if="entry.navigationId">
                <dt>navigationId</dt><dd>{{ entry.navigationId }}</dd>
              </div>
            </dl>
            <pre>{{ JSON.stringify(entry.detail, null, 2) }}</pre>
          </details>
        </li>
      </ol>
      <p v-else class="empty-state">{{ copy.spa.emptyTimeline }}</p>
    </details>
  </main>
</template>
