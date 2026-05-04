# Order — Behavior Specification

> **Purpose**: Order context current behavior 的 consolidated source of truth。
> 不同於 `dflow/specs/features/completed/` 的 historical archive，本檔永遠反映
> accepted specs 之後系統應該遵守的 current behavior。
>
> **Maintenance**: AI 在 completion flow（Step 8.3 / Step 6.3）更新本檔。
> feature completed 時，將 Given/When/Then scenarios merge 到這裡。
> behavior modified 時，用 Delta result 更新對應 section；不要保留 Delta markup。

---

<!-- dflow:section behavior-scenarios -->
## Order Discount Calculation

### BR-001: Pre-discount total

Given 訂單有一筆或多筆 OrderLine items
When 計算 order pre-discount total
Then 結果為每一筆 `OrderLine.UnitPrice * Quantity` 的加總

### BR-002: Full-threshold discount

Given order pre-discount total 大於或等於 NT$50,000
When DiscountPolicy evaluates the order
Then 套用 10% full-threshold discount

### BR-003: Senior customer discount

Given customer 的 `CustomerTier = 'Senior'`
When DiscountPolicy evaluates the order
Then 額外套用 5% customer-tier discount

### BR-004: Compound discount accumulation

Given order 同時符合 full-threshold discount 與 Senior customer discount
When DiscountPolicy calculates the final discount
Then 先套用 full-threshold discount
And 再套用 customer-tier discount
And total discount rate 為 `1 - (1 - fullThresholdRate) * (1 - customerTierRate)`
And NT$60,000 Senior customer order 在稅務處理前的 final amount 為 NT$51,300

## Confirmed across pages (baseline-capture 2026-05-04)

### BR-004: OrderList discounted total uses compound discount accumulation

Source pages: `OrderManager.Web/Pages/Order/OrderList.aspx.cs` class `OrderList`, method `BindGrid()`；`OrderManager.Web/Pages/Order/OrderDetail.aspx.cs` class `OrderDetail`, method `LoadDiscountSummary()`。

Given 同一筆 order 同時符合 full-threshold discount 與 Senior customer discount
When `OrderList.BindGrid()` 計算 `Discounted Total` column
Then 使用 `1 - (1 - fullRate) * (1 - tierRate)` 作為 total discount rate
And 公式與 BR-004 compound discount accumulation 一致

### BR-004: OrderDetail discount summary uses the shared discount summary source

Source pages: `OrderManager.Web/Pages/Order/OrderList.aspx.cs` class `OrderList`, method `BindGrid()`；`OrderManager.Web/Pages/Order/OrderDetail.aspx.cs` class `OrderDetail`, method `LoadDiscountSummary()`；stored procedure `usp_GetOrderDiscountSummary`。

Given `OrderList` 與 `OrderDetail` 顯示同一個 `OrderId`
When 兩個頁面都從 `usp_GetOrderDiscountSummary` 載入 discount summary data
Then 在相同 inputs 下，discounted total 的 source 一致
And 兩個頁面預期都反映 BR-004 compound discount accumulation

## Lifecycle Notes

- BR-001~004 finalized on 2026-05-12 by `SPEC-20260430-001-order-discount-calculation` completion.
- Baseline-capture scenarios remain here as accepted cross-page behavior history; do not delete them during SPEC-001 archive.
- BR-005~008 remain owned by in-progress `SPEC-20260505-002-vip-discount-policy`; their behavior sections stay in this cumulative Order BC document but are not finalized by SPEC-001 closeout.

## VIP Discount Policy

### BR-005: VIP contract-valid discount

Given customer reference data 顯示客戶具備 VIP eligibility
And `ContractValidUntil >= OrderDate`
When DiscountPolicy evaluates the order
Then 額外套用 VIP discount 7% off
And VIP discount multiplier 為 `0.93`

### BR-006: Expired VIP contract fallback

Given customer reference data 顯示客戶具備 VIP eligibility
And `ContractValidUntil < OrderDate`
When DiscountPolicy evaluates the order
Then 不套用 VIP discount
And 訂單仍依 BR-002、BR-003、BR-004 的一般折扣規則計算

### BR-007: VIP discount stacking order

Given order 同時符合 full-threshold discount、VIP discount 與 Senior customer-tier discount
When DiscountPolicy calculates the final discount
Then discount order 為 full-threshold -> VIP -> Senior
And total discount rate 為 `1 - (1 - fullRate) * (1 - vipRate) * (1 - tierRate)`

### BR-008: VIP and Senior can stack

Given 同一客戶同時具備有效 VIP contract 與 Senior customer-tier
When DiscountPolicy evaluates discounts
Then 業務允許 VIP discount 與 Senior customer-tier discount 同時套用
And 不因 customer 同時屬於 VIP 與 Senior 而互斥

#### Edge cases

- EC-001: Given Order 沒有 OrderLine items When 建立 Order Then 拒絕 construction。
- EC-002: Given OrderLine 有 zero 或 negative UnitPrice When 建立 OrderLine Then 拒絕 construction。
- EC-003: Given DiscountRate 超出 `[0.0, 1.0]` When 建立 DiscountRate Then 拒絕 construction。
- EC-004: Given order total 剛好 NT$50,000 When DiscountPolicy evaluates it Then 套用 full-threshold discount。
- EC-005: Given `ContractValidUntil` 等於 `OrderDate` When DiscountPolicy evaluates VIP eligibility Then 視為合約有效。
- EC-006: Given `ContractValidUntil` 早於 `OrderDate` When DiscountPolicy evaluates VIP eligibility Then 視為合約過期。
- EC-007: Given Customer reference data 找不到 VIP contract info When DiscountPolicy evaluates discounts Then 不套用 VIP discount。

---

<!-- 
Maintenance notes:
- 依 feature area 組織，不依 spec ID 組織。
- Keep BR-IDs in sync with rules.md.
- 本檔記錄 accepted behavior；phase-spec 記錄舊的 buggy contrast。
-->
