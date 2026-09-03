# Chrome 148–151 Web Platform Demos

這是一個獨立的 Vue App，用於 2026 前端技術會議，展示 Browser 如何原生處理過去常由 JavaScript 或自訂 instrumentation 負責的工作：

- Chrome 148：`<audio loading="lazy">`
- Chrome 150：CSS `text-fit`
- Chrome 151：`soft-navigation` 與 `interaction-contentful-paint`

本專案不包含 Vue Vapor、WebMCP、backend、外部媒體、外部字型或分析服務。

## 環境與啟動

- Node.js 22.12+
- npm
- 建議 Chrome 151+

```bash
npm install
npm run dev
```

開啟 Vite 顯示的網址。其他指令：

```bash
npm run generate:media
npm test
npm run build
npm run preview
```

`predev` 與 `prebuild` 會自動執行 WAV generator。所有依賴均鎖定 exact version，實際解析結果記錄於 `package-lock.json`。

## Routes

| Route | Demo |
| --- | --- |
| `/` | Browser support 首頁 |
| `/text-fit` | JavaScript / Native CSS comparison |
| `/media-lazy?mode=lazy` | Lazy media mode |
| `/media-lazy?mode=eager` | Eager media mode |
| `/spa-performance/dashboard` | 150 ms SPA route |
| `/spa-performance/contacts` | 800 ms SPA route |
| `/spa-performance/reports` | 1400 ms SPA route |

`/dashboard`、`/contacts`、`/reports` 會 redirect 至 namespaced route。專案使用 `createWebHistory()`；部署至一般靜態主機時，server 必須將未知路徑 rewrite 至 `index.html`。Vite dev server 與 `vite preview` 已處理此 fallback。

## Demo 1：CSS text-fit

1. 開啟 `/text-fit`。
2. 拖曳 container width slider，觀察 JavaScript 側的 ResizeObserver callback 與尺寸探測次數增加。
3. 修改文字，確認左右使用相同內容與寬度。
4. 比較 Native CSS 側：`text-fit: shrink per-line-all 12.5%`，JavaScript calculation 維持 0。

兩側都以 64px 為 base size、8px 為最小值。JavaScript 使用固定 12 steps 的 binary search；Native CSS 透過 12.5% minimum scale 得到相同下限。

`text-fit` 改變文字的 **used value**，但不改變 computed `font-size`。因此頁面不會把 `getComputedStyle()` 的 64px 誤標為實際顯示字級。若完整 declaration 不受支援，Native 區塊會保留原始 64px 樣式，不會套用 JavaScript fallback。

## Demo 2：Media lazy loading

音訊由 `scripts/generate-wav.mjs` deterministic 產生，共 20 個 1.25 秒、44.1 kHz、16-bit mono PCM WAV，不依賴網路媒體。

建議展示流程：

1. 開啟 DevTools → Network。
2. 勾選 **Disable cache**。
3. 以 Lazy mode 重新載入，觀察初始 `/media/` requests；實際數量由 Browser viewport heuristic 決定，不應預設固定值。
4. 往下捲動，觀察新的音訊 request 與頁面 Resource Log。
5. 選 Eager，按 **Apply and reload**，比較初始 requests。

切換 mode 必須完整 reload。若只在同一個 document 重新 render `<audio>`，已載入或快取的資源會讓比較失真。Resource Log 使用 buffered `PerformanceObserver` 讀取真實 `resource` entry，只統計 `/media/` URL。

## Demo 3：SPA Performance Entries

1. 開啟 `/spa-performance/dashboard`。
2. 點 Contacts；router guard 等待 800 ms 後才提交 URL 與內容。
3. 點 Reports；router guard 等待 1400 ms。
4. 在 **Last Navigation** 直接比較設定延遲、App Duration、Browser FCP 與 Browser LCP。
5. 連續切換三個 route，在結果表中比較 150/800/1400 ms 對使用者等待時間的影響。
6. 展開 **Raw API Details**，查看 `APP MARK`、`BROWSER ENTRY`、`interactionId`、`navigationId` 與原始 timing。
7. 使用 **Clear Timeline** 同時清除結果表與 raw entries，再進行下一輪。

Navigation 只由使用者 click 觸發。App 會使用 `performance.mark()` 記錄 click、route start 與 content ready，但這些項目永遠標示為 `APP MARK`。只有 `PerformanceObserver` 真正收到的 `soft-navigation` 或 `interaction-contentful-paint` 才會標示為 `BROWSER ENTRY`，不會以自訂 mark 模擬原生 entry。

`interaction-contentful-paint` 可能由非導航互動產生；如需對應 soft navigation，應使用 `interactionId`，不能只依賴 `navigationId`。

頁面使用以下公式將原始 entry 轉成可讀結果：

```text
App Duration
= route-content-ready.startTime - click.startTime

Browser FCP
= soft-navigation.presentationTime - soft-navigation.startTime
  （沒有 presentationTime 時改用 paintTime）

Browser LCP
= matching ICP largestContentfulPaint.startTime - soft-navigation.startTime
```

`soft-navigation` 先以目標 URL 對應 navigation run，ICP 再以 `interactionId` 配對。若 Chrome 尚未回傳 entry，UI 顯示 Pending；若 entry 沒有對應 paint 欄位，顯示 Not reported，不會用 App Duration 補成假的 Browser metric。

## Feature detection

本專案不使用 User-Agent sniffing：

```js
CSS.supports('text-fit', 'shrink per-line-all 12.5%')
'loading' in document.createElement('audio')
PerformanceObserver.supportedEntryTypes.includes('soft-navigation')
PerformanceObserver.supportedEntryTypes.includes('interaction-contentful-paint')
```

若 Browser 不支援新 API，頁面仍可操作：text-fit Native 區塊顯示未增強版本、media 頁繼續顯示 resource timing、SPA 頁繼續顯示 APP MARK。

## Known limitations

- 原生 API support 與行為取決於實際 Browser 版本；其他瀏覽器或企業 policy 可能不同。
- Media lazy-loading 的 viewport 距離與 preload heuristic 由 Browser 決定，因此初始 request 數量不 hard-code。
- WAV 在 cache 中時 `transferSize` 可能是 0；這不代表 resource entry 是假的。
- Soft Navigation detection 需要使用者互動、URL 更新與可見 contentful paint。Browser entry 可能在 APP MARK 之後非同步送達。
- Artificial delay 只是本機 `setTimeout()`，沒有 backend 或真實 API request。
- Timeline 是頁面記憶體內資料；完整 reload 會清除，語言偏好則保存在 `localStorage`。
- 這是會議展示，不是正式 RUM library、跨瀏覽器相容層或 performance benchmark。

## References

- [Chrome 148 release notes](https://developer.chrome.com/release-notes/148)
- [Chrome 150 release notes](https://developer.chrome.com/release-notes/150)
- [CSS Text Module Level 5](https://drafts.csswg.org/css-text-5/)
- [Chrome 151 release notes](https://developer.chrome.com/release-notes/151)
- [Measuring soft navigations](https://developer.chrome.com/docs/web-platform/soft-navigations)
