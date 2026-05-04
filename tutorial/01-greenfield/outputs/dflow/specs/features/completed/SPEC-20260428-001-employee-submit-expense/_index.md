---
spec-id: SPEC-20260428-001
slug: employee-submit-expense
status: completed
created: 2026-04-28
completed_date: 2026-05-07
branch: feature/SPEC-20260428-001-employee-submit-expense
---

# Employee Submit Expense Report

## Goals & Scope

讓員工能在差旅或公務結束後，建立並提交一份完整的費用申報單給主管審核。本 feature 是 ExpenseTracker 的第一個 feature，phase 1 先完成「員工端提交」，phase 2 補上「主管端 Approve / Reject」。

涉及 Bounded Context：**Expense**（首個 BC，本 feature 同步建立）。

涉及 Aggregates：
- **ExpenseReport**（Aggregate Root，內含 ExpenseItem entities）
- **ApprovalDecision**（Aggregate Root；phase 2 新增，一次 Submit 對應一筆審核決定）

邊界：本 feature 結束後系統能讓員工新增 / 編輯 / 提交 ExpenseReport，主管能對 Submitted 的 ExpenseReport 做 Approve / Reject，並保留每次 Submit 對應的一筆 ApprovalDecision 稽核軌跡。通知 email、SLA timer、財務匯款與批次審核不在 phase 2。

## Phase Specs

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-04-28 | mvp | completed | [phase-spec-2026-04-28-mvp.md](./phase-spec-2026-04-28-mvp.md) |
| 2 | 2026-04-29 | supervisor-approval | completed | [phase-spec-2026-04-29-supervisor-approval.md](./phase-spec-2026-04-29-supervisor-approval.md) |

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

> Feature 層的 BR 當前狀態（不是歷史）。AI 在以下時機 regenerate 本表：
> - `/dflow:new-phase` 進入時
> - 完成一份 phase-spec 時
> - T2 lightweight spec 定稿時

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。 | phase-1 (mvp) | phase-1 (mvp) | active |
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | phase-1 (mvp) | phase-2 (supervisor-approval) | active |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | phase-1 (mvp) | phase-1 (mvp) | active |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 | phase-1 (mvp) | phase-1 (mvp) | active |
| BR-005 | 主管不可審核自己提交的 ExpenseReport；`SubmitterId != ApproverId` 必須由 Domain 層強制。 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | active |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | active |
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | phase-2 (supervisor-approval) | lightweight-2026-04-30 | active |

> 2026-05-04 BUG-001 note：Current BR Snapshot 刻意不重新產生。BR-007 文字不變；根因是 implementation-level Unicode truncation / sanitization，不是 BR-level delta。

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

> T2 行：描述含「見 `lightweight-{date}-{slug}.md`」外連
> T3 行：inline 完整描述一句話 + 標籤；T3 不產獨立 spec 檔

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-04-30 | T2 | Reject reason 從至少 10 字元放寬為 5 中文字 OR 10 英數字。見 [lightweight-2026-04-30-approval-reason-bilingual-length.md](./lightweight-2026-04-30-approval-reason-bilingual-length.md) | `{pending}` |
| 2026-05-04 | T2 | Bug-fix: 前端 substring 截斷 emoji surrogate pair 導致 reject reason 被拒。見 [BUG-001-emoji-surrogate-truncation.md](./BUG-001-emoji-surrogate-truncation.md) | `{pending}` |

## Resume Pointer

> 一句話：目前進展到哪？下一個動作是什麼？
> 開新對話接續工作時，從這裡讀起。

**Current Progress**: Feature 已於 2026-05-07 完成；請看 features-index.md 或下方的 Integration Summary。

**Next Action**: 未來變更請透過 `/dflow:modify-existing` 視為 follow-up feature 處理；不要把 T2/T3 changes 直接追加到這個 completed feature directory。

## Integration Summary

### Feature Overview

`SPEC-20260428-001-employee-submit-expense` 交付了 ExpenseTracker 第一個端到端 feature：員工可以建立、編輯並提交 ExpenseReport，主管可以對 Submitted 狀態的 ExpenseReport 執行 Approve 或 Reject，並留下可稽核的 ApprovalDecision。它建立初始的 Expense Bounded Context，並驗證第一條從 Aggregate design 到試用回饋的完整 Domain-driven 路徑。

Audience：內部工程團隊、產品負責人、試用主管，以及需要了解哪些內容已達穩定試用狀態的利害關係人。本摘要是 git-strategy-neutral 的參考資料；它不是 commit message，也不假設 merge commit、squash、rebase 或 fast-forward。

### Change Scope

| Area | Final State |
|---|---|
| Bounded Context | Expense |
| Phase Count | 2 份 phase specs：phase 1 MVP (2026-04-28)、phase 2 supervisor approval (2026-04-29) |
| Lightweight Changes | 2 份 T2 lightweight specs，0 筆 T3 inline changes |
| Aggregates Introduced | ExpenseReport, ApprovalDecision |
| Domain Events Introduced | ExpenseReportSubmitted, ExpenseReportApproved, ExpenseReportRejected |
| Feature Status | 2026-05-07 完成，並已通過 3 天穩定試用 |

### Phase Summary

| Phase | Summary |
|---|---|
| phase 1 mvp | 建立 ExpenseReport、ExpenseItem、Money、ReceiptReference、ExpenseCategory、Submit 流程與 `ExpenseReportSubmitted`。 |
| phase 2 supervisor-approval | 加入主管 Approve / Reject、ApprovalDecision、ApprovalReason、`ExpenseReportApproved`、`ExpenseReportRejected`，以及 Rejected 後重編行為。 |

### Lightweight Changes Summary

| Date | Type | Summary |
|---|---|---|
| 2026-04-30 | T2 modify | 將 BR-007 從單一 10 字元門檻放寬為雙語長度驗證：至少 5 個中文 / emoji 視覺字元，或至少 10 個英數字。 |
| 2026-05-04 | T2 bug-fix | 修正 reject reason 處理中的 emoji surrogate truncation；Presentation truncation 與 Domain malformed-input guard 現在與 BR-007 對齊。 |

### Aggregates Introduced

- **ExpenseReport**: 負責費用單生命週期、items、submit attempt number，以及 Draft / Submitted / Approved / Rejected 狀態轉移。
- **ApprovalDecision**: 負責一次 submit attempt 對應的一筆主管審核稽核紀錄；保護 self-approval 與 reject reason invariants。

### Domain Events Introduced

- **ExpenseReportSubmitted**: Draft ExpenseReport 成功 Submit 時 raise。
- **ExpenseReportApproved**: Submitted ExpenseReport 由非提交者 approver Approve 時 raise。
- **ExpenseReportRejected**: Submitted ExpenseReport 以有效 ApprovalReason Reject 時 raise。

### BR Final State

| BR-ID | Final Rule | Status |
|---|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。 | active |
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | active |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | active |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 | active |
| BR-005 | 主管不可審核自己提交的 ExpenseReport；`SubmitterId != ApproverId` 必須由 Domain 層強制。 | active |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | active |
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | active |

### Tech Debt Outstanding

- **Unicode i18n 下的字元計數策略**: status 在 `dflow/specs/architecture/tech-debt.md` 中仍為 `open`。BUG-001 已修 reject reason truncation 與 malformed-input handling，但針對 grapheme clusters、code points、UTF-16 units、`Intl.Segmenter` 與 ICU support 的更廣泛產品層級策略，仍是獨立 architecture 後續事項。

### Outstanding / Deferred

- Batch approval：phase 2 已延後；如果重新啟動，請在 `features/backlog/` 下建立 follow-up feature，不要重新開啟這個 completed feature。
- Approval notification email：不在 phase 2 範圍；可能是 Notification concern 或 Application Layer integration。
- Approval SLA timer / escalation：在真實 policy complexity 出現前先不納入範圍。
- Reimbursement BC：approval 穩定後規劃的未來 context；可能會消費 Expense 的 approved report information。

### Sign-off

- Alice 在 2026-05-07 closeout 前確認實作完成狀態與所有 regression tests。
- Carol 確認原本使用 `金額對不上👍` 的 reject path 現在可正常運作。
- 另外兩位試用主管在 3 天穩定試用期間確認一般 reject flow。

## Outstanding / Future Considerations

- **Batch approval：phase 2 已延後**: phase 2 刻意只交付單筆 report 的 Approve / Reject。如果試用回饋證明需要 batch approval，請在 `dflow/specs/features/backlog/` 下建立 follow-up feature 並連回這個 completed feature；不要直接在這裡追加新的 T2/T3 work。
- **Approval notification email**: 已延後，因為 phase 2 將 notification concerns 保持在 Expense Domain model 之外。
- **Approval SLA timer / escalation**: 延後到 policy 複雜度明確後；可能代表未來需要 Approval policy model 或獨立 BC review。
- **Reimbursement BC**: 延後到 finance reimbursement workflow 啟動後；可能會接在 `ExpenseReportApproved` 之後。
