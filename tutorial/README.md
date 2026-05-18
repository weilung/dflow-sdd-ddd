# Dflow Tutorial

這裡是 Dflow 的教學入口。讀者可以在還沒把 Dflow 用到真實專案前，先透過
Greenfield 與 Brownfield 劇情，看懂 AI 對話、DDD 判斷、step gate、規格文件與
workflow control 如何串起來。

目前 README 只維護三類入口：

- 命令表面導讀
- spec / snapshot 讀法與 DDD mindset 導讀
- zh-TW immersive walkthrough 系列

## 先讀

| 入口 | 何時讀 |
|---|---|
| [Dflow 命令表面導讀](dflow-command-surface.md) | 第一次讀 Dflow tutorial，先釐清 `dflow init`（全域安裝後）或 `npx dflow-sdd-ddd init`（no-install 路徑）、`/dflow:*` workflow commands、verify / review / control commands 的分工。 |
| [如何閱讀 Dflow 規格與完整文件範例](how-to-read-dflow-specs.md) | 讀 walkthrough 前，先理解 feature `_index.md`、phase / BUG specs、BC layer、完整文件範例的分工。 |
| [給資深工程師的 DDD 觀念翻轉指南](DDD_MINDSET_SHIFT.md) | 想先理解 DDD 對 AI 協作的價值：為什麼 Dflow 要先談 bounded context、Aggregate、business rules，再讓 AI 寫 code。 |

## Walkthrough 系列

建議第一次閱讀時按 00-06 順序走完一條線；每篇也保留前情提要與閱讀提示，可以單篇閱讀。

### Greenfield: Alice / ExpenseTracker

Alice 從零建立 ExpenseTracker。這條線展示 Greenfield track 如何從第一個 feature
進到新 phase、輕量規則修改、bug fix，最後把 feature 收到 completed。00 / 01 先建立
專案背景與 Dflow baseline，02 之後才進入日常 `/dflow:*` workflow。

| Walkthrough | 重點 |
|---|---|
| [Greenfield setup：Alice / ExpenseTracker 的起點](01-greenfield/walkthrough-00-setup.md) | Alice / ExpenseTracker 的 Greenfield 起點、Clean Architecture repo、第一個 BC 不預先硬切。 |
| [`dflow init` 建立 Greenfield baseline](01-greenfield/walkthrough-01-init-project.md) | Greenfield baseline、file-list preview、AI tool shims。 |
| [`/dflow:new-feature` 建立第一個 Expense feature](01-greenfield/walkthrough-02-new-feature.md) | 從 AI 對話、DDD discovery、step gate 到第一批 Expense feature 文件產出。 |
| [`/dflow:new-phase` 在同一 feature 內新增主管審核](01-greenfield/walkthrough-03-new-phase.md) | Supervisor approval phase、Delta markup、ApprovalDecision Aggregate、BR snapshot regenerate。 |
| [`/dflow:modify-existing` 調整 BR-007 reject reason 長度](01-greenfield/walkthrough-04-modify-existing.md) | T2 lightweight spec、BR-007 bilingual length delta、Current BR Snapshot regenerate。 |
| [`/dflow:bug-fix` 修正 reject reason emoji 截斷](01-greenfield/walkthrough-05-bug-fix.md) | T2 bug-fix、BUG-001、emoji surrogate truncation、BR snapshot intentionally unchanged。 |
| [`/dflow:finish-feature` 收尾第一個 Expense feature](01-greenfield/walkthrough-06-finish-feature.md) | Finish-feature、BR snapshot sync、completed archive、Integration Summary。 |

### Brownfield: Bob / OrderManager

Bob 維護既有 OrderManager WebForms 系統。這條線展示 Brownfield track 如何避免一開始就重構，
而是從具體修改需求進入、捕捉 baseline、逐步抽出 Order domain logic。00 / 01 先建立
legacy system context 與 Brownfield baseline，02 之後才開始修改既有行為。

| Walkthrough | 重點 |
|---|---|
| [Brownfield setup：Bob / OrderManager 的起點](02-brownfield/walkthrough-00-setup.md) | Bob / OrderManager 的 Brownfield 起點、WebForms legacy 風險、候選 BC 不預建。 |
| [`dflow init` 建立 Brownfield baseline](02-brownfield/walkthrough-01-init-project.md) | Brownfield baseline、migration tech debt、no production code change。 |
| [`/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic](02-brownfield/walkthrough-02-modify-existing.md) | 從 WebForms 客訴、baseline contrast、T1 判定到第一段 Domain extraction。 |
| [baseline capture 跨頁面折扣顯示行為](02-brownfield/walkthrough-03-baseline-capture.md) | Baseline-only、confirmed / buggy / unknown 分流、跨頁面 behavior capture。 |
| [`/dflow:new-feature` 在既有 Order BC 上新增 VIP discount policy](02-brownfield/walkthrough-04-new-feature.md) | 第二個 Order feature、Customer reference data 邊界、VIP discount BR-005~008。 |
| [`/dflow:bug-fix` 修正跨頁 rounding inconsistency](02-brownfield/walkthrough-05-bug-fix.md) | T2 bug-fix、BUG-001、rounding display contract、BR snapshot intentionally unchanged。 |
| [`/dflow:finish-feature` 收尾第一個 Order feature](02-brownfield/walkthrough-06-finish-feature.md) | Finish-feature、BR snapshot sync、completed archive、Integration Summary。 |

## 目前狀態

Greenfield walkthrough 00-06 與 Brownfield walkthrough 00-06 的 zh-TW immersive 版本已列入上方表格。
English adaptations 會在中文版形狀穩定後再做。
