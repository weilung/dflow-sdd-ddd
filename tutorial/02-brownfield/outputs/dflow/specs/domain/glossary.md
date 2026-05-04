<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Glossary

> Ubiquitous Language for OrderManager.

## Terms

| Term | Definition | Bounded Context | Code Mapping | Notes |
|---|---|---|---|---|
| Order | B2B 經銷商提交的訂單主體；在 Order BC 中作為 Aggregate Root，持有 OrderLine 集合並負責折扣前 / 折扣後金額計算。 | Order | `OrderManager.Domain.Order.Order` / `OrderManager.DataAccess.Entities.Order` | 首次由 `SPEC-20260430-001` 確認為 Order Aggregate Root。 |
| OrderLine | 訂單中的單一品項明細，包含商品、數量、單價與 line subtotal。 | Order | `OrderManager.Domain.Order.OrderLine` / `OrderManager.DataAccess.Entities.OrderLine` | 庫存可售量仍屬 Inventory 邊界，OrderLine 只持有訂單明細資料。 |
| Money | 金額與幣別的 Value Object，用來避免折扣與小計計算散落為裸 `decimal`。 | Order | `OrderManager.Domain.Order.Money` | 本階段以 TWD 為主；稅務 rounding 待 Invoice 邊界確認。 |
| Quantity | 數量與單位的 Value Object。 | Order | `OrderManager.Domain.Order.Quantity` | 數量必須大於 0。 |
| DiscountRate | 折扣率 Value Object，合法範圍為 `[0.0, 1.0]`。 | Order | `OrderManager.Domain.Order.DiscountRate` | 用於滿額折扣、客戶等級折扣與總折扣率。 |
| DiscountPolicy | Domain Service，封裝滿額折扣、VIP 合約折扣與客戶等級折扣的判定、順序與累積公式。 | Order | `OrderManager.Domain.Order.DiscountPolicy` | `SPEC-20260430-001` 先處理滿 NT$50,000 與 `Senior` 折扣；`SPEC-20260505-002` 擴張 VIP 計算路徑。 |
| CustomerTier | 客戶等級 reference value；目前 enum values 包含 `Senior` 與 `VIP`。 | Customer / Order | `Customer.CustomerTier` / Customer reference repository | Customer BC 尚未建模，Order 只消費此 reference value；VIP eligibility 可與 Senior customer-tier 同時存在並依 BR-008 stack。 |
| VIP | 具備 VIP loyalty program eligibility 的客戶分類；是否可套用 VIP 折扣仍需看合約有效期。 | Customer / Order | `Customer.CustomerTier = "VIP"` or Customer VIP reference data | 2026-05-05 SPEC-002 ADDED；Customer BC 未正式建立。 |
| ContractValidUntil | VIP 合約有效期限；若 `ContractValidUntil >= OrderDate`，Order BC 視為合約有效。 | Order | `OrderManager.Domain.Order.ContractValidUntil` / Customer reference data | 2026-05-05 SPEC-002 ADDED；到期日當天 inclusive。 |
| VIP discount policy | VIP 客戶在合約有效期內享 7% off 的 Order discount policy。 | Order | `OrderManager.Domain.Order.DiscountPolicy` | 2026-05-05 SPEC-002 ADDED；multiplier `0.93`，與滿額 / Senior 折扣可 stack。 |
| Dealer | 透過 OrderManager 下訂單的 B2B 經銷商。 | Customer | `OrderManager.DataAccess.Entities.Customer` | 業務常稱 Customer / Dealer，後續需統一命名。 |
| CreditLimit | 客戶可用信用額度；接單或提交訂單時可能影響是否允許成立訂單。 | Customer | Stored Procedure / Customer repository | 規則可能在 Customer 與 Order 之間跨 context。 |
| AvailableToPromise | 可承諾給訂單的可售量，通常由庫存量扣除預留量後得到。 | Inventory | Stored Procedure | 目前命名與實作待確認。 |
| Shipment | 訂單成立後的出貨流程與物流狀態。 | Shipment | `OrderManager.Web.Pages.Shipment.*` | 是否與 Order 狀態共用欄位待釐清。 |
| Invoice | 與訂單或出貨結果相關的發票與應收帳款資料。 | Invoice | `OrderManager.Web.Pages.Invoice.*` | 財務規則可能由不同 owner 維護。 |

## Open Questions

- Customer 與 Dealer 是否為同一個 Ubiquitous Language？若業務部門使用 Dealer、資料庫使用 Customer，spec 與 code mapping 要明確記錄。
- Order 金額計算與折扣規則已由 `SPEC-20260430-001` 確認屬於 Order BC；信用額度檢查與庫存預留仍待 Customer / Inventory 邊界釐清。
- Invoice 狀態是否應影響 Order 狀態，或只作為 downstream 財務流程？
- `ContractValidUntil` 最終欄位來源需由 Customer 資料 owner 確認；目前先以 reference data contract 表達。
