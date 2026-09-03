const SAFE_SCALAR_FIELDS = [
  'entryType',
  'name',
  'startTime',
  'duration',
  'interactionId',
  'navigationId',
  'paintTime',
  'presentationTime',
  'size',
  'url',
  'id',
  'renderTime',
  'loadTime',
]

function pickScalars(entry) {
  const detail = {}
  for (const field of SAFE_SCALAR_FIELDS) {
    const value = entry?.[field]
    if (['string', 'number', 'boolean'].includes(typeof value)) detail[field] = value
  }
  return detail
}

function getLargestPaint(entry) {
  if (entry?.largestContentfulPaint) return entry.largestContentfulPaint
  if (typeof entry?.getLargestInteractionContentfulPaint !== 'function') return null
  try {
    const interactionPaint = entry.getLargestInteractionContentfulPaint()
    return interactionPaint?.largestContentfulPaint ?? interactionPaint
  } catch {
    return null
  }
}

export function normalizePerformanceEntry(entry, source = 'browser') {
  const startTime = Number(entry?.startTime) || 0
  const largestPaint = getLargestPaint(entry)
  const detail = pickScalars(entry)

  if (largestPaint) {
    detail.largestContentfulPaint = pickScalars(largestPaint)
    const tagName = largestPaint.element?.tagName
    if (typeof tagName === 'string') detail.largestContentfulPaint.element = tagName.toLowerCase()
  }
  if (entry?.detail !== undefined && source === 'app') detail.markDetail = entry.detail

  return {
    id: '',
    source,
    entryType: String(entry?.entryType ?? (source === 'app' ? 'mark' : 'unknown')),
    name: String(entry?.name ?? 'unnamed'),
    startTime,
    duration: Number(entry?.duration) || 0,
    wallTime: new Date((globalThis.performance?.timeOrigin ?? Date.now()) + startTime).toISOString(),
    ...(typeof entry?.interactionId === 'number' ? { interactionId: entry.interactionId } : {}),
    ...(typeof entry?.navigationId === 'string' ? { navigationId: entry.navigationId } : {}),
    detail,
  }
}
