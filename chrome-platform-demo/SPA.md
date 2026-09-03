對，完整流程應該明確分成：支援檢查 → 註冊 → 使用者觸發 → Chrome 判定 → 取得結果 → 計算 → 顯示。

## 完整流程

```text
SpaPerformanceDemo 掛載
    ↓
startPerformanceObservers()
    ↓
註冊 soft-navigation / interaction-contentful-paint
    ↓
使用者點擊 Contacts
    ↓
navigate() → router.push()
    ↓
URL 更新 + RouterView 繪製新內容
    ↓
Chrome 判定為 soft navigation
    ↓
PerformanceObserver callback 被 Chrome 呼叫
    ↓
list.getEntries() 取得瀏覽器結果
    ↓
appendBrowserEntry()
    ↓
normalizePerformanceEntry()
    ↓
reconcileNavigationRuns()
    ↓
計算 Browser FCP / LCP
    ↓
寫入 navigationRuns
    ↓
Vue 更新 Last Navigation 和歷史表格
```

# 1. 檢查瀏覽器是否支援

函式位置：[browserSupport.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/browserSupport.js:11)

```js
export function getPerformanceSupport(
  Observer = globalThis.PerformanceObserver,
) {
  const types = Observer?.supportedEntryTypes ?? []

  return {
    softNavigation:
      types.includes('soft-navigation'),

    interactionContentfulPaint:
      types.includes('interaction-contentful-paint'),
  }
}
```

這裡確認 Chrome 是否支援：

```js
PerformanceObserver.supportedEntryTypes
```

預期包含：

```text
soft-navigation
interaction-contentful-paint
```

# 2. 啟動註冊

元件掛載時啟動，位置：[SpaPerformanceDemo.vue](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:109)

```js
onMounted(() => startPerformanceObservers())
```

進入 SPA Demo 頁面後就會執行。

# 3. 註冊 `PerformanceObserver`

函式位置：[performanceTimeline.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/services/performanceTimeline.js:127)

```js
export function startPerformanceObservers(
  Observer = globalThis.PerformanceObserver,
) {
  const support = getPerformanceSupport(Observer)

  for (const [type, enabled] of [
    ['soft-navigation', support.softNavigation],
    [
      'interaction-contentful-paint',
      support.interactionContentfulPaint,
    ],
  ]) {
    if (!enabled) continue

    const observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        appendBrowserEntry(entry)
      }
    })

    observer.observe({
      type,
      buffered: true,
    })

    observers.push(observer)
  }
}
```

實際註冊 `soft-navigation` 的核心是：

```js
observer.observe({
  type: 'soft-navigation',
  buffered: true,
})
```

實際註冊 `interaction-contentful-paint` 的核心是：

```js
observer.observe({
  type: 'interaction-contentful-paint',
  buffered: true,
})
```

# 4. 使用者觸發 SPA 換頁

按鈕位置：[SpaPerformanceDemo.vue](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:155)

```vue
<button
  v-for="view in views"
  @click="navigate(view)"
>
  {{ view.label }}
</button>
```

點擊後執行 `navigate()`，位置：[SpaPerformanceDemo.vue](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:50)

```js
async function navigate(view) {
  if (route.name === view.name || navigating.value) return

  navigating.value = true

  const transitionId =
    beginNavigationRun(view, route.fullPath)

  try {
    const failure = await router.push({
      name: view.name,
    })

    if (failure) {
      cancelNavigationRun(transitionId)
    }
  } finally {
    navigating.value = false
  }
}
```

真正造成 SPA 換頁的是：

```js
router.push({
  name: view.name,
})
```

# 5. Router 模擬等待

Router guard 位置：[router.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/router.js:54)

```js
router.beforeResolve(async (to, from) => {
  if (
    !to.meta.spaView ||
    !from.meta.spaView ||
    to.name === from.name
  ) {
    return true
  }

  markNavigationRouteStart(to.path)

  await delay(to.meta.delay)

  return true
})
```

延遲設定為：

```text
Dashboard：150ms
Contacts：800ms
Reports：1400ms
```

延遲完成後，Vue Router 才會：

- 更新瀏覽器 URL。
- 切換 `<RouterView>`。
- 將新頁面內容渲染到 DOM。

# 6. Chrome 在哪裡被「觸發」？

程式裡沒有這種函式：

```js
triggerSoftNavigation()
```

`soft-navigation` 是 Chrome 自己判定並觸發。

Demo 提供給 Chrome 的三個條件是：

### 使用者操作

```vue
@click="navigate(view)"
```

### URL 更新

```js
router.push({
  name: view.name,
})
```

### 可見內容繪製

位置：[SpaPerformanceDemo.vue](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:169)

```vue
<div class="route-content">
  <RouterView />
</div>
```

當新的 Dashboard、Contacts 或 Reports 元件被畫出來，Chrome 才有機會判定：

```text
這次使用者操作是一個 soft navigation
```

判定完成後，Chrome 會呼叫先前註冊的 `PerformanceObserver` callback。

# 7. 取得 Chrome 結果

取得結果的位置：[performanceTimeline.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/services/performanceTimeline.js:137)

```js
const observer = new Observer((list) => {
  for (const entry of list.getEntries()) {
    appendBrowserEntry(entry)
  }
})
```

最重要的是：

```js
list.getEntries()
```

這裡取得 Chrome 原生產生的物件。

可能收到：

```js
entry.entryType === 'soft-navigation'
```

或：

```js
entry.entryType ===
  'interaction-contentful-paint'
```

`entry` 不是 Demo 建立的，也沒有使用 `performance.mark()` 偽造。

# 8. 保存 Chrome 結果

函式位置：[performanceTimeline.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/services/performanceTimeline.js:37)

```js
function appendBrowserEntry(entry) {
  const key = browserEntryKey(entry)

  if (seenBrowserEntries.has(key)) return

  seenBrowserEntries.add(key)

  const normalized =
    normalizePerformanceEntry(entry, 'browser')

  normalized.id = createId('browser')

  performanceTimeline.value.push(normalized)

  navigationRuns.value =
    reconcileNavigationRuns(
      navigationRuns.value,
      performanceTimeline.value,
    )
}
```

原始 Chrome entry 先經過：

```js
normalizePerformanceEntry(entry, 'browser')
```

然後放進：

```js
performanceTimeline.value
```

最後重新計算：

```js
reconcileNavigationRuns()
```

# 9. 整理 Chrome 原始物件

函式位置：[performanceEntries.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/performanceEntries.js:37)

```js
export function normalizePerformanceEntry(
  entry,
  source = 'browser',
) {
  const startTime = Number(entry?.startTime) || 0
  const largestPaint = getLargestPaint(entry)
  const detail = pickScalars(entry)

  if (largestPaint) {
    detail.largestContentfulPaint =
      pickScalars(largestPaint)
  }

  return {
    source,
    entryType: entry.entryType,
    name: entry.name,
    startTime,
    duration: Number(entry.duration) || 0,
    interactionId: entry.interactionId,
    navigationId: entry.navigationId,
    detail,
  }
}
```

這裡從 Chrome entry 取出：

```text
entryType
name
startTime
duration
interactionId
navigationId
paintTime
presentationTime
largestContentfulPaint
```

# 10. 配對 `soft-navigation`

計算函式位置：[navigationMetrics.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/navigationMetrics.js:81)

```js
export function reconcileNavigationRuns(
  runs,
  entries,
) {
  const browserEntries = entries.filter(
    entry => entry.source === 'browser',
  )

  const softEntries = browserEntries.filter(
    entry =>
      entry.entryType === 'soft-navigation',
  )

  const icpEntries = browserEntries.filter(
    entry =>
      entry.entryType ===
      'interaction-contentful-paint',
  )
}
```

先將兩種瀏覽器結果分開：

```text
softEntries
icpEntries
```

然後依照目標 URL 找到對應的 `soft-navigation`：

```js
const softNavigation = softEntries
  .filter(entry => (
    pathname(entry.name) === run.targetPath
    && entry.startTime >= matchStart
    && entry.startTime < matchEnd
  ))[0]
```

位置：[navigationMetrics.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/navigationMetrics.js:97)

# 11. 配對 `interaction-contentful-paint`

位置：[navigationMetrics.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/navigationMetrics.js:122)

```js
const interactionId =
  finiteNumber(softNavigation.interactionId)

const relatedIcpEntries = icpEntries.filter(
  entry =>
    finiteNumber(entry.interactionId)
      === interactionId,
)
```

使用相同的：

```js
interactionId
```

把 ICP 配對到該次 soft navigation。

# 12. 計算 Browser FCP

位置：[navigationMetrics.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/navigationMetrics.js:131)

```js
const presentationTime =
  finiteNumber(
    softNavigation.detail?.presentationTime,
  )
  ?? finiteNumber(
    softNavigation.detail?.paintTime,
  )
```

計算：

```js
fcp:
  presentationTime -
  softNavigation.startTime
```

# 13. 計算 Browser LCP

先取得 Chrome 回傳的最大內容時間：

```js
const largestPaintTimes = [
  largestPaintStart(softNavigation),
  ...relatedIcpEntries.map(largestPaintStart),
]
```

然後計算：

```js
lcp:
  latestLargestPaint -
  softNavigation.startTime
```

位置：[navigationMetrics.js](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/navigationMetrics.js:126)

計算完成後寫入：

```js
run.browser = {
  detected: true,
  interactionId,
  navigationId: softNavigation.navigationId,
  fcp,
  lcp,
}
```

# 14. Vue 顯示結果

最新一筆結果：

```js
const lastRun = computed(
  () => navigationRuns.value.at(-1) ?? null,
)
```

位置：[SpaPerformanceDemo.vue](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:29)

顯示 FCP：

```vue
<dd>
  {{ browserMetric(lastRun, 'fcp') }}
</dd>
```

顯示 LCP：

```vue
<dd>
  {{ browserMetric(lastRun, 'lcp') }}
</dd>
```

位置：[SpaPerformanceDemo.vue](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:197)

## 最重要的函式位置總表

| 階段 | 函式 | 位置 |
|---|---|---|
| 支援檢查 | `getPerformanceSupport()` | [browserSupport.js:11](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/browserSupport.js:11) |
| 啟動註冊 | `onMounted()` | [SpaPerformanceDemo.vue:109](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:109) |
| Observer 註冊 | `startPerformanceObservers()` | [performanceTimeline.js:127](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/services/performanceTimeline.js:127) |
| 使用者觸發 | `navigate()` | [SpaPerformanceDemo.vue:50](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:50) |
| Router 換頁 | `router.push()` | [SpaPerformanceDemo.vue:55](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:55) |
| 模擬延遲 | `router.beforeResolve()` | [router.js:54](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/router.js:54) |
| 取得 Chrome entry | `list.getEntries()` | [performanceTimeline.js:138](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/services/performanceTimeline.js:138) |
| 保存 entry | `appendBrowserEntry()` | [performanceTimeline.js:37](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/services/performanceTimeline.js:37) |
| 整理 entry | `normalizePerformanceEntry()` | [performanceEntries.js:37](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/performanceEntries.js:37) |
| 配對及計算 | `reconcileNavigationRuns()` | [navigationMetrics.js:81](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/utils/navigationMetrics.js:81) |
| 顯示最新結果 | `lastRun` | [SpaPerformanceDemo.vue:29](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:29) |
| 顯示 FCP/LCP | `browserMetric()` | [SpaPerformanceDemo.vue:79](C:/Users/andy.chao/Documents/GitHub/VueDemoCollection/chrome-platform-demo/src/demos/SpaPerformanceDemo.vue:79) |