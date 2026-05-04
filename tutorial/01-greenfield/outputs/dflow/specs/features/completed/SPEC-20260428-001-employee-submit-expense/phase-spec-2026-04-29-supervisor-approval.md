---
id: SPEC-20260428-001
title: 員工提交費用單 — supervisor approval phase
status: in-progress
bounded-context: Expense
created: 2026-04-29
author: Alice
branch: feature/SPEC-20260428-001-employee-submit-expense
phase: 2
phase-slug: supervisor-approval
---

# 員工提交費用單 — supervisor approval phase

## Problem Description <!-- Fill timing: Phase 1 -->

phase 1 MVP 讓員工能建立並提交 ExpenseReport，主管端也能看到送來的單，但小範圍試用後主管回饋：「我只能看到員工送來的單，但我點進去看完無法做任何動作。」

phase 2 要補上主管審核動作：主管可以核准或退回一份已提交的 ExpenseReport。核准後 ExpenseReport 進入 Approved，退回後進入 Rejected，並允許員工依退回原因重新編輯後再次 Submit。這個 phase 不處理通知 email、SLA timer、財務匯款或批次審核。

## Domain Concepts <!-- Fill timing: Phase 2 -->

涉及的 Domain 概念（引用 `dflow/specs/domain/Expense/models.md`）：

| Concept | Type | Description |
|---|---|---|
| ExpenseReport | Aggregate Root | 費用申報單主體；phase 2 狀態機擴張為 Draft / Submitted / Approved / Rejected |
| ApprovalDecision | Aggregate Root | 一次 Submit 對應的一次主管審核決定，記錄 approver、時間、決定與附註 |
| Approver | External Role / ID Reference | 主管或具審核權限的人；在 Expense BC 中以 ApproverId 引用，不建模組織階層 |
| ApprovalReason | Value Object | 退回原因；Reject 時必填且至少 10 字元 |
| ExpenseReportApproved | Domain Event | ExpenseReport 被核准時 raise |
| ExpenseReportRejected | Domain Event | ExpenseReport 被退回時 raise |

更新檢查：
- [x] `dflow/specs/domain/glossary.md` — ApprovalDecision / Approver / ApprovalReason 已更新
- [x] `dflow/specs/domain/Expense/models.md` — ApprovalDecision Aggregate + 狀態機擴張已記錄
- [x] `dflow/specs/domain/Expense/events.md` — ExpenseReportApproved / ExpenseReportRejected 已記錄

<!-- dflow:section behavior-scenarios -->
## Behavior Scenarios <!-- Fill timing: Phase 3 -->

### Main Success Scenario

```gherkin
Scenario: 主管核准一份已提交的 ExpenseReport
  Given 一份 ExpenseReport 處於 Submitted 狀態
  And ExpenseReport.SubmitterId = "emp-001"
  And ApproverId = "mgr-101"
  And 尚未存在此 Submit attempt 的 ApprovalDecision
  When 主管呼叫 ApproveExpenseReportCommand(ReportId, ApproverId, Note)
  Then ExpenseReport.Status 變為 Approved
  And 建立一筆 ApprovalDecision，Decision = Approved，ApproverId = "mgr-101"，DecidedAt = now
  And 一個 ExpenseReportApproved Domain Event 被 raise，payload 含 (ReportId, SubmitterId, ApproverId, ApprovedAt)
```

### Alternative Scenarios

```gherkin
Scenario: 主管退回一份已提交的 ExpenseReport
  Given 一份 ExpenseReport 處於 Submitted 狀態
  And ExpenseReport.SubmitterId = "emp-001"
  And ApproverId = "mgr-101"
  And Reject reason = "住宿發票缺少統一編號"
  When 主管呼叫 RejectExpenseReportCommand(ReportId, ApproverId, Reason)
  Then ExpenseReport.Status 變為 Rejected
  And 建立一筆 ApprovalDecision，Decision = Rejected，Reason = "住宿發票缺少統一編號"
  And 一個 ExpenseReportRejected Domain Event 被 raise，payload 含 (ReportId, SubmitterId, ApproverId, RejectedAt, Reason)
  And ExpenseReport 可重新編輯並再次 Submit
```

```gherkin
Scenario: 主管嘗試審核自己提交的 ExpenseReport
  Given 一份 ExpenseReport 處於 Submitted 狀態
  And ExpenseReport.SubmitterId = "mgr-101"
  When 同一個 ApproverId = "mgr-101" 呼叫 ApproveExpenseReportCommand
  Then 拋出 DomainException("Approver cannot approve their own ExpenseReport.")
  And ExpenseReport.Status 維持 Submitted
  And 不建立 ApprovalDecision
  And 不 raise 任何 Domain Event
```

```gherkin
Scenario: 主管嘗試退回但未提供足夠原因
  Given 一份 ExpenseReport 處於 Submitted 狀態
  And ApproverId != SubmitterId
  When 主管呼叫 RejectExpenseReportCommand 且 Reason 少於 10 字元
  Then 拋出 DomainException("Reject reason must contain at least 10 characters.")
  And ExpenseReport.Status 維持 Submitted
  And 不建立 ApprovalDecision
```

## Business Rules <!-- Fill timing: Phase 3 -->

> Phase 2+ 注意：本段僅列本 phase 新增 / 修改到的 BR；未變動的 BR 不重抄（它們的當前狀態見 feature 的 `_index.md` Current BR Snapshot 表）。

| BR-ID | Rule | Implementation Location |
|---|---|---|
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | Domain: ExpenseReport status transition guards |
| BR-005 | 主管不可審核自己提交的 ExpenseReport；`SubmitterId != ApproverId` 必須由 Domain 層強制。 | Domain: ApprovalDecision.CreateApproved / CreateRejected |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | Domain: ExpenseReport.Approve / Reject |
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 10 字元，否則 raise DomainException。 | Domain: ApprovalReason |

## Delta from prior phases <!-- Fill timing: Phase 3; skip for the first phase -->

> 本段僅記本 phase 相對 phase 1 (mvp) 的變化，不累積歷史。歷史由 feature 目錄下各 phase-spec 的本段串接閱讀；feature 層的當前累積狀態見 `_index.md` 的 Current BR Snapshot。

### ADDED - BR / behavior added in this phase

#### Rule: BR-005 主管不可審核自己提交的 ExpenseReport
Given 一份 ExpenseReport 處於 Submitted 狀態
And `SubmitterId = "mgr-101"`
When `ApproverId = "mgr-101"` 呼叫 Approve 或 Reject
Then 拋出 DomainException("Approver cannot approve their own ExpenseReport.")
And ExpenseReport.Status 維持 Submitted
And 不建立 ApprovalDecision
And 不 raise Domain Event

#### Rule: BR-006 只有 Submitted 的 ExpenseReport 能被 Approve / Reject
Given 一份 ExpenseReport 處於 Draft / Approved / Rejected 任一非 Submitted 狀態
When 主管呼叫 Approve 或 Reject
Then 拋出 DomainException("Only submitted ExpenseReports can be approved or rejected.")
And ExpenseReport.Status 不變
And 不建立 ApprovalDecision
And 不 raise Domain Event

#### Rule: BR-007 Reject 必須附註原因
Given 一份 ExpenseReport 處於 Submitted 狀態
And `ApproverId != SubmitterId`
When 主管呼叫 Reject 且 Reason 少於 10 字元
Then 拋出 DomainException("Reject reason must contain at least 10 characters.")
And ExpenseReport.Status 維持 Submitted
And 不建立 ApprovalDecision

### MODIFIED - BR / behavior modified in this phase

#### Rule: BR-002 Submitted 後不可編輯，但 Rejected 可重編
**Before (phase 1 原文)**: `ExpenseReport 提交成功後狀態變為 Submitted，且不可再被編輯。`

**After (phase 2 新文)**: `ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。`

**Behavior before**: Given ExpenseReport.Status = Submitted / When 呼叫 AddItem、RemoveItem、ModifyItem / Then raise DomainException("Cannot modify a submitted ExpenseReport.") / 不產生 event。

**Behavior after**: Given ExpenseReport.Status = Submitted / When 呼叫 AddItem、RemoveItem、ModifyItem / Then raise DomainException("Cannot modify a submitted ExpenseReport.") / 不產生 event。Given ExpenseReport.Status = Rejected / When 呼叫 AddItem、RemoveItem、ModifyItem / Then 允許編輯，且第一次編輯時 Status 回到 Draft，因此員工可以再次 Submit，並為新的 submit attempt 建立新的 ApprovalDecision。

**Reason**: phase 2 引入主管退回。Rejected 若仍完全不可編輯，員工只能重新建一張單，會切斷原 Report 的稽核軌跡；允許 Rejected 重編能保留同一 Report 的歷史，同時讓每次 Submit 對應新的 ApprovalDecision。

### REMOVED - BR removed in this phase

_(none)_

### RENAMED - BR renamed in this phase

_(none)_

### UNCHANGED - explicitly unaffected

- BR-001 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem。
- BR-003 ExpenseItem 的 Money.Amount 必須 > 0。
- BR-004 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。

## Edge Cases <!-- Fill timing: Phase 3 -->

| ID | Case | Expected Handling |
|---|---|---|
| EC-004 | ApproverId 等於 SubmitterId | Domain 層拒絕，拋 DomainException；此規則不能只靠 UI 或 Application validator |
| EC-005 | 主管對 Draft / Approved / Rejected 狀態呼叫 Approve 或 Reject | Domain 層拒絕，Status 不變，不建立 ApprovalDecision |
| EC-006 | Reject reason 為空白、null 或少於 10 字元 | ApprovalReason 建構式拒絕 |
| EC-007 | Rejected 後員工重新編輯並再次 Submit | Rejected 狀態允許編輯；再次 Submit 進入 Submitted，後續會建立新的 ApprovalDecision |
| EC-008 | 同一 Submit attempt 重複審核 | ApprovalDecision one-to-one 約束拒絕第二筆 decision；Application 層以 unique index / concurrency guard 補強 |

## Domain Events <!-- Fill timing: Phase 2-3; draft during design, finalized during spec writing -->

| Event | Trigger | Handler | Sync / Async |
|---|---|---|---|
| ExpenseReportApproved | ExpenseReport.Approve() 成功且 ApprovalDecision 建立後 | _(phase 2 暫無外部 consumer；保留給 phase 3 Reimbursement)_ | in-process / sync（MediatR INotification，同 transaction 內 dispatch） |
| ExpenseReportRejected | ExpenseReport.Reject() 成功且 ApprovalDecision 建立後 | _(phase 2 暫無外部 consumer；UI 可透過查詢讀取 reason)_ | in-process / sync（MediatR INotification，同 transaction 內 dispatch） |

## Implementation Plan (Layer by Layer) <!-- Fill timing: Phase 4 -->

### Domain Layer
- 擴張 `ExpenseReportStatus`：Draft / Submitted / Approved / Rejected
- 在 `ExpenseReport` 加 `Approve(approverId, note, decidedAt)`、`Reject(approverId, reason, decidedAt)`、Rejected 狀態的 edit guard
- 新增 `ApprovalDecision` Aggregate Root：一筆 Submit attempt 對應一筆 decision
- 新增 `ApprovalDecisionType` enum：Approved / Rejected
- 新增 `ApprovalReason` VO：Reject reason 至少 10 字元
- 新增 `ExpenseReportApproved` / `ExpenseReportRejected` Domain Events

### Application Layer
- `ApproveExpenseReportCommand` + Handler + Validator
- `RejectExpenseReportCommand` + Handler + Validator
- `GetSubmittedExpenseReportsForApproverQuery`（主管待審清單，read model 查詢）
- `ApprovalDecisionDto` / 更新 `ExpenseReportDto` 狀態欄位

### Infrastructure Layer
- `ApprovalDecisionConfiguration` (EF Core Fluent API)
- `IApprovalDecisionRepository` / `ApprovalDecisionRepository`
- migration：新增 ApprovalDecisions table，更新 ExpenseReports.Status enum / column constraint
- unique index：`ApprovalDecisions(ExpenseReportId, SubmitAttemptNo)`

### Presentation Layer
- `POST /api/expense-reports/{id}/approve`
- `POST /api/expense-reports/{id}/reject`
- `GET /api/expense-reports/pending-approval`
- Request / Response models + Swagger annotations

## Data Structure Changes <!-- Fill timing: Phase 4 -->

| Table | Column | Change Type | Description |
|---|---|---|---|
| ExpenseReports | Status | 修改 | Enum 擴張：Draft / Submitted / Approved / Rejected |
| ExpenseReports | LastRejectedAt | 新增 | optional；方便查詢退回時間，Domain 狀態仍以 Status 為主 |
| ApprovalDecisions | Id, ExpenseReportId, SubmitAttemptNo, ApproverId, Decision, Note, Reason, DecidedAt | 新增 | 第二個 Aggregate 的主表；一個 Submit attempt 對應一筆 decision |
| ApprovalDecisions | UX_ApprovalDecision_Report_Attempt | 新增 index | `(ExpenseReportId, SubmitAttemptNo)` unique，防止同一次 Submit 被審兩次 |

## Test Strategy <!-- Fill timing: Phase 4 -->

### Domain Unit Tests
- [ ] Approve Submitted report → Status = Approved、ApprovalDecision 建立、ExpenseReportApproved raised
- [ ] Reject Submitted report with valid reason → Status = Rejected、ApprovalDecision 建立、ExpenseReportRejected raised
- [ ] ApproverId == SubmitterId → throw DomainException（驗 BR-005）
- [ ] Approve / Reject non-Submitted report → throw DomainException（驗 BR-006）
- [ ] Reject reason 少於 10 字元 → throw DomainException（驗 BR-007）
- [ ] Rejected report can be edited and submitted again（驗 BR-002 modified）

### Application Tests
- [ ] ApproveExpenseReportCommandHandler 主場景
- [ ] RejectExpenseReportCommandHandler 主場景
- [ ] Handler 不允許同一 Submit attempt 建立第二筆 ApprovalDecision

### Integration Tests
- [ ] ApprovalDecisionRepository round-trip
- [ ] unique index 防止同一 Report + SubmitAttemptNo 重複寫入

<!-- dflow:section open-questions -->
## Open Questions <!-- Fill timing: Phase 1-4 -->

- 要不要支援「批次 Approve」？phase 2 不做。先完成單筆審核，等主管實際使用後再評估批次操作是否是 T1 新 phase 或 T2 lightweight change。
- Rejected 後重新 Submit 是否要保留完整 item 編輯歷史？phase 2 只保留 ApprovalDecision 與 Report 狀態歷史；item-level 稽核軌跡留到審計需求明確後再評。
- Approval policy 若未來出現金額門檻、二階主管、代理人等複雜規則，需重新檢視是否拆成獨立 Approval BC。

<!-- dflow:section implementation-tasks -->
## Implementation Tasks <!-- Fill timing: generated by AI after Phase 4; all items should be checked at completion -->

- [ ] DOMAIN-1: 擴張 `ExpenseReportStatus` 為 Draft / Submitted / Approved / Rejected
- [ ] DOMAIN-2: 更新 `ExpenseReport` 狀態轉移與 edit guard，支援 Approve / Reject / Rejected 後重編
- [ ] DOMAIN-3: 建 `ApprovalDecision` Aggregate Root 與 `ApprovalDecisionType`
- [ ] DOMAIN-4: 建 `ApprovalReason` VO（Reject reason 至少 10 字元）
- [ ] DOMAIN-5: 建 `ExpenseReportApproved` / `ExpenseReportRejected` Domain Events
- [ ] DOMAIN-6: 建 `IApprovalDecisionRepository` interface
- [ ] APP-1: 建 `ApproveExpenseReportCommand` + Handler + Validator
- [ ] APP-2: 建 `RejectExpenseReportCommand` + Handler + Validator
- [ ] APP-3: 建 `GetSubmittedExpenseReportsForApproverQuery` + Handler
- [ ] APP-4: 更新 `ExpenseReportDto`，新增 `ApprovalDecisionDto`
- [ ] INFRA-1: 建 `ApprovalDecisionConfiguration` (EF Fluent API)
- [ ] INFRA-2: 實作 `ApprovalDecisionRepository`
- [ ] INFRA-3: 產 migration：新增 ApprovalDecisions、擴張 ExpenseReports.Status、加 unique index
- [ ] API-1: 新增 approve / reject endpoints + request/response models + Swagger
- [ ] API-2: 新增 pending-approval query endpoint
- [ ] TEST-1: Domain unit tests — BR-002 modified + BR-005..007 + event assertions
- [ ] TEST-2: Application handler tests — Approve / Reject 主場景與重複審核防護
- [ ] TEST-3: Integration tests — ApprovalDecision repository + unique index
