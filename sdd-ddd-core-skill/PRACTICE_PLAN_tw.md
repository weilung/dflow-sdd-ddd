# DDD 模擬練習計畫：員工費用報銷系統（ExpenseTracker）

## 目標

透過模擬專案，在 Claude Code 引導下實際操作 DDD 的核心概念，
讓你在正式 ASP.NET Core 專案開始前就熟悉整個流程。

## 模擬專案簡介

**員工費用報銷系統**：員工提交費用報銷單，主管審核，財務部撥款。
涵蓋多幣別計算、審批流程、通知機制。

選這個題目的原因：跟你實際的費用報表系統高度相似，學到的東西可以直接搬過去。

---

## Phase 1：建立基礎（預估 2-3 小時）

### 練習目標
- 建立專案結構（Clean Architecture 四層）
- 設定 dflow/specs/ 目錄
- 識別 Bounded Context
- 建立初始術語表

### 在 Claude Code 中這樣開始

```
我要用 ASP.NET Core 建一個模擬練習專案：員工費用報銷系統。
請讀取 sdd-ddd-core/SKILL.md 和所有 references/、templates/ 檔案，
然後引導我：
1. 建立 Clean Architecture 的方案結構
2. 建立 dflow/specs/ 目錄和初始文件
3. 一起討論這個系統的 Bounded Contexts
```

### 預期產出
- Solution 結構：4 個專案（Domain, Application, Infrastructure, WebAPI）
- `dflow/specs/domain/context-map.md`：識別出 3 個 Context
- `dflow/specs/domain/glossary.md`：初始 10-15 個術語

### 預期的 Bounded Contexts

```
1. Expense（費用報銷）
   - 核心 Context
   - 費用報銷單的建立、提交、修改

2. Approval（審批）
   - 審批流程、審批政策
   - 可能有多級審批

3. Notification（通知）
   - 支援 Context
   - 接收 Domain Events，發送通知
```

---

## Phase 2：第一個 Aggregate — Money & ExpenseReport（預估 3-4 小時）

### 練習目標
- 設計你的第一個 Aggregate（ExpenseReport）
- 建立 Value Objects（Money, Currency, DateRange）
- 實作不變條件（Invariants）
- 寫 Domain 單元測試

### 在 Claude Code 中這樣繼續

```
我要開始做第一個功能：建立和提交費用報銷單。
請依照 SDD 流程引導我，從寫 spec 開始。
```

### 你會學到的 DDD 概念
- **Value Object**：Money 是經典範例。Amount + Currency 不可分割，
  兩個 Money(100, TWD) 是相等的。體會「用值定義」vs「用 ID 定義」的差異。
- **Aggregate Root**：ExpenseReport 控制所有 LineItem 的新增和修改，
  外部不能繞過 ExpenseReport 直接操作 LineItem。
- **Invariants**：「已提交的報銷單不能再修改」、「空報銷單不能提交」。
  這些規則在 Aggregate 的方法中強制執行。
- **Private Setters**：狀態只能透過方法改變，不能直接 `report.Status = xxx`。

### 檢驗點
- [ ] Money 能正確做加法（同幣別）、拒絕不同幣別相加
- [ ] ExpenseReport.AddLineItem() 在已提交時拋出例外
- [ ] ExpenseReport.Submit() 在沒有項目時拋出例外
- [ ] 所有規則都有對應的單元測試
- [ ] Domain 專案的 .csproj 沒有任何 NuGet 套件

---

## Phase 3：Domain Events（預估 2-3 小時）

### 練習目標
- 在 ExpenseReport.Submit() 中發出 Domain Event
- 在 Application 層建立 Event Handler
- 體會 Aggregate 之間透過事件溝通

### 在 Claude Code 中

```
ExpenseReport 提交後，審批流程需要開始。
我想用 Domain Event 來觸發，請引導我設計。
```

### 你會學到的 DDD 概念
- **Domain Event**：`ExpenseReportSubmittedEvent` — 告訴系統「有事發生了」
- **Eventual Consistency**：Approval Context 收到事件後建立審批任務，
  不需要和 ExpenseReport 在同一個交易中。
- **Event Handler**：在 Application 層處理事件，不是在 Domain 層。

### 檢驗點
- [ ] Submit() 後 DomainEvents 集合有一個 ExpenseReportSubmittedEvent
- [ ] Event Handler 接收到事件後建立 ApprovalTask
- [ ] ExpenseReport 和 ApprovalTask 是不同的 Aggregate

---

## Phase 4：第二個 Aggregate — Approval（預估 3-4 小時）

### 練習目標
- 設計 Approval Aggregate
- 實作審批流程（狀態機）
- 跨 Aggregate 溝通（Reference by ID）
- 審批完成後的 Domain Event

### 在 Claude Code 中

```
我要實作審批功能。主管可以核准或退回報銷單。
請從 spec 開始引導。
```

### 你會學到的 DDD 概念
- **Reference by ID**：ApprovalTask 持有 ExpenseReportId，
  不是持有 ExpenseReport 物件。
- **狀態機**：Pending → Approved / Rejected，每個轉換都有前置條件。
- **跨 Aggregate 互動**：ApprovalTask 被核准後，發出 `ReportApprovedEvent`，
  ExpenseReport 收到後更新自己的狀態。

### 檢驗點
- [ ] ApprovalTask 只透過 ExpenseReportId 引用報銷單
- [ ] Approve() 和 Reject() 都有對應的前置條件和 Domain Event
- [ ] 不能核准一個已經被退回的任務
- [ ] 核准後 ExpenseReport 的狀態也更新了（透過事件，不是直接修改）

---

## Phase 5：Application 層 CQRS（預估 2-3 小時）

### 練習目標
- 建立 Commands 和 Queries
- 實作 Command Handler（寫操作）
- 實作 Query Handler（讀操作）
- 理解為什麼讀寫分離

### 在 Claude Code 中

```
我要建立 API 讓前端能提交報銷單和查詢報銷清單。
請引導我用 CQRS 模式設計 Application 層。
```

### 你會學到的概念
- **Command**：`SubmitExpenseReportCommand` — 改變狀態，沒有回傳值（或只回傳 ID）
- **Query**：`GetPendingReportsQuery` — 不改變狀態，回傳 DTO
- **為什麼分離**：讀和寫的效能需求不同、模型不同、可以獨立優化。

---

## Phase 6：Infrastructure 和整合（預估 2-3 小時）

### 練習目標
- 建立 EF Core 設定（Fluent API）
- 實作 Repository
- 整合 Domain Event dispatch
- 跑一次完整流程

### 在 Claude Code 中

```
現在我要接上資料庫，讓整個流程跑起來。
請引導我設定 EF Core 和實作 Repository。
```

### 你會學到的概念
- **EF Config 在 Infrastructure 層**：Domain 完全不知道 EF Core 的存在。
- **Value Object 的 EF 設定**：`OwnsOne()` 設定 Money 等 Value Object。
- **Domain Event Dispatching**：SaveChanges 後自動發送事件。

---

## Phase 7：回顧和 Skill 檢視（預估 1-2 小時）

### 練習目標
- 回顧整個過程，哪些 Skill 引導有用、哪些需要改
- 收集修改 Skill 的建議
- 為正式專案做準備

### 在 Claude Code 中

```
我做完模擬專案了。讓我們回顧一下：
1. Skill 的引導流程哪些地方順暢、哪些地方卡住？
2. 有什麼 DDD 概念是 Skill 沒覆蓋到但我遇到了的？
3. 對正式專案，Skill 需要怎麼調整？
```

---

## 整體時間預估

| Phase | 內容 | 時間 |
|---|---|---|
| 1 | 建立基礎、識別 Context | 2-3 小時 |
| 2 | 第一個 Aggregate + Value Objects | 3-4 小時 |
| 3 | Domain Events | 2-3 小時 |
| 4 | 第二個 Aggregate + 跨 Aggregate 溝通 | 3-4 小時 |
| 5 | CQRS + Application 層 | 2-3 小時 |
| 6 | Infrastructure + 整合 | 2-3 小時 |
| 7 | 回顧 + Skill 檢視 | 1-2 小時 |
| **合計** | | **15-22 小時** |

不需要一次做完。每個 Phase 都是獨立的學習單元，可以一天做一個 Phase。

---

## 如何在 Claude Code 中開始

1. 將 `sdd-ddd-core/` 資料夾放到你要建模擬專案的位置
2. 啟動 Claude Code
3. 輸入：

```
請讀取 sdd-ddd-core/SKILL.md 以及 references/ 和 templates/ 下所有檔案。
我要開始一個 DDD 模擬練習專案：員工費用報銷系統（ExpenseTracker）。
這是練習用的，目的是在正式專案前熟悉 DDD。
請依照 Skill 中定義的流程引導我，從 Phase 1 開始。
```

Claude Code 就會按照 Skill 的決策樹和流程引導你一步步走。
遇到不理解的 DDD 概念，直接問，它會根據 ddd-modeling-guide.md 解釋。
