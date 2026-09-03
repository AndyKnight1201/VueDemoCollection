# 🌐 Chrome 148～151 Web Platform：Browser 原生能力實作重點

Chrome 148～151 陸續加入三項值得前端開發者注意的 Web Platform 功能：

1. Chrome 148：Media Lazy Loading
2. Chrome 150：CSS `text-fit`
3. Chrome 151：SPA Performance Entries

共同方向是：

> 將以前需要自行撰寫 JavaScript 或 instrumentation 的工作，逐步交給 Browser 原生處理。

本文介紹每項功能的用途，以及實際如何撰寫程式碼。

---

# 🎧 Media Lazy Loading

## 功能介紹

傳統頁面如果放置大量 `<audio>` 或 `<video>`，Browser 可能在初始載入時就請求許多媒體資源。

Chrome 148 開始支援：

```html
<audio loading="lazy">
```

Browser 會等媒體元素接近 viewport 時，才開始載入資源。

## 適合用途

- Podcast、線上課程或語音訊息列表
- 新聞與社群動態中的影片
- 商品頁下方的大量產品影片
- 降低首屏 requests 與不必要的流量

## 如何實作

最基本的 HTML 寫法：

```html
<audio
  controls
  preload="metadata"
  loading="lazy"
  src="/media/tone-01.wav"
></audio>
```

在 Vue 中可切換 Lazy / Eager：

```vue
<script setup>
import { ref } from 'vue'

const mode = ref('lazy')
</script>

<template>
  <audio
    controls
    preload="metadata"
    :loading="mode"
    src="/media/tone-01.wav"
  />
</template>
```

Feature Detection：

```js
const supported =
  'loading' in document.createElement('audio')
```

也可以使用 `PerformanceObserver` 觀察真正載入的媒體資源：

```js
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    const pathname = new URL(entry.name).pathname

    if (pathname.includes('/media/')) {
      console.log(pathname, entry.duration, entry.transferSize)
    }
  }
})

observer.observe({
  type: 'resource',
  buffered: true
})
```

實際比較 Lazy / Eager 時，應完整 reload 頁面並在 DevTools Network 勾選 **Disable cache**，避免已下載的資源影響結果。

---

# 🔤 CSS text-fit

## 功能介紹

`text-fit` 可以讓 Browser 根據容器寬度縮放文字。

過去通常需要：

```text
ResizeObserver
→ 測量文字寬度
→ 計算 font-size
→ 修改 style
```

Chrome 150 開始可直接使用 CSS，將縮放工作交給 Browser layout engine。

## 適合用途

- Dashboard KPI 與統計數字
- 電子看板或投影畫面
- 卡片標題、新聞標題
- 海報、圖卡或報表產生器
- 多語系造成文字長度差異的畫面

## 如何實作

```css
.responsive-title {
  width: 520px;
  overflow: hidden;
  white-space: nowrap;
  font-size: 64px;
  text-fit: shrink per-line-all 12.5%;
}
```

這段設定代表：

- Base font size 是 `64px`
- 文字超出時允許縮小
- 最小縮放比例為 `12.5%`
- `64px × 12.5% = 8px`

Feature Detection 必須檢查實際使用的完整語法：

```js
const supported = CSS.supports(
  'text-fit',
  'shrink per-line-all 12.5%'
)
```

若 Browser 不支援，CSS declaration 會被忽略，可以顯示提示或提供傳統 JavaScript fallback。

傳統 JavaScript 版本通常使用 `ResizeObserver` 加 binary search：

```js
const observer = new ResizeObserver(() => fitText())

observer.observe(titleElement)

function fitText() {
  let low = 8
  let high = 64

  for (let step = 0; step < 12; step++) {
    const middle = (low + high) / 2
    titleElement.style.fontSize = `${middle}px`

    if (titleElement.scrollWidth <= titleElement.clientWidth) {
      low = middle
    } else {
      high = middle
    }
  }

  titleElement.style.fontSize = `${low}px`
}
```

兩種方法可以得到相近的視覺結果，但 CSS `text-fit` 不需要維護 ResizeObserver 與字級計算邏輯。

注意：`text-fit` 改變的是文字的 **used value**，`getComputedStyle()` 仍可能回傳原始的 `64px`，因此不應把 computed value 當成實際顯示字級。

---

# 📈 SPA Performance Entries

## 功能介紹

傳統多頁網站每次換頁都會重新載入文件，Browser 很容易判斷一次 navigation 的開始與完成。

Vue、React 等 SPA 使用 JavaScript 切換 route，不會重新載入整份 HTML。過去通常只能自行記錄：

```js
performance.mark('route-start')
performance.mark('route-content-ready')
```

Chrome 151 開始提供兩種新的 Performance Entry：

```text
soft-navigation
interaction-contentful-paint
```

Browser 會根據使用者互動、URL 更新及可見內容變化，判斷 SPA 是否發生一次 soft navigation。

## 適合用途

- 量測 Vue / React 每個 route 的使用者體感
- 找出載入較慢的 Dashboard、報表或列表頁
- 建立 route-level RUM 與效能監控
- 減少不同專案各自定義 navigation 的差異

## 如何實作

先檢查 Browser 支援狀態：

```js
const entryTypes =
  PerformanceObserver.supportedEntryTypes || []

const softNavigationSupported =
  entryTypes.includes('soft-navigation')

const icpSupported =
  entryTypes.includes('interaction-contentful-paint')
```

分別建立 Observer：

```js
if (softNavigationSupported) {
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      console.log('soft navigation', entry)
    }
  })

  observer.observe({
    type: 'soft-navigation',
    buffered: true
  })
}
```

```js
if (icpSupported) {
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      console.log('contentful paint', entry)
    }
  })

  observer.observe({
    type: 'interaction-contentful-paint',
    buffered: true
  })
}
```

SPA navigation 必須由使用者操作觸發：

```vue
<button @click="router.push('/contacts')">
  Contacts
</button>
```

不能只在 App 啟動後自動執行 `router.push()`，因為 soft navigation 的判斷需要真實 user interaction。

也可以保留 App 自己的 marks 作為比較：

```js
performance.mark('demo:click-contacts')

await router.push('/contacts')
await nextTick()

requestAnimationFrame(() => {
  performance.mark('demo:route-content-ready')
})
```

畫面與資料必須明確區分：

```text
APP MARK
= Application 自己建立的 performance.mark()

BROWSER ENTRY
= PerformanceObserver 真正收到的 Browser Entry
```

不可把自訂 mark 偽裝成 `soft-navigation`。此外，關聯 soft navigation 與 `interaction-contentful-paint` 時，應優先使用 `interactionId`。

## Demo 如何把 Entry 轉成結果

只列出原始 entry 不容易看出用途，因此 Demo 會直接顯示每次 route navigation 的結果：

```text
Route              /spa-performance/contacts
Artificial Delay   800 ms
App Duration       812 ms
Browser FCP        820 ms
Browser LCP        826 ms
Chrome Detection   Detected
```

計算方式：

```js
const appDuration =
  contentReadyMark.startTime - clickMark.startTime

const browserFcp =
  softNavigation.presentationTime - softNavigation.startTime

const browserLcp =
  largestContentfulPaint.startTime - softNavigation.startTime
```

其中 `soft-navigation` 以 route URL 對應，`interaction-contentful-paint` 則使用 `interactionId` 配對。Browser Entry 可能比 Vue render 晚抵達，因此結果會先顯示 Pending，再自動更新成實際數值。

這讓開發者可以直接比較：

| Route | 模擬延遲 | App 測量 | Chrome FCP/LCP |
|---|---:|---:|---:|
| Dashboard | 150ms | 約 150ms | Browser 實際回報 |
| Contacts | 800ms | 約 800ms | Browser 實際回報 |
| Reports | 1400ms | 約 1400ms | Browser 實際回報 |

如果 Chrome 沒有回傳某個欄位，Demo 會顯示 `Not reported`，不會用自訂 mark 偽造 Browser 數字。

---

# 🆚 三項功能整理

| Chrome | 功能 | 過去做法 | Browser 原生做法 | 主要價值 |
|---|---|---|---|---|
| 148 | Media Lazy Loading | IntersectionObserver、動態設定 `src` | `loading="lazy"` | 減少初始 request 與流量 |
| 150 | CSS `text-fit` | ResizeObserver、文字測量、binary search | CSS `text-fit` | 減少排版用 JavaScript |
| 151 | SPA Performance Entries | 自訂 `performance.mark()` | `soft-navigation`、ICP | 統一 SPA route 效能量測 |

---

# 🏁 總結

這三項功能分別把不同責任交給 Browser：

```text
Media Lazy Loading
→ Browser 決定媒體何時下載

CSS text-fit
→ Browser 決定文字如何縮放

SPA Performance Entries
→ Browser 判斷 SPA navigation 與內容繪製
```

對前端開發者而言，核心價值不是「完全不寫 JavaScript」，而是：

- 使用標準化 API
- 減少重複實作
- 降低維護成本
- 讓 Browser 使用更接近底層的資訊做最佳化與量測

實務導入時仍應使用 Feature Detection，並為尚未支援的 Browser 保留合理 fallback。

---

# 📚 官方參考資料

- [Chrome 148 Release Notes](https://developer.chrome.com/release-notes/148)
- [Chrome 150 Release Notes](https://developer.chrome.com/release-notes/150)
- [CSS Text Module Level 5](https://drafts.csswg.org/css-text-5/)
- [Chrome 151 Release Notes](https://developer.chrome.com/release-notes/151)
- [Measuring Soft Navigations](https://developer.chrome.com/docs/web-platform/soft-navigations)
