# Walkthrough 06 — `/dflow:finish-feature` 收尾第一個 Expense feature

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Greenfield track 的 feature closeout ceremony：當 phase 1 MVP、phase 2
supervisor approval、T2 lightweight modify、T2 bug-fix 都已實作並穩定試用後，Dflow 如何把
`SPEC-20260428-001-employee-submit-expense` 從 active feature 收成 completed feature。

本篇把 Alice 與 Dflow 的 closeout 對話整理成一份可教學、可 review 的讀物，讓讀者看懂：

- `/dflow:finish-feature` 和 `/dflow:new-phase` / `/dflow:modify-existing` 的差異
- closeout validation 如何檢查 phase specs、lightweight specs、BUG specs 與 `_index.md`
- 為什麼 finish-feature 要把 feature-level Current BR Snapshot sync 到 BC-level `rules.md`
- 真實專案為什麼要用 `git mv` archive feature directory
- Integration Summary 如何服務 reviewer 與 stakeholder，且保持 git-strategy-neutral
- completed feature 為什麼是 frozen history，後續變更必須走 follow-up feature

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這一步本身就是 Greenfield 劇情的
closeout，因此連結的完整文件範例已位於
`features/completed/SPEC-20260428-001-employee-submit-expense/`。只讀本篇也能看懂
closeout 順序；若想看 completed snapshot 的完整讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| feature 什麼時候算完成？ | phase specs、T2 modify、BUG-001、regression tests、試用回饋都通過後，才跑 `/dflow:finish-feature`。 |
| finish-feature 只是搬資料夾嗎？ | 不是。它先 validate，再 sync BR snapshot、archive、產出 Integration Summary、處理 follow-up tracking。 |
| `_index.md` 和 `rules.md` 誰是 truth？ | closeout 前 `_index.md` 是 feature-level truth；closeout 時要 reconcile 到 BC-level `rules.md`。 |
| 為什麼 completed feature 不能繼續追加 T2？ | completed directory 是 frozen history；未來改已完成行為要建立 follow-up feature。 |
| Integration Summary 是 commit message 嗎？ | 不是。它是 git-strategy-neutral 的溝通材料，可改寫成 PR description、release note 或 stakeholder summary。 |

## 前情提要

到本篇開始時，Alice 的第一個 ExpenseTracker feature 已經走過完整 lifecycle：

| 日期 | Work item | 狀態 |
|---|---|---|
| 2026-04-28 | phase 1 `mvp`：員工建立 / 編輯 / 提交 ExpenseReport | implemented |
| 2026-04-29 | phase 2 `supervisor-approval`：主管 Approve / Reject，新增 ApprovalDecision | implemented |
| 2026-04-30 | T2 modify：BR-007 reject reason bilingual length | implemented |
| 2026-05-04 | BUG-001：emoji surrogate truncation | implemented |
| 2026-05-07 | 3 天穩定試用，Carol 與另外兩位主管確認 | ready to close |

⚠ **「3 天穩定試用」是本範例的驗收訊號，不是 Dflow 的 gate。** `finish-feature-flow.md`
沒有任何觀察期或天數要求——它檢查的是文件狀態（七個必要段落、phase-spec 都 completed、
`Commit` 格解得開……），完成與否由你的團隊用自己的 DoD / sign-off 證據判定。
Alice 用三天試用，是因為這個 feature 動到主管的審核路徑；換一個 feature 可能是
「regression 全綠就收」。

上一篇 [〈Walkthrough 05 — `/dflow:bug-fix` 修正 reject reason emoji 截斷〉](walkthrough-05-bug-fix.md) 中，
BUG-001 修正了「金額對不上👍」被錯誤拒絕的問題。Carol 重新測試後，這個 reject path
可以正常退回，其他主管也確認一般 reject flow 沒問題。

Alice 現在要做的不是再開下一個 phase，而是把這個 feature 收尾：

```text
active/SPEC-20260428-001-employee-submit-expense/
→ completed/SPEC-20260428-001-employee-submit-expense/
```

## 劇情背景

2026-05-07 週四下午，Alice 在 AI coding agent 裡輸入：

```text
Alice:
BUG-001 修完了。
Carol 用「金額對不上👍」reject 成功，
另外兩位主管也測過一般退回流程。

Regression tests 都綠，
這個 feature 已經穩定試用 3 天。

我想把 SPEC-20260428-001-employee-submit-expense 收尾。

/dflow:finish-feature
```

這段輸入提供了 finish-feature 需要的完成訊號：

| 完成訊號 | 為什麼重要 |
|---|---|
| BUG-001 implementation done | 最後一個已知 blocker 已處理。 |
| Regression tests green | closeout 前沒有已知回歸風險。 |
| Carol 驗證原 bug | 使用者回報的失敗 path 已驗證。 |
| 另外兩位主管確認一般 reject flow | bug fix 沒破壞主要使用路徑。 |
| 穩定試用 3 天 | feature 不只是 code complete，而是 ready to archive。 |

## Before Dflow speaks

如果沒有 Dflow，團隊可能會把 feature branch merge 掉，然後留下 active spec directory。短期看起來沒問題，
但後續會出現幾個維護風險：

| 風險 | 後果 |
|---|---|
| active feature 永遠不關 | 下一個 AI session 不知道這個 feature 是否仍要繼續實作。 |
| feature BR snapshot 沒同步到 BC rules | 後續 feature 讀 system-level docs 時，可能拿到舊 wording。 |
| phase / lightweight / bug history 混在 active work | reviewer 很難分辨 frozen history 和下一輪變更。 |
| future consideration 沒 dispose | batch approval、notification、SLA 等延後項目變成 dangling question。 |
| 完成內容只存在聊天紀錄 | stakeholder 不知道到底完成了什麼、還有哪些 deferred。 |

`/dflow:finish-feature` 的角色是 feature lifecycle endpoint：它把已完成的決策同步到 durable system state，
並把 feature history 冷凍成 completed archive。

## Step 1 — Validate phase specs、lightweight specs 與 `_index.md`

Dflow 先說明 finish-feature ceremony：

```text
Dflow:
收到。這是 /dflow:finish-feature，
也就是 feature closeout ceremony。

這一步不會 merge、不會 push、不會替你選 Git strategy。
它只做六件事：

- Step 1：validate 所有 phase / lightweight specs 與 _index.md
- Step 2：把 feature status flip 成 completed
- Step 3：把 _index.md Current BR Snapshot sync 到 Expense BC layer
- Step 4：archive feature directory，真實專案使用 git mv
- Step 5：emit Integration Summary
- Step 6：如果這是 follow-up feature，反向更新原 feature；否則跳過
```

這是本篇第一個 lesson：**finish-feature 不是 Git merge 指令。**

Dflow 不替團隊選 Git Flow、GitHub Flow、trunk-based、squash 或 rebase。它只整理 SDD / DDD
文件生命週期，讓後續 Git 動作有清楚的 spec state。

Dflow 先跑 mechanical checks：

```text
Dflow:
Step 1 mechanical checks：

- Feature directory located
- _index.md exists and front matter parses
- Phase Specs table has 2 rows: phase 1 mvp, phase 2 supervisor-approval
- Phase 1 implementation status: done
- Phase 2 implementation status: done
- T2 lightweight approval-reason-bilingual-length: done
- T2 bug-fix BUG-001-emoji-surrogate-truncation: done
- Regression tests reported green after BUG-001
- Current BR Snapshot contains BR-001..BR-007, all active
- No unresolved implementation TODO remains in Resume Pointer
```

這些檢查的目的不是重新設計 feature，而是確認 closeout 前沒有明顯的未完成工作。

## Step 1 — Closeout driftcheck 與 deferred item disposition

Dflow 接著做 closeout driftcheck：

```text
Dflow:
Driftcheck result：

- BR Snapshot BR-001..BR-007 all exist in dflow/specs/domain/Expense/rules.md
- BR-002 的 phase-2 modification 在 rules.md 有保留歷史註記
- BR-007 的 2026-04-30 lightweight modification 在 rules.md 有保留歷史註記
- ApprovalDecision Aggregate 已存在於 models.md
- ExpenseReportApproved / ExpenseReportRejected 已存在於 events.md
- ⚠ dflow/specs/domain/Expense/behavior.md 只有 new-feature Step 3 建的骨架，
  而那時只存在 BR-001~004，所以檔內也只有這四個 anchor、還沒有場景。
  BR-005~007 是 phase 2 新增的，new-phase 不同步 BC 層文件，anchor 還沒建
  → Step 3 的 BC sync 要補建 BR-005~007 的 anchor，並把 Given/When/Then
    場景補進全部七個
- Unicode character counting strategy under i18n tech debt 仍是 open
- Minor drift：phase 2 spec 裡的 Open Question「要不要支援批次 Approve」沒有明示移到哪裡
```

Alice 決定 batch approval 的 disposition：

```text
Alice:
批次 Approve 不要放 phase 2，也不要現在開 spec。
把它列到 _index.md 最後的 future consideration，
註明 deferred from phase 2，指向 features/backlog/。
但先不要真的建 backlog feature 檔。
```

Dflow 記錄：

```text
Dflow:
Batch approval: deferred from phase 2.
If trial feedback proves it is needed,
create a follow-up feature under dflow/specs/features/backlog/.
Do not reopen SPEC-20260428-001.
```

同一段也把 notification email、approval SLA timer / escalation、Reimbursement BC 放到
Outstanding / Deferred。這是 closeout 的重要工作：**不是只確認完成什麼，也要把未做的項目
dispose 到明確位置。**

## Step 2 — Flip `_index.md` status to completed

Alice 確認繼續：

```text
Alice:
/dflow:next
```

Dflow 更新 feature dashboard：

```text
Dflow:
Step 2: Flip _index.md Status to completed。

- front matter status: in-progress → completed
  （只翻 status。branch: 永遠不改寫，也不新增 front matter 欄位——
   關帳後的驗證會把「沒有任何步驟要求的差異」判成 edit fallout 並擋下來。）
- Phase Specs table：不動。每一列早在 Step 1 就必須已經是 completed，
  那是通過條件，不是這一步的工作。
- Resume Pointer 改成**誠實的進行中值**（終局值要等 Step 4 歸檔那一刻才寫）：
  status 已翻成 completed；closeout 進行中，下一步是 Step 3 的 BC sync。
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)

重點片段：

```markdown
---
spec-id: SPEC-20260428-001
slug: employee-submit-expense
status: completed
created: 2026-04-28
branch: feature/SPEC-20260428-001-employee-submit-expense
---
```

⚠ **只有 `status` 這一個欄位變了。** front matter 沒有 `completed_date` 這種欄位——
`templates/_index.md` 沒定義它，Step 2 也沒有命令寫它。關帳後的驗證是拿 commit 進去的
`_index.md` 跟 Step 1 讀到的比，**差異必須恰好等於 Step 2、Step 4 的終局 cursor 寫入、
與 Step 4 指令 1 命令的那些**，
多出來的欄位會被判成 edit fallout 並擋下 closeout。完成日期不必另存一格：
closeout commit 自己就是時間戳（`git log -1 -- completed/{SPEC-ID}-{slug}`）。

Resume Pointer（**這一步寫的是進行中值，不是終局值**）：

```markdown
**Current Progress**:
status 已翻成 completed（2026-05-07）；closeout 進行中。

**Next Action**:
繼續 closeout——把 Current BR Snapshot sync 到 BC layer（Step 3）。

**Active Workflow**: finish-feature

**Current Step**: Step 3 — sync BR Snapshot to BC layer

**Gates Passed**: 1→2

**Awaiting**: none (mid-step)
```

⚠ **六行都要寫**，而且**這裡不可以寫 `none`。** Resume Pointer 是**兩行散文
（Current Progress／Next Action）＋ 四個 cursor 欄位**，合計六行；範本把「cursor
欄位」明確定義為後面那四個，前兩行不屬於宣告層。只寫前兩行等於把 cursor 停在半路。
但 closeout 自己還沒跑完——Step 3、
Step 4 都還在前面，而 gate 3 → 4 是真的 step gate。在這裡就把 `Active Workflow`
寫成 `none`，等於宣告 workflow 已結束，然後 flow 還要在 gate 3 → 4 叫 Alice 打
`/dflow:next`——那正是 `AI-AGENT-GUIDE.md` 規定「沒有 active workflow 時必須拒絕」
的指令。**終局值在 Step 4 寫**，見下面那一節。

⚠ **`Awaiting` 寫 `none (mid-step)`，不要寫 `gate 3→4`。** Step 3 還沒跑；寫成 gate
會讓接手的 session 直接打 `/dflow:next`，**整個 BC sync 被跳過**。

## Step 3 — Sync Current BR Snapshot 到 BC layer

Dflow 進入 Step 3：

```text
Dflow:
Step 3: Sync _index.md Current BR Snapshot to BC Layer。

先說原則：
_index.md 是 feature-level current state；
dflow/specs/domain/Expense/rules.md 是 Expense BC 的 system-level current state。
Feature 完成時，finish-feature 要把前者 reconcile 到後者。
```

Dflow 也說明 cross-feature reconciliation 原則：

```text
如果 Expense BC 同時有其他 completed features，我會做 cross-feature reconciliation：

- 新 feature 的 BR-ID 若不存在於 rules.md，新增
- 已存在但 wording 不同，確認是本 feature 的 MODIFIED net result 後更新
- Snapshot 標成 removed 的 BR，要從 system-level active rules 移除或標 deprecated
- RENAMED BR-ID 要同步 glossary / behavior anchors
- 若兩個 feature 對同一 BR 有衝突，以 rules.md 的 system-level truth 做 final reconciliation
```

本案 Expense BC 目前只有 `SPEC-20260428-001`，所以看起來是 1-to-1 sync。但 Dflow 仍以同一套規則處理，
避免團隊未來誤以為 finish-feature 只是 copy table。

## Step 3 — Expense BC sync result

Dflow 的 sync summary：

```text
Dflow:
Expense BC sync result：

- BR-001：already exists；wording matches snapshot
- BR-002：already exists；wording matches snapshot；保留 phase-2 MODIFIED
- BR-003：already exists；收斂成 snapshot wording
- BR-004：already exists；收斂成 snapshot wording
- BR-005：already exists；wording matches snapshot；保留 phase-2 ADDED
- BR-006：already exists；wording matches snapshot；保留 phase-2 ADDED
- BR-007：already exists；wording matches snapshot；保留 phase-2 ADDED 與 2026-04-30 lightweight MODIFIED
```

Alice 擔心 BR-003 / BR-004 原本 rules.md 有更多 implementation detail：

```text
Alice:
BR-003 和 BR-004 原本 rules.md 多寫一點實作細節，
刪掉會不會丟資訊？
```

Dflow 解釋：

```text
Dflow:
刪的是 system-level rule summary 的多餘 detail，不是刪 history。

rules.md 的 Rule Index 要跟 _index.md Current BR Snapshot 完全一致，
因為 finish-feature 後它是跨 feature 的 BR index。
更細的 Given/When/Then、MVP validation behavior 和 warning text
不應塞在 summary 欄；那類內容應在 behavior scenarios、
phase-spec history 或 implementation tests 裡。
```

完整文件範例：
[`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md)

Rule Index 的 final state：

```markdown
| BR-ID | Rule summary | Behavior anchor | Aggregate | Status | Last updated |
|---|---|---|---|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。 | [BR-001](./behavior.md#br-001-submit-requires-at-least-one-item) | ExpenseReport | active | 2026-04-28 |
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | [BR-002](./behavior.md#br-002-submitted-report-is-immutable-except-rejected-rework) | ExpenseReport | active | 2026-04-29 |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | [BR-003](./behavior.md#br-003-item-amount-must-be-positive) | ExpenseReport | active | 2026-04-28 |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 | [BR-004](./behavior.md#br-004-duplicate-receipt-rejected) | ExpenseReport | active | 2026-04-28 |
| BR-005 | 主管不可審核自己提交的 ExpenseReport；SubmitterId != ApproverId 必須由 Domain 層強制。 | [BR-005](./behavior.md#br-005-approver-cannot-approve-own-report) | ApprovalDecision | active | 2026-04-29 |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | [BR-006](./behavior.md#br-006-only-submitted-report-can-be-approved-or-rejected) | ExpenseReport | active | 2026-04-29 |
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | [BR-007](./behavior.md#br-007-reject-requires-reason) | ApprovalDecision | active | 2026-04-30 |
```

## Step 3 — Lifecycle section（Alice 團隊自訂，**不是 Dflow 產生的**）

⚠ **先講歸屬，因為這段最容易被誤讀成產品行為。** `rules.md` 範本只有三段——
`Rule Index`、`Status Legend`、`Open Questions`；`finish-feature-flow.md` Step 3 對
`rules.md` 的規定也只有「增 / 改 / 刪 BR 段」與「更新 Rule Index 的 `Last updated`」。
**`## Lifecycle` 這一段 Dflow 不會寫，範本裡也沒有。** 它是 Alice 團隊自己加的慣例。

之所以留在本篇，是因為它示範了一個真實會遇到的缺口：feature 歸檔之後，
「這條 BR 是哪個 feature 定案的」只剩 `Last updated` 一個日期可查。
**但照著做的人要知道這一步得自己動手**，Dflow 不會幫你生成：

```markdown
## Lifecycle

2026-05-07 從 SPEC-20260428-001-employee-submit-expense
完成狀態做最終 reconciliation。
completed feature 中的 Current BR Snapshot 是 feature-level 稽核來源；
此 rules.md 表是 Expense BC system-level current state。
```

Lifecycle table：

```markdown
| BR-ID | First Seen | Last Updated From Feature Snapshot | Finalized From | Finalized Date | Lifecycle State |
|---|---|---|---|---|---|
| BR-001 | phase-1 (mvp) | phase-1 (mvp) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-002 | phase-1 (mvp) | phase-2 (supervisor-approval) | SPEC-20260428-001 完成 | 2026-05-07 | active |
| BR-007 | phase-2 (supervisor-approval) | lightweight-2026-04-30 | SPEC-20260428-001 完成 | 2026-05-07 | active |
```

這是本篇第三個 lesson：**finish-feature 把 feature history 轉成 system state。**
（做這件事的是 Step 3 對 `rules.md` / `behavior.md` 的 sync；上面那張 Lifecycle 表
是團隊自己補的稽核面，不是 Dflow 的產出。）

## Step 3 — 其他 BC layer checks

Dflow 也檢查其他 living docs：

```text
Dflow:
Step 3 其他 BC layer checks：

- models.md：ApprovalDecision Aggregate 已存在；ApprovalReason 的門檻同步成
  2026-04-30 lightweight 之後的雙語條文（closeout sweep 明文包含 models.md）
- events.md：ExpenseReportSubmitted / Approved / Rejected 都存在
- behavior.md：骨架已在 new-feature Step 3 建好，但只涵蓋當時存在的 BR-001~004。
  BR-005~007 的 anchor 要在這裡補建，七條的 scenario 內容也在這裡補上；
  萬一檔案不存在，從 `templates/behavior.md` 建立
- context-map.md：Identity external relationship 已存在；Reimbursement 仍是 future context，不更新
- glossary.md：ApprovalReason 已包含 2026-04-30 bilingual length wording，不更新
- architecture/tech-debt.md：Unicode character counting strategy under i18n remains open，
  補 related-feature：SPEC-20260428-001 (completed 2026-05-07)
```

完整 tech debt 範例：
[`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md)

關鍵是它仍然 open：

```markdown
| Unicode i18n 下的字元計數策略 | Domain / Presentation | ... | open |
```

BUG-001 修了 reject reason truncation，但更廣泛的 Unicode counting policy 不因 feature closeout
而自動消失。

### `behavior.md` lifecycle note

`behavior.md` 的**骨架**在 walkthrough 02 的 new-feature Step 3 就建好了——但只涵蓋
**當時存在的 BR-001~004**，每條一個 anchor。BR-005~007 是 walkthrough 03 的 phase 2
才新增的，而 `new-phase-flow.md` 明寫 phase 不同步 BC 層文件（「`rules.md` /
`behavior.md` … are **NOT updated here** — that synchronisation happens at
`/dflow:finish-feature`」），所以**它們的 anchor 要等這次 closeout 才會出現**。
從 walkthrough 02 到 05，**場景**則一律留在 phase spec 裡
（見 [walkthrough 03 的文件表](walkthrough-03-new-phase.md)）。**到了 closeout，要求就變了。**
`finish-feature-flow.md` 的 BC sync 明文規定：

> For every BR-ID still active after this feature, ensure
> `dflow/specs/domain/{context}/behavior.md` has a scenario section (anchor)
> matching the BR-ID

而且同一段還說：檔案不存在時，**只要這次 sync 會寫進去就從 template 建立它**
（在正常流程裡骨架早就在了，這句是防漏的）。BR-001~BR-007 在 closeout 後全部仍
active，所以跑完這次 closeout，`dflow/specs/domain/Expense/behavior.md` 會**對七條 BR
各有一段填好內容的 scenario**——不是這時才第一次出現，而是骨架被填滿。

`outputs/dflow/specs/domain/Expense/behavior.md` 就是跑完這一步之後的樣子：七條 BR
各一段 scenario，anchor 與 `rules.md` 的 `Behavior anchor` 欄一一對應。它跟這棵樹裡
其他文件一樣是**最終狀態**，所以你在那裡看到的是**填滿之後**的版本，不是 walkthrough 02
當下那份只有 BR-001~004 的骨架——這個「outputs 是最終狀態、內嵌片段是當步狀態」的差別，
每一篇開頭都提醒過。

之後 `/dflow:verify` 會拿 `rules.md` ↔ `behavior.md` 做 drift check，用的正是這組對應。

Brownfield 那一軌有走到這一步，可以對照
[Brownfield walkthrough 06 的 `behavior.md` lifecycle note](../02-brownfield/walkthrough-06-finish-feature.md)。

## Step 4 — Archive feature directory

Alice 繼續：

```text
Alice:
/dflow:next
```

Dflow 說明真實專案應使用 `git mv`：

```text
Dflow:
Step 4: Archive feature directory。

真實專案我會用這個命令，不用 plain mv：

git mv dflow/specs/features/active/SPEC-20260428-001-employee-submit-expense \
       dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense
```

為什麼用 `git mv`？

| 做法 | 結果 |
|---|---|
| `mv` + later add | Git 仍可能偵測 rename，但大型 directory diff 可讀性較差。 |
| `git mv` | 明確表達 archive action，rename history / PR diff / `git log --follow` 較清楚。 |

### `git mv` 之後緊接著寫終局 cursor

`git mv` 一做完，host 就從 `active/` 進了 `completed/`，而 `/dflow:status` 只掃
`active/`。從這一刻起，**沒有任何全域掃描讀得到這個 cursor 了**。終局值就寫在這裡：

```text
Dflow:
Step 4: 寫入 Resume Pointer 終局值（緊接 git mv，中間不插任何等待點）。
```

```markdown
**Current Progress**:
Feature 已於 2026-05-07 完成；所有 phase-spec status = completed。

**Next Action**:
integration —— 依 _conventions.md 選定的 Git policy 做 push / merge / PR。

**Active Workflow**: none

**Current Step**: n/a

**Gates Passed**: n/a

**Awaiting**: none
```

⚠ **注意這裡沒有 `git status`。** rename 檢查要排在終局 cursor 寫完**之後** ——
`git mv` 與這次寫入之間不放任何東西。檢查本身照跑，只是往後挪：

```text
Dflow:
git status --short   # 確認 rename 被偵測到，並看 RM —— rename 旁邊的 M
                     # 代表有未 stage 的編輯（就是剛寫的 cursor），commit 前要
                     # git add。⚠ 一定要 --short：預設的長格式會把 rename 與
                     # modification 分兩段列，永遠不會印出 RM 這個雙欄狀態碼。
```

⚠ **`Next Action` 寫的是 integration，不是「以後請開 follow-up」。** 此刻 Step 5
的整合工作**還沒做**，cursor 要指向下一個真的要發生的動作。flow 的終局範本就是這個值。

這是本篇第二個 lesson：**等 integration 也做完之後**，這個 completed feature 的後續
變更要透過 `/dflow:modify-existing` 開成 follow-up feature —— **不要**把 T2/T3
changes 直接追加進這個已歸檔目錄。那是「之後怎麼改」，不是 cursor 此刻該指的地方。

⚠⚠ **中間隔一個等待點就會開一個窗口。** `git mv` 與這次寫入之間如果插進下面那個
「要現在 commit 嗎？」的 Y／N 提示，就會出現一段「host 已在 `completed/`、cursor
卻還宣告 `finish-feature` 進行中」的狀態——`/dflow:cancel` 會在那裡生效。所以
flow 把這兩件事定義成**不可中斷的一對**。

⚠ **寫下去之後 closeout 就不再動這個 cursor**：commit 被拒（N）、commit 失敗、
post-commit 驗證 `✗`，三條路都一樣，**不要還原成進行中值**。`git mv` 已經把 host
移出 `active/`，還原 cursor 買不回「`/dflow:status` 找得到它」。收尾在這之後失敗時，
看得見它的是 `git status`——staged 的 rename 加上未 commit 的 `_index.md` 改動。

本 tutorial outputs 已經是 final fixture，完成後路徑是：

[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/)

補充：這裡描述的是 Dflow 在真實專案中的 archive 動作；本 tutorial 連到的是已保留的
closeout 後完整文件範例。

### Step 4 還做了一件容易被忽略的事：回填 hosted `Commit` 格

`git mv` 不是 Step 4 的全部。同一次編輯裡，Dflow 還要把 Lightweight Changes 表上
**還沒填的 `Commit` 格補起來**：

```text
Dflow:
Step 4 指令 1: 回填未填的 hosted Commit 格。

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-04-30 | T2 | Reject reason 從至少 10 字元放寬為 5 中文字 OR 10 英數字。見 [lightweight-2026-04-30-approval-reason-bilingual-length.md](./lightweight-2026-04-30-approval-reason-bilingual-length.md) | f10c6b3 |
| 2026-05-04 | T2 | Bug-fix: 前端 substring 截斷 emoji surrogate pair 導致 reject reason 被拒。見 [BUG-001-emoji-surrogate-truncation.md](./BUG-001-emoji-surrogate-truncation.md) | 2ad57e9 |

第一列的 `Commit` 早在 05-04 那次 commit 就回填過了，這次不動；
**本次回填的是第二列的 `2ad57e9`**。
寫進去的是「那一列自己的實作 commit」，不是 closeout 這個 commit 的 hash。
```

**為什麼會有沒填的格子？** 因為一列的 hash 不可能由它自己那個 commit 寫進去——
commit 還沒發生就沒有 hash，commit 發生後檔案已經定版了。所以 hosted row 的格子
一律由 host 的**下一個** commit 回填。04-30 那列等到了 05-04 的 commit；05-04 那列
之後沒有新的 phase 了，**closeout 就是它等的那個「下一個 commit」**。

**沒有下一次了，所以這裡漏掉就永遠是空的。** 這正是 Step 4 把回填寫成指令、而不是
建議的原因；`references/pr-review-checklist.md` 也在 PR 端再檢一次每一格是否**解得開**
（不是「非空就算數」——`{pending}` 這種佔位字串是非空的，卻什麼也不是）。

## Step 5 — Emit Integration Summary

> ⚠ **本篇壓縮掉了 Step 5 的第一件事，但它必須先發生。** flow 規定
> 「**First, print the closeout verification's derivation.**」——在摘要之前，先說明
> Step 4 的 post-commit 驗證**是怎麼算出來的**（baseline、逐項差異各由哪一步指示、
> 接受了哪些外部路徑、以及有什麼是它判定不了、該由誰承擔）。那是一次真實驗證的推導
> 結果，本教材不編造它；要看完整規定請讀
> `finish-feature-flow.md` 的 Step 5 開頭。以下從摘要本身開始。

Dflow 接著產出 Integration Summary。它先說明 audience：

```text
Dflow:
這份 summary 的 audience 是兩群人：

- 團隊內：工程師、reviewer、日後接手 Expense BC 的人
- Stakeholder：PO、Carol 這類試用主管、需要知道這個 feature 到底完成了什麼的人

它不是 commit message template，也不假設 Git Flow、GitHub Flow、squash、rebase 或 merge commit。
你可以把它改寫成 PR description、release note、merge commit message，或貼到團隊同步文件。
```

⚠ **這份 summary 印在對話裡，不會被寫進任何檔案。** `finish-feature-flow.md` Step 5
的原文是「Print the summary to the conversation; do not write it to a file
(it is ephemeral closeout output)」。

⚠⚠ **這是一條 flow 的明文指示，不是一道 gate——不要把它說成 gate。** Step 1 檢查的是
「七個必要段落**都在**」，不是「除此之外什麼都不准有」；關帳後的驗證比的是「Step 1 讀到的
東西有沒有被改動」，所以一段從頭到尾都在、closeout 也沒動過的 `## Integration Summary`
**不會**被擋下。何況 Step 5 跑在 Step 4 的 commit 與那道驗證**之後**——這時候寫進檔案的
東西根本不在那個 commit 裡，**closeout 自己的檢查都看不到它**。
⚠ 但「closeout 看不到」不等於「沒人看得到」：`references/pr-review-checklist.md`
就有一項「**Integration Summary** was emitted to the conversation (not written to a
file — it's ephemeral)」，兩軌都有。而且 Step 5 明寫這時 host 已經歸檔凍結、
**不得再改 archived `_index.md`**，Step 4 也說終局 cursor 寫下去之後就不再動它。
「Step 4 之後沒人管」是錯的推論。
**照 Step 5 做的理由是 Step 5 這麼說，不是因為不這麼做會被擋。**
（對照上面的 `completed_date`：那一條**確實**有 gate 撐著，因為 Step 2 寫在 Step 4 的
commit **之前**，它會成為基準的差異而被擋。兩者的差別值得看清楚。）

所以下面每一段都是**對話輸出**。歸檔後的檔案長什麼樣，見
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)
——它有七個必要段落（含 Checkpoint Log），**沒有** Integration Summary 段。
要把這份 summary 留給日後的 reviewer，貼進 PR description、release note 或團隊同步文件，
那才是它的去處。

`finish-feature-flow.md` Step 5 有一個 `Format:` 區塊，逐欄規定這份摘要長什麼樣。
下面就是照它印出來的：

```text
== Integration Summary: SPEC-20260428-001-employee-submit-expense ==

Feature Goal: 員工可以建立、編輯並提交 ExpenseReport；主管可以對 Submitted 狀態的
ExpenseReport 執行 Approve 或 Reject，並留下可稽核的 ApprovalDecision。本 feature
建立初始的 Expense Bounded Context。

Change Scope:
- BC: Expense
- Aggregates affected: ExpenseReport, ApprovalDecision
- Phase Count: 2 (phase-spec-2026-04-28-mvp phase-spec-2026-04-29-supervisor-approval)
- Lightweight Changes: 2 T2 lightweight specs + 0 T3 inline rows

Related BR-IDs (post-closeout state):
- ADDED: BR-001, BR-002, BR-003, BR-004, BR-005, BR-006, BR-007
- MODIFIED: none
- REMOVED: none

Domain Events Changes:
- ADDED: ExpenseReportSubmitted, ExpenseReportApproved, ExpenseReportRejected
- MODIFIED: none
- REMOVED: none

Phase List:
- phase-1 (2026-04-28): mvp — 建立 ExpenseReport、ExpenseItem、Money、
  ReceiptReference、ExpenseCategory、Submit 流程與 ExpenseReportSubmitted。
- phase-2 (2026-04-29): supervisor-approval — 加入主管 Approve / Reject、
  ApprovalDecision、ApprovalReason、ExpenseReportApproved、ExpenseReportRejected，
  以及 Rejected 後重編行為。

Next Steps (developer) — Integration / PR gate (needs network):
- Per the selected Git policy (`gitflow` / `trunk` in `_conventions.md`), choose
  a merge strategy (merge commit / squash / rebase / fast-forward) and execute
- Push to remote / open a PR — the AI can run `git push` / `gh pr create` for
  you, but only when you explicitly ask; it never pushes on its own
```

兩個欄位值得停下來看：

**`Related BR-IDs` 這一欄最容易被讀錯，而且錯法很固定：把它當成「這次 sync 做了
什麼」。** 它不是。flow 在**兩軌的 Step 3、Step 5，以及兩軌的 `Git-principles-*`
scaffolding**裡都寫了同一句話：

> **`Related BR-IDs` is not one of those**: it reports what this change's own
> record carries, **not what was synced**

同一段還特別點名：`BC`、`Aggregates affected`、`Domain Events Changes` 才是「報告
有沒有做 sync」的那一組，**`Related BR-IDs` 不屬於那一組**。

所以它的值要去**這個 host 自己的 `_index.md` Current BR Snapshot** 拿。本 feature 的
snapshot 七列的 `First Seen (phase)` 全是 `phase-1 (mvp)` 或
`phase-2 (supervisor-approval)`——**沒有一列是 `inherited from rules.md`**（範本為
「繼承來的規則」保留的那個值）。也就是說這份紀錄自己說：這七條都是本 feature 引入的。
因此是 `ADDED: BR-001…BR-007 / MODIFIED: none`。

⚠ **不要拿上面 Step 3 的 sync 結果來反推這一欄。** Step 3 印的「BR-003 already
exists；收斂成 snapshot wording」講的是 `rules.md` 那邊的動作，而 Step 3→4 gate 的
`{n_added} added, {n_modified} modified` 也是 sync 的計數——**那些跟這一欄是兩件事，
flow 特地寫了一句話來擋這個誤讀**。

**`Related BR-IDs` 不等於 `_index.md` 的 Current BR Snapshot。** 內容看起來重疊，
角色不同：檔案裡那張是 feature 的當前狀態、會被後續步驟 regenerate；摘要這一行是
closeout 當下把**這份紀錄自己帶了什麼**讀出來一次，印完就沒了（flow 明寫這份摘要
不寫進檔案）。**它報的不是「closeout 對 BC 做了什麼」**——那是 `BC`、
`Aggregates affected`、`Domain Events Changes` 那一組的工作，就是上面那句 flow 原文
特地把它排除在外的那一組。**不要因為「重複」就把檔案裡那張刪掉**——它正是
Step 3 同步到 BC layer 的來源。

**最後那段 `Next Steps` 不能省。** 它是整份摘要裡唯一寫著「AI 可以幫你 `git push` /
開 PR，**但只有你明講時才會做，它不會自己推**」的地方。省掉它，讀者就少了這個保證。

這是本篇第四個 lesson：**Integration Summary 是 feature story 的壓縮版，不是 Git 操作紀錄。**

它讓日後 reviewer 不必逐一讀兩份 phase spec、兩份 T2 spec 和多個 domain docs，先取得整體脈絡。

### 團隊自加的三段（**規範的 `Format:` 沒有這些**）

⚠ 接下來三段——Tech Debt Outstanding、Outstanding / Deferred、Sign-off——
**都不在 `finish-feature-flow.md` Step 5 的 `Format:` 區塊裡**。它們是 Alice 團隊
在規定欄位之外自己補的，因為 closeout 也要回答 stakeholder「誰確認過、還有什麼沒做」。
放進本篇是為了展示這個真實需求，**但照著做的人要分得清哪些是 Dflow 規定的、
哪些是自己加的**：上面那個 `== Integration Summary ... ==` 區塊是規範欄位，
下面這些不是。

```markdown
### Tech Debt Outstanding

- Unicode i18n 下的字元計數策略: status 在 dflow/specs/architecture/tech-debt.md
  中仍為 open。BUG-001 已修 reject reason truncation 與 malformed-input handling，
  但針對 grapheme clusters、code points、UTF-16 units、Intl.Segmenter 與 ICU support
  的更廣泛產品層級策略，仍是獨立 architecture 後續事項。
```

deferred items：

```markdown
### Outstanding / Deferred

- Batch approval：phase 2 刻意只交付單筆 report 的 Approve / Reject。如果試用回饋
  證明需要 batch approval，請在 features/backlog/ 下建立 follow-up feature 並連回
  這個 completed feature；不要直接在這裡追加新的 T2/T3 work。
- Approval notification email：已延後，因為 phase 2 將 notification concerns 保持在
  Expense Domain model 之外；可能是 Notification concern 或 Application Layer integration。
- Approval SLA timer / escalation：延後到 policy 複雜度明確後；可能代表未來需要
  Approval policy model 或獨立 BC review。
- Reimbursement BC：approval 穩定後規劃的未來 context；可能會接在
  `ExpenseReportApproved` 之後，消費 Expense 的 approved report information。
```

Sign-off：

```markdown
### Sign-off

- Alice 在 2026-05-07 closeout 前確認實作完成狀態與所有 regression tests。
- Carol 確認原本使用「金額對不上👍」的 reject path 現在可正常運作。
- 另外兩位試用主管在 3 天穩定試用期間確認一般 reject flow。
```

這段讓 closeout 不只是工程內部狀態，也能回答 stakeholder：「誰確認過？還有哪些沒做？」

## Step 6 — Reverse-update follow-up tracking：skip

Dflow 最後跑 Step 6：

```text
Dflow:
Step 6: Reverse-Update Follow-up Tracking：skip。

跳過理由：
SPEC-20260428-001-employee-submit-expense 沒有 follow-up-of metadata。
它不是從某個 completed feature 派生出來的 follow-up feature，
所以沒有原 feature 的 Follow-up Tracking row 需要反向更新。
```

這一步在本案是 skip，但它很重要。若某個 feature 是從 completed feature 派生的 follow-up，
finish-feature 時要回頭更新原 feature 的 Follow-up Tracking，讓歷史鏈完整。

⚠ **所以你在完整文件範例裡看到的那一列 Follow-up Tracking，不是本篇產生的。**
打開 `_index.md` 會看到
`| SPEC-20260512-001 | reject-not-persisted | 2026-05-12 | completed |`——
那是 **walkthrough 08** 的 follow-up host 在**它自己的** closeout（Step 6）反向翻上來的，
發生在本篇之後五天。fixture 反映的是 tutorial 跑完整條劇情後的**最終**狀態，
不是本篇 closeout 當下的快照。本篇當下那一段還不存在（它是選配的第八段，
只在這個 feature 長出 follow-up 時才出現）。

## Completed feature 是 frozen history

Alice 最後問：

```text
Alice:
後續如果 Carol 又想改 reject reason，
或主管要 batch approve，
我不能直接往這個 completed directory 加 lightweight spec，對吧？
```

Dflow 回：

```text
Dflow:
對。completed feature 是 frozen history。

如果日後要改已完成 feature 的行為，走 /dflow:modify-existing。
modify-existing-flow Step 1.5 會偵測 target feature 已在 completed/，
拒絕直接追加 T2/T3，
並引導你建立 follow-up feature。
```

這是本篇第五個 lesson：**finish-feature 是 lifecycle endpoint。**

new-phase 和 modify-existing 是「繼續這個 active feature」。finish-feature 之後，這個 directory
不再承接新的變更；未來工作要用新的 feature history 連回來。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 移動 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/) | Feature 從 active archive 到 completed 後的完整目錄。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | completed status（只翻 `status`）、Resume Pointer 終局狀態、Checkpoint Log 的 closeout 列、Lightweight Changes 回填的 `Commit` 格。⚠ Integration Summary **不寫進檔案**，見 Step 5。 |
| 修改 | [`outputs/dflow/specs/domain/Expense/rules.md`](outputs/dflow/specs/domain/Expense/rules.md) | BC-level Rule Index 與 Lifecycle section，從 feature snapshot finalize。 |
| 修改 | [`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md) | Unicode counting debt 保持 open，補 related completed feature context。 |
| 故意不改 | `outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/phase-spec-*.md` | phase specs 保留 frozen history，不在 closeout 重寫。 |
| 故意不改 | `outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/lightweight-*.md` | T2 modify spec 保留 frozen history。 |
| 故意不改 | `outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/BUG-001-*.md` | BUG-001 spec 保留 frozen history。 |
| 故意不建 | `outputs/dflow/specs/features/backlog/batch-approval*.md` | batch approval 只列 future consideration，不建 backlog feature。 |
| 故意不更新 | `features-index.md` | 本 tutorial scaffold 採 listing-on-demand，不集中維護 features index。 |

上表連到 closeout 後完整文件範例，用來檢查完整完成狀態。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Hybrid workflow control | `/dflow:finish-feature` 有 validation、status flip、BR sync、archive、summary、follow-up tracking 六步，不直接 commit / merge。 |
| Spec-first development | closeout 前先檢查 spec / tasks / tests，再 archive feature directory。 |
| DDD semantic backbone | Current BR Snapshot 被 reconcile 到 BC-level `rules.md`，不是只留在 feature history。 |
| 三層文件分工 | phase / T2 specs 是 frozen history，feature `_index.md` 是 completed summary，BC docs 是 durable system state。 |
| Drift verification readiness | 印出的 Integration Summary（含 Outstanding / Deferred）與 BC layer 的 Lifecycle section 讓後續 reviewer 能判斷 future changes 是否應開 follow-up。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| active feature 不會關 | 完成後仍留在 active，AI 誤以為可以繼續追加工作。 | status flip + archive 到 completed。 |
| BR system state 漂移 | feature snapshot 已更新，但 BC `rules.md` 還是舊 wording。 | Step 3 sync / reconciliation。 |
| deferred scope 變 dangling question | batch approval、notification、SLA 留在 open question。 | Outstanding / Deferred 明確 disposition。 |
| 完成內容難以溝通 | stakeholder 只能讀 commit 或聊天紀錄。 | closeout 產出一份 git-strategy-neutral 的 Integration Summary，可直接貼成 PR description / release note。 |
| completed feature 被 reopen | 後續 T2/T3 直接塞回 completed directory。 | Resume Pointer 與 Outstanding 明確要求 follow-up feature。 |

## 對不熟 finish-feature 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這個 feature 是否真的可以關？**
   本篇答案是 phase 1 / phase 2 / T2 modify / BUG-001 都完成，試用與 regression tests 通過。

2. **關 feature 時要同步什麼？**
   `_index.md` status、BR Snapshot、Checkpoint Log、BC `rules.md`、tech-debt context。
   ⚠ **Phase Specs status 不在這裡**——每一列在 Step 1 就必須已經是 `completed`，那是
   **進場條件**，不是 closeout 同步的東西（closeout 去動它反而會被判成 edit fallout）。

3. **為什麼要 archive 到 completed？**
   completed directory 表示 frozen history。它讓 active work surface 乾淨，也保護完成後的審計紀錄。

4. **未來改同一行為怎麼辦？**
   走 `/dflow:modify-existing` 建 follow-up feature，不直接在 completed feature 裡追加 lightweight spec。

Finish-feature 的價值，是把「做完了」從口頭狀態轉成 repo 內可讀、可接續、可審計的 system state。

## Key takeaways

- `/dflow:finish-feature` 是 feature lifecycle endpoint，不是 next phase 入口。
- Closeout 先 validate phase / lightweight / bug specs，再 status flip。
- Feature-level Current BR Snapshot 必須 reconcile 到 BC-level `rules.md`。
- 真實專案 archive feature directory 應使用 `git mv`。
- Integration Summary 應保持 git-strategy-neutral，服務 reviewer 與 stakeholder。
- Completed feature 是 frozen history；後續改動要走 follow-up feature。

## Greenfield 劇情收束

到這裡，Greenfield Alice / ExpenseTracker 的第一個 feature 已從 `/dflow:new-feature` 走到
`/dflow:finish-feature`：

```text
new-feature → new-phase → modify-existing → bug-fix → finish-feature
```

接下來的 tutorial 主線可以轉到 Brownfield walkthrough，或在未來補 Greenfield 後續 follow-up
feature 範例。
