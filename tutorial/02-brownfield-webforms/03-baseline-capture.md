# /dflow:modify-existing — baseline capture 跨頁面折扣顯示行為

## 劇情背景

2026-05-04 週一上午，五一連假後 Bob 回到 office。連假前他已經把 `SPEC-20260430-001-order-discount-calculation` 與 Phase 1 `baseline-and-fix` 寫好，決議下一個工作日開始實作 `Order` Aggregate、`Money`、`DiscountPolicy` 與 `OrderEntry.aspx.cs` thin adapter。

但週末 Bob 想到一個風險：OrderManager 不只 `OrderEntry.aspx` 會顯示折扣後金額，`OrderList.aspx` 與 `OrderDetail.aspx` 也會顯示。若 Phase 1 只把 `OrderEntry` 的折扣計算抽到 Domain 層，其他頁面仍用舊算法或不同顯示策略，同一筆訂單可能在 `OrderEntry` 顯示 NT$51,300，卻在 `OrderList` 顯示 NT$54,000。

Bob 不想把 Phase 1 scope 擴張成三個頁面的全面改造。他只想先 baseline capture `OrderList.aspx.cs` 與 `OrderDetail.aspx.cs` 的折扣顯示行為，把 confirmed / buggy / unknown 分清楚，再決定哪些跟 Phase 1 有關，哪些留到 Phase 2 或獨立 lightweight change。

## 完整對話

> **Bob**：連假前我說今天要開始 Phase 1 implementation，不過週末想到一件事。`OrderList.aspx` 和 `OrderDetail.aspx` 也會顯示折扣後金額。如果我只抽 `OrderEntry.aspx.cs` 的折扣邏輯，其他頁面還是舊算法，UI 可能不一致。  
> 我今天想先做 `OrderList.aspx` + `OrderDetail.aspx` 的 baseline capture only，不修任何 BR，也不改程式。`/dflow:modify-existing`

> **Dflow**：收到。這是 modify-existing flow，但你一開始已經界定清楚：**baseline capture only，不修任何 BR**。我先跑 Step 1：Assess the Change，也就是 Ceremony Tier + Feature Linkage。
>
> Part A — Tier 判定：
>
> - T1 Heavy？否。沒有新增 Aggregate、沒有新增 Domain concept、沒有新增 BR，也沒有 data structure change。
> - T2 Light？否。T2 Light 需要有 BR Delta，例如 bug fix、validation tweak 或 flow branch change；這次你明確說不修行為，沒有 ADDED / MODIFIED / REMOVED / RENAMED BR。
> - T3 Trivial？否。這不是 typo、button color、copy、formatting 或 pure comments；它會讀跨頁面 Code-Behind 並更新 domain behavior 與 tech-debt。
>
> 結論：這件事**不在 T1 / T2 / T3 範疇內**。

> **Bob**：所以沒 BR Delta 的 work 算什麼 tier？我不想把它硬塞成 T2，也不想假裝是 T3。

> **Dflow**：你的判斷是對的。依 `modify-existing-flow.md` Step 2 的 **Systematic Baseline Capture**，baseline-only 不是 Tier 表內的 modification tier，但它是合法路徑。
>
> 這條路徑的規則是：
>
> - 讀 related Code-Behind，不只看單頁，但只限 immediate neighbors。
> - 只把 confirmed behavior 寫進 BC 層 `behavior.md`。
> - buggy implementation 與 unknown behavior 寫進 `tech-debt.md`，不要升格成 BR。
> - 更新 host feature 的 `_index.md` Resume Pointer，讓下個人知道 baseline 結果如何影響 Phase 1。
> - 不需要建立 `lightweight-spec` 或新的 `phase-spec`，因為沒有 BR Delta，也沒有 implementation。
>
> 這次 host feature 是 active 的 `SPEC-20260430-001-order-discount-calculation`。我會用 baseline-only row 記在它的 Lightweight Changes 表，但 Type 會標 `baseline-capture`，不硬塞 T1 / T2 / T3。

> **Bob**：同意。這段的目的就是把風險看清楚，不要開新 spec 也不要修程式。

> **Dflow**：Step 1 complete（baseline-only，沒有 T1/T2/T3 tier，host feature identified: `SPEC-20260430-001-order-discount-calculation`）。  
> Step 1.5 — Completed-feature reopen detection：**skip**。
>
> 跳過理由：host feature 還在 `active/`，不是 completed feature reopen。
>
> Step 1.6 — Create Follow-up Feature：**skip**。
>
> 跳過理由：沒有 completed feature follow-up，也沒有建立新 feature。
>
> Step 2 — Document Current Behavior：我會進入 Systematic Baseline Capture 子路徑。這裡的重點不是產生 Delta，而是把跨頁面現況分成 **confirmed / buggy / unknown**。

> **Dflow**：我先讀 related Code-Behind，範圍限制在 Order discount display 的 immediate neighbors：
>
> ```text
> OrderManager.Web/Pages/Order/OrderList.aspx.cs
> class OrderList
> method BindGrid()
> approximate lines 48-97
>
> OrderManager.Web/Pages/Order/OrderDetail.aspx.cs
> class OrderDetail
> method LoadOrderHeader()
> approximate lines 34-66
> method LoadDiscountSummary()
> approximate lines 72-104
> ```
>
> 第一個 confirmed finding 在 `OrderList.BindGrid()`：
>
> ```csharp
> var fullRate = row.GrossAmount >= 50000m ? 0.10m : 0m;
> var tierRate = row.CustomerTier == "Senior" ? 0.05m : 0m;
> var totalRate = 1 - (1 - fullRate) * (1 - tierRate);
> row.DiscountedTotal = row.GrossAmount * (1 - totalRate);
> ```
>
> 這裡使用 `1 - (1 - fullRate) * (1 - tierRate)`，與 Phase 1 的 BR-004 一致。這是 **confirmed**，可以寫進 `behavior.md`，但要標 source page：`OrderList.BindGrid()`。

> **Bob**：那 `OrderList` 顯示 NT$51,300 這件事其實是對的？至少公式是對的？

> **Dflow**：公式是對的。我要小心措辭：我可以確認 `Discounted Total` column 使用 BR-004 的乘法累積公式；但顯示精度還要另外看，因為後面可能有 formatting 或 rounding。

> **Dflow**：第二個 confirmed finding 在 `OrderDetail.LoadDiscountSummary()`。它沒有直接重寫公式，而是呼叫同一個 SP：
>
> ```csharp
> var summary = db.Database.SqlQuery<OrderDiscountSummary>(
>     "EXEC usp_GetOrderDiscountSummary @OrderId",
>     new SqlParameter("@OrderId", orderId)).Single();
>
> lblDiscountedTotal.Text = summary.DiscountedTotal.ToString("N2");
> ```
>
> `OrderDetail.LoadOrderHeader()` 只是載入訂單標頭，不決定折扣；`LoadDiscountSummary()` 的金額來源是 `usp_GetOrderDiscountSummary`。我追到 `OrderList` 的 data source 也會帶同一個 summary result。對相同 `OrderId` / same inputs，`OrderDetail` 與 `OrderList` 的折扣 summary source 一致。
>
> 換句話說，`OrderList` 與 `OrderDetail` 都接觸到 `usp_GetOrderDiscountSummary` 這條 summary source；即使 `OrderList.BindGrid()` 有自己的 display calculation，也不要把同一條 BR-004 confirmed behavior 重複寫成兩條規則。
>
> 這是第二個 **confirmed**，但我不會重複寫兩條 BR-004 behavior。跨頁面看到同一規則時，策略是：在 `behavior.md` 寫一個 confirmed-across-pages scenario，source pages 同時列 `OrderList.BindGrid()` 與 `OrderDetail.LoadDiscountSummary()`。

> **Bob**：好，不要因為兩個頁面都看到公式，就複製兩段 BR-004。行為只有一條，source pages 可以列多個。

> **Dflow**：接著是 **buggy** finding。`OrderList.BindGrid()` 最後顯示 grid column 時用了整數元 rounding：
>
> ```csharp
> e.Row.Cells[6].Text = decimal.Round(row.DiscountedTotal, 0).ToString("N0");
> ```
>
> 但 `OrderEntry` 與 `OrderDetail` 都用到小數兩位：
>
> ```csharp
> Math.Round(total, 2, MidpointRounding.AwayFromZero)
> summary.DiscountedTotal.ToString("N2")
> ```
>
> 所以同一筆訂單的 underlying formula 可能一致，但 `OrderList` 會顯示整數元，`OrderDetail` 會顯示到角。若折扣後金額帶小數，列表頁可能比明細頁少一兩元的視覺差。

> **Bob**：這個看起來很想順手修。既然 Phase 1 要做 Money，直接把 rounding 一起統一掉？

> **Dflow**：我建議先不要。你今天的入口是 baseline capture only，且 Phase 1 phase-spec 目前把 rounding / tax 處理列為 out of scope。若現在直接修 rounding，會產生 BR Delta 或至少 display contract Delta，應該要有 lightweight spec 或 phase scope 調整。
>
> baseline-only 的處理方式是：把它寫進 `tech-debt.md`，Severity: Medium，Migration impact 註明 Domain 層未來應統一 `Money` rounding contract。Resume Pointer 裡提醒本週要決定：放進 Phase 1 邊界，或拉成獨立 lightweight。

> **Bob**：可以。今天不改 rounding，只記 debt。Phase 1 開寫前我再決定要不要改 scope。

> **Dflow**：再來是 **unknown** finding。`OrderList.BindGrid()` 有一段：
>
> ```csharp
> if (customer.IsVip)
> {
>     discountedTotal *= 0.93m;
> }
> ```
>
> 程式註解是空的，沒有 ticket reference，也沒有對應 BR。它跟 BR-003 的 `CustomerTier = 'Senior'` 5% off 有可能互斥，也可能是很久以前的 legacy promotion。這不能寫進 `rules.md`，也不能寫進 `behavior.md` 當 accepted behavior。

> **Bob**：這段我也不想直接刪。`0.93` 太像業務給過的特例數字了，直接刪可能出事。

> **Dflow**：同意，不刪，也不修。這是 **unknown behavior**，處理方式是：
>
> - 寫進 `tech-debt.md`：`OrderList isVip multiplier 0.93 規則來源不明`。
> - 在 description 註明無註解、可能與 BR-003 互斥。
> - Status: open。
> - Note: 待業務確認。確認後才決定保留、移除或正式建立獨立 BR。
>
> 這也是 baseline capture 的紀律：讀到不代表採納；未確認的 legacy 行為不能進入 BC source of truth。

> **Bob**：這裡會不會影響 Phase 1？如果 `isVip` 是真的業務規則，Phase 1 抽 `DiscountPolicy` 時是不是要一起處理？

> **Dflow**：目前不能。`isVip` 沒有 BR Delta、沒有 stakeholder confirmation，也和既有 BR-003 可能衝突。Phase 1 的 `DiscountPolicy` 只實作 BR-001~BR-004。`isVip` 先成為 open question / tech debt。若業務確認它是現役規則，再用新需求或 lightweight modification 正式納入。

> **Bob**：好。今天我們只把這些分類寫清楚。不要因為看到跨頁面程式，就把 Phase 1 變成三頁同步改造。

> **Dflow**：Step 2 baseline captured。摘要如下：
>
> - **confirmed**：`OrderList.BindGrid()` 的 `Discounted Total` 使用 BR-004 乘法累積公式。
> - **confirmed**：`OrderDetail.LoadDiscountSummary()` 透過 `usp_GetOrderDiscountSummary` 取得相同 discount summary source；相同 inputs 應一致。
> - **buggy**：`OrderList` 使用 `decimal.Round(value, 0)`，與 `OrderEntry` / `OrderDetail` 的 two-decimal display 不一致。
> - **unknown**：`customer.IsVip` 時乘上 `0.93m`，來源不明，可能與 BR-003 互斥。
>
> Baseline capture 已完成，current behavior 已依分類整理。接下來進入 Code-Behind 分析與 tech-debt 分流；若要繼續，請輸入 `/dflow:next` 或回覆 OK。

> **Bob**：OK。

> **Dflow**：Step 3 — Analyze the Code-Behind。
>
> 這次 Step 3 是簡化版，因為主要規則已在 Step 2 baseline capture 中識別。現在只做分流：
>
> - confirmed behavior → `dflow/specs/domain/Order/behavior.md`
> - buggy implementation → `dflow/specs/migration/tech-debt.md`
> - unknown behavior → `dflow/specs/migration/tech-debt.md` + Open Question
>
> Tech debt to record：
>
> 1. `OrderList` / `OrderEntry` / `OrderDetail` rounding 策略不一致。Severity: Medium。Migration impact：Domain 層應統一 `Money` rounding contract。
> 2. `OrderList.BindGrid()` 的 `isVip` multiplier `0.93m` 來源不明。Severity: Medium。Migration impact：業務確認後決定保留、移除或建立獨立 BR。
>
> Step 3 complete（Code-Behind 已分析，tech-debt 分流已決定）。Entering Step 4: Evaluate Extraction Opportunity.

> **Dflow**：Step 4 — Evaluate Extraction Opportunity。
>
> 這次沒有 implementation，也沒有 extraction decision。Phase 1 原本已經決定抽 `OrderEntry` 的 `DiscountPolicy`；今天新增的資訊只影響後續 scope planning：
>
> - rounding consistency 可能在 Phase 1 內補 `Money` display contract，也可能拆成獨立 lightweight。
> - `isVip` 必須先問業務，不進 Phase 1。
>
> Extraction decision：defer。Baseline-only 路徑不進入 Step 5 implementation。

> **Bob**：也就是今天不開程式、不跑 tests、不更動 phase-spec？

> **Dflow**：對。沒有 BR Delta，也沒有 code change，所以不建新的 `lightweight-spec` / `phase-spec`，也不更新 `rules.md`。但會做 Step 5 style 的 documentation update，讓 host feature 的 dashboard 能接住這次 baseline 結果。

> **Dflow**：Step 5 — Update Documentation（baseline-only path）。
>
> 我會更新三個既有檔案：
>
> 1. `dflow/specs/domain/Order/behavior.md`
>    新增 `Confirmed across pages (baseline-capture 2026-05-04)`，用 Given/When/Then 寫已確認跨頁面行為，並標明 source pages：`OrderList.BindGrid()`、`OrderDetail.LoadDiscountSummary()`、`usp_GetOrderDiscountSummary`。
>
> 2. `dflow/specs/migration/tech-debt.md`
>    新增兩條 debt：rounding precision inconsistency、`isVip` multiplier 來源不明。
>
> 3. `dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md`
>    `Lightweight Changes` 表新增一列：
>
> ```text
> | 2026-05-04 | baseline-capture | OrderList / OrderDetail baseline capture ... | n/a - spec capture only |
> ```
>
>    Description 會外連到 `behavior.md` 與 `tech-debt.md`，並明確註明 baseline-only、無對應 spec 檔。Resume Pointer 也會更新：Phase 1 implementation 仍是 next action；rounding 與 `isVip` 是後續決策。

> **Bob**：很好。`rules.md` 不動，因為沒有新 BR。`models.md` / `context.md` 也不動，因為沒有新 Domain 結構。

> **Dflow**：Documentation updated。這次 baseline capture 的結果不會改變 Phase 1 的主線：下午可以開始實作 `Order` Aggregate、`Money`、`DiscountRate`、`DiscountPolicy`，以及 `OrderEntry.aspx.cs` adapter。
>
> 但 Resume Pointer 會提醒兩件事：
>
> - 本週要 verify rounding consistency 是否納入 Phase 1，或拆成獨立 lightweight。
> - `isVip` multiplier `0.93m` 要問業務，確認它是 legacy promotion 殘留、現役 VIP 特例，還是可以移除的 dead code。

> **Bob**：好。下午開始 Phase 1 implement。rounding 我先不順手修，等我看 `Money` contract 的影響再決定；`isVip` 我會約業務確認，不在這個 branch 裡猜。

## 本段產出的檔案

**新增**
- [`03-baseline-capture.md`](03-baseline-capture.md)

**修改**
- [`dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md)
- [`dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md)
- [`dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

**故意不建 / 不改**
- 不建新的 `lightweight-spec` 或 `phase-spec` — baseline-only 沒有 BR Delta。
- 不動 `dflow/specs/domain/Order/rules.md` — 沒有新增或修改 BR。
- 不動 `dflow/specs/domain/Order/models.md` / `context.md` — 沒有新 Domain structure。
- 不動 `glossary.md` / `context-map.md` — 沒有新 term 或 BC。
- 不動 `sdd-ddd-*-skill/`、`proposals/`、`CHANGELOG.md` 或其他 tutorial 檔案。
- 不 commit、不 push、不建 worktree。

## 觀察重點

- **baseline capture 是 Tier 表外 case**：沒有 BR Delta 時，不應硬塞成 T1 / T2 / T3；但依 Systematic Baseline Capture，它仍是合法且需要 disciplined documentation 的路徑。
- **confirmed / buggy / unknown 分流**：confirmed behavior 進 `behavior.md`；buggy implementation 進 `tech-debt.md`；unknown behavior 進 `tech-debt.md` 與後續 Open Question，不升格成 BR。
- **跨頁面讀取不等於擴張 scope**：`OrderList` / `OrderDetail` 都要讀，但今天不修 rounding、不刪 `isVip`，也不把 Phase 1 變成三頁同步改造。
- **behavior.md 與 tech-debt.md 分工**：`behavior.md` 只保存已確認且符合 BR-001~004 的 current behavior；legacy 疑點與 migration risk 留在 `tech-debt.md`。
- **Resume Pointer 承接下一步**：host feature 的 `_index.md` 要讓下一段 implementation 知道：Phase 1 仍待實作，但跨頁面 baseline 已補，rounding / `isVip` 是後續決策點。

## 下一個劇情段

→ [`04-new-feature.md`](04-new-feature.md)：brownfield 第二個 feature，Bob 會接到全新需求，而不是再修改 Phase 1 的折扣 bug。
