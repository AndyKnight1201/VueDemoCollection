export const TEXT_FIT_DECLARATION = 'shrink per-line-all 12.5%'

export function supportsTextFit(css = globalThis.CSS) {
  return Boolean(css?.supports?.('text-fit', TEXT_FIT_DECLARATION))
}

export function supportsMediaLazy(documentRef = globalThis.document) {
  return Boolean(documentRef?.createElement && 'loading' in documentRef.createElement('audio'))
}

export function getPerformanceSupport(Observer = globalThis.PerformanceObserver) {
  const types = Observer?.supportedEntryTypes ?? []
  return {
    softNavigation: types.includes('soft-navigation'),
    interactionContentfulPaint: types.includes('interaction-contentful-paint'),
  }
}

export function getBrowserSupport() {
  const performance = getPerformanceSupport()
  return {
    textFit: supportsTextFit(),
    mediaLazy: supportsMediaLazy(),
    ...performance,
    spaPerformance: performance.softNavigation && performance.interactionContentfulPaint,
  }
}
