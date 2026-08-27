# Vue 3.6 Vapor Mode Benchmark：15 分鐘報告講稿

> 對象：具備 JavaScript、DOM 與 Vue 基礎的前端工程師  
> 形式：可照念講稿＋台上操作提示  
> Demo：Vue `3.6.0-rc.5`，Virtual DOM 與 Vapor 相對比較

---

## 上台前一頁提示卡

### 核心五句話

1. Vapor Mode 仍然是 Vue，不是另一套 framework。
2. 傳統 Vue 會把 template 編譯成建立 VNode 的 render function，再由 renderer 更新 DOM。
3. Vapor 會把 template 編譯成更直接的 DOM 建立與 reactive update 操作，不以 Virtual DOM 作為主要中介層。
4. 這可能減少 VNode allocation、通用 reconciliation 與 baseline runtime 成本，但不代表所有畫面都一定更快。
5. 本 Demo 使用相同資料、相同 template、相同操作和多次測量，只比較這組 workload 下的相對結果。

### Demo 固定設定

```text
Rows           10,000
Warmup Runs         2
Measured Runs      10
Seed             2026
```

### Demo 操作順序

```text
確認 Ready
→ 按「中文」
→ Update 10%／更新 10%
→ 解釋 avg、median、Ratio
→ Shuffle／重新排序
→ 解釋 keyed list reconciliation
→ 結論與限制
```

### 絕對不要說

```text
✗ Vapor 永遠比 VDOM 快。
✗ Ratio 0.6 代表 Vapor 快 60%。
✗ Vapor 完全沒有 runtime。
✗ 升級 Vue 3.6 後所有 component 會自動變成 Vapor。
✗ 這是 Vue 官方 benchmark。
```

---

# 正式講稿

## 0:00–1:00｜開場：今天要比較什麼？

### [操作]

- 確認 Dashboard 右上角顯示 Vue `3.6.0-rc.5` 與 `Ready`。
- 暫時不要按任何 benchmark 按鈕。
- 將畫面停在左右兩個相同的 10,000-row 列表。

### [畫面重點]

- 左側 `Virtual DOM`。
- 右側 `Vapor`。
- 左右資料內容與 row 數完全相同。

### [講稿]

> 今天要介紹的是 Vue 3.6 的 Vapor Mode。
>
> 畫面左邊是傳統 Vue Virtual DOM，右邊是 Vapor。兩邊都有 10,000 筆相同資料，使用相同的 template、CSS、更新操作和測量次數。
>
> 今天的問題不是「Vapor 固定可以快多少」，而是：當資料與 workload 相同時，改變 Vue 的 rendering strategy，會產生什麼差異？
>
> 我會先用幾分鐘解釋 Virtual DOM 和 Vapor 的概念，再直接操作 Demo，比較局部更新和列表重新排序。

### [時間不足]

只保留這句：

> 左邊是傳統 VDOM，右邊是 Vapor；兩邊條件相同，今天只做相對比較。

---

## 1:00–4:00｜傳統 Vue：DOM、VNode 與 reconciliation

### [操作]

- 保持 Dashboard 畫面不動。
- 指向任一 row 的 `Score` 或 `Unread`，用它當作資料更新例子。

### [畫面重點]

- 一筆 row 的 `Score 66`、`Unread 3`、`Active` 等動態內容。
- 強調真正顯示在瀏覽器中的元素是 DOM。

### [講稿]

> 首先從 Vue 如何把資料變成畫面開始。
>
> 瀏覽器真正顯示的是 DOM，例如一個 span、一個 div，或這裡的一整列資料。直接手動管理大量 DOM 很麻煩，所以 Vue 讓我們用 declarative template 描述「資料在這個狀態時，畫面應該長什麼樣子」。
>
> 傳統 Vue 會把 template 編譯成 render function。Render function 執行後會產生 VNode，也就是 Virtual DOM Node。VNode 可以把它理解為一個 JavaScript object，用來描述某個畫面節點，例如它是 span、有哪些 props、children 是什麼。
>
> 當 reactive state 改變時，Vue 會產生新的 VNode 描述，利用新舊描述判斷需要更新哪一部分，再把差異套用到真正 DOM。這個比較與更新過程常被稱為 diff、patch 或 reconciliation。
>
> Reconciliation 的白話意思，就是「讓目前畫面與最新資料重新一致」。
>
> 但這裡要避免一個誤解：傳統 Vue 並不是每次都笨笨地比較整棵樹。Vue compiler 已經有 static hoisting、patch flags 和 block tree 等最佳化，會告訴 runtime 哪些地方可能改變。所以 VDOM 本身不是錯誤或過時的設計，它提供了很強的通用性與 component abstraction。

### 概念流程

```text
Reactive state 改變
        ↓
執行 render function
        ↓
產生新的 VNode 描述
        ↓
比較並 reconciliation
        ↓
更新真正的 DOM
```

### [時間不足]

略過 compiler optimization 名稱，只說：

> 傳統 Vue 會先產生畫面的 JavaScript 描述，再比較並更新真正 DOM；Vue compiler 已經會標記動態區域，不是每次暴力掃描所有內容。

---

## 4:00–6:00｜Vapor：把更多工作移到編譯階段

### [操作]

- 指向右側 Vapor panel。
- 仍不執行 benchmark，先完成概念說明。

### [畫面重點]

- 右側畫面與左側相同。
- Vapor 改變的是 rendering implementation，不是使用者看到的 UI。

### [講稿]

> Vapor Mode 改變的是 template 被編譯後的 rendering strategy。
>
> Vapor 不以 Virtual DOM 作為主要中介層。Compiler 已經看過 template，因此能在 build time 產生更直接的 DOM 建立和 reactive update 操作。
>
> 例如 template 裡有 `Score {{ row.score }}`，概念上可以理解為 compiler 建立對應 DOM，並建立一個只負責這個動態 binding 的 reactive effect。當 score 改變時，對應 effect 可以直接更新這個 DOM 位置，而不必先重新建立完整的 VNode 描述，再走通用 VDOM patch 流程。
>
> Reactive effect 的白話意思，是「它知道自己依賴哪些 reactive 資料；資料改變時，只重新執行對應的更新工作」。
>
> 這可能減少 VNode object allocation、通用 diff 工作與 Garbage Collection 壓力。純 Vapor App 也可以避免載入 Virtual DOM runtime，降低 baseline bundle。
>
> 但「沒有 Virtual DOM」不等於「沒有 runtime」，Vue 的 reactivity、component、list rendering 和 lifecycle 仍然需要 runtime 支援。當列表 Shuffle 時，Vapor 也仍然要判斷哪些 DOM 應該移動。

### 概念流程

```text
Reactive state 改變
        ↓
觸發 compiler 建立的對應 reactive effect
        ↓
直接執行相關 DOM update
```

### [時間不足]

只保留：

> Vapor 把更多資訊放到編譯階段，讓 reactive state 改變時可以更直接地更新相關 DOM；它移除的是主要 VDOM 中介層，不是移除整個 Vue runtime。

---

## 6:00–8:00｜實際程式碼：真正差異只有兩個核心位置

### [操作]

- 切換到編輯器或預先準備的 code 畫面。
- 先開啟 [VDOM entry](./src/vdom/main.js) 與 [Vapor entry](./src/vapor/main.js)。
- 再開啟 [VDOM SFC](./src/vdom/App.vue) 與 [Vapor SFC](./src/vapor/App.vue)。

### [畫面重點]

第一個核心差異是 App 啟動方式：

```diff
- import { createApp } from 'vue'
+ import { createVaporApp } from 'vue'

- createApp(App).mount('#app')
+ createVaporApp(App).mount('#app')
```

第二個核心差異是 SFC 編譯標記：

```diff
- <script setup>
+ <script setup vapor>
```

### [講稿]

> 從開發者角度看，兩邊程式碼的核心差異其實非常小。
>
> 傳統 App 使用 `createApp()`；純 Vapor App 使用 `createVaporApp()`。這決定 App 用哪種 runtime 啟動。
>
> Component 方面，傳統 SFC 使用一般的 `script setup`；Vapor SFC 加上 `vapor` marker。這個 marker 告訴 SFC compiler：請把這個 component 編譯成 Vapor，而不是傳統 VDOM render function。
>
> 這兩個設定需要配對。真正決定 rendering mode 的是 App 啟動 API 和 SFC compiler marker。
>
> 程式中的 `renderer = 'vdom'` 或 `renderer = 'vapor'` 只用來標記 postMessage 結果來源、顯示名稱和套用顏色，本身不會改變 rendering mode。
>
> 兩邊其餘部分刻意保持相同：共用 `useRenderer`、deterministic data、benchmark actions、CSS 和幾乎逐字相同的 template。這是為了避免拿不同 UI 做不公平比較。

### 共用架構

```text
Dashboard Controller
        │
        ├─ postMessage → VDOM iframe  → createApp + 普通 SFC
        │
        └─ postMessage → Vapor iframe → createVaporApp + Vapor SFC

兩側共用：data / benchmark / protocol / CSS / workload
```

### [時間不足]

只展示兩段 diff，略過檔案架構。

---

## 8:00–9:00｜Demo 介面與測量方法

### [操作]

1. 回到 Dashboard。
2. 確認右上角為 `Ready`。
3. 按 `中文`，讓指定的操作標籤切換為中文。
4. 確認設定為 10,000／2／10／2026。

### [畫面重點]

- Rows：資料量。
- Warmup Runs：先執行但不列入統計。
- Measured Runs：正式記錄的次數。
- 左右 row 內容相同。

### [講稿]

> 現在進入實際 Demo。
>
> 我們使用 10,000 筆資料，先 warmup 2 次，再正式測量 10 次。Seed 2026 可以理解成固定的「資料配方編號」，它確保兩邊產生相同資料、選到相同 rows、得到相同 Shuffle 順序。Seed 大小沒有速度或難度意義。
>
> 每個 sample 開始前，系統都會在計時區外重建相同 baseline，所以十次測量不是把資料連續修改十次，而是每一次都從相同起點重新測量。
>
> 計時使用 `performance.now()`；state mutation 後等待 Vue `nextTick()`，再等待一個 `requestAnimationFrame()`。Dashboard 先測完 VDOM，再測 Vapor，避免兩個 renderer 同時競爭主執行緒。

### [時間不足]

不解釋 Seed 與 timer 細節，只說：

> 兩邊使用相同資料和相同操作，每邊 warmup 2 次、正式測量 10 次。

---

## 9:00–11:00｜Demo 1：Update 10%

### [操作]

1. 按 `更新 10%`。
2. 等待上方狀態依序跑完 VDOM 與 Vapor。
3. 完成後指向下方兩張結果卡與 Ratio。

### [畫面重點]

- 10,000 筆中有 1,000 筆更新。
- 更新欄位為 `score`、`unread`、`active`。
- 下方 avg、median、min、max。
- 右下角 Ratio。

### [等待時講稿]

> Update 10% 會從 10,000 筆資料中，用固定 seed 選出不重複的 1,000 筆，更新 score、unread 和 active。
>
> 這代表一個局部 reactive update workload：畫面很大，但只有一部分 binding 發生變化。

### [結果出現後講稿]

> 結果不是只看單次，而是正式測量十次。
>
> Avg 是平均時間；Median 是排序後的中間值，通常比較不容易被單次 GC 或背景負載影響；Min 和 Max 可以看測量波動。
>
> Ratio 的公式固定是 `Vapor avg / VDOM avg`。如果 Ratio 是 0.6，正確說法是「這一輪 Vapor 的平均 elapsed time 約為 VDOM 的 60%」，或「elapsed time 約少 40%」。不能說 Vapor 永遠快 40%，因為這只代表目前裝置、瀏覽器和 workload。

### [異常結果講稿]

如果 Ratio 接近 1 或大於 1，不要慌，直接說：

> 這也說明 benchmark 必須實際測量，不能預設 Vapor 在每一種 workload、每一次執行都一定較快。瀏覽器排程、GC、CPU 負載和 workload 都會影響結果。

### [時間不足]

只解釋 avg、median 與 Ratio，略過 min/max。

---

## 11:00–13:00｜Demo 2：Shuffle

### [操作]

1. 按 `重新排序`。
2. 等待 VDOM 與 Vapor 測量完成。
3. 指向列表順序與新的結果。

### [畫面重點]

- Row 數量仍是 10,000。
- ID 集合不變，但排列順序改變。
- 第二輪結果與 Update 10% 不一定有相同比例。

### [等待時講稿]

> Shuffle 使用 deterministic Fisher–Yates，將相同的 10,000 筆 keyed rows 重新排列。
>
> 這次不只是修改文字，而是觀察 keyed list reconciliation。Renderer 必須判斷每個 row 對應哪個既有 DOM，以及哪些 DOM 需要移動。
>
> Vapor 沒有 Virtual DOM，不代表列表重排完全不需要 reconciliation；它仍然必須完成真實 DOM 的移動，只是採用不同的編譯與 runtime 路徑。

### [結果出現後講稿]

> 現在可以比較 Update 10% 和 Shuffle 的結果。兩種操作可能呈現不同趨勢，因為局部文字更新和大量 keyed DOM 移動是不同 workload。
>
> 這也是這個 Demo 不把結果寫死成「Vapor 快多少」的原因。效能結論必須包含 workload 條件。

### [時間不足]

如果前面超時，Shuffle 只執行不逐項解釋，保留一句：

> Shuffle 觀察的是 keyed list reconciliation，不只是文字 binding 更新。

---

## 13:00–15:00｜限制、適用情境與結論

### [操作]

- 保留 Shuffle 的結果畫面。
- 不再執行新的 action。

### [畫面重點]

- 左右多次統計結果。
- Ratio 的公式，而不是單一宣傳數字。
- 頁尾的 relative comparison 提示。

### [講稿]

> 最後整理 Vapor 的定位。
>
> 第一，Vapor 仍然是 Vue，它保留熟悉的 template 與 Composition API 開發體驗，但改變 compiler output 和 rendering runtime。
>
> 第二，Vapor 是 opt-in。升級 Vue 3.6 不會讓現有 component 自動切換成 Vapor，需要明確使用 Vapor SFC marker；純 Vapor App 則使用 `createVaporApp()`。
>
> 第三，Vapor Mode 支援的是 Vue API 的子集合。像 Options API、依賴 component public instance 的部分能力，以及某些 VDOM component library 整合，都需要另外評估。這個 Demo 使用的也是 RC 版本，不應直接延伸成所有 production 專案的全面遷移建議。
>
> 第四，省下 VDOM 工作不代表省下瀏覽器的所有成本。Style calculation、layout、paint、DOM 建立和移動仍然存在。如果真正瓶頸在 layout 或大量繪製，Vapor 的收益比例可能不同。
>
> 所以今天最重要的結論不是某個 Ratio，而是：Vue 正在提供一條 opt-in 的編譯路徑，把更多 rendering 工作移到 build time，減少 runtime 的通用 VDOM 工作。我們應該用代表真實產品的 workload 測量，再決定哪些畫面適合採用。
>
> 這個 Demo 是相對比較工具，不是 Vue 官方 benchmark，也不代表所有 production workload。謝謝。

### [時間不足]

結尾只講：

> Vapor 是 opt-in 的 Vue compilation mode；它可能減少 VDOM runtime 工作，但實際收益取決於 workload。這個 Demo 是相對比較，不是固定效能承諾。

---

# 附錄 A｜控制項速查表

| 控制項 | 功能 | 台上簡短說法 |
|---|---|---|
| Rows | 選擇 1k、5k、10k、20k rows | 「決定兩邊的相同資料量。」 |
| Warmup Runs | 執行但不列入統計，範圍 0–10 | 「先熱身，降低第一次執行的特殊因素。」 |
| Measured Runs | 正式記錄次數，範圍 1–30 | 「不是拿單次結果下結論。」 |
| Seed | 固定資料與操作位置 | 「相同的資料配方編號，大小沒有速度意義。」 |
| 中文／EN | 切換指定操作文字 | 「只切換操作標籤，不影響 benchmark。」 |
| Reset／重設 | 清除結果並重建目前 baseline | 「恢復選定 Rows 與 Seed 的初始資料。」 |

## 六種 benchmark action

| Action | 實際行為 | 主要觀察 |
|---|---|---|
| Initial Render／初始渲染 | 從空列表建立 N 筆 deterministic data 並 render | 初始建立資料與大量 DOM |
| Update 10%／更新 10% | 更新固定 10% rows 的 score、unread、active | 局部 reactive update |
| Update All／全部更新 | 更新全部 rows 的三個欄位 | 大量 binding update |
| Append 1,000／新增 1,000 | 從 N-row baseline 尾端新增 1,000 筆 | 列表尾端插入與 DOM 建立 |
| Remove 1,000／移除 1,000 | 從 deterministic 合法位置刪除 1,000 筆 | 列表刪除與 DOM 清理 |
| Shuffle／重新排序 | 使用 seeded Fisher–Yates 重排全部 rows | Keyed list reconciliation 與 DOM 移動 |

> 注意：每一個 warmup 與 measured sample 都會先重建相同 baseline，因此 action 不會跨 sample 累積。

---

# 附錄 B｜結果速查表

| 指標 | 意義 | 注意事項 |
|---|---|---|
| avg | 所有 measured runs 的平均 elapsed time | 容易受到單次極端值影響 |
| median | 排序後的中位數 | 適合搭配 avg 觀察典型表現 |
| min | 最快的一次 | 不能單獨作為結論 |
| max | 最慢的一次 | 可用來觀察波動或暫時性干擾 |
| Ratio | `Vapor avg / VDOM avg` | 小於 1 表示本輪 Vapor avg 較低 |

## Ratio 口算範例

```text
VDOM avg  = 20 ms
Vapor avg = 12 ms
Ratio     = 12 / 20 = 0.600
```

正確說法：

> 這輪 Vapor 平均 elapsed time 約為 VDOM 的 60%，也就是 elapsed time 約少 40%。

不要說：

> Vapor 快 60%。

如果要講「速度倍數」，算法是另一個公式：

```text
Speedup = VDOM avg / Vapor avg = 20 / 12 ≈ 1.67 倍
```

本 Demo 沒有顯示 Speedup，因此現場以 Ratio 與 elapsed time 說明最安全。

---

# 附錄 C｜常見問答

## Q1：Vapor 是新的 framework 嗎？

不是。Vapor 是 Vue 的 opt-in SFC compilation mode，主要改變 compiler output 與 rendering runtime。

## Q2：Vapor 沒有 Virtual DOM，是不是完全沒有 runtime？

不是。Vue reactivity、component、lifecycle、directive 和 list rendering 等能力仍需要 runtime；省下的是主要 VDOM 中介與相關通用工作。

## Q3：傳統 VDOM 是不是很慢、應該淘汰？

不能這樣說。Vue 的 VDOM compiler/runtime 已有 patch flags、static hoisting 和 block tree 等最佳化，而且 VDOM 提供高度通用的 component model。Vapor 是另一條針對編譯與 runtime 成本的 opt-in 路徑。

## Q4：為什麼 template 幾乎相同，結果卻可能不同？

因為 template 是原始輸入；VDOM 與 Vapor compiler 會產生不同的 rendering code，runtime 更新 DOM 的路徑也不同。

## Q5：為什麼不讓兩邊同時測？

兩個 iframe 共用同一個瀏覽器主執行緒。同時執行會互相競爭 CPU，讓數字更難解釋，所以 Dashboard 採 VDOM、Vapor 依序測量。

## Q6：Seed 2026 是不是代表資料量或難度？

不是。Seed 只是 deterministic PRNG 的起始值，可理解成資料配方編號。2026 是方便配合會議年份記憶，數字大小沒有速度意義。

## Q7：為什麼不用 `Math.random()`？

真正隨機會讓左右產生不同資料、更新不同 rows 或得到不同 Shuffle 順序，破壞公平比較。固定 seed 可以重現相同 workload。

## Q8：為什麼不用 `<table>`？

大量 table layout 可能讓瀏覽器表格排版成本成為主要變因。本 Demo 使用普通 div rows，降低特定 table layout 對 rendering 比較的干擾。

## Q9：Ratio 大於 1 是不是 Demo 壞了？

不一定。它表示這一輪 Vapor avg 高於 VDOM avg。不同 workload、瀏覽器排程、GC 和硬體狀態都可能造成不同結果，應重跑並搭配 median 與波動範圍判讀。

## Q10：可以在既有 VDOM App 混用 Vapor component 嗎？

Vue 3.6 RC 提供 `vaporInteropPlugin` 支援混用，但 interop 會引入額外 runtime，component library 與 edge cases 也需要驗證。本 Demo 刻意用兩個獨立 App，不把 interop 成本混入 benchmark。

## Q11：現在適合全面導入 production 嗎？

不應只根據這個 Demo 決定。此專案固定使用 Vue `3.6.0-rc.5`；應先確認正式版本、API 相容性、component library、SSR/hydration 與代表真實產品的 benchmark，再考慮局部或全面採用。

## Q12：這個 elapsed time 是完整的使用者體感時間嗎？

不是完整的 end-to-end 使用者體感指標。Timer 包含 state mutation、Vue update、`nextTick()` 與下一個 animation frame，但沒有強制 layout read，也不保證完整涵蓋 paint/composite。它適合做此 Demo 內的相對比較。

---

# 附錄 D｜推薦與禁止說法

| 避免說法 | 推薦說法 |
|---|---|
| Vapor 永遠比較快 | Vapor 在這次 workload 的平均 elapsed time 較低／較高 |
| Vapor 快 50% | 本輪 Vapor elapsed time 約為 VDOM 的 50% |
| Vue 3.6 移除了 Virtual DOM | Vue 3.6 提供 opt-in Vapor compilation mode |
| Vapor 沒有 runtime | 純 Vapor App 可避免 VDOM runtime，但仍有 Vue runtime |
| Vapor 不需要 reconciliation | Vapor 不使用主要 VDOM reconciliation，但列表仍需處理 DOM 對應與移動 |
| 這證明 production 一定更快 | 這是特定資料、操作、裝置與瀏覽器下的相對比較 |
| 這是 Vue 官方 benchmark | 這是會議用途的自製相對比較 Demo |

---

# 附錄 E｜報告前檢查清單

## 前一天

- [ ] 使用 Node.js `>=22.12.0` 執行 `npm install`。
- [ ] 執行 `npm test`，確認 19 項測試通過。
- [ ] 執行 `npm run build`，確認三個 HTML entry build 成功。
- [ ] 實際跑一次 10,000 rows 的 `Update 10%` 與 `Shuffle`。
- [ ] 確認投影解析度下 Dashboard 不被瀏覽器縮放裁切。

## 上台前五分鐘

- [ ] 關閉不必要的分頁與高負載程式。
- [ ] 關閉 DevTools，除非報告需要展示它。
- [ ] 接上電源，關閉省電模式與 CPU throttling。
- [ ] 執行 `npm run dev`，重新整理 Dashboard。
- [ ] 確認 Vue 版本與 `Ready`。
- [ ] 先用 1,000 rows 試跑一次，再 Reset 回 10,000 rows。
- [ ] 設定 10,000／2／10／2026。

## 現場卡住時

### 情況一：按鈕不能按

1. 看右上角是否仍在 Warmup 或 Measured。
2. 等待目前 renderer 完成。
3. 若長時間沒有進度，按 `Reset`。

### 情況二：Ratio 沒出現

Ratio 必須等 VDOM 與 Vapor 都完成才會顯示；確認右上角是否已顯示 `Complete` 或 `Ready`。

### 情況三：結果非常異常

1. 不要立即宣告 renderer 有問題。
2. 按 `Reset` 後再跑一次。
3. 檢查 DevTools、背景分頁、CPU throttling 與系統負載。
4. 若仍異常，使用預備說法：「這也顯示 microbenchmark 對執行環境敏感，應看多次統計並以真實 workload 驗證。」

### 情況四：畫面或 iframe 發生錯誤

1. 重新整理 Dashboard。
2. 等待左右 renderer 都顯示 `Ready`。
3. 使用 1,000 rows、Warmup 1、Measured 3 快速確認。
4. 再恢復正式設定。

---

# 附錄 F｜實作來源索引

- [VDOM 啟動入口](./src/vdom/main.js)
- [Vapor 啟動入口](./src/vapor/main.js)
- [VDOM SFC](./src/vdom/App.vue)
- [Vapor SFC](./src/vapor/App.vue)
- [共用 renderer controller](./src/shared/useRenderer.js)
- [共用 benchmark 計時](./src/shared/benchmark.js)
- [Deterministic data 與 actions](./src/shared/data.js)
- [postMessage protocol](./src/shared/protocol.js)
- [統計計算](./src/shared/stats.js)
- [Dashboard](./src/dashboard/Dashboard.vue)

---

## 最後 20 秒版本

> Vapor Mode 是 Vue 的 opt-in compilation mode。傳統 Vue 透過 compiler 最佳化的 Virtual DOM 描述與 reconciliation 更新 DOM；Vapor 則把更多資訊放到編譯階段，產生更直接的 reactive DOM update。它可能減少 VNode allocation 與通用 runtime 工作，但實際收益取決於 workload。今天的數字是這個 Demo 的相對比較，不是 Vue 官方 benchmark，也不是 production 效能承諾。
