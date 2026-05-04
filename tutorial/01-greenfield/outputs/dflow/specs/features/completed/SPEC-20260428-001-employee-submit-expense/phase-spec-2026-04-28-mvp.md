---
id: SPEC-20260428-001
title: 員工提交費用單 — MVP phase
status: in-progress
bounded-context: Expense
created: 2026-04-28
author: Alice
branch: feature/SPEC-20260428-001-employee-submit-expense
phase: 1
phase-slug: mvp
---

# 員工提交費用單 — MVP phase

## Problem Description <!-- Fill timing: Phase 1 -->

員工出差或公務結束後，目前公司流程是手填紙本或 Excel 寄信給主管，丟失率高、難稽核、跨部門對帳痛苦。第一個 phase 要讓員工至少能在系統內**建立費用申報單、加入費用項、提交給主管**——把「員工端」這段流程數位化。主管審核 / 財務匯款都暫不在 MVP 範圍。

## Domain Concepts <!-- Fill timing: Phase 2 -->

涉及的 Domain 概念（引用 `dflow/specs/domain/Expense/models.md`）：

| Concept | Type | Description |
|---|---|---|
| ExpenseReport | Aggregate Root | 費用申報單主體；管理狀態變遷與 Items 集合 |
| ExpenseItem | Entity | ExpenseReport 內的單筆費用項目 |
| Money | Value Object | 金額 + 幣別（MVP 固定 TWD） |
| ReceiptReference | Value Object | 收據編號 / 檔案參照 |
| ExpenseCategory | Value Object | 費用類別 |
| IExpenseReportRepository | Repository Interface | ExpenseReport 持久化抽象 |
| ExpenseReportSubmitted | Domain Event | ExpenseReport 提交成功時 raise |

更新檢查：
- [x] `dflow/specs/domain/glossary.md` — ExpenseReport / ExpenseItem / Approver / Reimbursement 4 個 term 已加入
- [x] `dflow/specs/domain/Expense/models.md` — 1 Aggregate / 2 Entity / 3 VO / 1 Repo 已記錄
- [x] `dflow/specs/domain/Expense/events.md` — ExpenseReportSubmitted 已記錄

<!-- dflow:section behavior-scenarios -->
## Behavior Scenarios <!-- Fill timing: Phase 3 -->

### Main Success Scenario

```gherkin
Scenario: 員工成功提交一份含 3 個費用項的 ExpenseReport
  Given 一份 ExpenseReport 處於 Draft 狀態
  And 內含 3 個 ExpenseItem，金額分別為 1500 / 2800 / 800 TWD
  When 員工呼叫 ExpenseReport.Submit()
  Then ExpenseReport.Status 變為 Submitted
  And SubmittedAt 被設為當下時間
  And 一個 ExpenseReportSubmitted Domain Event 被 raise，payload 含 (ReportId, EmployeeId, SubmittedAt, TotalAmount=5100)
  And ExpenseReport 不再可被編輯（後續任何 AddItem / RemoveItem / ModifyItem 呼叫應拋 DomainException）
```

### Alternative Scenarios

```gherkin
Scenario: 員工嘗試提交一份沒有費用項的 ExpenseReport
  Given 一份 ExpenseReport 處於 Draft 狀態
  And 內無任何 ExpenseItem（Items.Count == 0）
  When 員工呼叫 ExpenseReport.Submit()
  Then 拋出 DomainException("ExpenseReport must contain at least one ExpenseItem to submit.")
  And ExpenseReport.Status 維持 Draft
  And 不 raise 任何 Domain Event
```

```gherkin
Scenario: 員工嘗試在 Submitted 狀態下加入新的 ExpenseItem
  Given 一份 ExpenseReport 已處於 Submitted 狀態
  When 員工呼叫 ExpenseReport.AddItem(...)
  Then 拋出 DomainException("Cannot modify a submitted ExpenseReport.")
  And Items 集合不變
```

## Business Rules <!-- Fill timing: Phase 3 -->

> 首 phase，所有 BR 都是新建。完整定義權威在 `dflow/specs/domain/Expense/rules.md`；本表只列本 phase 引入的 BR-ID + 一行 + 實作位置。

| BR-ID | Rule | Implementation Location |
|---|---|---|
| BR-001 | 提交時必須至少含 1 個 ExpenseItem | Domain: ExpenseReport.Submit() |
| BR-002 | Submitted 後不可編輯 | Domain: ExpenseReport.AddItem / RemoveItem / ModifyItem 入口檢查 |
| BR-003 | ExpenseItem.Money.Amount 必須 > 0 | Domain: Money 建構式 + ExpenseItem 建構式 |
| BR-004 | 同一 Report 內 ReceiptReference 不可重複 | Domain: ExpenseReport.AddItem() |

## Delta from prior phases <!-- Fill timing: Phase 3; skip for the first phase -->

首 phase，無前置 Delta。

## Edge Cases <!-- Fill timing: Phase 3 -->

| ID | Case | Expected Handling |
|---|---|---|
| EC-001 | 員工建一個 ExpenseItem 時填金額 = 0（或負數） | Money VO 建構式直接拋 ArgumentException("Amount must be positive."); ExpenseItem 永遠不會帶著無效金額存在 → 衍生 BR-003 |
| EC-002 | 員工把同一張收據（同 ReceiptReference）加進兩個 Item | ExpenseReport.AddItem() 偵測到重複 → 拋 DomainException("Receipt {refValue} already attached to this report."); MVP 不允許覆寫，必須先移除舊 Item → 衍生 BR-004 |
| EC-003 | 員工在 Draft 狀態反覆呼叫 Submit() | 第一次 Submit 改變狀態；第二次以後因為 Status != Draft → 拋 DomainException("Only Draft reports can be submitted, current status: Submitted.") |

## Domain Events <!-- Fill timing: Phase 2-3 -->

| Event | Trigger | Handler | Sync / Async |
|---|---|---|---|
| ExpenseReportSubmitted | ExpenseReport.Submit() 成功時 | _(MVP 無 consumer；保留給 phase 2 Approval handler)_ | in-process / sync（MediatR INotification，同 transaction 內 dispatch） |

## Implementation Plan (Layer by Layer) <!-- Fill timing: Phase 4 -->

### Domain Layer
- `ExpenseReport` Aggregate Root：private setter / `Submit()` / `AddItem()` / `RemoveItem()` / `ModifyItem()` 方法；內部 `_items: List<ExpenseItem>`；`DomainEvents` 集合
- `ExpenseItem` Entity：建構式驗證金額 > 0
- `Money`、`ReceiptReference`、`ExpenseCategory` VOs：record types，建構式驗證
- `ExpenseReportSubmitted` Domain Event：record type，含 (ReportId, EmployeeId, SubmittedAt, TotalAmount)
- `IExpenseReportRepository` interface
- 不變條件詳見 `aggregate-design.md`

### Application Layer
- `SubmitExpenseReportCommand` (含 ReportId, EmployeeId)
- `SubmitExpenseReportCommandHandler` — load Aggregate → call Submit() → SaveChanges → publish DomainEvents
- `SubmitExpenseReportCommandValidator` (FluentValidation) — 檢 ReportId 非空、EmployeeId 非空
- `AddExpenseItemCommand` + Handler + Validator（同上模式）
- `CreateExpenseReportCommand` + Handler + Validator
- DTOs：`ExpenseReportDto`、`ExpenseItemDto`

### Infrastructure Layer
- `ExpenseReportConfiguration` (EF Core Fluent API) — 配置 Aggregate、Owned Type 配 Money / ReceiptReference / ExpenseCategory
- `ExpenseReportRepository` 實作 `IExpenseReportRepository`
- 第一份 EF Migration：`InitialExpenseSchema`（建 ExpenseReports + ExpenseItems 兩張表）

### Presentation Layer
- `ExpenseReportsController` — `POST /api/expense-reports`（建 Draft）、`POST /api/expense-reports/{id}/items`、`POST /api/expense-reports/{id}/submit`
- Request / Response 模型
- Swagger annotation

## Data Structure Changes <!-- Fill timing: Phase 4 -->

| Table | Column | Change Type | Description |
|---|---|---|---|
| ExpenseReports | Id, EmployeeId, Status, CreatedAt, SubmittedAt | 新增 | 主表 |
| ExpenseItems | Id, ExpenseReportId (FK), Amount, Currency, Category, ReceiptRef, OccurredOn | 新增 | 子表，FK 到 ExpenseReports |

## Test Strategy <!-- Fill timing: Phase 4 -->

### Domain Unit Tests
- [ ] ExpenseReport.Submit() 主場景：3 個 Item → Status = Submitted、event raised、TotalAmount 正確
- [ ] ExpenseReport.Submit() 空 Items → throw DomainException（驗 BR-001）
- [ ] Submitted 後 AddItem → throw DomainException（驗 BR-002）
- [ ] Money(0, "TWD") → throw ArgumentException（驗 BR-003 / EC-001）
- [ ] AddItem 重複 ReceiptReference → throw DomainException（驗 BR-004 / EC-002）
- [ ] 二次 Submit → throw DomainException（驗 EC-003）

### Application Tests
- [ ] SubmitExpenseReportCommandHandler 主場景（mock IExpenseReportRepository）
- [ ] Validator 驗 ReportId / EmployeeId 非空

### Integration Tests
- [ ] ExpenseReportRepository 存取 round-trip（用 in-memory SQLite 或 Testcontainers）

<!-- dflow:section open-questions -->
## Open Questions <!-- Fill timing: Phase 1-4 -->

- ExpenseItem 設計成 Entity（有 Id）還是 VO？目前選 Entity，因為日後員工可能要「修改某筆 Item 的金額」，需要穩定 identity。詳見 `aggregate-design.md` § Design Decisions
- ExpenseReportSubmitted 的 publish timing：MVP 用「SaveChanges 後手動 Publish」最簡；日後上 outbox 模式時要重新檢視 handler 註冊機制

<!-- dflow:section implementation-tasks -->
## Implementation Tasks <!-- Fill timing: generated by AI after Phase 4; all items should be checked at completion -->

- [ ] DOMAIN-1: 建 `Money` / `ReceiptReference` / `ExpenseCategory` 三個 VO（record types，建構式驗證）
- [ ] DOMAIN-2: 建 `ExpenseItem` Entity（金額 > 0 驗證；private setters）
- [ ] DOMAIN-3: 建 `ExpenseReport` Aggregate Root（Status enum、`_items` 集合、`Submit()` / `AddItem()` / `RemoveItem()` / `ModifyItem()` 方法、`DomainEvents` 集合）
- [ ] DOMAIN-4: 建 `ExpenseReportSubmitted` Domain Event (record)
- [ ] DOMAIN-5: 建 `IExpenseReportRepository` interface
- [ ] APP-1: 建 `CreateExpenseReportCommand` + Handler + Validator
- [ ] APP-2: 建 `AddExpenseItemCommand` + Handler + Validator
- [ ] APP-3: 建 `SubmitExpenseReportCommand` + Handler + Validator
- [ ] APP-4: 建 DTOs (`ExpenseReportDto`、`ExpenseItemDto`)
- [ ] INFRA-1: 建 `ExpenseReportConfiguration` (EF Fluent API)，含 Owned Types
- [ ] INFRA-2: 實作 `ExpenseReportRepository`
- [ ] INFRA-3: 產 `InitialExpenseSchema` migration
- [ ] API-1: 建 `ExpenseReportsController` + 三個 endpoints + Request/Response models + Swagger
- [ ] TEST-1: Domain unit tests — 6 個案例（見 Test Strategy § Domain Unit Tests）
- [ ] TEST-2: Application handler tests — Submit handler 主場景 + Validator 測試
- [ ] TEST-3: Integration test — Repository round-trip
