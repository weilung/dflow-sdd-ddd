# Tutorial 劇情 2（Brownfield WebForms）— OrderManager 與 Bob

## 適用對象

這份劇情給正在維護 brownfield 系統、想逐步導入 SDD / DDD 的工程師、Tech Lead 與 PO 參考。原型是一支 4-6 人的 WebForms 維運團隊：系統還在服務真實客戶，需求仍然持續進來，但團隊已經意識到「靠 Code-Behind 補丁一路撐下去」會讓未來遷移成本愈來愈高。

劇情 2 不假設團隊可以重寫系統，也不假設一開始就有完整 Domain model。Bob 要做的是在不中斷業務的前提下，用 Dflow 讓每一次修改都留下 spec、抽出一點可遷移的 Domain logic，並把看見的 tech debt 記錄下來，成為未來 .NET Core migration 的 source of truth。

## 與劇情 1 的差異

劇情 1 的 Alice 面對的是全新 ExpenseTracker：她可以先決定 Clean Architecture，再從第一個 feature 建立 Aggregate、Value Object 與 Domain Event。Bob 的情境不同。OrderManager 已經在線上跑了 5-7 年，業務規則散在 `OrderEntry.aspx.cs`、Repository、Stored Procedures 與幾個 Web Service 裡。Dflow 在這裡不是用來「設計一個理想新系統」，而是用來替既有系統建立可控的修改入口。

| 面向 | 劇情 1：Alice / ExpenseTracker | 劇情 2：Bob / OrderManager |
|---|---|---|
| 角色背景 | Alice 是新平台小組組長，兼 PO 與全端工程師，從零建立 Core 專案。 | Bob 是資深 .NET 工程師與維運團隊 tech lead，熟悉 WebForms / EF 6，也要帶兩位 DDD 經驗較淺的工程師。 |
| 假想專案 | Greenfield 內部差旅費用平台，尚未有 legacy code。 | Brownfield B2B 訂單管理系統，已服務約 200 家活躍經銷商。 |
| 主要 entry point | `npx dflow-sdd-ddd init` 後接 `/dflow:new-feature`，從第一個 feature 建立 Domain。 | `npx dflow-sdd-ddd init` 建立 brownfield baseline，後續進 `/dflow:modify-existing`，從既有 Code-Behind 的修改需求切入。 |
| Domain 處理方式 | 一開始就有 Clean Architecture 專案骨架，Domain 層是主要開發位置。 | `src/Domain/` 會漸進建立；每次碰到業務規則才把可測試、純 C# 的部分抽出。 |
| Tech debt 處理 | 主要記錄新系統設計過程中的架構取捨或後續改善。 | Tech debt backlog 從 Day 0 就有內容，記錄 Code-Behind、Stored Procedures、測試缺口與 migration 阻礙。 |
| Git 策略 | 劇情 1 採 trunk-based / GitHub Flow，適合短命 feature branch。 | 劇情 2 假設維運團隊有 release / hotfix 節奏，因此選 Git Flow。 |
| 主要痛點 | 如何把新需求寫成 spec 並落到 Aggregate 設計。 | 如何先讀懂既有行為、捕捉 baseline，再低風險修改並避免 regression。 |

## 角色 — Bob

Bob 是 OrderManager 維運團隊的 tech lead，有 7-8 年 .NET 經驗，主力技術棧是 ASP.NET WebForms、Entity Framework 6、SQL Server 與 IIS。這套系統的幾個核心頁面他都碰過：接單、訂單查詢、庫存檢查、出貨狀態回寫。他知道哪些 Code-Behind 很危險，也知道哪些 Stored Procedures 牽一髮動全身。

Bob 不是 DDD 新手，但也不是每天都在做 tactical DDD 的顧問。他讀過 Eric Evans 的書，也參加過內部讀書會；概念上理解 Aggregate、Value Object、Bounded Context，但在 OrderManager 這種 WebForms legacy code 裡落地時，仍然需要務實取捨。對他來說，DDD 不是一次重畫架構圖，而是把「目前藏在 event handler 裡的業務語言」慢慢變成可討論、可測試、可遷移的資產。

他會推動 modernization，是因為他看過太多 regression。某次改折扣規則，出貨頁的金額摘要也跟著壞；某次調整信用額度檢查，Stored Procedure 的 join 條件影響了查庫存流程。Bob 想把 OrderManager 長期搬到 .NET Core，但公司不能停機，也沒有預算讓團隊關門重寫半年。因此他選擇用 Dflow 把每次修改變成 incremental DDD adoption 的機會。

## 假想專案 — OrderManager

### 業務領域

OrderManager 是公司內部的 B2B 訂單管理系統。約 200 家活躍經銷商透過系統下訂單、查庫存、追蹤出貨與收發票；內部業務、倉儲、財務與客服也會透過同一套系統處理訂單生命週期。

這個系統的核心價值不是 UI，而是跨部門業務規則：客戶付款條件、信用額度、庫存可售量、出貨條件、發票與應收帳款狀態都會影響訂單能不能成立、能不能出貨，以及後續財務流程是否正確。

### 技術棧

| Item | Current |
|---|---|
| Framework | ASP.NET WebForms（.NET Framework 4.8） |
| ORM / Data Access | Entity Framework 6，部分流程直接呼叫 Stored Procedures 或 ADO.NET |
| Database | SQL Server 2019 |
| UI | jQuery + Bootstrap 3 + WebForms Server Controls |
| Hosting | IIS，既有 release pipeline |
| Test | 少量 integration tests，幾乎沒有 unit tests |

### 規模

OrderManager 約 150K LOC，有約 30 個 ASPX pages、50 個 Stored Procedures、5 個 Web Service。程式碼不是完全失控，但歷史包袱很明顯：早期為了快速交付，很多業務規則直接寫在 Code-Behind event handler 裡；後來又為了報表與效能，把更多資料組合邏輯塞進 Stored Procedures。

### 主要業務區域（潛在 Bounded Context 候選）

**Order** 是接單與訂單狀態的核心區域，包含訂單主檔、明細、金額計算、提交、取消與狀態轉換。它是劇情 2 最可能先處理的候選，因為 `OrderEntry.aspx.cs` 已經累積大量業務規則，且修改需求最常從這裡進來。

**Customer** 管理 B2B 經銷商資料、付款條件與信用額度。它可能是 Order 的 upstream context，因為接單時需要檢查客戶是否啟用、付款條件是否允許，以及目前信用額度是否足夠。

**Inventory** 負責庫存、預留與可售量。它和 Order 的邊界需要小心：Order 需要知道是否可下單，但不應把庫存計算細節全部吃進 Order model。第一個 modify-existing 很可能會碰到這條邊界。

**Shipment** 處理出貨、貨運整合與物流狀態回寫。它通常在訂單成立後接手，但目前部分出貨條件判斷散在訂單頁與出貨頁之間，後續需要透過 spec 釐清責任。

**Invoice** 涵蓋發票、應收帳款與財務狀態。它與 Order 有明顯生命週期關聯，但財務規則可能由另一個團隊維護，因此 Bob 不會在劇情 2 一開始就急著建模。

Bob 不會在劇情 2 一次處理所有候選 Bounded Context。段 2 的合理策略是先選一個具體、範圍不大的 Order 修改，讀既有行為、捕捉 baseline，再決定是否建立第一個 `dflow/specs/domain/{context}/`。

### 既有架構與痛點

OrderManager 最大的痛點是業務邏輯黏在 Code-Behind。像 `OrderEntry.aspx.cs` 的 `btnSubmit_Click`，常見結構是先讀 UI 控制項，再查資料庫，再做 100-200 行計算與狀態判斷，最後直接寫回 DB 或呼叫 Stored Procedure。這讓規則很難測，也很難知道某個修改會影響哪些頁面。

第二個痛點是測試缺口。系統有少量 integration tests，但沒有覆蓋主要 Domain rules；團隊常靠 QA regression 與人工測試撐住。當需求碰到折扣、信用額度、庫存預留或發票狀態，Bob 沒有足夠快的 feedback loop。

第三個痛點是 Stored Procedures 內的重 join。資料組合與業務判斷混在 SQL 裡，短期效能可接受，但規則散落且難以版本化。Bob 不會立刻重寫這些 Stored Procedures，但會在每次修改時記錄哪些規則已被確認、哪些 debt 需要後續處理。

### 既有目錄結構（before Dflow）

```
OrderManager/
├── OrderManager.sln
├── OrderManager.Web/                        # WebForms 主專案
│   ├── Pages/
│   │   ├── Order/
│   │   │   ├── OrderEntry.aspx
│   │   │   ├── OrderEntry.aspx.cs           # ← 業務邏輯黏這裡
│   │   │   ├── OrderList.aspx + .cs
│   │   │   └── OrderDetail.aspx + .cs
│   │   ├── Customer/...
│   │   ├── Inventory/...
│   │   ├── Shipment/...
│   │   └── Invoice/...
│   ├── App_Code/                            # 共用 helper（混亂）
│   ├── Web.config
│   └── Default.aspx
├── OrderManager.DataAccess/                 # EF 6 + SP 包裝
│   ├── Entities/                            # EF entity 類別
│   ├── Repositories/                        # 部分為 EF，部分直接 ADO.NET
│   └── StoredProcedures/                    # SP 字串包裝
├── tests/
│   └── OrderManager.IntegrationTests/       # 少量整合測試
└── (無 src/Domain/ — 待 Dflow 漸進建立)
```

## 為什麼導入 Dflow

Bob 導入 Dflow 的目的不是增加文件負擔，而是讓修改既有系統時有固定節奏：先確認需求與現有行為，再寫 spec，然後才決定要不要抽 Domain logic。對 WebForms brownfield 專案來說，最重要的是避免「看到 Code-Behind 很亂就順手大重構」。Dflow 讓 Bob 把重構拆成小步，每一步都能連回具體業務規則。

這套流程也能幫團隊建立共同語言。資淺工程師在接到需求時，不只問「哪個按鈕要改」，也會開始問「這條規則屬於 Order 還是 Inventory」、「這是既有 BR 的修改，還是新的 BR」、「這個判斷未來能不能搬到 `src/Domain/`」。這些問題會讓 spec 逐漸成為 future .NET Core migration 的 source of truth。

## 段 1 init-project

劇情 2 的 `01-init-project.md` 現在改為 CLI 入口：Bob 在 OrderManager 專案 root 執行 `npx dflow-sdd-ddd init`，建立 brownfield baseline，後續 `02-modify-existing.md` 才從已初始化的專案開始處理第一個修改需求。

本段 0 只負責說明角色、專案背景與 baseline outputs 的位置；實際 init 互動流程放在下一段。

## baseline outputs 在哪裡

baseline outputs 位於 [`tutorial/02-brownfield-webforms/outputs/`](outputs/)。這些檔案模擬 Bob 在 OrderManager 裡完成 `npx dflow-sdd-ddd init` 後的結果。

Bob 的 init 選擇假設如下：

| Question | Bob 的選擇 |
|---|---|
| Q1 project type | brownfield：既有 ASP.NET WebForms 系統現在才導入 Dflow |
| Q2 edition | ASP.NET WebForms — brownfield modernization |
| Q3 tech stack | .NET Framework 4.8 / Entity Framework 6 / SQL Server 2019 / WebForms |
| Q4 migration | 是，長期目標是逐步遷移到 .NET Core |
| Q5 prose language | `zh-TW` |
| Q6 optional | `_overview.md`、`Git-principles-gitflow.md`、`CLAUDE.md` snippet 全選；`_conventions.md` 為 mandatory |

baseline 檔案清單：

| Path | 用途 |
|---|---|
| `outputs/dflow/specs/features/active/.gitkeep` | 保留 active feature 工作區，目前沒有任何 feature 目錄。 |
| `outputs/dflow/specs/features/completed/.gitkeep` | 保留 completed feature 歸檔區。 |
| `outputs/dflow/specs/features/backlog/.gitkeep` | 保留 backlog feature 工作區。 |
| `outputs/dflow/specs/domain/glossary.md` | OrderManager 的 Ubiquitous Language 起點，先放核心術語與 open questions。 |
| `outputs/dflow/specs/migration/tech-debt.md` | baseline tech debt backlog，記錄 Code-Behind、測試、Stored Procedures、migration 與 DI 缺口。 |
| `outputs/dflow/specs/shared/_overview.md` | 系統 overview、current architecture、migration context note 與 known pain points。 |
| `outputs/dflow/specs/shared/_conventions.md` | spec 撰寫慣例，含 brownfield modify-existing 的專案級補充。 |
| `outputs/dflow/specs/shared/Git-principles-gitflow.md` | Bob 選擇 Git Flow 的 Git 規範。 |
| `outputs/CLAUDE.md` | repo root AI 協作規則，含 OrderManager 專案描述、Domain Layer Rules 與 AI collaboration notes。 |

本 baseline 不建立任何 `dflow/specs/domain/{BC}/` 子目錄，也不預建 `dflow/specs/domain/context-map.md` 或任何 `dflow/specs/features/active/SPEC-...` 目錄。第一個 Bounded Context、context map 與第一個 active spec 會由後續 modify-existing 或 new-feature flow 依實際需求建立。

## 下一個劇情段

→ `01-init-project.md`：Bob 在 shell 執行 `npx dflow-sdd-ddd init`，建立 OrderManager 的 brownfield Dflow baseline。
