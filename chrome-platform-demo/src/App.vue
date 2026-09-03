<script setup>
import { computed, provide, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { getInitialLocale, localeKey, LOCALE_STORAGE_KEY, messages } from './i18n.js'

const route = useRoute()
const locale = ref(getInitialLocale())
const copy = computed(() => messages[locale.value])

function toggleLocale() {
  locale.value = locale.value === 'zh-TW' ? 'en' : 'zh-TW'
}

watch(locale, (value) => {
  document.documentElement.lang = value === 'zh-TW' ? 'zh-Hant' : 'en'
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, value)
  } catch {
    // The demo remains usable if storage is blocked.
  }
}, { immediate: true })

provide(localeKey, { locale, copy, toggleLocale })
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="brand" to="/" aria-label="Chrome Web Platform Demos home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>
          <small>{{ copy.app.eyebrow }}</small>
          <strong>{{ copy.app.title }}</strong>
        </span>
      </RouterLink>
      <div class="header-actions">
        <RouterLink v-if="route.path !== '/'" class="back-link" to="/">
          <span aria-hidden="true">←</span> {{ copy.app.back }}
        </RouterLink>
        <button class="language-button" type="button" @click="toggleLocale">
          {{ locale === 'zh-TW' ? 'EN' : '繁中' }}
          <span class="sr-only">{{ copy.app.switchLanguage }}</span>
        </button>
      </div>
    </header>

    <RouterView />

    <footer class="app-footer">{{ copy.app.footer }}</footer>
  </div>
</template>
