<script setup>
import { useLocale } from '../../i18n.js'

const { copy } = useLocale()
const contacts = [
  { name: '王小明', role: 'Frontend Engineer', department: 'Product R&D', status: 'online', initials: '王' },
  { name: '陳雅婷', role: 'Product Designer', department: 'Design', status: 'online', initials: '陳' },
  { name: '林志豪', role: 'SRE Lead', department: 'Cloud Platform', status: 'away', initials: '林' },
  { name: '黃子庭', role: 'Data Analyst', department: 'Business Intelligence', status: 'online', initials: '黃' },
  { name: '李冠廷', role: 'Product Manager', department: 'Enterprise Apps', status: 'busy', initials: '李' },
]
</script>

<template>
  <article class="mock-view contacts-view">
    <header>
      <div>
        <span class="view-kicker">CONTACTS</span>
        <h2>{{ copy.spa.contactsView.title }}</h2>
        <p>{{ copy.spa.contactsView.subtitle }}</p>
      </div>
      <span class="result-count">20 people</span>
    </header>
    <div class="contact-search" aria-hidden="true">⌕ <span>Search people, team, or role…</span></div>
    <ul class="mock-contact-list">
      <li v-for="contact in contacts" :key="contact.name">
        <span class="avatar">{{ contact.initials }}</span>
        <div><strong>{{ contact.name }}</strong><small>{{ contact.role }} · {{ contact.department }}</small></div>
        <i :class="`presence-${contact.status}`"></i>
      </li>
    </ul>
  </article>
</template>
