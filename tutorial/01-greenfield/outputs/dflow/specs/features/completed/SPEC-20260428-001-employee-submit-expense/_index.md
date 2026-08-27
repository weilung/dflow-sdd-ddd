---
spec-id: SPEC-20260428-001
slug: employee-submit-expense
status: completed
created: 2026-04-28
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
| 2026-04-30 | T2 | Reject reason 從至少 10 字元放寬為 5 中文字 OR 10 英數字。見 [lightweight-2026-04-30-approval-reason-bilingual-length.md](./lightweight-2026-04-30-approval-reason-bilingual-length.md) | f10c6b3 |
| 2026-05-04 | T2 | Bug-fix: 前端 substring 截斷 emoji surrogate pair 導致 reject reason 被拒。見 [BUG-001-emoji-surrogate-truncation.md](./BUG-001-emoji-surrogate-truncation.md) | 2ad57e9 |

> **這兩格各自帶的是「自己那一列的實作 hash」，不是 closeout 的 hash。** hosted row
> 的格子由 host 的**下一個** commit 回填：04-30 那列由 05-04 那個 commit 填，05-04 那列
> 沒有下一個 phase 了，所以由 closeout 填（`references/finish-feature-flow.md` Step 4
> 指令 1）。
>
> ⚠ **還沒填的時候是留空，不是寫 `{pending}`。** 佔位字串會讓格子變成「非空」，
> 於是**所有照空／非空判的規則**都會把它讀成「已經有 hash」。
> Step 4 指令 1 與 `references/pr-review-checklist.md` 仍然抓得到——它們是去**解析**
> 這個值，不是看它空不空——但那是最後兩道防線。

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> **七列。** 兩個 phase 各是一次 T1（spec / implementation 兩點；T1 的第三點 closeout
> 由整個 feature 共用一次，不是每個 phase 各一次），兩筆 hosted T2 各記一點——T2 的
> spec 與實作合併成同一個 commit，所以記成一列 `implementation`——最後是 closeout。
> T1 的 spec 那一點在帳本裡叫 **`spec-baseline`**（`new-feature-flow.md` 稱它
> 「the spec baseline」，milestone 1 of 3）；範本的合法值只有 `branch-override` /
> `spec-baseline` / `implementation` / `closeout` 四個，不要自己寫 `spec`。
>
> ⚠ **closeout 那列不帶 hash**：一個 commit 沒辦法把自己的 hash 寫進自己裡面。
> 溯源用 `git log -1 -- completed/SPEC-20260428-001-employee-submit-expense`。

| Timestamp | Checkpoint | Result |
|---|---|---|
| 2026-04-28 09:10 | spec-baseline | committed (5c3d1a7) |
| 2026-04-28 16:40 | implementation | committed (b8e04c1) |
| 2026-04-29 09:30 | spec-baseline | committed (e47a208) |
| 2026-04-29 17:05 | implementation | committed (d92f7a5) |
| 2026-04-30 11:20 | implementation | committed (f10c6b3) |
| 2026-05-04 15:45 | implementation | committed (2ad57e9) |
| 2026-05-07 10:15 | closeout | committed |

## Follow-up Tracking

> 本段是 `templates/_index.md` 的**選配第八段**，只在這個 feature 長出 follow-up 時才出現。
> 它是**衍生索引**——權威來源是 follow-up feature 自己的 `follow-up-of` 欄位；兩者若不一致，
> 以 `follow-up-of` 為準。
>
> 這一列走過 `absent → in-progress → completed` 三個狀態：
> - `in-progress` 由 follow-up host 的 **checkpoint 1** 帶入（見
>   `references/modify-existing-flow.md` Step 1.6）；
> - `completed` 由 `/dflow:finish-feature` **Step 6** 的 flip 帶入。
>
> **flip 不是 checkpoint。** 它是 sanctioned post-completion mutation，**兩邊的 Checkpoint
> Log 都不記**——不記在 follow-up host（已關帳歸檔），也不記在本 feature（它的 ledger 不該
> 被別的 feature 汙染）。但它**必須被 commit**，且該 commit 的路徑集合只能有本檔案。

| SPEC-ID | Slug | Date | Status |
|---|---|---|---|
| SPEC-20260512-001 | reject-not-persisted | 2026-05-12 | completed |

## Resume Pointer

> 一句話：目前進展到哪？下一個動作是什麼？
> 開新對話接續工作時，從這裡讀起。

**Current Progress**: Feature 已於 2026-05-07 完成；所有 phase-spec status = completed。

**Next Action**: integration — push / merge / PR per the selected Git policy.

**Active Workflow**: none

**Current Step**: n/a

**Gates Passed**: n/a

**Awaiting**: none
