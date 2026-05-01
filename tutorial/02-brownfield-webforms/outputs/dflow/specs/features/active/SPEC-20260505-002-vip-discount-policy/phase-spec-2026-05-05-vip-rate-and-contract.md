---
id: SPEC-20260505-002-P1
title: VIP Rate and Contract Validity
status: in-progress
bounded-context: Order
created: 2026-05-05
author: Bob
branch: feature/SPEC-20260505-002-vip-discount-policy
---

# VIP Rate and Contract Validity

<!-- dflow:section problem-description -->
## Problem Description

業務經理 Daniel 提出新的 VIP loyalty program：VIP 客戶的訂單若落在 VIP 合約有效期內，需額外套用 7% off；合約過期則回到一般折扣規則。Daniel 同時確認 `OrderList.aspx.cs` 舊有 `isVip * 0.93` 是五年前促銷殘留，可以刪除。

本 phase 不把 legacy `isVip * 0.93` 寫成 BR。正式 BR 只描述新業務需求：VIP eligibility、合約有效期、折扣 stack order，以及 VIP 與 Senior 是否可同時享有折扣。Legacy dead code removal 只列為 implementation cleanup task，並回寫 `tech-debt.md` resolved note。

<!-- dflow:section domain-concepts -->
## Domain Concepts

| Concept | Type | Description |
|---|---|---|
| CustomerTier | Reference value | 新增 `VIP` 值；Order BC 只消費 Customer reference data，不擁有 Customer Aggregate。 |
| ContractValidUntil | Value Object | 表示 VIP 合約有效期限，封裝 `ContractValidUntil >= OrderDate` 的 inclusive boundary 判斷。 |
| DiscountPolicy | Domain Service | 擴張既有折扣策略，新增 VIP 折扣路徑，同時保留 BR-001~004 的既有方法與行為。 |
| Customer reference data | External data | 從 Customer 主檔或 repository 取得 VIP eligibility 與合約有效期；本 feature 不正式建立 Customer BC。 |

<!-- dflow:section behavior-scenarios -->
## Behavior Scenarios

### Main Success Scenario

```gherkin
Scenario: VIP 客戶在合約有效期內套用 VIP 7% off
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 為 2026-12-31
  And OrderDate 為 2026-05-05
  And 訂單折扣前總額為 NT$60,000
  When DiscountPolicy evaluates the order
  Then 先依 BR-002 套用滿額折扣 multiplier 0.9
  And 再依 BR-005 套用 VIP discount multiplier 0.93
  And 若該客戶也符合 Senior 條件，最後再依 BR-003 套用 multiplier 0.95
```

### Alternative Scenarios

```gherkin
Scenario: VIP 客戶合約已過期時回到一般折扣規則
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 為 2026-05-04
  And OrderDate 為 2026-05-05
  And 訂單折扣前總額為 NT$60,000
  When DiscountPolicy evaluates the order
  Then 不套用 VIP discount multiplier 0.93
  And 仍依 BR-002~BR-004 評估滿額折扣與 Senior customer-tier 折扣
```

```gherkin
Scenario: 合約到期日當天仍視為有效
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 為 2026-05-05
  And OrderDate 為 2026-05-05
  When DiscountPolicy evaluates VIP eligibility
  Then VIP contract 視為有效
  And 可套用 VIP discount multiplier 0.93
```

```gherkin
Scenario: VIP 與 Senior 同時符合時允許 stack
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 大於或等於 OrderDate
  And customer 同時符合 Senior customer-tier discount
  And 訂單折扣前總額大於或等於 NT$50,000
  When DiscountPolicy calculates the final discount
  Then discount order 為 full-threshold -> VIP -> Senior
  And total discount rate 為 `1 - (1 - fullRate) * (1 - vipRate) * (1 - tierRate)`
```

<!-- dflow:section business-rules -->
## Business Rules

| BR-ID | Rule | Notes |
|---|---|---|
| BR-005 | VIP 客戶且 `ContractValidUntil >= OrderDate` 時，額外套用 VIP 7% off（multiplier 0.93）。 | 2026-05-05 SPEC-002 ADDED。 |
| BR-006 | VIP 合約過期時不套用 VIP 7% off，但仍依一般折扣規則計算。 | 2026-05-05 SPEC-002 ADDED。 |
| BR-007 | 多折扣 stack order 為 full-threshold -> VIP -> Senior；公式為 `1 - (1 - fullRate) * (1 - vipRate) * (1 - tierRate)`。 | 2026-05-05 SPEC-002 ADDED。 |
| BR-008 | VIP eligibility 與 Senior customer-tier 可以同時存在，業務允許同時 stack。 | Daniel 於 2026-05-05 確認。 |

<!-- dflow:section delta-from-prior-phases -->
## Delta from prior phases

首 phase，無前置 Delta。本 feature 是 Order BC 的第二個 feature，但不是 `SPEC-20260430-001` 的 phase 2；它建立獨立 feature directory，並以 Order BC 既有 BR-001~004 為互動基準。

### ADDED - BR / behavior added in this phase

#### Rule: BR-005 VIP contract-valid discount
Given 客戶具備 VIP eligibility
When `ContractValidUntil >= OrderDate`
Then 套用 VIP 7% off

#### Rule: BR-006 Expired VIP contract fallback
Given 客戶具備 VIP eligibility
When `ContractValidUntil < OrderDate`
Then 不套用 VIP 7% off，並回到一般折扣規則

#### Rule: BR-007 VIP discount stacking order
Given 滿額折扣、VIP 折扣與 Senior 折扣都適用
When 計算最終折扣
Then 依 full-threshold -> VIP -> Senior 的順序乘法累積

#### Rule: BR-008 VIP and Senior can stack
Given 同一客戶同時符合 VIP contract 與 Senior customer-tier
When DiscountPolicy evaluates discounts
Then 業務允許兩者同時套用

### UNCHANGED - explicitly unaffected

- BR-001 pre-discount total calculation 不變。
- BR-002 full-threshold discount threshold 與 rate 不變。
- BR-003 Senior customer-tier 5% off 不變。
- BR-004 原本的 full-threshold -> Senior compound formula 保留；當 VIP 不適用時仍產生相同結果。

<!-- dflow:section edge-cases -->
## Edge Cases

| ID | Case | Expected Handling |
|---|---|---|
| EC-01 | `ContractValidUntil` 等於 `OrderDate` | 視為有效，套用 VIP 7% off。 |
| EC-02 | `ContractValidUntil` 早於 `OrderDate` 一秒 | 視為過期，不套用 VIP 7% off。 |
| EC-03 | `ContractValidUntil` 晚於 `OrderDate` 一秒 | 視為有效，套用 VIP 7% off。 |
| EC-04 | `ContractValidUntil` 不是合法日期 | 拒絕建立 `ContractValidUntil` Value Object。 |
| EC-05 | `ContractValidUntil` 超過目前日期 10 年以上 | 視為 suspicious reference data，拒絕建立或要求資料修正。 |
| EC-06 | Customer reference data 找不到 VIP contract info | 預設不套用 VIP 折扣，並記錄 telemetry / warning，避免猜測業務狀態。 |

<!-- dflow:section implementation-notes -->
## Implementation Notes

### Current WebForms Implementation

`OrderEntry.aspx.cs` 已在 `SPEC-20260430-001` phase 1 後呼叫 `DiscountPolicy`，本 phase 只新增 VIP 計算輸入與 branch。`OrderList.aspx.cs` 既有 `if (customer.IsVip) { discountedTotal *= 0.93m; }` 已由業務確認為 dead code，需在 implementation task 中移除，但它不是新 BR 的 source。

### Domain Layer Design

擴張既有 `DiscountPolicy`，避免重寫 BR-001~004 的既有 method：

```csharp
public sealed class DiscountPolicy
{
    public Money ApplyDiscounts(
        Money preDiscountTotal,
        CustomerTier customerTier,
        ContractValidUntil? contractValidUntil,
        DateOnly orderDate);

    public DiscountRate CalculateVipDiscount(
        CustomerTier customerTier,
        ContractValidUntil? contractValidUntil,
        DateOnly orderDate);
}
```

`ContractValidUntil` 封裝 inclusive comparison 與 constructor validation；Customer reference repository 只提供資料，不擁有折扣判斷。

### Keep Code-Behind Thin

`OrderEntry.aspx.cs` 只負責取得 `customerId`、讀 Customer reference data、map 成 Domain input、呼叫 `DiscountPolicy`、顯示結果。VIP eligibility、合約有效期與 stack order 不寫在 Code-Behind。

### Future ASP.NET Core Migration Considerations

`ContractValidUntil`、`DiscountPolicy` 與 Customer reference interface 應保持 pure C#，未來可直接搬到 ASP.NET Core Order module。Customer BC 若日後正式建立，Order BC 可透過 anti-corruption adapter 接收同樣的 reference data contract。

<!-- dflow:section data-structure-changes -->
## Data Structure Changes

本 phase 不新增 database schema。`ContractValidUntil` 先從既有 Customer 主檔或既有 reference query 取得；最終欄位來源需在 implementation 前由 Bob 與資料 owner 確認。

| Table | Column | Change Type | Description |
|---|---|---|---|
| Customer master | `ContractValidUntil` or equivalent existing field | reuse existing | 只讀 reference data；本 feature 不改 schema。 |

<!-- dflow:section test-strategy -->
## Test Strategy

- [ ] BR-005：VIP + contract valid + NT$60,000 order 會套用 full-threshold 與 VIP discount。
- [ ] BR-006：VIP contract expired 時不套用 VIP discount，但仍套用滿額與 Senior 規則。
- [ ] BR-007：full-threshold -> VIP -> Senior stacking order 產生 `1 - (1 - fullRate) * (1 - vipRate) * (1 - tierRate)`。
- [ ] BR-008：VIP 與 Senior 同時符合時允許 stack。
- [ ] `ContractValidUntil` 邊界測試：到期日當天、前一秒、後一秒。
- [ ] `ContractValidUntil` validation 測試：invalid date 與 10 年外 suspicious date。

<!-- dflow:section open-questions -->
## Open Questions

- `ContractValidUntil` 最終從哪個 Customer 主檔欄位或 repository query 取得，需要 implementation 前與資料 owner 確認。
- 若 Customer BC 日後正式建立，`CustomerTier`、VIP eligibility 與 contract validity 是否要搬到 Customer-owned feature 重新建模。
- `OrderList.aspx.cs` dead code removal 是否需要 UI regression 截圖確認；它不改 BR，但會改 legacy 顯示路徑。

<!-- dflow:section implementation-tasks -->
## Implementation Tasks

- [ ] DOMAIN-1: 將 `CustomerTier` reference value 加入 `VIP`，並保留 `Senior` customer-tier discount 判斷。
- [ ] DOMAIN-2: 建立 `ContractValidUntil` Value Object，實作合法日期、10 年外 suspicious date、inclusive boundary validation。
- [ ] DOMAIN-3: 擴張 `DiscountPolicy`，新增 VIP discount path，保留既有 BR-001~004 方法與行為。
- [ ] DOMAIN-4: 實作 full-threshold -> VIP -> Senior stacking order，並覆蓋 VIP 與 Senior 同時符合的組合。
- [ ] WEBFORMS-1: 在 `OrderEntry.aspx.cs` 讀取 Customer reference data，將 VIP eligibility 與 `ContractValidUntil` map 成 Domain input。
- [ ] WEBFORMS-2: 移除 `OrderList.aspx.cs` 的 legacy `isVip * 0.93` dead code；此清理對應 `tech-debt.md` resolved item，不寫成 BR。
- [ ] INFRA-1: 在 Customer reference repository 增加 `GetVipContractInfo(customerId)` 或等價 query。
- [ ] TEST-1: 新增 BR-005 到 BR-008 的 Domain unit tests。
- [ ] TEST-2: 新增 `ContractValidUntil` 到期日當天、前一秒、後一秒與 invalid/far-future validation tests。
- [ ] TEST-3: 新增 stacking order tests，確認 VIP 不會破壞 BR-001~004 的既有結果。
