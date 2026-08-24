# 2026 前端技術會議 Demo 實作規格

> 本文件包含三個**完全獨立**的 Demo 專案。  
> 三個 Demo 不放在同一個 workspace、不共用 root `package.json`、不共用 Vite config，也不要求一起安裝或一起啟動。  
> 可將每一章單獨交給 Codex 實作成一個獨立 repository / folder。

---

# Demo 1：Vue 3.6 Vapor Mode Benchmark

## 1.1 目標

建立一個獨立的 Vue 3.6 Demo，展示：

> Vue 3.6 Vapor Mode 與傳統 Virtual DOM rendering，在相同資料量與相同 UI 更新操作下的差異。

此 Demo 的重點不是宣稱 Vapor 一定快多少，而是讓會議觀眾可以直接看到：

- 傳統 Vue VDOM
- Vue Vapor rendering
- 相同 workload
- 相同資料
- 多次測量結果
- avg / median / min / max

---

## 1.2 專案形式

這是一個完全獨立專案：

```text
vue-vapor-demo/
├─ package.json
├─ vite.config.js
├─ index.html
├─ vdom.html
├─ vapor.html
├─ README.md
└─ src/
   ├─ dashboard/
   │  ├─ main.js
   │  └─ Dashboard.vue
   ├─ vdom/
   │  ├─ main.js
   │  └─ App.vue
   ├─ vapor/
   │  ├─ main.js
   │  └─ App.vue
   └─ shared/
      ├─ benchmark.js
      ├─ data.js
      ├─ stats.js
      └─ protocol.js
```

不要使用 monorepo。

不要放 WebMCP Demo。

不要放 Chrome 148～151 Demo。

---

## 1.3 技術棧

```text
Node.js: 22+
Package manager: npm
Build tool: Vite
Framework: Vue 3.6 RC
Language: JavaScript
CSS: 原生 CSS
UI Library: 不使用
```

固定版本：

```json
{
  "vue": "3.6.0-rc.4",
  "@vue/compiler-sfc": "3.6.0-rc.4"
}
```

不要用：

```text
latest
next
*
```

避免後續 RC 改變 Demo 行為。

---

## 1.4 VDOM / Vapor 分離方式

不要在同一個 Vue root 中混著跑 benchmark。

使用三個 HTML entry：

```text
index.html
vdom.html
vapor.html
```

### index.html

Benchmark Controller。

畫面：

```text
┌──────────────────────────────────────────────────────────┐
│ Vue 3.6 Rendering Benchmark                              │
├──────────────────────────┬───────────────────────────────┤
│ VDOM                     │ Vapor                         │
│                          │                               │
│ 10,000 rows              │ 10,000 rows                   │
│                          │                               │
│ Avg: 22.6 ms             │ Avg: 12.1 ms                  │
│ Median: 21.9 ms          │ Median: 11.8 ms               │
│                          │                               │
└──────────────────────────┴───────────────────────────────┘
```

左右各嵌一個 iframe：

```text
vdom.html
vapor.html
```

Controller 使用：

```js
window.postMessage()
```

讓兩側收到相同 benchmark command。

---

## 1.5 VDOM App

使用：

```js
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
```

這邊不要使用 Vapor syntax。

---

## 1.6 Vapor App

使用：

```js
import { createVaporApp } from 'vue'
import App from './App.vue'

createVaporApp(App).mount('#app')
```

Component 使用：

```vue
<script setup vapor>
</script>
```

或 Vue 3.6 RC 實際支援的 Vapor SFC syntax。

若實際 RC API 有差異，以 Vue 3.6.0-rc.4 官方 API 為準，不要自行 invent。

---

## 1.7 Benchmark Data

所有資料必須 deterministic。

不要直接使用：

```js
Math.random()
```

造成左右兩邊 workload 不同。

建立 seeded PRNG：

```js
function mulberry32(seed) {
  // deterministic pseudo random generator
}
```

資料格式：

```js
{
  id: 1,
  name: 'User 00001',
  department: 'RD',
  unread: 3,
  score: 72,
  active: true
}
```

資料量可選：

```text
1,000
5,000
10,000
20,000
```

預設：

```text
10,000
```

---

## 1.8 Row UI

不要用 `<table>`。

避免 table layout 成本干擾 benchmark。

使用：

```html
<div class="row">
  <span>#00001</span>
  <span>User 00001</span>
  <span>RD</span>
  <span>Unread 3</span>
  <span>Score 72</span>
  <span>Active</span>
</div>
```

---

## 1.9 Benchmark 操作

至少實作：

### Initial Render

重新建立 N 筆資料並 render。

顯示：

```text
Initial Render
```

---

### Update 10%

例如 10,000 筆更新 1,000 筆。

改：

```text
score
unread
active
```

更新 index 必須 deterministic。

---

### Update All

更新全部 rows：

```js
row.score = (row.score + 7) % 100
row.unread = (row.unread + 1) % 10
row.active = !row.active
```

---

### Append 1,000

列表尾端新增 1,000 rows。

---

### Remove 1,000

從固定 deterministic index 開始刪除 1,000 rows。

---

### Shuffle

使用 deterministic Fisher-Yates shuffle。

此操作適合觀察 list reconciliation。

---

## 1.10 計時方式

使用：

```js
performance.now()
```

State mutation 後至少：

```js
await nextTick()
await new Promise(resolve => requestAnimationFrame(resolve))
```

範例：

```js
const start = performance.now()

mutateState()

await nextTick()
await new Promise(resolve => requestAnimationFrame(resolve))

const duration = performance.now() - start
```

README 必須註明：

> 此 Demo 是相對比較用途，不代表 Vue 官方 benchmark，也不代表所有 production workload。

---

## 1.11 測試次數

Controller 可設定：

```text
Warmup: 2
Measured Runs: 10
```

顯示：

```text
VDOM

avg      23.81 ms
median   22.90 ms
min      20.31 ms
max      31.22 ms
```

Vapor 同樣顯示。

不要只顯示單次結果。

---

## 1.12 postMessage Protocol

Controller：

```js
iframe.contentWindow.postMessage({
  type: 'RUN_BENCHMARK',
  action: 'update-10-percent',
  count: 10000,
  runs: 10,
  warmup: 2,
  seed: 2026
}, '*')
```

Child 回：

```js
window.parent.postMessage({
  type: 'BENCHMARK_RESULT',
  renderer: 'vdom',
  action: 'update-10-percent',
  values: [21.2, 22.3, 20.8]
}, '*')
```

Vapor：

```js
renderer: 'vapor'
```

---

## 1.13 Dashboard

至少包含：

```text
Vue Version
Renderer
Rows
Warmup Runs
Measured Runs
Seed
```

操作區：

```text
[Initial Render]
[Update 10%]
[Update All]
[Append 1000]
[Remove 1000]
[Shuffle]
[Reset]
```

結果區：

```text
VDOM
Vapor
Ratio
```

Ratio 用：

```text
Vapor elapsed / VDOM elapsed
```

不要 hard-code：

```text
Vapor 比 VDOM 快 50%
```

必須由實際數值算。

---

## 1.14 驗收條件

- [ ] Vue 固定 `3.6.0-rc.4`
- [ ] VDOM 使用 `createApp()`
- [ ] Vapor 使用 `createVaporApp()`
- [ ] Vapor SFC 使用實際支援的 Vapor syntax
- [ ] 同一 deterministic dataset
- [ ] 可切 1k / 5k / 10k / 20k
- [ ] 有 6 種 benchmark action
- [ ] 有 warmup
- [ ] 有多次 measured runs
- [ ] 顯示 avg / median / min / max
- [ ] 可 Reset
- [ ] 不 hard-code result
- [ ] build 成功
- [ ] Console 無 error

---

## 1.15 現場展示流程

1. 開啟 Dashboard。
2. 選 10,000 rows。
3. 跑 `Update 10%`。
4. 看 VDOM / Vapor 多次結果。
5. 跑 `Shuffle`。
6. 看差異。
7. 強調：
   - Vapor 是 opt-in。
   - Demo 是 relative comparison。
   - 不代表所有 Vue 畫面都會有相同比例提升。

---

## 1.16 可直接貼給 Codex 的 Prompt

```text
請建立一個獨立專案 vue-vapor-demo。

這個專案只做 Vue 3.6 Vapor Mode Benchmark，
不要加入 WebMCP，
不要加入 Chrome 新 API Demo，
不要做 monorepo。

要求：

1. 使用 npm + Vite + JavaScript。
2. vue 與 @vue/compiler-sfc 固定 3.6.0-rc.4。
3. 建立三個 entry：
   - index.html benchmark controller
   - vdom.html
   - vapor.html
4. VDOM 使用 createApp。
5. Vapor 使用 createVaporApp。
6. Vapor component 使用 Vue 3.6.0-rc.4 實際支援的 Vapor SFC syntax。
7. controller 透過 iframe + postMessage 同時控制兩側 benchmark。
8. dataset 必須 deterministic，使用固定 seed。
9. row count 支援：
   - 1000
   - 5000
   - 10000
   - 20000
10. 實作：
   - Initial Render
   - Update 10%
   - Update All
   - Append 1000
   - Remove 1000
   - Shuffle
11. benchmark 支援：
   - warmup 2
   - measured runs 10
   - avg
   - median
   - min
   - max
12. 不 hard-code benchmark result。
13. UI 適合 1280x720 投影。
14. 提供 Reset。
15. README 說明：
   - setup
   - commands
   - benchmark methodology
   - limitations
16. 完成後執行 npm install、npm run build，
    修正所有 build error 與明顯 runtime error。

不要只回覆計畫，直接建立完整可執行專案。
```

---

# Demo 2：WebMCP EIM Agent Demo

## 2.1 目標

建立一個獨立 Vue App，模擬 EIM / IM 系統。

展示：

> AI Agent 不需要靠 DOM 定位 input / button，而可以直接呼叫 Web App 對外公開的 structured tool。

核心比較：

```text
傳統操作：

使用者
→ 找聯絡人搜尋框
→ 輸入名字
→ 點搜尋
→ 點聯絡人
→ 輸入訊息
→ 點 Send
```

對比：

```text
AI Agent
→ search_contacts()
→ open_conversation()
→ send_message()
```

---

## 2.2 專案形式

完全獨立：

```text
webmcp-eim-demo/
├─ package.json
├─ vite.config.js
├─ index.html
├─ README.md
└─ src/
   ├─ App.vue
   ├─ main.js
   ├─ components/
   │  ├─ ContactList.vue
   │  ├─ ConversationPanel.vue
   │  ├─ ActivityLog.vue
   │  ├─ ToolStatus.vue
   │  └─ ManualToolRunner.vue
   ├─ composables/
   │  └─ useEimState.js
   ├─ data/
   │  ├─ contacts.js
   │  └─ messages.js
   └─ webmcp/
      └─ registerTools.js
```

不要使用 monorepo。

不要放 Vapor Benchmark。

不要放 Chrome Platform Demo。

---

## 2.3 技術棧

```text
Node.js: 22+
npm
Vite
Vue 3
JavaScript
原生 CSS
```

不要：

```text
Electron
Pinia
Vuex
Ant Design Vue
Backend
Database
公司 API
```

---

## 2.4 Browser Requirements

建議：

```text
Chrome 151+
```

WebMCP local test 要開：

```text
chrome://flags/#enable-webmcp-testing
```

設定：

```text
Enabled
```

然後 Relaunch Chrome。

使用：

```js
document.modelContext
```

不要使用：

```js
navigator.modelContext
```

---

## 2.5 Feature Detection

App 啟動時：

```js
const supported =
  'modelContext' in document &&
  typeof document.modelContext?.registerTool === 'function'
```

Supported：

```text
WebMCP: Supported
```

不支援：

```text
WebMCP: Not available

Please enable:
chrome://flags/#enable-webmcp-testing
```

不得 crash。

---

## 2.6 Mock Contacts

至少 20 筆。

格式：

```js
{
  id: 'u001',
  name: '王小明',
  englishName: 'Ming Wang',
  department: '產品研發處',
  title: 'Frontend Engineer',
  extension: '1234',
  email: 'ming.wang@example.local',
  status: 'online'
}
```

可以包含：

```text
王大明
陳小華
林志豪
張雅婷
李冠廷
黃子庭
```

全部 fake data。

不得使用真實員工資料。

---

## 2.7 UI

```text
┌───────────────────────────────────────────────────────────┐
│ WebMCP EIM Demo                         WebMCP: Supported │
├──────────────────┬────────────────────────────────────────┤
│ Contacts         │ Conversation                           │
│                  │                                        │
│ [搜尋________]   │ 王小明                                 │
│                  │ Frontend Engineer                      │
│ 王小明 Online    │                                        │
│ 王大明 Away      │ 10:30 Hello                            │
│ 陳小華 Online    │ 10:32 下午三點開會                     │
│                  │                                        │
│                  │ [message_____________] [Send]          │
├──────────────────┴────────────────────────────────────────┤
│ Registered Tools                                           │
│ ✓ search_contacts                                          │
│ ✓ open_conversation                                        │
│ ✓ send_message                                             │
├────────────────────────────────────────────────────────────┤
│ Activity Log                                               │
│ 10:31 search_contacts {"keyword":"王"}                     │
│ 10:32 open_conversation {"contactId":"u001"}               │
└────────────────────────────────────────────────────────────┘
```

---

## 2.8 State Architecture

Human UI 與 WebMCP Tool 必須共用同一層 application service。

架構：

```text
Human UI ───────┐
                ├── useEimState / service
WebMCP Tools ───┘
                        ↓
                  Vue reactive state
```

不要把 business logic 重複寫兩次。

---

## 2.9 Tool：search_contacts

名稱：

```text
search_contacts
```

用途：

```text
Search mock company contacts by Chinese name,
English name, department or title.
```

Schema：

```json
{
  "type": "object",
  "properties": {
    "keyword": {
      "type": "string",
      "description": "Name, department, title or search keyword"
    }
  },
  "required": ["keyword"]
}
```

執行後：

- filter contacts
- 更新 Vue contact list
- 寫 Activity Log
- 回傳 structured result

回傳：

```json
{
  "ok": true,
  "count": 2,
  "contacts": [
    {
      "id": "u001",
      "name": "王小明",
      "department": "產品研發處",
      "title": "Frontend Engineer",
      "status": "online"
    }
  ]
}
```

---

## 2.10 Tool：open_conversation

名稱：

```text
open_conversation
```

Schema：

```json
{
  "type": "object",
  "properties": {
    "contactId": {
      "type": "string"
    }
  },
  "required": ["contactId"]
}
```

執行：

- selectedContact 更新
- conversation panel 更新
- 寫 Activity Log

contact 不存在：

```json
{
  "ok": false,
  "error": "CONTACT_NOT_FOUND"
}
```

---

## 2.11 Tool：send_message

名稱：

```text
send_message
```

Schema：

```json
{
  "type": "object",
  "properties": {
    "contactId": {
      "type": "string"
    },
    "message": {
      "type": "string",
      "minLength": 1,
      "maxLength": 500
    }
  },
  "required": [
    "contactId",
    "message"
  ]
}
```

執行：

- trim message
- validate contact
- append local mock message
- 更新 conversation panel
- 寫 Activity Log

不呼叫任何 backend。

不送真正訊息。

---

## 2.12 Tool Registration

建立：

```text
src/webmcp/registerTools.js
```

例如：

```js
await document.modelContext.registerTool({
  name: 'search_contacts',
  description: 'Search mock company contacts',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: {
        type: 'string'
      }
    },
    required: ['keyword']
  },
  execute: async ({ keyword }) => {
    return eimService.searchContacts(keyword)
  }
})
```

Tool adapter 不應塞太多 business logic。

---

## 2.13 Activity Log

格式：

```js
{
  timestamp: '10:31:20.215',
  tool: 'search_contacts',
  input: {
    keyword: '王'
  },
  resultSummary: '2 contacts'
}
```

目的：

讓會議觀眾看到：

```text
AI Agent
不是在 click DOM
而是在 call tool
```

---

## 2.14 Manual Tool Runner

一定要做。

原因：

AI / Inspector 可能是現場最不穩定部分。

畫面：

```text
Manual WebMCP Test

Tool:
[search_contacts ▼]

Arguments:
{
  "keyword": "王"
}

[Execute]
```

這個 runner 呼叫相同 underlying service。

不要 fake 成 WebMCP Agent。

UI 上明確標：

```text
Manual Tool Runner
Fallback / Debug only
```

---

## 2.15 現場 Prompt

展示：

```text
幫我找姓王的同事
```

預期：

```text
search_contacts({
  "keyword": "王"
})
```

接著：

```text
打開王小明的聊天
```

預期：

```text
open_conversation({
  "contactId": "u001"
})
```

最後：

```text
傳訊息給他：「下午三點開會」
```

預期：

```text
send_message({
  "contactId": "u001",
  "message": "下午三點開會"
})
```

---

## 2.16 Security

Demo 要限制：

- message max 500
- contactId validation
- message trim
- no external URL
- no eval
- no script execution
- no local real data
- no backend
- refresh 可 reset

UI 顯示：

```text
Demo only — messages are stored in local memory only.
```

---

## 2.17 驗收條件

- [ ] 獨立 Vite 專案
- [ ] WebMCP feature detection
- [ ] 使用 `document.modelContext`
- [ ] 至少 20 個 fake contacts
- [ ] `search_contacts`
- [ ] `open_conversation`
- [ ] `send_message`
- [ ] 每個 tool 有 JSON Schema
- [ ] Human UI / Tool 共用 service
- [ ] Activity Log
- [ ] Manual Tool Runner
- [ ] invalid input 有 error
- [ ] 不連 backend
- [ ] 不送真實訊息
- [ ] Reset 可用
- [ ] Browser 不支援時不 crash
- [ ] build 成功

---

## 2.18 現場展示流程

1. 先用 UI 手動搜尋一次。
2. 說明傳統人類操作。
3. 開 Inspector / Agent。
4. 輸入：
   `幫我找姓王的同事`
5. 看 Activity Log。
6. 開啟王小明。
7. 送 local mock 訊息。
8. 強調：
   - AI 呼叫 structured tool。
   - Web App 主動公開能力。
   - 不是 AI 靠畫面猜 button。

---

## 2.19 可直接貼給 Codex 的 Prompt

```text
請建立一個獨立專案 webmcp-eim-demo。

這個專案只做 WebMCP + Vue EIM Demo。
不要加入 Vue Vapor benchmark。
不要加入 Chrome text-fit / SPA Performance Demo。
不要做 monorepo。

要求：

1. 使用 npm + Vite + Vue 3 + JavaScript。
2. 不使用 Electron、Pinia、Vuex、Ant Design。
3. 建立 fake EIM UI。
4. 至少 20 筆 mock contact。
5. 至少三個 WebMCP tools：
   - search_contacts
   - open_conversation
   - send_message
6. 使用 document.modelContext。
7. 不使用 navigator.modelContext。
8. 所有 tool 有 JSON Schema。
9. Human UI 與 WebMCP tool 必須共用同一 application service。
10. 建立 Activity Log。
11. 建立 Manual Tool Runner，作為 debug / fallback。
12. WebMCP unsupported 時顯示：
    chrome://flags/#enable-webmcp-testing
13. 不連任何 backend。
14. send_message 只更新 local in-memory mock messages。
15. input 要做 validation。
16. UI 適合 1280x720 投影。
17. README 包含：
    - setup
    - WebMCP flag
    - browser requirement
    - demo 操作流程
    - known limitations
18. 完成後執行：
    npm install
    npm run build
    並修復 build / runtime error。

不要只回覆規劃，直接建立完整可執行專案。
```

---

# Demo 3：Chrome 148～151 新 Web Platform Demo

## 3.1 目標

建立第三個完全獨立 Vue App。

展示三項 Browser capability：

1. Chrome 148：media lazy loading
2. Chrome 150：CSS `text-fit`
3. Chrome 151：SPA Performance Entries

會議主題：

> Browser 正在把以前需要 JavaScript 或自行 instrumentation 的工作，逐步變成 Web Platform 原生能力。

---

## 3.2 專案形式

```text
chrome-platform-demo/
├─ package.json
├─ vite.config.js
├─ index.html
├─ README.md
├─ scripts/
│  └─ generate-wav.mjs
├─ public/
│  └─ media/
└─ src/
   ├─ main.js
   ├─ App.vue
   ├─ router.js
   └─ demos/
      ├─ HomeDemo.vue
      ├─ TextFitDemo.vue
      ├─ MediaLazyLoadingDemo.vue
      └─ SpaPerformanceDemo.vue
```

這是一個單獨 repo / folder。

不要放 Vapor。

不要放 WebMCP。

---

## 3.3 技術棧

```text
Node.js 22+
npm
Vite
Vue 3
Vue Router
JavaScript
原生 CSS
```

不使用 UI framework。

---

## 3.4 Routes

```text
/
/text-fit
/media-lazy
/spa-performance
```

首頁：

```text
2026 Chrome Web Platform Demos

[Chrome 148]
Media Lazy Loading

[Chrome 150]
CSS text-fit

[Chrome 151]
SPA Performance
```

每張卡顯示：

```text
Supported in this browser:
Yes / No
```

---

# 3A. CSS text-fit

## 3A.1 目標

比較：

```text
傳統 JavaScript responsive text sizing
vs
原生 CSS text-fit
```

---

## 3A.2 Browser

Chrome 150+。

---

## 3A.3 UI

```text
┌────────────────────────┬──────────────────────────┐
│ JavaScript             │ Native CSS               │
│                        │                          │
│ Quarterly Revenue ...  │ Quarterly Revenue ...    │
│                        │                          │
│ ResizeObserver         │ text-fit                 │
│ font-size: 31.4px      │ JS calculations: 0       │
└────────────────────────┴──────────────────────────┘

Width
[-----------●----------] 320px

Text:
[2026 Q3 Enterprise Messaging Platform Revenue]
```

兩邊同時使用相同 width。

---

## 3A.4 JS Side

左側：

- `ResizeObserver`
- binary search font-size
- 讓文字 fit container

顯示：

```text
Resize callbacks
Font size calculations
Current font size
```

---

## 3A.5 CSS Side

使用 Browser 實際支援的 `text-fit` syntax。

feature detect：

```js
CSS.supports('text-fit', 'shrink')
```

若 Chrome Stable 的實際 value 與 spec 有差異：

- 以實際 Browser 支援為準
- README 記錄
- 不自行 invent

---

## 3A.6 驗收

- [ ] width slider
- [ ] text input
- [ ] 左右相同內容
- [ ] JS side 使用 ResizeObserver
- [ ] Native side 使用 text-fit
- [ ] feature detection
- [ ] unsupported fallback
- [ ] 顯示 JS calculation count

---

# 3B. Media Lazy Loading

## 3B.1 目標

展示 Chrome 148：

```html
<audio loading="lazy">
```

或 Chrome 實際支援的 media lazy loading 行為。

---

## 3B.2 Browser

Chrome 148+。

---

## 3B.3 不依賴外網

不要：

```text
YouTube
外部 MP4
CDN
Google Storage
```

建立：

```text
scripts/generate-wav.mjs
```

Node script 自行生成：

```text
public/media/tone-01.wav
...
public/media/tone-20.wav
```

每個約 1～2 秒。

---

## 3B.4 UI

頁面故意很長。

每隔一段距離放：

```html
<audio
  controls
  loading="lazy"
  src="/media/tone-01.wav">
</audio>
```

上方：

```text
Mode:
○ Eager
● Lazy

Loaded Resources:
3 / 20
```

---

## 3B.5 Resource Log

使用：

```js
PerformanceObserver
```

監控：

```text
resource
```

只顯示：

```text
/media/
```

範例：

```text
tone-01.wav   loaded
tone-02.wav   loaded
tone-03.wav   loaded
```

DevTools Network 仍是主要展示工具。

App log 是輔助。

---

## 3B.6 現場操作

1. 開 DevTools Network。
2. Reload。
3. 看初始 request。
4. 往下 scroll。
5. 看新的 media resource 才開始載入。
6. 切 Eager。
7. Reload 比較。

---

## 3B.7 驗收

- [ ] 至少 20 個 local WAV
- [ ] Node script 可產檔
- [ ] 不依賴外網
- [ ] Lazy / Eager toggle
- [ ] Resource Log
- [ ] Reset / Reload 提示
- [ ] unsupported fallback

---

# 3C. SPA Performance

## 3C.1 目標

展示 Chrome 151 的 SPA performance capability：

```text
soft-navigation
interaction-contentful-paint
```

並比較：

```text
以前：
SPA route change 只能自己 mark

現在：
Browser 開始提供更正式的 performance entries
```

---

## 3C.2 Browser

Chrome 151+。

---

## 3C.3 Vue Router Routes

```text
/
/dashboard
/contacts
/reports
```

Route artificial latency：

```text
Dashboard  150 ms
Contacts   800 ms
Reports   1400 ms
```

不呼叫 backend。

只使用：

```js
await delay(ms)
```

---

## 3C.4 Navigation

一定由 User Interaction 觸發：

```vue
<button @click="router.push('/contacts')">
  Contacts
</button>
```

不要 App 啟動後自動 router push。

---

## 3C.5 PerformanceObserver

feature detection：

```js
const supported =
  PerformanceObserver.supportedEntryTypes || []
```

檢查：

```js
supported.includes('soft-navigation')
supported.includes('interaction-contentful-paint')
```

Observer：

```js
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    // render real browser entry
  }
}).observe({
  type: 'soft-navigation',
  buffered: true
})
```

另外建立 ICP observer。

---

## 3C.6 App Mark

可以自己使用：

```js
performance.mark()
```

但 UI 一定區分：

```text
APP MARK
BROWSER ENTRY
```

不可把自訂 mark 偽裝成 browser `soft-navigation`。

---

## 3C.7 Performance Timeline

```text
Performance Timeline

10:35:03.115 APP MARK       click Contacts
10:35:03.118 APP MARK       route-start /contacts
10:35:03.920 APP MARK       route-content-ready
10:35:03.924 BROWSER ENTRY  soft-navigation
10:35:03.932 BROWSER ENTRY  interaction-contentful-paint
```

點 entry 可看 detail。

只顯示 Browser 實際回傳值。

不要 hard-code fake entry。

---

## 3C.8 Controls

```text
Artificial Delay

[150 ms]
[800 ms]
[1400 ms]

[Clear Timeline]
```

---

## 3C.9 Unsupported

如果不支援：

```text
soft-navigation is not supported in this browser.

Required: Chrome 151+
```

仍可顯示 App Mark。

這樣可以順便解釋舊方法。

---

## 3C.10 驗收

- [ ] Vue Router
- [ ] 至少 3 個 routes
- [ ] user click navigation
- [ ] artificial delay
- [ ] PerformanceObserver
- [ ] soft-navigation detection
- [ ] interaction-contentful-paint detection
- [ ] App Mark 與 Browser Entry 分類
- [ ] 不 fake browser entry
- [ ] Clear Timeline
- [ ] unsupported 不 crash

---

## 3.5 Chrome Demo 整體驗收

- [ ] 獨立 Vite 專案
- [ ] `/text-fit`
- [ ] `/media-lazy`
- [ ] `/spa-performance`
- [ ] 首頁可 navigation
- [ ] Browser support status
- [ ] text-fit comparison
- [ ] local WAV generation
- [ ] lazy loading demo
- [ ] SPA performance demo
- [ ] feature detection
- [ ] 無 backend
- [ ] 無外部 media dependency
- [ ] build 成功

---

## 3.6 現場展示流程

### 第一段：text-fit

1. 調 container width。
2. 看 JS side 持續計算。
3. 看 CSS side 不需 resize JS。

---

### 第二段：media lazy loading

1. 開 Network。
2. Reload。
3. Scroll。
4. 看 resource 逐步出現。

---

### 第三段：SPA Performance

1. 開 Contacts route。
2. artificial delay 800ms。
3. 看 timeline。
4. 再開 Reports 1400ms。
5. 比較 browser entry。

---

## 3.7 可直接貼給 Codex 的 Prompt

```text
請建立一個獨立專案 chrome-platform-demo。

這個專案只做 Chrome 148～151 Web Platform Demo。
不要加入 Vue Vapor。
不要加入 WebMCP。
不要做 monorepo。

技術：
- npm
- Vite
- Vue 3
- Vue Router
- JavaScript
- 原生 CSS

建立 routes：
- /
- /text-fit
- /media-lazy
- /spa-performance

功能要求：

A. text-fit
1. 做左右 comparison：
   - JavaScript + ResizeObserver
   - CSS text-fit
2. container width slider。
3. text input。
4. 顯示 JS resize callback / calculation count。
5. 使用 CSS.supports()。
6. Browser 不支援時顯示 fallback。
7. text-fit 實際語法以當前 Chrome Stable 真實支援為準，
   不要 invent API。

B. media lazy loading
1. 不使用任何外部 media URL。
2. 建立 scripts/generate-wav.mjs。
3. 自動生成至少 20 個 local WAV。
4. 頁面放至少 20 個 audio element。
5. 提供 Lazy / Eager toggle。
6. Lazy mode 使用 Chrome 148 實際支援的 media lazy-loading syntax。
7. 使用 PerformanceObserver resource log。
8. README 提醒可搭配 DevTools Network 展示。

C. SPA Performance
1. Vue Router 至少：
   - dashboard
   - contacts
   - reports
2. route navigation 必須由 user click 觸發。
3. artificial delay：
   - 150ms
   - 800ms
   - 1400ms
4. 使用 PerformanceObserver。
5. feature detect：
   - soft-navigation
   - interaction-contentful-paint
6. 可使用 performance.mark()，
   但 UI 必須明確區分：
   - APP MARK
   - BROWSER ENTRY
7. 不得 fake browser performance entry。
8. Browser 不支援時顯示 fallback。
9. 提供 Clear Timeline。

其他：
1. 首頁顯示三個 Demo 卡片與 Browser support。
2. UI 適合 1280x720 投影。
3. README 包含：
   - setup
   - browser requirement
   - 各 Demo 操作方式
   - known limitations
4. 完成後執行：
   npm install
   npm run build
5. 修正 build error 與明顯 runtime error。

不要只回覆計畫，直接建立完整可執行專案。
```

---

# 最後：三個 Demo 的關係

這三個 Demo 是三個**不同 repository / folder**。

建議：

```text
vue-vapor-demo/
webmcp-eim-demo/
chrome-platform-demo/
```

各自：

```bash
cd vue-vapor-demo
npm install
npm run dev
```

或：

```bash
cd webmcp-eim-demo
npm install
npm run dev
```

或：

```bash
cd chrome-platform-demo
npm install
npm run dev
```

彼此完全獨立。

不應存在：

```text
frontend-2026-demos/
└─ apps/
   ├─ vapor
   ├─ webmcp
   └─ chrome
```

也不需要：

```text
npm workspaces
root package.json
共用 dependency
共用 Vite config
```

這樣才能讓 Codex 對三個題目分別生成、分別修改、分別展示，而不互相干擾。
