<script setup>
import { useLocale } from '../../i18n.js'

const { copy } = useLocale()
const departments = [
  { name: 'Product R&D', value: 92 },
  { name: 'Operations', value: 76 },
  { name: 'Sales', value: 64 },
  { name: 'Customer Success', value: 84 },
  { name: 'Finance', value: 58 },
]
</script>

<template>
  <article class="mock-view reports-view">
    <header>
      <div>
        <span class="view-kicker">REPORTS</span>
        <h2>{{ copy.spa.reportsView.title }}</h2>
        <p>{{ copy.spa.reportsView.subtitle }}</p>
      </div>
      <span class="quarter-pill">2026 Q3</span>
    </header>
    <section class="report-summary">
      <article><span>Adoption</span><strong>78.4%</strong><small>+8.2% QoQ</small></article>
      <article><span>Weekly active</span><strong>5,932</strong><small>86.7% of seats</small></article>
    </section>
    <section class="department-bars">
      <div v-for="department in departments" :key="department.name">
        <span>{{ department.name }}</span>
        <div><i :style="{ width: `${department.value}%` }"></i></div>
        <strong>{{ department.value }}%</strong>
      </div>
    </section>
  </article>
</template>
