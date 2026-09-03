import { createRouter, createWebHistory } from 'vue-router'
import { SPA_VIEWS } from './config.js'
import { markNavigationRouteStart } from './services/performanceTimeline.js'
import HomeDemo from './demos/HomeDemo.vue'
import MediaLazyLoadingDemo from './demos/MediaLazyLoadingDemo.vue'
import SpaPerformanceDemo from './demos/SpaPerformanceDemo.vue'
import TextFitDemo from './demos/TextFitDemo.vue'
import ContactsView from './demos/spa/ContactsView.vue'
import DashboardView from './demos/spa/DashboardView.vue'
import ReportsView from './demos/spa/ReportsView.vue'

const componentByView = {
  dashboard: DashboardView,
  contacts: ContactsView,
  reports: ReportsView,
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.path.startsWith('/spa-performance') && from.path.startsWith('/spa-performance')) return false
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: HomeDemo },
    { path: '/text-fit', name: 'text-fit', component: TextFitDemo },
    { path: '/media-lazy', name: 'media-lazy', component: MediaLazyLoadingDemo },
    {
      path: '/spa-performance',
      component: SpaPerformanceDemo,
      children: [
        { path: '', redirect: { name: 'spa-dashboard' } },
        ...SPA_VIEWS.map((view) => ({
          path: view.id,
          name: view.name,
          component: componentByView[view.id],
          meta: { spaView: view.id, delay: view.delay },
        })),
      ],
    },
    ...SPA_VIEWS.map((view) => ({
      path: view.shortPath,
      redirect: view.path,
    })),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

router.beforeResolve(async (to, from) => {
  if (!to.meta.spaView || !from.meta.spaView || to.name === from.name) return true

  markNavigationRouteStart(to.path)
  await delay(to.meta.delay)
  return true
})

export default router
