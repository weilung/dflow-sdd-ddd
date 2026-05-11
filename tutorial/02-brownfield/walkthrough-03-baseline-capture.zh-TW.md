# Walkthrough 03 — baseline capture 跨頁面折扣顯示行為

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Brownfield track 裡一個很容易被忽略、但很重要的工作型態：
**baseline capture only**。

它不是一般 feature，也不是 bug fix，也不是 trivial cleanup。Bob 這一天不打算改任何
production code，也不打算新增 business rule。他只是發現：如果只抽 `OrderEntry.aspx.cs`
的折扣計算，`OrderList.aspx` 和 `OrderDetail.aspx` 可能還保留不同的顯示策略，導致同一筆訂單
跨頁面看起來不一致。

所以他要先做一件事：讀 immediate neighbor Code-Behind，把跨頁面現況分成：

- confirmed：已確認且符合目前 BR 的行為
- buggy：看起來錯、但今天不修的行為
- unknown：來源不明，不能寫成 business rule 的 legacy 行為

本篇來源是 [03-baseline-capture.md](03-baseline-capture.md)。本 walkthrough 會把它整理成一份
可教學、可 review 的讀物，讓讀者看懂 Dflow 如何在「不改程式」時仍然累積 domain knowledge。

[note] 本篇引用的 `outputs/` 連結指向 Brownfield 劇情全部跑完後的 final snapshot。
部分檔案在後續 `05-bug-fix.md`、`06-finish-feature.md` 會再被修改。因此，本篇內嵌的
code block 代表 baseline capture 當下的重點片段；連結則提供讀者檢查最終完整文件。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| 沒有要改 code，還需要 Dflow 嗎？ | 需要。baseline capture 可把 confirmed behavior 與 tech debt 分流，避免後續修改盲飛。 |
| 沒有 BR Delta，算哪個 tier？ | 不硬塞 T1/T2/T3；它是 Systematic Baseline Capture 的合法路徑。 |
| 讀到其他頁面有奇怪邏輯，要不要順手修？ | 不順手修。confirmed 進 behavior，buggy / unknown 進 tech debt。 |
| 跨頁面看到相同規則，要不要複製多條 BR？ | 不複製。行為只有一條，source pages 可以列多個。 |
| Brownfield 如何控制 scope？ | 本篇只讀 `OrderList` / `OrderDetail` immediate neighbors，不擴張成三頁同步改造。 |

## 前情提要

上一篇 [walkthrough-02-modify-existing.zh-TW.md](walkthrough-02-modify-existing.zh-TW.md)
中，Bob 已經把經銷商「華昕貿易」的折扣客訴整理成
`SPEC-20260430-001-order-discount-calculation`。

Phase 1 `baseline-and-fix` 的目標是：

1. capture `OrderEntry.aspx.cs` 的折扣計算現況
2. 修正 Senior + full-threshold discount 沒有乘法累積的 bug
3. 把折扣計算抽成 `src/Domain/Order/` 的 pure C# logic

當時 Bob 刻意把 scope 限制在 `OrderEntry.aspx.cs`。但五一連假後，他想到一個風險：

```text
OrderManager 不只 OrderEntry.aspx 會顯示折扣後金額。
OrderList.aspx 和 OrderDetail.aspx 也會顯示。

如果 OrderEntry 之後改成正確的 NT$51,300，
但 OrderList 還顯示 NT$54,000，
使用者會覺得同一筆訂單跨頁面不一致。
```

Bob 不想因此把 phase 1 擴張成三頁全面重構。他只想先知道：

- `OrderList` 是否使用同一個折扣公式？
- `OrderDetail` 的金額來源是什麼？
- 顯示 precision / rounding 是否一致？
- 有沒有其他未確認的 legacy discount 行為？

## Step 1 — Bob 明確說：baseline capture only

Bob 在 AI coding agent 裡輸入：

```text
Bob:
連假前我說今天要開始 Phase 1 implementation，不過週末想到一件事。
OrderList.aspx 和 OrderDetail.aspx 也會顯示折扣後金額。

如果我只抽 OrderEntry.aspx.cs 的折扣邏輯，
其他頁面還是舊算法，UI 可能不一致。

我今天想先做 OrderList.aspx + OrderDetail.aspx 的 baseline capture only，
不修任何 BR，也不改程式。

/dflow:modify-existing
```

這段輸入裡有兩個重要限制：

| 限制 | 作用 |
|---|---|
| baseline capture only | 告訴 Dflow 今天不是實作，也不是 bug fix。 |
| 不修任何 BR，也不改程式 | 防止 AI 看到 rounding bug 或 `isVip` 後順手修掉。 |

Dflow 先跑 modify-existing flow Step 1：Assess the Change。

```text
Dflow:
Part A — Tier 判定：

- T1 Heavy？否。沒有新增 Aggregate、Domain concept、BR 或 data structure。
- T2 Light？否。T2 需要 BR Delta；這次沒有 ADDED / MODIFIED / REMOVED / RENAMED BR。
- T3 Trivial？否。這不是 typo、button color、copy、formatting 或 pure comments；
  它會讀跨頁面 Code-Behind 並更新 behavior 與 tech-debt。

結論：這件事不在 T1 / T2 / T3 範疇內。
```

Bob 問：

```text
Bob:
所以沒 BR Delta 的 work 算什麼 tier？
我不想把它硬塞成 T2，也不想假裝是 T3。
```

Dflow 回答：

```text
Dflow:
你的判斷是對的。
依 modify-existing-flow.md Step 2 的 Systematic Baseline Capture，
baseline-only 不是 Tier 表內的 modification tier，但它是合法路徑。

這條路徑的規則是：

- 讀 related Code-Behind，不只看單頁，但只限 immediate neighbors。
- 只把 confirmed behavior 寫進 BC 層 behavior.md。
- buggy implementation 與 unknown behavior 寫進 tech-debt.md，不要升格成 BR。
- 更新 host feature 的 _index.md Resume Pointer。
- 不需要建立 lightweight-spec 或新的 phase-spec，因為沒有 BR Delta，也沒有 implementation。
```

這是本篇第一個重點：**Dflow 不是所有事情都硬套 tier。**

如果沒有 BR Delta，就不要假裝是 T2。若不是 UI copy / typo，也不要假裝是 T3。
Brownfield 需要這種灰階路徑，因為你常常需要先看清楚 legacy 現況，才能安全修改。

## Step 1 Part B — 找到 host feature

Dflow 接著找這次 baseline capture 屬於哪個 feature。

```text
Dflow:
這次 host feature 是 active 的
SPEC-20260430-001-order-discount-calculation。

Step 1.5 Completed-feature reopen detection：skip。
跳過理由：host feature 還在 active/，不是 completed feature reopen。

Step 1.6 Create Follow-up Feature：skip。
跳過理由：沒有 completed feature follow-up，也沒有建立新 feature。
```

這很重要。Baseline capture 不是散落在 repo 外的筆記，而是掛回正在進行的
`order-discount-calculation` feature。這樣下一個人打開 `_index.md` 時，會看到這次跨頁面
baseline 的結果如何影響 phase 1。

## Step 2 — 讀 immediate neighbors，不掃全系統

Dflow 限定閱讀範圍：

```text
OrderManager.Web/Pages/Order/OrderList.aspx.cs
class OrderList
method BindGrid()
approximate lines 48-97

OrderManager.Web/Pages/Order/OrderDetail.aspx.cs
class OrderDetail
method LoadOrderHeader()
approximate lines 34-66
method LoadDiscountSummary()
approximate lines 72-104
```

這叫 immediate neighbors。Dflow 沒有掃全部 30 個 ASPX pages，也沒有把這一天變成
全系統 audit。

| 做法 | 為什麼 |
|---|---|
| 讀 `OrderList` / `OrderDetail` | 它們直接顯示同一筆訂單的折扣後金額。 |
| 不讀 Shipment / Invoice / Customer 全部頁面 | 那會把 baseline capture 變成無邊界 audit。 |
| 不立刻改 code | Bob 明確說今天只做 baseline。 |

## Finding 1 — confirmed：OrderList 使用 BR-004 乘法累積公式

Dflow 在 `OrderList.BindGrid()` 看到：

```csharp
var fullRate = row.GrossAmount >= 50000m ? 0.10m : 0m;
var tierRate = row.CustomerTier == "Senior" ? 0.05m : 0m;
var totalRate = 1 - (1 - fullRate) * (1 - tierRate);
row.DiscountedTotal = row.GrossAmount * (1 - totalRate);
```

這和上一篇建立的 BR-004 一致：

```text
多個折扣率以乘法累積。
Total discount rate = 1 - (1 - fullThresholdRate) * (1 - customerTierRate)
```

Dflow 的判斷：

```text
Dflow:
公式是對的。
我可以確認 Discounted Total column 使用 BR-004 的乘法累積公式。

但顯示精度還要另外看，因為後面可能有 formatting 或 rounding。
```

這裡的細節值得注意：Dflow 只確認它能確認的事。

- 可以確認：formula 符合 BR-004。
- 不能直接確認：整個頁面顯示一定正確。
- 還要另看：rounding / formatting。

## Finding 2 — confirmed：OrderDetail 使用 shared discount summary source

Dflow 在 `OrderDetail.LoadDiscountSummary()` 看到：

```csharp
var summary = db.Database.SqlQuery<OrderDiscountSummary>(
    "EXEC usp_GetOrderDiscountSummary @OrderId",
    new SqlParameter("@OrderId", orderId)).Single();

lblDiscountedTotal.Text = summary.DiscountedTotal.ToString("N2");
```

它也追到 `OrderList` 的 data source 會帶同一個 summary result。

Dflow 的結論：

```text
Dflow:
OrderList 與 OrderDetail 都接觸到 usp_GetOrderDiscountSummary 這條 summary source。
即使 OrderList.BindGrid() 有自己的 display calculation，
也不要把同一條 BR-004 confirmed behavior 重複寫成兩條規則。

跨頁面看到同一規則時，策略是：
在 behavior.md 寫一個 confirmed-across-pages scenario，
source pages 同時列 OrderList.BindGrid() 與 OrderDetail.LoadDiscountSummary()。
```

Bob 確認：

```text
Bob:
好，不要因為兩個頁面都看到公式，就複製兩段 BR-004。
行為只有一條，source pages 可以列多個。
```

這是第二個重點：**跨頁面看到同一條規則，不代表要複製多條 BR。**

複製規則會讓未來 drift 更容易發生。正確做法是：行為維持一條，來源頁面列清楚。

## Finding 3 — buggy：跨頁面 rounding precision 不一致

Dflow 接著看到 `OrderList.BindGrid()` 最後顯示 grid column 時用整數元：

```csharp
e.Row.Cells[6].Text = decimal.Round(row.DiscountedTotal, 0).ToString("N0");
```

但 `OrderEntry` 與 `OrderDetail` 使用 two-decimal display：

```csharp
Math.Round(total, 2, MidpointRounding.AwayFromZero)
summary.DiscountedTotal.ToString("N2")
```

Dflow 的判斷：

```text
Dflow:
同一筆訂單的 underlying formula 可能一致，
但 OrderList 會顯示整數元，OrderDetail 會顯示到小數兩位。

若折扣後金額帶小數，列表頁可能比明細頁少一兩元的視覺差。
```

Bob 的直覺是想順手修：

```text
Bob:
這個看起來很想順手修。
既然 Phase 1 要做 Money，直接把 rounding 一起統一掉？
```

Dflow 阻止 scope creep：

```text
Dflow:
我建議先不要。
你今天的入口是 baseline capture only，
且 Phase 1 phase-spec 目前把 rounding / tax 處理列為 out of scope。

若現在直接修 rounding，會產生 BR Delta 或至少 display contract Delta，
應該要有 lightweight spec 或 phase scope 調整。

baseline-only 的處理方式是：
把它寫進 tech-debt.md，Severity: Medium，
Migration impact 註明 Domain 層未來應統一 Money rounding contract。
```

這就是 baseline capture 的紀律：**看到 bug 不等於今天修 bug。**

如果今天順手修 rounding，這個 session 就從「baseline-only」變成「behavior change」。
那不是不能做，而是需要改 scope、補 spec、補 tests。

## Finding 4 — unknown：`isVip` multiplier 來源不明

Dflow 又看到：

```csharp
if (customer.IsVip)
{
    discountedTotal *= 0.93m;
}
```

這段沒有註解、沒有 ticket reference，也沒有對應 BR。

Dflow 判斷：

```text
Dflow:
它可能是現役 VIP 特例，也可能是五年前促銷殘留。
它可能與 BR-003 Senior customer 5% off 互斥，也可能可以 stack。

這不能寫進 rules.md，
也不能寫進 behavior.md 當 accepted behavior。
```

Bob 也不想直接刪：

```text
Bob:
0.93 太像業務給過的特例數字了，直接刪可能出事。
```

Dflow 分流到 tech debt：

```text
Dflow:
處理方式是：

- 寫進 tech-debt.md：OrderList isVip multiplier 0.93 規則來源不明。
- 註明無註解、可能與 BR-003 互斥。
- Status: open。
- Note: 待業務確認。確認後才決定保留、移除或正式建立獨立 BR。
```

這是第三個重點：**讀到 legacy 行為，不代表採納 legacy 行為。**

未確認的行為不能進 `rules.md`。如果進了，未來 AI 會把它當成專案語意的一部分。

## Step 2 Summary — confirmed / buggy / unknown 分流

Dflow 整理這次 baseline capture：

| 類型 | 發現 | 寫到哪裡 |
|---|---|---|
| confirmed | `OrderList.BindGrid()` 使用 BR-004 乘法累積公式 | `behavior.md` |
| confirmed | `OrderDetail.LoadDiscountSummary()` 使用 shared discount summary source | `behavior.md` |
| buggy | `OrderList` 整數元 rounding 與其他頁 two-decimal display 不一致 | `tech-debt.md` |
| unknown | `customer.IsVip` 時乘上 `0.93m`，來源不明 | `tech-debt.md` + open question |

這個表就是 baseline capture 的核心輸出。它讓後續 implementation 不再只靠 Bob 的記憶。

## Phase Gate — baseline captured 後才繼續

Dflow 停下來：

```text
Dflow:
Baseline capture 已完成，current behavior 已依分類整理。
接下來進入 Code-Behind 分析與 tech-debt 分流；
若要繼續，請輸入 /dflow:next 或回覆 OK。
```

Bob 回：

```text
Bob:
OK。
```

這個 gate 不像 Greenfield 那樣華麗，但對 brownfield 很重要。它讓 Bob 可以在
baseline 分類錯誤時立刻修正，而不是等文件寫完才發現 Dflow 把 unknown behavior
錯寫成 accepted behavior。

## Step 3 — Code-Behind 分析與 tech-debt 分流

Dflow 進入 Step 3，但這次是簡化版，因為主要資訊已經在 baseline capture 中識別。

```text
Dflow:
這次 Step 3 是簡化版。
現在只做分流：

- confirmed behavior -> dflow/specs/domain/Order/behavior.md
- buggy implementation -> dflow/specs/migration/tech-debt.md
- unknown behavior -> dflow/specs/migration/tech-debt.md + Open Question
```

要新增的 tech debt：

```text
1. OrderList / OrderEntry / OrderDetail rounding 策略不一致
   Severity: Medium
   Migration impact: Domain 層應統一 Money rounding contract

2. OrderList.BindGrid() 的 isVip multiplier 0.93m 來源不明
   Severity: Medium
   Migration impact: 業務確認後決定保留、移除或建立獨立 BR
```

## Step 4 — Evaluate Extraction Opportunity，但這次 defer

這次 baseline capture 不進入實作。

```text
Dflow:
這次沒有 implementation，也沒有 extraction decision。
Phase 1 原本已經決定抽 OrderEntry 的 DiscountPolicy；
今天新增的資訊只影響後續 scope planning：

- rounding consistency 可能在 Phase 1 內補 Money display contract，
  也可能拆成獨立 lightweight。
- isVip 必須先問業務，不進 Phase 1。

Extraction decision：defer。
Baseline-only 路徑不進入 Step 5 implementation。
```

Bob 確認：

```text
Bob:
也就是今天不開程式、不跑 tests、不更動 phase-spec？
```

Dflow 回答：

```text
Dflow:
對。
沒有 BR Delta，也沒有 code change，
所以不建新的 lightweight-spec / phase-spec，也不更新 rules.md。

但會做 documentation update，
讓 host feature 的 dashboard 能接住這次 baseline 結果。
```

這裡再次展示 Dflow 的克制：

| 不做 | 原因 |
|---|---|
| 不建 `lightweight-spec` | 沒有 BR Delta。 |
| 不建新 `phase-spec` | 沒有新 implementation slice。 |
| 不更新 `rules.md` | 沒有新增或修改 BR。 |
| 不改 code | Bob 明確要求 baseline-only。 |
| 不跑 tests | 沒有 implementation。 |

## Step 5 — Documentation update

Baseline-only path 仍然會寫文件，但只寫該寫的文件。

### `behavior.md` 新增 confirmed-across-pages

本步驟當下新增的重點片段：

```markdown
## Confirmed across pages (baseline-capture 2026-05-04)

### BR-004: OrderList discounted total uses compound discount accumulation

Source pages:
OrderManager.Web/Pages/Order/OrderList.aspx.cs class OrderList, method BindGrid();
OrderManager.Web/Pages/Order/OrderDetail.aspx.cs class OrderDetail, method LoadDiscountSummary().

Given 同一筆 order 同時符合 full-threshold discount 與 Senior customer discount
When OrderList.BindGrid() 計算 Discounted Total column
Then 使用 1 - (1 - fullRate) * (1 - tierRate) 作為 total discount rate
And 公式與 BR-004 compound discount accumulation 一致

### BR-004: OrderDetail discount summary uses the shared discount summary source

Given OrderList 與 OrderDetail 顯示同一個 OrderId
When 兩個頁面都從 usp_GetOrderDiscountSummary 載入 discount summary data
Then 在相同 inputs 下，discounted total 的 source 一致
And 兩個頁面預期都反映 BR-004 compound discount accumulation
```

完整 final snapshot：
[`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md)

[note] final snapshot 還包含後續 `SPEC-20260505-002` 的 VIP discount behavior。
本篇 baseline capture 當下只新增 `Confirmed across pages` 區塊。

### `tech-debt.md` 新增 buggy / unknown items

本步驟當下新增的重點片段：

```markdown
| Item | Location | Description | Severity | Status |
|---|---|---|---|---|
| OrderList / OrderEntry / OrderDetail rounding 策略不一致 | OrderList.aspx.cs / OrderEntry.aspx.cs / OrderDetail.aspx.cs | OrderList 使用 decimal.Round(value, 0)，OrderEntry / OrderDetail 使用 two-decimal display，可能造成跨頁視覺金額差異。 | Medium | open |
| OrderList isVip multiplier 0.93 規則來源不明 | OrderList.aspx.cs BindGrid() | if (customer.IsVip) discountedTotal *= 0.93m 沒有註解或 ticket reference，且可能與 Senior 5% off 互斥。 | Medium | open |
```

完整 final snapshot：
[`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

[note] final snapshot 中這兩項後來被後續劇情處理：rounding inconsistency 由 BUG-001 修正，
`isVip` multiplier 後來確認為 dead code。這不改變本篇 baseline capture 的教學重點：
當下它們都不能被直接寫成 accepted BR。

### `_index.md` 新增 baseline-capture row

Host feature dashboard 也要知道這次 baseline capture 發生過：

```markdown
## Lightweight Changes

| Date | Type | Description | Commit |
|---|---|---|---|
| 2026-05-04 | baseline-capture | Baseline-only capture：已補 OrderList.aspx.cs 與 OrderDetail.aspx.cs 的跨頁 confirmed behavior；新發現的 rounding / isVip debt 已記錄於 tech-debt.md。本 row 無對應 spec 檔。 | n/a - spec capture only |
```

完整 final snapshot：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)

這個 row 不叫 T1 / T2 / T3。它的 Type 是 `baseline-capture`。這比硬塞 tier 更清楚。

## 本步驟產生或更新的文件

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 修改 | [`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md) | `Confirmed across pages` 區塊，記錄 OrderList / OrderDetail 對 BR-004 的確認。 |
| 修改 | [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | rounding inconsistency 與 `isVip` multiplier 來源不明。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md) | baseline-capture row 與後續 resume context。 |
| 故意不建 | `lightweight-*.md` | 沒有 BR Delta，不建立 lightweight spec。 |
| 故意不建 | `phase-spec-*.md` | 沒有新的 implementation slice。 |
| 故意不改 | `rules.md` | 沒有新增或修改 accepted BR。 |
| 故意不改 | `models.md` / `context.md` | 沒有新增 Domain structure。 |

## README feature claims 在這裡如何被驗證

| README claim | 本篇可看到的證據 |
|---|---|
| Brownfield track | 不重寫 WebForms；只讀 immediate neighbor Code-Behind 並更新 baseline docs。 |
| Spec-first development | 即使不改 code，也先把 confirmed behavior 與 tech debt 放進 spec/doc surface。 |
| Hybrid workflow control | Bob 明確宣告 baseline-only；Dflow 不自動升級成 bug fix 或 implementation。 |
| DDD semantic backbone | `behavior.md` 只收 accepted behavior，未知 legacy 行為不進 rules。 |
| Three-layer documentation model | host feature `_index.md` 記錄 baseline-capture row；system-level `behavior.md` / `tech-debt.md` 分別保存 confirmed / risk。 |
| Drift verification readiness | 後續如果 rounding 被修，reviewer 可看到它原本是 tech debt，而不是沉默改動。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| scope creep | 看到 rounding bug 就順手修，session 從 baseline 變 implementation。 | Dflow 保持 baseline-only，buggy item 進 tech debt。 |
| unknown legacy 行為被採納 | `isVip * 0.93` 被寫進新 DiscountPolicy，之後沒人知道來源。 | 未確認行為只進 tech debt / open question，不進 rules。 |
| 重複 BR | OrderList / OrderDetail 各寫一條 BR-004，後續 drift。 | behavior 寫一條 confirmed-across-pages scenario，列 source pages。 |
| 無上下文接續 | 下午實作 phase 1 時忘記跨頁面風險。 | host `_index.md` baseline-capture row 保留 resume context。 |
| migration blind spot | 未來搬到 ASP.NET Core 時才發現 display precision 不一致。 | tech debt 提前記錄 Money display contract 風險。 |

## 對不熟 Brownfield baseline capture 的讀者的讀法

這篇最重要的不是程式碼，而是分類能力。

讀 legacy code 時，先不要急著問「我要不要修」。先問：

1. **這是 confirmed behavior 嗎？**
   如果是，寫進 `behavior.md`，但不要重複建立多條 BR。

2. **這是 buggy implementation 嗎？**
   如果是，寫進 `tech-debt.md` 或正式 bug-fix flow；不要悄悄修。

3. **這是 unknown behavior 嗎？**
   如果業務沒確認，不能寫進 `rules.md`。先記 open question。

4. **這次 session 的 scope 是什麼？**
   Bob 說 baseline-only，就不要自動變成 implementation session。

這種分類看起來慢，但它會防止 brownfield 專案最常見的風險：越修越多、越看越怕、
最後把一個小問題變成沒有邊界的大重構。

## Key takeaways

- Baseline-only work 不必硬塞 T1 / T2 / T3；它是 Systematic Baseline Capture 的合法路徑。
- Confirmed behavior 進 `behavior.md`；buggy / unknown 進 `tech-debt.md` 或 open question。
- 跨頁面看到同一條規則時，行為只寫一條，source pages 列清楚。
- 看到 bug 不等於今天修 bug；如果要修，就要改 scope 並補 spec / tests。
- Brownfield Dflow 的價值不只是「改對」，還包含「先知道現在到底是什麼」。

## 下一個 walkthrough

下一個 Brownfield walkthrough 可接 [04-new-feature.md](04-new-feature.md)：
Bob 在已經建立 Order BC 後接到新的 VIP discount policy 需求。那一篇會展示：

- Brownfield 專案已有 BC 後，`/dflow:new-feature` 如何建立第二個 feature
- `isVip` unknown debt 如何被業務確認或重新建模
- 新 feature 如何沿用 `Order` BC 的既有 BR-001~004
- 如何避免把 Customer BC 過早建出來
