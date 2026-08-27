# Vue 3.6 Vapor Mode 問答：大型 Electron 專案版

- 對象：熟悉 Vue 3、維護大型 Electron 專案的前端工程師
- 用途：15 分鐘報告後的現場問答速查
- 版本背景：Vapor 核心概念以 Vue 3.6 為主；API 與限制以本專案使用的 `3.6.0-rc.5` 為準

每題第一句是可以直接回答的短版結論，後續內容用來補充原因或必要限制。

---

## 一、核心原理

### Q1. Vapor Mode 到底是什麼？

**Vapor 是 Vue 新增的 opt-in SFC compilation mode，將 Template 編譯成 DOM／Block 建立程式與細粒度更新邏輯。** 它保留 Vue Template 與 Composition API 的主要開發體驗，但 Pure Vapor 更新不以一般 VNode Tree Diff 為核心，目標是減少 baseline bundle、VNode allocation 與 Runtime 中間工作。

### Q2. 所以 Vapor 就只是直接操作 DOM 嗎？

**可以用「更直接操作目標 DOM」理解簡單 binding，但不能理解成完全沒有 Vue Runtime。** 文字、class、style、attribute 等 binding 可以直接更新既有 Node；`v-if`、`v-for`、Component、Slot、Transition 仍需要 Block、列表演算法、生命週期、Scope 與 Cleanup 等 Runtime 邏輯。

### Q3. VDOM Compiler 難道不知道 Template 哪裡是動態的嗎？

**知道；VDOM 與 Vapor 的 Compiler 都能辨識靜態與動態位置。** VDOM Compiler 把資訊變成 Static Hoisting、Patch Flags、Block Tree 等最佳化，再產生 VNode-based Render Function；Vapor Compiler 則進一步建立 binding 與目標 DOM／Block 的更新關係。差別是編譯輸出，不是誰比較會看 Template。

### Q4. Component Render 和 Binding Effect 差在哪裡？

**Component Render 重新計算元件的 VNode 輸出；Binding Effect 只執行某組動態 expression 對應的更新程式。** 在 VDOM 中，render dependency 改變通常會重新執行受影響元件的 Render Function。Vapor 的簡單 binding 可以只重算該值並更新指定 Node；實際 Compiler 可能合併多個操作，不保證一個變數對應一個 Effect。

### Q5. Patch VNode 和直接更新 DOM，最後不是都呼叫同一個 DOM API？

**最後一步可能完全相同，差別在到達最後一步前的路徑。** VDOM 先執行元件 Render、產生新的動態 VNode，再由 Patch 根據新舊描述決定 DOM 操作；Vapor 已建立 binding 與 Node 的關係，可以計算新值後執行指定操作。Vapor 省的是部分中間表示與通用 Patch 工作，不是消除 DOM 成本。

### Q6. Compile Time、Runtime、SFC Compilation Mode 分別是什麼？

**Compile Time 是打包時轉換 `.vue`；Runtime 是 App 在瀏覽器／Electron Renderer 實際執行；Compilation Mode 是 Compiler 選擇產生哪類渲染程式。** 普通 SFC 預設產生 VDOM Render Function，帶 `vapor` 標記的 SFC 產生 Vapor DOM／Block 與更新程式。這是在 Build 時決定，不是頁面執行後切換。

### Q7. Child 自己的 state 改變，Parent 也會重新 render 嗎？

**通常不會，只有 render 中依賴該 reactive state 的元件會被觸發。** Child local state 改變時，VDOM 通常只重新執行 Child Render，再 Patch Child 的 VNode；沒有依賴該資料的 Parent 與兄弟元件不會因此重跑。如果值來自 Parent prop，則可能先由 Parent state 更新，再把新 prop 傳給 Child。

### Q8. `v-if`、`v-for` 也能像文字 binding 一樣直接改 DOM 嗎？Vapor 是否完全不用 VNode？

**它們需要更複雜的 Block／列表更新，不能簡化成一次 property assignment。** Pure Vapor Template 不走一般 VNode Tree Patch，但仍要保存條件分支、key、子項 Scope、Component 與 DOM reference。若引入 JSX、Render Function 或 VDOM Interop，該路徑仍會使用 VNode，也可能把 VDOM Runtime 帶入 bundle。

---

## 二、Vue API 與生態相容性

### Q9. 可以只讓單一元件使用 Vapor 嗎？

**可以，Vapor 是元件層級 opt-in，不必一次重寫整個 App。** 最常用的寫法是：

```vue
<script setup vapor>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button @click="count++">{{ count }}</button>
</template>
```

也支援 `<script vapor>` 縮寫與 template-only SFC 的 `<template vapor>`。

### Q10. `createApp()`、`createVaporApp()`、`vaporInteropPlugin` 怎麼選？

**全 Vapor 且不需要 VDOM dependency 才選 `createVaporApp()`；既有 VDOM App 局部導入則保留 `createApp()` 並安裝 Interop。**

```js
// Pure Vapor App
import { createVaporApp } from 'vue'
createVaporApp(App).mount('#app')
```

```js
// 既有 VDOM App 使用 Vapor Component
import { createApp, vaporInteropPlugin } from 'vue'
createApp(App).use(vaporInteropPlugin).mount('#app')
```

### Q11. VDOM 與 Vapor Component 可以互相巢狀嗎？

**安裝 `vaporInteropPlugin` 後可以，標準 props、events、slots 已有基本支援，但仍可能有 Edge Cases。** 官方建議讓兩種渲染模式形成清楚區域，例如整個 Dashboard 子樹使用 Vapor，而不是每一層交錯切換。Interop 越多，除錯與 bundle 成本通常越高。

### Q12. Pinia、Vue Router、i18n、composable 可以直接沿用嗎？

**不能用同一個答案概括，必須區分「非渲染邏輯」與「會渲染 Vue Component 的整合」。** Composable、store 等若只依賴 Vapor 支援的 Reactivity／Composition API，風險通常較低；Router、i18n 或 Plugin 若提供 Component、Directive、依賴 Public Instance 或 VNode，則要確認套件版本、Interop 路徑並做整合測試，不能僅憑套件名稱宣稱完全相容。

### Q13. JSX、Render Function、UI Framework、Chart／Table Wrapper 怎麼辦？

**一般 JSX 與 Render Function 仍是 VDOM Component，在 Vapor App 中需要 Interop。** UI Framework 或 Vue Wrapper 是否有風險，要看它是否依賴 `h()`、VNode、Component Public Instance、Slot 或 Directive 的 VDOM 行為。底層 Canvas、SVG、Chart Library 不一定不能用；真正需要檢查的是包住它的 Vue 元件實作。

### Q14. Vapor 目前有哪些重要 API 限制？

**Vapor 支援的是 Vue API 子集，不適合假設所有 VDOM API 都有相同行為。** rc.5 需特別注意 Options API、`app.config.globalProperties`、`@vue:xxx` element lifecycle event 不支援，`getCurrentInstance()` 回傳 `null`，`v-memo` 不適用；Component ref 不暴露 `$el`、`$props`、`$attrs`、`$slots`、`$refs`，`slots.default()` 也不是安全的 dry run，Custom Directive 使用不同介面。

### Q15. `.delegate` 和一般 `@click` 有什麼差別？

**rc.5 的一般 DOM listener 預設直接綁在元素上，`.delegate` 才是明確啟用 document-level delegation。** 可對支援的靜態事件使用 `@click.delegate="handler"`。從 rc.2 起事件委派改成 opt-in，舊的 `compilerOptions.eventDelegation` 已移除；不要沿用早期 Beta／rc.1 的預設委派印象。

---

## 三、Electron 大型專案實務

### Q16. Vapor 會影響 Electron 的 Main、Preload 還是 Renderer？

**主要影響載入 Vue UI 的 Renderer Process。** Electron Main Process 負責 App lifecycle、BrowserWindow 與原生 API；Preload 在 Renderer 載入前建立受控橋接；Vue App 則通常執行於各 BrowserWindow 的 Renderer。Vapor 改的是 Vue SFC 編譯與 Renderer UI 更新路徑，不會把 Main 或 Preload 變成 Vapor。

### Q17. 導入 Vapor 需要修改 `main.js`、`background.js`、`preload.js` 或 IPC 嗎？

**一般不需要，除非你同時改變 Renderer entry、bundle 路徑或既有 API 契約。** `ipcMain`、`ipcRenderer`、`contextBridge` 的 channel 與資料格式和 Vue 使用哪種渲染模式無關。主要變更應集中在 Vue dependency、SFC 標記、Renderer bootstrap、Interop 設定及受測元件。

### Q18. Vapor 會改變 `contextIsolation`、Node Integration 或 CSP 嗎？

**不會；Vapor 不是 Electron 安全功能，也不能取代既有安全設定。** `contextIsolation`、`contextBridge`、Node Integration、Sandbox、CSP 與 IPC 輸入驗證仍應依 Electron 安全建議維持。不要因為更換 Vue Renderer 就擴大 Preload 暴露面，或直接把 `ipcRenderer` 整個暴露給網頁世界。

### Q19. 多個 `BrowserWindow`／Renderer 都能得到 Vapor 效益嗎？

**每個使用 Vapor bundle 的 Renderer 都可能受益，但也必須分別量測。** Electron 通常為每個 BrowserWindow 建立獨立 Renderer Process，各自解析 JavaScript、配置記憶體並執行 UI。若多個 Window 載入相同 Pure Vapor UI，較小 baseline 與較少渲染配置可能重複受益；但 Main、GPU、共享資料與 IPC 成本不會因此自動下降。

### Q20. Electron bundle 從本機載入，不用下載，縮小 bundle 還有意義嗎？

**有可能有意義，但通常不像網站那樣直接等於網路下載收益。** 本地 App 仍要讀取、解壓、解析與編譯 JavaScript，每個 Renderer 也需要建立執行環境；較小 bundle 可能幫助啟動、記憶體及多 Window 成本。不過 Electron／Chromium 本身很大，Vue Runtime 的差異是否可感知必須實測。

### Q21. IPC 慢、資料序列化、Canvas、Layout 卡頓能靠 Vapor 解決嗎？

**不能直接解決，因為這些不是一般 VNode Patch 問題。** Vapor 可能減少 Renderer 的 Vue 更新工作，但 Main Process long task、IPC 往返、Structured Clone、大量 JSON、Canvas 繪圖、CSS Layout／Paint、圖片解碼或原生模組瓶頸仍要各自處理。先用 Profiling 判斷時間花在哪一層，避免把所有 Renderer 卡頓都歸因於 VDOM。

### Q22. 大型既有 `components`、`pages`、`store` 專案應從哪裡開始試？

**先選邊界清楚、局部更新頻繁、第三方 VDOM dependency 少的頁面或元件群。** 比如即時 Dashboard、狀態監控面板或大型表格的一個獨立區域；先不要從 App Root、Router Shell、共用 Layout 或高度依賴 UI Framework 的核心元件開始。Store 不必為 Vapor 重寫，但要確認畫面真正的 reactive update workload。

---

## 四、效能與驗證

### Q23. Vapor 保證比 VDOM 快嗎？哪些 workload 最可能受益？

**不保證；最可能受益的是大量動態 binding 中只有少部分高頻局部改變的 workload。** 例如 Dashboard 指標、即時狀態、Data Grid 欄位更新。大量 DOM 插入、排序、Layout、Canvas、IPC 或初始化重工作業可能由其他成本主導，Vapor 的相對收益就會較小。

### Q24. Large List、Data Grid、高頻 Dashboard 應看哪些指標？

**至少同時看更新延遲、CPU、記憶體、GC 與畫面流暢度，不要只看單次平均時間。** 建議記錄 median、p95、long task、每秒更新量、Heap／allocation、GC pause、Frame time、掉幀、DOM node 數與 bundle chunk。大型列表還要分開測「欄位局部更新」和「新增、刪除、排序」。

### Q25. 怎麼做公平的 VDOM／Vapor A/B Benchmark？

**兩邊必須使用同等功能、相同資料、相同事件序列、Production build 與相同 Electron／Chromium 環境。** 固定硬體、Window 數量、DevTools 狀態與暖機方式；分開量初次 mount、穩態更新、列表結構變化與記憶體。重複多輪並保留完整紀錄，不只挑最好的一次，也要確認 Interop 是否讓某一邊多載入 Runtime。

### Q26. Electron／Chromium DevTools 應該怎麼查瓶頸？

**先用 Renderer Performance 與 Memory 工具確認 Vue 更新是否真的佔主要時間，再追 Main 與 IPC。** Performance trace 看 Scripting、Rendering、Painting、Long Task 與 Frame；Memory 看 Heap Snapshot、Allocation Timeline、Detached DOM。若卡頓伴隨 IPC，再量測送出、Main handler、序列化與回傳時間，避免只比較 Vue benchmark。

---

## 五、導入決策與風險

### Q27. `3.6.0-rc.5` 可以直接用在 Production 嗎？

**它仍是 Pre-release，不應只因功能完成就視同 Stable。** Vue 官方在 RC 階段建議既有 App 可局部用於 performance-sensitive page，或用於較小的新 App；大型 Electron Production 專案還要考慮 rc 升版修正、Interop Edge Cases、第三方相容性、測試覆蓋與回退成本，由團隊自行承擔預發布風險。

### Q28. 值得把整個大型 Electron App 改成 Pure Vapor 嗎？

**通常不值得一開始全面改寫，除非依賴盤點證明整條 render path 都能維持 Pure Vapor。** 大型專案常有 Router、UI Framework、Dynamic Renderer、JSX 或歷史元件；一旦需要大量 Interop，就可能同時帶入兩套 Runtime，並增加除錯成本。先用數據證明局部價值，再決定是否擴大。

### Q29. 怎麼漸進導入並保留回退方式？

**以頁面或功能區域為邊界，讓同一份行為測試可以在 VDOM 與 Vapor 版本間切換。** 固定 dependency 版本、記錄 baseline、避免深層混合巢狀，並把 Vapor 標記限制在少數可回退 SFC。在既有 `createApp()` 加 Interop 的試點中，遇到回歸時可移除該 SFC 的 `vapor` 標記回到 VDOM；若使用 `createVaporApp()`，回退時還必須同步調整 App bootstrap。不要同時重構資料流與渲染模式，否則難以定位問題。

### Q30. 哪些情況不適合使用 Vapor？

**需要完整 Vue API、重度 JSX／Render Function、依賴 VNode／Public Instance 的元件庫，或目前根本沒有 Renderer 渲染瓶頸時，不應優先導入。** 如果主要問題在 Main Process、IPC、Canvas、網路、資料庫、Layout 或架構複雜度，先修真正瓶頸。穩定性要求高而無法接受 Pre-release 與 Interop 風險的 Production 核心也應等待 Stable 或更多驗證。

---

## 官方參考資料

### Vue

- [Vue Core Releases](https://github.com/vuejs/core/releases)
- [Vue 3.6.0-rc.1：About Vapor Mode](https://github.com/vuejs/core/releases/tag/v3.6.0-rc.1)
- [Vue 3.6 Minor Changelog](https://github.com/vuejs/core/blob/minor/CHANGELOG.md)

### Electron

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
