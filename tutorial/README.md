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
| [Dflow 命令表面導讀](dflow-command-surface.md) | 第一次讀 Dflow tutorial，先釐清 `dflow init`（全域安裝後）或 `npx dflow-sdd-ddd init`（no-install 路徑）、`--command-adapters`、各工具 `/` parser 叫法、verify / review / control commands 的分工。 |
| [如何閱讀 Dflow 規格與完整文件範例](how-to-read-dflow-specs.md) | 讀 walkthrough 前，先理解 feature `_index.md`、phase / BUG specs、BC layer、完整文件範例的分工。 |
| [給資深工程師的 DDD 觀念翻轉指南](DDD_MINDSET_SHIFT.md) | 想先理解 DDD 對 AI 協作的價值：為什麼 Dflow 要先談 bounded context、Aggregate、business rules，再讓 AI 寫 code。 |

## Walkthrough 系列

建議第一次閱讀時按編號順序走完一條線；每篇也保留前情提要與閱讀提示，可以單篇閱讀。

00-06 是主線：從專案起點走到第一個 feature 收進 `completed/`。**07 之後處理的是主線結束後
才會遇到、但實務上最常見的情況——要改的東西沒有任何 active feature 可以掛。** Dflow 對此有
三條明確路徑（standalone / follow-up / baseline 的最小 host），Greenfield 07-08 與 Brownfield 07
各走一條。

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
| [沒有任何 feature 可掛時：自動開最小 host](01-greenfield/walkthrough-07-standalone-minimal-host.md) | Standalone minimal host、zero-phase、T3 row 騎 checkpoint 1、no-BC closeout、兩個 checkpoint。 |
| [completed feature 上的 orphan bug：follow-up 最小 host](01-greenfield/walkthrough-08-followup-minimal-host.md) | Follow-up minimal host、`follow-up-of`、`bugfix/BUG-*` branch、reverse-link 兩次轉換、非 checkpoint 的 flip commit。 |

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
| [沒有相關 feature 的 baseline capture](02-brownfield/walkthrough-07-baseline-minimal-host.md) | Baseline 最小 host、tier-exempt、`spec-baseline` checkpoint、`Tier = baseline` row、BC 已 precaptured。 |

## 最小 host：三條路徑一次看懂

「要改的東西沒有 active feature 可掛」時，Dflow 依**變更與既有 feature 的關係**分三條路。
三條都開出一個 **zero-phase 最小 host**（有 SPEC-ID、branch、`_index.md`、兩個 checkpoint，
但**沒有** phase-spec），差別在血緣與 branch class：

| 路徑 | 什麼時候走 | branch | 血緣 | 走查 |
|---|---|---|---|---|
| **standalone** | 沒有任何相關 feature（active 或 completed） | `feature/{SPEC-ID}-{slug}`；功能性 bug 走 `bugfix/BUG-*` | 無 | [GF 07](01-greenfield/walkthrough-07-standalone-minimal-host.md) |
| **follow-up** | 有相關的 **completed** feature | 同上，依 change class | `follow-up-of` ＋ 原 feature 的 reverse-link 兩次轉換 | [GF 08](01-greenfield/walkthrough-08-followup-minimal-host.md) |
| **baseline**（Brownfield） | observation-only 的現況捕捉，無相關 feature | `feature/{SPEC-ID}-{slug}`（tier-exempt） | 無（(c) no-feature）；(b) completed-only 走 follow-up 變體 | [BF 07](02-brownfield/walkthrough-07-baseline-minimal-host.md) |

共通的三件事，三篇都會看到：

1. **`_index.md` 的 row 要在 checkpoint 1 之前寫好**——最小 host 沒有「下一個 commit」可以收攏它。
2. **最小 host 的每一列都要宣告碰到的路徑**；一個都沒宣告會**擋下** closeout。這條只管最小 host——掛在既有 feature 底下的 row 從未被要求宣告，closeout 對它們不跑這項檢查。
3. **兩個 checkpoint**（implementation／`spec-baseline`，然後 closeout），不分 tier。
   canonical 的「T3 ＝ 單一 commit」講的是**掛在既有 feature 底下**的 T3。

## 目前狀態

Greenfield walkthrough 00-08 與 Brownfield walkthrough 00-07 的 zh-TW immersive 版本已列入上方表格。
English adaptations 會在中文版形狀穩定後再做。
