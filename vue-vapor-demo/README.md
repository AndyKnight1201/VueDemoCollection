# Vue 3.6 Vapor Mode Benchmark

這是一個用於前端技術會議的獨立 Vue Demo，讓 Virtual DOM 與 Vue 3.6 Vapor Mode 在相同資料、相同操作及相同測量次數下進行相對比較。

> 此 Demo 是相對比較用途，不代表 Vue 官方 benchmark，也不代表所有 production workload。

## 環境需求

- Node.js `>=22.12.0`
- npm
- 支援 `iframe`、`performance.now()`、`requestAnimationFrame()` 的現代瀏覽器

本專案固定使用：

- `vue`: `3.6.0-rc.5`
- `@vue/compiler-sfc`: `3.6.0-rc.5`
- `vite`: `8.2.2`
- `@vitejs/plugin-vue`: `6.0.8`

專案內的 `.npmrc` 啟用 `legacy-peer-deps=true`。原因是 npm 的 prerelease semver 規則不會把 `3.6.0-rc.5` 視為符合 `@vitejs/plugin-vue` 宣告的穩定版 `vue ^3.2.25` peer range；本 Demo 的 Vue runtime 與 compiler 仍各自鎖定同一個 RC 版本。

## 安裝與執行

```bash
npm install
npm run dev
```

開啟 Vite 顯示的本機網址。Dashboard 位於 `/`，VDOM 與 Vapor renderer 分別位於 `/vdom.html`、`/vapor.html`。

其他指令：

```bash
npm test
npm run build
npm run preview
```

## 專案架構

Dashboard、VDOM 與 Vapor 是三個獨立 HTML entry：

```text
index.html       Dashboard / benchmark controller
vdom.html        createApp() + Virtual DOM SFC
vapor.html       createVaporApp() + <script setup vapor>
```

Dashboard 以 iframe 載入兩個 renderer，並透過同源 `window.postMessage()` 傳送 benchmark command。兩側共享 deterministic data、benchmark actions、統計與 protocol 模組，但不在同一個 Vue root 內混合執行。

## Benchmark 操作

- **Initial Render**：從空列表建立並 render 所選筆數。
- **Update 10%**：使用 seed 選出不重複的 10% rows，更新 `score`、`unread`、`active`。
- **Update All**：更新全部 rows。
- **Append 1,000**：在 baseline 尾端新增 1,000 rows。
- **Remove 1,000**：從 seed 決定的固定合法位置刪除 1,000 rows。
- **Shuffle**：使用 seeded Fisher–Yates shuffle 重排 rows。

支援 1,000、5,000、10,000、20,000 rows，預設 10,000；預設 seed 為 2026。

## 測量方法

1. 每個 warmup 與 measured sample 都會在計時區外重建相同 baseline。
2. 以 `performance.now()` 記錄開始時間。
3. 執行指定 state mutation。
4. 等待 Vue `nextTick()`。
5. 再等待一個 `requestAnimationFrame()`。
6. 計算 elapsed time。

Dashboard 會先完成 VDOM 的全部測量，再執行 Vapor，避免兩個 renderer 同時競爭瀏覽器主執行緒。Warmup 不會進入結果；measured values 用來計算：

- avg
- median
- min
- max
- ratio：`Vapor avg / VDOM avg`

每次完整完成 VDOM 與 Vapor 測量後，Dashboard 會在頁面內新增一筆歷史紀錄，並把 ratio 加入折線圖。重新整理頁面或使用 **Clear Records** 會清空紀錄；被 **Stop Test** 中止的未完成測試不會寫入歷史。

時間包含 action 本身、Vue reactive update 與指定的 render settle；不包含 baseline 準備、`postMessage`、統計計算。此方法不強制讀取 layout，也不保證涵蓋完整 paint/composite 成本。

## 現場展示流程

1. 使用建議的 1280×720 或更大視窗開啟 Dashboard。
2. 選擇 10,000 rows、Warmup 2、Measured Runs 10、Seed 2026。
3. 執行 **Update 10%**，比較兩側 avg / median / min / max。
4. 執行 **Shuffle**，觀察 keyed list reconciliation 的相對結果。
5. 使用 **Stop Test** 中止進行中的測試；使用 **Clear Records** 清除頁面內累積的結果紀錄。
6. 強調 Vapor 是 opt-in，結果只代表目前裝置、瀏覽器及這組 workload。

## Protocol

主要訊息類型：

- `CHILD_READY`
- `RUN_BENCHMARK`
- `BENCHMARK_STARTED`
- `BENCHMARK_PROGRESS`
- `BENCHMARK_RESULT`
- `BENCHMARK_ERROR`
- `STOP_BENCHMARK`
- `STOP_DONE`

所有 command/result 都帶有 `requestId`；父頁會核對 origin 與 iframe window，子頁只接受同源 parent。單一 renderer 超過 180 秒未完成時，Dashboard 會顯示 timeout 並解除 UI 鎖定。

## 已知限制

- Vue `3.6.0-rc.5` 是 RC 版本，行為可能與日後正式版不同。
- 瀏覽器擴充套件、DevTools、CPU throttling、背景分頁、電源模式與系統負載都可能影響數字。
- VDOM 與 Vapor 採序列測量；溫度、JIT 與先後順序仍可能造成偏差。
- Row UI 刻意不用 `<table>`，但 DOM 數量與 CSS 仍是 workload 的一部分。
- 這不是 production application、跨瀏覽器研究或 Vue 官方效能結論。
