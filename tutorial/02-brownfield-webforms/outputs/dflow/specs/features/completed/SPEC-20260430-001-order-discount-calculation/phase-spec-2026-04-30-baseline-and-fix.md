---
id: SPEC-20260430-001-P1
title: Baseline and Fix Order Discount Calculation
status: in-progress
bounded-context: Order
created: 2026-04-30
author: Bob
branch: feature/SPEC-20260430-001-order-discount-calculation
---

# Baseline and Fix Order Discount Calculation

<!-- dflow:section problem-description -->
## Problem Description

客服團隊轉來經銷商「華昕貿易」的客訴：上週一筆訂單符合滿 NT$50,000 9 折與老客戶額外 5% off，但系統最後只套用滿額 9 折。Bob 在 dev 環境用相同條件重現後，確認 `OrderEntry.aspx.cs` 的 `btnSubmit_Click` 折扣計算路徑沒有正確套用客戶等級折扣。

這不是單純一行 hotfix。折扣計算目前黏在 `btnSubmit_Click` event handler 中，混合 UI 讀值、EF query、金額計算與 DB 寫回，缺少 spec 與 unit test。本 phase 先 capture OrderEntry 的折扣 baseline，再修正折扣累積規則，並把可測試的折扣 Domain logic 抽到 `src/Domain/Order/`。

<!-- dflow:section domain-concepts -->
## Domain Concepts

| Concept | Type | Description |
|---|---|---|
| Order | Aggregate Root | 訂單主體，持有 OrderLine 集合並負責計算折扣前總額與折扣後總額。 |
| OrderLine | Entity | 訂單明細項，包含商品、單價與數量。 |
| Money | Value Object | 表示金額與幣別，避免以裸 `decimal` 傳遞金額。 |
| Quantity | Value Object | 表示數量與單位，封裝數量合法性。 |
| DiscountRate | Value Object | 表示折扣率，合法範圍為 `[0.0, 1.0]`。 |
| DiscountPolicy | Domain Service | 封裝滿額折扣與客戶等級折扣的判定、順序與累積公式。 |
| CustomerTier | External reference value | Order 計算折扣時讀取的客戶等級；本 phase 只使用 `Senior` 判定，不建立 Customer BC model。 |

Baseline code inspection（基準碼閱讀）：

```csharp
// OrderManager.Web/Pages/Order/OrderEntry.aspx.cs
// lines 142-187, class OrderEntry, method btnSubmit_Click
protected void btnSubmit_Click(object sender, EventArgs e)
{
    var customerId = int.Parse(hdnCustomerId.Value);
    var customer = db.Customers.Single(c => c.Id == customerId);
    var lines = BuildLinesFromGrid(gvOrderLines);

    decimal gross = 0m;
    foreach (var row in lines)
    {
        gross += row.UnitPrice * row.Quantity;
    }

    decimal discount = 0m;
    if (gross >= 50000m)
    {
        discount += 0.10m;
    }

    if (customer.CustomerTier == "Senior")
    {
        seniorDiscount = 0.05m;
        // BUG: seniorDiscount is calculated but not applied to discount.
    }

    var total = Math.Round(gross * (1 - discount), 0, MidpointRounding.AwayFromZero);
    db.Orders.Add(new OrderEntity { CustomerId = customerId, GrossAmount = gross, NetAmount = total });
    db.SaveChanges();
}
```

<!-- dflow:section behavior-scenarios -->
## Behavior Scenarios

### Main Success Scenario

```gherkin
Scenario: Senior customer 同時套用滿額折扣與客戶等級折扣
  Given 經銷商 "華昕貿易" 的 CustomerTier 為 "Senior"
  And 訂單折扣前總額為 NT$60,000
  When Bob 在 OrderEntry 提交訂單
  Then 先套用滿額折扣 multiplier 0.9
  And 再套用客戶等級折扣 multiplier 0.95
  And 稅務處理前的最終金額為 NT$51,300
```

### Baseline Contrast Scenario

```gherkin
Scenario: 既有 Code-Behind 只套用滿額折扣
  Given 本 phase 前的 OrderEntry.aspx.cs 實作
  And Senior 客戶訂單的折扣前總額為 NT$60,000
  When btnSubmit_Click 計算最終金額
  Then code 寫入 NT$54,000，因為只套用 multiplier 0.9
  And 此結果與業務期望 NT$51,300 不一致
```

### Alternative Scenarios

```gherkin
Scenario: 非 Senior 客戶只套用滿額折扣
  Given CustomerTier 不是 "Senior" 的客戶
  And 訂單折扣前總額為 NT$60,000
  When Bob 在 OrderEntry 提交訂單
  Then 只套用滿額折扣 multiplier 0.9
  And 稅務處理前的最終金額為 NT$54,000
```

```gherkin
Scenario: Senior 客戶未滿門檻時只套用客戶等級折扣
  Given Senior 客戶
  And 訂單折扣前總額為 NT$40,000
  When Bob 在 OrderEntry 提交訂單
  Then 不套用滿額折扣
  And 套用客戶等級折扣 multiplier 0.95
  And 稅務處理前的最終金額為 NT$38,000
```

<!-- dflow:section business-rules -->
## Business Rules

| BR-ID | Rule | Notes |
|---|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 | 從 OrderEntry baseline capture。 |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off。 | 門檻以 TWD 計。 |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off。 | Customer BC 仍未建模，本 phase 使用 reference value。 |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 | bug fix 核心。 |

<!-- dflow:section delta-from-prior-phases -->
## Delta from prior phases

首 phase，無前置 Delta。本 phase 同時建立 baseline 與修正已知 code/spec drift：業務期望為 BR-004 的乘法累積，既有 Code-Behind 實作未做到。

### ADDED - BR / behavior added in this phase

#### Rule: BR-001 Pre-discount total
Given 訂單有一筆或多筆 OrderLine
When 計算訂單折扣前總額
Then 折扣前總額為 `OrderLine.UnitPrice * Quantity` 的加總

#### Rule: BR-002 Full-threshold discount
Given 訂單折扣前總額大於或等於 NT$50,000
When DiscountPolicy 評估折扣
Then 套用滿額 10% off

#### Rule: BR-003 Senior customer discount
Given 客戶的 `CustomerTier = 'Senior'`
When DiscountPolicy 評估折扣
Then 額外套用客戶等級 5% off

#### Rule: BR-004 Compound discount accumulation
Given 滿額折扣與客戶等級折扣都適用
When 計算最終折扣
Then 折扣以乘法累積，不以簡單相減累積

<!-- dflow:section edge-cases -->
## Edge Cases

| ID | Case | Expected Handling |
|---|---|---|
| EC-01 | Order 沒有任何 line | 折扣計算前拒絕；違反 INV-01。 |
| EC-02 | OrderLine unit price 為 0 或負數 | 折扣計算前拒絕；違反 INV-02。 |
| EC-03 | DiscountRate 超出 `[0.0, 1.0]` | 拒絕建立 DiscountRate；違反 INV-03。 |
| EC-04 | Gross amount 剛好 NT$50,000 | 套用滿額折扣，因為規則是 `>= NT$50,000`。 |
| EC-05 | 最終金額有小數 | 依 OrderEntry 既有金額 rounding 處理；本 phase 保留現有 rounding，稅務處理記為 out of scope。 |

<!-- dflow:section implementation-notes -->
## Implementation Notes

### Current WebForms Implementation

`OrderManager.Web/Pages/Order/OrderEntry.aspx.cs` 目前在 `OrderEntry.btnSubmit_Click` 內計算折扣，約位於 lines 142-187。已檢查區塊混合以下責任：

- 查詢 `Customers` 與 `OrderLines` 的 EF query
- 使用裸 `decimal` 計算 gross amount
- magic threshold `50000m`
- discount variables `discount` 與 `seniorDiscount`
- 直接呼叫 `db.Orders.Add(...)` 與 `db.SaveChanges()`

### Domain Layer Design

將計算規則移到 `src/Domain/Order/` 下的 pure C# classes：

```csharp
public sealed class Order
{
    public IReadOnlyCollection<OrderLine> LineItems { get; }
    public Money PreDiscountTotal();
    public Money FinalTotal(CustomerTier tier, DiscountPolicy policy);
}

public sealed class DiscountPolicy
{
    public DiscountRate CalculateTotalDiscount(Money preDiscountTotal, CustomerTier tier);
}
```

Domain layer 不得 reference `System.Web`、EF entities、WebForms controls、ViewState、Session 或 database APIs。

### Keep Code-Behind Thin

`OrderEntry.aspx.cs` 保留解析 UI input、載入 EF entities、map 成 Domain objects、呼叫 `DiscountPolicy`、寫回結果的責任。這個 branch 不重寫整個頁面。

### Future ASP.NET Core Migration Considerations

抽出的 `Order`、`OrderLine`、`Money`、`Quantity`、`DiscountRate` 與 `DiscountPolicy` 應可直接移植到 ASP.NET Core 專案。WebForms-specific mapping 先留在 page layer，未來可轉成 controller / adapter code。

<!-- dflow:section data-structure-changes -->
## Data Structure Changes

本 phase 沒有 database schema changes。

| Table | Column | Change Type | Description |
|---|---|---|---|
| | | | |

<!-- dflow:section test-strategy -->
## Test Strategy

- [ ] Senior customer + NT$60,000 order 在稅務處理前回傳 NT$51,300。
- [ ] Non-Senior customer + NT$60,000 order 在稅務處理前回傳 NT$54,000。
- [ ] Senior customer + NT$40,000 order 在稅務處理前回傳 NT$38,000。
- [ ] 剛好 NT$50,000 會觸發 full-threshold discount。
- [ ] Invalid OrderLine price、empty line items 與 invalid DiscountRate 會在 Domain unit tests 中被拒絕。

<!-- dflow:section open-questions -->
## Open Questions

- 本 phase 的 baseline capture 記錄客戶回饋與 Bob domain understanding 得出的業務期望，不把 buggy code result 當成 source of truth。buggy result 仍記在 Behavior Scenarios 的 baseline contrast，並在本 phase 修正。
- Tax calculation 與 invoice rounding 不在本 phase 範圍；後續確認 Invoice BC 是否擁有 tax-specific rounding。
- Order BC scope 已確認包含 order line totals 與 discount calculation。Customer credit、Inventory reservation、Shipment、Invoice 邊界留待後續 phases。
- `DiscountPolicy` 對本 phase 應該足夠；若後續活動規則變多，再評估是否需要 PolicyChain 或 Strategy pattern。

<!-- dflow:section implementation-tasks -->
## Implementation Tasks

- [ ] DOMAIN-1: 建立 `Order` Aggregate Root，並實作 non-empty `OrderLine` collection invariant。
- [ ] DOMAIN-2: 建立 `OrderLine` entity 與 `Money`、`Quantity`、`DiscountRate` Value Objects。
- [ ] DOMAIN-3: 建立 `DiscountPolicy`，實作 full-threshold 與 Senior customer discount accumulation rules。
- [ ] WEBFORMS-1: 在計算前將 `OrderEntry.aspx.cs` 的 grid input 與 EF customer data map 成 Domain objects。
- [ ] WEBFORMS-2: 以 `DiscountPolicy` call 取代 `btnSubmit_Click` 內的 inline discount arithmetic，同時保持 DB write behavior 不變。
- [ ] TEST-1: 新增 BR-001 到 BR-004 的 Domain unit tests。
- [ ] TEST-2: 新增 INV-01 到 INV-04 與 NT$50,000 boundary 的 edge-case tests。
