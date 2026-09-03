<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { supportsMediaLazy } from '../browserSupport.js'
import { useLocale } from '../i18n.js'
import { parseMediaMode } from '../utils/mediaMode.js'

const MEDIA_COUNT = 20
const { copy } = useLocale()
const route = useRoute()
const activeMode = computed(() => parseMediaMode(route.query.mode))
const pendingMode = ref(activeMode.value)
const mediaSupported = supportsMediaLazy()
const resources = ref([])
const tones = Array.from({ length: MEDIA_COUNT }, (_, index) => {
  const number = String(index + 1).padStart(2, '0')
  return { id: number, src: `/media/tone-${number}.wav`, frequency: 220 + index * 24 }
})
let observer

const hasPendingChange = computed(() => pendingMode.value !== activeMode.value)
const loadedCount = computed(() => resources.value.length)

function resourceKey(entry) {
  try {
    return new URL(entry.name).pathname
  } catch {
    return entry.name
  }
}

function addResourceEntries(entries) {
  const byPath = new Map(resources.value.map((entry) => [entry.path, entry]))
  for (const entry of entries) {
    const path = resourceKey(entry)
    if (!path.includes('/media/')) continue
    byPath.set(path, {
      path,
      file: path.split('/').pop(),
      duration: Number(entry.duration) || 0,
      transferSize: Number(entry.transferSize) || 0,
      initiatorType: entry.initiatorType || 'resource',
      startTime: Number(entry.startTime) || 0,
    })
  }
  resources.value = [...byPath.values()].sort((a, b) => a.startTime - b.startTime)
}

function targetUrl(mode) {
  const url = new URL(window.location.href)
  url.pathname = '/media-lazy'
  url.searchParams.set('mode', mode)
  url.hash = ''
  return url.toString()
}

function applyAndReload() {
  window.location.assign(targetUrl(pendingMode.value))
}

function reloadCurrentMode() {
  window.location.reload()
}

function resetToLazy() {
  window.location.assign(targetUrl('lazy'))
}

function formatBytes(value) {
  if (!value) return 'cache / unknown'
  return value >= 1024 ? `${(value / 1024).toFixed(1)} KB` : `${value} B`
}

onMounted(() => {
  if (!globalThis.PerformanceObserver) return
  try {
    observer = new PerformanceObserver((list) => addResourceEntries(list.getEntries()))
    observer.observe({ type: 'resource', buffered: true })
  } catch (error) {
    console.warn('Resource PerformanceObserver is unavailable', error)
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main class="page demo-page media-page">
    <section class="page-heading">
      <span class="version-pill cyan">{{ copy.media.version }}</span>
      <h1>{{ copy.media.title }}</h1>
      <p>{{ copy.media.lead }}</p>
    </section>

    <p v-if="!mediaSupported" class="warning-banner" role="status">
      {{ copy.media.unsupported }} {{ copy.common.chromeRequired.replace('{version}', '148') }}.
    </p>

    <section class="media-toolbar control-card">
      <div class="active-mode">
        <span>{{ copy.media.activeMode }}</span>
        <strong :class="`mode-${activeMode}`">{{ activeMode.toUpperCase() }}</strong>
      </div>
      <fieldset>
        <legend>{{ copy.media.chooseMode }}</legend>
        <label><input v-model="pendingMode" type="radio" value="lazy" /> {{ copy.media.lazy }}</label>
        <label><input v-model="pendingMode" type="radio" value="eager" /> {{ copy.media.eager }}</label>
      </fieldset>
      <div class="toolbar-actions">
        <button class="primary-button" type="button" :disabled="!hasPendingChange" @click="applyAndReload">
          {{ copy.media.applyReload }}
        </button>
        <button type="button" @click="reloadCurrentMode">{{ copy.media.reload }}</button>
        <button type="button" :disabled="activeMode === 'lazy' && !hasPendingChange" @click="resetToLazy">
          {{ copy.media.reset }}
        </button>
      </div>
      <p v-if="hasPendingChange" class="pending-note">{{ copy.media.pending }}</p>
      <p class="network-hint">{{ copy.media.networkHint }}</p>
    </section>

    <div class="media-layout">
      <section class="tone-list" aria-label="Local WAV audio elements">
        <article v-for="(tone, index) in tones" :key="`${activeMode}-${tone.id}`" class="tone-card">
          <div>
            <span class="tone-number">{{ tone.id }}</span>
            <div>
              <h2>{{ copy.media.tone }} {{ tone.id }}</h2>
              <p>{{ tone.frequency }} Hz · tone-{{ tone.id }}.wav</p>
            </div>
          </div>
          <audio
            controls
            preload="metadata"
            :loading="activeMode"
            :src="tone.src"
          ></audio>
          <p v-if="index < tones.length - 1" class="scroll-cue">↓ {{ copy.media.distance }}</p>
        </article>
      </section>

      <aside class="resource-panel">
        <div class="resource-count">
          <span>{{ copy.media.loaded }}</span>
          <strong>{{ loadedCount }} <small>/ {{ MEDIA_COUNT }}</small></strong>
        </div>
        <h2>{{ copy.media.resourceLog }}</h2>
        <ol v-if="resources.length" class="resource-list">
          <li v-for="resource in resources" :key="resource.path">
            <strong>{{ resource.file }}</strong>
            <span>{{ resource.initiatorType }}</span>
            <small>
              {{ copy.media.duration }} {{ resource.duration.toFixed(1) }}ms ·
              {{ copy.media.transfer }} {{ formatBytes(resource.transferSize) }}
            </small>
          </li>
        </ol>
        <p v-else class="empty-state">{{ copy.media.emptyLog }}</p>
      </aside>
    </div>
  </main>
</template>
