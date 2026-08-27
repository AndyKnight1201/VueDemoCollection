# Vue 3.6 Vapor Mode：從 Virtual DOM 到細粒度 DOM 更新

Vue 開發者通常只需要關心資料與 template：資料改變，畫面就跟著改變。但在這個簡單的開發體驗背後，Vue 必須解決一個核心問題：**如何把 reactive state 的變化轉換成正確而有效率的 DOM 更新？**

這套從 state 產生 UI、並在 state 改變後維持 UI 同步的方法，稱為 **rendering strategy（渲染策略）**。

傳統 Vue 3 使用經過 compiler 最佳化的 Virtual DOM。Vue 3.6 則加入另一條 opt-in 路徑：**Vapor Mode**。Vapor 保留大部分熟悉的 Vue template 與 Composition API 開發體驗，但改變 template 的編譯結果以及 runtime 更新 DOM 的方式。

本文以 Vue `3.6.0-rc.5` 為背景，介紹 Virtual DOM 與 Vapor 的心智模型、程式寫法、優缺點及採用時需要注意的限制。

## 1. Vue Vapor Mode 是什麼？

Vapor Mode 是 Vue Single-File Component（SFC）的一種新編譯模式。它不是另一套 framework，也不是新的 template 語言。

它的核心方向可以濃縮成一句話：

> 讓 compiler 根據 template 產生更直接的 DOM 建立與 reactive update 程式，不再以 Virtual DOM 作為主要的 rendering 中介層。

Vapor 是 **opt-in**，也就是開發者必須明確選擇使用。升級到 Vue 3.6 不會讓既有 component 自動改成 Vapor，傳統 VDOM 也沒有從 Vue 中消失。

兩種模式都在解決相同問題：

```text
Application State
        ↓
應該呈現什麼 UI？
        ↓
如何更新 Real DOM？
```

不同之處在於中間採用的 abstraction，以及 compiler 和 runtime 各自承擔多少工作。

## 2. 傳統 Vue 如何更新畫面？

### 2.1 從 Template 到 Render Function

假設有一段普通 Vue template：

```vue
<span class="score">Score {{ score }}</span>
```

Vue 不會在瀏覽器中直接執行這段 template。SFC compiler 會先分析它，再產生 render function。

Render function 執行後會建立 **VNode（Virtual DOM Node）**。VNode 是描述 UI 節點的 JavaScript object，它不是瀏覽器真正顯示的 DOM。

概念上，一個 VNode 可能像這樣：

```js
{
  type: 'span',
  props: { class: 'score' },
  children: `Score ${score.value}`,
  patchFlag: 'TEXT'
}
```

這只是方便理解的簡化模型，不是 Vue compiler 的完整實際輸出。

### 2.2 Diff、Patch 與 Reconciliation

當 `score` 改變時，傳統 Vue 的更新流程可以簡化成：

```text
Reactive state 改變
        ↓
重新執行相關 render function
        ↓
產生新的 VNode 描述
        ↓
比較新舊 VNode
        ↓
將必要變更套用到 Real DOM
```

這裡常見三個名詞：

- **Diff**：比較新舊描述，找出差異。
- **Patch**：把必要差異套用到真實 DOM。
- **Reconciliation**：讓目前畫面與最新 state／描述重新一致的整體過程。

Virtual DOM 的價值不只在效能。它提供一個通用 UI abstraction，讓 component、slot、動態結構、render function、JSX 與跨平台 renderer 能用一致的模型表達。

### 2.3 Vue 的 VDOM 不是暴力比較整棵樹

把 VDOM 說成「每次資料改變都完整比較整棵樹」並不準確。Vue 的 compiler 會在 build time 分析 template，提供多種最佳化資訊給 runtime。

#### Static Hoisting

不會改變的靜態內容可以被移出重複執行路徑，避免每次 render 都重新建立。

#### Patch Flags

Compiler 可以標記節點可能改變的是文字、class、style 或特定 props。Renderer 因此不必逐一猜測所有內容。

#### Block Tree

Vue 會收集動態節點，讓更新時可以更聚焦在可能改變的區域。

因此，傳統 Vue 是一套 **compiler-informed VDOM**：runtime 使用 compiler 提供的提示縮小工作範圍，而不是完全不知道 template 結構的通用 diff。

## 3. Vapor 改變了什麼？

### 3.1 改變的是 Compiler Output

Vapor 的重點不是要求開發者改寫 UI，而是讓 compiler 產生不同的 rendering code。

Compiler 已經知道：

- 哪些 DOM 結構是靜態的。
- 哪些文字依賴哪個 reactive state。
- 哪些 attribute 可能改變。
- 哪些位置包含條件分支或列表。

傳統 VDOM 路徑會產生建立 VNode 的 render function，再交給 VDOM renderer。Vapor 則利用這些已知資訊，產生更直接的 DOM 建立程式和 reactive update 工作。

### 3.2 Reactive Effect 與 Fine-grained Update

**Reactive effect** 是一段會追蹤 reactive dependency 的程式。Effect 執行時讀取了哪些 reactive state，Vue 就能記住這些依賴關係；其中一個 dependency 改變時，再執行對應的更新工作。

**Fine-grained update（細粒度更新）** 則代表 dependency 可以對應到較小範圍的 DOM binding，而不是先重新建立一份完整的新 UI 描述。

前面的 template 在 Vapor 路徑下，可以用以下心智模型理解：

```js
const span = createDOMFromTemplate('<span class="score"></span>')

effect(() => {
  setText(span, `Score ${score.value}`)
})
```

這同樣是教學用概念，不是可以直接使用的 Vue API，也不是 Vapor compiler 的完整輸出。

當 `score` 改變時，對應的 effect 可以直接更新相關文字位置，不需要先建立新的完整 VNode 描述，再走通用 VDOM patch 流程。

### 3.3 沒有主要 VDOM 中介，不代表沒有 Runtime

Vapor 並不是把所有 Vue runtime 都刪掉。以下工作仍然需要 runtime：

- Vue reactivity 與 effect lifecycle。
- Component 建立、更新與卸載。
- `v-if` 等條件分支管理。
- `v-for` 與 keyed list 的新增、刪除和移動。
- Props、events、slots、directives 與其他 Vue 能力。

真實 DOM 的成本也不會消失。瀏覽器仍然需要進行 style calculation、layout、paint 與 composite。

比較精確的說法是：

> Vapor 移除的是主要 Virtual DOM 中介與相關通用工作，不是移除 Vue runtime，也不是移除瀏覽器 rendering 成本。

## 4. VDOM 與 Vapor 的流程比較

### 傳統 VDOM 路徑

```text
Vue Template
    ↓ SFC Compiler
VNode Render Function
    ↓ State Change
建立新的 VNode 描述
    ↓ Diff / Reconciliation / Patch
Real DOM Update
```

### Vapor 路徑

```text
Vue Template
    ↓ Vapor Compiler
DOM Creation Instructions
+ Reactive Update Effects
    ↓ State Change
執行對應的 Effect
    ↓
Relevant DOM Update
```

### 系統性比較

| 面向 | 傳統 VDOM | Vapor |
|---|---|---|
| 編譯結果 | 建立 VNode 的 render function | DOM 建立與 reactive update 程式 |
| 主要中介 | VNode tree | Fine-grained effects 與 Vapor runtime structures |
| 更新路徑 | Render → reconciliation → patch | Dependency change → 對應 DOM update |
| Object allocation | 更新時可能建立新的 VNode | 減少主要 VNode allocation |
| Runtime | 通用 VDOM renderer | Vapor runtime；純 App 可不包含 VDOM runtime |
| Template 體驗 | 標準 Vue template | 大部分標準 Vue template 體驗 |
| API 範圍 | 完整且成熟 | Vue API 子集合 |
| Render function／JSX | 原生使用 VDOM | 仍屬 VDOM component，需要 interop |
| 生態相容性 | 最完整 | 第三方套件需要逐項確認 |

兩者不是單純的「新技術淘汰舊技術」。VDOM 偏向通用、成熟與動態表達能力；Vapor 則利用 compiler 已知資訊，換取更直接與細粒度的 runtime 更新路徑。

## 5. 程式寫法上的差異

從開發者角度看，真正決定 rendering mode 的程式差異很集中。

### 5.1 VDOM 使用 `createApp()`

本專案的 [VDOM 啟動入口](./src/vdom/main.js)：

```js
import { createApp } from 'vue'
import App from './App.vue'
import '../styles/renderer.css'

createApp(App).mount('#app')
```

對應的 [VDOM SFC](./src/vdom/App.vue) 使用一般 `<script setup>`：

```vue
<script setup>
import { useRenderer } from '../shared/useRenderer.js'

const renderer = 'vdom'
const { errorMessage, progressLabel, rowCount, rows, status } = useRenderer(renderer)
</script>
```

### 5.2 Vapor 使用 `createVaporApp()`

本專案的 [Vapor 啟動入口](./src/vapor/main.js)：

```js
import { createVaporApp } from 'vue'
import App from './App.vue'
import '../styles/renderer.css'

createVaporApp(App).mount('#app')
```

對應的 [Vapor SFC](./src/vapor/App.vue) 加上 `vapor` marker：

```vue
<script setup vapor>
import { useRenderer } from '../shared/useRenderer.js'

const renderer = 'vapor'
const { errorMessage, progressLabel, rowCount, rows, status } = useRenderer(renderer)
</script>
```

核心差異可以縮成：

```diff
- import { createApp } from 'vue'
+ import { createVaporApp } from 'vue'

- createApp(App).mount('#app')
+ createVaporApp(App).mount('#app')
```

以及：

```diff
- <script setup>
+ <script setup vapor>
```

`createApp()`／`createVaporApp()` 決定 root application 使用的 runtime 路徑；SFC 上的 `vapor` marker 則決定 component 的 compiler output。

Rendering mode 是 compile-time 決定的，不能靠下面這種普通 runtime 變數切換：

```js
const mode = 'vapor' // 不會改變已編譯 SFC 的 rendering mode
```

### 5.3 `renderer` 字串不是 Rendering Mode 開關

兩個 SFC 分別寫了：

```js
const renderer = 'vdom'
```

與：

```js
const renderer = 'vapor'
```

這只是本專案用來識別來源、顯示名稱與套用視覺樣式的普通字串。把它改成其他文字不會讓 component 在 VDOM 與 Vapor 之間切換。

真正有作用的是：

```text
createApp() + <script setup>
```

對比：

```text
createVaporApp() + <script setup vapor>
```

### 5.4 Template 與 Composition API 大多維持熟悉寫法

兩個 SFC 的 template 幾乎相同，例如：

```vue
<div
  v-for="row in rows"
  :key="row.id"
  class="data-row"
  :class="{ inactive: !row.active }"
>
  <span>{{ row.name }}</span>
  <span>Unread {{ row.unread }}</span>
  <span>Score {{ row.score }}</span>
  <span>{{ row.active ? 'Active' : 'Inactive' }}</span>
</div>
```

常見的 `ref`、`computed`、`watch`、props、events，以及 `v-if`、`v-for` 等 template 使用體驗大多相同。差異主要發生在 compiler output 與 runtime execution model，而不是整套開發語法全部重學。

### 5.5 VDOM 與 Vapor Interop

既有 VDOM App 如果需要使用 Vapor component，可以安裝 `vaporInteropPlugin`：

```js
import { createApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'

createApp(App)
  .use(vaporInteropPlugin)
  .mount('#app')
```

這是獨立概念範例，不是本專案目前的啟動方式。

Interop 讓漸進採用成為可能，但需要注意：

- 會把 VDOM runtime 帶進 application，抵銷純 Vapor App 的部分 baseline bundle 優勢。
- Props、events 與 slots 雖然有互通能力，第三方 component 與 edge cases 仍需要驗證。
- Render function 或 JSX component 仍然是 VDOM component。

## 6. 優點、限制與適用情境

### 6.1 Vapor 可能降低哪些成本？

Vapor 的潛在優勢主要來自：

- 減少更新時建立 VNode object。
- 減少通用 VDOM diff 與 patch 工作。
- 將 reactive dependency 對應到更細粒度的 DOM 更新。
- 降低部分記憶體配置與 Garbage Collection 壓力。
- 純 Vapor App 可以避免載入 VDOM runtime，降低 baseline bundle。

這些是架構上的潛在優勢，不等於所有頁面都會得到固定比例的改善。

### 6.2 哪些成本不會因為 Vapor 消失？

- 真實 DOM 的建立、更新、移動與刪除。
- CSS style calculation。
- Layout 與 reflow。
- Paint 與 composite。
- Application 本身的資料轉換和商業邏輯。
- 網路、圖片、字型與其他資源成本。

如果應用程式真正的瓶頸來自網路或複雜 CSS layout，更換 rendering strategy 不一定是最高收益的改善方向。

### 6.3 Vue 3.6 RC 的重要限制

Vapor 支援的是 Vue API 子集合。Vue 3.6 RC 官方列出的重要差異包含：

- Vapor component 不支援 Options API。
- 不支援 `app.config.globalProperties`。
- `getCurrentInstance()` 在 Vapor component 中回傳 `null`。
- 不支援每個 element 的 `@vue:xxx` lifecycle events。
- 不支援 `v-memo`。
- Component template ref 不會暴露完整的 `$el`、`$props`、`$attrs`、`$slots` 和 `$refs` 等 properties。

大量使用 render function 或 JSX 的 component 仍然屬於 VDOM 路徑。依賴傳統 component public instance 的 library 或 composable 也必須特別檢查。

### 6.4 適合優先評估的情況

- 邊界清楚、效能敏感的頁面或 component 區域。
- 以 Composition API 和 template 為主的程式碼。
- 依賴可控制的小型新 application。
- 團隊可以建立相容性、行為和實際產品效能驗證。

### 6.5 建議暫緩或先做盤點的情況

- Options API 使用比例很高。
- 大量使用 render function 或 JSX。
- 深度依賴 component public instance。
- 大量使用尚未驗證的 VDOM UI component library。
- SSR、hydration、transition、slot 或 custom directive 路徑非常複雜。
- 團隊尚未建立回退邊界與 regression tests。

採用 Vapor 不應只是搜尋並替換兩行程式。比較安全的策略是先盤點 API 和 dependencies，選擇明確邊界進行驗證，再決定是否擴大使用範圍。

## 7. 結論

Vapor Mode 最重要的改變不在 template 外觀，而在 **compiler output 與 rendering runtime**。

傳統 Vue 將 template 編譯成建立 VNode 的 render function，利用 compiler 提供的最佳化資訊進行 reconciliation 與 DOM patch。這套模式成熟、通用，並支撐完整的 Vue ecosystem。

Vapor 則把更多資訊放到編譯階段，產生更直接的 DOM 建立與 reactive update 程式。它可能減少 VNode allocation、通用 diff 與 baseline runtime 成本，但仍然需要 Vue runtime，也無法消除真實 DOM 和瀏覽器 rendering 成本。

因此，VDOM 與 Vapor 比較適合被理解成兩種不同的 trade-off：

| 傳統 VDOM | Vapor |
|---|---|
| 通用、成熟、完整 ecosystem | 更直接、細粒度、compiler-driven |
| 適合高度動態與既有 Vue 生態 | 適合 template 可分析、依賴可控制的區域 |
| 使用 VNode abstraction | 避開主要 VNode rendering 中介 |

Vapor 不是要求所有 Vue 專案立即拋棄 Virtual DOM，而是讓 Vue 開始同時提供不同 rendering strategy。團隊可以根據 component 特性、API 相容性、第三方套件與真實 application 情況選擇合適路徑。

本文以 Vue `3.6.0-rc.5` 為背景。RC 版本與正式版之間仍可能調整；導入前應重新核對當時版本的官方文件與相容性資訊。

## 參考資料

- [Vue Core Releases：Vue 3.6 RC 與 Vapor Mode 說明](https://github.com/vuejs/core/releases)
- [Vue Core Repository](https://github.com/vuejs/core)
- [本專案 VDOM SFC](./src/vdom/App.vue)
- [本專案 Vapor SFC](./src/vapor/App.vue)
