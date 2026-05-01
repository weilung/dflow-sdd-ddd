---
id: SPEC-20260428-001-LW-20260430
title: Approval reason bilingual length
status: in-progress
bounded-context: Expense
created: 2026-04-30
branch: feature/SPEC-20260428-001-employee-submit-expense
host-feature: SPEC-20260428-001-employee-submit-expense
tier: T2
slug: approval-reason-bilingual-length
---

# Approval reason bilingual length

## Problem

2026-04-30 午間主管試用 phase 2 reject flow 時，想輸入退回原因「金額對不上」。這是 5 個中文字，對主管而言語意完整，但現行 `ApprovalReason` 驗證沿用 phase 2 的「至少 10 字元」規則，導致系統回覆 `Reject reason must contain at least 10 characters.`

這是 BR-007 的文字調整與 Domain Layer Value Object 驗證調整；沒有新增 BR、Aggregate、Domain Event 或資料結構。

## Behavior Delta

### ADDED - BR / behavior added

_(none)_

### MODIFIED - BR / behavior modified

#### Rule: BR-007 Reject 必須附註原因

**Before**: Given 一份 ExpenseReport 處於 Submitted 狀態 And `ApproverId != SubmitterId` When 主管呼叫 Reject 且 Reason 少於 10 字元 Then `ApprovalReason` 拋出 DomainException("Reject reason must contain at least 10 characters.") And ExpenseReport.Status 維持 Submitted And 不建立 ApprovalDecision.

**After**: Given 一份 ExpenseReport 處於 Submitted 狀態 And `ApproverId != SubmitterId` When 主管呼叫 Reject 且 Reason 符合「至少 5 個中文字 / emoji 視覺字元 OR 至少 10 個英數字」Then `ApprovalReason` 接受該 reason，ExpenseReport.Status 可進入 Rejected，並建立 ApprovalDecision。若兩個門檻都未達，`ApprovalReason` 拋出 DomainException("Reject reason must contain at least 5 Chinese characters or 10 alphanumeric characters.")

**Reason**: 中文短語通常能用較少字數表達完整退回理由；原本單一 10 字元限制偏向英文輸入，對中文主管退回差旅單太硬。

### REMOVED - BR removed

_(none)_

### RENAMED - BR renamed

_(none)_

### UNCHANGED - explicitly unaffected

- BR-001 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem。
- BR-002 Submitted 後不可編輯，但 Rejected 可重編。
- BR-003 ExpenseItem 的 Money.Amount 必須 > 0。
- BR-004 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。
- BR-005 主管不可審核自己提交的 ExpenseReport。
- BR-006 只有 Submitted 的 ExpenseReport 能被 Approve / Reject。

## Root Cause

Phase 2 將 `ApprovalReason` 建模為必填 Value Object 時，用單一 `Length >= 10` 當作最低內容門檻。這個門檻沒有區分中文短語與英文描述，也沒有先明確定義空白、emoji、半形 / 全形字元在驗證上的計數方式。

## Fix Approach

在 Domain Layer 更新既有 `ApprovalReason` Value Object 驗證邏輯：

- 先 trim 並忽略空白；空白不計入任何門檻。
- 對英數字做半形 / 全形視覺等價處理，例如 `ＡＢＣ１２３` 與 `ABC123` 以同一類英數字計算。
- 若非空白 reason 內至少 5 個中文字或 emoji 視覺字元，通過。
- 若 normalized reason 內至少 10 個英數字，通過。
- 混合輸入時兩條件擇一滿足即通過；兩者都未達則拒絕。

不改 Application command contract、不改 API contract、不新增 migration、不改 ApprovalDecision Aggregate 結構。

<!-- dflow:section implementation-tasks -->
## Implementation Tasks

> Keep T2 Light tasks concise. If the fix scope starts to expand, AI should pause and ask the developer whether to keep this as T2 or upgrade it to T1. Do not auto-upgrade based on task count alone.
>
> Recommended layer tags (Core): `DOMAIN` / `APP` / `INFRA` / `API` / `TEST` / `DOC`

- [ ] DOMAIN-1: 更新 `ApprovalReason` validation，使其接受至少 5 個中文 / emoji 視覺字元，或至少 10 個英數字。
- [ ] TEST-1: 新增中文 input 的 unit tests（`金額對不上` 會通過；少於 5 個計數字元會失敗）。
- [ ] TEST-2: 新增英文 / 英數字 input 的 unit tests（10 個 normalized 英數字會通過；少於門檻會失敗）。
- [ ] TEST-3: 新增 mixed input 的 unit tests，確認任一門檻滿足即可通過。
- [ ] TEST-4: 新增 whitespace ignored、半形 / 全形等價、emoji 算作視覺字元的 unit tests。
- [ ] INFRA-1: 確認不需要 DB schema 或 migration change。
- [ ] DOC-1: 更新 `_index.md` Lightweight Changes + Current BR Snapshot、`rules.md`、`aggregate-design.md` 與 glossary 中的 BR-007 wording。

Layer tag list above is the recommended set; the developer may extend with project-specific tags as needed.

<!-- dflow:section open-questions -->
## Open Questions

- 已於 2026-04-30 決議：emoji 在 5 字本地文字門檻中算作視覺字元。
- 已於 2026-04-30 決議：空白不計入任一門檻。
- 已於 2026-04-30 決議：半形與全形英數字元在 10 字元門檻中視覺等價。
- 暫緩：更廣泛的 reject-reason i18n / multi-locale policy 不在這次 T2 change 範圍內。

## Tech Debt Discovered (if any)

這次 T2 change 沒有新增 tech debt。
