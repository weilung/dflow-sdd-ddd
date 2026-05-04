<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Migration Tech Debt

> WebForms migration debt backlog discovered during SDD/DDD work on OrderManager.

## Debt Items

| Item | Location | Description | Severity | Migration impact | Status |
|---|---|---|---|---|---|
| 業務邏輯散在 Code-Behind | `OrderManager.Web/Pages/Order/OrderEntry.aspx.cs` and similar pages | `btnSubmit_Click` 等 event handler 內混合 UI 讀值、查詢、金額計算、狀態判斷與資料寫入，難以測試也難以搬遷。 | High | 阻礙 Domain logic 抽離；未來 .NET Core migration 若不先整理規則，會變成逐行翻譯 legacy 行為。 | open |
| 缺少 unit test coverage | `tests/OrderManager.IntegrationTests/` | 目前只有少量 integration tests，主要業務規則沒有快速、可隔離的 unit tests。 | High | 每次修改都依賴人工 regression；抽離 `src/Domain/` 前缺少保護網。 | open |
| Stored Procedures 重 join 難維護 | `OrderManager.DataAccess/StoredProcedures/` / SQL Server | 多個訂單、庫存、發票查詢把資料組合與業務判斷混在 SQL 裡，規則來源不清楚。 | Medium | 需要逐步把已確認的 business rules 移到 spec 與 Domain model；短期不強制重寫所有 SP。 | open |
| .NET Core migration long-term goal 未拆小步 | repository-wide | 團隊想遷移到 .NET Core，但目前沒有以規格與 Domain extraction 為單位的 incremental roadmap。 | Medium | 若直接啟動重寫，容易與現役需求衝突；Dflow 應累積可遷移 source of truth。 | open |
| 無 Dependency Injection 組態 | `OrderManager.Web/` / `App_Code/` | 多數 helper、repository 與 service 由頁面直接 new 或使用 static helper，難以替換與測試。 | Medium | 抽離 Domain service / repository interface 時需要先建立 seam；否則新 Domain code 仍會被 WebForms infrastructure 綁住。 | open |
| Order 折扣規則分散在多個頁面 | `OrderManager.Web/Pages/Order/OrderList.aspx.cs` / `OrderDetail.aspx.cs` | 初步檢查顯示 Order BC 其他頁面也可能使用相同折扣規則，但各自實作金額摘要或顯示邏輯。Closeout note: 2026-05-12 `SPEC-20260430-001` 已統一 `OrderEntry` / `OrderList` / `OrderDetail` rounding display contract；其他 Order 頁面尚未抽離。 | High | 部分風險已由 baseline capture + BUG-001 緩解；後續仍需逐步確認其他 Order 頁面是否直接實作折扣或金額顯示邏輯。 | open |
| OrderEntry event handler 仍混合資料存取與流程控制 | `OrderManager.Web/Pages/Order/OrderEntry.aspx.cs` | 折扣計算抽離後，`btnSubmit_Click` 仍約有 50 行 EF query、UI parsing、狀態設定與 DB 寫回邏輯尚未抽離。 | Medium | WebForms adapter 仍偏厚；未來遷移到 ASP.NET Core 時需再拆 application-facing adapter / repository seam。 | open |
| DiscountPolicy 結構可能需要演進 | `src/Domain/Order/DiscountPolicy` | 本 phase 只處理滿額折扣與 `Senior` 客戶折扣；若後續新增促銷、品項級折扣或通路折扣，單一 policy 可能過大。 | Low | 後續可評估是否拆成 PolicyChain 或 Strategy pattern；目前不為未確認需求過度設計。 | open |
| OrderList / OrderEntry / OrderDetail rounding 策略不一致 | `OrderManager.Web/Pages/Order/OrderList.aspx.cs` / `OrderEntry.aspx.cs` / `OrderDetail.aspx.cs` | `OrderList.BindGrid()` 使用 `decimal.Round(value, 0)` 顯示整數元，`OrderEntry` / `OrderDetail` 使用 `Math.Round(value, 2)` 或 `ToString("N2")` 顯示到小數兩位，可能造成同一筆訂單跨頁視覺金額差異。Resolved note: 2026-05-08 由 SPEC-20260430-001 BUG-001 修正，Domain Money VO 提供統一 `ToDisplay()` contract，三頁面改 call 同一 contract。 | Medium | Domain 層應統一 `Money` rounding / display precision contract，避免 ASP.NET Core migration 時把頁面差異一起搬過去。 | resolved |
| OrderList isVip multiplier 0.93 規則來源不明 | `OrderManager.Web/Pages/Order/OrderList.aspx.cs` method `BindGrid()` | `if (customer.IsVip) { discountedTotal *= 0.93m; }` 沒有註解或 ticket reference，且可能與 BR-003 Senior customer 5% off 互斥。Resolved note: 2026-05-05 業務確認為 dead code，由 SPEC-20260505-002 phase 1 implement task 移除。 | Medium | 不寫成 BR；移除作為 `SPEC-20260505-002` 的 implementation cleanup task，避免把 legacy promotion 殘留帶入 ASP.NET Core migration。 | resolved |

## Follow-up Notes

- Day-0 baseline 只記錄已知 debt，不代表立即重構。
- 每個 `/dflow:modify-existing` 完成時，若看見新的 migration risk，應更新本檔。
- 優先處理能支援 `src/Domain/` 純 C# 抽離與 unit testing 的 debt。
- `Order 折扣規則分散在多個頁面` disposition: 2026-05-12 `SPEC-20260430-001` closeout 時確認為 partially resolved；三個已知頁面的 rounding contract 已統一，但跨全部 Order 頁面的業務邏輯抽離仍 open。
- `OrderList / OrderEntry / OrderDetail rounding 策略不一致` disposition: 2026-05-08 歸屬 `SPEC-20260430-001` 的 `BUG-001-rounding-inconsistency.md`；修正方向為 `Money.ToDisplay()` display contract + 三頁面 Presentation 層統一呼叫。
- `OrderList isVip multiplier 0.93` 已由 Daniel 於 2026-05-05 確認為五年前促銷殘留；清理歸屬 `SPEC-20260505-002` phase 1 implementation task。
