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
- add completed_date: 2026-05-07
- Phase Specs table：phase 1 / phase 2 都標 completed
- Resume Pointer 改成：
  Feature completed 2026-05-07; see Integration Summary below.
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
completed_date: 2026-05-07
branch: feature/SPEC-20260428-001-employee-submit-expense
---
```

Resume Pointer：

```markdown
**Current Progress**:
Feature 已於 2026-05-07 完成；請看 features-index.md 或下方的 Integration Summary。

**Next Action**:
未來變更請透過 /dflow:modify-existing 視為 follow-up feature 處理；
不要把 T2/T3 changes 直接追加到這個 completed feature directory。
```

這是本篇第二個 lesson：**completed feature 的 Next Action 是 follow-up，不是 continued work。**

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
| BR-ID | Rule summary | Aggregate | Status | Last updated |
|---|---|---|---|---|
| BR-001 | 提交 ExpenseReport 時必須至少含 1 個 ExpenseItem，否則拒絕。 | ExpenseReport | active | 2026-04-28 |
| BR-002 | ExpenseReport 提交成功後狀態變為 Submitted，不可再被編輯；唯一例外是被 Reject 後可重新編輯並再次 Submit（會建立新的 ApprovalDecision）。 | ExpenseReport | active | 2026-04-29 |
| BR-003 | ExpenseItem 的 Money.Amount 必須 > 0。 | ExpenseReport | active | 2026-04-28 |
| BR-004 | 同一 ExpenseReport 內，相同 ReceiptReference 不允許重複加入。 | ExpenseReport | active | 2026-04-28 |
| BR-005 | 主管不可審核自己提交的 ExpenseReport；SubmitterId != ApproverId 必須由 Domain 層強制。 | ApprovalDecision | active | 2026-04-29 |
| BR-006 | 只有 Status = Submitted 的 ExpenseReport 能被 Approve / Reject；其他狀態一律 raise DomainException。 | ExpenseReport | active | 2026-04-29 |
| BR-007 | Reject 必須附註原因；ApprovalReason 至少 5 個中文字或至少 10 個英數字，否則 raise DomainException；空白不計，半形 / 全形視覺等價，emoji 算字。 | ApprovalDecision | active | 2026-04-30 |
```

## Step 3 — Lifecycle section

`rules.md` 也新增 Lifecycle 段，記錄 BR 從 feature snapshot finalize 到 BC layer：

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

## Step 3 — 其他 BC layer checks

Dflow 也檢查其他 living docs：

```text
Dflow:
Step 3 其他 BC layer checks：

- models.md：ApprovalDecision Aggregate 已存在
- events.md：ExpenseReportSubmitted / Approved / Rejected 都存在
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
git status
```

為什麼用 `git mv`？

| 做法 | 結果 |
|---|---|
| `mv` + later add | Git 仍可能偵測 rename，但大型 directory diff 可讀性較差。 |
| `git mv` | 明確表達 archive action，rename history / PR diff / `git log --follow` 較清楚。 |

本 tutorial outputs 已經是 final fixture，完成後路徑是：

[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/)

補充：這裡描述的是 Dflow 在真實專案中的 archive 動作；本 tutorial 連到的是已保留的
closeout 後完整文件範例。

## Step 5 — Emit Integration Summary

Dflow 接著產出 Integration Summary。它先說明 audience：

```text
Dflow:
這份 summary 的 audience 是兩群人：

- 團隊內：工程師、reviewer、日後接手 Expense BC 的人
- Stakeholder：PO、Carol 這類試用主管、需要知道這個 feature 到底完成了什麼的人

它不是 commit message template，也不假設 Git Flow、GitHub Flow、squash、rebase 或 merge commit。
你可以把它改寫成 PR description、release note、merge commit message，或貼到團隊同步文件。
```

完整文件範例將 Integration Summary inline 到 completed feature `_index.md`：
[`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md)

### Feature Overview

```markdown
SPEC-20260428-001-employee-submit-expense 交付了 ExpenseTracker 第一個端到端 feature：
員工可以建立、編輯並提交 ExpenseReport，
主管可以對 Submitted 狀態的 ExpenseReport 執行 Approve 或 Reject，
並留下可稽核的 ApprovalDecision。

它建立初始的 Expense Bounded Context，
並驗證第一條從 Aggregate design 到試用回饋的完整 Domain-driven 路徑。
```

### Change Scope

```markdown
| Area | Final State |
|---|---|
| Bounded Context | Expense |
| Phase Count | 2 份 phase specs |
| Lightweight Changes | 2 份 T2 lightweight specs，0 筆 T3 inline changes |
| Aggregates Introduced | ExpenseReport, ApprovalDecision |
| Domain Events Introduced | ExpenseReportSubmitted, ExpenseReportApproved, ExpenseReportRejected |
| Feature Status | 2026-05-07 完成，並已通過 3 天穩定試用 |
```

### Lightweight Changes Summary

```markdown
| Date | Type | Summary |
|---|---|---|
| 2026-04-30 | T2 modify | 將 BR-007 從單一 10 字元門檻放寬為雙語長度驗證。 |
| 2026-05-04 | T2 bug-fix | 修正 reject reason 處理中的 emoji surrogate truncation。 |
```

這是本篇第四個 lesson：**Integration Summary 是 feature story 的壓縮版，不是 Git 操作紀錄。**

它讓日後 reviewer 不必逐一讀兩份 phase spec、兩份 T2 spec 和多個 domain docs，先取得整體脈絡。

## Step 5 — Outstanding / Deferred 與 Sign-off

Integration Summary 也保留 deferred items：

```markdown
### Outstanding / Deferred

- Batch approval：phase 2 已延後；如果重新啟動，請在 features/backlog/ 下建立 follow-up feature。
- Approval notification email：不在 phase 2 範圍。
- Approval SLA timer / escalation：在真實 policy complexity 出現前先不納入範圍。
- Reimbursement BC：approval 穩定後規劃的未來 context。
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
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260428-001-employee-submit-expense/_index.md) | completed status、Phase Specs completed、BR snapshot、Lightweight Changes、Integration Summary、Outstanding / Deferred。 |
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
| Drift verification readiness | Integration Summary、Lifecycle section、Outstanding / Deferred 讓後續 reviewer 能判斷 future changes 是否應開 follow-up。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| active feature 不會關 | 完成後仍留在 active，AI 誤以為可以繼續追加工作。 | status flip + archive 到 completed。 |
| BR system state 漂移 | feature snapshot 已更新，但 BC `rules.md` 還是舊 wording。 | Step 3 sync / reconciliation。 |
| deferred scope 變 dangling question | batch approval、notification、SLA 留在 open question。 | Outstanding / Deferred 明確 disposition。 |
| 完成內容難以溝通 | stakeholder 只能讀 commit 或聊天紀錄。 | Integration Summary inline 到 `_index.md`。 |
| completed feature 被 reopen | 後續 T2/T3 直接塞回 completed directory。 | Resume Pointer 與 Outstanding 明確要求 follow-up feature。 |

## 對不熟 finish-feature 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這個 feature 是否真的可以關？**
   本篇答案是 phase 1 / phase 2 / T2 modify / BUG-001 都完成，試用與 regression tests 通過。

2. **關 feature 時要同步什麼？**
   `_index.md` status、Phase Specs status、BR Snapshot、BC `rules.md`、tech-debt context、Integration Summary。

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
