<script setup>
import { computed, ref } from 'vue'
import { GROUPS, TEXT_FIT_CASES } from './textFitCases.js'

const DEFAULT_WIDTH = 420
const containerWidth = ref(DEFAULT_WIDTH)

const textFitSupported = typeof CSS !== 'undefined'
  && CSS.supports('text-fit', 'grow per-line-all 200%')

const groupedCases = computed(() => GROUPS.map((group) => ({
  ...group,
  cases: TEXT_FIT_CASES.filter((demo) => demo.group === group.id),
})))

function supportsDeclaration(declaration) {
  return typeof CSS !== 'undefined' && CSS.supports('text-fit', declaration)
}

function resetWidth() {
  containerWidth.value = DEFAULT_WIDTH
}
</script>

<template>
  <main>
    <header class="hero">
      <div class="hero-copy">
        <div class="hero-labels">
          <span class="version-pill">Chrome 150</span>
          <span :class="['support-pill', { supported: textFitSupported }]">
            <i></i>
            text-fit {{ textFitSupported ? '支援' : '不支援' }}
          </span>
        </div>
        <p class="kicker">CSS TEXT LEVEL 5</p>
        <h1><span>text-fit</span> 全設定展示</h1>
        <p class="hero-lead">
          不用 JavaScript 計算 font-size，直接比較 Browser 如何放大、縮小，
          以及多行文字採用相同倍率或逐行計算時的差異。
        </p>
      </div>

      <div class="syntax-card" aria-label="text-fit 完整語法">
        <span>完整語法</span>
        <code><b>text-fit:</b><br />
          [none | grow | shrink]<br />
          [consistent | per-line | per-line-all]?<br />
          &lt;percentage&gt;?;</code>
        <p><strong>第一組必填</strong>，行策略及百分比限制皆可省略。</p>
      </div>
    </header>

    <section v-if="!textFitSupported" class="warning" role="status">
      <strong>目前 Browser 不支援完整的 text-fit 語法。</strong>
      以下卡片仍會顯示 base font size，但不使用 JavaScript 模擬縮放；請以 Chrome 150 或更新版本開啟。
    </section>

    <section class="control-panel">
      <div>
        <span class="section-label">共同控制器</span>
        <h2>調整所有案例的容器寬度</h2>
        <p>只改變容器，不改變任何卡片的 text-fit declaration。</p>
      </div>
      <label class="range-control">
        <span>容器寬度 <strong>{{ containerWidth }}px</strong></span>
        <input
          v-model.number="containerWidth"
          type="range"
          min="60"
          max="720"
          step="1"
        />
      </label>
      <button type="button" @click="resetWidth">重設為 {{ DEFAULT_WIDTH }}px</button>
    </section>

    <section class="legend" aria-label="關鍵字快速說明">
      <article>
        <code>none</code>
        <p>不縮放文字。</p>
      </article>
      <article>
        <code>grow</code>
        <p>只放大，不縮小。</p>
      </article>
      <article>
        <code>shrink</code>
        <p>只縮小，不放大。</p>
      </article>
      <article>
        <code>consistent</code>
        <p>所有行共用一個倍率，也是省略時的預設。</p>
      </article>
      <article>
        <code>per-line</code>
        <p>逐行計算，但排除末行與強制換行。</p>
      </article>
      <article>
        <code>per-line-all</code>
        <p>逐行計算，包含末行與強制換行。</p>
      </article>
    </section>

    <section
      v-for="group in groupedCases"
      :key="group.id"
      :class="['demo-group', `group-${group.id}`]"
    >
      <header class="group-heading">
        <p>{{ group.eyebrow }}</p>
        <h2>{{ group.title }}</h2>
        <span>{{ group.description }}</span>
      </header>

      <div class="case-grid">
        <article v-for="demo in group.cases" :key="demo.id" class="case-card">
          <header class="case-heading">
            <div>
              <span>案例 {{ TEXT_FIT_CASES.indexOf(demo) + 1 }}</span>
              <h3>{{ demo.title }}</h3>
            </div>
            <span :class="['case-support', { supported: supportsDeclaration(demo.declaration) }]">
              CSS.supports() {{ supportsDeclaration(demo.declaration) ? '✓' : '×' }}
            </span>
          </header>

          <code class="declaration">text-fit: {{ demo.declaration }};</code>
          <p class="explanation">{{ demo.explanation }}</p>

          <div class="sample-stage">
            <div
              :class="['text-fit-target', `fixture-${demo.fixture}`]"
              :style="{
                width: `${containerWidth}px`,
                fontSize: `${demo.baseFontSize}px`,
                textFit: demo.declaration,
              }"
            >
              <template v-if="demo.fixture === 'none-overflow'">
                TEXT-FIT維持原始尺寸不縮放
              </template>
              <template v-else-if="demo.fixture === 'grow-natural'">
                原生 CSS 讓不同長度的文字，依照每一行可用空間自動調整並填滿容器寬度。
                 <!-- Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi quasi illo illum soluta quis nam obcaecati eius provident delectus consectetur. Libero enim culpa blanditiis odio repudiandae ipsa explicabo incidunt doloribus. -->
              </template>
              <template v-else-if="demo.fixture === 'grow-limit'">
                短標題<br />最後一行
              </template>
              <template v-else-if="demo.fixture === 'shrink-limit'">
                <span class="nowrap">EXTREMELY-LONG-TEXT-FIT-HEADLINE-2026</span><br />
                <span class="nowrap">超級長的中文字串不允許自動換行</span><br />
                <span class="nowrap">最後一行同樣非常非常長</span>
              </template>
              <template v-else>
                <span class="nowrap">TEXT-FIT-LONG-HEADLINE-2026</span><br />
                <span class="nowrap">這是一行不允許自動換行的長標題</span><br />
                <span class="nowrap">最後一行比較短</span>
              </template>
            </div>
          </div>

          <dl class="case-meta">
            <div>
              <dt>Base font size</dt>
              <dd>{{ demo.baseFontSize }}px</dd>
            </div>
            <div>
              <dt>目前容器設定</dt>
              <dd>{{ containerWidth }}px</dd>
            </div>
          </dl>

          <p class="observation"><strong>觀察重點</strong>{{ demo.observation }}</p>
        </article>
      </div>
    </section>

    <section class="technical-notes">
      <div>
        <span class="section-label">容易誤解的地方</span>
        <h2>縮放的是 used value，不是 computed font-size</h2>
        <p>
          即使畫面上的文字已被放大或縮小，下面的程式仍可能取得原本設定的 base font size。
          因此本頁不會假裝知道 Browser 最終使用的像素字級。
        </p>
      </div>
      <pre><code>const element = document.querySelector('.text-fit-target')

getComputedStyle(element).fontSize
// 仍回傳 CSS 設定的 base font size</code></pre>
      <aside>
        <strong>none 的附加值</strong>
        <p>
          <code>none per-line</code>、<code>none per-line-all</code> 或
          <code>none 50%</code> 的附加設定不會造成縮放，因此不建立重複卡片。
        </p>
      </aside>
    </section>

    <footer>
      <strong>CSS text-fit 全設定展示</strong>
      <span>15 個固定案例 · 原生 CSS · 無 JavaScript 字級 fallback</span>
    </footer>
  </main>
</template>
