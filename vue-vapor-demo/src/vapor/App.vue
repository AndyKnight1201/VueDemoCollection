<script setup vapor>
import { useRenderer } from '../shared/useRenderer.js'

const renderer = 'vapor'
const { errorMessage, progressLabel, rowCount, rows, status } = useRenderer(renderer)
</script>

<template>
  <main class="renderer-shell" :data-renderer="renderer">
    <header class="renderer-header">
      <div>
        <span class="renderer-kicker">Renderer</span>
        <h1>Vapor</h1>
      </div>
      <div class="renderer-meta">
        <span class="row-count">{{ rowCount.toLocaleString() }} rows</span>
        <span class="renderer-status" :class="{ running: status === 'Running' }">
          {{ progressLabel }}
        </span>
      </div>
    </header>

    <p v-if="errorMessage" class="renderer-error">{{ errorMessage }}</p>

    <section class="row-list" aria-label="Vapor benchmark rows">
      <div v-for="row in rows" :key="row.id" class="data-row" :class="{ inactive: !row.active }">
        <span class="cell id-cell">#{{ String(row.id).padStart(5, '0') }}</span>
        <span class="cell name-cell">{{ row.name }}</span>
        <span class="cell department-cell">{{ row.department }}</span>
        <span class="cell unread-cell">Unread {{ row.unread }}</span>
        <span class="cell score-cell">Score {{ row.score }}</span>
        <span class="cell active-cell">{{ row.active ? 'Active' : 'Inactive' }}</span>
      </div>
    </section>
  </main>
</template>
