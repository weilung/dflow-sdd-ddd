# /dflow:finish-feature — 收尾 SPEC-001 Order Discount Calculation

## 劇情背景

2026-05-12 週二上午，Bob 收到 BUG-001 的最後確認：`Money.ToDisplay()` 已導入，`OrderList` / `OrderEntry` / `OrderDetail` 三頁面都改用同一 display rounding contract；regression tests 全綠；Carol 重新確認 `#ORD-2026-0512` 類型案例三頁面顯示一致。

`SPEC-20260430-001-order-discount-calculation` 的 phase 1 `baseline-and-fix` 已上線，段 3 baseline-capture row 已保留跨頁 confirmed behavior，段 5 `BUG-001-rounding-inconsistency` 也已完成 implementation。三天穩定試用沒有新 bug。

同時，`SPEC-20260505-002-vip-discount-policy` 仍在 phase 1 implementation，本段不收。Bob 只收尾 SPEC-001，觸發 `/dflow:finish-feature`。

## 完整對話

> **Bob**：BUG-001 已修完。`OrderList`、`OrderEntry`、`OrderDetail` 都走 `Money.ToDisplay()`，regression tests 全綠，Carol 也確認三頁面顯示一致。這三天沒有新的 SPEC-001 blocker。  
> 我想只收尾 `SPEC-20260430-001-order-discount-calculation`。`SPEC-20260505-002-vip-discount-policy` 還在 phase 1 implementation，不要一起收。`/dflow:finish-feature`

> **Dflow**：收到。這是 `/dflow:finish-feature`，也就是 feature lifecycle 的 closeout ceremony。  
> 它和 `/dflow:modify-existing`、`/dflow:bug-fix` 不同：modify / bug-fix 是開啟或承接變更；finish-feature 是把一個 feature 的規格、BR Snapshot、BC layer sync 與 archive 收束成 completed history。
>
> 本次 scope 明確：
>
> ```text
> finish: SPEC-20260430-001-order-discount-calculation
> keep active: SPEC-20260505-002-vip-discount-policy
> ```
>
> 我不會 merge、不會 push、不會替你選 Git strategy。這個 flow 做六件事：
>
> - Step 1：validate phase specs、lightweight rows、BUG rows 與 `_index.md`
> - Step 2：把 SPEC-001 `_index.md` status flip 成 `completed`
> - Step 3：把 SPEC-001 Current BR Snapshot sync 到 Order BC layer
> - Step 4：archive SPEC-001 directory；真實專案用 `git mv`
> - Step 5：emit Integration Summary
> - Step 6：若是 follow-up feature，反向更新原 feature；本案預期 skip
>
> 我先跑 Step 1：Validate Phase Specs and `_index.md`。

> **Dflow**：Step 1 mechanical checks：
>
> - ✓ Feature directory located: `dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/`
> - ✓ `_index.md` exists，front matter parsable，six required sections present
> - ✓ Phase Specs table has 1 row：phase 1 `baseline-and-fix`
> - ✓ Phase 1 implementation status：Bob confirmed done；BR-001~004 tests green
> - ✓ Lightweight Changes table has 2 rows
> - ✓ 2026-05-04 `baseline-capture` row is intentionally no-spec-file；它是跨頁 confirmed behavior capture，不需要 archive 成獨立 spec
> - ✓ 2026-05-08 T2 BUG row links to `BUG-001-rounding-inconsistency.md`
> - ✓ BUG-001 implementation status：Bob confirmed done；三頁面 rounding regression tests green
> - ✓ Current BR Snapshot is non-empty and contains BR-001~004, all `active`
> - ⚠ Minor drift disposed：Resume Pointer 仍寫 BUG-001 是 next action，但 Bob 已確認 BUG-001 shipped；Step 2 會改成 closeout pointer
>
> 接著跑 closeout driftcheck。這不是重新推導所有 BR；`_index.md` Current BR Snapshot 是 SPEC-001 的 feature-level truth。這裡確認它和 Order BC layer 沒有機械 drift。

> **Dflow**：Driftcheck result：
>
> - ✓ BR-001~004 all exist in `dflow/specs/domain/Order/rules.md`
> - ✓ BR-001~004 all have scenario sections in `dflow/specs/domain/Order/behavior.md`
> - ✓ `behavior.md` 保留段 3 的 `Confirmed across pages (baseline-capture 2026-05-04)`，沒有在 BUG-001 closeout 時刪掉歷史
> - ✓ `Order` Aggregate Root、`OrderLine` Entity、`Money` / `Quantity` / `DiscountRate` VO、`DiscountPolicy` Domain Service all exist in `models.md`
> - ✓ `tech-debt.md` rounding inconsistency entry is `resolved` by `SPEC-20260430-001 BUG-001`
> - ✓ `tech-debt.md` `isVip multiplier 0.93` entry is already `resolved` by SPEC-002 disposition；不是 SPEC-001 closeout scope
> - ℹ `rules.md` also contains BR-005~008。這些屬於 in-progress `SPEC-20260505-002`，不是本次 finish target
>
> Step 1 validation passes。Ready to flip SPEC-001 status to `completed`? `/dflow:next` to proceed.

> **Bob**：`/dflow:next`

> **Dflow**：Step 2：Flip `_index.md` Status to `completed`。
>
> 我會更新 SPEC-001 dashboard：
>
> - front matter `status: in-progress` -> `status: completed`
> - add `completed_date: 2026-05-12`
> - Phase Specs table：phase 1 `baseline-and-fix` 標為 `completed`
> - Lightweight Changes：BUG-001 row 標示已在 closeout 前 implement
> - Resume Pointer 改成 closeout 訊息：feature completed；see Integration Summary below
>
> Step 2 complete。Entering Step 3：Sync BR Snapshot to BC layer。

> **Dflow**：Step 3 是本段的重點：多 feature 並存於同一個 Order BC 時，finish-feature 不能把整個 `rules.md` 當成單一 feature 的私有檔案。
>
> 現況是：
>
> - SPEC-001 `_index.md` Current BR Snapshot contains BR-001~004。
> - Order BC `rules.md` 已含 BR-001~008。
> - BR-001~004 由 SPEC-001 owned。
> - BR-005~008 由 in-progress SPEC-002 owned。
>
> 所以 Step 3 sync 動作只 reconcile BR-001~004。BR-005~008 保留不動，不能因為 SPEC-001 closeout 就刪掉、重排或改 wording。

> **Bob**：也就是 `rules.md` 是 Order BC 的 cumulative state，不是 SPEC-001 的私有 snapshot。SPEC-001 finish 時只同步自己那四條。

> **Dflow**：對。這是 cross-feature reconciliation 的規則：
>
> - Single feature `_index.md` = feature-level current state。
> - `dflow/specs/domain/Order/rules.md` = BC-level cumulative state。
> - finish-feature 只把本次 completed feature 的 owned BR reconcile 到 BC layer。
> - 其他 active feature 的 BR 保留，因為它們代表 Order BC 目前正在演進的 in-progress state。
>
> 本案 sync result：
>
> - BR-001：already exists；wording matches SPEC-001 snapshot
> - BR-002：already exists；補齊 `price multiplier 0.9`，對齊 SPEC-001 snapshot
> - BR-003：already exists；補齊 `price multiplier 0.95`，對齊 SPEC-001 snapshot
> - BR-004：already exists；補齊 total discount rate formula，對齊 SPEC-001 snapshot
> - BR-005~008：not touched；仍 owned by SPEC-002
>
> 我也會在 `rules.md` 加 `Lifecycle` 段：
>
> ```text
> BR-001~004 finalized as of 2026-05-12 from SPEC-20260430-001 completion.
> BR-005~008 are owned by SPEC-20260505-002 and remain active while that feature is still in progress.
> ```

> **Bob**：`behavior.md` 呢？段 3 baseline-capture 留下的 confirmed across pages 段要保留。

> **Dflow**：會保留。`behavior.md` 的處理是：
>
> - BR-001~004 phase 1 scenarios already exist。
> - 段 3 `Confirmed across pages (baseline-capture 2026-05-04)` 保留作 accepted cross-page behavior history。
> - 新增 lifecycle note，說明 BR-001~004 由 SPEC-001 completion finalized。
> - BR-005~008 的 VIP behavior sections 保留，因為 Order BC 文件是 cumulative，但它們仍由 SPEC-002 owned，未由本次 closeout finalized。
>
> 未來 SPEC-002 跑 `/dflow:finish-feature` 時，Step 3 會再對 BR-005~008 做一次 sync / lifecycle reconciliation。那時才把 VIP feature 的 closeout 狀態寫進 BC layer。

> **Bob**：這樣清楚。SPEC-001 收掉，不代表 Order BC 只剩 BR-001~004；也不代表 SPEC-002 被收掉。

> **Dflow**：Step 3 tech-debt sweep：
>
> - `OrderList / OrderEntry / OrderDetail rounding 策略不一致` remains `resolved` by BUG-001。
> - `OrderList isVip multiplier 0.93` remains `resolved` by SPEC-002 disposition。
> - `Order 折扣規則分散在多個頁面` 標註 partially resolved：三個已知頁面的 rounding contract 已統一，但其他 Order 頁面尚未抽離，所以 status stays `open`。
> - `OrderEntry event handler 仍混合資料存取與流程控制` stays `open`。
> - `DiscountPolicy 結構可能需要演進` stays `open`。
> - 其他 brownfield baseline tech-debt stays `open`。
>
> Step 3 complete。BC `Order` synced：BR-001~004 reconciled，BR-005~008 preserved，behavior lifecycle note added，tech-debt closeout notes updated。Ready to archive the feature directory? `/dflow:next` to proceed.

> **Bob**：`/dflow:next`

> **Dflow**：Step 4：Archive feature directory。
>
> 真實專案我會用這個命令，不用 plain `mv`：
>
> ```bash
> git mv dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation \
>        dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation
> git status
> ```
>
> `git mv` 讓 Git 更容易保留 directory rename history，改善 `git log --follow`、`git blame` 與 PR diff。  
> 這個 tutorial repo 的 `outputs/` 是示範 fixture；本段實際用 OS-level move 模擬 archive，但規範仍是：真實專案搬 `dflow/specs/features/active/...` 到 `dflow/specs/features/completed/...` 時使用 `git mv`。
>
> Archive scope：
>
> - Move: `SPEC-20260430-001-order-discount-calculation`
> - Do not move: `SPEC-20260505-002-vip-discount-policy`
>
> Step 4 complete。Entering Step 5：Emit Integration Summary。

> **Dflow**：Step 5：Integration Summary。  
> 這份 summary 是 git-strategy-neutral 的 closeout reference，可以改寫成 PR description、release note、merge note 或團隊同步文件；它不是 commit message template。
>
> ```text
> == Integration Summary: SPEC-20260430-001-order-discount-calculation ==
>
> Feature Overview:
> OrderManager 的第一個正式 SDD-driven brownfield feature。它從
> OrderEntry.aspx.cs 抽出 Order 折扣計算 Domain logic，建立可測試的
> Order BC 核心模型，補上跨頁 baseline capture，並修正客戶實際撞上的
> rounding inconsistency bug。
>
> Change Scope:
> - BC: Order
> - Phase Count: 1
> - Phase: phase 1 baseline-and-fix
> - Lightweight Changes: 1 baseline-capture row + 1 T2 BUG lightweight spec
> - Archived Directory: dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/
>
> Phases Summary:
> - phase 1 (2026-04-30): baseline-and-fix
>   Capture OrderEntry.aspx.cs baseline, fix Senior + full-threshold compound
>   discount calculation, and extract discount logic into src/Domain/Order/.
>
> Lightweight Changes Summary:
> - 2026-05-04 baseline-capture:
>   Captured OrderList / OrderDetail confirmed cross-page behavior and recorded
>   rounding inconsistency + isVip multiplier tech-debt.
> - 2026-05-08 BUG-001 rounding-inconsistency:
>   Added Money.ToDisplay() display contract and aligned OrderList / OrderEntry /
>   OrderDetail so the same order displays the same discounted total.
>
> Aggregates / Domain Extraction:
> - Aggregate Root: Order
> - Entity: OrderLine
> - Value Objects: Money, Quantity, DiscountRate
> - Domain Service: DiscountPolicy
> - WebForms adapter retained: OrderEntry.aspx.cs maps UI / EF data into Domain
>   objects and writes back through the existing page flow.
>
> Domain Events:
> - None. This WebForms brownfield feature does not introduce Domain Events.
>
> BR Final State:
> - BR-001: 訂單折扣前總金額等於所有 OrderLine.UnitPrice * Quantity 的加總。
> - BR-002: 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率
>           10% off（price multiplier 0.9）。
> - BR-003: CustomerTier = 'Senior' 的老客戶可額外套用客戶等級折扣率
>           5% off（price multiplier 0.95）。
> - BR-004: 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣；
>           總折扣率 = 1 - (1 - fullRate) * (1 - tierRate)。
>
> Cross-feature Note:
> - BR-001~004 finalized by SPEC-20260430-001 on 2026-05-12.
> - BR-005~008 remain owned by in-progress SPEC-20260505-002-vip-discount-policy.
> - Order BC rules.md is cumulative; this closeout did not finish or archive SPEC-002.
>
> Tech Debt Outstanding:
> - rounding inconsistency: resolved by BUG-001.
> - isVip multiplier 0.93: resolved by SPEC-002 disposition as dead code.
> - Order 折扣規則分散在多個頁面: partially resolved; known three-page
>   rounding contract unified, other Order pages still need review.
> - OrderEntry event handler 仍混合資料存取與流程控制: open.
> - DiscountPolicy 結構可能需要演進: open.
> - Brownfield baseline debt remains open: 業務邏輯散在 Code-Behind,
>   缺少 unit test coverage, Stored Procedures 重 join, .NET Core migration
>   roadmap, 無 Dependency Injection 組態.
>
> Outstanding / Future Considerations:
> - SPEC-20260505-002-vip-discount-policy remains in progress.
> - Candidate future phase: extract remaining OrderEntry event handler flow.
> - Candidate future phase: model Order status transitions outside WebForms handlers.
> - Candidate future feature: establish Customer BC for VIP eligibility and contracts.
>
> Sign-off:
> - Bob verified phase 1 and BUG-001 implementation completion on 2026-05-12.
> - Carol verified the rounding fix for the reported cross-page display issue.
> - Trial supervisors observed three stable days without new SPEC-001 blocker.
>
> Next Steps:
> - Commit / merge / push according to project Git principles.
> - Future changes to SPEC-001 behavior must use a follow-up feature.
> ```

> **Bob**：這份 summary 也 inline 到 completed `_index.md`，對嗎？

> **Dflow**：對。finish-feature-flow 原本只要求對話輸出，但 tutorial 需要保留示範成果，所以我會把 Integration Summary inline 到 completed feature `_index.md`，並補 `Outstanding / Future Considerations`。真實專案可選擇只貼到 PR description。
>
> Step 5 complete。Entering Step 6：Reverse-Update Follow-up Tracking。

> **Dflow**：Step 6：Reverse-Update Follow-up Tracking：**skip**。
>
> 跳過理由：`SPEC-20260430-001-order-discount-calculation` 沒有 `follow-up-of` metadata。它不是從某個 completed feature 派生出來的 follow-up feature，所以沒有原 feature 的 Follow-up Tracking row 需要反向更新。
>
> `/dflow:finish-feature` complete for `SPEC-20260430-001-order-discount-calculation`。
>
> Feature directory is now at：
>
> ```text
> dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/
> ```
>
> `SPEC-20260505-002-vip-discount-policy` remains active.

> **Bob**：好。SPEC-002 VIP feature 仍在 phase 1 implementation，預計本週末上線；下週可能對 SPEC-002 也跑 finish-feature。Order BC 整體 modernization 還有很長的路，但這是第一個 SDD-driven 完整循環，已經證明 brownfield 漸進抽離可行。

## 本段產出的檔案

**新增**
- [`06-finish-feature.md`](06-finish-feature.md)

**移動**
- `outputs/dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/`
- → [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/)

**修改**
- [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)
- [`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)
- [`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md)
- [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

**故意不改**
- 不動 `outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/`，它仍是 in-progress。
- 不改 completed directory 內 phase-spec / BUG-001 spec 的 inline 內容；它們搬位置後保留為 frozen history。
- 不改 `dflow/specs/domain/Order/{context,models}.md`，closeout 沒有引入新的 Domain model 或 context boundary。
- 不改 `dflow/specs/domain/{glossary,context-map}.md`。
- 不 commit、不 push、不建 worktree。

## 觀察重點

- **finish-feature 與 modify / bug-fix 的差異**：modify / bug-fix 是處理新變更或缺陷；finish-feature 是 feature lifecycle endpoint，完成後 directory 進入 `completed/`，不能再直接接新的 T2/T3。
- **多 feature 並存於同 BC 時的 BR Snapshot sync 紀律**：SPEC-001 closeout 只 sync BR-001~004；BR-005~008 屬於仍 active 的 SPEC-002，保留不動。`rules.md` 是 Order BC cumulative state，不是單一 feature 私有檔。
- **baseline-capture row + BUG-001 row 的 finish-feature verification**：段 3 baseline-capture row 沒有獨立 spec 檔，但要在 driftcheck 確認 behavior.md 歷史仍在；段 5 BUG-001 row 要確認 spec link、implementation status、regression tests 與 tech-debt closure。
- **rules.md / behavior.md 的 cross-feature ownership 標記**：Lifecycle note 明示 BR-001~004 finalized by SPEC-001，BR-005~008 owned by SPEC-002，避免 reviewer 誤以為 finish SPEC-001 會收掉整個 Order BC。
- **completed feature 凍結性**：SPEC-001 進入 completed 後，不可直接追加 T2/T3。若未來 SPEC-002 或其他需求牽涉 rounding-related 修改，必須走 follow-up feature 或新的 active feature。

## 下一個劇情段 / 收尾

→ 劇情 2 結束。`SPEC-20260430-001-order-discount-calculation` 已完成並歸檔；`SPEC-20260505-002-vip-discount-policy` 仍在 `features/active/`，等待後續 implementation 與可能的 finish-feature。

Tutorial 全劇本已展示的 `/dflow:` 命令：

- `npx dflow-sdd-ddd init`：劇情 2 段 1 以 CLI 入口示範，建立 brownfield baseline outputs。
- `/dflow:new-feature`：劇情 2 段 4 建立 VIP discount policy；劇情 1 也示範 greenfield new feature。
- `/dflow:new-phase`：劇情 1 示範後續 phase 擴張。
- `/dflow:modify-existing`：劇情 2 段 2 / 段 3 展示 brownfield baseline capture 與既有功能修改思路。
- `/dflow:bug-fix`：劇情 2 段 5 修正 rounding inconsistency；劇情 1 段 5 修正 emoji surrogate bug。
- `/dflow:finish-feature`：劇情 2 本段收尾 SPEC-001；劇情 1 段 6 收尾 greenfield feature。

給 reviewer 的全劇本 takeaways：

- SDD 在 brownfield 的價值不是一次重寫，而是把已驗證的規則逐步推進 Domain layer。
- DDD tactical patterns 要服務 migration 節奏；WebForms adapter 可以先保留，只抽出最有風險的 business logic。
- 多 feature 並行時，feature directory 是工作單位，BC docs 是 cumulative truth；finish-feature 需要清楚標示 ownership。
- Completed feature 是 frozen history；後續變更透過 follow-up feature，而不是回頭改已完成的 spec trail。
