# Expense — Behavior Specification

> **Purpose**: Expense context current behavior 的 consolidated source of truth。
> 不同於 `dflow/specs/features/completed/` 的 historical archive，本檔永遠反映
> accepted specs 之後系統應該遵守的 current behavior。
>
> **Maintenance**: AI 在 completion flow（Step 8.3 / Step 5.3）更新本檔。
> feature completed 時，將 Given/When/Then scenarios merge 到這裡。
> behavior modified 時，用 Delta result 更新對應 section；不要保留 Delta markup。
>
> **Relationship to rules.md**: `rules.md` 是 declarative index（BR-ID ＋ 一行摘要），
> 本檔是 scenario-level detail。`rules.md` 的每個 BR-ID 在這裡都應該有對應 section；
> 兩者 drift 時由 `/dflow:verify` 抓出來。

---

<!-- dflow:section behavior-scenarios -->
## Expense Report Submission

### BR-001: Submit requires at least one item

Given 一份 ExpenseReport 處於 Draft 狀態
And 內含 3 個 ExpenseItem，金額分別為 1500 / 2800 / 800 TWD
When 員工呼叫 `ExpenseReport.Submit()`
Then ExpenseReport.Status 變為 Submitted
And SubmittedAt 被設為當下時間
And raise ExpenseReportSubmitted Domain Event，payload 含
`(ExpenseReportId, SubmitterId, SubmittedAt, TotalAmount=5100, SubmitAttemptNo)`

Given 一份 ExpenseReport 處於 Draft 狀態
And 內無任何 ExpenseItem（`Items.Count == 0`）
When 員工呼叫 `ExpenseReport.Submit()`
Then 拋出 DomainException("ExpenseReport must contain at least one ExpenseItem to submit.")
And ExpenseReport.Status 維持 Draft
And 不 raise 任何 Domain Event

### BR-002: Submitted report is immutable except rejected rework

Given 一份 ExpenseReport 處於 Submitted 或 Approved 狀態
When 員工呼叫 `AddItem` / `RemoveItem` / `ModifyItem`
Then 拋出 DomainException("Cannot modify a submitted or approved ExpenseReport.")
And Items 集合不變
And 不 raise 任何 Domain Event

Given 一份 ExpenseReport 處於 Rejected 狀態
When 員工呼叫 `AddItem` / `RemoveItem` / `ModifyItem`
Then 允許編輯
And 第一次編輯時 ExpenseReport.Status 回到 Draft
And 員工可以再次 Submit，並為新的 submit attempt 建立新的 ApprovalDecision

### BR-003: Item amount must be positive

Given 員工要建立一個 ExpenseItem
And 填入的 Money.Amount 為 0 或負數
When Money Value Object 建構
Then 拋出 ArgumentException("Amount must be positive.")
And ExpenseItem 永遠不會帶著無效金額存在

### BR-004: Duplicate receipt rejected

Given 一份 ExpenseReport 內已有一個 ExpenseItem 使用某個 ReceiptReference
When 員工呼叫 `ExpenseReport.AddItem()` 加入相同 ReceiptReference 的第二個 Item
Then 拋出 DomainException("Receipt {refValue} already attached to this report.")
And 必須先移除舊 Item 才能重新加入（不允許覆寫）

#### Edge cases

- EC-001: Given 員工建立 ExpenseItem 時填金額 = 0 或負數 When Money 建構式執行 Then 拋出 ArgumentException("Amount must be positive.")。
- EC-002: Given 員工把同一張收據加進兩個 Item When `AddItem()` 偵測到重複 Then 拋出 DomainException，且不允許覆寫。
- EC-003: Given 員工在 Draft 狀態反覆呼叫 `Submit()` When 第二次以後呼叫 Then 因 Status != Draft 拋出 DomainException("Only Draft reports can be submitted, current status: Submitted.")。

---

## Supervisor Approval

### BR-005: Approver cannot approve own report

Given 一份 ExpenseReport 處於 Submitted 狀態
And `ExpenseReport.SubmitterId = "mgr-101"`
When `ApproverId = "mgr-101"` 呼叫 Approve 或 Reject
Then 拋出 DomainException("Approver cannot approve their own ExpenseReport.")
And ExpenseReport.Status 維持 Submitted
And 不建立 ApprovalDecision
And 不 raise 任何 Domain Event

### BR-006: Only submitted report can be approved or rejected

Given 一份 ExpenseReport 處於 Draft / Approved / Rejected 任一非 Submitted 狀態
When 主管呼叫 Approve 或 Reject
Then 拋出 DomainException("Only submitted ExpenseReports can be approved or rejected.")
And ExpenseReport.Status 不變
And 不建立 ApprovalDecision
And 不 raise 任何 Domain Event

Given 一份 ExpenseReport 處於 Submitted 狀態
And `ApproverId != SubmitterId`
When 主管呼叫 `ApproveExpenseReportCommand(ReportId, ApproverId, Note)`
Then ExpenseReport.Status 變為 Approved
And 建立一筆 ApprovalDecision，Decision = Approved，DecidedAt = now
And raise ExpenseReportApproved Domain Event，payload 含
`(ExpenseReportId, SubmitterId, ApproverId, ApprovedAt, SubmitAttemptNo)`

Given 一份 ExpenseReport 處於 Submitted 狀態
And `ApproverId != SubmitterId`
And reject reason 通過 BR-007 的門檻
When 主管呼叫 `RejectExpenseReportCommand(ReportId, ApproverId, Reason)`
Then ExpenseReport.Status 變為 Rejected
And 建立一筆 ApprovalDecision，Decision = Rejected，保存該 Reason
And raise ExpenseReportRejected Domain Event，payload 含
`(ExpenseReportId, SubmitterId, ApproverId, RejectedAt, Reason, SubmitAttemptNo)`

### BR-007: Reject requires reason

Given 一份 ExpenseReport 處於 Submitted 狀態
And `ApproverId != SubmitterId`
When 主管呼叫 Reject，且 Reason 符合
「至少 5 個中文字 / emoji 視覺字元 **或** 至少 10 個英數字」
Then ApprovalReason 接受該 reason
And ExpenseReport.Status 變為 Rejected
And 建立一筆 ApprovalDecision，Decision = Rejected，保存該 Reason
And raise ExpenseReportRejected Domain Event，payload 含
`(ExpenseReportId, SubmitterId, ApproverId, RejectedAt, Reason, SubmitAttemptNo)`

Given 一份 ExpenseReport 處於 Submitted 狀態
And `ApproverId != SubmitterId`
When 主管呼叫 Reject 且 Reason 兩個門檻都未達
Then ApprovalReason 拋出 DomainException("Reject reason must contain at least 5 Chinese characters or 10 alphanumeric characters.")
And ExpenseReport.Status 維持 Submitted
And 不建立 ApprovalDecision

#### Edge cases

- EC-004: Given `ApproverId` 等於 `SubmitterId` When 主管呼叫 Approve 或 Reject Then Domain 層拒絕並拋 DomainException；此規則不能只靠 UI 或 Application validator。
- EC-005: Given ExpenseReport 處於 Draft / Approved / Rejected When 主管呼叫 Approve 或 Reject Then Domain 層拒絕，Status 不變，不建立 ApprovalDecision。
- EC-006: Given reject reason 為空白、null，或未達「至少 5 個中文字 / emoji 視覺字元 或 至少 10 個英數字」When ApprovalReason 建構 Then 拒絕。計數方式：空白不計；半形與全形英數字視覺等價（`ＡＢＣ１２３` 同 `ABC123`）；emoji 算作視覺字元。
- EC-007: Given ExpenseReport 處於 Rejected When 員工重新編輯並再次 Submit Then 允許編輯，再次 Submit 進入 Submitted，並為新的 submit attempt 建立新的 ApprovalDecision。
- EC-008: Given 同一個 submit attempt 已有一筆 ApprovalDecision When 再次審核 Then one-to-one 約束拒絕第二筆 decision；Application 層以 unique index / concurrency guard 補強。

---

<!--
Maintenance notes:
- 依 feature area 組織，不依 spec ID 組織。
- Keep BR-IDs in sync with rules.md.
- BR-007 的門檻已是 2026-04-30 lightweight MODIFIED 之後的最終狀態。
  phase 2 的「至少 10 字元」是舊條文，仍散見於該 phase-spec 各節（Domain Concepts、
  兩個 gherkin 區塊、BR 表、EC-006、Implementation Plan、Test Strategy、任務清單）——
  那是凍結的歷史紀錄，不是現況；現況一律以本檔與 rules.md 為準。
-->
