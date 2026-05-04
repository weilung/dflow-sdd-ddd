<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Domain Models

> DDD model catalog for one bounded context.

## Context

- **Bounded Context**: Expense
- **Source Code Area**: `src/ExpenseTracker.Domain/Expense/`
- **Last Updated**: 2026-04-29

## Aggregates

| Aggregate | Root Entity | Invariants | Code Mapping | Notes |
|---|---|---|---|---|
| ExpenseReport | ExpenseReport | 提交時必須 >=1 個 ExpenseItem；Submitted / Approved 不可編輯；Rejected 可重編；只有 Submitted 可 Approve / Reject | `ExpenseTracker.Domain.Expense.ExpenseReport` | phase 2 狀態機：Draft / Submitted / Approved / Rejected |
| ApprovalDecision <!-- phase-2 ADDED --> | ApprovalDecision | Approver 不可等於 Submitter；Rejected 必須有至少 10 字元原因；同一 Submit attempt 最多一筆 decision | `ExpenseTracker.Domain.Expense.ApprovalDecision` | 第二個 Aggregate；一個 Submit attempt 對應一筆 decision |

## Entities

| Entity | Responsibility | Key Identity | Aggregate | Code Mapping |
|---|---|---|---|---|
| ExpenseReport | 費用申報單主體；管理狀態變遷與 Items 集合 | `ExpenseReportId` (Guid) | ExpenseReport | `ExpenseTracker.Domain.Expense.ExpenseReport` |
| ExpenseItem | 單筆費用項目；金額、日期、類別、收據參照 | `ExpenseItemId`（在 Report 內唯一） | ExpenseReport | `ExpenseTracker.Domain.Expense.ExpenseItem` |
| ApprovalDecision <!-- phase-2 ADDED --> | 主管對一次 Submit 的核准 / 退回決定；保存 approver、時間、決定與附註 | `ApprovalDecisionId` (Guid) | ApprovalDecision | `ExpenseTracker.Domain.Expense.ApprovalDecision` |

## Value Objects

| Value Object | Responsibility | Equality Components | Code Mapping | Notes |
|---|---|---|---|---|
| Money | 金額 + 幣別 | (Amount, Currency) | `ExpenseTracker.Domain.Expense.Money` | MVP 固定 Currency = "TWD"，但用 VO 預留多幣別 |
| ReceiptReference | 收據編號或檔案參照 | (Value) | `ExpenseTracker.Domain.Expense.ReceiptReference` | 不存影像本體；Infrastructure 層存檔，Domain 只記參照 |
| ExpenseCategory | 費用類別（高鐵、住宿、餐費…） | (Code) | `ExpenseTracker.Domain.Expense.ExpenseCategory` | MVP 列舉內建類別；後續可擴充為動態管理 |
| ApprovalReason <!-- phase-2 ADDED --> | 退回原因 | (Value) | `ExpenseTracker.Domain.Expense.ApprovalReason` | Reject 必填，至少 10 字元 |

## Enums

| Enum | Values | Used By | Notes |
|---|---|---|---|
| ExpenseReportStatus <!-- phase-2 MODIFIED --> | Draft / Submitted / Approved / Rejected | ExpenseReport | phase 1 只有 Draft / Submitted；phase 2 擴張審核狀態 |
| ApprovalDecisionType <!-- phase-2 ADDED --> | Approved / Rejected | ApprovalDecision | 不支援 Pending；Pending 由 ExpenseReport.Status = Submitted 表示 |

## Domain Services

| Service | Responsibility | Inputs / Outputs | Code Mapping | Notes |
|---|---|---|---|---|
| _(none in phase 2)_ | — | — | — | 審核規則仍可由 Aggregate 自身處理；若未來政策複雜化再評估 Domain Service / Specification |

## Specifications

| Specification | Rule / Invariant | Used By | Code Mapping | Notes |
|---|---|---|---|---|
| _(none in phase 2)_ | — | — | — | 金額門檻 / 多階簽核出現時再考慮 |

## Repository Interfaces

| Repository | Aggregate | Query Responsibility | Code Mapping | Notes |
|---|---|---|---|---|
| IExpenseReportRepository | ExpenseReport | GetById / Add / Update；查詢主管待審清單可走 read model | `ExpenseTracker.Domain.Expense.IExpenseReportRepository` | phase 2 需支援 Submitted 狀態查詢 |
| IApprovalDecisionRepository <!-- phase-2 ADDED --> | ApprovalDecision | Add；FindByReportAndAttempt；exists check 防止重複審核 | `ExpenseTracker.Domain.Expense.IApprovalDecisionRepository` | Infrastructure 以 unique index 補強 one-to-one 約束 |
