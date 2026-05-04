# /dflow:new-phase — Alice 加上「主管審核」

## 劇情背景

接續 [02-new-feature.md](02-new-feature.md)，Alice 在 2026-04-28 把 phase 1 MVP 跑完：Domain layer、Application handler、EF mapping、最小 API endpoint 和測試都過了，PR 當晚 merge 回 `main`。隔天早上（2026-04-29）她回到 office，小範圍試用的主管已經給第一輪回饋：

> 「我只能看到員工送來的單，但我點進去看完無法做任何動作。」

這正好是 Alice 原本排在 phase 2 的範圍：**supervisor approval**。這段要在同一個 active feature `SPEC-20260428-001-employee-submit-expense` 裡新增第二份 phase-spec，不重新開 feature，也不把 completed history 搬來搬去。

phase 2 的目標刻意收斂：主管可以 Approve / Reject；Reject 後員工能依原因重編並再次 Submit。通知 email、SLA timer、財務匯款、批次 Approve 都不放進 phase 2。

## 完整對話

> **Alice**：早。phase 1 MVP 昨晚 merge 到 `main` 了，小範圍試用也開始。主管第一個反饋是「我只能看到員工送來的單，但我點進去看完無法做任何動作」。我要接 phase 2：主管審核。`/dflow:new-phase`

> **Dflow**：收到。`/dflow:new-phase` 是「在既有 active feature 裡新增 phase-spec」的流程，不會新建 feature directory，也不會把 completed feature 打開。
>
> Step 1 先讀 active feature context。我會載入：
>
> - `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md`
> - 最新 phase-spec：`phase-spec-2026-04-28-mvp.md`
> - `aggregate-design.md`
> - Expense BC 的 `context.md` / `models.md` / `rules.md` / `events.md`
> - `dflow/specs/domain/glossary.md` / `context-map.md`

> **Dflow**：讀完了。
>
> - feature：`SPEC-20260428-001-employee-submit-expense`
> - 目前 prior phases：1 個，phase 1 = `mvp`
> - Bounded Context：`Expense`
> - phase 1 Aggregate：`ExpenseReport`
> - Current BR Snapshot：4 條 BR（BR-001..004）
> - phase 1 open question：Approval 要拆獨立 BC，還是留在 Expense BC 內當另一個 Aggregate
> - 最新 Resume Pointer 還停在 phase 1 實作前；你剛補充 phase 1 已 merge，所以 phase 2 spec 會以「MVP 已完成」為前提
>
> OK — `SPEC-20260428-001-employee-submit-expense` has 1 prior phase in BC `Expense`. The most recent phase ended with ExpenseReport Draft → Submitted and `ExpenseReportSubmitted` raised. Current BR Snapshot has 4 active BRs. Ready to scope the new phase.
>
> Step 1 complete (active feature context loaded). Entering Step 2: Confirm Phase Scope.

> **Dflow**：Step 2 我們確認 phase scope。先用 plain language 描述：這個 phase 要讓主管對 Submitted 的 ExpenseReport 做 Approve / Reject，對嗎？

> **Alice**：對。主管可以看到單、點進去看明細，然後核准或退回。退回一定要寫原因，員工才知道怎麼修。

> **Dflow**：這會碰到既有 BR，也會新增 BR。我先對照 Current BR Snapshot：
>
> | Delta | BR | 判斷 |
> |---|---|---|
> | UNCHANGED | BR-001 | Submit 仍必須至少 1 個 ExpenseItem |
> | MODIFIED | BR-002 | phase 1 說 Submitted 後不可編輯；phase 2 需要補例外：Rejected 後可重編再 Submit |
> | UNCHANGED | BR-003 | Money.Amount > 0 不變 |
> | UNCHANGED | BR-004 | ReceiptReference 不可重複不變 |
> | ADDED | BR-005 | 主管不可審核自己提交的 ExpenseReport |
> | ADDED | BR-006 | 只有 Submitted 能 Approve / Reject |
> | ADDED | BR-007 | Reject 必須附註原因，至少 10 字元 |
>
> BR-002 是這段的教學重點：要用 Delta markup 寫 `MODIFIED`，保留 phase 1 原文，再寫 phase 2 新文，讓 reviewer 不用猜「不可編輯」到底被改了什麼。

> **Alice**：BR-005 我想中段補清楚：如果某主管自己也是員工，他自己提交的單必須由再上一階主管審核。Domain 層至少要擋「自己審自己」。

> **Dflow**：同意，而且這不能只放 UI。domain 層要有不變條件：`SubmitterId != ApproverId`。
>
> 主管「是不是直屬主管」這件事需要 Identity / org graph，Application layer 可以查；但 Expense Domain 不應依賴 Identity service。Domain 層守住最低業務不變條件：同一個人不能審自己的 Report。

> **Alice**：OK。

> **Dflow**：接著是 Aggregate / BC 邊界。phase 1 的 `context.md` 把 Approval 留成 open question：拆 Approval BC，或留在 Expense BC 內。
>
> 這次我建議 **留在 Expense BC**，新增第二個 Aggregate：`ApprovalDecision`。
>
> 理由：
>
> - phase 2 的行為仍圍繞 ExpenseReport 的生命週期，不是獨立審批平台。
> - 目前沒有多階簽核、代理人、SLA、政策引擎。
> - 拆 BC 會過早引入 integration boundary，對 3-5 人團隊成本偏高。
>
> `ApprovalDecision` 不是 ExpenseReport 的 child entity，而是第二個 Aggregate Root：記錄「誰、何時、做了什麼決定、附註 / 退回原因」。同一份 Report 若 Reject 後重新 Submit，會有新的 Submit attempt，也會有新的 ApprovalDecision。

> **Alice**：這個我接受。先不要拆 Approval BC。等以後真的有多階簽核或 SLA 再 review。

> **Dflow**：Cross-context impact：Identity 變得更相關，因為 Application 層需要知道 Approver 是誰、是否能審這張單。但 Domain 層只持 ID，不建模組織階層。`context-map.md` 可以更新成 Expense 參照 external Identity。
>
> Data structure impact：
>
> - `ExpenseReports.Status` 從 Draft / Submitted 擴張為 Draft / Submitted / Approved / Rejected
> - 新增 `ApprovalDecisions` table
> - unique index：`(ExpenseReportId, SubmitAttemptNo)`，防止同一次 Submit 被審兩次
>
> Out of scope 我也先列清楚：通知 email、SLA timer、批次 Approve、財務匯款。批次 Approve 你要不要放進 phase 2？

> **Alice**：不要。主管現在只是要能單筆動作。批次 Approve 我怕一做就要勾選、權限、部分失敗處理，scope 會炸。

> **Dflow**：好，批次 Approve 記成 open question，不放 phase 2。
>
> Step 2 complete (phase scope agreed). Entering Step 3: Phase Slug Confirmation.

> **Dflow**：Proposed phase-spec for `SPEC-20260428-001-employee-submit-expense`:
>
> ```text
> phase-spec-2026-04-29-supervisor-approval.md
> ```
>
> Phase slug：`supervisor-approval`。這符合今天的 scope，也維持 ASCII path。要保留這個 slug，還是改？

> **Alice**：保留 `supervisor-approval`。

> **Dflow**：Phase slug confirmed as `supervisor-approval`. Ready to draft the phase-spec (`phase-spec-2026-04-29-supervisor-approval.md`) — 我會 cover problem / domain modeling / behavior scenarios / business rules / Delta-from-prior-phases / edge cases / domain events / layer-by-layer implementation plan。
>
> Phase Gate: Step 3 → Step 4。`/dflow:next` to proceed, or adjust the scope first.

> **Alice**：`/dflow:next`

> **Dflow**：Step 4 — Write the Phase Spec。這份是 phase 2，所以 `Delta from prior phases` 必填，不像 phase 1 可以寫「首 phase，無前置 Delta」。
>
> 我會新增：
>
> - `phase-spec-2026-04-29-supervisor-approval.md`
>
> 也會在 spec 內先標出這些 Delta：
>
> ```markdown
> ### ADDED - BR / behavior added in this phase
> #### Rule: BR-005 主管不可審核自己提交的 ExpenseReport
> #### Rule: BR-006 只有 Submitted 的 ExpenseReport 能被 Approve / Reject
> #### Rule: BR-007 Reject 必須附註原因
>
> ### MODIFIED - BR / behavior modified in this phase
> #### Rule: BR-002 Submitted 後不可編輯，但 Rejected 可重編
> **Before (phase 1 原文)**: `ExpenseReport 提交成功後狀態變為 Submitted，且不可再被編輯。`
> **After (phase 2 新文)**: `ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。`
> ```
>
> 注意：Business Rules 段只列本 phase 新增 / 修改的 BR。BR-001 / BR-003 / BR-004 不重抄到 Business Rules，只放在 Delta 的 UNCHANGED 或 `_index.md` Current BR Snapshot。

> **Alice**：這個格式就是我要給同事看的重點。MODIFIED BR-002 一定要看得出原本跟改完的差異。

> **Dflow**：收到。我也會把 behavior 寫進 Given / When / Then，讓 PR review 時能直接對照 Aggregate transition 和 Domain Events。
>
> Draft 內容摘要：
>
> - Main scenario：主管 Approve Submitted report → Status = Approved → 建 ApprovalDecision → raise ExpenseReportApproved
> - Alternative：主管 Reject Submitted report → Status = Rejected → 建 ApprovalDecision → raise ExpenseReportRejected → 允許員工重編
> - Alternative：ApproverId == SubmitterId → DomainException，不建 ApprovalDecision，不 raise event
> - Alternative：Reject reason 少於 10 字元 → DomainException
> - Edge cases：非 Submitted 狀態被審、同一 Submit attempt 重複審核、Rejected 後重編再 Submit
>
> Implementation Tasks 會依 Domain → Application → Infrastructure → API → Test 排列：
>
> - DOMAIN：狀態機擴張、ApprovalDecision、ApprovalReason、events、repository interface
> - APP：Approve / Reject commands、pending approval query、DTOs
> - INFRA：EF configuration、repository、migration、unique index
> - API：approve / reject endpoints、pending list endpoint
> - TEST：BR-002 modified + BR-005..007 + integration tests

> **Alice**：有一點確認：Rejected 後重新 Submit，ApprovalDecision 是新的，不是更新舊的。

> **Dflow**：對。這會透過 `SubmitAttemptNo` 表達：
>
> - 第一次 Submit：SubmitAttemptNo = 1
> - 主管 Reject：ApprovalDecision(reportId, attempt=1, decision=Rejected)
> - 員工重編後再次 Submit：SubmitAttemptNo = 2
> - 主管再審：ApprovalDecision(reportId, attempt=2, decision=Approved/Rejected)
>
> 這樣 audit trail 不會被覆寫，也符合「ApprovalDecision one-to-one 對應一次 Submit 動作」。

> **Alice**：OK，繼續。

> **Dflow**：phase-spec drafted at `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md`.
>
> Phase Gate: Step 4 → Step 5。Ready to refresh `_index.md`（add Phase Specs row, regenerate Current BR Snapshot from the Delta）？`/dflow:next` to proceed.

> **Alice**：`/dflow:next`

> **Dflow**：Step 5 — Refresh `_index.md`。
>
> 我會做三件事：
>
> 1. Phase Specs table 加第 2 列：
>
>    ```markdown
>    | 2 | 2026-04-29 | supervisor-approval | in-progress | [phase-spec-2026-04-29-supervisor-approval.md](./phase-spec-2026-04-29-supervisor-approval.md) |
>    ```
>
> 2. Current BR Snapshot **regenerate**，不是 append history：
>
>    - BR-001 active，不變
>    - BR-002 更新為 phase 2 wording，Last Updated = phase-2
>    - BR-003 active，不變
>    - BR-004 active，不變
>    - BR-005 / BR-006 / BR-007 新增，First Seen = phase-2
>
> 3. Resume Pointer 改成 phase 2 in progress，Next Action 指向 DOMAIN-1。

> **Alice**：確認。`_index.md` 不要變成歷史流水帳，history 留在 phase-spec Delta 裡。

> **Dflow**：是，Snapshot 是 feature-level current state。
>
> 另外我會同步更新 living docs：
>
> - `aggregate-design.md`：新增 ApprovalDecision，更新 ExpenseReport 狀態機，標 phase-2 ADDED / MODIFIED
> - `dflow/specs/domain/Expense/models.md`：新增 ApprovalDecision / ApprovalReason / enum
> - `dflow/specs/domain/Expense/rules.md`：MODIFIED BR-002，ADDED BR-005..007
> - `dflow/specs/domain/Expense/events.md`：新增 ExpenseReportApproved / ExpenseReportRejected
> - `dflow/specs/domain/Expense/context.md`：Approval BC open question 改成已決定留在 Expense BC
> - `dflow/specs/domain/glossary.md`：Approver 升級為已建模參與者，新增 ApprovalDecision / ApprovalReason
> - `dflow/specs/domain/context-map.md`：補 external Identity reference，因為 BR-005 讓 SubmitterId / ApproverId 關係成為明確依賴
>
> 不建 `behavior.md`。per skill 規定，behavior scenarios 仍由 phase-spec 承載，等 finish-feature / Step 8.3 才 merge 到 BC-level `behavior.md`。

> **Alice**：branch 呢？我們現在 main 已經有 phase 1，phase 2 實作要開新的 branch 嗎？

> **Dflow**：依 `git-integration.md`，Dflow 對 trunk-based / GitHub Flow / Git Flow 不做 base branch 決策，但要求 SDD feature work 能 trace 回 spec。這裡有兩個實務選擇：
>
> - 如果你的團隊把同一 SPEC 的多 phase 放同一長 feature branch，就沿用 `feature/SPEC-20260428-001-employee-submit-expense`。
> - 你現在 phase 1 已 merge main，trunk-based 比較自然的做法是從最新 `main` 開一個短 branch，例如 `feature/SPEC-20260428-001-employee-submit-expense` 重新建立或 sync 同名 branch，PR title 標 phase 2。
>
> 關鍵 gate 是：**phase 2 spec / Aggregate design / BR Delta 先就緒，再開始第一個 implementation commit**。不要先寫 approve endpoint 再回補 spec。

> **Alice**：OK，我實作前從最新 main 開 branch，PR title 加 phase 2。spec 先落地。

> **Dflow**：完成。Phase-spec ready, `_index.md` refreshed. Snapshot now shows 7 active BRs（3 added in this phase, 1 modified, 0 removed）. Ready to start implementation — follow the phase-spec's Implementation Tasks list（DOMAIN → APP → INFRA → API），然後等所有 phases 完成再跑 `/dflow:finish-feature`。

## 本段產出的檔案

**新增**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/phase-spec-2026-04-29-supervisor-approval.md)

**修改**
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/_index.md)
- [`dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md`](outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/aggregate-design.md)
- [`dflow/specs/domain/Expense/context.md`](outputs/dflow/specs/domain/Expense/context.md)
- [`dflow/specs/domain/Expense/models.md`](outputs/dflow/specs/domain/Expense/models.md)
- [`dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md)
- [`dflow/specs/domain/Expense/events.md`](outputs/dflow/specs/domain/Expense/events.md)
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md)
- [`dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md)

**故意不建**
- `dflow/specs/domain/Expense/behavior.md` — behavior 場景仍由 phase-spec 帶；等 finish-feature / Step 8.3 才 merge 到 BC-level behavior。

## 觀察重點

- **Delta markup 是本段主角**：phase-spec 明確寫 `ADDED BR-005..007` 與 `MODIFIED BR-002`。MODIFIED 條目保留 phase 1 原文與 phase 2 新文，並用 Given / When / Then 說清楚 Submitted 仍不可編輯、Rejected 才可重編。
- **`_index.md` 的 Phase Specs 表與 Current BR Snapshot regenerate 時機**：Step 5 才更新 `_index.md`。Snapshot 是 current state，不是歷史 log；BR-002 被覆寫為最新 wording，新增 BR-005..007，歷史留在 phase-spec Delta。
- **第二個 Aggregate 的 BC 歸屬理由**：ApprovalDecision 留在 Expense BC，因為 phase 2 的審核仍緊貼 ExpenseReport 生命週期；沒有獨立 Approval policy、SLA、代理人、多階簽核。這個決策同步寫在 `context.md` 與 `aggregate-design.md`。
- **phase 2 開 git branch 的時機**：依 `git-integration.md`，spec / Aggregate design / BR Delta 先完成，再開始 implementation commit。Alice 的 trunk-based 情境下，phase 1 已 merge main，所以 phase 2 從最新 main 開短 branch 最自然。
- **scope control**：批次 Approve、通知 email、審核 SLA timer、財務匯款都被刻意排除。這些不是「忘記做」，而是避免 phase 2 跨 BC 擴張。

## 下一個劇情段

→ [04-modify-existing.md](04-modify-existing.md)：Alice 用 `/dflow:modify-existing` 做一個小修正。合理劇情是主管試用後發現 Reject reason 的 10 字元限制對中文太硬，想把規則調整成「至少 5 個中文字或 10 個英數字」，這會是 T2 lightweight change：有 BR Delta，但不需要新 Aggregate 或資料結構。
