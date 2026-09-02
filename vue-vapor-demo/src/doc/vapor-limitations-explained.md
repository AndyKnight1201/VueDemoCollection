可以把這些限制理解成：**Vapor 換了一套更輕、更直接的渲染方式，所以以前那些「建立在 VDOM / Vue 元件實例上」的玩法，有些就不能照搬。**

### ❌ Options API

簡單講：

**不能再用傳統 Vue 2 / Vue 3 那種 `data`、`methods`、`computed` 寫法。**

以前可以：

```js id="nuqe8o"
export default {
  data() {},
  methods: {},
  computed: {}
}
```

Vapor 比較希望你用：

```vue id="5xl3sw"
<script setup vapor>
```

也就是 Composition API / `<script setup>`。

**影響：** 如果你的舊專案或套件大量使用 Options API，要改寫才能進 Vapor。

---

### ❌ `app.config.globalProperties`

簡單講：

**以前可以把東西掛到所有 Vue 元件的 `this` 上，Vapor 不吃這套。**

例如以前：

```js id="ekgkxx"
app.config.globalProperties.$api = api
```

然後：

```js id="8kyi0b"
this.$api
```

Vapor Component 沒有傳統那種完整的 `this` 元件實例，所以這種方式不能用。

改成：

```js id="yb5is8"
import { api } from './api'
```

或：

```js id="0reejr"
provide()
inject()
```

**影響：** 以前靠 `$axios`、`$api`、`$xxx` 全域注入的 plugin，需要調整。

---

### ❌ `@vue:xxx` Element Lifecycle Events

簡單講：

**不能監聽某一個 DOM 元素「被 Vue 掛上去 / 更新 / 移除」這類特殊事件。**

例如：

```vue id="35a1y3"
<div @vue:mounted="onMounted" />
```

這不是：

```js id="ihiipo"
onMounted()
```

兩個概念不一樣。

`onMounted()` 是：

> 整個 Component 掛載完成。

`@vue:mounted` 是：

> 這個特定 DOM element 掛載完成。

Vapor 不支援後者這種依賴 VDOM 的事件。

---

### ❌ `getCurrentInstance()`

簡單講：

**你不能再偷偷拿 Vue 元件內部物件出來操作。**

以前一些進階套件會：

```js id="aavh16"
const instance = getCurrentInstance()
```

然後去碰：

```js id="zjt6ku"
instance.proxy
instance.appContext
instance.vnode
```

之類的 Vue 內部資訊。

Vapor 裡：

```js id="e5tk89"
getCurrentInstance()
```

會拿到：

```js id="ghlf8v"
null
```

**影響最大的是 Library 作者。**

一般正常寫 Composition API 的人通常沒什麼感覺，但如果某個套件很依賴 Vue Internal Instance，就可能直接不能用。

---

### ❌ `v-memo`

簡單講：

**Vapor 不需要你告訴 Vue「這一塊先不要重新 Diff」。**

以前 VDOM 每次更新大概會做：

```text id="1wfxjk"
產生新 VNode
↓
跟舊 VNode 比較
↓
找出要改的地方
```

所以 `v-memo` 可以說：

> 如果這幾個值沒變，這一區連 Diff 都不用做。

但 Vapor 本來就不是走傳統整棵 VDOM Diff。

所以：

**原本用來最佳化 VDOM 的 `v-memo`，在 Vapor 沒什麼意義。**

---

### ⚠️ Component Template Ref

簡單講：

**`ref` 還能用，但不要期待拿到跟以前一模一樣的 Vue Component Instance。**

以前：

```js id="fl61fp"
const child = ref()

child.value.$el
child.value.$props
child.value.$attrs
child.value.$slots
child.value.$refs
```

很多人會把：

```js id="f4zpax"
child.value
```

當成整個 Vue Component 物件使用。

Vapor 不保證這些 `$xxx` 都存在。

所以不要再假設：

> 「我 ref 到子元件，就能把它內部所有 Vue 資訊挖出來。」

比較安全的是**明確 expose 你需要的東西**，而不是依賴完整 Component Public Instance。

---

### ⚠️ `slots.default()` 不是無副作用的 Dry Run

這個比較重要。

簡單講：

**不要把 `slots.default()` 當成「偷看一下 slot 有沒有內容」。**

例如你可能想這樣：

```js id="9w96yx"
const content = slots.default?.()

if (content) {
  // 有 slot
}
```

在一般直覺裡會覺得：

> 我只是呼叫它看看會回什麼，又沒有真的 render。

但 Vapor 不是這樣。

你一呼叫：

```js id="11uks8"
slots.default()
```

它可能真的開始：

```text id="0in0tu"
建立 DOM
建立 Block
建立 reactive effect
Hydration 對應 DOM
```

所以它比較像：

> 「執行這個 slot」

而不是：

> 「預覽這個 slot」。

因此最好直接：

```vue id="epp1or"
<slot />
```

讓 template / compiler 自己處理。

---

### ⚠️ Custom Directive 使用不同介面

簡單講：

**以前寫給 Vue VDOM 的 directive，不能保證直接搬到 Vapor 就能用。**

傳統 Vue directive 常寫：

```js id="05l3ps"
const directive = {
  mounted(el, binding, vnode) {},
  updated(el, binding, vnode) {},
  unmounted(el) {}
}
```

裡面可能會用：

```js id="xqxxnf"
binding.value
vnode
binding.instance
```

Vapor 的 directive API 比較直接。

例如：

```js id="56o1dw"
const highlight = (el, source) => {
  watchEffect(() => {
    el.dataset.active = String(source())
  })

  return () => {
    delete el.dataset.active
  }
}
```

可以理解成：

```text id="0h0mxp"
el
↓
真正的 DOM

source()
↓
取得目前 reactive value

return () => {}
↓
元件移除時做 cleanup
```

所以如果你的 directive 很單純，例如：

> 改 class、改 style、操作 DOM

通常比較容易改。

但如果 directive 很依賴：

> `VNode`、`binding`、Vue directive lifecycle

那就要重寫。

---

如果把全部限制濃縮成一句話：

> **Vapor 最大的相容性問題，不是 Vue 常用功能消失，而是「依賴 Vue Runtime 內部結構、VNode、Component Instance」的程式碼不能再假設原本那套東西存在。**

所以對一般 Vue App 開發者而言，真正要特別檢查的通常是：

| 功能 | 白話影響 |
|---|---|
| Options API | 舊寫法不能直接用 |
| globalProperties | `this.$xxx` 注入不能用 |
| `@vue:xxx` | DOM element 的 Vue lifecycle event 不能用 |
| `getCurrentInstance()` | 不能偷拿 Vue 內部 instance |
| `v-memo` | Vapor 不需要這種 VDOM 最佳化 |
| Component Ref | 不能把 ref 當完整 Vue instance |
| `slots.default()` | 呼叫 slot 可能真的執行渲染 |
| Custom Directive | 舊 VDOM directive 可能要改寫 |
