---
spec-id: SPEC-20260512-001
slug: reject-not-persisted
status: completed
created: 2026-05-12
completed_date: 2026-05-12
branch: bugfix/BUG-002-reject-not-persisted
follow-up-of: SPEC-20260428-001
---

# Reject 後 ExpenseReport 狀態未持久化

## Goals & Scope

> 本 feature 為 `SPEC-20260428-001-employee-submit-expense` 的 follow-up，原 feature 完成於
> `2026-05-07`，詳見 `completed/SPEC-20260428-001-employee-submit-expense/_index.md`。

修正 reject flow 的持久化缺陷：主管 Reject 一張 ExpenseReport 後，`ApprovalDecision` 有被建立，
但 `ExpenseReport` 本身的狀態變更沒有被 flush，導致列表仍顯示 Submitted。2026-05-12 由財務主管
Carol 回報。

涉及 Bounded Context：**Expense**（BR-002 / BR-006 所治理的 reject flow）。

**這是 follow-up 最小 host**（`references/modify-existing-flow.md` Step 1.6 的 minimal 變體）：
原 feature 已於 2026-05-07 收進 `completed/`，而 completed feature 是凍結歷史、不能直接追加
T2 / T3，因此這次修正住在自己的 zero-phase host 裡，並以 `follow-up-of` 保留血緣。

**Branch 依 change class**：這是**功能性 bug**，所以走 `bugfix/BUG-002-reject-not-persisted`，
不是 `feature/`。closeout 的 Step 2 只翻 `status`，**不改寫** `branch:`。

## Phase Specs

> 最小 host 不帶 phase-spec，本表**刻意保持空白**。minimal 變體**不委派** `new-feature-flow.md`
> Step 4 那個無條件建立 first phase-spec 的動作——否則一個 Application 層的持久化修正
> 會被迫產出一份 T1 規格。

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

> **這是 BC-bearing 的 follow-up，所以本表是「繼承來的 baseline」，不是空的。**
> `references/modify-existing-flow.md` Step 1.6：BC-bearing follow-up 要讀該 BC 的
> `dflow/specs/domain/Expense/rules.md`，把**與本 follow-up 相關**的 BR 繼承進來，
> 每一列標 First Seen = `inherited from rules.md`，Last Updated 留空，直到本 host 自己的
> delta 動到它為止。
>
> 「留空」那條規則是寫給 **no-BC** follow-up 的——本 host 有 BC，不適用。
> 繼承與有沒有 delta 是兩件事：本次沒有 BR delta（規則文字沒變），所以 Last Updated 全部留空，
> 但 baseline 仍要在，否則 closeout 讀不到這個 host 治理在哪幾條規則之下。

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | inherited from rules.md | | active |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | inherited from rules.md | | active |

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

> T2 的列外連到它的 lightweight / BUG spec；實作路徑由該 spec 的 `## Implementation Paths`
> 段承載，本列只要外連過去。closeout 會拿 checkpoint 1 的 diff 與那些路徑比對。

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-12 | T2 | Bug-fix: Reject 後 ExpenseReport 狀態未持久化（Application 層 SaveChanges 漏掉一個 Aggregate）。見 [BUG-002-reject-not-persisted.md](./BUG-002-reject-not-persisted.md) | 7c41e8d |

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> **兩個 checkpoint。** 最小 host 恰好 implementation ＋ closeout。
>
> 收工後還有第三個 commit（Step 6 的 follow-up tracking flip），但它是 **sanctioned
> post-completion mutation、不是 checkpoint**——它**不記在本表**，也不記在原 feature 的
> Checkpoint Log。

| Timestamp | Checkpoint | Result |
|---|---|---|
| 2026-05-12 14:20 | implementation | committed (7c41e8d) |
| 2026-05-12 14:45 | closeout | committed |

## Resume Pointer

**Current Progress**: feature completed (2026-05-12)；zero-phase follow-up minimal host；原 feature 的 Follow-up Tracking 已於 `e5b02a4` 翻為 completed。

**Next Action**: integration — push / merge / PR per the selected Git policy.

**Active Workflow**: none

**Current Step**: n/a

**Gates Passed**: n/a

**Awaiting**: none

<!--
本 fixture 到 Resume Pointer 為止，只有那七個必要段落（加上 follow-up-of metadata）。
理由是 `references/finish-feature-flow.md` Step 5 明寫 Integration Summary
「Print the summary to the conversation; **do not write it to a file**」。

**這是明文指示，不是 gate。** Step 1 檢查的是七段**都在**、不是「不准有別的」；
post-commit 驗證比的是 Step 1 讀到的內容有沒有被改動。多一段不會被擋下——
這裡不寫，是因為 Step 5 這麼說。

本次走查的 Integration Summary 逐欄形狀、commit graph（implementation / closeout / flip）
與 Outstanding 討論，都在 walkthrough 正文：
tutorial/01-greenfield/walkthrough-08-followup-minimal-host.md
-->
