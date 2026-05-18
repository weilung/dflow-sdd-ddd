# Walkthrough 03 — `/dflow:new-phase` 在同一 feature 內新增主管審核

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Greenfield track 的第二個重要工作型態：同一個 feature 已完成
phase 1 MVP 後，如何用 `/dflow:new-phase` 新增下一個 phase，而不是另開 feature、
重建 bounded context，或把已經 merge 的 phase 1 history 改成一團。

本篇把 Alice 與 Dflow 的 phase 2 對話整理成一份可教學、可 review 的讀物，讓讀者看懂：

- `/dflow:new-phase` 和 `/dflow:new-feature` 的差異
- phase 2 如何載入 phase 1 的 active feature context
- 為什麼 supervisor approval 留在 Expense BC，而不是過早拆 Approval BC
- 為什麼 `ApprovalDecision` 是第二個 Aggregate Root，不是 `ExpenseReport` child entity
- `Delta from prior phases` 如何標示 ADDED / MODIFIED / UNCHANGED
- `_index.md` Current BR Snapshot 什麼時候 regenerate
- phase 2 如何從 phase spec 進入實作、驗證、再標記 completed
- 哪些 BC-level living docs 要等 `/dflow:finish-feature` 才同步

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Greenfield 劇情跑完後的
最終狀態；本步驟當下，`SPEC-20260428-001-employee-submit-expense` 仍位於
`features/active/`。只讀本篇也能看懂 phase 2 的發生順序；若想看 active /
completed snapshot 的完整讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| phase 1 做完後，要開新 feature 還是新 phase？ | 同一個 feature lifecycle 內的 supervisor approval，用 `/dflow:new-phase` 加第二份 phase spec。 |
| phase 2 怎麼避免破壞 phase 1 規則？ | 用 Delta markup 明確寫 ADDED BR-005~007、MODIFIED BR-002、UNCHANGED BR-001/003/004。 |
| 主管審核應該拆成 Approval BC 嗎？ | 目前仍緊貼 ExpenseReport lifecycle，先留在 Expense BC；未來多階簽核 / SLA 再 review。 |
| `ApprovalDecision` 為什麼是 Aggregate？ | 它有自己的稽核識別、唯一約束與不可變歷史；Rejected 後重新 Submit 會產生新的 decision。 |
| `_index.md` 是歷史 log 嗎？ | 不是。它的 Current BR Snapshot 是 feature-level current state，歷史留在 phase-spec Delta。 |

## 前情提要

上一篇 [〈Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature〉](walkthrough-02-new-feature.md)
中，Alice 用 `/dflow:new-feature` 建立第一個 feature：

```text
SPEC-20260428-001-employee-submit-expense
```

phase 1 `mvp` 的目標很收斂：員工可以建立 ExpenseReport、加 ExpenseItem，
然後 Submit 給主管。Dflow 在 phase 1 建立了第一批 Expense BC 元素：

```text
ExpenseReport Aggregate Root
ExpenseItem Entity
Money / ReceiptReference / ExpenseCategory Value Objects
ExpenseReportSubmitted Domain Event
```

phase 1 也建立了四條 BR：

| BR | phase 1 規則 |
|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem。 |
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，且不可再被編輯。 |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 |

到本篇開始時，Alice 已把 phase 1 MVP 實作完、測試通過、PR merge 回 `main`，並開始小範圍試用。
主管端能看到送來的單，但還不能做 Approve / Reject。

這正是原本排在 phase 2 的範圍：supervisor approval。

## 劇情背景

2026-04-29 早上，主管的第一輪回饋很直接：

```text
我只能看到員工送來的單，但我點進去看完無法做任何動作。
```

Alice 在 AI coding agent 裡輸入：

```text
Alice:
早。phase 1 MVP 昨晚 merge 到 main 了，
小範圍試用也開始。

主管第一個反饋是：
「我只能看到員工送來的單，但我點進去看完無法做任何動作」。

我要接 phase 2：主管審核。

/dflow:new-phase
```

這裡 Alice 沒用 `/dflow:new-feature`，因為她不是要開始另一個業務主題。
主管審核仍是 `employee-submit-expense` 這個 feature lifecycle 的下一段。

phase 2 的 scope 先收斂成：

| In scope | Out of scope |
|---|---|
| 主管 Approve / Reject 單筆 ExpenseReport | 通知 email |
| Reject 後員工可依原因重編再 Submit | SLA timer / escalation |
| 建立 ApprovalDecision audit trail | 財務匯款 / Reimbursement |
| 保護 self-approval、狀態轉移、reject reason | 批次 Approve |

## Step 1 — 載入 active feature context

Dflow 先說明 `/dflow:new-phase` 的責任：

```text
Dflow:
收到。/dflow:new-phase 是「在既有 active feature 裡新增、實作、驗證並完成一個 phase-spec」的流程，
不會新建 feature directory，也不會把 completed feature 打開。

Step 1 先讀 active feature context。
```

Dflow 會讀：

```text
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-28-mvp.md
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md
dflow/specs/domain/Expense/context.md
dflow/specs/domain/Expense/models.md
dflow/specs/domain/Expense/rules.md
dflow/specs/domain/Expense/events.md
dflow/specs/domain/glossary.md
dflow/specs/domain/context-map.md
```

讀完後，Dflow 回報：

```text
Dflow:
- feature：SPEC-20260428-001-employee-submit-expense
- 目前 prior phases：1 個，phase 1 = mvp
- Bounded Context：Expense
- phase 1 Aggregate：ExpenseReport
- Current BR Snapshot：4 條 BR（BR-001..004）
- phase 1 open question：
  Approval 要拆獨立 BC，還是留在 Expense BC 內當另一個 Aggregate
- 最新 Resume Pointer 還停在 phase 1 實作前；
  你剛補充 phase 1 已 merge，
  所以 phase 2 spec 會以「MVP 已完成」為前提

Step 1 complete。Entering Step 2: Confirm Phase Scope.
```

這是本篇第一個 lesson：**new-phase 不是從空白開始。**

Dflow 會先讀現有 feature state，尤其是 `_index.md` Current BR Snapshot 與最新 phase spec。
否則 AI 很容易重複建立 feature directory，或把 phase 1 已決定的 aggregate boundary 忘掉。

## Step 2 — Confirm Phase Scope

Dflow 先用 plain language 確認：

```text
Dflow:
Step 2 我們確認 phase scope。
這個 phase 要讓主管對 Submitted 的 ExpenseReport 做 Approve / Reject，對嗎？
```

Alice 回：

```text
Alice:
對。主管可以看到單、點進去看明細，然後核准或退回。
退回一定要寫原因，員工才知道怎麼修。
```

Dflow 對照 Current BR Snapshot，先整理 Delta：

```markdown
| Delta | BR | 判斷 |
|---|---|---|
| UNCHANGED | BR-001 | Submit 仍必須至少 1 個 ExpenseItem |
| MODIFIED | BR-002 | phase 1 說 Submitted 後不可編輯；phase 2 需要補例外：Rejected 後可重編再 Submit |
| UNCHANGED | BR-003 | Money.Amount > 0 不變 |
| UNCHANGED | BR-004 | ReceiptReference 不可重複不變 |
| ADDED | BR-005 | 主管不可審核自己提交的 ExpenseReport |
| ADDED | BR-006 | 只有 Submitted 能 Approve / Reject |
| ADDED | BR-007 | Reject 必須附註原因，至少 10 字元 |
```

這裡 BR-002 是最重要的變化。phase 1 說 Submitted 後不可編輯；phase 2 不推翻它，
而是補一個業務必要的例外：Rejected 後可重編並再次 Submit。

Alice 補充 BR-005：

```text
Alice:
BR-005 我想中段補清楚：
如果某主管自己也是員工，他自己提交的單必須由再上一階主管審核。
Domain 層至少要擋「自己審自己」。
```

Dflow 回：

```text
Dflow:
同意，而且這不能只放 UI。
domain 層要有不變條件：SubmitterId != ApproverId。

主管「是不是直屬主管」這件事需要 Identity / org graph，
Application layer 可以查；
但 Expense Domain 不應依賴 Identity service。

Domain 層守住最低業務不變條件：
同一個人不能審自己的 Report。
```

這是本篇第二個 lesson：**跨 BC 資訊可以在 Application 層查，但最低業務不變條件要在 Domain 層守住。**

Expense Domain 不知道誰是誰的主管；它只知道同一個 ID 不能同時是 Submitter 與 Approver。

## Step 2 — BC 與 Aggregate 邊界

phase 1 留下一個 open question：Approval 要拆獨立 BC，還是留在 Expense BC？

Dflow 建議：

```text
Dflow:
這次我建議留在 Expense BC，
新增第二個 Aggregate：ApprovalDecision。

理由：

- phase 2 的行為仍圍繞 ExpenseReport 的生命週期，不是獨立審批平台。
- 目前沒有多階簽核、代理人、SLA、政策引擎。
- 拆 BC 會過早引入 integration boundary，對 3-5 人團隊成本偏高。
```

Dflow 同時說明 `ApprovalDecision` 的 aggregate 身分：

```text
Dflow:
ApprovalDecision 不是 ExpenseReport 的 child entity，
而是第二個 Aggregate Root：
記錄「誰、何時、做了什麼決定、附註 / 退回原因」。

同一份 Report 若 Reject 後重新 Submit，
會有新的 Submit attempt，
也會有新的 ApprovalDecision。
```

Alice 接受：

```text
Alice:
這個我接受。
先不要拆 Approval BC。
等以後真的有多階簽核或 SLA 再 review。
```

這是本篇第三個 lesson：**不過早拆 BC，不代表把所有東西塞進一個 Aggregate。**

`ApprovalDecision` 留在 Expense BC，但它不是 `ExpenseReport` 的 child entity。
這讓稽核記錄有自己的 ID、唯一約束與不可變歷史。

## Step 2 — Cross-context and data impact

Dflow 接著標出 cross-context impact：

```text
Dflow:
Identity 變得更相關，
因為 Application 層需要知道 Approver 是誰、是否能審這張單。
但 Domain 層只持 ID，不建模組織階層。
context-map.md 可以更新成 Expense 參照 external Identity。
```

Data structure impact：

```text
- ExpenseReports.Status 從 Draft / Submitted 擴張為 Draft / Submitted / Approved / Rejected
- 新增 ApprovalDecisions table
- unique index：(ExpenseReportId, SubmitAttemptNo)，防止同一次 Submit 被審兩次
```

Alice 也排除 batch approve：

```text
Alice:
不要。主管現在只是要能單筆動作。
批次 Approve 我怕一做就要勾選、權限、部分失敗處理，scope 會炸。
```

Dflow 記錄：

```text
Dflow:
批次 Approve 記成 open question，不放 phase 2。
Step 2 complete。Entering Step 3: Phase Slug Confirmation.
```

這裡展示的是 Greenfield 的 scope control：不是因為新專案乾淨，就可以把所有未來功能一次做完。

## Step 3 — Phase slug confirmation

Dflow 提出 phase spec 檔名：

```text
Dflow:
Proposed phase-spec for SPEC-20260428-001-employee-submit-expense:

phase-spec-2026-04-29-supervisor-approval.md

Phase slug：supervisor-approval。
這符合今天的 scope，也維持 ASCII path。
要保留這個 slug，還是改？
```

Alice：

```text
Alice:
保留 supervisor-approval。
```

Dflow 停在 step gate：

```text
Dflow:
Phase slug confirmed as supervisor-approval.
Ready to draft the phase-spec?

Step Gate: Step 3 -> Step 4。
/dflow:next to proceed, or adjust the scope first.
```

Alice：

```text
Alice:
/dflow:next
```

這個 gate 的價值在於：一旦 phase spec 建出來，檔名、slug、phase number 都會進 feature
history。Dflow 在建檔前停下來，讓 Alice 能先修 scope 或命名。

## Step 4 — Write the Phase Spec

Dflow 建立第二份 phase spec，並把 frontmatter `status` 設為 `in-progress`：

```text
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
└── phase-spec-2026-04-29-supervisor-approval.md
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md)

### Problem Description

phase spec 開頭把試用回饋與 phase 2 scope 寫清楚：

```markdown
## Problem Description

phase 1 MVP 讓員工能建立並提交 ExpenseReport，
主管端也能看到送來的單，
但小範圍試用後主管回饋：
「我只能看到員工送來的單，但我點進去看完無法做任何動作。」

phase 2 要補上主管審核動作：
主管可以核准或退回一份已提交的 ExpenseReport。
核准後 ExpenseReport 進入 Approved，
退回後進入 Rejected，
並允許員工依退回原因重新編輯後再次 Submit。
這個 phase 不處理通知 email、SLA timer、財務匯款或批次審核。
```

### Domain Concepts

phase 2 的新概念：

```markdown
| Concept | Type | Description |
|---|---|---|
| ExpenseReport | Aggregate Root | 費用申報單主體；phase 2 狀態機擴張為 Draft / Submitted / Approved / Rejected |
| ApprovalDecision | Aggregate Root | 一次 Submit 對應的一次主管審核決定，記錄 approver、時間、決定與附註 |
| Approver | External Role / ID Reference | 主管或具審核權限的人；在 Expense BC 中以 ApproverId 引用，不建模組織階層 |
| ApprovalReason | Value Object | 退回原因；Reject 時必填且至少 10 字元 |
| ExpenseReportApproved | Domain Event | ExpenseReport 被核准時 raise |
| ExpenseReportRejected | Domain Event | ExpenseReport 被退回時 raise |
```

### Behavior scenarios

Main scenario：Approve。

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

Reject scenario：

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

Self-approval guard：

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

Reject reason guard：

```gherkin
Scenario: 主管嘗試退回但未提供足夠原因
  Given 一份 ExpenseReport 處於 Submitted 狀態
  And ApproverId != SubmitterId
  When 主管呼叫 RejectExpenseReportCommand 且 Reason 少於 10 字元
  Then 拋出 DomainException("Reject reason must contain at least 10 characters.")
  And ExpenseReport.Status 維持 Submitted
  And 不建立 ApprovalDecision
```

## Step 4 — Delta from prior phases 是本篇主角

Dflow 特別提醒：

```text
Dflow:
這份是 phase 2，
所以 Delta from prior phases 必填，
不像 phase 1 可以寫「首 phase，無前置 Delta」。
```

phase spec 的 Delta：

```markdown
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
```

Modified BR-002：

```markdown
### MODIFIED - BR / behavior modified in this phase

#### Rule: BR-002 Submitted 後不可編輯，但 Rejected 可重編
**Before (phase 1 原文)**:
`ExpenseReport 提交成功後狀態變為 Submitted，且不可再被編輯。`

**After (phase 2 新文)**:
`ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；
唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。`
```

UNCHANGED：

```markdown
### UNCHANGED - explicitly unaffected

- BR-001 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem。
- BR-003 ExpenseItem 的 Money.Amount 必須 > 0。
- BR-004 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。
```

Alice 確認：

```text
Alice:
這個格式就是我要給同事看的重點。
MODIFIED BR-002 一定要看得出原本跟改完的差異。
```

這是本篇第四個 lesson：**Delta markup 是 phase 2 review 的核心。**

Reviewer 不需要猜「Submitted 後不可編輯」是不是被刪掉了。Delta 清楚說明：

- Submitted 仍不可編輯。
- Approved 也不可編輯。
- Rejected 是唯一可重編的例外。
- 重編後再次 Submit 會建立新的 `ApprovalDecision`。

## Step 4 — SubmitAttemptNo 保護 audit trail

Alice 問：

```text
Alice:
有一點確認：
Rejected 後重新 Submit，ApprovalDecision 是新的，不是更新舊的。
```

Dflow 回：

```text
Dflow:
對。這會透過 SubmitAttemptNo 表達：

- 第一次 Submit：SubmitAttemptNo = 1
- 主管 Reject：ApprovalDecision(reportId, attempt=1, decision=Rejected)
- 員工重編後再次 Submit：SubmitAttemptNo = 2
- 主管再審：ApprovalDecision(reportId, attempt=2, decision=Approved/Rejected)

這樣 audit trail 不會被覆寫，
也符合「ApprovalDecision one-to-one 對應一次 Submit 動作」。
```

這是 `ApprovalDecision` 成為 Aggregate 的關鍵理由。它不是狀態欄位，也不是覆寫同一筆資料；
它是每次 Submit attempt 的 immutable audit record。

## Step 4 — Implementation plan

Dflow 依層次產生 implementation plan：

```markdown
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
- `GetSubmittedExpenseReportsForApproverQuery`
- `ApprovalDecisionDto` / 更新 `ExpenseReportDto`

### Infrastructure Layer
- `ApprovalDecisionConfiguration` (EF Core Fluent API)
- `IApprovalDecisionRepository` / `ApprovalDecisionRepository`
- migration：新增 ApprovalDecisions table，更新 ExpenseReports.Status enum / column constraint
- unique index：`ApprovalDecisions(ExpenseReportId, SubmitAttemptNo)`

### Presentation Layer
- `POST /api/expense-reports/{id}/approve`
- `POST /api/expense-reports/{id}/reject`
- `GET /api/expense-reports/pending-approval`
```

Test strategy：

```markdown
- Approve Submitted report -> Status = Approved、ApprovalDecision 建立、ExpenseReportApproved raised
- Reject Submitted report with valid reason -> Status = Rejected、ApprovalDecision 建立、ExpenseReportRejected raised
- ApproverId == SubmitterId -> throw DomainException
- Approve / Reject non-Submitted report -> throw DomainException
- Reject reason 少於 10 字元 -> throw DomainException
- Rejected report can be edited and submitted again
```

這讓 implementation 從 Domain → Application → Infrastructure → API → Test 推進，不會先做 endpoint
再回頭補 rules。

## Step 4 → Step 5 step gate

Dflow 在 phase spec draft 後停下來：

```text
Dflow:
phase-spec drafted at
dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/
phase-spec-2026-04-29-supervisor-approval.md.

Step Gate: Step 4 -> Step 5。
Ready to refresh _index.md（add Phase Specs row, regenerate Current BR Snapshot from the Delta）？
/dflow:next to proceed.
```

Alice：

```text
Alice:
/dflow:next
```

這個 gate 很重要。phase spec 寫完後，還不能自動假設 feature dashboard 已更新。
`_index.md` 的 Phase Specs table 與 Current BR Snapshot 要在 Step 5 明確 refresh。

## Step 5 — Refresh `_index.md`

Dflow 會做三件事：

```text
Dflow:
1. Phase Specs table 加第 2 列。
2. Current BR Snapshot regenerate，不是 append history。
3. Resume Pointer 改成 phase 2 in progress，Next Action 指向 DOMAIN-1。
```

Phase Specs table 當下新增：

```markdown
| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-04-28 | mvp | completed | [phase-spec-2026-04-28-mvp.md](./phase-spec-2026-04-28-mvp.md) |
| 2 | 2026-04-29 | supervisor-approval | in-progress | [phase-spec-2026-04-29-supervisor-approval.md](./phase-spec-2026-04-29-supervisor-approval.md) |
```

完整文件範例在 finish-feature 後顯示 phase 2 completed：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)

Current BR Snapshot regenerate：

```markdown
| BR-ID | Current Rule | First Seen (phase) | Last Updated (phase) | Status |
|---|---|---|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。 | phase-1 (mvp) | phase-1 (mvp) | active |
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | phase-1 (mvp) | phase-2 (supervisor-approval) | active |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | phase-1 (mvp) | phase-1 (mvp) | active |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 | phase-1 (mvp) | phase-1 (mvp) | active |
| BR-005 | 主管不可審核自己提交的 ExpenseReport；`SubmitterId != ApproverId` 必須由 Domain 層強制。 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | active |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | active |
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 10 字元，否則 raise DomainException。 | phase-2 (supervisor-approval) | phase-2 (supervisor-approval) | active |
```

補充：完整文件範例中 BR-007 後來被下一篇 modify-existing walkthrough 的 T2 lightweight change 修改成
「至少 5 個中文字或至少 10 個英數字」。本篇關注的是 phase 2 當下的 `new-phase`
結果，所以內嵌片段保留 phase 2 當時的 10 字元版本。

Alice 確認：

```text
Alice:
_index.md 不要變成歷史流水帳，
history 留在 phase-spec Delta 裡。
```

Dflow 回：

```text
Dflow:
是，Snapshot 是 feature-level current state。
```

這是本篇第五個 lesson：**`_index.md` Current BR Snapshot 是當前狀態，不是歷史 log。**

如果想知道 BR-002 怎麼從 phase 1 變 phase 2，要讀 phase spec 的 Delta。
如果想知道此刻 feature 的累積規則，要讀 `_index.md` snapshot。

## Step 5 → Step 6 step gate — branch timing

Alice 問：

```text
Alice:
branch 呢？
我們現在 main 已經有 phase 1，
phase 2 實作要開新的 branch 嗎？
```

Dflow 回答：

```text
Dflow:
依 git-integration.md，
Dflow 對 trunk-based / GitHub Flow / Git Flow 不做 base branch 決策，
但要求 SDD feature work 能 trace 回 spec。

你現在 phase 1 已 merge main，
trunk-based 比較自然的做法是從最新 main 開一個短 branch，
例如 feature/SPEC-20260428-001-employee-submit-expense
重新建立或 sync 同名 branch，PR title 標 phase 2。

關鍵 gate 是：
phase 2 spec / Aggregate design / BR Delta 先就緒，
再開始第一個 implementation commit。這對應 Step 5 -> Step 6。
不要先寫 approve endpoint 再回補 spec。
```

Alice 確認：

```text
Alice:
OK，我實作前從最新 main 開 branch，PR title 加 phase 2。
spec 先落地。
```

這裡的重點不是 branch name，而是順序：spec 與 BR Delta 先落地，通過 Step 5 -> Step 6
gate 後才開始 implementation commit。

## Step 6 — Implement and verify the phase

Dflow 依 phase spec 的 `Implementation Tasks` 從 Domain → Application → Infrastructure → API
推進，測試任務穿插在能證明行為的地方。

```text
Dflow:
Step 6 開始 implementation。

我會按 phase-spec 的 Implementation Tasks 實作，並持續檢查：

- ADDED / MODIFIED Delta 都有對應 implementation 或 tests
- BR-005 self-approval guard 在 Domain 層，不只在 UI / API
- BR-006 狀態轉移 guard 覆蓋 Draft / Approved / Rejected
- BR-007 reject reason validation 由 ApprovalReason / Domain rule 保護
- ExpenseReportApproved / ExpenseReportRejected events 有被 raise
- EF configuration 留在 Infrastructure，Domain 不依賴 EF
- Test failures 修掉，或明確記為 follow-up

如果 implementation 發現原本 Delta 要調整，我會先更新 phase-spec，
再繼續改 `_index.md` Snapshot；不讓 code 和 spec 靜默分岔。
```

Alice 在這一步看到的不是另一份文件，而是程式碼與測試開始落地：

```text
src/ExpenseTracker.Domain/Expense/ExpenseReport.cs
src/ExpenseTracker.Domain/Expense/ApprovalDecision.cs
src/ExpenseTracker.Domain/Expense/ApprovalReason.cs
src/ExpenseTracker.Application/Expense/ApproveExpenseReportCommand.cs
src/ExpenseTracker.Application/Expense/RejectExpenseReportCommand.cs
src/ExpenseTracker.Infrastructure/Expense/ApprovalDecisionConfiguration.cs
tests/ExpenseTracker.Domain.Tests/ExpenseApprovalTests.cs
```

這是本篇第六個 lesson：**new-phase 不只寫 phase-spec；同一個 workflow 會一路走到 implementation
與 verification。**

## Step 6 → Step 7 step gate

實作與測試完成後，Dflow 停在最後一個 gate：

```text
Dflow:
Phase implementation appears complete and verified against the phase-spec.
Ready to mark this phase completed and update `_index.md`?

Step Gate: Step 6 -> Step 7。
/dflow:next to proceed.
```

Alice：

```text
Alice:
/dflow:next
```

## Step 7 — Complete the phase

Dflow 收尾這個 phase，而不是收尾整個 feature：

```text
Dflow:
Step 7 我會完成 phase-level closeout：

1. phase-spec frontmatter status: in-progress -> completed
2. Implementation Tasks 保留已完成勾選；未完成項明確標 follow-up
3. _index.md Phase Specs row: in-progress -> completed
4. Current BR Snapshot 依 implemented Delta reconcile
5. Resume Pointer 改成：
   phase-2 completed; next action: run /dflow:new-phase for the next slice,
   or /dflow:finish-feature if the feature is ready to wrap up
```

這一步**不**同步 BC-level living docs，也**不**把 feature directory 搬到 `completed/`。
`rules.md` / `behavior.md` / `events.md` / `models.md` / `glossary.md` / `context-map.md`
的 system-level current state 仍由 `/dflow:finish-feature` 統一處理。

完整 outputs 目錄展示的是後續 finish-feature 後的最終狀態，所以你會在那裡看到 domain
docs 已同步、feature 目錄位於 `completed/`。但在 `/dflow:new-phase` 這個 workflow 的邊界內，
完成條件只到「phase 2 已實作、驗證、phase-spec 與 `_index.md` 標 completed」。

## 本步驟的文件地圖

下表連到 tutorial outputs 的最終範例。Feature 目錄與 BC-level domain docs 是
`/dflow:finish-feature` 後的 completed snapshot；在 Step 7 當下，`/dflow:new-phase`
只完成 active feature 內的 phase-spec 與 `_index.md`。

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md) | phase 2 spec：Problem、Domain concepts、Behavior scenarios、Delta、Implementation plan。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | Phase Specs 第 2 列與 regenerated Current BR Snapshot。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/aggregate-design.md) | `ApprovalDecision` Aggregate、ExpenseReport 狀態機、SubmitAttemptNo、設計決策。 |
| 修改 | [`outputs/dflow/specs/domain/Expense/context.md`](outputs/dflow/specs/domain/Expense/context.md) | Approval 留在 Expense BC，不拆獨立 Approval BC。 |
| 修改 | [`outputs/dflow/specs/domain/Expense/models.md`](outputs/dflow/specs/domain/Expense/models.md) | ApprovalDecision、ApprovalReason、ExpenseReportStatus、ApprovalDecisionType。 |
| 修改 | [`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md) | MODIFIED BR-002，ADDED BR-005~007。 |
| 修改 | [`outputs/dflow/specs/domain/Expense/events.md`](outputs/dflow/specs/domain/Expense/events.md) | ExpenseReportApproved / ExpenseReportRejected。 |
| 修改 | [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | Approver、ApprovalDecision、ApprovalReason。 |
| 修改 | [`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) | Expense 對 Identity 的 external reference。 |
| 故意不建 | `outputs/dflow/specs/domain/Expense/behavior.md` | phase 2 當下 behavior scenarios 仍由 phase spec 承載；本 outputs tree 沒有此檔。 |

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Greenfield track | 同一 feature 從 phase 1 MVP 延伸到 phase 2 supervisor approval，乾淨建立 DDD model。 |
| Spec-first development | phase 2 spec / Delta / aggregate design 先落地，再進 Step 6 implementation。 |
| Hybrid workflow control | Dflow 在 phase slug、phase spec draft、`_index.md` refresh、開始 implementation、完成 phase 前都設 step gate。 |
| DDD semantic backbone | ApprovalDecision 的 Aggregate 身分、Expense BC 歸屬、Identity external reference 都被顯式記錄。 |
| 三層文件分工 | phase spec 管 phase delta，feature `_index.md` 管 current snapshot，domain docs 等 finish-feature 才升級成 BC current model。 |
| Drift verification readiness | BR Delta、events、implementation tasks、test strategy 都能直接支援後續 PR review。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| phase 2 另開錯 feature | 主管審核被當成全新 feature，和 phase 1 history 斷開。 | `/dflow:new-phase` 明確掛回 `SPEC-20260428-001`。 |
| BR-002 被模糊修改 | 「Submitted 不可編輯」被隱性放寬，reviewer 看不出差異。 | Delta markup 保留 Before / After。 |
| Approval BC 過早拆出 | 一個單筆審核需求就引入複雜 integration boundary。 | 留在 Expense BC，等多階簽核 / SLA 出現再 review。 |
| Audit trail 被覆寫 | Rejected 後重新 Submit 更新舊 decision。 | `SubmitAttemptNo` + 新 `ApprovalDecision` 保留每次 submit 的歷史。 |
| `_index.md` 變流水帳 | 每次 phase append 一段歷史，current state 模糊。 | Snapshot regenerate；歷史留在 phase-spec Delta。 |

## 對不熟 new-phase 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這是同一 feature 的下一段，還是新 feature？**
   本篇答案是同一 feature 的 phase 2，因為主管審核是 employee-submit-expense lifecycle
   的下一段。

2. **前一個 phase 的規則怎麼被改？**
   本篇答案是 BR-002 被 MODIFIED，Before / After 都寫在 Delta 中。

3. **新增的 model 是什麼？**
   本篇答案是 `ApprovalDecision` Aggregate Root 與 `ApprovalReason` VO。

4. **哪些 scope 被刻意排除？**
   本篇答案是 notification email、SLA、批次 approve、Reimbursement。

New-phase 的價值是讓同一個 feature 可以自然長大，但每次長大都有 reviewable delta。
它避免兩種極端：每個小步都另開 feature，或把所有後續需求都偷塞進 phase 1。

## Key takeaways

- `/dflow:new-phase` 在既有 active feature 內新增、實作、驗證並完成一個 phase-spec，不新建 feature directory。
- Phase 2 必須寫 `Delta from prior phases`；MODIFIED BR 要保留 Before / After。
- `ApprovalDecision` 留在 Expense BC，但作為第二個 Aggregate Root 保留 audit trail。
- `_index.md` Current BR Snapshot 是 current state，Step 5 regenerate、Step 7 reconcile，不是歷史流水帳。
- BC-level living docs（rules、models、events、glossary、context-map）等 `/dflow:finish-feature` 才同步。
- Behavior scenarios 在 phase 2 當下仍由 phase spec 承載；不要硬建不存在的 `behavior.md`。

## 下一個 walkthrough

下一個 Greenfield walkthrough 可接 [〈Walkthrough 04 — `/dflow:modify-existing` 調整 BR-007 reject reason 長度〉](walkthrough-04-modify-existing.md)：
Alice 在 supervisor approval 試用後，調整 reject reason 的長度規則。那一篇會展示 T2
lightweight change 如何修改 BR-007，而不新增 Aggregate 或資料結構。
