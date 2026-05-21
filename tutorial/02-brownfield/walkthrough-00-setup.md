# Walkthrough 00 — Brownfield setup：Bob / OrderManager 的起點

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 是 Brownfield 線的入口。它不展示 Dflow command，目標是讓讀者先看懂
Bob 面對的是什麼樣的既有系統，
以及 Dflow 為什麼不能一開始就要求大重構或完整 DDD model。

如果直接從 [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)
開始讀，讀者會看到 Dflow 從 `OrderEntry.aspx.cs` 抽出第一段 Order Domain logic；
但不一定知道 Bob 為什麼先用 `/dflow:modify-existing`，也不一定知道 baseline capture
為什麼比「先改乾淨」更重要。本篇補的是這個入口上下文。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Brownfield track 適合什麼專案？ | 已上線多年、仍要維運、不能停機重寫的 WebForms 系統。 |
| Dflow 會不會一開始就叫團隊重構？ | 不會。它先建立 baseline，後續每次修改才抽一點 domain knowledge。 |
| Day 0 要不要先建 Order / Customer / Inventory BC？ | 不要。只把候選 context 記成觀察，等真需求出現再建。 |
| Legacy code 的錯誤行為怎麼處理？ | 後續 baseline capture 會區分 confirmed behavior、buggy behavior、unknown behavior。 |
| 本篇是否會產生 `outputs/`？ | 不會。setup 是導入前的 system context，outputs 從 init 後才開始。 |

## 劇情背景

Bob 是 OrderManager 維運團隊的 tech lead。OrderManager 是一套 ASP.NET WebForms
B2B 訂單管理系統，已經服務真實客戶多年。它的問題不是「沒有功能」，而是功能仍在跑、
需求仍在進來，但業務規則分散在 Code-Behind、Repository、Stored Procedures 與幾個
Web Service 裡。

Bob 的長期目標是把系統逐步遷移到 ASP.NET Core，但公司不能停機，也沒有預算做
big-bang rewrite。因此他的 Dflow 導入目標很務實：

1. 每次修改前先寫清楚需求與 current behavior。
2. 不把看起來像 bug 的 legacy 行為直接當 business rule。
3. 每次只抽出一小段可測試、可遷移的 Domain logic。
4. 把未處理的技術債留下來，成為未來 migration 的 source of truth。

## 現有系統長什麼樣

OrderManager 的 repo 大致如下：

```text
OrderManager/
├── OrderManager.sln
├── OrderManager.Web/
│   ├── Pages/
│   │   ├── Order/
│   │   │   ├── OrderEntry.aspx
│   │   │   ├── OrderEntry.aspx.cs
│   │   │   ├── OrderList.aspx + .cs
│   │   │   └── OrderDetail.aspx + .cs
│   │   ├── Customer/...
│   │   ├── Inventory/...
│   │   ├── Shipment/...
│   │   └── Invoice/...
│   ├── App_Code/
│   ├── Web.config
│   └── Default.aspx
├── OrderManager.DataAccess/
│   ├── Entities/
│   ├── Repositories/
│   └── StoredProcedures/
├── tests/
│   └── OrderManager.IntegrationTests/
└── (無 src/Domain/ — 待 Dflow 漸進建立)
```

這個 tree 對 Dflow 代表的不是「先建立 Clean Architecture」。它代表一組限制：

| 觀察 | 對 Dflow 的意義 |
|---|---|
| WebForms 主專案仍是 production system | 修改必須低風險，不能先大搬家。 |
| 業務邏輯黏在 `OrderEntry.aspx.cs` | 後續修改要先 baseline capture，再抽可測試 domain logic。 |
| Stored Procedures 也含規則 | spec 必須記錄哪些行為來自 DB / SP，而不是只看 C#。 |
| 少量 integration tests，幾乎沒有 unit tests | 每次 domain extraction 都要補可快速回饋的 tests。 |
| 尚無 `src/Domain/` | domain layer 會在第一個合適修改中漸進建立。 |

## 潛在 bounded context 只是候選，不是 Day-0 決策

Bob 已經知道幾個業務區域：

| 候選 context | Bob 現在知道的事 | Day-0 處理 |
|---|---|---|
| Order | 接單、明細、金額、提交、取消與狀態轉換，是最常被修改的核心區域。 | 很可能先處理，但不預建 directory。 |
| Customer | 經銷商資料、付款條件、信用額度。 | 可能是 Order upstream reference。 |
| Inventory | 可售量、保留、庫存狀態。 | 不在第一個修改前先建模。 |
| Shipment | 出貨條件與物流回寫。 | 後續需求再釐清。 |
| Invoice | 發票、應收帳款、財務狀態。 | 可能由另一團隊維護，暫不假設 boundary。 |

這是 Brownfield DDD 的重要原則：**候選 context 可以先被看見，但不能在沒有行為證據前變成文件真相。**

Dflow 會等到 Bob 用具體修改需求進來，例如折扣計算錯誤，才決定是否建立
`dflow/specs/domain/Order/`。

## Brownfield 的風險不是「缺少架構圖」

如果沒有 Dflow，Bob 可能會看到 `OrderEntry.aspx.cs` 很亂，就順手做一輪大重構。
那通常會帶來幾個風險：

| 風險 | 後果 |
|---|---|
| 未捕捉 current behavior | QA 才發現某個頁面依賴舊行為。 |
| 把 bug 當 business rule | 錯誤折扣、rounding 或庫存判斷被正式化。 |
| 一次搬太多 code | regression surface 太大，reviewer 無法確認意圖。 |
| spec 只描述理想新系統 | migration 時仍不知道 legacy 行為怎麼處理。 |
| 技術債沒有 disposition | 下次修改又重新挖同一段歷史。 |

Dflow 的 Brownfield track 不是美化 legacy，而是把 legacy 轉成可控的變更入口。

## Bob 的第一個合理入口

Bob 不會從「建立 Order BC」這種抽象任務開始。他會等到一個真實修改需求進來，例如：

```text
Senior 客戶滿 NT$50,000 的訂單，
應該先套滿額 9 折，再套 Senior 5% off。
系統目前只套了滿額 9 折。
```

這種需求很適合 Dflow：

1. 它有可重現的 business case。
2. 它碰到明確的金額規則。
3. 它能建立第一批 Order rules。
4. 它可以把部分計算從 Code-Behind 抽成 pure C#。
5. 它不需要重寫整個 WebForms application。

這會在 [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)
中發生。

## 本段沒有產出 Dflow 文件

Walkthrough 00 是 setup context，因此沒有新增 `outputs/` 檔案。讀者可以把它理解成
`dflow init` 前的 system state。

| 位置 | 狀態 |
|---|---|
| `dflow/specs/` | 尚未存在。 |
| `dflow/specs/domain/Order/` | 尚未存在；第一個修改需求確認 boundary 後才建立。 |
| `src/Domain/` | 尚未存在；init 不建立 production code。 |
| root AI tool files | 尚未存在；Bob 會在 init 中選擇 `CLAUDE.md`，並可在 init 後用 `dflow configure-agents --command-adapters` 補 Claude `/dflow:<id>` 命令 wrapper。 |

## Dflow feature / benefit mapping

| 這一步建立的理解 | 後續 Dflow benefit |
|---|---|
| 系統仍在 production 服務 | Brownfield flow 先保護 current behavior，再修改。 |
| 業務規則散在 WebForms / EF / SP | baseline capture 會保留來源與信心等級。 |
| Order 是高可能候選，但不是既定 BC | 第一個 feature 由真需求建立 boundary。 |
| migration 是長期目標 | `migration/tech-debt.md` 從 Day 0 就有價值。 |
| 測試缺口明顯 | 每次抽 domain logic 都要補可回歸的測試焦點。 |

## 下一個劇情段

→ [〈Walkthrough 01 — `dflow init` 建立 Brownfield baseline〉](walkthrough-01-init-project.md)：Bob
在 OrderManager repo root 執行 `dflow init`，建立 Brownfield Dflow baseline，
但不搬動 production code。
