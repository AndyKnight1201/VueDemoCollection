<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { getBrowserSupport } from '../browserSupport.js'
import { useLocale } from '../i18n.js'

const { copy } = useLocale()
const support = getBrowserSupport()

const cards = computed(() => [
  {
    id: 'media',
    href: '/media-lazy?mode=lazy',
    copy: copy.value.home.media,
    supported: support.mediaLazy,
    accent: 'cyan',
    icon: '◌',
  },
  {
    id: 'text-fit',
    href: '/text-fit',
    copy: copy.value.home.textFit,
    supported: support.textFit,
    accent: 'violet',
    icon: 'Aa',
  },
  {
    id: 'spa',
    href: '/spa-performance/dashboard',
    copy: copy.value.home.spa,
    supported: support.spaPerformance,
    accent: 'lime',
    icon: '↗',
  },
])
</script>

<template>
  <main class="page home-page">
    <section class="hero">
      <p class="eyebrow">{{ copy.home.kicker }}</p>
      <h1>{{ copy.home.heading }}</h1>
      <p>{{ copy.home.intro }}</p>
    </section>

    <section class="demo-card-grid" aria-label="Chrome Web Platform demos">
      <RouterLink
        v-for="card in cards"
        :key="card.id"
        class="demo-card"
        :class="`accent-${card.accent}`"
        :to="card.href"
      >
        <div class="demo-card-topline">
          <span class="version-pill">{{ card.copy.version }}</span>
          <span class="demo-icon" aria-hidden="true">{{ card.icon }}</span>
        </div>
        <h2>{{ card.copy.title }}</h2>
        <p>{{ card.copy.body }}</p>
        <div class="support-row">
          <span>{{ copy.common.supported }}</span>
          <strong :class="card.supported ? 'supported' : 'unsupported'">
            <span class="status-dot"></span>
            {{ card.supported ? copy.common.yes : copy.common.no }}
          </strong>
        </div>
        <span class="open-link">{{ copy.home.open }} <span aria-hidden="true">→</span></span>
      </RouterLink>
    </section>

    <p v-if="!support.spaPerformance" class="home-note">
      {{ copy.home.partialSupport }}:
      soft-navigation {{ support.softNavigation ? '✓' : '×' }} ·
      interaction-contentful-paint {{ support.interactionContentfulPaint ? '✓' : '×' }}
    </p>
  </main>
</template>
