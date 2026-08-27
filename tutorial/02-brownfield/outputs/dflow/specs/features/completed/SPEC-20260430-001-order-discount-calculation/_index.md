---
spec-id: SPEC-20260430-001
slug: order-discount-calculation
status: completed
created: 2026-04-30
branch: feature/SPEC-20260430-001-order-discount-calculation
---

<!-- dflow:section metadata -->
# Order Discount Calculation

<!-- dflow:section goals-scope -->
## Goals & Scope

本 feature 建立 Order BC 的第一個正式修改入口，處理經銷商「華昕貿易」回報的訂單折扣計算錯誤：滿 NT$50,000 的 9 折與老客戶額外 5% off 必須依業務期望累積，而不是只套用滿額折扣。

Phase 1 `baseline-and-fix` 同時包含三件事：先 baseline capture `OrderEntry.aspx.cs` 的折扣行為、修正折扣累積 bug、把折扣計算抽出為可測試的 `src/Domain/Order/` Domain logic。

本 feature 的邊界刻意限制在 `OrderEntry.aspx.cs` 的折扣計算路徑。`OrderList.aspx.cs`、`OrderDetail.aspx.cs` 或其他頁面若也有相同規則，先記為 tech debt，不在本 phase 擴張。

<!-- dflow:section phase-specs -->
## Phase Specs

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-04-30 | baseline-and-fix | completed | [phase-spec-2026-04-30-baseline-and-fix.md](./phase-spec-2026-04-30-baseline-and-fix.md) |

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 | phase-1 | phase-1 | active |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off（price multiplier 0.9）。 | phase-1 | phase-1 | active |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off（price multiplier 0.95）。 | phase-1 | phase-1 | active |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 | phase-1 | phase-1 | active |

2026-05-08 BUG-001 note: Current BR Snapshot intentionally not regenerated. BR-001~004 wording unchanged; the root cause is Presentation-layer display rounding contract drift, not a BR-level delta.

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-04 | baseline | Baseline-only capture：已補 `OrderList.aspx.cs` 與 `OrderDetail.aspx.cs` 的跨頁 confirmed behavior，詳見 [`behavior.md`](../../../domain/Order/behavior.md#confirmed-across-pages-baseline-capture-2026-05-04)；新發現的 rounding / `isVip` debt 已記錄於 [`tech-debt.md`](../../../migration/tech-debt.md)。本 row 無對應 spec 檔。 | c58d213 |
| 2026-05-08 | T2 | Bug-fix: 修正 `OrderList` / `OrderEntry` / `OrderDetail` 跨頁 display rounding inconsistency，見 [`BUG-001-rounding-inconsistency.md`](./BUG-001-rounding-inconsistency.md)。 | 9f2e470 |

> **兩格填的都是「那一列自己的 commit」。** baseline 列填的是把 confirmed behavior
> 寫進 `behavior.md` 的那個 commit；T2 列填的是 BUG-001 的實作 commit。
> **不是 closeout 的 hash**——hosted row 的格子由 host 的下一個 commit 回填，
> 而 05-08 那列之後沒有新 phase 了，所以由 closeout 回填
> （`references/finish-feature-flow.md` Step 4 指令 1）。
>
> ⚠ **還沒填的時候留空，不要寫 `n/a - ...`、`{pending}` 這類字樣。** 佔位字串是**非空**的，
> 於是**所有照空／非空判的規則**都會把它讀成「有 hash」。
> ⚠ **誰會解這一格？不是 closeout 的 Step 1。** 本 host 是 phase-bearing，而 Step 1 的
> hash evidence 整組標著 `Minimal host (zero-phase) only`——`finish-feature-flow.md`
> 還明寫 phase-bearing host 的 `Tier = baseline` 列「**永遠到不了這個檢查**」。
> 接手的是 `references/pr-review-checklist.md` 的 hosted `Commit` 欄 identity 項，
> 加上 closeout 這一側的 Step 4 指令 1；兩者都是去**解析**這個值。
> baseline 列同樣要有 hash：capture 必須由那個 commit **新增或修改**（只是存在於它的
> 樹裡不算數）。⚠ **本 host 是 phase-bearing，所以走的是這條較弱的要求**；同一種
> `Tier = baseline` 列如果掛在**最小 host** 上，Step 1 會多要求那份 capture **存在於該
> commit 的樹裡**（見 `SPEC-20260511-001-shipment-fee-baseline`）。差別在 **host 形狀**，
> 不在 tier。

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> **五列。** phase 1 是一次 T1（spec / implementation 兩點；第三點 closeout 由整個
> feature 共用），2026-05-04 的 baseline capture 記一列 `spec-baseline`，
> BUG-001 是 T2（spec 與實作合併成一個 commit，記一列 `implementation`），最後是 closeout。
> T1 的 spec 那一點在帳本裡叫 **`spec-baseline`**；範本的合法值只有 `branch-override` /
> `spec-baseline` / `implementation` / `closeout` 四個，不要自己寫 `spec`。
>
> ⚠ **closeout 那列不帶 hash**：一個 commit 沒辦法把自己的 hash 寫進自己裡面。
> 溯源用 `git log -1 -- completed/SPEC-20260430-001-order-discount-calculation`。

| Timestamp | Checkpoint | Result |
|---|---|---|
| 2026-04-30 10:15 | spec-baseline | committed (a71c05e) |
| 2026-05-02 16:50 | implementation | committed (3e9b64f) |
| 2026-05-04 14:05 | spec-baseline | committed (c58d213) |
| 2026-05-08 11:40 | implementation | committed (9f2e470) |
| 2026-05-12 09:30 | closeout | committed |

<!-- dflow:section resume-pointer -->
## Resume Pointer

**Current Progress**: feature completed 2026-05-12；phase 1 `baseline-and-fix` 與 `BUG-001-rounding-inconsistency` 均已上線並通過 regression verification。

**Next Action**: integration — push / merge / PR per the selected Git policy.

**Active Workflow**: none

**Current Step**: n/a

**Gates Passed**: n/a

**Awaiting**: none
