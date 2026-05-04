---
spec-id: SPEC-20260430-001
slug: order-discount-calculation
status: completed
created: 2026-04-30
completed_date: 2026-05-12
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

| Date | Type | Description | Commit |
|---|---|---|---|
| 2026-05-04 | baseline-capture | Baseline-only capture：已補 `OrderList.aspx.cs` 與 `OrderDetail.aspx.cs` 的跨頁 confirmed behavior，詳見 [`behavior.md`](../../../domain/Order/behavior.md#confirmed-across-pages-baseline-capture-2026-05-04)；新發現的 rounding / `isVip` debt 已記錄於 [`tech-debt.md`](../../../migration/tech-debt.md)。本 row 無對應 spec 檔。 | n/a - spec capture only |
| 2026-05-08 | T2 | Bug-fix: 修正 `OrderList` / `OrderEntry` / `OrderDetail` 跨頁 display rounding inconsistency，見 [`BUG-001-rounding-inconsistency.md`](./BUG-001-rounding-inconsistency.md)。 | n/a - implemented before closeout |

<!-- dflow:section resume-pointer -->
## Resume Pointer

**Current Progress**: feature completed 2026-05-12；phase 1 `baseline-and-fix` 與 `BUG-001-rounding-inconsistency` 均已上線並通過 regression verification。

**Next Action**: closeout complete；後續改動不得直接追加到本 completed feature，請建立 follow-up feature。See Integration Summary below.

## Integration Summary

### Feature Overview

`SPEC-20260430-001-order-discount-calculation` 是 OrderManager 第一個正式 SDD-driven brownfield feature。它從 `OrderEntry.aspx.cs` 抽出 Order 折扣計算 Domain logic，建立 `Order` Aggregate Root、`OrderLine` Entity、`Money` / `Quantity` / `DiscountRate` Value Objects 與 `DiscountPolicy` Domain Service，並完成跨頁 baseline capture 與 rounding inconsistency bug fix。

### Phases Summary

| Phase | Date | Slug | Summary |
|---|---|---|---|
| 1 | 2026-04-30 | baseline-and-fix | Capture `OrderEntry.aspx.cs` baseline、修正 Senior + full-threshold compound discount bug，並把折扣計算抽到 `src/Domain/Order/`。 |

### Lightweight Changes Summary

| Date | Type | Summary |
|---|---|---|
| 2026-05-04 | baseline-capture | 補 `OrderList.aspx.cs` / `OrderDetail.aspx.cs` 跨頁 confirmed behavior；識別 rounding inconsistency 與 `isVip` multiplier tech-debt。 |
| 2026-05-08 | T2 BUG-001 | 修正 `OrderList` / `OrderEntry` / `OrderDetail` display rounding inconsistency；`Money.ToDisplay()` 成為共用 display contract。 |

### Aggregates / Domain Extraction

- Aggregate Root: `Order`
- Entity: `OrderLine`
- Value Objects: `Money`, `Quantity`, `DiscountRate`
- Domain Service: `DiscountPolicy`
- WebForms adapter boundary: `OrderEntry.aspx.cs` 保留 UI parsing、EF mapping 與 DB write；Domain layer 不 reference `System.Web`、EF DbContext、ViewState 或 Session。

### Domain Events

None。本 WebForms brownfield feature 不引入 Domain Events。

### BR Final State

| BR-ID | Final Rule |
|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off（price multiplier 0.9）。 |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off（price multiplier 0.95）。 |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 |

### Tech Debt Outstanding

- `OrderList / OrderEntry / OrderDetail rounding 策略不一致`: resolved by `BUG-001`，三頁面改用 `Money.ToDisplay()` display contract。
- `OrderList isVip multiplier 0.93 規則來源不明`: resolved by `SPEC-20260505-002` disposition，業務確認為 dead code。
- `Order 折扣規則分散在多個頁面`: partially resolved。`OrderEntry` / `OrderList` / `OrderDetail` rounding contract 已統一，但其他 Order 頁面尚未抽離。
- `OrderEntry event handler 仍混合資料存取與流程控制`: open。
- `DiscountPolicy 結構可能需要演進`: open。
- 其他 brownfield baseline tech-debt remains open: 業務邏輯散在 Code-Behind、缺少 unit test coverage、Stored Procedures 重 join 難維護、.NET Core migration long-term goal 未拆小步、無 Dependency Injection 組態。

### Sign-off

- Bob verified phase 1 Domain extraction and BUG-001 implementation completion on 2026-05-12。
- Regression tests verified BR-001~004 and rounding consistency across `OrderList` / `OrderEntry` / `OrderDetail`。
- Carol verified `#ORD-2026-0512` 類型案例三頁面顯示一致。
- 試用主管群三天穩定試用，未回報新的 SPEC-001 blocker。

## Outstanding / Future Considerations

- `SPEC-20260505-002-vip-discount-policy` remains `in-progress` under `features/active/`；本次 closeout 不同步 BR-005~008，也不搬動 SPEC-002。
- 後續 phase 候選：抽離 `OrderEntry.aspx.cs` 剩餘約 50 行 EF query / UI parsing / 狀態設定流程。
- 後續 phase 候選：建立 Order status machine，讓訂單狀態轉換從 WebForms event handler 移到 Domain / application-facing boundary。
- 後續 feature 候選：Customer BC 正式建立，承接 VIP eligibility、合約維護與 Customer reference data owner。
- 本 feature 已完成並凍結；若未來要修正 BR-001~004 或 rounding-related behavior，請走 `/dflow:modify-existing`，建立 follow-up feature，不直接追加 T2/T3 到本 directory。
