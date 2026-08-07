# Shipment — Behavior

<!-- Formatting convention: keep table cells concise. Separate multiple short items with <br> - never chain them into one line with ；/; separators. Long narrative detail belongs in a document section, not in a table cell. -->

> 本文件的初始內容來自 `SPEC-20260511-001-shipment-fee-baseline` 的 baseline capture
> （2026-05-11，observation-only）。它記錄的是**當時實際的行為**，不是應然的規則。
>
> 三處行為彼此不一致。**這份文件如實記錄三者**，不預先裁定哪一個正確——那是待決的業務
> 決定，記在 `dflow/specs/migration/tech-debt.md`。

## 運費計算的三個產生點

Shipment 運費在系統中有三個獨立的產生點，彼此**沒有共用實作**：

| # | 產生點 | 來源 |
|---|---|---|
| 1 | 購物車頁顯示 | `OrderManager.Web/Pages/Cart/ShoppingCart.aspx.cs` `CalculateShippingFee()` |
| 2 | 結帳頁顯示 | `OrderManager.Web/Pages/Checkout/Checkout.aspx.cs` `BindShippingSummary()` |
| 3 | 出貨通知信 | `OrderManager.Jobs/Notifications/ShipmentNoticeBuilder.cs` `BuildFeeLine()` |

三處共用同一份**重量級距表**與同一個**免運門檻 2,000**。它們的分歧不在參數，而在
**拿哪一個金額去比那條門檻**。

以下情境使用同一張訂單作為 worked example：

```text
原價合計   2,300
折扣後應付 1,850
免運門檻   2,000
重量級距   5–10kg → 150
```

## Scenario 1 — 購物車頁：以折扣前金額判斷免運（confirmed）

```text
Given 一張訂單，原價合計 2,300、折扣後應付 1,850
And 商品重量落在級距表的「5–10kg = 150」區間
When 購物車頁計算運費
Then 以**折扣前**金額 2,300 判斷是否達到 2,000 免運門檻
And 2,300 ≥ 2,000 → 判定為免運
And 顯示運費 0（免運）
```

## Scenario 2 — 結帳頁：以折扣後金額判斷免運（confirmed）

```text
Given 同一張訂單（原價 2,300、折後 1,850、重量 5–10kg）
When 結帳頁組出運費摘要
Then 以**折扣後**金額 1,850 判斷同一條免運門檻
And 1,850 < 2,000 → 未達門檻
And 依級距表收 150
And 顯示運費 150
```

> **Capture note**：Scenario 1 與 2 的差異只有一處——比門檻時用的是折扣前還是折扣後金額。
> 級距表、門檻值、重量都相同。兩者皆為觀察到的現況，非推論。

## Scenario 3 — 出貨通知信：讀下單當下的快照（confirmed）

```text
Given 一張已建立的訂單
And 訂單建立時 ShippingFee 欄位寫入 0（下單流程走的是購物車那條計算路徑）
When 出貨通知信產生運費行
Then 直接讀取 Order.ShippingFee 欄位
And 不重新計算、也不重新判斷門檻
And 顯示運費 0（免運）
```

> **Capture note**：通知信不重算，因此它顯示的永遠是**下單當下**寫入的值。若下單後運費規則
> 變更，通知信不會反映。

## 未捕捉的範圍

本次 baseline 只讀了三個**直接產生該數字**的方法（immediate neighbors），未擴張成全系統
audit。以下**未讀**，若後續發現它們也各自算一套，屬於另一次 baseline capture 的範圍：

- `Invoice` 對運費的處理
- `Refund` 退貨時的運費計算
- 後台人工調整運費的路徑

## 已知不一致（不在本文件裁定）

同一張訂單在三處顯示 **0 / 150 / 0**。根因是**免運門檻的判斷基準不一致**：購物車用折扣前
金額、結帳頁用折扣後金額，通知信則完全不判斷、只replay 下單當下的快照。

「以哪一個為準」是業務決定，記於 `dflow/specs/migration/tech-debt.md`，狀態 open，
來源 `SPEC-20260511-001`。**本文件不預先寫成 BR** —— 一條尚未有答案的規則不是規則。
