# Walkthrough 05 — `/dflow:bug-fix` 修正跨頁 rounding inconsistency

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Brownfield track 裡的 lightweight bug-fix path：bug 已經有清楚
expected-versus-actual boundary，也已在前面的 baseline capture 中被識別為 tech debt。
Bob 這次不是新增業務規則，不是建立新 bounded context，也不是把 WebForms 整頁重構；
他要做的是把一個客戶已經撞上的跨頁顯示問題，收斂成可追蹤、可回歸測試的 T2 bug spec。

本篇把 Bob 與 Dflow 的 bug-fix 對話整理成一份可教學、可 review 的讀物，讓讀者看懂：

- 為什麼入口是 `/dflow:bug-fix`
- 為什麼這是 T2 Light，而不是 T1 new phase 或 T3 trivial fix
- 為什麼 BUG-001 要掛回 `SPEC-20260430-001`，不放進剛建立的 VIP feature
- 為什麼 `Money.ToDisplay(precision = 2)` 是 implementation contract 收斂，不是 BR Delta
- 為什麼 Current BR Snapshot 不 regenerate，卻要明確寫 note
- T2 bug spec 如何更新 feature `_index.md` 與 `tech-debt.md`

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Brownfield 劇情跑完後的
最終狀態；本步驟當下，BUG-001 仍掛在 active feature 底下，並在後續 closeout 後隨整個
feature 移到 `features/completed/`。只讀本篇也能看懂 BUG-001 的歸屬；若想看 active /
completed snapshot 的完整讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.zh-TW.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| `/dflow:bug-fix` 和 `/dflow:modify-existing` 有什麼差別？ | bug-fix 走 modify-existing flow，但預設 lightweight ceremony，先找 expected-versus-actual boundary。 |
| 已知 tech debt 被客戶撞上時怎麼處理？ | 從 `tech-debt.md` 反查來源，建立 `BUG-001`，再把 debt resolved。 |
| bug 發生在 VIP 試用期間，為什麼不歸 VIP feature？ | host feature 依 defect source 判定；rounding debt 來自 SPEC-001 baseline capture。 |
| `Money` VO 加 method 算不算 DDD 變更？ | 算 code-level implementation 收斂，但不新增 VO equality component、不新增 BR。 |
| 沒有 BR Delta，要不要更新 BR Snapshot？ | 不 regenerate，但在 `_index.md` 寫清楚原因，避免 reviewer 誤判為漏更。 |

## 前情提要

到本篇開始時，Bob 已經完成幾個重要步驟：

1. [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.zh-TW.md)
   建立 `SPEC-20260430-001-order-discount-calculation`，把第一批折扣規則抽到
   Order BC。
2. [〈Walkthrough 03 — baseline capture 跨頁面折扣顯示行為〉](walkthrough-03-baseline-capture.zh-TW.md)
   baseline-only 讀 `OrderList` / `OrderDetail`，發現跨頁 rounding inconsistency，
   但當天不修，先記到 `tech-debt.md`。
3. [〈Walkthrough 04 — `/dflow:new-feature` 在既有 Order BC 上新增 VIP discount policy〉](walkthrough-04-new-feature.zh-TW.md)
   新增 `SPEC-20260505-002-vip-discount-policy`，讓 Order BC 擴張 VIP 合約折扣。

`walkthrough-03` 當時已經留下這個 debt：

```markdown
| Item | Location | Description | Severity | Status |
|---|---|---|---|---|
| OrderList / OrderEntry / OrderDetail rounding 策略不一致 | OrderList.aspx.cs / OrderEntry.aspx.cs / OrderDetail.aspx.cs | OrderList 使用 decimal.Round(value, 0)，OrderEntry / OrderDetail 使用 two-decimal display，可能造成跨頁視覺金額差異。 | Medium | open |
```

當時它還只是風險。Bob 沒有順手修，因為 session scope 是 baseline-only。
到了本篇，這個風險被真實客戶撞上，性質就從「已知 migration debt」變成「需要 T2 bug spec
與 regression test 的明確 defect」。

## 劇情背景

2026-05-08 週五早上，`SPEC-20260505-002-vip-discount-policy` 已完成 implementation
並上線試用 2 天。Bob 原本準備整理本週收尾計畫，結果在 Slack 看到試用主管 Carol
的訊息：

```text
Carol:
我看一筆訂單 #ORD-2026-0512：
OrderList grid 顯示折扣後 NT$45,127，
我點進去 OrderDetail 顯示 NT$45,126.85，
差 0.15 元。

客戶剛打電話來問為什麼兩頁金額不一樣？
我跟他說我會查。
```

Bob 立刻 verify：

- 這不是 VIP feature 的新問題。
- 這不是 BR-001~004 的折扣公式錯誤。
- 這不是 `ContractValidUntil` 或 VIP eligibility 判斷錯誤。
- 這正是前面 baseline capture 已記錄的 rounding inconsistency。

所以 Bob 在 AI coding agent 裡輸入：

```text
Bob:
Carol 早上回報一筆訂單 #ORD-2026-0512，
OrderList 顯示折扣後 NT$45,127，
點進 OrderDetail 顯示 NT$45,126.85，
客戶來電問為什麼兩頁不一致。

我 verify 後確認是段 3 已記錄的 rounding inconsistency，
不是 VIP discount policy，也不是 BR-001~004 的公式錯。

/dflow:bug-fix
```

這段輸入有兩個重點：

| 重點 | 作用 |
|---|---|
| expected-versus-actual 明確 | `OrderList` 顯示 NT$45,127，`OrderDetail` 顯示 NT$45,126.85。 |
| 排除錯誤歸因 | Bob 先說明不是 VIP policy，也不是 BR formula。 |

這讓 Dflow 可以維持 lightweight，不需要重新展開整個 Order discount design。

## Step 1 — Assess the Change：判定 T2 Light

Dflow 先釐清 `/dflow:bug-fix` 的性質：

```text
Dflow:
收到。這是 /dflow:bug-fix，
不是 Git Flow 的 hotfix branch；
它走 modify-existing flow 的 lightweight ceremony。

我先跑 Step 1：Assess the Change。
這一步同時判斷 Ceremony Tier 與 Feature Linkage。
```

Tier 判定：

```text
Dflow:
Part A - Tier 判定：

- T1 Heavy？否。
  沒有新 BR、沒有新 Aggregate、沒有新 VO 結構變化、沒有 data structure change。
  Money VO 加 method 是 implementation contract 收斂，不是 architectural change。

- T2 Light？是。
  這是試用期間客戶撞上的明確 bug，
  範圍包含 Domain Money VO 加 ToDisplay(precision = 2) method，
  以及 Presentation 三個頁面改 call 同一 contract。
  BR 不變，但 observable display 行為會被修正。

- T3 Trivial？否。
  這不是 typo、button color 或 copy fix；
  顯示精度會改變，且需要 root cause、fix approach 與 regression tests 的獨立紀錄。

結論：T2 Light。
```

Bob 確認：

```text
Bob:
同意。這次不應該升成新 phase，
但也不是 _index.md 加一行就好。
客戶已經看到跨頁金額不同，需要獨立 bug spec。
```

這是本篇第一個 lesson：**bug-fix 不等於最小 ceremony。**

若只是 typo 或 UI copy，可能是 T3。若 bug 揭露新 BR 或新的 Domain concept，可能升級成
T1。但這次介於中間：沒有 BR Delta，卻有 observable behavior fix、root cause、
implementation tasks 與 regression test，所以是 T2。

## Step 1 Part B — Host feature 要追 defect source

Dflow 接著判斷 bug spec 要掛在哪個 feature：

```text
Dflow:
Part B - Feature Linkage。
這裡要特別小心 host feature。

我看到兩個 active features：

SPEC-20260430-001-order-discount-calculation
SPEC-20260505-002-vip-discount-policy
```

直覺上，有人可能想放進 `SPEC-20260505-002`。畢竟 Carol 是 VIP feature 試用期間回報。
但 Dflow 不這樣做：

```text
Dflow:
我建議 host feature 用：

SPEC-20260430-001-order-discount-calculation

理由：

- rounding inconsistency 是段 3 在 SPEC-001 baseline capture 時識別的 tech-debt entry。
- defect 涉及 Money display contract 與跨頁折扣後金額呈現，
  不是 VIP 7% off、合約有效期或 CustomerTier = VIP 議題。
- SPEC-001 status 仍是 in-progress，
  phase 1 已 ship 但尚未 /dflow:finish-feature，
  可以承接 T2 lightweight bug spec。
- 不歸 SPEC-002。
  bug fix 不混入剛建立的新 feature scope，
  避免讓 VIP feature history 看起來承擔 unrelated rounding defect。
```

Bob 強調：

```text
Bob:
這點我也想強調。
SPEC-002 是新 VIP policy，
rounding bug 是 SPEC-001 的 tech-debt。
不要因為客戶是在 VIP 試用期間撞到，
就把它塞進 VIP feature。
```

這是本篇第二個 lesson：**host feature 追 defect source，不追發現時機。**

| 可能歸屬 | 判斷 |
|---|---|
| SPEC-002 VIP feature | 錯。bug 發現時機在 VIP 試用期，但 root cause 不屬 VIP policy。 |
| SPEC-001 Order discount calculation | 對。rounding debt 由 SPEC-001 baseline capture 發現，且影響 Order 金額顯示。 |

## Step 1 — BUG-NUMBER 命名

Dflow 建議檔名：

```text
Dflow:
檔名我建議用 BUG-NUMBER 格式：

BUG-001-rounding-inconsistency.md

T2 lightweight 有兩種合法命名：
lightweight-{date}-{slug}.md 或 BUG-{NUMBER}-{slug}.md。

這次是試用期間客戶反饋的明確 bug，
而且是 SPEC-001 directory 內第一個 BUG，
所以從 BUG-001 起算。
這樣 bug queue、Slack 訊息和 regression tests 可以對齊。
```

Bob 同意：

```text
Bob:
好，用 BUG-001-rounding-inconsistency.md。
讓同事看到 BUG-NUMBER 命名的用途。
```

本步驟當下路徑是：

```text
dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/
└── BUG-001-rounding-inconsistency.md
```

完整文件範例在後續 closeout 後位於：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md)

## Step 1.5 / 1.6 — 不 reopen、不開 follow-up feature

Dflow 做兩個 guard checks：

```text
Dflow:
Step 1.5 - Completed-feature reopen detection：skip。

跳過理由：
host feature 在 dflow/specs/features/active/，
不是 completed feature，不觸發 completed-feature reopen。

Step 1.6 - Create Follow-up Feature：skip。

跳過理由：
沒有 completed feature follow-up；
BUG-001 直接掛在 active SPEC-001 下。
```

這裡要注意：完整文件範例裡 SPEC-001 後來已經移到 completed，但那是 06 closeout 之後的結果。
在 05 當下，SPEC-001 仍 active，所以不需要 reopen completed feature。

## Step 2 — Check Documentation：先讀文件，不直接改 code

Dflow 先讀現有文件：

```text
Dflow:
Step 2 我會先讀現有文件，不直接改程式：

- SPEC-20260430-001-order-discount-calculation/_index.md
- phase-spec-2026-04-30-baseline-and-fix.md
- dflow/specs/domain/Order/rules.md
- dflow/specs/domain/Order/models.md
- dflow/specs/migration/tech-debt.md
```

讀到的 baseline：

```text
Dflow:
- BR-001~004 已描述 pre-discount total、滿額折扣、
  Senior 折扣與 compound discount accumulation。
- Money VO 已存在，負責表示 amount + currency；
  目前 rounding 延續 OrderEntry 既有規則。
- DiscountPolicy 已是折扣計算 owner；
  SPEC-002 只擴張 VIP path，沒有改掉 BR-001~004。
- tech-debt.md 的 rounding inconsistency entry 仍是 open；
  isVip multiplier entry 已由 Daniel 確認 dead code 並 resolved。

這次 BR-001~004 wording 不變。
rounding inconsistency 是 Presentation-layer display rounding contract drift，
不是 BR-level delta。
```

Bob 確認 root cause：

```text
Bob:
對，DiscountPolicy 算出來的折扣後金額沒有錯，
錯在每頁顯示時各自 round。
這不應該變成 BR-005 或修改 BR-004。
```

這是本篇第三個 lesson：**不是所有使用者看得到的問題都是 BR Delta。**

跨頁面顯示不一致是 observable bug，但修正點在 display contract。若把它寫成新的
business rule，會讓 Order BC 的 BR index 變得不乾淨。

## Step 3 — Assess DDD Impact

Dflow 依 bug-fix ceremony 先採保守判斷：

```text
Dflow:
Step 3 - DDD Impact。

依 /dflow:bug-fix 的 ceremony adjustment，
Step 3 預設是 no DDD impact, fix in place，
除非 bug 本身在 Domain logic 或揭露 business rule 設計錯誤。

我的初判：

- Aggregate boundary：不變。Order 還是 aggregate root。
- Domain Events：無。
- Value Object structure：不變。Money 還是 amount + currency，不新增 equality component。
- Business Rules：不新增、不修改、不移除、不 rename。
- Data structure：無 schema change。
```

但 Dflow 也指出一個 implementation 收斂點：

```text
Dflow:
這裡有一個 implementation 收斂點：
Money 可以提供 ToDisplay(precision = 2)，
讓 Presentation 層不再各自決定 display precision。
```

Bob 問：

```text
Bob:
Money VO 加 ToDisplay(precision) method 算 Domain 層變化嗎？
要不要正式寫進 BR？
```

Dflow 回答：

```text
Dflow:
算 Domain code 的小幅 implementation change，
但不算新的 Domain concept 或 BR Delta。

判斷邏輯是：

1. 它不改 Money 的 invariant。金額與幣別仍是核心狀態。
2. 它不改 DiscountPolicy 如何計算折扣。
3. 它不新增業務可決策的規則語句。
   Carol 的問題是「同一筆訂單跨頁顯示要一致」，
   不是「新增一條折扣政策」。
4. 它把已存在的顯示慣例收斂成 single contract，
   避免 WebForms page 各自 round。

所以寫在 BUG-001 的 Implementation Tasks，
不寫進 BR-001~004，也不更新 dflow/specs/domain/Order/models.md。

如果未來要討論多幣別、locale-specific formatter 或 invoice rounding，
那才是新的 scope 或 tech-debt。
```

Bob 確認：

```text
Bob:
好。ToDisplay(precision = 2) 預設兩位小數，
符合目前財務顯示慣例；
但我們不把它講成新 business rule。
```

這段是本篇的 DDD 重點：**Value Object 可以承接 implementation contract，
但不代表每個 method 都要升格成 domain rule。**

## Step 3 — Implementation tasks

Dflow 把決議整理成 tasks：

```markdown
## Implementation Tasks

- [ ] DOMAIN-1: `Money` VO 加 `ToDisplay(precision = 2)` method，維持既有 amount + currency invariants。
- [ ] WEBFORMS-1: `OrderList.BindGrid()` column formatter 改用 `Money.ToDisplay()`。
- [ ] WEBFORMS-2: `OrderDetail.LoadDiscountSummary()` 改用 `Money.ToDisplay()`。
- [ ] WEBFORMS-3: `OrderEntry` 顯示折扣後金額時確認 align 到同一 display contract。
- [ ] TEST-1: 同一 Order 在 `OrderList` / `OrderEntry` / `OrderDetail` 顯示折扣後金額一致。
- [ ] TEST-2: `Money.ToDisplay` edge cases：0、負數、大數、boundary precision。
- [ ] DOC-1: 更新 `_index.md` Lightweight Changes、BR Snapshot note 與 `tech-debt.md` resolved note。
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md)

Dflow 也設下 scope guard：

```text
Dflow:
這仍是 T2。
如果開始討論全站 currency formatting、locale、tax / invoice rounding
或多幣別顯示，就要停下來另開 follow-up，
不放進本 BUG-001。
```

這個 guard 防止一個客戶回報變成全站格式化重構。

## Step 4 — Extraction decision：narrow extraction

Bob 說：

```text
Bob:
可以。這段 tutorial 先落 spec 和 docs。
我下午再讓工程師照 BUG-001 implement。
```

Dflow 回：

```text
Dflow:
OK。Implementation plan captured。
Step 4 extraction decision：extract now but narrowly。

這裡不是把整個 WebForms adapter 抽乾，
而是把 display rounding contract 收斂到 Money 周邊；
周邊 EF query、Grid binding、page lifecycle 仍維持原狀。
Ready to update documentation.
```

這裡的「extract now」不是大重構。它只抽一個共用顯示 contract：

| 不抽 | 仍留在 WebForms |
|---|---|
| EF query | `OrderEntry` / `OrderList` / `OrderDetail` 既有資料來源維持。 |
| Grid binding | `OrderList.BindGrid()` 仍是 WebForms page responsibility。 |
| Page lifecycle | `Page_Load`、controls、event handler 不在本 bug fix 重構。 |

| 抽 | 移到共用 contract |
|---|---|
| 折扣後金額 display precision | `Money.ToDisplay(precision = 2)`。 |

這就是 Brownfield bug-fix 的克制：修到讓 bug 不再發生，但不把所有周邊問題一次拉進來。

## Step 5 — Update Documentation

Dflow 產生 documentation package：

```text
Dflow:
Step 5 - Update Documentation。

我會做三件事：

1. 新增 T2 bug lightweight spec：

   dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md

2. 更新 SPEC-001 _index.md：

   - Lightweight Changes 表新增 2026-05-08 / T2 row。
   - Description 外連 BUG-001-rounding-inconsistency.md。
   - Current BR Snapshot 不 regenerate。
   - Resume Pointer 改成「下一步實作 BUG-001；後續考慮 SPEC-001 finish-feature」。

3. 更新 dflow/specs/migration/tech-debt.md：

   - rounding inconsistency entry status 從 open 改為 resolved。
   - resolved note 寫：
     2026-05-08 由 SPEC-20260430-001 BUG-001 修正，
     Domain Money VO 提供統一 ToDisplay() contract，
     三頁面改 call 同一 contract。
   - Follow-up Notes 補 disposition，方便 reviewer 從 tech-debt 反查 BUG-001。
```

### BUG-001 lightweight spec

BUG-001 的 Problem section：

```markdown
## Problem

試用主管 Carol 回報訂單 `#ORD-2026-0512` 在 `OrderList` grid 顯示折扣後金額為 NT$45,127，
但點進 `OrderDetail` 後顯示 NT$45,126.85，兩頁視覺金額差 0.15 元，
客戶已來電詢問為什麼同一筆訂單金額不一致。

這不是新的折扣規則。段 3 baseline capture 已把跨頁 rounding 策略不一致記為 tech-debt，
今天是同一個 defect 被實際客戶撞上。
```

Behavior Delta 明確說沒有 BR 變動：

```markdown
## Behavior Delta

### ADDED - BR / behavior added

None.

### MODIFIED - behavior modified in this fix

None.

### REMOVED - BR removed

None.

### RENAMED - BR renamed

None.

### UNCHANGED - explicitly unaffected

- BR-001~004 wording unchanged — root cause is Presentation-layer display rounding contract drift, not BR-level delta.
- `Money` 既有不變條件維持：金額 + 幣別仍是 equality components；不新增 Aggregate / VO 結構。
- `DiscountPolicy` 折扣計算結果不變；本修正只收斂跨頁 display contract。
```

Root Cause 與 Fix Approach：

```markdown
## Root Cause

`OrderList.BindGrid()` 使用 `decimal.Round(value, 0)` 將折扣後金額顯示為整數元；
`OrderEntry` / `OrderDetail` 使用 `Math.Round(value, 2)` 或 `ToString("N2")`
顯示到小數兩位。三個頁面各自決定 display precision，
導致同一筆訂單在列表頁與明細頁呈現不同視覺金額。

## Fix Approach

在 Domain `Money` VO 周邊新增 `ToDisplay(precision = 2)` method，
讓頁面顯示折扣後金額時共用同一個 display contract。
預設 precision 為 2 位小數，對齊目前 `OrderEntry` / `OrderDetail` 的財務顯示慣例。

這是 implementation 收斂，不是新 business rule：
不改 `Money` invariant、不改 `DiscountPolicy` 折扣公式、不更新 BR-001~004 wording。
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md)

### `_index.md` Lightweight Changes 與 BR Snapshot note

`_index.md` 新增 T2 row：

```markdown
| Date | Type | Description | Commit |
|---|---|---|---|
| 2026-05-08 | T2 | Bug-fix: 修正 `OrderList` / `OrderEntry` / `OrderDetail` 跨頁 display rounding inconsistency，見 [`BUG-001-rounding-inconsistency.md`](./BUG-001-rounding-inconsistency.md)。 | n/a - implemented before closeout |
```

Current BR Snapshot 下方加 note：

```markdown
2026-05-08 BUG-001 note: Current BR Snapshot intentionally not regenerated.
BR-001~004 wording unchanged; the root cause is Presentation-layer display rounding contract drift,
not a BR-level delta.
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)

Bob 特別要求這點：

```text
Bob:
BR Snapshot 不 regenerate 這點請寫清楚。
Reviewer 如果只看到 T2 spec，可能會問為什麼沒有刷新 snapshot。
```

Dflow 回：

```text
Dflow:
會。我會在 _index.md Current BR Snapshot 區塊下加明確 note：
BUG-001 沒有 BR wording 變更，因此 snapshot 保持 BR-001~004 當前狀態；
這不是漏更。
```

這是本篇第四個 lesson：**不更新也要可審查。**

如果 spec 不需要 regenerate snapshot，文件要說明理由。這樣 reviewer 才能分辨
「刻意不改」和「漏改」。

### `tech-debt.md` resolved note

`tech-debt.md` 中的 rounding item 從 open 變 resolved：

```markdown
| Item | Location | Description | Severity | Migration impact | Status |
|---|---|---|---|---|---|
| OrderList / OrderEntry / OrderDetail rounding 策略不一致 | `OrderManager.Web/Pages/Order/OrderList.aspx.cs` / `OrderEntry.aspx.cs` / `OrderDetail.aspx.cs` | `OrderList.BindGrid()` 使用 `decimal.Round(value, 0)` 顯示整數元，`OrderEntry` / `OrderDetail` 使用 `Math.Round(value, 2)` 或 `ToString("N2")` 顯示到小數兩位，可能造成同一筆訂單跨頁視覺金額差異。Resolved note: 2026-05-08 由 SPEC-20260430-001 BUG-001 修正，Domain Money VO 提供統一 `ToDisplay()` contract，三頁面改 call 同一 contract。 | Medium | Domain 層應統一 `Money` rounding / display precision contract，避免 ASP.NET Core migration 時把頁面差異一起搬過去。 | resolved |
```

Follow-up note：

```markdown
- `OrderList / OrderEntry / OrderDetail rounding 策略不一致` disposition:
  2026-05-08 歸屬 `SPEC-20260430-001` 的 `BUG-001-rounding-inconsistency.md`；
  修正方向為 `Money.ToDisplay()` display contract + 三頁面 Presentation 層統一呼叫。
```

完整文件範例：
[`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

## Step 5 — 故意不改的文件

Dflow 明確列出不改項：

```text
Dflow:
故意不改：

- 不動 SPEC-20260505-002 directory，避免污染 VIP feature scope。
- 不改 dflow/specs/domain/Order/{rules,context,behavior,glossary}.md，
  因為 BR 與 Domain 概念不變。
- 不改 dflow/specs/domain/Order/models.md，
  因為 Money 結構不變，加 method 是 implementation detail。
- 不改 dflow/specs/domain/{glossary,context-map}.md。
```

這份「故意不改」清單不是多餘的。Brownfield bug-fix 很常發生兩種錯：

| 錯誤 | 結果 |
|---|---|
| 看到 `Money` method 就更新 `models.md` | 把 implementation detail 誤寫成 model catalog 變化。 |
| 看到客戶回報在 VIP trial 期間發生，就改 SPEC-002 | 污染 VIP feature history。 |

把不改項寫清楚，reviewer 可以更快確認 scope 沒有滑走。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/BUG-001-rounding-inconsistency.md) | T2 bug spec：Problem、Behavior Delta、Root Cause、Fix Approach、Implementation Tasks。 |
| 修改 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md) | Lightweight Changes row、BR Snapshot intentionally unchanged note、後續 closeout integration summary。 |
| 修改 | [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | rounding inconsistency 從 open 變 resolved，並連回 BUG-001。 |
| 故意不改 | `SPEC-20260505-002-vip-discount-policy/` | rounding bug 不屬 VIP policy scope。 |
| 故意不改 | `outputs/dflow/specs/domain/Order/rules.md` | 沒有 ADDED / MODIFIED / REMOVED / RENAMED BR。 |
| 故意不改 | `outputs/dflow/specs/domain/Order/models.md` | `Money` equality components / invariant 不變；`ToDisplay()` 是 implementation contract。 |
| 故意不改 | `outputs/dflow/specs/domain/Order/context.md` / `behavior.md` / `glossary.md` | 沒有新增 Domain concept 或 accepted behavior section。 |

上表連到完整文件範例；本篇只關注 BUG-001 建立與 SPEC-001 active 時的 lightweight update。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Brownfield track | 不重寫 WebForms；只把三頁面顯示 rounding contract 收斂到 `Money.ToDisplay()`。 |
| Spec-first development | 先建立 BUG-001，寫清 root cause / fix approach / regression tests，再交給工程師 implement。 |
| Hybrid workflow control | `/dflow:bug-fix` 走 lightweight ceremony；Dflow 不自動升成 new feature。 |
| DDD semantic backbone | Dflow 判斷 `Money` method 不改 invariant、不新增 BR，保持 Domain docs 乾淨。 |
| 三層文件分工 | BUG-001 管本次 fix，feature `_index.md` 記 lightweight row，`tech-debt.md` 記 disposition。 |
| Drift verification readiness | Regression tasks 要求同一 Order 在 `OrderList` / `OrderEntry` / `OrderDetail` 顯示一致。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| bug 歸錯 feature | 因為發生在 VIP 試用期間，就塞進 SPEC-002。 | host feature 追 defect source，歸 SPEC-001。 |
| 小 bug 變大重構 | 開始改全站 currency formatter、locale、invoice rounding。 | BUG-001 明確限制為三頁面 display precision contract。 |
| BR index 污染 | 把「跨頁顯示一致」寫成新折扣 BR。 | Behavior Delta 全部寫 None / Unchanged，BR-001~004 不動。 |
| reviewer 誤判漏更 | BR Snapshot 沒更新但沒有說明。 | `_index.md` 加 intentionally not regenerated note。 |
| tech debt 永遠 open | 客戶撞上後只修 code，不回寫 debt disposition。 | `tech-debt.md` resolved note 連回 BUG-001。 |

## 對不熟 Brownfield bug-fix 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **bug 的 expected-versus-actual 是什麼？**
   本篇答案是同一筆 `#ORD-2026-0512` 在 `OrderList` 與 `OrderDetail`
   顯示不同金額。

2. **bug 的 source 是哪個 feature / debt？**
   本篇答案是 `SPEC-20260430-001` 的 baseline-capture rounding debt。

3. **有沒有 BR Delta？**
   本篇答案是沒有；折扣計算不變，修的是 Presentation display contract drift。

4. **修到哪裡停？**
   本篇答案是三頁面改用 `Money.ToDisplay()`；locale、多幣別、invoice rounding
   全部 deferred。

Brownfield bug-fix 的價值不只是把 bug 修掉，而是讓修復的責任、文件與 regression
boundary 都保持清楚。這樣下一個人看到 `BUG-001` 時，不需要重新猜為什麼這不是
VIP feature，也不需要猜為什麼 BR Snapshot 沒變。

## Key takeaways

- `/dflow:bug-fix` 走 lightweight ceremony，但仍要有 root cause、fix approach 與 regression tests。
- Host feature 應追 defect source，不追 bug 被發現的時間點。
- T2 bug 可用 `BUG-{NUMBER}-{slug}.md`，讓 bug queue、Slack thread 與 tests 對齊。
- `Money.ToDisplay(precision = 2)` 是 implementation contract 收斂，不是新 BR。
- 沒有 BR Delta 時 Current BR Snapshot 不 regenerate，但要在 `_index.md` 明示原因。
- `tech-debt.md` 的 open item 被修掉後，要寫 resolved note 與 disposition，避免 debt backlog 失真。

## 下一個 walkthrough

下一個 Brownfield walkthrough 可接 [〈Walkthrough 06 — `/dflow:finish-feature` 收尾第一個 Order feature〉](walkthrough-06-finish-feature.zh-TW.md)：
Bob 收尾 `SPEC-20260430-001`，確認 phase 1 與 BUG-001 都已穩定，然後用
`/dflow:finish-feature` 把第一個 Order feature archive 到 completed，同時保留仍 active
的 `SPEC-20260505-002-vip-discount-policy`。
