---
id: BUG-002
title: Reject 後 ExpenseReport 狀態未持久化
status: completed
bounded-context: Expense
created: 2026-05-12
branch: bugfix/BUG-002-reject-not-persisted
host-feature: SPEC-20260512-001-reject-not-persisted
tier: T2
bug_number: 002
reported_date: 2026-05-12
reported_by: Carol
slug: reject-not-persisted
---

<!-- Formatting convention: keep table cells concise. Separate multiple short items with <br> - never chain them into one line with ；/; separators. Long narrative detail belongs in a document section, not in a table cell. -->

# BUG-002 — Reject 後 ExpenseReport 狀態未持久化

## Problem

2026-05-12 上午，財務部主管 Carol 回報：

```text
我 reject 一張單、理由打了「金額對不上，請附收據」，
系統說成功。
但我回到列表看，那張單還是 Submitted，
沒有變成 Rejected。重新整理也一樣。
```

Alice 重現後確認：

| 觀察點 | 結果 |
|---|---|
| `ApprovalDecision` 是否建立 | ✅ 有，資料庫查得到，Reason 也正確寫入。 |
| `ExpenseReport.Reject()` 是否被呼叫 | ✅ 有，in-memory 的 Status 確實變成 `Rejected`。 |
| 資料庫裡 `ExpenseReport.Status` | ❌ 仍是 `Submitted`。 |
| UI 顯示 | ❌ 列表與明細都仍顯示 Submitted。 |

這是 bug-fix，**不是新的審核需求**。BR-002 與 BR-006 的規則文字維持不變；修正範圍是
Application 層的 transaction 邊界，以及對應的 regression test。

## Root Cause

`RejectExpenseReportHandler` 透過兩個不同的 repository 取出兩個 Aggregate，但只對其中一個
呼叫了持久化：

```csharp
// Before
var report = await _reports.GetAsync(cmd.ReportId);
var decision = ApprovalDecision.Reject(cmd.ApproverId, cmd.Reason);

report.Reject(decision);                 // in-memory 狀態已改變
await _decisions.AddAsync(decision);
await _decisions.SaveChangesAsync();     // ← 只 flush 了 ApprovalDecision
```

`_decisions.SaveChangesAsync()` 走的是 `ApprovalDecision` 自己的 `DbContext` scope，
`ExpenseReport` 的變更從未進入任何 `SaveChanges` 呼叫。

單元測試沒抓到，是因為它們斷言的是 `report.Status`（in-memory 物件），而不是重新從
repository 讀回來的狀態。

## Behavior Delta

BR Delta: none — implementation defect
Governing BR-IDs: BR-002, BR-006

> 兩欄分開是刻意的：**沒有 BR delta 不等於沒有治理規則。** 只寫一句「沒有 BR」會把
> BR-002 / BR-006 的追溯線一起抹掉。

**Before**:
Given 一張 Status = Submitted 的 ExpenseReport
And ApproverId != SubmitterId
When 主管執行 Reject 並附上合法的 ApprovalReason
Then 建立一筆 ApprovalDecision（Rejected）
And ExpenseReport 的 in-memory Status 變為 Rejected
And **持久化只涵蓋 ApprovalDecision**
And 重新讀取後 ExpenseReport.Status 仍為 Submitted。

**After**:
Given 同樣的前置狀態
When 主管執行 Reject 並附上合法的 ApprovalReason
Then ApprovalDecision 與 ExpenseReport 的變更在**同一個 transaction 內**一起持久化
And 重新讀取後 ExpenseReport.Status 為 Rejected
And 任一方失敗時兩者皆不落地。

**Reason**:
BR-002 明訂「被 Reject 後可重新編輯並再次 Submit」，BR-006 明訂「只有 Submitted 能被
Approve / Reject」。兩條規則都預設 Reject 之後狀態**真的**變了。實作沒有做到規則已經
描述的事——這是 implementation-level 的缺陷，不是 BR-level 的 delta。

### UNCHANGED — explicitly unaffected

- BR-001 至少一個 ExpenseItem
- BR-002 提交後不可編輯（Reject 後可重編）— **wording unchanged**
- BR-003 Money.Amount > 0
- BR-004 ReceiptReference 不重複
- BR-005 不可審核自己提交的單
- BR-006 只有 Submitted 能被審核 — **wording unchanged**
- BR-007 Reject 必須附註原因（雙語長度規則）

## Implementation Paths

> 最小 host 的每一列都要能指出這次變更碰到的原始碼路徑。T2 由本段承載，`_index.md`
> 的 Lightweight Changes row 只要外連過來。`/dflow:finish-feature` 會拿 checkpoint 1 的
> diff 與本段比對；**一個路徑都沒宣告會擋下 closeout**，不會當成通過。

- `src/Application/Expense/RejectExpenseReportHandler.cs`
- `src/Infrastructure/Persistence/ExpenseUnitOfWork.cs`

## Fix Approach

主要修正在 **Application 層**：

- 讓 reject flow 走同一個 Unit of Work，使 `ExpenseReport` 與 `ApprovalDecision` 的變更在
  同一個 transaction 內一起提交。
- 移除 handler 內針對單一 repository 的 `SaveChangesAsync()` 呼叫；持久化的責任上移到
  Unit of Work。

```csharp
// After
var report = await _reports.GetAsync(cmd.ReportId);
var decision = ApprovalDecision.Reject(cmd.ApproverId, cmd.Reason);

report.Reject(decision);
await _decisions.AddAsync(decision);
await _uow.CommitAsync();                // ← 一次提交涵蓋兩個 Aggregate
```

**不做**的事（刻意）：

- 不合併 `ExpenseReport` 與 `ApprovalDecision` 兩個 Aggregate。它們的邊界是 phase 2 經過
  設計討論才切開的；一個持久化缺陷不足以推翻那個決定。
- 不新增 BR。「狀態變更要存進資料庫」不是主管會用來決策的業務語言。
- 不重寫全站的 transaction 策略——見下方 Follow-up Notes。

## Implementation Tasks

- [x] APP-1: `RejectExpenseReportHandler` 改走 Unit of Work，移除單一 repository 的 SaveChanges
- [x] INFRA-1: `ExpenseUnitOfWork.CommitAsync()` 涵蓋 ExpenseReport 與 ApprovalDecision
- [x] TEST-1: regression test — Reject 後**重新自 repository 讀回**，斷言 Status = Rejected（不是斷言 in-memory 物件）
- [x] TEST-2: regression test — ApprovalDecision 寫入失敗時，ExpenseReport 狀態不得落地（transaction 回滾）
- [x] TEST-3: regression test — Approve path 同樣斷言重新讀回後的狀態（避免同型缺陷潛伏在另一條路徑）

## Follow-up Notes

TEST-1 的形狀本身是這次最重要的產出：**斷言重新讀回的狀態，而不是 in-memory 物件**。
原本的測試之所以全綠，正是因為它們斷言的是 handler 剛剛改過的那個物件。

「一次操作跨多個 Aggregate 的持久化邊界」若在其他 flow 也重複出現，屬於 architecture 層級的
Unit of Work 策略問題，應記入 `dflow/specs/architecture/tech-debt.md` 並獨立處理，
不要擴張到這次 T2 的 scope 裡。
