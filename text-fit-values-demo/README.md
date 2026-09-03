# CSS `text-fit` 全設定展示

這是一個完全獨立的 Vue＋Vite 專案，以 15 張固定案例卡片展示 Chrome 150 的 CSS `text-fit`。所有說明皆為繁體中文，文字縮放完全由 Browser 原生 CSS 完成，不使用 JavaScript 計算 font size，也不引用同 workspace 的其他專案。

## 環境需求

- Node.js 22.12.0 或更新版本
- npm
- Chrome 150 或更新版本

## 指令

```bash
npm install
npm run dev
npm test
```

專案保留標準的 `npm run build` 與 `npm run preview`，但此次建立與驗收不執行 production build。

## `text-fit` 語法

```css
text-fit:
  [none | grow | shrink]
  [consistent | per-line | per-line-all]?
  <percentage>?;
```

- `none`：不縮放。
- `grow`：只放大文字以填滿行寬。
- `shrink`：只縮小文字以避免溢出。
- `consistent`：所有行共用同一倍率，也是省略行策略時的預設。
- `per-line`：每行獨立計算，但排除最後一行及以強制換行結束的行。
- `per-line-all`：每行獨立計算，包含最後一行及強制換行行。
- grow 的百分比是最大倍率，例如 `200%` 代表最多放大兩倍。
- shrink 的百分比是最小倍率，例如 `50%` 代表最小保留一半。

## 15 個固定案例

| # | Declaration | 中文重點 |
| ---: | --- | --- |
| 1 | `none` | 不縮放，用來觀察原始尺寸與溢出 |
| 2 | `grow` | 省略行策略，預設為 consistent |
| 3 | `grow consistent` | 全部行共用放大倍率 |
| 4 | `grow per-line` | 逐行放大，排除末行與強制換行 |
| 5 | `grow per-line-all` | 所有行都逐行放大 |
| 6 | `grow consistent 200%` | 共用倍率，最多放大兩倍 |
| 7 | `grow per-line 200%` | 可處理的行各自放大，最多兩倍 |
| 8 | `grow per-line-all 200%` | 所有行各自放大，最多兩倍 |
| 9 | `shrink` | 省略行策略，預設為 consistent |
| 10 | `shrink consistent` | 全部行共用縮小倍率 |
| 11 | `shrink per-line` | 逐行縮小，排除末行與強制換行 |
| 12 | `shrink per-line-all` | 所有行都逐行縮小 |
| 13 | `shrink consistent 50%` | 共用倍率，最低保留一半 |
| 14 | `shrink per-line 50%` | 可處理的行各自縮小，最低一半 |
| 15 | `shrink per-line-all 50%` | 所有行各自縮小，最低一半 |

`none per-line`、`none per-line-all` 與 `none 50%` 的附加值不會造成縮放，因此頁面不建立重複卡片，只在技術說明中列出。

## 實作重點

Vue 只將固定 declaration 套到每個展示容器：

```vue
<div
  class="text-fit-target"
  :style="{
    width: `${containerWidth}px`,
    fontSize: `${demo.baseFontSize}px`,
    textFit: demo.declaration,
  }"
>
  展示文字
</div>
```

支援檢查使用完整 declaration，不做 User-Agent sniffing：

```js
CSS.supports('text-fit', declaration)
```

不支援時保留 base font size，沒有 JavaScript fallback。

## 現場展示流程

1. 使用 Chrome 150+ 執行 `npm run dev` 並開啟終端機顯示的網址。
2. 確認頁首 `text-fit 支援` badge 及每張卡片的 `CSS.supports() ✓`。
3. 在 `60–720px` 間拖曳共同寬度 slider，先比較 `grow` 與 `grow consistent`，確認省略策略等同 consistent。
4. 比較 `per-line` 與 `per-line-all`，觀察最後一行與強制換行是否參與縮放。
5. 比較有無 `200%`／`50%` 的案例，觀察達到限制後留下空白或繼續溢出。
6. 開啟 DevTools Elements，確認只有 `text-fit`、`font-size` 與容器寬度，沒有 JavaScript 計算後的字級。

## 已知限制

- `text-fit` 改變文字的 used value，但不改變 `getComputedStyle(element).fontSize` 回傳的 computed value。
- CSS Text Level 5 仍可能持續調整，實際行為以目前 Browser 實作為準。
- 窄螢幕中案例卡片會改成單欄；當設定寬度大於卡片可視範圍時，展示區可水平捲動，以保留實際測試寬度。
