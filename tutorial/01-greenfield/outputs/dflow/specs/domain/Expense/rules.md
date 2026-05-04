<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Business Rules

> Declarative BR-ID index for one bounded context.

<!-- dflow:section business-rules -->
## Rule Index

| BR-ID | Rule summary | Behavior anchor | Aggregate | Status | Last updated |
|---|---|---|---|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。 | [BR-001](./behavior.md#br-001-submit-requires-at-least-one-item) | ExpenseReport | active | 2026-04-28 |
| BR-002 <!-- phase-2 MODIFIED --> | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | [BR-002](./behavior.md#br-002-submitted-report-is-immutable-except-rejected-rework) | ExpenseReport | active | 2026-04-29 |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | [BR-003](./behavior.md#br-003-item-amount-must-be-positive) | ExpenseReport | active | 2026-04-28 |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 | [BR-004](./behavior.md#br-004-duplicate-receipt-rejected) | ExpenseReport | active | 2026-04-28 |
| BR-005 <!-- phase-2 ADDED --> | 主管不可審核自己提交的 ExpenseReport；`SubmitterId != ApproverId` 必須由 Domain 層強制。 | [BR-005](./behavior.md#br-005-approver-cannot-approve-own-report) | ApprovalDecision | active | 2026-04-29 |
| BR-006 <!-- phase-2 ADDED --> | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | [BR-006](./behavior.md#br-006-only-submitted-report-can-be-approved-or-rejected) | ExpenseReport | active | 2026-04-29 |
| BR-007 <!-- phase-2 ADDED --> <!-- 2026-04-30 lightweight MODIFIED --> | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | [BR-007](./behavior.md#br-007-reject-requires-reason) | ApprovalDecision | active | 2026-04-30 |

<!-- phase 2 Delta:
- MODIFIED BR-002：phase 1 原文「ExpenseReport 提交成功後狀態變為 Submitted，且不可再被編輯。」更新為 Rejected 可重編並再次 Submit。
- ADDED BR-005..007：主管不可自審、只有 Submitted 可審、Reject reason 必填且至少 10 字元。
behavior.md 仍由 finish-feature / Step 8.3 從 phase-spec 場景 merge；anchor 可能暫時是 pending link。
-->

<!-- 2026-04-30 lightweight Delta:
- MODIFIED BR-007：Reject reason 從「至少 10 字元」放寬為「至少 5 個中文字 OR 至少 10 個英數字」；空白不計，半形 / 全形視覺等價，emoji 算字。
-->

## Lifecycle

> 2026-05-07 從 `SPEC-20260428-001-employee-submit-expense` 完成狀態做最終 reconciliation。completed feature 中的 Current BR Snapshot 是 feature-level 稽核來源；此 `rules.md` 表是 Expense BC system-level current state。

| BR-ID | First Seen | Last Updated From Feature Snapshot | Finalized From | Finalized Date | Lifecycle State |
|---|---|---|---|---|---|
| BR-001 | phase-1 (mvp) | phase-1 (mvp) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-002 | phase-1 (mvp) | phase-2 (supervisor-approval) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-003 | phase-1 (mvp) | phase-1 (mvp) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-004 | phase-1 (mvp) | phase-1 (mvp) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-005 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-006 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-007 | phase-2 (supervisor-approval) | lightweight-2026-04-30 | SPEC-20260428-001 完成 | 2026-05-07 | active |

## Status Legend

| Status | Meaning |
|---|---|
| draft | Rule is identified but not fully validated. |
| active | Rule is validated and expected to be enforced. |
| deprecated | Rule is retained for history but no longer active. |

## Deferred / Monitoring Questions

- Batch approval 已從 phase 2 延後。如果試用回饋證明需要，請在 `dflow/specs/features/backlog/` 下建立 follow-up feature；不要重新開啟 `SPEC-20260428-001`。
- Approval policy 若出現金額門檻、二階主管、代理簽核或 SLA escalation，可能需要重新評估是否拆出 Approval BC。
