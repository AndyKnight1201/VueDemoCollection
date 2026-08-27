# ⚡ Vue 3.6 Vapor Mode：從 Virtual DOM 走向更直接的 DOM 更新

Vue 3 長期以 **Virtual DOM（VDOM）+ Compiler Optimization** 作為主要渲染架構，而 Vue 3.6 帶來的 **Vapor Mode**，則提供了一條不同的路線：

> 將 Vue Template 在編譯階段轉換成更直接、更細粒度的 DOM 更新程式碼，降低 Virtual DOM Runtime、VNode 建立與 Diff 過程帶來的成本。

Vapor Mode 並不是要立即取代傳統 Vue，而是 Vue 提供的一種全新、**100% Opt-in** 的編譯模式。開發者可以依照頁面與元件需求，選擇傳統 VDOM 或 Vapor。官方目前也支援兩者透過 Interop 共存。

---

# 📌 1. Vapor Mode 是什麼？

**Vapor Mode** 是 Vue 3.6 提供的新型 SFC 編譯模式。

傳統 Vue 元件大致會經過：

```text
Template
   ↓
Render Function
   ↓
VNode
   ↓
Virtual DOM
   ↓
Diff / Patch
   ↓
Real DOM
```

Vapor Mode 的方向則更接近：

```text
Template
   ↓
Compiler
   ↓
DOM 建立指令
+
Reactive Update Binding
   ↓
Real DOM
```

也就是說：

**不需要每次資料更新都重新產生一棵 Virtual DOM Tree，再透過 Diff 找出改變的節點。**

Vapor Compiler 在編譯階段就能知道：

- 哪些 DOM 是靜態的
- 哪些文字會改變
- 哪些 attribute 會改變
- 哪些 class / style 是 reactive
- 哪些事件需要綁定
- 哪些區塊受到 `v-if` 控制
- 哪些節點由 `v-for` 建立

因此 Runtime 可以更直接地更新真正需要變動的 DOM。

Vue 官方將 Vapor Mode 定義為新的 SFC compilation mode，主要目標就是**降低基礎 Bundle Size 並提升執行效能**。

---

# 🧠 2. 傳統 Vue VDOM 如何運作？

假設有一個非常簡單的 Vue 元件：

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button @click="count++">
    Count: {{ count }}
  </button>
</template>
```

當：

```js
count.value++
```

發生時，VDOM 模式可以概念化成：

```text
Reactive State Changed
        ↓
Render Function
        ↓
Create New VNode
        ↓
Old VNode vs New VNode
        ↓
Diff
        ↓
Patch DOM
```

Vue 3 的 Compiler 已經做了很多最佳化，例如：

- Static Hoisting
- Patch Flags
- Block Tree
- Tree Flattening
- Compile-time Optimization

所以 Vue 3 的 VDOM 並不是「每次都暴力比較整棵 DOM」。

但本質上仍然存在：

```text
VNode 建立
+
Virtual DOM Runtime
+
Diff / Patch
```

這套抽象層。

---

# 🌫️ 3. Vapor 最大改變：不再依賴 VNode Diff

Vapor 最大的架構差異，可以濃縮成一句話：

> **Compiler 已經知道哪裡會改變，就不需要 Runtime 再猜一次。**

例如：

```vue
<h1>{{ title }}</h1>
```

VDOM 思維大致是：

```text
title changed
     ↓
create new VNode
     ↓
compare old/new VNode
     ↓
find text changed
     ↓
update textContent
```

Vapor 則更接近：

```text
title changed
     ↓
update target text node
```

也就是：

```js
textNode.textContent = title
```

這類更直接的更新模型。

這種方式與 Solid、Svelte 5 等偏向 Compiler / Fine-grained Rendering 的架構理念更加接近。Vue 官方也指出，Vapor Mode 在第三方 benchmark 中已展示與 Solid、Svelte 5 類似等級的效能。

---

# ⚙️ 4. Vapor 的 Fine-grained Update

假設畫面中存在：

```vue
<template>
  <section>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <span>{{ count }}</span>
  </section>
</template>
```

資料：

```js
const title = ref('Vue Vapor')
const description = ref('Next Rendering Mode')
const count = ref(0)
```

如果只有：

```js
count.value++
```

發生變化。

## 🟢 Vapor

概念上可以直接鎖定：

```text
count
  ↓
<span>
  ↓
Text Node
```

因此只更新：

```html
<span>1</span>
```

不需要重新處理：

```html
<h1>
<p>
<section>
```

---

## 🔵 VDOM

VDOM 則仍需要經過 Render / VNode / Patch 的抽象流程：

```text
Reactive Trigger
      ↓
Component Render
      ↓
VNode
      ↓
Patch
      ↓
DOM
```

即使 Vue Compiler 已經使用 Patch Flag 等機制大幅縮小比較範圍，VNode Runtime 仍然存在。

---

# 🚀 5. Vapor 的核心優勢

## ⚡ 5.1 降低 Runtime 工作量

VDOM 更新需要處理：

```text
Render
→ VNode
→ Diff
→ Patch
```

Vapor 更接近：

```text
Reactive Dependency
→ DOM Update
```

因此可以減少 Runtime CPU 工作。

---

## 📦 5.2 更小的 Bundle Size

Pure Vapor App 可以直接：

```js
import { createVaporApp } from 'vue'
import App from './App.vue'

createVaporApp(App).mount('#app')
```

這種模式不需要將完整 Virtual DOM Runtime 帶入應用程式，因此可以明顯降低基礎 Runtime Bundle Size。

這對以下場景特別有價值：

- Landing Page
- Embedded Widget
- Micro Frontend
- Mobile Web
- WebView
- 高度要求 Initial Load Performance 的網站

---

# 🧩 6. Vapor 如何啟用？

Vue 3.6 採用 **Opt-in** 模式。

也就是說：

```vue
<script setup>
```

仍然是一般 VDOM 元件。

若改成：

```vue
<script setup vapor>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button @click="count++">
    {{ count }}
  </button>
</template>
```

則這個 SFC 會使用 Vapor Compilation。

也可以使用縮寫：

```vue
<script vapor>
import { ref } from 'vue'

const count = ref(0)
</script>
```

或將標記放在 Template：

```vue
<template vapor>
  <div>{{ message }}</div>
</template>
```

---

# 🏗️ 7. Pure Vapor App

如果整個 Application 都使用 Vapor，可以建立：

```js
import { createVaporApp } from 'vue'
import App from './App.vue'

createVaporApp(App).mount('#app')
```

架構變成：

```text
          Vue Application
                 │
                 ▼
         createVaporApp()
                 │
                 ▼
        Vapor Components
                 │
                 ▼
          DOM Operations
```

最大的特色是：

```text
No VDOM Runtime
```

因此可以真正取得 Vapor 在 Runtime Size 上的優勢。

---

# 🔌 8. Vapor 與一般 Vue 可以共存

Vue 並沒有要求：

> 使用 Vapor 就必須整個專案全部重寫。

Vue 3.6 提供：

```js
vaporInteropPlugin
```

例如原本是：

```js
import { createApp } from 'vue'

createApp(App).mount('#app')
```

可以加入：

```js
import {
  createApp,
  vaporInteropPlugin
} from 'vue'

createApp(App)
  .use(vaporInteropPlugin)
  .mount('#app')
```

接著：

```text
VDOM App
│
├── VDOM Component
│
├── VDOM Component
│
└── Vapor Component
```

便可以逐步導入 Vapor。

例如：

```text
App.vue
│
├── Header.vue            VDOM
├── Sidebar.vue           VDOM
├── Dashboard.vue         Vapor
│   ├── Chart.vue         Vapor
│   └── DataGrid.vue      Vapor
└── Footer.vue            VDOM
```

這對大型既有專案相當重要。

---

# ⚠️ 9. Interop 並不是完全沒有成本

假設建立：

```text
Pure Vapor App
```

但是又大量使用：

```text
VDOM Component Library
```

例如部分依賴 VNode 行為的第三方 UI Library，就可能需要載入：

```text
Vapor Runtime
+
VDOM Runtime
```

如此一來：

```text
Bundle Size 優勢
```

就會被部分抵銷。

Vue 官方目前也建議：

> Vapor 與 VDOM 最好形成相對清楚的區域，而不是大量彼此交錯巢狀使用。

Interop 已支援一般 props、events、slots 等使用方式，但仍可能存在 Edge Cases。

---

# 🆚 10. Vapor vs 傳統 Virtual DOM

| 比較項目 | 🔵 Vue VDOM | ⚡ Vue Vapor |
|---|---|---|
| 渲染架構 | Virtual DOM | Direct / Fine-grained DOM Update |
| VNode | ✅ 使用 | ❌ Pure Vapor 不依賴 |
| Diff | ✅ 需要 | ❌ 不使用一般 VDOM Diff |
| DOM 更新 | Patch VNode 差異 | Compiler 產生直接更新邏輯 |
| Runtime 成本 | 較高 | 較低 |
| 基礎 Bundle | 較大 | 可更小 |
| Compiler 重要性 | 高 | 非常高 |
| Fine-grained Update | 部分 Compiler Optimization | ✅ 核心設計 |
| JSX / Render Function | ✅ 成熟 | ⚠️ 一般 JSX / Render Function 仍屬 VDOM |
| Options API | ✅ | ❌ |
| Composition API | ✅ | ✅ 支援子集 |
| 第三方 Library 相容性 | ✅ 最完整 | ⚠️ 視 Library 而定 |
| 生態成熟度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 適合大型既有系統 | ✅ | ⚠️ 建議漸進導入 |
| 適合效能敏感頁面 | ✅ | ⭐⭐⭐⭐⭐ |

---

# 📊 11. 兩種 Rendering Pipeline 的差異

## 🔵 Virtual DOM

```text
┌──────────────┐
│ Reactive Data│
└──────┬───────┘
       ↓
┌──────────────┐
│ Render       │
└──────┬───────┘
       ↓
┌──────────────┐
│ New VNode    │
└──────┬───────┘
       ↓
┌──────────────┐
│ VDOM Diff    │
└──────┬───────┘
       ↓
┌──────────────┐
│ DOM Patch    │
└──────────────┘
```

---

## ⚡ Vapor

```text
┌──────────────┐
│ Reactive Data│
└──────┬───────┘
       ↓
┌──────────────────┐
│ Reactive Binding │
└──────┬───────────┘
       ↓
┌──────────────────┐
│ Target DOM Update│
└──────────────────┘
```

最大的差別就是中間少了：

```text
VNode Creation
+
VDOM Diff
```

這層抽象。

---

# 💾 12. Vapor 為什麼能降低記憶體使用？

VDOM 通常需要維護：

```text
VNode Object
VNode Tree
Component VNode
Props
Children
Patch Metadata
```

概念上可能存在：

```js
{
  type: 'div',
  props: {},
  children: [],
  patchFlag: 1
}
```

大量 Component / Element 就會產生大量 VNode。

Vapor 的目標則是讓 Compiler 直接建立 DOM 操作與 Reactive Binding：

```text
Reactive State
      │
      ▼
DOM Node
```

降低中間 VNode Representation 所需要的 Runtime Allocation。

另外 Vue 3.6 本身也重構了 `@vue/reactivity`，採用了基於 alien-signals 的新實作，官方指出這次改動同樣改善了 reactivity 的效能與記憶體使用。

因此 Vue 3.6 的效能提升其實可以看成兩層：

```text
Vue 3.6
│
├── 🧠 Reactivity Optimization
│
└── ⚡ Vapor Rendering
```

---

# 🎯 13. Vapor 特別適合哪些場景？

## 📈 大量 Reactive UI

例如：

```text
Dashboard
Trading UI
Monitoring System
Analytics
Realtime Console
```

如果畫面中：

```text
1000 個資料
只有 3 個資料發生變化
```

Fine-grained Update 就具有很高價值。

---

## 📋 Large List

例如：

```vue
<tr
  v-for="item in items"
  :key="item.id"
>
```

大量 Row 不斷更新時：

```text
VNode Allocation
Diff
Patch
GC
```

的成本容易累積。

Vapor 的直接更新策略就是為降低這類 Runtime Overhead 而設計。

---

## 📱 Mobile / Embedded

例如：

```text
Mobile Web
Hybrid App
WebView
Embedded Widget
```

通常更在意：

```text
JS Bundle
Memory
CPU
Startup Time
```

因此 Vapor 的：

```text
Smaller Runtime
+
Less Allocation
+
Fine-grained Update
```

會更有吸引力。

---

# ⚠️ 14. Vapor 目前的限制

Vapor 並不是：

```text
Vue VDOM - Virtual DOM
```

這麼簡單。

為了取得更高效的 Runtime，一部分高度依賴 VNode 或 Component Instance 的 API 並不適用。

Vue 3.6 RC 官方列出的限制包含：

### ❌ Options API

不支援：

```js
export default {
  data() {},
  methods: {},
  computed: {}
}
```

Vapor 主要面向：

```vue
<script setup vapor>
```

---

### ❌ `getCurrentInstance()`

在 Vapor Component 中：

```js
getCurrentInstance()
```

會回傳：

```js
null
```

因此高度依賴 Vue Internal Instance 的 Library 必須特別注意。

---

### ❌ `v-memo`

目前不適用。

原因也很好理解：

```text
VDOM：
需要告訴 Renderer「這塊不用 Diff」

Vapor：
本身就不是以一般 VDOM Diff 為核心
```

---

### ⚠️ Component Template Ref

傳統 Component Ref 常見：

```js
componentRef.value.$el
componentRef.value.$props
componentRef.value.$attrs
componentRef.value.$slots
componentRef.value.$refs
```

Vapor Component 並不提供完整相同行為。

---

# 🧰 15. 對第三方元件庫的影響

這是實務導入 Vapor 時非常重要的一點。

如果第三方 Library 使用：

```js
h()
```

或：

```jsx
<MyComponent />
```

或高度依賴：

```js
getCurrentInstance()
vnode
component.proxy
$el
$slots
```

它通常仍然屬於：

```text
VDOM World
```

因此如果你的 Vue 系統大量依賴：

```text
UI Framework
Chart Library Wrapper
Table Library
Dynamic Renderer
Form Builder
Page Builder
```

就不能只看 Vapor Benchmark 決定是否全面切換。

必須先確認：

```text
Library
   ↓
是否依賴 VNode？
   ↓
是否依賴 Component Instance？
   ↓
是否支援 Vapor？
   ↓
是否必須使用 Interop？
```

---

# 🏛️ 16. 建議的大型專案導入方式

目前較合理的策略不是：

```text
Vue VDOM App
     ↓
全部 Rewrite
     ↓
Vapor App
```

而是：

```text
Vue VDOM Application
        │
        ├── Existing Components
        │
        ├── Existing UI Library
        │
        └── Performance Sensitive Area
                    │
                    ▼
                 Vapor
```

例如：

```text
ERP System
│
├── Login                VDOM
├── Settings             VDOM
├── User Management      VDOM
│
└── Realtime Dashboard   ⚡ Vapor
```

等 Vapor 與相關生態更加成熟後，再逐步擴大範圍。

這也符合 Vue 3.6 RC 階段官方目前給出的方向：既有 App 可以優先在 **performance-sensitive page** 局部採用 Vapor；全 Vapor 則較適合較小型的新專案。

---

# 🔍 17. VDOM 並沒有因此變成「過時技術」

看到 Vapor 很容易產生一個誤解：

```text
Vapor 快
↓
VDOM 慢
↓
VDOM 應該淘汰
```

實際上並不是如此。

VDOM 最大優點仍然是：

```text
高度動態
+
高度抽象
+
Render Function
+
JSX
+
成熟 Library Ecosystem
```

例如：

```jsx
return condition
  ? h(ComponentA)
  : h(ComponentB)
```

這類高度程式化的 UI 描述方式，VDOM 仍具有很強的彈性。

因此真正的差異比較接近：

```text
VDOM
=
Runtime Flexibility

Vapor
=
Compile-time Optimization
```

兩者交換的是：

```text
Flexibility
↔
Runtime Performance
```

---

# 🧭 18. Vue 未來可能形成的雙渲染模式

Vue 的架構可以逐漸理解成：

```text
                     Vue
                      │
              ┌───────┴───────┐
              │               │
              ▼               ▼
         🔵 VDOM Mode      ⚡ Vapor Mode
              │               │
              ▼               ▼
       Dynamic Runtime   Compiler Driven
              │               │
              ▼               ▼
       Flexible UI      Fine-grained DOM
```

這代表 Vue 開發者未來不一定需要在：

```text
Vue
vs
Solid
vs
Svelte
```

之間做完全二選一。

Vue 本身正在提供：

```text
VDOM Rendering
+
Fine-grained Rendering
```

兩種模式。

---

# ✅ 19. Vapor vs VDOM：如何選擇？

## 🔵 選擇傳統 VDOM

如果你的專案：

- 大量使用現有 Vue Component Library
- 大量使用 JSX / Render Function
- 有高度 Dynamic Component
- 需要完整 Vue API
- 是大型成熟 Production System
- Stability 比極致效能更重要

目前優先選擇：

```text
Vue VDOM
```

---

## ⚡ 考慮 Vapor

如果你的系統：

- 大量 Reactive Data
- 高頻率 UI 更新
- 大型 Dashboard
- Data Grid
- Real-time UI
- 對 Bundle Size 非常敏感
- 希望降低 Runtime CPU / Memory
- 元件主要採用 `<script setup>`
- 第三方 VDOM Dependency 較少

則：

```text
Vapor
```

值得開始評估。

---

# 🚦 20. 現階段 Production 建議

截至 **2026 年 8 月 25 日**，可以確認 Vue 已發布：

```text
Vue 3.6.0-rc.3
```

而 GitHub Release 仍標示為：

```text
Pre-release
```

並非 Vue 3.6 Stable。

因此目前建議採用：

```text
Production Core
      │
      └── VDOM
```

搭配：

```text
Experimental / Performance Area
      │
      └── Vapor
```

也就是：

```text
不要因為 Benchmark
直接全面 Rewrite

而是：

Profile
   ↓
Find Bottleneck
   ↓
Select Component
   ↓
Try Vapor
   ↓
Benchmark
   ↓
Gradual Adoption
```

---

# 🏁 21. 總結

Vue 3.6 Vapor 最大的意義並不只是：

> 「Vue 又變快了。」

真正重要的是 Vue 的 Rendering Architecture 開始多了一個新的選項。

傳統 Vue：

```text
Reactive
   ↓
Render
   ↓
VNode
   ↓
Diff
   ↓
DOM
```

Vapor：

```text
Reactive
   ↓
Fine-grained Binding
   ↓
DOM
```

因此 Vapor 的核心價值可以整理成五點：

### ⚡ 更直接的更新

減少 VNode 與 Diff 所需要的 Runtime 工作。

### 📦 更小的 Runtime

Pure Vapor App 可以不載入 VDOM Runtime。

### 🧠 Fine-grained Reactivity

資料變動可以更精準地影響對應 DOM。

### 🔌 漸進式導入

可以透過 `vaporInteropPlugin` 與傳統 Vue Component 共存。

### 🧩 保留 Vue 開發體驗

開發者依然可以使用熟悉的：

```vue
<template>
<script setup>
ref()
computed()
watch()
defineProps()
defineEmits()
```

這也正是 Vapor 最值得關注的地方：

> **Vue 並沒有要求開發者放棄 Vue 的 Template 與 Composition API，而是在 Compiler 層改變 UI 最終被執行與更新的方式。**

對既有 Vue 開發者而言，Vapor 不只是一次 Rendering Optimization，而是 Vue 從傳統 Virtual DOM 架構，進一步延伸到 **Compiler-driven、Fine-grained Rendering** 的重要演進。