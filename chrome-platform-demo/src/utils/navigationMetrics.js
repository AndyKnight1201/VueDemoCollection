const MATCH_EARLY_TOLERANCE_MS = 250
const MATCH_LATE_TOLERANCE_MS = 5_000

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function metricAfterStart(value, startTime) {
  const time = finiteNumber(value)
  return time !== null && time >= startTime ? time - startTime : null
}

function pathname(value) {
  try {
    return new URL(value, 'https://demo.local').pathname
  } catch {
    return ''
  }
}

function largestPaintStart(entry) {
  return finiteNumber(entry?.detail?.largestContentfulPaint?.startTime)
}

export function createNavigationRun({
  id,
  transitionId,
  view,
  targetPath,
  configuredDelay,
  clickTime,
}) {
  return {
    id,
    transitionId,
    view,
    targetPath,
    configuredDelay,
    status: 'click-captured',
    app: {
      clickTime,
      routeStartTime: null,
      contentReadyTime: null,
      duration: null,
    },
    browser: {
      detected: false,
      interactionId: null,
      navigationId: null,
      fcp: null,
      lcp: null,
    },
  }
}

export function withRouteStart(run, routeStartTime) {
  return {
    ...run,
    status: 'waiting',
    app: { ...run.app, routeStartTime },
  }
}

export function withContentReady(run, contentReadyTime) {
  return {
    ...run,
    status: run.browser.detected ? 'browser-received' : 'content-rendered',
    app: {
      ...run.app,
      contentReadyTime,
      duration: Math.max(0, contentReadyTime - run.app.clickTime),
    },
  }
}

export function withCancelledStatus(run) {
  return { ...run, status: 'cancelled' }
}

export function reconcileNavigationRuns(runs, entries) {
  const browserEntries = entries.filter((entry) => entry.source === 'browser')
  const softEntries = browserEntries.filter((entry) => entry.entryType === 'soft-navigation')
  const icpEntries = browserEntries.filter(
    (entry) => entry.entryType === 'interaction-contentful-paint',
  )

  return runs.map((run, index) => {
    if (run.status === 'cancelled') return run
    const nextClickTime = runs[index + 1]?.app.clickTime ?? Number.POSITIVE_INFINITY
    const matchStart = run.app.clickTime - MATCH_EARLY_TOLERANCE_MS
    const naturalEnd = run.app.contentReadyTime === null
      ? run.app.clickTime + MATCH_LATE_TOLERANCE_MS
      : run.app.contentReadyTime + MATCH_LATE_TOLERANCE_MS
    const matchEnd = Math.min(nextClickTime, naturalEnd)

    const softNavigation = softEntries
      .filter((entry) => (
        pathname(entry.name) === run.targetPath
        && entry.startTime >= matchStart
        && entry.startTime < matchEnd
      ))
      .sort(
        (left, right) => Math.abs(left.startTime - run.app.clickTime)
          - Math.abs(right.startTime - run.app.clickTime),
      )[0]

    if (!softNavigation) {
      return {
        ...run,
        browser: {
          detected: false,
          interactionId: null,
          navigationId: null,
          fcp: null,
          lcp: null,
        },
        status: run.app.contentReadyTime === null ? run.status : 'content-rendered',
      }
    }

    const interactionId = finiteNumber(softNavigation.interactionId)
    const relatedIcpEntries = interactionId === null
      ? []
      : icpEntries.filter((entry) => finiteNumber(entry.interactionId) === interactionId)
    const largestPaintTimes = [
      largestPaintStart(softNavigation),
      ...relatedIcpEntries.map(largestPaintStart),
    ].filter((value) => value !== null)
    const latestLargestPaint = largestPaintTimes.length ? Math.max(...largestPaintTimes) : null
    const presentationTime = finiteNumber(softNavigation.detail?.presentationTime)
      ?? finiteNumber(softNavigation.detail?.paintTime)

    return {
      ...run,
      status: run.app.contentReadyTime === null ? run.status : 'browser-received',
      browser: {
        detected: true,
        interactionId,
        navigationId: softNavigation.navigationId ?? null,
        fcp: metricAfterStart(presentationTime, softNavigation.startTime),
        lcp: metricAfterStart(latestLargestPaint, softNavigation.startTime),
      },
    }
  })
}
