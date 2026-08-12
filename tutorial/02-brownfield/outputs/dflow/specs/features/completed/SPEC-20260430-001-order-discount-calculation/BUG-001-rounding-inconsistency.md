---
id: BUG-001
title: Fix rounding inconsistency across Order pages
status: completed
bounded-context: Order
created: 2026-05-08
reported_date: 2026-05-08
tier: T2
related_tech_debt: OrderList / OrderEntry / OrderDetail rounding 策略不一致
branch: feature/SPEC-20260430-001-order-discount-calculation
---

# Fix rounding inconsistency across Order pages

## Problem

試用主管 Carol 回報訂單 `#ORD-2026-0512` 在 `OrderList` grid 顯示折扣後金額為 NT$45,127，但點進 `OrderDetail` 後顯示 NT$45,126.85，兩頁視覺金額差 0.15 元，客戶已來電詢問為什麼同一筆訂單金額不一致。

這不是新的折扣規則。段 3 baseline capture 已把跨頁 rounding 策略不一致記為 tech-debt，今天是同一個 defect 被實際客戶撞上。

## Behavior Delta

BR Delta: none — implementation defect
Governing BR-IDs: BR-001, BR-002, BR-003, BR-004

### UNCHANGED - explicitly unaffected

- BR-001~004 wording unchanged — root cause is Presentation-layer display rounding contract drift, not BR-level delta.
- `Money` 既有不變條件維持：金額 + 幣別仍是 equality components；不新增 Aggregate / VO 結構。
- `DiscountPolicy` 折扣計算結果不變；本修正只收斂跨頁 display contract。

## Root Cause

`OrderList.BindGrid()` 使用 `decimal.Round(value, 0)` 將折扣後金額顯示為整數元；`OrderEntry` / `OrderDetail` 使用 `Math.Round(value, 2)` 或 `ToString("N2")` 顯示到小數兩位。三個頁面各自決定 display precision，導致同一筆訂單在列表頁與明細頁呈現不同視覺金額。

段 3 baseline capture 已將此行為識別為 buggy tech-debt：Domain 層缺少統一的 `Money` display precision contract，Presentation 層因此漂移。

## Fix Approach

在 Domain `Money` VO 周邊新增 `ToDisplay(precision = 2)` method，讓頁面顯示折扣後金額時共用同一個 display contract。預設 precision 為 2 位小數，對齊目前 `OrderEntry` / `OrderDetail` 的財務顯示慣例。

這是 implementation 收斂，不是新 business rule：不改 `Money` invariant、不改 `DiscountPolicy` 折扣公式、不更新 BR-001~004 wording。

Presentation 層改成：

- `OrderList.BindGrid()` column formatter 改用 `money.ToDisplay()`，取代 `decimal.Round(value, 0)`。
- `OrderDetail.LoadDiscountSummary()` 改 call `money.ToDisplay()`，即使結果仍是兩位小數，也要走同一 contract。
- `OrderEntry` 確認 align 到同一 contract，避免提交頁、列表頁、明細頁再度漂移。

<!-- dflow:section implementation-tasks -->
## Implementation Tasks

- [x] DOMAIN-1: `Money` VO 加 `ToDisplay(precision = 2)` method，維持既有 amount + currency invariants。
- [x] DELIVERY-1: `OrderList.BindGrid()` column formatter 改用 `Money.ToDisplay()`。
- [x] DELIVERY-2: `OrderDetail.LoadDiscountSummary()` 改用 `Money.ToDisplay()`。
- [x] DELIVERY-3: `OrderEntry` 顯示折扣後金額時確認 align 到同一 display contract。
- [x] TEST-1: Regression — 同一 Order 在 `OrderList` / `OrderEntry` / `OrderDetail` 顯示折扣後金額一致。
- [x] TEST-2: `Money.ToDisplay` edge cases：0、負數、大數、boundary precision。
- [x] DOC-1: 更新 `_index.md` Lightweight Changes、BR Snapshot note 與 `tech-debt.md` resolved note。

<!-- dflow:section open-questions -->
## Open Questions

- 未來是否要在 `Money` 層支援 locale-specific formatter（例如 `NT$` vs `$`、千分位、文化特定小數位）？本 BUG-001 deferred，先只統一 precision contract。

## Tech Debt Discovered (if any)

- Money locale formatter deferred：若後續需要多幣別或多 locale 顯示，另開 tech-debt / follow-up，不放進本 T2 bug-fix scope。
