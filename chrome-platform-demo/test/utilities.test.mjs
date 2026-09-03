import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPerformanceSupport,
  supportsMediaLazy,
  supportsTextFit,
  TEXT_FIT_DECLARATION,
} from '../src/browserSupport.js'
import { SPA_VIEWS, getSpaView } from '../src/config.js'
import { messages } from '../src/i18n.js'
import { parseMediaMode } from '../src/utils/mediaMode.js'
import { normalizePerformanceEntry } from '../src/utils/performanceEntries.js'
import {
  createNavigationRun,
  reconcileNavigationRuns,
  withCancelledStatus,
  withContentReady,
  withRouteStart,
} from '../src/utils/navigationMetrics.js'

function leafPaths(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) return leafPaths(child, path)
    return path
  }).sort()
}

test('media mode parser defaults invalid values to lazy', () => {
  assert.equal(parseMediaMode('eager'), 'eager')
  assert.equal(parseMediaMode('lazy'), 'lazy')
  assert.equal(parseMediaMode('invalid'), 'lazy')
  assert.equal(parseMediaMode(undefined), 'lazy')
})

test('browser support detection uses the exact APIs under test', () => {
  const calls = []
  const css = { supports: (...args) => calls.push(args) === 1 }
  assert.equal(supportsTextFit(css), true)
  assert.deepEqual(calls[0], ['text-fit', TEXT_FIT_DECLARATION])

  assert.equal(supportsMediaLazy({ createElement: () => ({ loading: 'lazy' }) }), true)
  assert.equal(supportsMediaLazy({ createElement: () => ({}) }), false)

  assert.deepEqual(
    getPerformanceSupport({ supportedEntryTypes: ['soft-navigation', 'resource'] }),
    { softNavigation: true, interactionContentfulPaint: false },
  )
})

test('SPA route metadata preserves the required delay mapping', () => {
  assert.deepEqual(SPA_VIEWS.map(({ id, delay }) => [id, delay]), [
    ['dashboard', 150],
    ['contacts', 800],
    ['reports', 1400],
  ])
  assert.equal(getSpaView('contacts').path, '/spa-performance/contacts')
})

test('performance entries are normalized without serializing DOM nodes', () => {
  const entry = {
    entryType: 'interaction-contentful-paint',
    name: 'interaction-contentful-paint',
    startTime: 125.5,
    duration: 8.25,
    interactionId: 42,
    navigationId: 'nav-1',
    largestContentfulPaint: {
      startTime: 130,
      size: 9000,
      element: { tagName: 'ARTICLE', secret: 'not serialized' },
    },
  }
  const normalized = normalizePerformanceEntry(entry)

  assert.equal(normalized.source, 'browser')
  assert.equal(normalized.interactionId, 42)
  assert.equal(normalized.detail.largestContentfulPaint.element, 'article')
  assert.equal('secret' in normalized.detail.largestContentfulPaint, false)
})

test('soft navigation extracts the nested largest paint from its getter', () => {
  const normalized = normalizePerformanceEntry({
    entryType: 'soft-navigation',
    name: 'https://demo.local/spa-performance/reports',
    startTime: 200,
    getLargestInteractionContentfulPaint: () => ({
      startTime: 1_500,
      largestContentfulPaint: { startTime: 1_520, size: 24_000 },
    }),
  })

  assert.equal(normalized.detail.largestContentfulPaint.startTime, 1_520)
  assert.equal(normalized.detail.largestContentfulPaint.size, 24_000)
})

test('Traditional Chinese and English copy have identical leaf keys', () => {
  assert.deepEqual(leafPaths(messages['zh-TW']), leafPaths(messages.en))
})

function createRun(overrides = {}) {
  return createNavigationRun({
    id: 'run-1',
    transitionId: 'transition-1',
    view: 'contacts',
    targetPath: '/spa-performance/contacts',
    configuredDelay: 800,
    clickTime: 100,
    ...overrides,
  })
}

function createBrowserEntries() {
  return [
    {
      source: 'browser',
      entryType: 'soft-navigation',
      name: 'http://localhost:5173/spa-performance/contacts',
      startTime: 98,
      duration: 0,
      interactionId: 42,
      navigationId: 'soft-nav-1',
      detail: {
        paintTime: 914,
        presentationTime: 918,
      },
    },
    {
      source: 'browser',
      entryType: 'interaction-contentful-paint',
      name: 'interaction-contentful-paint',
      startTime: 920,
      duration: 0,
      interactionId: 42,
      navigationId: 'a-different-navigation-id',
      detail: {
        largestContentfulPaint: { startTime: 924, size: 12_000 },
      },
    },
  ]
}

test('navigation run calculates app duration from click to content ready', () => {
  const waiting = withRouteStart(createRun(), 104)
  const complete = withContentReady(waiting, 912)

  assert.equal(complete.status, 'content-rendered')
  assert.equal(complete.app.routeStartTime, 104)
  assert.equal(complete.app.duration, 812)
})

test('browser metrics match soft navigation by URL and ICP by interactionId', () => {
  const complete = withContentReady(withRouteStart(createRun(), 104), 912)
  const [result] = reconcileNavigationRuns([complete], createBrowserEntries())

  assert.equal(result.status, 'browser-received')
  assert.equal(result.browser.detected, true)
  assert.equal(result.browser.interactionId, 42)
  assert.equal(result.browser.navigationId, 'soft-nav-1')
  assert.equal(result.browser.fcp, 820)
  assert.equal(result.browser.lcp, 826)
})

test('browser entries can arrive before or after content ready', () => {
  const waiting = withRouteStart(createRun(), 104)
  const [browserFirst] = reconcileNavigationRuns([waiting], createBrowserEntries())
  const browserFirstComplete = withContentReady(browserFirst, 912)

  const appFirstComplete = withContentReady(waiting, 912)
  const [appFirst] = reconcileNavigationRuns([appFirstComplete], createBrowserEntries())

  assert.deepEqual(browserFirstComplete.browser, appFirst.browser)
  assert.equal(browserFirstComplete.status, 'browser-received')
  assert.equal(appFirst.status, 'browser-received')
})

test('missing browser paint fields remain null instead of inventing metrics', () => {
  const complete = withContentReady(createRun(), 912)
  const entries = [{
    source: 'browser',
    entryType: 'soft-navigation',
    name: '/spa-performance/contacts',
    startTime: 99,
    interactionId: 7,
    navigationId: 'soft-nav-no-paint',
    detail: {},
  }]
  const [result] = reconcileNavigationRuns([complete], entries)

  assert.equal(result.browser.detected, true)
  assert.equal(result.browser.fcp, null)
  assert.equal(result.browser.lcp, null)
})

test('consecutive runs do not reuse a later browser entry', () => {
  const first = withContentReady(createRun(), 500)
  const second = withContentReady(createRun({
    id: 'run-2',
    transitionId: 'transition-2',
    clickTime: 1_000,
  }), 1_820)
  const entries = createBrowserEntries().map((entry) => ({
    ...entry,
    startTime: entry.entryType === 'soft-navigation' ? 1_001 : 1_825,
    detail: entry.entryType === 'soft-navigation'
      ? { presentationTime: 1_820 }
      : { largestContentfulPaint: { startTime: 1_830 } },
  }))
  const [firstResult, secondResult] = reconcileNavigationRuns([first, second], entries)

  assert.equal(firstResult.browser.detected, false)
  assert.equal(secondResult.browser.detected, true)
})

test('cancelled navigation remains cancelled during reconciliation', () => {
  const cancelled = withCancelledStatus(createRun())
  const [result] = reconcileNavigationRuns([cancelled], createBrowserEntries())

  assert.equal(result.status, 'cancelled')
  assert.equal(result.browser.detected, false)
})
