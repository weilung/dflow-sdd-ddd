<!-- dflow-shape: brownfield/models.md 1 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Domain Models

> Order bounded context 的 Domain model catalog。

## Context

- **Bounded Context**: Order
- **Source Code Area**: `src/Domain/Order/` and `OrderManager.Web/Pages/Order/OrderEntry.aspx.cs`
- **Last Updated**: 2026-05-12

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

## Domain Services

| Service | Responsibility | Inputs / Outputs | Code Mapping | Notes |
|---|---|---|---|---|
| DiscountPolicy | 判斷滿額折扣與客戶等級折扣，並以正確公式累積折扣率。 | `Money preDiscountTotal`, `CustomerTier tier` -> `DiscountRate totalDiscount` | `OrderManager.Domain.Order.DiscountPolicy` | INV-04: `1 - (1 - fullThresholdRate) * (1 - customerTierRate)`. |

## Repository Interfaces

| Repository | Aggregate / Entity | Query Responsibility | Code Mapping | Notes |
|---|---|---|---|---|
| | | | | |

## Invariants

| ID | Invariant | Enforced By |
|---|---|---|
| INV-01 | `Order.LineItems` 必須至少含一筆 `OrderLine`。 | `Order` constructor / factory |
| INV-02 | 每個 `OrderLine.UnitPrice.Amount` 必須大於 0。 | `Money` / `OrderLine` construction |
| INV-03 | `DiscountRate` 必須在 `[0.0, 1.0]` 內。 | `DiscountRate` construction |
| INV-04 | Total discount rate = `1 - (1 - fullThresholdRate) * (1 - customerTierRate)`，不是 `1 - fullThresholdRate - customerTierRate`。 | `DiscountPolicy` |

## Code Mapping Notes

- `OrderEntry.aspx.cs` 保留為讀取 controls 與 EF entities 的 WebForms adapter。
- `CustomerTier` 在本 phase 作為 reference data 使用；尚未建立 Customer BC model。
- Domain model 不得 reference `System.Web`、WebForms controls、EF DbContext、ViewState 或 Session。
