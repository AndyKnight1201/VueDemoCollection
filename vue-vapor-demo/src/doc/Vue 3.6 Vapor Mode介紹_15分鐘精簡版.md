# ⚡ Vue 3.6 Vapor Mode：15 分鐘理解它解決什麼問題

- 對象：第一次接觸 Vapor Mode 的 Vue 工程師
- 建議講述時間：約 15～18 分鐘
- 版本背景：核心概念以 Vue 3.6 Vapor Mode 為主；相容性與限制以本專案使用的 `3.6.0-rc.5` 為準。

---

## 1. 為什麼會有 Vapor（約 1 分鐘）

Vue 長期使用 Virtual DOM（VDOM）作為主要渲染架構。資料改變時，Vue 會重新執行受影響元件的 Render Function，產生新的 VNode 結果，再由 Renderer 比較新舊 VNode 並更新真正需要改變的 DOM。

這套架構成熟、彈性高，也支援 Render Function、JSX 與大量既有元件庫。Vue 3 的 Compiler 還會透過 Static Hoisting、Patch Flags、Block Tree 等方式縮小更新範圍，所以 VDOM 並不是每次暴力比較整個 App。

不過，即使經過最佳化，VDOM 更新路徑仍保留「元件 Render、VNode 建立與 Patch」這層中間表示。Vapor Mode 想做的是：在編譯階段建立更直接的資料與 DOM 更新關係，讓簡單的動態綁定不必經過一般 VNode Patch 流程。

一句話定義：

> **Vapor 是 Vue 新增的、100% opt-in 的 SFC compilation mode；它把 Template 編譯成 DOM／Block 建立程式與細粒度更新邏輯，目標是降低 baseline bundle 與 Runtime 工作量。**

---

## 2. Compiler、Runtime 與 SFC Compilation Mode（約 2 分鐘）

SFC 是 Single-File Component，也就是平常使用的 `.vue` 檔案。瀏覽器不能直接執行 `.vue`，因此在 `npm run build` 或開發伺服器轉換時，Vue Compiler 會把 Template 編譯成 JavaScript。

- **Compile Time（編譯階段）**：開發與打包時分析 Template，產生瀏覽器可以執行的程式。
- **Runtime（執行階段）**：使用者開啟網站後，瀏覽器執行 Vue App、追蹤 reactive dependency、建立元件並更新 DOM 的期間。
- **SFC Compilation Mode**：Compiler 選擇要把同一種 `.vue` 語法編譯成哪一類渲染程式。

普通 SFC 預設走既有 VDOM-based compilation，產生以 VNode 為結果的 Render Function；加入 `vapor` 標記後，則改走 Vapor compilation，產生 DOM／Block 建立程式及 Reactive Update Effect。這是在 Compile Time 決定，不是網頁執行後才切換。

兩種 Compiler 都能從 Template 看出靜態內容與動態表達式。例如：

```vue
<section class="card">
  <h1>{{ title }}</h1>
  <p>{{ description }}</p>
</section>
```

Compiler 知道 `class="card"` 是靜態內容，也知道 `title` 與 `description` 是可能改變的 expression。但 Compiler 不會預知它們何時、如何改變：Compiler 負責建立更新路線；Runtime Reactivity 負責在程式執行時追蹤 dependency，並在值改變後觸發更新。

---

## 3. VDOM 實際如何更新（約 2 分鐘）

在 VDOM 模式中，Template 會被編譯成元件的 Render Function。這個 Function 不是直接繪製瀏覽器畫面，而是回傳描述畫面結構的 VNode。

以前面的元件為例，如果 `title` 在該元件的 render 中被讀取，`title` 改變後會觸發該元件更新：Vue 重新執行該元件的 Render Function、取得新的 VNode 結果，再以新舊 VNode 執行 Patch，最後才呼叫瀏覽器 DOM API。

「受影響元件」很重要：如果是 Child 自己的 state 改變，通常只會重新 render Child，不會因此重新 render 沒有受到影響的 Parent 或兄弟元件。即使在 Child 內，靜態 VNode 也可以被重用，Runtime 會盡量只處理 Compiler 標記的動態部分。

Vue 3 常見的 VDOM Compiler 最佳化可以簡化成：

| 名稱 | 白話意思 |
|---|---|
| Static Hoisting | 靜態內容只建立一次，之後重複使用 |
| Patch Flags | 在 VNode 上標記文字、class、style 或 props 哪一部分可能改變 |
| Block Tree | 為區塊保存動態節點名單，更新時跳過不相關的靜態節點 |
| Tree Flattening | 將藏在多層結構中的動態節點整理成較扁平的更新清單 |
| Compile-time Optimization | Compiler 在執行前完成上述分析，減少 Runtime 工作 |

因此，VDOM 的特點不是「不知道哪裡會變」，而是它仍以 VNode 作為畫面描述，Runtime 再利用編譯資訊快速 Patch。

---

## 4. Vapor 和 VDOM 真正差在哪裡（約 3 分鐘）

兩邊的 Compiler 都看得懂動態位置，真正差別是「編譯結果」與「資料更新後重新執行什麼」。

```text
VDOM                                  Vapor
Reactive dependency 改變             Reactive dependency 改變
        ↓                                      ↓
重新執行受影響元件 Render             執行相關 Binding Effect
        ↓                                      ↓
產生新的動態 VNode                    計算新的 binding 值
        ↓                                      ↓
Patch 新舊 VNode                      更新指定 DOM／Block
        ↓
更新指定 DOM
```

VDOM Compiler 的輸出可以概念化為：

```js
// 概念化虛擬碼，不是 Vue Compiler 的實際完整輸出
function render() {
  return createVNode('section', null, [
    createVNode('h1', null, title.value),
    createVNode('p', null, description.value)
  ])
}
```

Vapor Compiler 仍有初始 render／mount 階段，但主要工作是建立或複製 DOM、取得 Node reference，並註冊更新邏輯：

```js
// 概念化虛擬碼，不是 Vue Compiler 的實際完整輸出
const titleText = getTitleTextNode()

renderEffect(() => {
  titleText.nodeValue = String(title.value)
})
```

這裡的 **Binding Effect** 是概念名稱，代表某個動態 expression 對應的 reactive 更新程式；實際 Compiler 可以合併操作，不保證永遠是一個變數配一個 Effect。當 `title` 改變時，簡單文字 binding 可以只重新計算 `title` 並更新既有 Text Node，不必重新執行整個元件 Render Function。

兩邊最後都會呼叫像 `nodeValue`、`textContent`、`setAttribute` 之類的 DOM API。差別在最後一步之前：VDOM 先產生新的 UI 描述並透過 Patch 決定操作；Vapor 已在編譯時建立 binding 與目標 DOM 的關係，因此可以執行更直接的更新程式。

| 比較項目 | VDOM | Vapor |
|---|---|---|
| Compiler 能否辨識動態位置 | 可以 | 可以 |
| 主要編譯輸出 | Render Function、VNode、最佳化標記 | DOM／Block 建立程式、Reactive Update Effect |
| 簡單資料更新入口 | 元件 Render Effect | 對應的 Binding Effect |
| DOM 更新前 | 產生新 VNode並執行 Patch | 計算 binding 新值並執行指定操作 |
| 一般 JSX／Render Function | 原生支援 | 仍屬 VDOM，需視 App 使用 Interop |

`v-if`、`v-for`、Component、Slot、Transition 等不是單純設定文字，Vapor 仍需要 Block、列表更新、元件生命週期與 Cleanup 邏輯。「直接更新」不代表所有操作都是一行 DOM assignment；Vapor 依然需要自己的 Runtime，只是不走一般 VNode Patch 流程。

---

## 5. 如何啟用 Vapor（約 2 分鐘）

Vapor 是 100% opt-in。沒有 `vapor` 標記的 SFC 仍使用一般 VDOM compilation：

```vue
<script setup vapor>
import { ref } from 'vue'

const title = ref('Vue Vapor')
const description = ref('Fine-grained DOM update')
</script>

<template>
  <section class="card">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </section>
</template>
```

也可以使用 `<script vapor>` 作為 `<script setup vapor>` 的縮寫，或在 template-only SFC 使用 `<template vapor>`。

如果整個 App 與相依 render path 都是 Vapor，可以使用：

```js
import { createVaporApp } from 'vue'
import App from './App.vue'

createVaporApp(App).mount('#app')
```

Pure Vapor App 在沒有 VDOM 元件、JSX、Render Function 或其他 VDOM dependency 時，可以避免載入一般 VDOM Runtime，取得較明顯的 baseline bundle 優勢。

既有 `createApp()` 專案若要局部使用 Vapor Component，需安裝 Interop Plugin：

```js
import { createApp, vaporInteropPlugin } from 'vue'

createApp(App)
  .use(vaporInteropPlugin)
  .mount('#app')
```

Interop 支援一般 props、events 與 slots，但仍可能存在 Edge Cases。官方建議讓 VDOM 與 Vapor 形成清楚區域，避免大量交錯巢狀。

---

## 6. 好處與適合場景（約 1.5 分鐘）

Vapor 的主要潛在收益有三類：

1. **減少 Runtime 中間工作**：簡單 binding 更新可以減少元件 Render、動態 VNode allocation 與一般 VDOM Patch。
2. **降低記憶體配置**：Pure Vapor path 不必為每次更新建立一般 VNode Tree，可能減少暫時物件與 Garbage Collection 壓力。
3. **降低 baseline bundle**：Pure Vapor App 不需要一般 VDOM Runtime；若加入 VDOM Interop，這項優勢會被部分抵銷。

特別值得評估的場景包括高頻更新 Dashboard、Trading／Monitoring UI、大量 Row 只有少數欄位局部改變，以及對起始 bundle 很敏感的小型 App 或 Embedded Widget。

這些是設計上的優勢，不是任何頁面都保證更快。大量插入、刪除或排序仍有列表與 DOM 成本；最終結果也會受到元件結構、瀏覽器、裝置、第三方套件及 Interop 影響，必須以真實 workload 做 Profile 與 Benchmark。

另外，Vue 3.6 的 alien-signals reactivity 重構是整體 Vue 的改進，不是 Vapor 專屬；不要把 Vue 3.6 的所有效能變化都歸因於 Vapor Rendering。

---

## 7. 限制與第三方套件（約 2 分鐘）

Vapor 支援的是 Vue API 的子集。以 Vue 3.6.0-rc.5 為準，重要差異包括：

| 項目 | Vapor 現況／注意事項 |
|---|---|
| Options API | 不支援，主要面向 template-only SFC 與 `<script setup>` |
| `app.config.globalProperties` | 不支援 |
| `getCurrentInstance()` | 在 Vapor Component 回傳 `null` |
| `@vue:xxx` element lifecycle event | 不支援；不要與 `onMounted()` 等 Component hook 混淆 |
| `v-memo` | 不適用 |
| Component template ref | 不提供 `$el`、`$props`、`$attrs`、`$slots`、`$refs` 等相同行為 |
| `slots.default()` | 不是無副作用的內容檢查，呼叫時會執行 slot rendering logic |
| Custom directive | 使用不同介面；value 是 reactive getter，並可回傳 cleanup function |

一般 DOM event 在 rc.5 預設直接綁定元素；若要對支援的靜態事件使用 document-level delegation，可以寫 `@click.delegate`。從 rc.2 起事件委派改為 opt-in，舊的 `compilerOptions.eventDelegation` 已移除。

手寫 `h()`、一般 JSX／Render Function，以及依賴 VNode、Component Public Instance 的 Vue Wrapper 都仍屬 VDOM 世界。這不代表底層 Chart、Table 或 Canvas Library 一定不能使用；真正要檢查的是 Vue Wrapper 是否依賴 VDOM-specific API，以及是否需要 Interop。若 Vapor App 因此同時載入 Vapor 與 VDOM Runtime，bundle 優勢就會縮小。

---

## 8. 實務上如何選擇與導入（約 1.5 分鐘）

VDOM 沒有因 Vapor 出現而過時。它的優勢仍是成熟度、完整 API、生態相容性，以及 Render Function、JSX、Dynamic Renderer 等高度程式化 UI 的彈性。

大型既有系統不建議因 Benchmark 全面 Rewrite。較穩健的方式是保留既有 VDOM Core，先找出真正的效能瓶頸，再挑選邊界清楚、第三方依賴較少的 Dashboard、Data Grid 或即時更新區域評估 Vapor。小型新 App 如果能維持完整 Pure Vapor path，也適合驗證 bundle 與 Runtime 優勢。

截至 2026 年 8 月 27 日，本專案使用 `Vue 3.6.0-rc.5`；它已於 2026 年 8 月 21 日發布，但仍是 Pre-release，不是 Vue 3.6 Stable。既有 Production 系統應把 API 相容性、Interop Edge Cases、測試覆蓋與回退方式一併納入評估。

實務決策順序應是：先 Profile、確認瓶頸與 workload，再製作同等功能的 VDOM／Vapor 對照，最後比較 bundle、更新時間、記憶體與整合成本，而不是只看單一 Benchmark 數字。

---

## 9. 總結（約 0.5 分鐘）

第一，VDOM 與 Vapor 的 Compiler 都知道 Template 哪些位置是動態的；差別是 VDOM 產生 VNode-based Render Function，Vapor 產生更直接的 DOM／Block 建立與 Reactive Update 邏輯。

第二，VDOM 在資料改變後通常重新執行受影響元件 Render，再 Patch 新舊 VNode；Vapor 的簡單 binding 可以執行對應 Effect 並更新既有 DOM，但複雜結構仍需要 Runtime 管理。

第三，Vapor 是新增選項，不是要求放棄 VDOM。它適合在 bundle 或高頻局部更新可能成為瓶頸時，以清楚邊界、真實 Profile 與 Benchmark 漸進評估。

---

## 官方參考資料

- [Vue Core Releases](https://github.com/vuejs/core/releases)
- [Vue 3.6.0-rc.1：About Vapor Mode](https://github.com/vuejs/core/releases/tag/v3.6.0-rc.1)
- [Vue 3.6 Minor Changelog](https://github.com/vuejs/core/blob/minor/CHANGELOG.md)
