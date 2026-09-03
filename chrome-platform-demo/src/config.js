export const SPA_VIEWS = Object.freeze([
  {
    id: 'dashboard',
    name: 'spa-dashboard',
    path: '/spa-performance/dashboard',
    shortPath: '/dashboard',
    delay: 150,
  },
  {
    id: 'contacts',
    name: 'spa-contacts',
    path: '/spa-performance/contacts',
    shortPath: '/contacts',
    delay: 800,
  },
  {
    id: 'reports',
    name: 'spa-reports',
    path: '/spa-performance/reports',
    shortPath: '/reports',
    delay: 1400,
  },
])

export function getSpaView(id) {
  return SPA_VIEWS.find((view) => view.id === id)
}
