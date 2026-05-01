<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Context Map

> Optional bounded context relationship map for WebForms brownfield discovery.

## Context List

| Bounded Context | Responsibility | Owner / Team | Primary Code Area | Notes |
|---|---|---|---|---|
| Order | 接單、訂單狀態、訂單明細、金額計算與提交流程。 | OrderManager 維運團隊 | `OrderManager.Web/Pages/Order/` / `src/Domain/Order/` | 第一個已確認 BC；`SPEC-20260430-001` 先抽折扣計算。 |
| Customer | 客戶資料、付款條件、啟用狀態、VIP eligibility、合約有效期與信用額度。 | 業務 / 客戶資料 owner | `OrderManager.Web/Pages/Customer/` / Customer repositories | Candidate BC；2026-05-05 起 partially referenced via reference data，未正式建 BC。 |
| Inventory | 庫存、預留、可售量與庫存查詢。 | 倉儲 / Inventory owner | `OrderManager.Web/Pages/Inventory/` / Stored Procedures | 與 OrderLine 的責任邊界待釐清。 |
| Shipment | 出貨、貨運整合與物流狀態回寫。 | 倉儲 / 出貨團隊 | `OrderManager.Web/Pages/Shipment/` / Web Service integrations | 可能依賴 Order 狀態。 |
| Invoice | 發票、應收帳款與財務狀態。 | 財務團隊 | `OrderManager.Web/Pages/Invoice/` | 可能是 Order / Shipment 的 downstream context。 |

## Relationships

| Source Context | Target Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|---|
| Customer | Order | Supplier / Reference data | EF entities + Stored Procedures / Customer reference repository | Order 提交流程會讀取付款條件、信用額度、`CustomerTier`、VIP eligibility 與 `ContractValidUntil`；Customer BC 尚未正式建立。 |
| Inventory | Order | Supplier | Stored Procedures | Order 需要可售量或預留結果，但不應擁有完整庫存計算。 |
| Order | Shipment | Upstream / Downstream | Shared database tables + Web Service | 訂單成立後觸發出貨流程；目前耦合方式待確認。 |
| Order | Invoice | Upstream / Downstream | Shared database tables / nightly jobs | 發票資料通常基於訂單與出貨結果產生。 |

## Integration Notes

- 這份 context map 起源於 Day-0 baseline；`SPEC-20260430-001` 已確認 Order BC 的第一個 scope：訂單明細總額與折扣計算。
- `SPEC-20260505-002` 確認 VIP discount calculation 仍屬 Order BC；Customer 只提供 reference data，Customer BC 的正式建立應由 Customer-owned feature 觸發。
- 後續 `/dflow:modify-existing` 仍應從具體 Code-Behind 行為開始，逐步確認 Customer / Inventory / Shipment / Invoice 邊界。
- 若第一個修改同時碰到 Order、Customer 與 Inventory，Bob 應先記錄 dependency，不急著一次切出多個完整 BC。

## Open Questions

- Order BC 的金額計算與折扣規則已部分決定；信用額度檢查與庫存預留仍待 Customer / Inventory 邊界確認。
- Customer BC 目前只是 partially referenced via reference data；正式 boundary、Aggregate 與 owner workflow 尚未建立。
- Shipment 與 Invoice 是否由 OrderManager 同一團隊維護，或應視為外部 / downstream context？
- 是否存在跨 context 共用資料表，導致需要 Anti-Corruption Layer 或中繼 model？
