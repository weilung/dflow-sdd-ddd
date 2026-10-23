<!-- dflow-shape: brownfield/context-map.md 3 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Context Map

> Optional bounded context relationship map for WebForms brownfield discovery.

## Context List

| Bounded Context | Responsibility | Subdomain Type | Owner / Team | Primary Code Area | Notes |
|---|---|---|---|---|---|
| Order | 接單、訂單狀態、訂單明細、金額計算與提交流程。 | `core` | OrderManager 維運團隊 | `OrderManager.Web/Pages/Order/` / `src/Domain/Order/` | 第一個已確認 BC；`SPEC-20260430-001` 先抽折扣計算。 |
| Shipment | 出貨、貨運整合與物流狀態回寫。 | _(未分類)_ | 倉儲 / 出貨團隊 | `OrderManager.Web/Pages/Shipment/` / Web Service integrations | `SPEC-20260511-001` 盤點運費時確認是自己一個 context。<br>還沒盤：出貨流程、貨運整合、物流狀態回寫；這次只盤了購物車、結帳、出貨通知三處的運費。<br>可能依賴 Order 狀態。 |

> **Context List 只放已經決定的 context。** Brownfield 的 BC 是**從抽離過程中浮現**的，
> 不是一開始就畫好的。`Order` 走過 BC 確認、被分類為 `core`（折扣業務規則正是這套
> 訂單系統的差異化所在，所以值得做完整戰術建模）。`Shipment` 是盤點時確認的 context：
> 盤點不做抽離決定，所以 Subdomain Type **刻意留白而不是先猜一個** ——
> `modify-existing-flow.md` 對「target context 沒有 Subdomain Type」本來就有處理分支。
> Customer、Inventory、Invoice 有資料往來、歸屬還沒人決定，記在下面的 Undecided Neighbors，不是這張表的列。

## Relationships

| Source Context | Target Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|---|
| Order | Shipment | Upstream / Downstream | Shared database tables + Web Service | 訂單成立後觸發出貨流程；目前耦合方式待確認。 |

## External Systems

| External System | Data Exchanged | Direction | Mechanism | Timing | Used By | Notes |
|---|---|---|---|---|---|---|

> **External System** — a system this project does not build or deploy (another team's service, a vendor or government API, a database or file another system owns) that one of this system's bounded contexts exchanges data with. Write one row per exchange: a different direction, mechanism or timing is another row, while one exchange takes one row however many contexts use it — list every one of them in Used By. Every row names at least one context in Used By, so a change to a row is a change to those contexts; an integration no context uses (logging, monitoring, deployment tooling) is not recorded here. Direction is the way the business data moves, seen from this system; which side starts the exchange goes in Mechanism. Keep external systems out of the tables above: they name only this system's bounded contexts.

## Undecided Neighbors

| Neighbor | Exchanges | Code Area | Notes |
|---|---|---|---|
| Customer | Order：提交訂單時讀取付款條件、信用額度與 CustomerTier，當 reference data 用（Customer → Order；EF entities + Stored Procedures）<br>Order：訂單列表與明細的折扣摘要帶著每筆訂單客戶的 CustomerTier（Customer → Order；`usp_GetOrderDiscountSummary` 的結果） | `OrderEntry.aspx.cs` 的 `db.Customers` 與 Customer repositories<br>`usp_GetOrderDiscountSummary`（`OrderList.BindGrid()` 的 data source、`OrderDetail.LoadDiscountSummary()`）<br>它自己的頁面在 `OrderManager.Web/Pages/Customer/` | 看起來負責客戶資料、付款條件、啟用狀態與信用額度；owner 可能是業務 / 客戶資料 owner；可能是 Order 的 upstream。<br>還不知道：它是自己一個 context、某個 context 的一部分，還是外部系統（Open Questions）。 |
| Inventory | Order：Order 需要可售量或預留結果，但不應擁有完整庫存計算（Inventory → Order；Stored Procedures） | `OrderManager.Web/Pages/Inventory/` / Stored Procedures | 看起來負責庫存、預留、可售量與庫存查詢；owner 可能是倉儲 / Inventory owner。<br>與 OrderLine 的責任邊界待釐清；它是什麼還不知道（Open Questions）。 |
| Invoice | Order：發票資料通常基於訂單與出貨結果產生（Order → Invoice；Shared database tables / nightly jobs） | `OrderManager.Web/Pages/Invoice/` | 看起來負責發票、應收帳款與財務狀態；owner 可能是財務團隊；可能是 Order / Shipment 的 downstream。<br>還不知道：它是自己一個 context，還是另一個團隊維護的外部系統（Open Questions）。 |

> **Undecided Neighbor** — a part of this system (a page, a module, a batch job, a service this project builds) that one of this system's bounded contexts exchanges data with, and that nobody has yet decided which bounded context it belongs to — usually because no capture has read its code, though a part read in passing whose boundary is still open counts too. A part already recorded as, or decided to belong to, a bounded context is not a neighbor, even when this capture did not read its code again; nor is an external system, or a region someone decided not to model (`references/ddd-modeling-guide.md`, Big Ball of Mud). Keep neighbors out of the tables above. Give each neighbor one row and a working name taken from what it does, and use that name, unchanged, wherever a document names it — a transition's Trigger in `analysis.md`, a question; what is uncertain about it goes in Notes, never into its name. Record what passes between a neighbor and a context here, not as a step of a Cross-Context Flows table in `analysis.md`: write Exchanges one line per exchange — the context, a colon, what passes, which way and how, in order when the order matters. Every row names at least one bounded context in Exchanges, so a change to a row is a change to those contexts.
>
> A neighbor leaves this table when a change that writes this file records what it is — a bounded context of its own (a Context List row whose Notes say what is not captured yet), part of a bounded context above, or an external system. A baseline capture does it when it records it; a feature that carries phase-specs does it at `/dflow:finish-feature`, with its other relationships. That change carries every value of the row to where the neighbor now belongs — what passes between it and another context into Relationships or External Systems, and, when it is part of the very context it exchanges with, into a line of Integration Notes that names that context — removes the row, and uses the new name in the documents it writes; before it removes or rewrites anything, it shows the developer the new records and where each value went, and until they answer it changes nothing. Every other document keeps the working name, so the row or line that now holds the neighbor says "also called {working name}" in its Notes; a completed feature's record is frozen and keeps the working name too.

## Integration Notes

- 這份 context map 是在 `SPEC-20260430-001` 確認 Order BC 時第一次建立的（Brownfield 的 init 不建 context-map，BC 由抽離過程浮現）；該 feature 已確認 Order BC 的第一個 scope：訂單明細總額與折扣計算。
- 後續 `/dflow:modify-existing` 仍應從具體 Code-Behind 行為開始，一次確認一個 Undecided Neighbors 的歸屬。
- 若第一個修改同時碰到 Order、Customer 與 Inventory，Bob 應先記錄 dependency，不急著一次切出多個完整 BC。

## Open Questions

- Order BC 的金額計算與折扣規則已部分決定；信用額度檢查與庫存預留仍待 Customer / Inventory 的歸屬確認。
- Customer、Inventory、Invoice 各是什麼：自己一個 context、某個 context 的一部分，還是外部系統？Invoice 是否由 OrderManager 同一團隊維護？
- 是否存在跨 context 共用資料表，導致需要 Anti-Corruption Layer 或中繼 model？
