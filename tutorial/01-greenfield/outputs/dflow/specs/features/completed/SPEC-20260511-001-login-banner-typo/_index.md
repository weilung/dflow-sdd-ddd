---
spec-id: SPEC-20260511-001
slug: login-banner-typo
status: completed
created: 2026-05-11
completed_date: 2026-05-11
branch: feature/SPEC-20260511-001-login-banner-typo
---

# 登入頁公告橫幅錯字修正

## Goals & Scope

修正登入頁公告橫幅的錯字：「歡迎使登入本系統」→「歡迎使用本系統登入」。由 IT 同事 David 於
2026-05-11 回報，該錯字已存在約兩個月。

本變更**不觸及任何 bounded context**。它是 Presentation 層單一畫面的顯示文字修正，不影響
Expense BC 的任何 business rule、Aggregate 或 Domain Event。

這是一個 **standalone minimal host**（`references/modify-existing-flow.md` Step 1.7）：
變更當下 `active/` 是空的，而唯一的 completed feature（`SPEC-20260428-001-employee-submit-expense`，
費用申報）與登入頁公告橫幅在語意上不相關，因此它既不是 hosted 變更，也不是任何 completed
feature 的 follow-up。

## Phase Specs

> 最小 host 不帶 phase-spec，本表**刻意保持空白**。closeout 以「空的 Phase Specs 表
> ＋ host 目錄內沒有 `phase-spec-*` 檔」作為判定最小 host 的選擇器。

| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|

<!-- dflow:section current-br-snapshot -->
## Current BR Snapshot

> 本 host 自己的記錄沒有 BR delta，因此本表**刻意保持空白**——這是合法狀態，不是漏更。
> closeout 從 host 自己的記錄判斷空表是否合法，不是讀一句宣告。

| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|

<!-- dflow:section lightweight-changes -->
## Lightweight Changes

> T3 沒有獨立 spec 檔；本列就是這次變更的全部記錄。
> Description 末尾帶著這次變更碰到的**原始碼路徑**——closeout 會拿 checkpoint 1 的 diff
> 與它比對，一個路徑都沒宣告會擋下 closeout。

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-11 | T3 | 登入頁公告橫幅錯字修正（「歡迎使登入本系統」→「歡迎使用本系統登入」）`[text]` — `src/Web/Auth/LoginBanner.cs` | a3f2c91 |

<!-- dflow:section checkpoint-log -->
## Checkpoint Log

> **兩個 checkpoint，各自成一列。** 最小 host 之後沒有別的 commit 可以收攏 T3 的 row，
> 所以不分 tier 一律記兩個 checkpoint。`git-integration.md` 那句 canonical 的
> 「T3 ＝ 單一 commit」描述的是**掛在既有 feature 底下**的 T3。
>
> closeout 列**不帶 hash**——commit 無法自含自身 hash；溯源用
> `git log -1 -- dflow/specs/features/completed/SPEC-20260511-001-login-banner-typo`。

| Timestamp | Checkpoint | Result |
|---|---|---|
| 2026-05-11 09:40 | implementation | committed (a3f2c91) |
| 2026-05-11 09:55 | closeout | committed |

## Resume Pointer

**Current Progress**: feature completed (2026-05-11)；zero-phase minimal host，兩個 checkpoint 皆已 commit。

**Next Action**: integration — push / merge / PR per the selected Git policy.

**Active Workflow**: none

**Current Step**: n/a

**Gates Passed**: n/a

**Awaiting**: none

<!--
本 fixture 到 Resume Pointer 為止，只有那七個必要段落。這是刻意的。

`references/finish-feature-flow.md` Step 5 明寫 Integration Summary
「Print the summary to the conversation; **do not write it to a file**
(it is ephemeral closeout output)」——它不是 `_index.md` 的一段。

**這是一條 flow 的明文指示，不是一道 gate——不要把它說成 gate。** closeout 的 Step 1
檢查的是「七個必要段落**都在**」，不是「除此之外什麼都不准有」；post-commit 驗證比的是
「Step 1 讀到的東西有沒有被改動」，所以一段從頭到尾都在、且 closeout 沒動過的
`## Integration Summary` **不會**被那個檢查擋下。

換句話說：這裡照著 Step 5 做，理由是 Step 5 這麼說，不是因為不這麼做會被擋。

本次走查的 Integration Summary 逐欄形狀、生命週期與 Outstanding 討論，都在 walkthrough 正文：
tutorial/01-greenfield/walkthrough-07-standalone-minimal-host.md

（`completed/SPEC-20260428-001-employee-submit-expense/_index.md` 確實帶著 Integration
Summary——那是本 repo 既有的慣例，`how-to-read-dflow-specs.md` 也是那樣教的。那個慣例與
上面 Step 5 那句話是否相牴觸，是一個真實的問題，但**不屬於 2D**，留待後續 pass。）
-->
