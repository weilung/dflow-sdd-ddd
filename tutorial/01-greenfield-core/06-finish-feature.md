# /dflow:finish-feature: Alice 收尾 Employee Submit Expense Report

## 劇情背景

接續 [05-bug-fix.md](05-bug-fix.md)。2026-05-07 週四下午，BUG-001 的 implementation 已完成，regression tests 全綠。Carol 重新測試原本失敗的 reject reason：「金額對不上👍」，這次可以正常退回；另外兩位試用主管也確認一般 reject flow 沒問題。

Phase 1 MVP、Phase 2 supervisor approval、4/30 的 bilingual length T2、5/4 的 emoji surrogate BUG-001 都已上線。整個功能已穩定試用 3 天，沒有新增 blocker。Alice 決定把 `SPEC-20260428-001-employee-submit-expense` 收尾：feature directory 從 `active/` 搬到 `completed/`，把 feature-level BR Snapshot 最終同步到 Expense BC，並產出 Integration Summary 給團隊和 stakeholder。

Alice 觸發 `/dflow:finish-feature`。

## 完整對話

> **Alice**：BUG-001 修完了。Carol 用「金額對不上👍」reject 成功，另外兩位主管也測過一般退回流程。Regression tests 都綠，這個 feature 已經穩定試用 3 天。我想把 `SPEC-20260428-001-employee-submit-expense` 收尾。`/dflow:finish-feature`

> **Dflow**：收到。這是 `/dflow:finish-feature`，也就是 feature closeout ceremony。
>
> 這一步不會 merge、不會 push、不會替你選 Git strategy。它只做六件事：
>
> - Step 1：validate 所有 phase / lightweight specs 與 `_index.md`
> - Step 2：把 feature status flip 成 `completed`
> - Step 3：把 `_index.md` Current BR Snapshot sync 到 Expense BC layer
> - Step 4：archive feature directory，真實專案使用 `git mv`
> - Step 5：emit Integration Summary，供 PR / merge / stakeholder 溝通使用
> - Step 6：如果這是 follow-up feature，反向更新原 feature；否則跳過
>
> 我先跑 Step 1：Validate Phase Specs and `_index.md`。

> **Dflow**：Step 1 mechanical checks：
>
> - ✓ Feature directory located: `dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/`
> - ✓ `_index.md` exists and front matter parses
> - ✓ Phase Specs table has 2 rows: phase 1 `mvp`, phase 2 `supervisor-approval`
> - ✓ Phase 1 implementation status: done; implementation tasks checked
> - ✓ Phase 2 implementation status: done; implementation tasks checked
> - ✓ T2 lightweight `lightweight-2026-04-30-approval-reason-bilingual-length`: done; implementation tasks checked
> - ✓ T2 bug-fix `BUG-001-emoji-surrogate-truncation`: done; implementation tasks checked
> - ✓ Regression tests reported green after BUG-001
> - ✓ Current BR Snapshot is non-empty and contains BR-001..BR-007, all `active`
> - ✓ No unresolved implementation TODO remains in Resume Pointer
>
> 接著我跑 closeout driftcheck。這不是重新推導所有 BR；`_index.md` Current BR Snapshot 是 feature-level truth。這裡只做 finish-feature 前的 sanity check。

> **Dflow**：Driftcheck result：
>
> - ✓ BR Snapshot BR-001..BR-007 all exist in `dflow/specs/domain/Expense/rules.md`
> - ✓ BR-002 的 phase-2 modification 在 rules.md 有保留歷史註記
> - ✓ BR-007 的 2026-04-30 lightweight modification 在 rules.md 有保留歷史註記
> - ✓ `ApprovalDecision` Aggregate 已存在於 `dflow/specs/domain/Expense/models.md`
> - ✓ `ExpenseReportApproved` / `ExpenseReportRejected` 已存在於 `dflow/specs/domain/Expense/events.md`
> - ✓ `Unicode character counting strategy under i18n` tech debt 仍是 `open`
> - ⚠ Minor drift：phase 2 spec 裡的 Open Question「要不要支援批次 Approve」沒有明示移到哪裡。段 3 當時 Alice 已拍板「不放 phase 2」，但 closeout 文件需要把它 dispose 掉，避免 completed feature 留 dangling open question。

> **Alice**：批次 Approve 不要放 phase 2，也不要現在開 spec。把它列到 `_index.md` 最後的 future consideration，註明 deferred from phase 2，指向 `features/backlog/`。但先不要真的建 backlog feature 檔。

> **Dflow**：OK。我會把它從 dangling Open Question 轉成 completed feature 的 future consideration：
>
> ```text
> Batch approval: deferred from phase 2.
> If trial feedback proves it is needed, create a follow-up feature under dflow/specs/features/backlog/.
> Do not reopen SPEC-20260428-001.
> ```
>
> 同一段我也會列出 phase 2 已明確 deferred 的項目：approval notification email、approval SLA timer / escalation、Reimbursement BC。
>
> Step 1 validation now passes with one minor drift disposed. Ready to flip the feature status to `completed`? `/dflow:next` to proceed.

> **Alice**：`/dflow:next`

> **Dflow**：Step 2: Flip `_index.md` Status to `completed`。
>
> 我會更新 feature-level dashboard：
>
> - front matter `status: in-progress` → `status: completed`
> - add `completed_date: 2026-05-07`
> - Phase Specs table：phase 1 / phase 2 都標 `completed`
> - Resume Pointer 改成：
>
> ```text
> Feature completed 2026-05-07; see Integration Summary in features-index.md or below.
> ```
>
> `features-index.md` 在這個 tutorial scaffold 採 listing-on-demand，沒有集中維護檔，所以 Integration Summary 會 inline 在 completed feature 的 `_index.md` 裡。
>
> Step 2 complete（status flipped）。Entering Step 3: Sync BR Snapshot to BC layer.

> **Dflow**：Step 3: Sync `_index.md` Current BR Snapshot to BC Layer。
>
> 先說原則：`_index.md` 是 feature-level current state；`dflow/specs/domain/Expense/rules.md` 是 Expense BC 的 system-level current state。Feature 完成時，finish-feature 要把前者 reconcile 到後者。
>
> 如果 Expense BC 同時有其他 completed features，我會做 cross-feature reconciliation：
>
> - 新 feature 的 BR-ID 若不存在於 rules.md，新增
> - 已存在但 wording 不同，確認是本 feature 的 MODIFIED net result 後更新
> - Snapshot 標成 removed 的 BR，要從 system-level active rules 移除或標 deprecated
> - RENAMED BR-ID 要同步 glossary / behavior anchors
> - 若兩個 feature 對同一 BR 有衝突，以 rules.md 的 system-level truth 做 final reconciliation，不能只看單一 feature
>
> 本案 Expense BC 目前只有 `SPEC-20260428-001` 這個 feature，所以 reconciliation 是 1-to-1，但仍要跑同一套邏輯，避免日後團隊誤以為 finish-feature 只是搬資料夾。

> **Dflow**：Expense BC sync result：
>
> - BR-001：already exists；wording matches snapshot
> - BR-002：already exists；wording matches snapshot；保留 `<!-- phase-2 MODIFIED -->`
> - BR-003：already exists；rules.md 原本有較長 implementation note，我會收斂成 snapshot wording：`ExpenseItem 的 Money.Amount 必須 > 0。`
> - BR-004：already exists；rules.md 原本保留 MVP validation detail，我會收斂成 snapshot wording：`同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。`
> - BR-005：already exists；wording matches snapshot；保留 `<!-- phase-2 ADDED -->`
> - BR-006：already exists；wording matches snapshot；保留 `<!-- phase-2 ADDED -->`
> - BR-007：already exists；wording matches snapshot；保留 `<!-- phase-2 ADDED -->` 與 `<!-- 2026-04-30 lightweight MODIFIED -->`
>
> 我也會新增 `rules.md` 的 `Lifecycle` 段，把 feature-level `First Seen (phase)` / `Last Updated (phase)` 對應到 BC layer lifecycle：
>
> - BR-001..BR-004 finalized from phase 1 / phase 2 history
> - BR-005..BR-007 finalized from phase 2
> - BR-007 last updated from `lightweight-2026-04-30`
> - 全部標記 `finalized as of 2026-05-07 from SPEC-20260428-001 completion`

> **Alice**：BR-003 和 BR-004 原本 rules.md 多寫一點實作細節，刪掉會不會丟資訊？

> **Dflow**：這裡刪的是 system-level rule summary 的多餘 detail，不是刪 history。
>
> `rules.md` 的 Rule Index 要跟 `_index.md` Current BR Snapshot 完全一致，因為 finish-feature 後它是跨 feature 的 BR index。更細的 Given/When/Then、MVP validation behavior 和 warning text 不應塞在 summary 欄；那類內容應在 behavior scenarios、phase-spec history 或 implementation tests 裡。
>
> 我會保留 phase delta comments：
>
> - `<!-- phase-2 MODIFIED -->`
> - `<!-- phase-2 ADDED -->`
> - `<!-- 2026-04-30 lightweight MODIFIED -->`
>
> 這樣 reviewer 看得到歷史，但 current rule wording 仍和 feature snapshot 一致。

> **Dflow**：Step 3 其他 BC layer checks：
>
> - `models.md`：`ApprovalDecision` Aggregate 已存在；`ExpenseReport` / `ApprovalDecision` 邊界維持不變
> - `events.md`：`ExpenseReportSubmitted`、`ExpenseReportApproved`、`ExpenseReportRejected` 都存在
> - `context-map.md`：Identity external relationship 已存在；Reimbursement 仍是 future context，不更新
> - `glossary.md`：`ApprovalReason` 已包含 2026-04-30 bilingual length wording，不更新
> - `architecture/tech-debt.md`：`Unicode character counting strategy under i18n` remains `open`，補 related-feature：`SPEC-20260428-001 (completed 2026-05-07)`
>
> Sync summary：`rules.md` updated（0 added, 2 wording reconciled, 0 removed），Lifecycle section added，events/models verified，context-map unchanged，tech debt still open with completed feature link。
>
> Ready to archive the feature directory? `/dflow:next` to proceed.

> **Alice**：`/dflow:next`

> **Dflow**：Step 4: Archive feature directory。
>
> 真實專案我會用這個命令，不用 plain `mv`：
>
> ```bash
> git mv dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense \
>        dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense
> git status
> ```
>
> `git mv` 很重要，因為它讓 Git 更容易保留 rename history，改善 `git log --follow`、`git blame` 和 PR diff。尤其 feature directory 裡有 `_index.md`、phase specs、lightweight specs、aggregate design，多檔一起搬時，用 `git mv` 比 `mv` + `git add` 更可讀。
>
> 這個 tutorial repo 的 outputs 是示範 fixture；我會在 `tutorial/01-greenfield-core/outputs/...` 底下用 OS-level move 模擬 archive。但規範要記住：真實專案中的 `dflow/specs/features/active/...` → `dflow/specs/features/completed/...` 應該用 `git mv`。
>
> Step 4 complete（feature archived to completed/）。Entering Step 5: Emit Integration Summary.

> **Dflow**：Step 5: Integration Summary。
>
> 這份 summary 的 audience 是兩群人：
>
> - 團隊內：工程師、reviewer、日後接手 Expense BC 的人
> - Stakeholder：PO、Carol 這類試用主管、需要知道「這個 feature 到底完成了什麼」的人
>
> 它不是 commit message template，也不假設 Git Flow、GitHub Flow、squash、rebase 或 merge commit。你可以把它改寫成 PR description、release note、merge commit message，或貼到團隊同步文件。

> **Dflow**：
>
> ```text
> == Integration Summary: SPEC-20260428-001-employee-submit-expense ==
>
> Feature Goal:
> ExpenseTracker 的第一個 end-to-end feature。員工可以建立、編輯、提交 ExpenseReport；
> 主管可以對 Submitted 的 report Approve / Reject，並保存每次 Submit 對應的一筆
> ApprovalDecision audit trail。
>
> Change Scope:
> - BC: Expense
> - Aggregates introduced: ExpenseReport, ApprovalDecision
> - Domain Events introduced: ExpenseReportSubmitted, ExpenseReportApproved, ExpenseReportRejected
> - Phase Count: 2
> - Lightweight Changes: 2 T2 lightweight specs, 0 T3 inline changes
>
> Phase List:
> - phase 1 (2026-04-28): mvp - employee create / edit / submit ExpenseReport
> - phase 2 (2026-04-29): supervisor-approval - supervisor Approve / Reject, ApprovalDecision, Rejected rework
>
> Lightweight Changes:
> - 2026-04-30 T2 modify: BR-007 bilingual length: at least 5 Chinese / emoji visual chars OR 10 alphanumeric chars
> - 2026-05-04 T2 bug-fix: emoji surrogate truncation fixed; reject reason payload and Domain guard now align
>
> Related BR-IDs (post-closeout state):
> - ACTIVE: BR-001, BR-002, BR-003, BR-004, BR-005, BR-006, BR-007
> - ADDED by feature: BR-001, BR-002, BR-003, BR-004, BR-005, BR-006, BR-007
> - MODIFIED during feature: BR-002, BR-007
> - REMOVED: none
>
> BR Final State:
> - BR-001: 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。
> - BR-002: ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；
>           唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。
> - BR-003: ExpenseItem 的 Money.Amount 必須 > 0。
> - BR-004: 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。
> - BR-005: 主管不可審核自己提交的 ExpenseReport；SubmitterId != ApproverId 必須由 Domain 層強制。
> - BR-006: 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。
> - BR-007: Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字；
>           空白不計，半形 / 全形視覺等價，emoji 算字。
>
> Tech Debt Outstanding:
> - Unicode character counting strategy under i18n remains open.
>   BUG-001 fixed reject reason truncation and malformed-input handling only.
>   Broader grapheme cluster / codepoint / UTF-16 / Intl.Segmenter / ICU policy stays separate.
>
> Outstanding / Deferred:
> - batch approval: deferred from phase 2; use future follow-up feature under features/backlog/
> - approval notification email: out of scope
> - approval SLA timer / escalation: out of scope until policy complexity is known
> - Reimbursement BC: future context after approval is stable
>
> Sign-off:
> - Alice verified implementation completion and regression tests on 2026-05-07.
> - Carol verified reject with "金額對不上👍".
> - Two additional trial supervisors verified normal reject flow during 3-day stable trial.
>
> Next Steps:
> - Commit / merge / push according to the project's Git principles.
> - Future changes must start from a new follow-up feature; do not append T2/T3 changes to this completed directory.
> ```

> **Alice**：這個 summary 直接放 `_index.md` 裡，還是只印在對話？

> **Dflow**：依 finish-feature-flow，Integration Summary 原本是對話輸出，不強制寫檔。但這個 tutorial 要保留示範成果，所以我會 inline 到 completed feature 的 `_index.md`，讓同事 review 時不用從對話紀錄找。
>
> 真實專案可以只印在對話，或貼到 PR description；Dflow 不要求特定 Git platform 或 merge strategy。
>
> Step 5 complete. Entering Step 6: Reverse-Update Follow-up Tracking.

> **Dflow**：Step 6: Reverse-Update Follow-up Tracking：skip。
>
> 跳過理由：`SPEC-20260428-001-employee-submit-expense` 沒有 `follow-up-of` metadata。它不是從某個 completed feature 派生出來的 follow-up feature，所以沒有原 feature 的 Follow-up Tracking row 需要反向更新。
>
> `/dflow:finish-feature` complete for `SPEC-20260428-001-employee-submit-expense`。
>
> Feature directory is now at：
>
> ```text
> dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/
> ```
>
> Stage is set; commit / merge / push at your discretion.

> **Alice**：後續如果 Carol 又想改 reject reason，或主管要 batch approve，我不能直接往這個 completed directory 加 lightweight spec，對吧？

> **Dflow**：對。completed feature 是 frozen history。
>
> 如果日後要改已完成 feature 的行為，走 `/dflow:modify-existing`。modify-existing-flow Step 1.5 會偵測 target feature 已在 `completed/`，拒絕直接追加 T2/T3，並引導你建立 follow-up feature。
>
> 這是 finish-feature 和 new-phase / modify-existing 最大的差異：finish-feature 是 lifecycle endpoint，不是下一輪變更的入口。

## 本段產出的檔案

**新增**
- [`06-finish-feature.md`](06-finish-feature.md)

**移動**
- `outputs/dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense/`
- → [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/)

**修改**
- [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)
- [`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md)
- [`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md)

**故意不改**
- 不改 phase-spec / lightweight-spec / BUG-001 spec 的內容：completed feature 內保留它們作為 frozen history。
- 不改 `dflow/specs/domain/Expense/{context,models,events}.md`：Step 3 只驗證 ApprovalDecision 與 domain events 已存在。
- 不改 `dflow/specs/domain/{glossary,context-map}.md`：closeout 未引入新 ubiquitous language term 或 context relationship。
- 不新增 backlog feature file：batch approval 只列為 future consideration。
- 不更新 `features-index.md`：本 tutorial scaffold 採 listing-on-demand，不集中維護 features index。

## 觀察重點

- **`/dflow:finish-feature` 與 `/dflow:new-phase` / `/dflow:modify-existing` 的差異**：new-phase 和 modify-existing 是開啟下一段變更；finish-feature 是 stage gate，也是 feature 生命週期終點。完成後 feature directory 進入 `completed/`，不再接新的 T2/T3。
- **Step 3 BC Layer Sync 為何重要**：`_index.md` 是 feature-level truth，`rules.md` 是 BC-level truth。單一 feature 時看起來只是 1-to-1 copy，但真正價值是建立 cross-feature reconciliation 的規則：未來多個 feature 修改同一 BR 時，finish-feature 必須把 net result 合併到 BC system state。
- **`git mv` vs `mv` 的差異**：真實專案搬 `dflow/specs/features/active/...` 到 `completed/...` 應使用 `git mv`，保留 rename history 和 PR diff 可讀性。本 tutorial outputs 用 OS-level move 只是示範 fixture 的限制，不改變規範。
- **Integration Summary 的 audience 與 neutrality**：summary 同時服務團隊內 reviewer 和 stakeholder；它刻意 git-strategy-neutral，不假設 Git Flow、GitHub Flow、squash、rebase 或 merge commit，因此可被改寫成 PR description、release note 或 merge note。
- **completed feature 不可直接追加 T2/T3**：依 modify-existing-flow Step 1.5，completed feature 是 frozen history。Alice 若日後要 batch approval、notification email 或新的 reject reason 政策，必須建立 follow-up feature，而不是 reopening `SPEC-20260428-001`。

## 下一個劇情段

→ 劇情 2：[`../02-brownfield-webforms/00-setup.md`](../02-brownfield-webforms/00-setup.md)

劇情 1（Core greenfield）到此結束。
