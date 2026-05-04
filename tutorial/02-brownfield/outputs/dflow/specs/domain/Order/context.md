---
context: Order
chinese-name: 訂單
owner: OrderManager 維運團隊
created: 2026-04-30
---

# Order Bounded Context

## Responsibilities

Order BC 負責接單流程中的訂單主體、訂單明細、金額計算與提交前後的訂單規則。第一個已確認範圍是 OrderEntry 的折扣前總額與折扣計算；2026-05-05 起新增 VIP 合約折扣計算，作為後續 ASP.NET Core migration 可攜 Domain logic 的延伸。

## Boundaries

### In Scope
- 訂單主體與 OrderLine 明細的基本一致性。
- 折扣前總金額計算。
- 滿額折扣與客戶等級折扣的套用順序與累積規則。
- VIP 客戶在合約有效期內的 7% off 折扣計算，以及 VIP / Senior / 滿額折扣的 stack order。
- `OrderEntry.aspx.cs` 中可抽離為純 C# 的折扣計算。

### Out of Scope
- 客戶主檔、付款條件與信用額度 → 由 Customer 處理。
- Customer BC 暫不正式建立；本 feature 只透過 Customer reference data 讀取 `CustomerTier`、VIP eligibility 與 `ContractValidUntil`，不建立 Customer Aggregate。
- 庫存量、預留與 AvailableToPromise → 由 Inventory 處理。
- 出貨流程、物流狀態與出貨條件 → 由 Shipment 處理。
- 發票、稅務、應收帳款與財務狀態 → 由 Invoice 處理。

## Core Domain Models

### Entities
- **Order** — Aggregate Root，持有 OrderLine 集合並計算總額。
- **OrderLine** — 訂單中的單一品項明細。

### Value Objects
- **Money** — 金額與幣別。
- **Quantity** — 數量與單位。
- **DiscountRate** — 折扣率與合法範圍。
- **ContractValidUntil** — VIP 合約有效期限，封裝 `ContractValidUntil >= OrderDate` 的 inclusive boundary。

### Domain Services
- **DiscountPolicy** — 滿額折扣與客戶等級折扣的計算規則。

## Interactions with Other Contexts

| Other Context | Interaction Type | Description |
|---|---|---|
| Customer | Reference data | OrderEntry 讀取 `CustomerTier`、VIP eligibility 與 `ContractValidUntil`；Customer BC 尚未正式建立。 |
| Inventory | Supplier | OrderLine 可能需要可售量資訊，但本 phase 不處理庫存預留。 |
| Shipment | Downstream | 訂單成立後進入出貨流程，本 phase 不改出貨規則。 |
| Invoice | Downstream | 發票與稅務計算不在本 phase 範圍。 |

## Key Business Rules

1. 訂單折扣前總金額為 OrderLine 小計加總。
2. 訂單總額大於或等於 NT$50,000 時套用滿額折扣。
3. `CustomerTier = 'Senior'` 時套用額外客戶等級折扣。
4. 多個折扣率以乘法累積，不以簡單加總相減。
5. VIP 客戶且合約有效時可額外套用 7% off，並可與滿額 / Senior 折扣 stack。

## Code Mapping

### Current WebForms
- Pages: `OrderManager.Web/Pages/Order/OrderEntry.aspx`
- Code-Behind: `OrderManager.Web/Pages/Order/OrderEntry.aspx.cs`
- EF entities: `OrderManager.DataAccess.Entities.Order`, `OrderManager.DataAccess.Entities.OrderLine`, `OrderManager.DataAccess.Entities.Customer`
- Domain: `src/Domain/Order/`

### Future ASP.NET Core
- 預計作為 ASP.NET Core Order module 的 Domain layer，可由 controller / application service adapter 呼叫。

## Open Questions

- Order BC 與 Customer / Inventory 的關係仍待後續 phase 確認。
- Tax、invoice rounding 與財務金額規則是否應由 Invoice BC 擁有，待後續與財務 owner 確認。
- Order status transition 是否屬於本 BC 的下一個抽離目標，待後續修改需求確認。
- Customer BC 何時正式建立，應由 Customer-owned feature 觸發；Order feature 只使用 reference data contract。
