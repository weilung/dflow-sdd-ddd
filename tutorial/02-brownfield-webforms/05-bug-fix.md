# /dflow:bug-fix — rounding inconsistency 跨頁面修正

## 劇情背景

2026-05-08 週五早上，`SPEC-20260505-002-vip-discount-policy` 已完成 implementation 並上線試用 2 天。Phase 1 兩個 Order feature 都穩定，Bob 原本準備整理本週收尾計畫。

他打開 Slack，看到試用主管 Carol 留下訊息：

> 「我看一筆訂單 #ORD-2026-0512：OrderList grid 顯示折扣後 NT$45,127，我點進去 OrderDetail 顯示 NT$45,126.85，差 0.15 元。客戶剛打電話來問為什麼兩頁金額不一樣？我跟他說我會查。」

Bob 立刻 verify：這不是 VIP feature 的新問題，也不是折扣公式錯誤。段 3 baseline capture 已經把它記在 `tech-debt.md`：`OrderList.BindGrid()` 用 `decimal.Round(value, 0)` 顯示整數元，`OrderEntry` / `OrderDetail` 用 `Math.Round(value, 2)` 或 `ToString("N2")` 顯示兩位小數。今天只是同一個已知 rounding inconsistency 被客戶撞上。

Bob 決定觸發 `/dflow:bug-fix`，把 display rounding contract 收斂到 `Money` / `DiscountPolicy` 周邊，但 ceremony 保持 lightweight。

## 完整對話

> **Bob**：Carol 早上回報一筆訂單 `#ORD-2026-0512`，`OrderList` 顯示折扣後 NT$45,127，點進 `OrderDetail` 顯示 NT$45,126.85，客戶來電問為什麼兩頁不一致。  
> 我 verify 後確認是段 3 已記錄的 rounding inconsistency，不是 VIP discount policy，也不是 BR-001~004 的公式錯。`/dflow:bug-fix`

> **Dflow**：收到。這是 `/dflow:bug-fix`，不是 Git Flow 的 hotfix branch；它走 modify-existing flow 的 lightweight ceremony。  
> 我先跑 Step 1：Assess the Change。這一步同時判斷 Ceremony Tier 與 Feature Linkage。
>
> Part A — Tier 判定：
>
> - T1 Heavy？否。沒有新 BR、沒有新 Aggregate、沒有新 VO 結構變化、沒有 data structure change。`Money` VO 加 method 是 implementation contract 收斂，不是 architectural change。
> - T2 Light？是。這是試用期間客戶撞上的明確 bug，範圍包含 Domain `Money` VO 加 `ToDisplay(precision = 2)` method，以及 Presentation 三個頁面改 call 同一 contract。BR 不變，但 observable display 行為會被修正。
> - T3 Trivial？否。這不是 typo、button color 或 copy fix；顯示精度會改變，且需要 root cause、fix approach 與 regression tests 的獨立紀錄。
>
> 結論：**T2 Light**。`/dflow:bug-fix` 的預設 ceremony 就是 lightweight，除非 bug 揭露新的 Domain model 或 BR 設計錯誤才升級。

> **Bob**：同意。這次不應該升成新 phase，但也不是 `_index.md` 加一行就好。客戶已經看到跨頁金額不同，需要獨立 bug spec。

> **Dflow**：Part B — Feature Linkage。這裡要特別小心 host feature。
>
> 我看到兩個 active features：
>
> ```text
> SPEC-20260430-001-order-discount-calculation
> SPEC-20260505-002-vip-discount-policy
> ```
>
> 初看可能有人會想放進剛上線的 SPEC-002，因為 Carol 是 VIP feature 試用期間回報。但我建議 host feature 用：
>
> ```text
> SPEC-20260430-001-order-discount-calculation
> ```
>
> 理由：
>
> - rounding inconsistency 是段 3 在 SPEC-001 baseline capture 時識別的 tech-debt entry。
> - defect 涉及 `Money` display contract 與跨頁折扣後金額呈現，不是 VIP 7% off、合約有效期或 `CustomerTier = VIP` 議題。
> - SPEC-001 status 仍是 `in-progress`，phase 1 已 ship 但尚未 `/dflow:finish-feature`，可以承接 T2 lightweight bug spec。
> - 不歸 SPEC-002。bug fix 不混入剛建立的新 feature scope，避免讓 VIP feature history 看起來承擔 unrelated rounding defect。

> **Bob**：這點我也想強調。SPEC-002 是新 VIP policy，rounding bug 是 SPEC-001 的 tech-debt。不要因為客戶是在 VIP 試用期間撞到，就把它塞進 VIP feature。

> **Dflow**：對。這也是 `/dflow:bug-fix` 的紀律：bug fix 追 defect source，不回改已 ship feature history，也不污染剛建立的新 feature scope。  
> 檔名我建議用 BUG-NUMBER 格式：
>
> ```text
> BUG-001-rounding-inconsistency.md
> ```
>
> T2 lightweight 有兩種合法命名：`lightweight-{date}-{slug}.md` 或 `BUG-{NUMBER}-{slug}.md`。這次是試用期間客戶反饋的明確 bug，而且是 SPEC-001 directory 內第一個 BUG，所以從 `BUG-001` 起算。這樣 bug queue、Slack 訊息和 regression tests 可以對齊。

> **Bob**：好，用 `BUG-001-rounding-inconsistency.md`。段 5 跟劇情 1 的 bug-fix 一樣，讓同事看到 BUG-NUMBER 命名的用途。

> **Dflow**：Step 1 complete（tier T2 decided, host feature `SPEC-20260430-001-order-discount-calculation` identified, bug spec filename confirmed）。Entering Step 1.5 check.
>
> Step 1.5 — Completed-feature reopen detection：**skip**。
>
> 跳過理由：host feature 在 `dflow/specs/features/active/`，不是 completed feature，不觸發 completed-feature reopen。
>
> Step 1.6 — Create Follow-up Feature：**skip**。
>
> 跳過理由：沒有 completed feature follow-up；BUG-001 直接掛在 active SPEC-001 下。
>
> Entering Step 2: Check Documentation.

> **Dflow**：Step 2 我會先讀現有文件，不直接改程式：
>
> - `SPEC-20260430-001-order-discount-calculation/_index.md`
> - `phase-spec-2026-04-30-baseline-and-fix.md`
> - `dflow/specs/domain/Order/rules.md`
> - `dflow/specs/domain/Order/models.md`
> - `dflow/specs/migration/tech-debt.md`
>
> Baseline 讀到：
>
> - BR-001~004 已描述 pre-discount total、滿額折扣、Senior 折扣與 compound discount accumulation。
> - `Money` VO 已存在，負責表示 amount + currency；目前 rounding 延續 `OrderEntry` 既有規則。
> - `DiscountPolicy` 已是折扣計算 owner；SPEC-002 只擴張 VIP path，沒有改掉 BR-001~004。
> - `tech-debt.md` 的 rounding inconsistency entry 仍是 `open`，`isVip` multiplier entry 已由 Daniel 確認 dead code 並 resolved。
>
> 這次 BR-001~004 wording 不變。rounding inconsistency 是 Presentation-layer display rounding contract drift，不是 BR-level delta。

> **Bob**：對，`DiscountPolicy` 算出來的折扣後金額沒有錯，錯在每頁顯示時各自 round。這不應該變成 BR-005 或修改 BR-004。

> **Dflow**：Baseline reviewed。Step 2 complete。Entering Step 3: Assess DDD Impact.

> **Dflow**：Step 3 — DDD Impact。  
> 依 `/dflow:bug-fix` 的 ceremony adjustment，Step 3 預設是 **no DDD impact, fix in place**，除非 bug 本身在 Domain logic 或揭露 business rule 設計錯誤。
>
> 我的初判：
>
> - Aggregate boundary：不變。`Order` 還是 aggregate root。
> - Domain Events：無。
> - Value Object structure：不變。`Money` 還是 amount + currency，不新增 equality component。
> - Business Rules：不新增、不修改、不移除、不 rename。
> - Data structure：無 schema change。
>
> 但這裡有一個 implementation 收斂點：`Money` 可以提供 `ToDisplay(precision = 2)`，讓 Presentation 層不再各自決定 display precision。

> **Bob**：我想確認一下。`Money` VO 加 `ToDisplay(precision)` method 算 Domain 層變化嗎？要不要正式寫進 BR？

> **Dflow**：算 Domain code 的小幅 implementation change，但不算新的 Domain concept 或 BR Delta。我的判斷邏輯是：
>
> 1. 它不改 `Money` 的 invariant。金額與幣別仍是核心狀態。
> 2. 它不改 `DiscountPolicy` 如何計算折扣。
> 3. 它不新增業務可決策的規則語句。Carol 的問題是「同一筆訂單跨頁顯示要一致」，不是「新增一條折扣政策」。
> 4. 它把已存在的顯示慣例收斂成 single contract，避免 WebForms page 各自 round。
>
> 所以寫在 `BUG-001` 的 Implementation Tasks，不寫進 BR-001~004，也不更新 `dflow/specs/domain/Order/models.md`。如果未來要討論多幣別、locale-specific formatter 或 invoice rounding，那才是新的 scope 或 tech-debt。

> **Bob**：好。`ToDisplay(precision = 2)` 預設兩位小數，符合目前財務顯示慣例；但我們不把它講成新 business rule。

> **Dflow**：Step 3 決議：
>
> - No new BR。
> - `Money.ToDisplay(precision = 2)` 是 implementation contract 收斂。
> - `OrderList.BindGrid()` 改用 `money.ToDisplay()`，取代 `decimal.Round(value, 0)`。
> - `OrderDetail.LoadDiscountSummary()` 改用 `money.ToDisplay()`，即使結果相同，也要走同一 contract。
> - `OrderEntry` 確認 align 到同一 contract。
> - Regression tests 要覆蓋同一筆 Order 在三頁面顯示金額一致。
>
> Implementation Tasks 我會放進 `BUG-001-rounding-inconsistency.md`：
>
> - DOMAIN-1：`Money` VO 加 `ToDisplay(precision = 2)` method，維持 invariants。
> - WEBFORMS-1：`OrderList.BindGrid()` column formatter 改用 `ToDisplay()`。
> - WEBFORMS-2：`OrderDetail.LoadDiscountSummary()` 改用 `ToDisplay()`。
> - WEBFORMS-3：`OrderEntry` align 到同 contract。
> - TEST-1：同一 Order 在 `OrderList` / `OrderEntry` / `OrderDetail` 顯示金額一致。
> - TEST-2：`Money.ToDisplay` edge cases，包含 0、負數、大數與 boundary precision。
>
> 這仍是 T2。如果開始討論全站 currency formatting、locale、tax / invoice rounding 或多幣別顯示，就要停下來另開 follow-up，不放進本 BUG-001。

> **Bob**：可以。這段 tutorial 先落 spec 和 docs。我下午再讓工程師照 BUG-001 implement。

> **Dflow**：OK。Implementation plan captured。Step 4 extraction decision：**extract now but narrowly**。  
> 這裡不是把整個 WebForms adapter 抽乾，而是把 display rounding contract 收斂到 `Money` 周邊；周邊 EF query、Grid binding、page lifecycle 仍維持原狀。Ready to update documentation.

> **Dflow**：Step 5 — Update Documentation。
>
> 我會做三件事：
>
> 1. 新增 T2 bug lightweight spec：
>
>    ```text
>    dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md
>    ```
>
> 2. 更新 SPEC-001 `_index.md`：
>
>    - Lightweight Changes 表新增 2026-05-08 / T2 row。
>    - Description 外連 `BUG-001-rounding-inconsistency.md`。
>    - Current BR Snapshot **不 regenerate**，明示理由：BR-001~004 wording unchanged；root cause 是 Presentation-layer display rounding contract drift，不是 BR-level delta。
>    - Resume Pointer 改成「下一步實作 BUG-001；後續考慮 SPEC-001 finish-feature」。
>
> 3. 更新 `dflow/specs/migration/tech-debt.md`：
>
>    - rounding inconsistency entry status 從 `open` 改為 `resolved`。
>    - resolved note 寫：`2026-05-08 由 SPEC-20260430-001 BUG-001 修正，Domain Money VO 提供統一 ToDisplay() contract，三頁面改 call 同一 contract`。
>    - Follow-up Notes 補 disposition，方便 reviewer 從 tech-debt 反查 BUG-001。
>
> 故意不改：
>
> - 不動 `SPEC-20260505-002` directory，避免污染 VIP feature scope。
> - 不改 `dflow/specs/domain/Order/{rules,context,behavior,glossary}.md`，因為 BR 與 Domain 概念不變。
> - 不改 `dflow/specs/domain/Order/models.md`，因為 `Money` 結構不變，加 method 是 implementation detail。
> - 不改 `dflow/specs/domain/{glossary,context-map}.md`。

> **Bob**：BR Snapshot 不 regenerate 這點請寫清楚。Reviewer 如果只看到 T2 spec，可能會問為什麼沒有刷新 snapshot。

> **Dflow**：會。我會在 `_index.md` Current BR Snapshot 區塊下加明確 note：`BUG-001` 沒有 BR wording 變更，因此 snapshot 保持 BR-001~004 當前狀態；這不是漏更。
>
> 本段 documentation package 完成：BUG-001 lightweight spec ready、`_index.md` Lightweight Changes row added、BR Snapshot intentionally unchanged、tech-debt rounding entry resolved。

> **Bob**：好，下午 implement。SPEC-001 phase 1 跟 BUG-001 都穩後，我再看 phase 2 是否要繼續；如果沒有，本週可能就對 SPEC-001 跑 `/dflow:finish-feature`。

## 本段產出的檔案

**新增**
- [`dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md`](outputs/dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md)

**修改**
- [`dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md)
- [`dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

**故意不改**
- 不動 `SPEC-20260505-002-vip-discount-policy/` — rounding bug 來源是 SPEC-001 tech-debt，不混入 VIP feature scope。
- 不改 `dflow/specs/domain/Order/{rules,context,behavior,glossary}.md` — BR 不變，Domain 概念無新增。
- 不改 `dflow/specs/domain/Order/models.md` — `Money` VO 結構不變；加 `ToDisplay()` method 是 implementation 收斂，不寫進 model catalog。
- 不改 `dflow/specs/domain/{glossary,context-map}.md`。
- 不動 `sdd-ddd-*-skill/`、`proposals/`、`reviews/`、`planning/`、`CHANGELOG.md` 或其他 tutorial 舊檔。
- 不 commit、不 push、不建 worktree。

## 觀察重點

- **`/dflow:bug-fix` 與 `/dflow:modify-existing` / `/dflow:new-feature` 的差異**：bug-fix 走 modify-existing flow，但預設 lightweight；Step 3 預設 no DDD impact / fix in place。`/dflow:new-feature` 則預設 T1 Heavy，用於新 BR、新 phase 或新 concern。
- **bug-fix host feature 選擇紀律**：本 bug 歸 `SPEC-20260430-001`，因為它來自段 3 SPEC-001 tech-debt；不歸剛建立的 `SPEC-20260505-002`，避免回改已 ship feature history，也避免污染 VIP feature scope。
- **BUG-NUMBER vs `lightweight-{date}` 命名選擇**：T2 兩種命名都合法；本段是試用期間客戶回報的明確 bug，所以用 `BUG-001-rounding-inconsistency.md`，方便和 regression tests / bug queue 對齊。
- **`Money` VO 加 method 是 implementation 收斂，不是 BR Delta**：`ToDisplay(precision = 2)` 不改 invariant、不改 equality components、不改 `DiscountPolicy` 公式；它只是讓 Presentation 層共用 display contract。
- **BR Snapshot 不 regenerate 的時機**：沒有 ADDED / MODIFIED / REMOVED / RENAMED BR 時，不刷新 Current BR Snapshot；但要在 `_index.md` 明示理由，避免 reviewer 誤判為漏更。

## 下一個劇情段

→ [`06-finish-feature.md`](06-finish-feature.md)：Bob 收尾 `SPEC-20260430-001`，整理 phase 1 + BUG-001 的狀態，決定是否 `/dflow:finish-feature`，作為劇情 2 結束段。
