import { ref } from 'vue'
import { getPerformanceSupport } from '../browserSupport.js'
import { normalizePerformanceEntry } from '../utils/performanceEntries.js'
import {
  createNavigationRun,
  reconcileNavigationRuns,
  withCancelledStatus,
  withContentReady,
  withRouteStart,
} from '../utils/navigationMetrics.js'

export const performanceTimeline = ref([])
export const navigationRuns = ref([])

let sequence = 0
let observersStarted = false
let activeTransitionId = null
const seenBrowserEntries = new Set()
const observers = []

function createId(prefix) {
  sequence += 1
  return `${prefix}-${Date.now()}-${sequence}`
}

function browserEntryKey(entry) {
  return [
    entry.entryType,
    entry.name,
    entry.startTime,
    entry.duration,
    entry.interactionId ?? '',
    entry.navigationId ?? '',
  ].join('|')
}

function appendBrowserEntry(entry) {
  const key = browserEntryKey(entry)
  if (seenBrowserEntries.has(key)) return
  seenBrowserEntries.add(key)
  const normalized = normalizePerformanceEntry(entry, 'browser')
  normalized.id = createId('browser')
  performanceTimeline.value.push(normalized)
  navigationRuns.value = reconcileNavigationRuns(navigationRuns.value, performanceTimeline.value)
}

export function recordAppMark(name, detail = {}) {
  if (!globalThis.performance?.mark) return null
  const markName = `demo:${name}`
  let entry
  try {
    entry = performance.mark(markName, { detail })
  } catch {
    performance.mark(markName)
    entry = performance.getEntriesByName(markName, 'mark').at(-1)
  }
  if (!entry) return null
  const normalized = normalizePerformanceEntry(entry, 'app')
  normalized.id = createId('app')
  performanceTimeline.value.push(normalized)
  return normalized
}

function replaceRun(transitionId, update) {
  navigationRuns.value = navigationRuns.value.map((run) => (
    run.transitionId === transitionId ? update(run) : run
  ))
  navigationRuns.value = reconcileNavigationRuns(navigationRuns.value, performanceTimeline.value)
}

export function beginNavigationRun(view, fromPath) {
  const transitionId = `transition-${createId('navigation')}`
  const mark = recordAppMark(`click-${view.id}`, {
    transitionId,
    from: fromPath,
    to: view.path,
    delay: view.delay,
  })
  if (!mark) return null

  navigationRuns.value.push(createNavigationRun({
    id: createId('run'),
    transitionId,
    view: view.id,
    targetPath: view.path,
    configuredDelay: view.delay,
    clickTime: mark.startTime,
  }))
  activeTransitionId = transitionId
  return transitionId
}

export function markNavigationRouteStart(targetPath) {
  if (!activeTransitionId) return null
  const run = navigationRuns.value.find((entry) => entry.transitionId === activeTransitionId)
  if (!run || run.targetPath !== targetPath) return null
  const mark = recordAppMark('route-start', {
    transitionId: activeTransitionId,
    to: targetPath,
    delay: run.configuredDelay,
  })
  if (mark) replaceRun(activeTransitionId, (entry) => withRouteStart(entry, mark.startTime))
  return activeTransitionId
}

export function completeNavigationRun(targetPath) {
  if (!activeTransitionId) return null
  const transitionId = activeTransitionId
  const run = navigationRuns.value.find((entry) => entry.transitionId === transitionId)
  if (!run || run.targetPath !== targetPath) return null
  const mark = recordAppMark('route-content-ready', {
    transitionId,
    route: targetPath,
    view: run.view,
  })
  if (mark) replaceRun(transitionId, (entry) => withContentReady(entry, mark.startTime))
  activeTransitionId = null
  return transitionId
}

export function cancelNavigationRun(transitionId) {
  if (!transitionId) return
  replaceRun(transitionId, withCancelledStatus)
  if (activeTransitionId === transitionId) activeTransitionId = null
}

export function startPerformanceObservers(Observer = globalThis.PerformanceObserver) {
  const support = getPerformanceSupport(Observer)
  if (observersStarted || !Observer) return support

  for (const [type, enabled] of [
    ['soft-navigation', support.softNavigation],
    ['interaction-contentful-paint', support.interactionContentfulPaint],
  ]) {
    if (!enabled) continue
    try {
      const observer = new Observer((list) => {
        for (const entry of list.getEntries()) appendBrowserEntry(entry)
      })
      observer.observe({ type, buffered: true })
      observers.push(observer)
    } catch (error) {
      console.warn(`Unable to observe ${type}`, error)
    }
  }

  observersStarted = true
  return support
}

export function clearPerformanceTimeline() {
  performanceTimeline.value = []
  navigationRuns.value = []
  activeTransitionId = null
  if (!globalThis.performance?.getEntriesByType) return
  for (const mark of performance.getEntriesByType('mark')) {
    if (mark.name.startsWith('demo:')) performance.clearMarks(mark.name)
  }
}
