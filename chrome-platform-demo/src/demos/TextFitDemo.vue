<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { supportsTextFit, TEXT_FIT_DECLARATION } from '../browserSupport.js'
import { useLocale } from '../i18n.js'

const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 64
const SEARCH_STEPS = 12

const { copy } = useLocale()
const width = ref(520)
const text = ref('2026 Q3 Enterprise Messaging Platform Revenue')
const jsHeading = ref(null)
const resizeCallbacks = ref(0)
const calculations = ref(0)
const currentFontSize = ref(MAX_FONT_SIZE)
const textFitSupported = supportsTextFit()
let resizeObserver
let lastObservedWidth = -1

function probe(element, size) {
  element.style.fontSize = `${size}px`
  calculations.value += 1
  return element.scrollWidth <= element.clientWidth
}

function fitText() {
  const element = jsHeading.value
  if (!element) return

  if (!text.value) {
    currentFontSize.value = MAX_FONT_SIZE
    element.style.fontSize = `${MAX_FONT_SIZE}px`
    return
  }

  if (probe(element, MAX_FONT_SIZE)) {
    currentFontSize.value = MAX_FONT_SIZE
    return
  }

  let low = MIN_FONT_SIZE
  let high = MAX_FONT_SIZE
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2
    if (probe(element, middle)) low = middle
    else high = middle
  }
  currentFontSize.value = Number(low.toFixed(2))
  element.style.fontSize = `${currentFontSize.value}px`
}

watch(text, async () => {
  await nextTick()
  fitText()
})

onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    const observedWidth = entry?.contentRect.width ?? jsHeading.value?.clientWidth ?? 0
    if (Math.abs(observedWidth - lastObservedWidth) < 0.5) return
    lastObservedWidth = observedWidth
    resizeCallbacks.value += 1
    fitText()
  })
  resizeObserver.observe(jsHeading.value)
  fitText()
})

onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <main class="page demo-page text-fit-page">
    <section class="page-heading">
      <span class="version-pill violet">{{ copy.textFit.version }}</span>
      <h1>{{ copy.textFit.title }}</h1>
      <p>{{ copy.textFit.lead }}</p>
    </section>

    <section class="control-card text-fit-controls">
      <label>
        <span>{{ copy.textFit.width }}</span>
        <strong>{{ width }}px</strong>
        <input v-model.number="width" type="range" min="260" max="720" step="1" />
      </label>
      <label>
        <span>{{ copy.textFit.text }}</span>
        <input v-model="text" type="text" maxlength="120" />
      </label>
    </section>

    <p v-if="!textFitSupported" class="warning-banner" role="status">
      {{ copy.textFit.unsupported }} {{ copy.common.chromeRequired.replace('{version}', '150') }}.
    </p>

    <section class="comparison-grid">
      <article class="comparison-card js-comparison">
        <header>
          <div>
            <span class="comparison-label">{{ copy.textFit.jsTitle }}</span>
            <h2>{{ copy.textFit.resizeObserver }}</h2>
          </div>
          <span class="code-chip">JS</span>
        </header>
        <div class="fit-stage">
          <div
            ref="jsHeading"
            class="fit-heading js-fit-heading"
            :style="{ width: `${width}px` }"
          >{{ text || ' ' }}</div>
        </div>
        <dl class="metric-grid">
          <div><dt>{{ copy.textFit.resizeCallbacks }}</dt><dd>{{ resizeCallbacks }}</dd></div>
          <div><dt>{{ copy.textFit.calculations }}</dt><dd>{{ calculations }}</dd></div>
          <div><dt>{{ copy.textFit.currentSize }}</dt><dd>{{ currentFontSize.toFixed(2) }}px</dd></div>
        </dl>
      </article>

      <article class="comparison-card native-comparison">
        <header>
          <div>
            <span class="comparison-label">{{ copy.textFit.nativeTitle }}</span>
            <h2>{{ copy.textFit.nativeMethod }}</h2>
          </div>
          <span class="code-chip">CSS</span>
        </header>
        <div class="fit-stage">
          <div class="fit-heading native-fit-heading" :style="{ width: `${width}px` }">
            {{ text || ' ' }}
          </div>
        </div>
        <dl class="metric-grid">
          <div><dt>{{ copy.textFit.jsCalculations }}</dt><dd>0</dd></div>
          <div><dt>{{ copy.textFit.baseSize }}</dt><dd>64px</dd></div>
          <div><dt>CSS.supports()</dt><dd>{{ textFitSupported ? 'true' : 'false' }}</dd></div>
        </dl>
        <p class="technical-note">{{ copy.textFit.usedSizeNote }}</p>
        <code class="declaration">text-fit: {{ TEXT_FIT_DECLARATION }};</code>
      </article>
    </section>
  </main>
</template>
