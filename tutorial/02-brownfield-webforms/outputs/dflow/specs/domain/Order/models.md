<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Domain Models

> Order bounded context 的 Domain model catalog。

## Context

- **Bounded Context**: Order
- **Source Code Area**: `src/Domain/Order/` and `OrderManager.Web/Pages/Order/OrderEntry.aspx.cs`
- **Last Updated**: 2026-05-05

## Entities

| Entity | Responsibility | Key Identity | Code Mapping | Notes |
|---|---|---|---|---|
| Order | Aggregate Root，持有訂單明細並計算折扣前 / 折扣後總額。 | OrderId | `OrderManager.Domain.Order.Order` | INV-01: `LineItems` 必須至少含一筆 `OrderLine`。 |
| OrderLine | 表示訂單中的單一商品明細，提供 line subtotal。 | OrderLineId or line sequence within Order | `OrderManager.Domain.Order.OrderLine` | INV-02: `UnitPrice.Amount` 必須大於 0。 |

## Value Objects

| Value Object | Responsibility | Equality Components | Code Mapping | Notes |
|---|---|---|---|---|
| Money | 表示金額與幣別，避免 primitive obsession。 | Amount, Currency | `OrderManager.Domain.Order.Money` | 本 phase 使用 TWD；rounding 延續 OrderEntry 既有規則。 |
| Quantity | 表示數量與單位。 | Amount, Unit | `OrderManager.Domain.Order.Quantity` | 數量必須大於 0；單位預設使用既有 OrderLine 單位。 |
| DiscountRate | 表示折扣率。 | Rate | `OrderManager.Domain.Order.DiscountRate` | INV-03: rate 必須在 `[0.0, 1.0]` 內。 |
| ContractValidUntil | 表示 VIP 合約有效期限，封裝到期日 inclusive comparison。 | Date | `OrderManager.Domain.Order.ContractValidUntil` | 2026-05-05 SPEC-002 ADDED；必須是合法日期，且不得超過目前日期 10 年以上。 |

## Domain Services

| Service | Responsibility | Inputs / Outputs | Code Mapping | Notes |
|---|---|---|---|---|
| DiscountPolicy | 判斷滿額折扣、VIP 合約折扣與客戶等級折扣，並以正確公式累積折扣率。 | `Money preDiscountTotal`, `CustomerTier tier`, `ContractValidUntil? contractValidUntil`, `DateOnly orderDate` -> `DiscountRate totalDiscount` | `OrderManager.Domain.Order.DiscountPolicy` | 2026-05-05 SPEC-002 ADDED：擴張 VIP 計算路徑；保留既有 BR-001~004 行為。 |

## Repository Interfaces

| Repository | Aggregate / Entity | Query Responsibility | Code Mapping | Notes |
|---|---|---|---|---|
| CustomerReferenceRepository | Customer reference data | 依 `customerId` 取得 `CustomerTier`、VIP eligibility 與 `ContractValidUntil`。 | `OrderManager.Domain.Order.Interfaces.ICustomerReferenceRepository` | 2026-05-05 SPEC-002 ADDED；Order BC 只消費 reference data，不建立 Customer Aggregate。 |

## Invariants

| ID | Invariant | Enforced By |
|---|---|---|
| INV-01 | `Order.LineItems` 必須至少含一筆 `OrderLine`。 | `Order` constructor / factory |
| INV-02 | 每個 `OrderLine.UnitPrice.Amount` 必須大於 0。 | `Money` / `OrderLine` construction |
| INV-03 | `DiscountRate` 必須在 `[0.0, 1.0]` 內。 | `DiscountRate` construction |
| INV-04 | Total discount rate = `1 - (1 - fullThresholdRate) * (1 - customerTierRate)`，不是 `1 - fullThresholdRate - customerTierRate`。 | `DiscountPolicy` |
| INV-05 | `ContractValidUntil` 必須是合法日期，且不得超過目前日期 10 年以上；`ContractValidUntil >= OrderDate` 視為合約有效。 | `ContractValidUntil` |

## Code Mapping Notes

- `OrderEntry.aspx.cs` 保留為讀取 controls 與 EF entities 的 WebForms adapter。
- `CustomerTier` 在 Order BC 中作為 Customer reference value 使用；2026-05-05 SPEC-002 加入 `VIP`，既有 `Senior` 保留。
- `ContractValidUntil` 由 Customer reference repository 提供，但有效期判斷屬於 Order 折扣計算輸入的一部分。
- VIP eligibility 與 Senior customer-tier 可以同時存在；`DiscountPolicy` 依 BR-007/BR-008 允許 stack。
- Domain model 不得 reference `System.Web`、WebForms controls、EF DbContext、ViewState 或 Session。
