---
id: BUG-001
title: Emoji surrogate truncation in reject reason
status: in-progress
bounded-context: Expense
created: 2026-05-04
branch: feature/SPEC-20260428-001-employee-submit-expense
host-feature: SPEC-20260428-001-employee-submit-expense
tier: T2
bug_number: 001
reported_date: 2026-05-04
reported_by: Carol
slug: emoji-surrogate-truncation
---

# Emoji surrogate truncation in reject reason

## Problem

2026-05-04 早上，財務部主管 Carol 回報：她在 2026-05-03 週日加班時想 reject 一張差旅單，退回原因輸入「金額對不上👍」。前端 counter 顯示「6 字 ✓」，但送出後 API 回應「reject reason 不合法」。

Alice 用 browser dev tools 重現後確認：React form 在限制 reject reason 長度時使用 `value.substring(0, maxLen)`，在 emoji 的 UTF-16 surrogate pair 中間截斷。送到 API 的字串包含 invalid surrogate，Domain Layer 的 `ApprovalReason` Value Object 在字數計算路徑中拋出泛用錯誤，導致一個符合 BR-007 意圖的 reason 被拒絕。

這是 bug-fix，不是新的審核需求。BR-007 的 rule wording 維持不變；修正範圍是 Presentation Layer 的截字邏輯，以及 Domain Layer 對 malformed Unicode input 的防衛與錯誤訊息。

## Reason for Change

主管在小範圍試用中輸入的 reject reason 符合目前 BR-007：「至少 5 個中文字或至少 10 個英數字；空白不計，半形 / 全形視覺等價，emoji 算字。」系統卻因前端截斷 emoji surrogate pair 而拒絕。修正目標是讓 UI counter、送出 payload、Domain validation 對同一個有效 reason 得到一致結果。

## Behavior Delta

### ADDED - BR / behavior added

_(none)_

### MODIFIED - implementation behavior modified in this fix

#### Rule: BR-007 Reject 必須附註原因

**Before**: Given 一份 ExpenseReport 處於 Submitted 狀態 And `ApproverId != SubmitterId` When 主管在 React reject form 輸入 `金額對不上👍` And 前端 counter 顯示 `6 字 ✓` And form 用 `substring(0, maxLen)` 截斷 value Then payload 可能包含 invalid surrogate And `ApprovalReason` 在字數計算時拋出泛用錯誤 And reject 被拒絕。

**After**: Given 同樣輸入 `金額對不上👍` When React reject form 需要限制長度 Then Presentation Layer 使用 grapheme-aware 截斷，不會切開 surrogate pair And payload 保持 valid Unicode string And `ApprovalReason` normalize 後依 BR-007 接受該 reason，reject 可繼續完成。

**Reason**: BR-007 本身已允許中文短語與 emoji 視覺字元；錯誤在 implementation-level Unicode handling，而不是 business rule wording。

### REMOVED - BR removed

_(none)_

### RENAMED - BR renamed

_(none)_

### UNCHANGED - explicitly unaffected

- BR-001 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem。
- BR-002 Submitted 後不可編輯，但 Rejected 可重編並再次 Submit。
- BR-003 ExpenseItem 的 Money.Amount 必須 > 0。
- BR-004 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。
- BR-005 主管不可審核自己提交的 ExpenseReport。
- BR-006 只有 Submitted 的 ExpenseReport 能被 Approve / Reject。
- BR-007 wording unchanged — root cause is implementation-level, not BR-level. Reject reason 仍是「至少 5 個中文字或至少 10 個英數字；空白不計，半形 / 全形視覺等價，emoji 算字」。

## Root Cause

React reject form 使用以 UTF-16 code unit 為基礎的 `value.substring(0, maxLen)` 做輸入截斷。當使用者輸入 emoji 且截斷點落在 surrogate pair 中間時，前端會產生包含 unpaired surrogate 的 invalid string。

API 收到 malformed payload 後仍進入 Domain validation。`ApprovalReason` 的字數計算路徑假設 input 是 well-formed Unicode，對 invalid surrogate 沒有先做 detection，因此拋出泛用 calculation error。結果是前端 counter 顯示可送出，但 Domain Layer 拒絕同一段文字。

## Fix Approach

主要修正在 **Presentation Layer**：

- 將 `value.substring(0, maxLen)` 改成 grapheme-aware 截斷。
- 可用時優先使用 `Intl.Segmenter` 做 visual-character 分段。
- 使用 `Array.from(str)` 作為最低 fallback，確保 surrogate pairs 不會被切開；完整 grapheme-cluster strategy 則持續追蹤為 tech debt。
- 確保 reject reason input 的可見 counter 與截斷後的 value 使用相同計數策略。

次要防衛在 **Domain Layer**：

- 在 length checks 前，將 `ApprovalReason` input normalize 成 Unicode NFC。
- 在 counting characters 前偵測 invalid / unpaired surrogate。
- 對 malformed Unicode input 拋出明確訊息的 `InvalidApprovalReasonException`，不要洩漏泛用 calculation error。
- BR-007 thresholds 維持不變；不要新增 BR-008。

不改 Application contract、API route、database schema、Aggregate boundary 或 Domain Event。

<!-- dflow:section implementation-tasks -->
## Implementation Tasks

> Keep T2 Light tasks concise. If the fix scope starts to expand, AI should pause and ask the developer whether to keep this as T2 or upgrade it to T1. Do not auto-upgrade based on task count alone.
>
> Recommended layer tags (Core): `DOMAIN` / `APP` / `INFRA` / `API` / `TEST` / `DOC`

- [ ] PRESENTATION-1: 將 reject reason 的 `substring(0, maxLen)` truncation 改為 grapheme-aware 截斷（優先使用 `Intl.Segmenter`；`Array.from(str)` fallback 不可切開 surrogate pairs）。
- [ ] PRESENTATION-2: 讓 reject reason counter 使用與 truncation logic 相同的 counting strategy。
- [ ] DOMAIN-1: 在 BR-007 length checks 前，將 `ApprovalReason` input normalize 成 NFC。
- [ ] DOMAIN-2: 在 length calculation 前偵測 invalid / unpaired surrogate，並拋出有明確訊息的 `InvalidApprovalReasonException`。
- [ ] TEST-1: 新增 Presentation test，確認 `金額對不上👍` truncation 後仍是 valid string，且 counter 仍顯示 `6 字 ✓`。
- [ ] TEST-2: 新增 Domain unit test，確認 `ApprovalReason("金額對不上👍")` 通過 BR-007。
- [ ] TEST-3: 新增 regression test，確認手動建出的 half-surrogate input 會 raise `InvalidApprovalReasonException`，而不是泛用 calculation error。
- [ ] TEST-4: 新增 integration/API test，確認使用 `金額對不上👍` reject 會進入正常 reject path。
- [ ] DOC-1: 更新 `_index.md` Lightweight Changes 與 `dflow/specs/architecture/tech-debt.md`；不要 regenerate Current BR Snapshot，因為 BR wording 不變。

Layer tag list above is the recommended set；這次 bug-fix 額外使用 `PRESENTATION`，因為主要缺陷在 React form。

<!-- dflow:section open-questions -->
## Open Questions

- 已於 2026-05-04 決議：不要為 invalid surrogate / invisible character counting 新增 BR-008。Invalid surrogate 是 malformed input sanitization，不是 business rule。
- 暫緩：所有使用者可見長度限制的完整 i18n 字元計數策略。見 [dflow/specs/architecture/tech-debt.md](../../../architecture/tech-debt.md) 中的 `Unicode character counting strategy under i18n`。
- 暫緩：採用 ICU 或共用 i18n library 不在這次 T2 bug-fix 範圍內。

## Tech Debt Discovered (if any)

已將 `Unicode character counting strategy under i18n` 加入 [dflow/specs/architecture/tech-debt.md](../../../architecture/tech-debt.md)，由 BUG-001 於 2026-05-04 回報。
