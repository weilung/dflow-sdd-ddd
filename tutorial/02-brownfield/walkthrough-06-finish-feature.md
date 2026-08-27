# Walkthrough 06 — `/dflow:finish-feature` 收尾第一個 Order feature

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Brownfield track 的 feature closeout：Bob 不再新增規則、不再修
bug，而是把 `SPEC-20260430-001-order-discount-calculation` 這個第一個 Order feature
收束成 completed history。

本篇把 Bob 與 Dflow 的 closeout 對話整理成一份可教學、可 review 的讀物，讓讀者看懂：

- `/dflow:finish-feature` 和 modify / bug-fix 的差異
- closeout 前要驗證 phase spec、baseline-capture row、BUG row、BR Snapshot 與 tech-debt disposition
- 多個 feature 並存於同一個 Order BC 時，BR sync 只同步本 feature owned BR
- 為什麼 SPEC-001 closeout 不會收掉仍 active 的 SPEC-002 VIP feature
- completed feature directory 應使用 `git mv` archive
- Integration Summary 如何把 phase、BUG-001、Domain extraction、tech debt 與 future work 收束在一起

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這一步本身就是
`SPEC-20260430-001` 的 closeout，因此連結的完整文件範例已位於 `features/completed/`。
只讀本篇也能看懂 SPEC-001 如何 closeout；若想看 completed snapshot 的完整讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| feature 什麼時候可以 finish？ | phase 1、baseline capture、BUG-001、regression verification 都已穩定後才 closeout。 |
| finish-feature 會不會改所有 Order BC 文件？ | 會 sync BC layer，但只 reconcile SPEC-001 owned BR-001~004。 |
| 同一個 BC 還有 active feature 怎麼辦？ | BR-005~008 保留給 SPEC-002，不因 SPEC-001 closeout 被刪除或 finalization。 |
| completed feature 還能不能追加 T2 / T3？ | 不能。完成後是 frozen history；未來改動走 follow-up feature。 |
| closeout summary 應該寫什麼？ | 規範的 `Format:` 只有 Feature Goal、Change Scope（`BC` / `Phase Count` / `Lightweight Changes`）、`Related BR-IDs`、Phase List、Next Steps。本篇另外示範團隊自加的補充段落（Domain extraction、tech debt、future considerations）——那些**不在**規範 Format 裡。 |

## 前情提要

Brownfield 劇情到這裡已走完整個第一個 Order feature lifecycle：

1. [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)
   建立 `SPEC-20260430-001-order-discount-calculation`，從 `OrderEntry.aspx.cs`
   抽出第一段 Order Domain logic。
2. [〈Walkthrough 03 — baseline capture 跨頁面折扣顯示行為〉](walkthrough-03-baseline-capture.md)
   baseline-only 捕捉 `OrderList` / `OrderDetail` 跨頁 behavior 與 tech debt。
3. [〈Walkthrough 04 — `/dflow:new-feature` 在既有 Order BC 上新增 VIP discount policy〉](walkthrough-04-new-feature.md)
   建立第二個 Order feature：`SPEC-20260505-002-vip-discount-policy`。
4. [〈Walkthrough 05 — `/dflow:bug-fix` 修正跨頁 rounding inconsistency〉](walkthrough-05-bug-fix.md)
   把 baseline capture 發現的 rounding inconsistency 轉成 `BUG-001` 並規劃修復。

本篇開始時，Bob 已收到 BUG-001 的最後確認：

- `Money.ToDisplay()` 已導入。
- `OrderList` / `OrderEntry` / `OrderDetail` 三頁面都改用同一 display rounding contract。
- regression tests 全綠。
- Carol 重新確認 `#ORD-2026-0512` 類型案例三頁面顯示一致。
- 三天穩定試用沒有新 SPEC-001 blocker。

⚠ **「三天穩定試用」是本範例的驗收訊號，不是 Dflow 的 gate。** `finish-feature-flow.md`
沒有觀察期或天數要求；它檢查的是文件狀態，完成與否由團隊自己的 DoD / sign-off 判定。

同時，`SPEC-20260505-002-vip-discount-policy` 還在 phase 1 implementation。Bob 這次只收
SPEC-001，不收 SPEC-002。

## 劇情背景

2026-05-12 週二上午，Bob 在 AI coding agent 裡輸入：

```text
Bob:
BUG-001 已修完。
OrderList、OrderEntry、OrderDetail 都走 Money.ToDisplay()，
regression tests 全綠，Carol 也確認三頁面顯示一致。
這三天沒有新的 SPEC-001 blocker。

我想只收尾 SPEC-20260430-001-order-discount-calculation。
SPEC-20260505-002-vip-discount-policy 還在 phase 1 implementation，
不要一起收。

/dflow:finish-feature
```

這段輸入的重點不是「我要完成 Order BC」。Bob 說的是：

```text
finish: SPEC-20260430-001-order-discount-calculation
keep active: SPEC-20260505-002-vip-discount-policy
```

這個 scope 很重要。Order BC 是 cumulative state，裡面同時有：

- BR-001~004：SPEC-001 owned，準備 closeout。
- BR-005~008：SPEC-002 owned，仍在 active feature。

`/dflow:finish-feature` 要收的是 feature，不是整個 bounded context。

## 進 Step 1 之前 — Dflow 先說明 finish-feature 的責任

> ⚠ 這一段**不是 Dflow 的流程步驟**。`finish-feature-flow.md` 的步驟從
> `Step 1: Validate Phase Specs and _index.md` 開始，**沒有編號為 Step 0 的步驟**。
> 這裡是進流程前的定位說明。
>
> （別的文件確實有叫 "step 0" 的東西，但兩者性質不同、別混在一起：
> `AI-AGENT-GUIDE.md` § Ceremony Scaling 的 "step 0" 是**分類階段**；
> `pr-review-checklist.md` 的 `Step 0` 則是那份 checklist **真正的第一步，而且強制**
> ——`/dflow:pr-review` 就是從它進入的。兩者都不是**這份**流程的步驟編號。）

Dflow 回應：

```text
Dflow:
收到。這是 /dflow:finish-feature，
也就是 feature lifecycle 的 closeout ceremony。

它和 /dflow:modify-existing、/dflow:bug-fix 不同：
modify / bug-fix 是開啟或承接變更；
finish-feature 是把一個 feature 的規格、BR Snapshot、
BC layer sync 與 archive 收束成 completed history。

本次 scope 明確：

finish: SPEC-20260430-001-order-discount-calculation
keep active: SPEC-20260505-002-vip-discount-policy
```

Dflow 也先界定它不做的事：

```text
Dflow:
我不會 merge、不會 push、不會替你選 Git strategy。
```

這裡對讀者很重要。`finish-feature` 是規格 lifecycle closeout，不是 Git operation
automation。它可以產生 Integration Summary，讓人拿去寫 PR description、merge note
或 release note，但它不替團隊決定 branch / merge / deploy 流程。

這個 flow 會做六件事：

| Step | 目的 |
|---|---|
| Step 1 | Validate phase specs、lightweight rows、BUG rows 與 `_index.md`。 |
| Step 2 | 把 SPEC-001 `_index.md` status flip 成 `completed`。 |
| Step 3 | 把 SPEC-001 Current BR Snapshot sync 到 Order BC layer。 |
| Step 4 | Archive SPEC-001 directory；真實專案用 `git mv`。 |
| Step 5 | Emit Integration Summary。 |
| Step 6 | 若是 follow-up feature，反向更新原 feature；本案 skip。 |

## Step 1 — Validate phase specs and `_index.md`

Dflow 先做 mechanical checks：

```text
Dflow:
Step 1 mechanical checks:

- Feature directory located:
  dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/
- _index.md exists，front matter parsable，seven required sections present
- Phase Specs table has 1 row：phase 1 baseline-and-fix
- Phase 1 implementation status：Bob confirmed done；BR-001~004 tests green
- Lightweight Changes table has 2 rows
- 2026-05-04 baseline-capture row is intentionally no-spec-file；
  它是跨頁 confirmed behavior capture，不需要 archive 成獨立 spec
- 2026-05-08 T2 BUG row links to BUG-001-rounding-inconsistency.md
- BUG-001 implementation status：Bob confirmed done；
  三頁面 rounding regression tests green
- Current BR Snapshot is non-empty and contains BR-001~004, all active
- Minor drift disposed：
  Resume Pointer 仍寫 BUG-001 是 next action，
  但 Bob 已確認 BUG-001 shipped；Step 2 會改成 closeout 進行中的 pointer，
  終局值等 Step 4 歸檔那一刻才寫
```

這些檢查不是形式主義。它們回答 closeout 前最容易出錯的問題：

| 檢查 | 防止的錯誤 |
|---|---|
| phase spec status | phase 還沒做完就 archive。 |
| baseline-capture row | 沒有 spec file 的 row 被誤判為遺漏。 |
| BUG row link | bug spec 遺失或沒有被 feature dashboard 收到。 |
| Current BR Snapshot | feature 沒有可同步到 BC layer 的 final rule state。 |
| Resume Pointer | completed feature 還叫下一個人去做已完成的 BUG。 |

## Step 1 — Closeout driftcheck

Dflow 接著跑 closeout driftcheck：

```text
Dflow:
這不是重新推導所有 BR；
_index.md Current BR Snapshot 是 SPEC-001 的 feature-level truth。
這裡確認它和 Order BC layer 沒有機械 drift。
```

結果：

```text
Dflow:
Driftcheck result:

- BR-001~004 all exist in dflow/specs/domain/Order/rules.md
- BR-001~004 all have scenario sections in dflow/specs/domain/Order/behavior.md
- behavior.md 保留段 3 的 Confirmed across pages (baseline-capture 2026-05-04)，
  沒有在 BUG-001 closeout 時刪掉歷史
- Order Aggregate Root、OrderLine Entity、Money / Quantity / DiscountRate VO、
  DiscountPolicy Domain Service all exist in models.md
- tech-debt.md rounding inconsistency entry is resolved by SPEC-20260430-001 BUG-001
- tech-debt.md isVip multiplier 0.93 entry is already resolved by SPEC-002 disposition；
  不是 SPEC-001 closeout scope
- rules.md also contains BR-005~008。
  這些屬於 in-progress SPEC-20260505-002，不是本次 finish target
```

這是本篇第一個 key lesson：**finish-feature 要檢查整個 feature trail，
但不能因此接管其他 active feature。**

`rules.md` 裡看到 BR-005~008，不代表 SPEC-001 要管它們。它只代表 Order BC 正在有第二個
active feature 演進。

Dflow 停下來：

```text
Dflow:
Step 1 validation passes。
Ready to flip SPEC-001 status to completed?
/dflow:next to proceed.
```

Bob：

```text
Bob:
/dflow:next
```

## Step 2 — Flip `_index.md` status to completed

Dflow 更新 SPEC-001 dashboard：

```text
Dflow:
Step 2：Flip _index.md Status to completed。

我會更新 SPEC-001 dashboard：

- front matter status: in-progress -> status: completed
  （只翻 status。branch: 不改寫，也不新增 front matter 欄位——關帳後的驗證
   會把「沒有任何步驟要求的差異」判成 edit fallout 並擋下來。）
- Phase Specs table：不動。phase 1 早在 Step 1 就必須已經是 completed，
  那是通過條件，不是這一步的工作。
- Lightweight Changes：05-08 那列的 Commit 欄會在 Step 4 回填
  （05-04 那列早在 05-08 的 commit 就填好了）。
- Resume Pointer 改成**誠實的進行中值**（兩行散文 ＋ 四個 cursor 欄位，六行都要寫；
  終局值等 Step 4 才寫）：
  Current Progress: status 已翻成 completed（2026-05-12）；closeout 進行中
  Next Action:      繼續 closeout——把 Current BR Snapshot sync 到 BC layer（Step 3）
  Active Workflow:  finish-feature
  Current Step:     Step 3 — sync BR Snapshot to BC layer
  Gates Passed:     1→2
  Awaiting:         none (mid-step)
```

⚠ **這裡不可以寫 `none`。** closeout 自己還沒跑完——Step 3、Step 4 都還在前面，
而 gate 3 → 4 是真的 step gate。在這一步就宣告 `Active Workflow: none`，然後 flow
還要在 gate 3 → 4 叫 Bob 打 `/dflow:next`——那正是 `AI-AGENT-GUIDE.md` 規定
「沒有 active workflow 時必須拒絕」的指令。
⚠ **`Awaiting` 寫 `none (mid-step)`，不要寫 `gate 3→4`**：Step 3 還沒跑，寫成 gate
會讓接手的 session 直接打 `/dflow:next`，**整個 BC sync 被跳過**。

完整文件範例的 front matter：

```yaml
---
spec-id: SPEC-20260430-001
slug: order-discount-calculation
status: completed
created: 2026-04-30
branch: feature/SPEC-20260430-001-order-discount-calculation
---
```

⚠ **只有 `status` 變了。** front matter 沒有 `completed_date` 這種欄位——
`templates/_index.md` 沒定義它，Step 2 也沒有命令寫它，而關帳後的驗證要求 commit 進去的
`_index.md` 與 Step 1 讀到的差異**恰好**等於 Step 2、Step 4 的終局 cursor 寫入、
與 Step 4 指令 1 命令的那些。
完成日期不必另存一格：closeout commit 自己就是時間戳。

Phase Specs table：

```markdown
| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-04-30 | baseline-and-fix | completed | [phase-spec-2026-04-30-baseline-and-fix.md](./phase-spec-2026-04-30-baseline-and-fix.md) |
```

Lightweight Changes：

```markdown
| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-04 | baseline | Baseline-only capture：已補 `OrderList.aspx.cs` 與 `OrderDetail.aspx.cs` 的跨頁 confirmed behavior，詳見 [`behavior.md`](../../../domain/Order/behavior.md#confirmed-across-pages-baseline-capture-2026-05-04)；新發現的 rounding / `isVip` debt 已記錄於 [`tech-debt.md`](../../../migration/tech-debt.md)。本 row 無對應 spec 檔。 | c58d213 |
| 2026-05-08 | T2 | Bug-fix: 修正 `OrderList` / `OrderEntry` / `OrderDetail` 跨頁 display rounding inconsistency，見 [`BUG-001-rounding-inconsistency.md`](./BUG-001-rounding-inconsistency.md)。 | 9f2e470 |
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)

這一步不是只改 status。它也把 reader 的 resume point 從「下一步做 BUG-001」
改成「closeout 進行中，下一步是 Step 3 的 BC sync」。
⚠ **不是**改成「feature 已完成」——那是**終局值**，closeout 還沒跑完，
它要等 Step 4 歸檔那一刻才寫（見下面 Step 4）。

## Step 3 — Sync BR Snapshot to BC layer

Dflow 說明本段最重要的 cross-feature rule：

```text
Dflow:
Step 3 是本段的重點：
多 feature 並存於同一個 Order BC 時，
finish-feature 不能把整個 rules.md 當成單一 feature 的私有檔案。

現況是：

- SPEC-001 _index.md Current BR Snapshot contains BR-001~004。
- Order BC rules.md 已含 BR-001~008。
- BR-001~004 由 SPEC-001 owned。
- BR-005~008 由 in-progress SPEC-002 owned。

所以 Step 3 sync 動作只 reconcile BR-001~004。
BR-005~008 保留不動，
不能因為 SPEC-001 closeout 就刪掉、重排或改 wording。
```

Bob 確認他的理解：

```text
Bob:
也就是 rules.md 是 Order BC 的 cumulative state，
不是 SPEC-001 的私有 snapshot。
SPEC-001 finish 時只同步自己那四條。
```

Dflow 回答：

```text
Dflow:
對。這是 cross-feature reconciliation 的規則：

- Single feature _index.md = feature-level current state。
- dflow/specs/domain/Order/rules.md = BC-level cumulative state。
- finish-feature 只把本次 completed feature 的 owned BR reconcile 到 BC layer。
- 其他 active feature 的 BR 保留，
  因為它們代表 Order BC 目前正在演進的 in-progress state。
```

這是本篇第二個 key lesson：**BC docs 是 cumulative truth，不是 feature 私有檔。**

### BR sync result

Dflow 的 sync result：

```text
Dflow:
本案 sync result：

- BR-001：already exists；wording matches SPEC-001 snapshot
- BR-002：already exists；補齊 price multiplier 0.9，對齊 SPEC-001 snapshot
- BR-003：already exists；補齊 price multiplier 0.95，對齊 SPEC-001 snapshot
- BR-004：already exists；補齊 total discount rate formula，對齊 SPEC-001 snapshot
- BR-005~008：not touched；仍 owned by SPEC-002
```

⚠ **接下來這兩段 `Lifecycle` 是 Bob 團隊自訂的，Dflow 不會產生。** `rules.md` /
`behavior.md` 範本裡沒有 `Lifecycle` 段，`finish-feature-flow.md` Step 3 也沒有要求
建立它——Step 3 對 `rules.md` 的規定只有「增 / 改 / 刪 BR 段」與「更新 Rule Index 的
`Last updated`」。留在本篇是因為多 feature 並存時，「哪些 BR 還屬於別的 active feature」
確實需要一個記錄面；**但這一步要團隊自己補**。

`rules.md` 完整文件範例包含團隊自加的 Lifecycle：

```markdown
## Lifecycle

- BR-001~004 finalized as of 2026-05-12 from `SPEC-20260430-001-order-discount-calculation` completion.
- BR-005~008 are owned by `SPEC-20260505-002-vip-discount-policy` and remain active while that feature is still in progress.
- 多 feature 並存於 Order BC 時，`rules.md` 是 cross-feature cumulative state；`/dflow:finish-feature` 只 reconcile 本次 completed feature owned BR，不覆寫其他 active feature 的 BR。
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)

這個 Lifecycle note 的價值很高——未來 reviewer 看見 BR-005~008 仍在 `rules.md` 時，
不會誤以為 SPEC-001 closeout 漏了它們；它們只是屬於另一個 active feature。
**價值高不等於 Dflow 會做**：這是團隊自己維護的一段，closeout 時要記得手動更新。

### `behavior.md` lifecycle note

Bob 特別問：

```text
Bob:
behavior.md 呢？
段 3 baseline-capture 留下的 confirmed across pages 段要保留。
```

Dflow 回：

```text
Dflow:
會保留。

- BR-001~004 phase 1 scenarios already exist。
- 段 3 Confirmed across pages (baseline-capture 2026-05-04)
  保留作 accepted cross-page behavior history。
- 新增 lifecycle note，說明 BR-001~004 由 SPEC-001 completion finalized。
- BR-005~008 的 VIP behavior sections 保留，
  因為 Order BC 文件是 cumulative，
  但它們仍由 SPEC-002 owned，未由本次 closeout finalized。
```

`behavior.md` 完整文件範例 lifecycle note：

```markdown
## Lifecycle Notes

- BR-001~004 finalized on 2026-05-12 by `SPEC-20260430-001-order-discount-calculation` completion.
- Baseline-capture scenarios remain here as accepted cross-page behavior history; do not delete them during SPEC-001 archive.
- BR-005~008 remain owned by in-progress `SPEC-20260505-002-vip-discount-policy`; their behavior sections stay in this cumulative Order BC document but are not finalized by SPEC-001 closeout.
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md)

這是本篇第三個 key lesson：**archive feature 不等於刪掉已接受的 behavior history。**

Baseline-capture row 沒有獨立 spec file，但它的 confirmed behavior 已經被 system-level
`behavior.md` 接住，closeout 時要確認它還在。

### Tech-debt sweep

Dflow 也做 tech-debt sweep：

```text
Dflow:
Step 3 tech-debt sweep：

- OrderList / OrderEntry / OrderDetail rounding 策略不一致 remains resolved by BUG-001。
- OrderList isVip multiplier 0.93 remains resolved by SPEC-002 disposition。
- Order 折扣規則分散在多個頁面 標註 partially resolved：
  三個已知頁面的 rounding contract 已統一，
  但其他 Order 頁面尚未抽離，所以 status stays open。
- OrderEntry event handler 仍混合資料存取與流程控制 stays open。
- DiscountPolicy 結構可能需要演進 stays open。
- 其他 brownfield baseline tech-debt stays open。
```

`tech-debt.md` 完整文件範例的 closeout note：

```markdown
- `Order 折扣規則分散在多個頁面` disposition: 2026-05-12 `SPEC-20260430-001` closeout 時確認為 partially resolved；三個已知頁面的 rounding contract 已統一，但跨全部 Order 頁面的業務邏輯抽離仍 open。
- `OrderList / OrderEntry / OrderDetail rounding 策略不一致` disposition: 2026-05-08 歸屬 `SPEC-20260430-001` 的 `BUG-001-rounding-inconsistency.md`；修正方向為 `Money.ToDisplay()` display contract + 三頁面 Presentation 層統一呼叫。
- `OrderList isVip multiplier 0.93` 已由 Daniel 於 2026-05-05 確認為五年前促銷殘留；清理歸屬 `SPEC-20260505-002` phase 1 implementation task。
```

完整文件範例：
[`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

這裡有一個細節：rounding inconsistency resolved，不代表「Order 折扣規則分散在多頁面」
整體 debt resolved。三個已知頁面 display contract 統一了，但其他 Order 頁面仍可能
還有未抽離的邏輯，所以該 broader item 保持 open。

## Step 4 — Archive feature directory

Bob 確認後，Dflow 進入 archive：

```text
Bob:
/dflow:next
```

Dflow 說明真實專案應用 `git mv`：

```text
Dflow:
Step 4：Archive feature directory。

真實專案我會用這個命令，不用 plain mv：

git mv dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation \
       dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation

git mv 讓 Git 更容易保留 directory rename history，
改善 git log --follow、git blame 與 PR diff。
```

Archive scope：

```text
Move:
dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation

Do not move:
dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy
```

### `git mv` 之後緊接著寫終局 cursor

`git mv` 一做完，host 就從 `active/` 進了 `completed/`，而 `/dflow:status` 只掃
`active/`。從這一刻起，**沒有任何全域掃描讀得到這個 cursor 了**。終局值就寫在這裡：

```text
Dflow:
Step 4：寫入 Resume Pointer 終局值（緊接 git mv，中間不插任何等待點）。

Current Progress: feature completed 2026-05-12；phase 1 與 BUG-001 均已上線
                  並通過 regression verification
Next Action:      integration —— 依 _conventions.md 選定的 Git policy
                  做 push / merge / PR
Active Workflow:  none
Current Step:     n/a
Gates Passed:     n/a
Awaiting:         none
```

⚠ **`Next Action` 寫的是 integration，不是「closeout complete」。** 此刻 Step 5
的整合工作**還沒做**，cursor 要指向下一個真的要發生的動作。flow 的終局範本就是這個值。
後續改動要開 follow-up feature 這件事仍然成立，但那是整合完成之後的事。

⚠ **注意這裡沒有 `git status`。** rename 檢查要排在終局 cursor 寫完**之後** ——
`git mv` 與這次寫入之間不放任何東西：

```text
Dflow:
git status --short   # 確認 rename 被偵測到，並看 RM —— rename 旁邊的 M
                     # 代表有未 stage 的編輯（就是剛寫的 cursor），commit 前要
                     # git add。⚠ 一定要 --short：預設的長格式會把 rename 與
                     # modification 分兩段列，永遠不會印出 RM 這個雙欄狀態碼。
```

⚠⚠ **中間隔一個等待點就會開一個窗口。** `git mv` 與這次寫入之間如果插進「要現在
commit 嗎？」的 Y／N 提示，就會出現一段「host 已在 `completed/`、cursor 卻還宣告
`finish-feature` 進行中」的狀態——`/dflow:cancel` 會在那裡生效。所以 flow 把這兩件事
定義成**不可中斷的一對**。

⚠ **寫下去之後 closeout 就不再動這個 cursor**：commit 被拒（N）、commit 失敗、
post-commit 驗證 `✗`，三條路都一樣，**不要還原成進行中值**。`git mv` 已經把 host
移出 `active/`，還原 cursor 買不回「`/dflow:status` 找得到它」。收尾在這之後失敗時，
看得見它的是 `git status`——staged 的 rename 加上未 commit 的 `_index.md` 改動。

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/)

仍 active 的 SPEC-002：
[`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md)

這是本篇第四個 key lesson：**completed feature 被 archive，但同 BC 的其他 active feature
不會一起移動。**

### Step 4 還做了一件容易被忽略的事：回填 `Commit` 格

`git mv` 不是 Step 4 的全部。同一次編輯裡，Dflow 要把 Lightweight Changes 表上還沒填的
`Commit` 格補起來：

```text
Dflow:
Step 4 指令 1: 回填未填的 hosted Commit 格。

| Date | Tier | Description | Commit |
|---|---|---|---|
| 2026-05-04 | baseline | Baseline-only capture：已補 `OrderList.aspx.cs` 與 `OrderDetail.aspx.cs` 的跨頁 confirmed behavior，詳見 [`behavior.md`](../../../domain/Order/behavior.md#confirmed-across-pages-baseline-capture-2026-05-04)；新發現的 rounding / `isVip` debt 已記錄於 [`tech-debt.md`](../../../migration/tech-debt.md)。本 row 無對應 spec 檔。 | c58d213 |
| 2026-05-08 | T2 | Bug-fix: 修正 `OrderList` / `OrderEntry` / `OrderDetail` 跨頁 display rounding inconsistency，見 [`BUG-001-rounding-inconsistency.md`](./BUG-001-rounding-inconsistency.md)。 | 9f2e470 |

第一列的 `Commit` 早在 05-08 那次 commit 就回填過了，這次不動；
**本次回填的是第二列的 `9f2e470`**。
兩格寫的都是「那一列自己的 commit」，不是 closeout 這個 commit 的 hash。
```

**為什麼 05-08 那列到現在才填？** 因為一列的 hash 不可能由它自己那個 commit 寫進去——
commit 還沒發生就沒有 hash，commit 發生後檔案已經定版。所以 hosted row 一律由 host 的
**下一個** commit 回填：05-04 那列等到的是 05-08 的 commit（所以它早就填好了），而
05-08 那列之後沒有新的 phase，**closeout 就是它等的那個「下一個 commit」**。

**沒有下一次了，所以這裡漏掉就永遠是空的。** 這是 Step 4 把回填寫成指令而不是建議的原因；
`references/pr-review-checklist.md` 也在 PR 端再檢一次每一格是否**解得開**——不是「非空就
算數」，`n/a - spec capture only` 這種說明文字是非空的，卻什麼也不是。

## Step 5 — Emit Integration Summary

> ⚠ **本篇壓縮掉了 Step 5 的第一件事，但它必須先發生。** flow 規定
> 「**First, print the closeout verification's derivation.**」——在摘要之前，先說明
> Step 4 的 post-commit 驗證**是怎麼算出來的**（baseline、逐項差異各由哪一步指示、
> 接受了哪些外部路徑、以及有什麼是它判定不了、該由誰承擔）。那是一次真實驗證的推導
> 結果，本教材不編造它；完整規定見 `finish-feature-flow.md` 的 Step 5 開頭。

Dflow 產出 Integration Summary。這份 summary 是 git-strategy-neutral 的 closeout
reference，可以改寫成 PR description、release note、merge note 或團隊同步文件；
它不是 commit message template。

Bob 問：

```text
Bob:
這份 summary 也 inline 到 completed _index.md，對嗎？
```

Dflow 回：

```text
Dflow:
不對。finish-feature-flow Step 5 的原文是
「Print the summary to the conversation; do not write it to a file
 (it is ephemeral closeout output)」。

但要講清楚：這是明文指示，不是 gate。
Step 1 檢查的是七個必要段落都在，不是「不准有別的」；
關帳後的驗證比的是「Step 1 讀到的東西有沒有被改動」，
所以一段一直都在、closeout 也沒動過的 Integration Summary 不會被擋。
何況 Step 5 跑在 Step 4 的 commit 與那道驗證之後，
這時寫進檔案的東西不在那個 commit 裡，closeout 自己的檢查都看不到它。

但「closeout 看不到」不等於「沒人看得到」：
pr-review-checklist.md 有一項
「Integration Summary was emitted to the conversation
 (not written to a file — it's ephemeral)」。
而且 Step 5 明寫這時 host 已歸檔凍結、不得再改 archived _index.md。

我不寫進檔案，理由是 Step 5 這麼說，不是因為不這麼做會被擋。
這份 summary 的去處是 PR description、release note、
merge note 或團隊同步文件——那才是它要服務的讀者。
```

下面是**印在對話裡**的摘要。brownfield `finish-feature-flow.md` Step 5 有一個
`Format:` 區塊逐欄規定它的形狀，這裡就是照它印的：

```text
== Integration Summary: SPEC-20260430-001-order-discount-calculation ==

Feature Goal: 建立 Order BC 的第一個正式修改入口，處理經銷商「華昕貿易」回報的訂單
折扣計算錯誤：滿 NT$50,000 的 9 折與老客戶額外 5% off 必須依業務期望累積，而不是
只套用滿額折扣。

Change Scope:
- BC: Order
- Phase Count: 1 (phase-spec-2026-04-30-baseline-and-fix)
- Lightweight Changes: 1 T2 lightweight specs + 0 T3 inline rows + 1 baseline rows

Related BR-IDs (post-closeout state):
- ADDED: BR-001, BR-002, BR-003, BR-004
- MODIFIED: none
- REMOVED: none

Phase List:
- phase-1 (2026-04-30): baseline-and-fix — Capture OrderEntry.aspx.cs baseline、
  修正 Senior + full-threshold compound discount bug，並把折扣計算抽到
  src/Domain/Order/。

Next Steps (developer) — Integration / PR gate (needs network):
- Per the selected Git policy (`gitflow` / `trunk` in `_conventions.md`), choose
  a merge strategy (merge commit / squash / rebase / fast-forward) and execute
- Push to remote / open a PR — the AI can run `git push` / `gh pr create` for
  you, but only when you explicitly ask; it never pushes on its own
```

⚠⚠ **注意這裡沒有 `Aggregates affected:`，也沒有 `Domain Events Changes:`。**
那兩欄是 **Greenfield** Integration Summary 才有的；brownfield 的 `Format:` 區塊
沒有定義它們——不是「這次剛好沒有」，是這一軌的格式裡根本沒有這兩欄。**把 Greenfield 的欄位抄進 Brownfield 摘要，是這條軌上最容易犯的錯**——
walkthrough 07 有一整段在講它。

⚠ **那不代表 Domain extraction 的內容可以塞進 `Feature Goal:`。** 那一欄的來源
規範寫死了：**`{1-2 sentences from _index.md Goals & Scope}`**——照抄 host 自己的
Goals & Scope，不是改寫成 Aggregate / VO 清單。抽出來的 Domain model 清單留在摘要
**之外**（見下方「走查補充」），brownfield 的摘要本來就不報告它。

**`Related BR-IDs` 這一欄不要拿上面 Step 3 的 sync 結果去反推。** flow 在兩軌的
Step 3、Step 5 與 `Git-principles-*` scaffolding 都寫了同一句：

> **`Related BR-IDs` is not one of those**: it reports what this change's own
> record carries, **not what was synced**

「那一組」指的是 `BC` 這類**報告有沒有做 sync** 的欄；`Related BR-IDs` 不屬於它們。
值要去這個 host 自己的 `_index.md` Current BR Snapshot 拿——本 feature 四列的
`First Seen (phase)` 都是 `phase-1`，沒有一列是 `inherited from rules.md`，所以是
`ADDED: BR-001…BR-004 / MODIFIED: none`。

Step 3 印的「already exists；補齊 price multiplier」講的是 `rules.md` 那一邊的動作，
跟這一欄是兩件事。

還有一欄是 brownfield 特有的：`Lightweight Changes` 的計數多了
**`+ {n_baseline} baseline rows`**。本 feature 是 `1 T2 + 0 T3 + 1 baseline`——
那個 baseline row 就是 2026-05-04 那次 baseline-only capture，它沒有對應的 spec 檔，
但仍要計入。

BR 的最終條文（**這是本篇為了教學附上的，`Format:` 沒有這一段**）：

```markdown
| BR-ID | Final Rule |
|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off（price multiplier 0.9）。 |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off（price multiplier 0.95）。 |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 |
```

**這個 feature 抽出來的 Domain model**（走查補充，**不是摘要的欄位**——
brownfield 的 `Format:` 沒有 `Aggregates affected:`，而 `Feature Goal:` 的來源規範
寫死是 `_index.md` 的 Goals & Scope，所以**這份清單在摘要裡沒有任何欄位承載它**。
它只存在於走查，供讀者理解這個 feature 做了什麼）：

- Aggregate Root: `Order`
- Entity: `OrderLine`
- Value Objects: `Money`, `Quantity`, `DiscountRate`
- Domain Service: `DiscountPolicy`
- WebForms adapter boundary: `OrderEntry.aspx.cs` 保留 UI parsing、EF mapping 與 DB write；
  Domain layer 不 reference `System.Web`、EF DbContext、ViewState 或 Session。

至於 Domain Events：本 WebForms brownfield feature 不引入——所以就算格式裡有那一欄，
這次也會是空的。**但要記得上面那件事：brownfield 的格式本來就沒有那一欄**，
兩者是不同的理由，不要混成一個。

Tech Debt Outstanding（同樣是走查補充，`Format:` 沒有這一段）：

```markdown
- OrderList / OrderEntry / OrderDetail rounding 策略不一致: resolved by BUG-001，
  三頁面改用 Money.ToDisplay() display contract。
- OrderList isVip multiplier 0.93 規則來源不明: resolved by SPEC-20260505-002 disposition，
  業務確認為 dead code。
- Order 折扣規則分散在多個頁面: partially resolved。OrderEntry / OrderList / OrderDetail
  rounding contract 已統一，但其他 Order 頁面尚未抽離。
- OrderEntry event handler 仍混合資料存取與流程控制: open。
- DiscountPolicy 結構可能需要演進: open。
- 其他 brownfield baseline tech-debt remains open: 業務邏輯散在 Code-Behind、
  缺少 unit test coverage、Stored Procedures 重 join 難維護、
  .NET Core migration long-term goal 未拆小步、無 Dependency Injection 組態。
```

Sign-off：

```markdown
- Bob verified phase 1 Domain extraction and BUG-001 implementation completion on 2026-05-12。
- Regression tests verified BR-001~004 and rounding consistency across
  OrderList / OrderEntry / OrderDetail。
- Carol verified #ORD-2026-0512 類型案例三頁面顯示一致。
- 試用主管群三天穩定試用，未回報新的 SPEC-001 blocker。
```

歸檔後的檔案長什麼樣：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)
——七個必要段落（含 Metadata front matter 與 Checkpoint Log），**沒有** Integration Summary 段。上面這些都在對話裡。

這份 summary 的價值在於：讀者不必回頭重讀 02、03、05 才知道這個 feature 做了什麼。
它把 phase、baseline-only row、BUG-001、Domain extraction、tech debt、future work
收成一個 closeout reference。

## Step 5 — Outstanding / Future Considerations

Integration Summary 也記錄未來工作：

```markdown
### Outstanding / Future Considerations

- `SPEC-20260505-002-vip-discount-policy` remains `in-progress` under `features/active/`；本次 closeout 不同步 BR-005~008，也不搬動 SPEC-002。
- 後續 phase 候選：抽離 `OrderEntry.aspx.cs` 剩餘約 50 行 EF query / UI parsing / 狀態設定流程。
- 後續 phase 候選：建立 Order status machine，讓訂單狀態轉換從 WebForms event handler 移到 Domain / application-facing boundary。
- 後續 feature 候選：Customer BC 正式建立，承接 VIP eligibility、合約維護與 Customer reference data owner。
- 本 feature 已完成並凍結；若未來要修正 BR-001~004 或 rounding-related behavior，請走 `/dflow:modify-existing`，建立 follow-up feature，不直接追加 T2/T3 到本 directory。
```

這段把 completed feature 的邊界講清楚：

- SPEC-001 完成。
- SPEC-002 繼續 active。
- 未來 work 可以接續，但不是直接把新東西追加到 completed directory。

## Step 6 — Reverse-update follow-up tracking

Dflow 最後跑 Step 6：

```text
Dflow:
Step 6：Reverse-Update Follow-up Tracking：skip。

跳過理由：
SPEC-20260430-001-order-discount-calculation 沒有 follow-up-of metadata。
它不是從某個 completed feature 派生出來的 follow-up feature，
所以沒有原 feature 的 Follow-up Tracking row 需要反向更新。

/dflow:finish-feature complete for SPEC-20260430-001-order-discount-calculation。

Feature directory is now at：

dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/

SPEC-20260505-002-vip-discount-policy remains active.
```

Bob 收尾：

```text
Bob:
好。SPEC-002 VIP feature 仍在 phase 1 implementation，預計本週末上線；
下週可能對 SPEC-002 也跑 finish-feature。
Order BC 整體 modernization 還有很長的路，
但這是第一個 SDD-driven 完整循環，
已經證明 brownfield 漸進抽離可行。
```

這是本篇第五個 key lesson：**finish-feature 不是 modernization 結束，
而是一個可驗證增量的結束。**

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 移動 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/) | SPEC-001 從 active archive 到 completed 的完整文件範例。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md) | completed status（只翻 `status`）、Resume Pointer 終局狀態、Checkpoint Log 的 closeout 列、Lightweight Changes 回填的兩個 `Commit` 格。⚠ Integration Summary **不寫進檔案**，見 Step 5。 |
| 保留 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md) | phase 1 frozen history；closeout 不重寫 inline phase content。 |
| 保留 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md) | BUG-001 frozen history；closeout 只在 `_index.md` 彙整。 |
| 修改 | [`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md) | BR-001~004 finalized lifecycle note；BR-005~008 preserved for active SPEC-002。 |
| 修改 | [`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md) | baseline-capture behavior 保留；BR-005~008 behavior 保留但未由 SPEC-001 finalized。 |
| 修改 | [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | rounding debt resolved、multi-page discount debt partially resolved、remaining brownfield debt retained。 |
| 故意不改 | [`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md) | SPEC-002 仍 active，不在本 closeout scope。 |
| 故意不改 | `outputs/dflow/specs/domain/Order/context.md` / `models.md` | closeout 沒有新增 Domain model 或 context boundary。 |
| 故意不改 | `outputs/dflow/specs/domain/glossary.md` / `context-map.md` | closeout 沒有新增 ubiquitous language 或 BC relationship。 |

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Brownfield track | 完成第一個 WebForms 漸進抽離循環，而不是宣告整個系統重寫完成。 |
| Spec-first development | feature 完成前先驗證 phase spec、BUG spec、BR snapshot、domain docs、tech debt disposition。 |
| Hybrid workflow control | `/dflow:finish-feature` 不改 code，而是執行 lifecycle closeout ceremony。 |
| DDD semantic backbone | Order BC cumulative docs 保留 BR ownership 與 cross-feature lifecycle notes。 |
| 三層文件分工 | completed feature `_index.md`、BC-level `rules.md` / `behavior.md`、migration `tech-debt.md` 各自同步。 |
| Drift verification readiness | closeout driftcheck 確認 BR-001~004、behavior scenarios、models、tech debt disposition 都可追。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| feature 永遠 active | phase 做完、bug 修完後沒人 closeout，下一個人不知道狀態。 | `_index.md` status completed，Resume Pointer 改成 closeout state。 |
| active feature 互相污染 | finish SPEC-001 時順手改掉或歸檔 SPEC-002。 | Step 3 / Step 4 明確 preserve BR-005~008 與 active SPEC-002。 |
| BC docs 被單一 feature 覆寫 | 用 SPEC-001 snapshot 重寫整個 `rules.md`，刪掉 BR-005~008。 | 只 reconcile owned BR-001~004，`rules.md` 保持 cumulative state。 |
| baseline history 遺失 | archive 時刪掉 baseline-capture confirmed behavior。 | driftcheck 確認 `behavior.md` baseline-capture section 保留。 |
| completed feature 繼續被追加 | 後續小修直接塞回 completed directory。 | Outstanding section 明示未來變更走 follow-up feature。 |

## 對不熟 finish-feature 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這個 feature 是否真的完成？**
   本篇答案是 phase 1、baseline-capture row、BUG-001 implementation、regression verification
   都已確認。

2. **哪些 BR 屬於這次 closeout？**
   本篇答案是 BR-001~004。BR-005~008 屬於 SPEC-002，不由 SPEC-001 finalized。

3. **系統層文件要同步什麼？**
   本篇答案是 `rules.md` lifecycle、`behavior.md` lifecycle、`tech-debt.md` disposition，
   以及 closeout 印出的 Integration Summary（在對話裡，不在 `_index.md`）。

4. **完成後還能不能直接改 completed feature？**
   本篇答案是不能。未來改動要走 `/dflow:modify-existing` 或 follow-up feature。

Finish-feature 的價值不是多寫一份 summary，而是替下一輪變更建立乾淨邊界：
什麼已完成、什麼仍 active、什麼是 future work、什麼不能再回頭偷改。

## Key takeaways

- `/dflow:finish-feature` 是 lifecycle closeout，不是 Git merge / push automation。
- Closeout 要驗證 phase specs、baseline-capture rows、BUG rows、BR Snapshot、domain docs 與 tech-debt disposition。
- 多 feature 並存於同一 BC 時，只 sync completed feature owned BR；其他 active feature BR 保留。
- `rules.md` / `behavior.md` 是 BC-level cumulative truth，不能被單一 feature snapshot 覆寫。
- Completed feature 是 frozen history；後續變更必須走 follow-up feature 或新的 active feature。
- Integration Summary 的規範欄位是 Feature Goal、Change Scope（`BC` / `Phase Count` / `Lightweight Changes`）、`Related BR-IDs`、Phase List 與 Next Steps，而且 flow 明寫它只印到對話、不寫進檔案。本篇示範的 Domain extraction、tech debt outstanding 與 future considerations 是**團隊自加的補充**，不是規範要求的欄位。

## Brownfield 劇情收尾

到這裡，Brownfield 劇情 2 的第一個完整 SDD-driven cycle 已完成：

- `dflow init` 建立 brownfield baseline。
- `/dflow:modify-existing` 從 WebForms 客訴進入，升級成第一個 Order feature。
- baseline-only path 捕捉跨頁 behavior 與 tech debt。
- `/dflow:new-feature` 在同一 Order BC 上新增第二個 VIP feature。
- `/dflow:bug-fix` 把已知 rounding debt 轉成 BUG-001 並修正。
- `/dflow:finish-feature` 收尾 SPEC-001，留下 completed history 與 future work。

下一步不是把整個 legacy 系統一次重寫，而是繼續用同樣節奏處理下一個可驗證增量。
`SPEC-20260505-002-vip-discount-policy` 仍在 active，未來可以在 implementation 穩定後獨立
跑自己的 `/dflow:finish-feature`。
