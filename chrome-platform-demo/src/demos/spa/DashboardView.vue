<script setup>
import { computed } from 'vue'
import { useLocale } from '../../i18n.js'

const { copy } = useLocale()
const metrics = computed(() => [
  { label: copy.value.spa.dashboardView.metrics[0], value: '48,291', trend: '+12.8%' },
  { label: copy.value.spa.dashboardView.metrics[1], value: '6,840', trend: '+5.4%' },
  { label: copy.value.spa.dashboardView.metrics[2], value: '99.98%', trend: '+0.02%' },
])
</script>

<template>
  <article class="mock-view dashboard-view">
    <header>
      <div>
        <span class="view-kicker">DASHBOARD</span>
        <h2>{{ copy.spa.dashboardView.title }}</h2>
        <p>{{ copy.spa.dashboardView.subtitle }}</p>
      </div>
      <span class="live-pill"><i></i> LIVE</span>
    </header>
    <section class="mock-metrics">
      <article v-for="metric in metrics" :key="metric.label">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.trend }}</small>
      </article>
    </section>
    <section class="activity-chart" aria-label="Mock activity chart">
      <div v-for="height in [24, 38, 31, 54, 45, 68, 58, 79, 66, 88, 72, 94]" :key="height" :style="{ height: `${height}%` }"></div>
    </section>
  </article>
</template>
