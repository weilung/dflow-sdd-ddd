---
aggregate: ExpenseReport, ApprovalDecision
bounded-context: Expense
created: 2026-04-28
last-updated: 2026-04-30
---

# Expense Aggregates

## Purpose

Expense BC 負責員工費用申報資料的生命週期。phase 1 建立 **ExpenseReport** Aggregate，處理 Draft → Submitted。phase 2 新增 **ApprovalDecision** Aggregate，記錄主管對一次 Submit 的核准或退回決定。

ApprovalDecision 留在 Expense BC 內，不拆獨立 Approval BC。理由：phase 2 的審核動作仍緊密圍繞 ExpenseReport 狀態機，沒有獨立政策語言、跨部門 SLA、代理簽核或多階審批規則。未來若 Approval policy 複雜化，再檢視是否拆 BC。

## Aggregate: ExpenseReport

### Invariants

> 必須永遠為真的規則。這是 Aggregate 存在的理由。

| ID | Invariant | Behavior on Violation |
|---|---|---|
| INV-01 | ExpenseReport 提交時必須至少含 1 個 ExpenseItem | `Submit()` 拋 `DomainException("ExpenseReport must contain at least one ExpenseItem to submit.")` |
| INV-02 | Submitted / Approved 狀態下，Items 集合與其內容不可被改變；Rejected 是唯一可重新編輯的非 Draft 狀態 | `AddItem()` / `RemoveItem()` / `ModifyItem()` 入口檢查 Status；Submitted / Approved 拋 `DomainException("Cannot modify a submitted or approved ExpenseReport.")`；Rejected 允許重編並回到 Draft |
| INV-03 | 每個 ExpenseItem 的 Money.Amount 必須 > 0 | `Money` record 建構式拋 `ArgumentException("Amount must be positive.")`；ExpenseItem 永遠不會帶著無效金額存在 |
| INV-04 | 同一 ExpenseReport 內，相同 ReceiptReference 不可重複出現 | `AddItem()` 偵測到 Items 已含相同 ReceiptReference 時拋 `DomainException("Receipt {refValue} already attached to this report.")` |
| INV-05 | 只有 Draft 狀態的 ExpenseReport 能被 Submit | `Submit()` 檢查 Status，非 Draft 時拋 `DomainException("Only Draft reports can be submitted, current status: {Status}.")` |
| INV-06 <!-- phase-2 ADDED --> | 只有 Submitted 狀態的 ExpenseReport 能被 Approve / Reject | `Approve()` / `Reject()` 檢查 Status，非 Submitted 時拋 `DomainException("Only submitted ExpenseReports can be approved or rejected.")` |

### Structure

```
ExpenseReport (Aggregate Root)
├── ExpenseReportId         (Value Object — Guid wrapper)
├── SubmitterId             (Value Object — EmployeeId，跨 BC 引用)
├── Status                  (Enum — Draft / Submitted / Approved / Rejected)
├── SubmitAttemptNo         (int — 每次 Submit 遞增，用於對應 ApprovalDecision)
├── CreatedAt / SubmittedAt / ApprovedAt / RejectedAt (DateTimeOffset)
└── _items: List<ExpenseItem>   (Entity collection — internal field; expose IReadOnlyCollection)
        ├── ExpenseItemId    (Value Object — Guid wrapper, 在 Report 內唯一)
        ├── Money            (Value Object — Amount + Currency)
        ├── ExpenseCategory  (Value Object — Code)
        ├── ReceiptReference (Value Object — Value)
        └── OccurredOn       (DateOnly)
```

### Aggregate Root

| Property | Type | Description |
|---|---|---|
| Id | ExpenseReportId | 唯一識別 |
| SubmitterId | EmployeeId | 提交者，跨 Identity BC ID 引用 |
| Status | ExpenseReportStatus | Draft / Submitted / Approved / Rejected |
| SubmitAttemptNo | int | 每次 Submit 成功遞增；ApprovalDecision 以此與一次 Submit 對齊 |
| Items | IReadOnlyCollection&lt;ExpenseItem&gt; | 對外唯讀；內部 `_items: List<ExpenseItem>` |
| CreatedAt | DateTimeOffset | 建立時戳 |
| SubmittedAt | DateTimeOffset? | 最近一次 Submit 成功時填入 |
| ApprovedAt | DateTimeOffset? | Approved 時填入 |
| RejectedAt | DateTimeOffset? | Rejected 時填入 |
| DomainEvents | IReadOnlyCollection&lt;IDomainEvent&gt; | 待發布事件集合（基底 AggregateRoot 提供） |

### State Transition Methods

| Method | Preconditions | Postconditions | Domain Event |
|---|---|---|---|
| `Create(submitterId)` (static factory) | submitterId 非空 | 回傳新 ExpenseReport，Status = Draft，Items 空 | _(無)_ |
| `AddItem(money, category, receiptRef, occurredOn)` | Status == Draft 或 Rejected；money.Amount > 0；receiptRef 不在現有 Items 中 | 新 ExpenseItem 加入 _items；若原 Status = Rejected，改回 Draft | _(無)_ |
| `RemoveItem(itemId)` | Status == Draft 或 Rejected；itemId 存在 | 對應 Item 從 _items 移除；若原 Status = Rejected，改回 Draft | _(無)_ |
| `ModifyItem(itemId, ...)` | Status == Draft 或 Rejected；itemId 存在 | Item 屬性更新；若原 Status = Rejected，改回 Draft | _(無)_ |
| `Submit()` | Status == Draft；Items.Count >= 1 | Status = Submitted；SubmittedAt = now；SubmitAttemptNo += 1 | **ExpenseReportSubmitted** (ReportId, SubmitterId, SubmittedAt, TotalAmount, SubmitAttemptNo) |
| `Approve(approverId, decidedAt)` <!-- phase-2 ADDED --> | Status == Submitted；approverId != SubmitterId | Status = Approved；ApprovedAt = decidedAt | **ExpenseReportApproved** (ReportId, SubmitterId, ApproverId, ApprovedAt, SubmitAttemptNo) |
| `Reject(approverId, reason, decidedAt)` <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED --> | Status == Submitted；approverId != SubmitterId；reason 符合 ApprovalReason 雙語長度驗證 | Status = Rejected；RejectedAt = decidedAt | **ExpenseReportRejected** (ReportId, SubmitterId, ApproverId, RejectedAt, Reason, SubmitAttemptNo) |

## Aggregate: ApprovalDecision <!-- phase-2 ADDED -->

### Purpose

ApprovalDecision 記錄主管針對一次 Submit 做出的審核決定。它不是 ExpenseReport 的 child entity，因為它有自己的稽核識別、唯一約束與生命週期；同一份 ExpenseReport 被退回後重新 Submit，會產生新的 SubmitAttemptNo，並對應新的 ApprovalDecision。

### Invariants

| ID | Invariant | Behavior on Violation |
|---|---|---|
| INV-07 <!-- phase-2 ADDED --> | 一個 `(ExpenseReportId, SubmitAttemptNo)` 最多只能有一筆 ApprovalDecision | Domain factory 檢查既有 decision；Infrastructure unique index 補強 |
| INV-08 <!-- phase-2 ADDED --> | Approver 不可等於 ExpenseReport.SubmitterId | `CreateApproved()` / `CreateRejected()` 拋 `DomainException("Approver cannot approve their own ExpenseReport.")` |
| INV-09 <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED --> | Rejected decision 必須有 ApprovalReason；ApprovalReason 至少 5 個中文字或至少 10 個英數字，空白不計，半形 / 全形視覺等價，emoji 算字 | `ApprovalReason` 建構式拋 `DomainException("Reject reason must contain at least 5 Chinese characters or 10 alphanumeric characters.")` |
| INV-10 <!-- phase-2 ADDED --> | ApprovalDecision 建立後不可修改 decision type / approver / reason | Aggregate 不暴露 mutator；修正錯誤審核需透過後續 explicit reversal feature，不在 phase 2 |

### Structure

```
ApprovalDecision (Aggregate Root)
├── ApprovalDecisionId      (Value Object — Guid wrapper)
├── ExpenseReportId         (Reference ID — same BC Aggregate reference)
├── SubmitAttemptNo         (int — 對應 ExpenseReport 的第 N 次 Submit)
├── ApproverId              (Value Object — EmployeeId，跨 Identity BC 引用)
├── Decision                (Enum — Approved / Rejected)
├── Note                    (string? — Approved 可選附註)
├── Reason                  (ApprovalReason? — Rejected 必填)
└── DecidedAt               (DateTimeOffset)
```

### Aggregate Root

| Property | Type | Description |
|---|---|---|
| Id | ApprovalDecisionId | 唯一識別 |
| ExpenseReportId | ExpenseReportId | 被審核的 ExpenseReport |
| SubmitAttemptNo | int | 對應 ExpenseReport 的第 N 次 Submit |
| ApproverId | EmployeeId | 審核者；跨 Identity BC ID 引用 |
| Decision | ApprovalDecisionType | Approved / Rejected |
| Note | string? | 核准或退回的附註；核准可空 |
| Reason | ApprovalReason? | 退回原因；Rejected 必填 |
| DecidedAt | DateTimeOffset | 審核時間 |

### State Transition Methods

| Method | Preconditions | Postconditions | Domain Event |
|---|---|---|---|
| `CreateApproved(reportId, submitterId, submitAttemptNo, approverId, note, decidedAt)` | `approverId != submitterId`；尚無同 `(reportId, submitAttemptNo)` decision | 回傳 Decision = Approved 的 ApprovalDecision | Event 由 ExpenseReport.Approve() raise |
| `CreateRejected(reportId, submitterId, submitAttemptNo, approverId, reason, decidedAt)` | `approverId != submitterId`；reason 符合 ApprovalReason 雙語長度驗證；尚無同 `(reportId, submitAttemptNo)` decision | 回傳 Decision = Rejected 的 ApprovalDecision | Event 由 ExpenseReport.Reject() raise |

## Domain Events

| Event | Trigger | Consumer |
|---|---|---|
| ExpenseReportSubmitted | `Submit()` 成功 | phase 2 的 pending-approval read model / handler |
| ExpenseReportApproved <!-- phase-2 ADDED --> | `Approve()` 成功且 ApprovalDecision 建立 | _(phase 3 Reimbursement 預期 consumer)_ |
| ExpenseReportRejected <!-- phase-2 ADDED --> | `Reject()` 成功且 ApprovalDecision 建立 | _(phase 2 UI read model；未來通知可訂閱)_ |

## Referenced Aggregates (ID only)

| Aggregate | Reference Type | Purpose |
|---|---|---|
| Employee (Identity BC, 外部) | SubmitterId / ApproverId | 標識提交者與審核者；BR-005 只在 Expense BC 強制兩者不可相同，不在 Domain 層查主管階層 |
| ExpenseReport | ExpenseReportId | ApprovalDecision 指向被審核的 Report；同一 BC 仍以 ID reference 避免跨 Aggregate 物件圖鎖定 |

## Design Decisions

**為什麼 ApprovalDecision 留在 Expense BC，而不是拆 Approval BC？**
phase 2 的審核行為只改變 ExpenseReport 的生命週期，語言也仍是「費用單被核准 / 退回」。目前沒有獨立 Approval policy、代理簽核、SLA、跨系統任務池或多階簽核模型。拆 BC 會讓 phase 2 過早引入整合邊界。先留在 Expense BC，未來若政策複雜化再檢視。

**為什麼 ApprovalDecision 是第二個 Aggregate，而不是 ExpenseReport child entity？**
審核決定有自己的稽核識別、唯一約束與不可變歷史。一份 Report 被 Reject 後重新 Submit，必須保留前一次 decision，並為新的 Submit attempt 建一筆新的 decision。如果做成 child entity，ExpenseReport 會承擔越來越大的稽核集合與 concurrency 風險。用第二個 Aggregate 可以把審核紀錄的持久化與唯一性獨立出來。

**為什麼 BR-005 要在 Domain 層強制？**
UI 或 Application validator 可以先擋，但不能作為唯一防線。主管也可能透過 API、batch job 或測試工具觸發審核。`SubmitterId != ApproverId` 是業務不變條件，必須由 ApprovalDecision factory / ExpenseReport approve/reject transition 共同守住。

**為什麼 Rejected 後允許重編，而 Submitted / Approved 不允許？**
Rejected 是主管明確要求員工修正資料的狀態。如果仍不可編輯，員工只能另建一張 Report，稽核軌跡會分裂。Submitted 代表正在等待主管決定，Approved 代表已成為財務可處理的正式單據，兩者都不應被員工直接修改。

**為什麼 ExpenseItem 是 Entity 而非 Value Object？**
最初考慮過把 ExpenseItem 設成 VO（不可變、用整體值比較相等性）。但檢視場景時發現「員工填錯金額需要修改某筆 Item」是常見動作，且主管審核時可能會指出特定 item。選 Entity（有穩定的 ExpenseItemId）更貼近業務語義。

**為什麼 Money 是 VO，而不是 primitive decimal？**
金額永遠帶幣別語義；用 primitive 早晚會出現「忘記轉換幣別 / 不同幣別直接相加」的錯誤。MVP 雖然只用 TWD，但用 VO 把 Currency 一併綁定，未來支援多幣別不需要改 schema。
