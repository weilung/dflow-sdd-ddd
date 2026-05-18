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
| closeout summary 應該寫什麼？ | Feature overview、phase summary、lightweight changes、BR final state、tech debt outstanding、future considerations。 |

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

## Step 0 — Dflow 先說明 finish-feature 的責任

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
- _index.md exists，front matter parsable，six required sections present
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
  但 Bob 已確認 BUG-001 shipped；Step 2 會改成 closeout pointer
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
- add completed_date: 2026-05-12
- Phase Specs table：phase 1 baseline-and-fix 標為 completed
- Lightweight Changes：BUG-001 row 標示已在 closeout 前 implement
- Resume Pointer 改成 closeout 訊息：
  feature completed；see Integration Summary below
```

完整文件範例的 front matter：

```yaml
---
spec-id: SPEC-20260430-001
slug: order-discount-calculation
status: completed
created: 2026-04-30
completed_date: 2026-05-12
branch: feature/SPEC-20260430-001-order-discount-calculation
---
```

Phase Specs table：

```markdown
| Phase | Date | Slug | Status | File Link |
|---|---|---|---|---|
| 1 | 2026-04-30 | baseline-and-fix | completed | [phase-spec-2026-04-30-baseline-and-fix.md](./phase-spec-2026-04-30-baseline-and-fix.md) |
```

Lightweight Changes：

```markdown
| Date | Type | Description | Commit |
|---|---|---|---|
| 2026-05-04 | baseline-capture | Baseline-only capture：已補 `OrderList.aspx.cs` 與 `OrderDetail.aspx.cs` 的跨頁 confirmed behavior，詳見 [`behavior.md`](../../../domain/Order/behavior.md#confirmed-across-pages-baseline-capture-2026-05-04)；新發現的 rounding / `isVip` debt 已記錄於 [`tech-debt.md`](../../../migration/tech-debt.md)。本 row 無對應 spec 檔。 | n/a - spec capture only |
| 2026-05-08 | T2 | Bug-fix: 修正 `OrderList` / `OrderEntry` / `OrderDetail` 跨頁 display rounding inconsistency，見 [`BUG-001-rounding-inconsistency.md`](./BUG-001-rounding-inconsistency.md)。 | n/a - implemented before closeout |
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)

這一步不是只改 status。它也把 reader 的 resume point 從「下一步做 BUG-001」
改成「feature 已完成，後續改動請建立 follow-up feature」。

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

`rules.md` 完整文件範例包含 Lifecycle：

```markdown
## Lifecycle

- BR-001~004 finalized as of 2026-05-12 from `SPEC-20260430-001-order-discount-calculation` completion.
- BR-005~008 are owned by `SPEC-20260505-002-vip-discount-policy` and remain active while that feature is still in progress.
- 多 feature 並存於 Order BC 時，`rules.md` 是 cross-feature cumulative state；`/dflow:finish-feature` 只 reconcile 本次 completed feature owned BR，不覆寫其他 active feature 的 BR。
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)

這個 Lifecycle note 的價值很高。未來 reviewer 看見 BR-005~008 仍在 `rules.md` 時，
不會誤以為 SPEC-001 closeout 漏了它們；它們只是屬於另一個 active feature。

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
git status

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

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/)

仍 active 的 SPEC-002：
[`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md)

這是本篇第四個 key lesson：**completed feature 被 archive，但同 BC 的其他 active feature
不會一起移動。**

## Step 5 — Emit Integration Summary

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
對。finish-feature-flow 原本只要求對話輸出，
但 tutorial 需要保留示範成果，
所以我會把 Integration Summary inline 到 completed feature _index.md，
並補 Outstanding / Future Considerations。
真實專案可選擇只貼到 PR description。
```

final `_index.md` 裡的 Feature Overview：

```markdown
### Feature Overview

`SPEC-20260430-001-order-discount-calculation` 是 OrderManager 第一個正式 SDD-driven brownfield feature。它從 `OrderEntry.aspx.cs` 抽出 Order 折扣計算 Domain logic，建立 `Order` Aggregate Root、`OrderLine` Entity、`Money` / `Quantity` / `DiscountRate` Value Objects 與 `DiscountPolicy` Domain Service，並完成跨頁 baseline capture 與 rounding inconsistency bug fix。
```

Phases Summary：

```markdown
| Phase | Date | Slug | Summary |
|---|---|---|
| 1 | 2026-04-30 | baseline-and-fix | Capture `OrderEntry.aspx.cs` baseline、修正 Senior + full-threshold compound discount bug，並把折扣計算抽到 `src/Domain/Order/`。 |
```

Lightweight Changes Summary：

```markdown
| Date | Type | Summary |
|---|---|---|
| 2026-05-04 | baseline-capture | 補 `OrderList.aspx.cs` / `OrderDetail.aspx.cs` 跨頁 confirmed behavior；識別 rounding inconsistency 與 `isVip` multiplier tech-debt。 |
| 2026-05-08 | T2 BUG-001 | 修正 `OrderList` / `OrderEntry` / `OrderDetail` display rounding inconsistency；`Money.ToDisplay()` 成為共用 display contract。 |
```

BR Final State：

```markdown
| BR-ID | Final Rule |
|---|---|
| BR-001 | 訂單折扣前總金額等於所有 `OrderLine.UnitPrice * Quantity` 的加總。 |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off（price multiplier 0.9）。 |
| BR-003 | `CustomerTier = 'Senior'` 的老客戶可額外套用客戶等級折扣率 5% off（price multiplier 0.95）。 |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`。 |
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)

這份 summary 的價值在於：讀者不必回頭重讀 02、03、05 才知道這個 feature 做了什麼。
它把 phase、baseline-only row、BUG-001、Domain extraction、tech debt、future work
收成一個 closeout reference。

## Step 5 — Outstanding / Future Considerations

Integration Summary 也記錄未來工作：

```markdown
## Outstanding / Future Considerations

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
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md) | completed status、completed date、phase / lightweight rows、Integration Summary、future considerations。 |
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
   以及 completed `_index.md` Integration Summary。

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
- Integration Summary 應記錄 final BR state、Domain extraction、lightweight changes、tech debt outstanding 與 future considerations。

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
