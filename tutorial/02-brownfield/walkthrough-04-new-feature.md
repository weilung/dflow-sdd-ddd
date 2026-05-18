# Walkthrough 04 — `/dflow:new-feature` 在既有 Order BC 上新增 VIP discount policy

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Brownfield track 進入第二個階段後的工作方式：系統已經有
`Order` Bounded Context、`DiscountPolicy`、BR-001~004，以及一段已抽出的 pure C#
Domain logic。現在 Bob 接到新的業務需求，不是要再從零建立 BC，也不是順手修 legacy
code，而是要在既有 Order BC 上新增第二個 feature。

本篇把 Bob 與 Dflow 的第二個 Order feature 對話整理成一份可教學、可 review 的讀物，
讓讀者看懂：

- 為什麼這次入口是 `/dflow:new-feature`
- 為什麼 `OrderList.aspx.cs` 的 `isVip * 0.93` 不能直接變成 BR
- 為什麼 VIP status / 合約有效期是 Customer reference data，但 feature owner 仍是 Order BC
- 如何在不建立 Customer BC 的前提下新增 `ContractValidUntil` Value Object
- 如何讓 BR-005~008 接在既有 BR-001~004 後面，而不是回改已 ship 的 feature history
- Brownfield 新 feature 如何同時產生 phase spec、domain docs、context-map、tech-debt resolved note

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Brownfield 劇情跑完後的
最終狀態；本篇內嵌 code block 則代表本步驟結束當下的重點片段。只讀本篇也能看懂
第二個 Order feature 如何接在既有 BC 上；若想看完整文件家族的讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Brownfield 已有第一個 BC 後，下一個 feature 怎麼接？ | 不重建 Order BC，而是在 Order BC 的 cumulative rules 上新增 BR-005~008。 |
| legacy code 裡剛好有 `0.93`，能不能拿來當需求？ | 不能。Daniel 確認它是 dead code；它只進 cleanup task 與 tech-debt resolved note。 |
| VIP / 合約有效期看起來像 Customer，為什麼不建 Customer BC？ | 本 feature 改變的是 Order 折扣計算，Customer 只提供 reference data。 |
| 新 feature 會不會污染已完成的 SPEC-001？ | 不會。`SPEC-20260430-001` 不回改；新需求由 `SPEC-20260505-002` 承接。 |
| DDD 在 legacy WebForms 裡如何逐步演進？ | 擴張 `DiscountPolicy`、新增 `ContractValidUntil`，Code-Behind 只做 adapter。 |

## 前情提要

前兩篇 Brownfield walkthrough 已經建立了 Bob 的工作基礎：

1. [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)
   從 WebForms 客訴進入 `/dflow:modify-existing`，Dflow 判定為 T1 Heavy，升級成
   `/dflow:new-feature`，建立第一個 Order BC 與 BR-001~004。
2. [〈Walkthrough 03 — baseline capture 跨頁面折扣顯示行為〉](walkthrough-03-baseline-capture.md)
   不改 code，只讀 `OrderList` / `OrderDetail` immediate neighbors，把跨頁面現況分成
   confirmed / buggy / unknown。

到本篇開始時，Bob 已經有幾個重要資產：

```text
dflow/specs/domain/Order/
├── context.md
├── models.md
├── rules.md
└── behavior.md

dflow/specs/features/active/
└── SPEC-20260430-001-order-discount-calculation/
```

`Order` BC 已經知道：

- BR-001：折扣前總額是所有 `OrderLine.UnitPrice * Quantity` 的加總。
- BR-002：訂單滿 NT$50,000 時套用 10% off。
- BR-003：`CustomerTier = Senior` 時額外 5% off。
- BR-004：多折扣率以乘法累積。

但 `walkthrough-03` 留下一個 unknown debt：

```csharp
if (customer.IsVip)
{
    discountedTotal *= 0.93m;
}
```

當時 Dflow 沒把它寫進 `rules.md`。原因很簡單：沒有人能確認這是現役業務規則、
五年前促銷殘留，還是某個沒有文件的例外處理。

## 劇情背景

2026-05-05 週二上午，業務經理 Daniel 找到 Bob：

```text
Daniel:
我們想為 VIP 客戶推出新折扣規則。
VIP 客戶 + 在合約有效期內的訂單，才能套用 7% 折扣。
合約過期就回到一般規則。

對了，我看 OrderList 的 code 有 isVip * 0.93 那段。
那不是這次要做的 VIP program，也不是現在還有效的規則。
那是五年前一檔促銷殘留，可以刪掉。
```

這段話同時給 Bob 兩個資訊：

1. 新需求真的存在：VIP loyalty program 要新增 7% off。
2. 舊 `isVip * 0.93` 的 unknown disposition 有答案：它是 dead code。

這裡很容易出錯，因為兩件事都剛好是 `0.93` multiplier。若 AI 或工程師偷懶，
可能會把舊 code 當成需求來源，直接寫成：

```text
BR: customer.IsVip 時 discountedTotal *= 0.93
```

這樣是錯的。舊 code 的 `0.93` 是 dead code；新 feature 的 `0.93` 是 Daniel 於
2026-05-05 提出的新 VIP loyalty policy。數字相同，不代表語意相同。

Bob 因此決定開新的 feature：

```text
Bob:
Daniel 剛提出新需求。VIP 客戶如果訂單在合約有效期內，要額外套用 7% off；
合約過期就回一般規則。

同時，他確認段 3 的 OrderList.aspx.cs 裡 isVip * 0.93 是五年前促銷殘留，
可以刪掉。

這次我判斷不是 bug fix，也不是修改舊 BR；
這是新的 VIP discount policy。

/dflow:new-feature
```

## Step 0 — 先處理 legacy unknown disposition

Dflow 沒有立刻進入 intake。它先把前一篇留下的 unknown debt 做 disposition：

```text
Dflow:
收到。這是 /dflow:new-feature，預設 T1 Heavy。
這次會建立新的 feature directory，而不是回改 SPEC-20260430-001。

先做 Step 0：legacy unknown disposition。
你剛補上的業務確認很重要：
walkthrough 03 的 isVip * 0.93 unknown 已解決，
但它不是新 VIP feature 的 BR source。

我會這樣處理：

- isVip * 0.93 removal 標為 phase 1 implementation task 的 cleanup step。
- 不把它寫成 BR，因為它是 dead code，不是 accepted behavior。
- tech-debt.md 該 entry status 從 open 改成 resolved。
- resolved note 引用本 feature：
  2026-05-05 業務確認為 dead code，由 SPEC-20260505-002 phase 1 implement task 移除。
```

Bob 補一句，避免同事誤會：

```text
Bob:
對。新需求剛好也是 7% off，所以很容易讓人誤會那段 legacy code 是現役規則。
但 Daniel 說得很明確：舊 code 跟這次 VIP program 不是同一件事。
```

這是本篇第一個關鍵 lesson：**unknown legacy behavior 被確認後，也不一定會變成 BR。**

Disposition 有三種常見結果：

| 結果 | 寫法 |
|---|---|
| confirmed accepted behavior | 進 `rules.md` / `behavior.md`，必要時建立 BR。 |
| confirmed bug | 進 bug-fix flow 或 tech debt，不能當 accepted behavior。 |
| confirmed dead code | 進 cleanup task 與 resolved note，不寫成 BR。 |

本篇是第三種。

## Step 1 — Intake：這是一個新 feature，不是 SPEC-001 的 phase 2

Dflow 開始整理 intake：

```text
Dflow:
Step 1 - Intake。

What:
VIP 客戶折扣特例規則。

Who:
業務團隊 Daniel，以及具備 VIP loyalty program eligibility 的客戶。

Why:
推出 VIP loyalty program；
合約有效期內的 VIP 訂單額外 7% off，
合約過期回一般規則。
```

接著 Dflow 掃描既有 assets：

```text
Dflow:
我也掃描既有 assets：

- dflow/specs/domain/Order/rules.md 已有 BR-001~004，
  處理折扣前總額、滿額折扣、Senior 折扣與 compound formula。
- dflow/specs/domain/Order/models.md 已有 DiscountPolicy，可擴張，不需要重寫。
- dflow/specs/domain/glossary.md 已有 CustomerTier，目前只明確列 Senior。
- dflow/specs/domain/context-map.md 已把 Customer 列為候選 BC / upstream reference data。

這個需求看起來是擴張 Order discount policy，
而不是修 OrderList legacy bug。
Step 1 complete。Entering Step 2: Identify the Bounded Context.
```

這裡的判斷很重要。`SPEC-20260430-001` 是第一個 Order discount calculation feature。
它的 phase 1 已經 ship。VIP program 不是 phase 1 的漏項，也不是要回頭修改歷史。

所以 Dflow 採用新的 feature ID：

```text
SPEC-20260505-002-vip-discount-policy
```

這讓 feature history 保持清楚：

| Feature | 責任 |
|---|---|
| `SPEC-20260430-001-order-discount-calculation` | 建立 Order BC 第一批折扣規則 BR-001~004。 |
| `SPEC-20260505-002-vip-discount-policy` | 在 Order BC 上新增 VIP 合約折扣 BR-005~008。 |

## Step 2 — Identify the Bounded Context

Bob 先問最容易吵架的問題：

```text
Bob:
這裡我想先確認 BC。
VIP status 和合約日期明顯是 Customer 的資料，
但折扣計算又在 Order。你會放哪裡？
```

Dflow 列出兩種切法：

```text
Dflow:
我看到兩種切法：

1. 放 Customer BC：
   因為 VIP status、合約有效期、客戶分類都屬於 Customer 概念。

2. 放 Order BC：
   因為真正改變的是訂單折扣計算，
   會和 BR-002~BR-004 的折扣公式互動。

我建議本 feature 放 Order BC。
```

理由是：

| 判斷 | 結果 |
|---|---|
| BR owner | `DiscountPolicy`，屬於 Order 折扣計算語境。 |
| 真正變動 | full-threshold、VIP、Senior 的 stack order。 |
| Customer 資料角色 | 提供 reference data，不擁有本次折扣計算。 |
| 若建立 Customer BC | scope 會擴張到客戶主檔、合約管理、owner workflow。 |

Bob 追問：

```text
Bob:
所以 Customer BC 先不建。
那 context-map.md 要怎麼寫，才不會讓人以為我們忽略 Customer？
```

Dflow 回答：

```text
Dflow:
我會把 Customer 標成 partially referenced via reference data，未正式建 BC。

- Customer BC 已在 context-map 中列為 candidate BC。
- 本 feature 只用 Customer 概念，不正式建立 Customer Aggregate 或 Customer BC directory。
- GetVipContractInfo(customerId) 類似 reference repository query，
  提供 Order BC 計算所需資料。
- 真正建立 Customer BC 應由 Customer-owned feature 觸發，
  例如合約維護、付款條件或信用額度規則。

Step 2 complete。
BC identified: Order；
Customer partially referenced via reference data。
Entering Step 3: Domain Concept Discovery.
```

這是本篇第二個關鍵 lesson：**資料來源屬於 Customer，不代表 feature owner 一定是 Customer。**

DDD 的 bounded context 決策不是看欄位在哪張表，而是看本次語意改變由誰擁有。
本次是折扣計算規則改變，所以 owner 是 Order BC。

## Step 3 — Domain Concept Discovery

Dflow 整理新的 nouns、behaviors、constraints：

```text
Dflow:
新 nouns:

- VIP
- CustomerTier
- ContractValidUntil
- VIP discount policy

新 behaviors:

- 判斷 VIP contract 是否在有效期內。
- 將 VIP 7% off 放進既有 DiscountPolicy。
- 決定 full-threshold、VIP、Senior 的 stack order。

新 constraints:

- ContractValidUntil >= OrderDate 視為有效，等於到期日當天仍可套用。
- ContractValidUntil 必須是合法日期，且不能是 10 年外這種 suspicious future value。
- OrderList isVip * 0.93 是 dead code cleanup，不是 BR。
```

Bob 接著問 `CustomerTier`：

```text
Bob:
CustomerTier 已經有 Senior。
這次要不要加 VIP？
還是 VIP 另外當 IsVip？
```

Dflow 的回答刻意不被 legacy schema 綁住：

```text
Dflow:
我建議在 glossary 與 models 裡把 CustomerTier enum values 擴到 Senior + VIP，
但 Domain input 要允許 VIP eligibility 與 Senior discount 同時存在。

這裡要避免被 legacy schema 限制住：

- Legacy 可能是 CustomerTier、IsVip、合約表或 SP 組出來。
- Domain 語意上，VIP 是 loyalty program eligibility，
  Senior 是 customer-tier discount eligibility。
- Daniel 確認 VIP + Senior 同時出現是合理組合，不互斥。

所以 BR-008 會寫：
VIP eligibility 與 Senior customer-tier 可以同時存在，業務允許 stack。
```

Bob 確認：

```text
Bob:
同意。不要因為資料庫欄位長得像 enum，
就把業務規則硬設成互斥。
```

這裡展示的是 Brownfield DDD 的另一個重點：legacy schema 是重要線索，
但不是最後的 ubiquitous language。

## Step 3.5 — SPEC-ID、slug、目錄與 branch gate

建立檔案前，Dflow 停下來確認命名：

```text
Dflow:
Domain concepts captured。
Before I create any files, let me confirm the SPEC-ID, slug,
feature directory, and branch name with you。
```

Bob 指定：

```text
Bob:
今天用第二個 spec：SPEC-20260505-002。
slug 用 vip-discount-policy。
phase slug 用 vip-rate-and-contract。
```

Dflow 回覆：

```text
Dflow:
確認如下：

- SPEC-ID: SPEC-20260505-002
- slug: vip-discount-policy
- feature directory:
  dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/
- first phase file:
  phase-spec-2026-05-05-vip-rate-and-contract.md
- git branch:
  feature/SPEC-20260505-002-vip-discount-policy

這樣可以嗎？
```

Bob：

```text
Bob:
可以。
```

這個 gate 看似小，但它防止兩種常見錯誤：

| 錯誤 | Gate 如何避免 |
|---|---|
| 把 VIP program 寫進舊 feature | 新 SPEC-ID 與 feature directory 明確切開。 |
| 亂命名造成 trace 斷裂 | phase slug、branch、directory 在建檔前先確認。 |

## Step 4 — Write the Spec

Dflow 建立第二個 feature directory：

```text
dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/
├── _index.md
└── phase-spec-2026-05-05-vip-rate-and-contract.md
```

### Feature `_index.md`

`_index.md` 的 Goals & Scope 會先固定 feature 邊界：

```markdown
# VIP Discount Policy

## Goals & Scope

本 feature 處理業務團隊提出的 VIP loyalty program：
VIP 客戶且訂單日期落在合約有效期內時，
Order BC 的 `DiscountPolicy` 需額外套用 7% off；
合約過期時回到一般折扣規則。

本 feature 屬於 Order BC，因為它改變的是訂單折扣計算規則與既有 BR-001~004 的互動。
Customer 的 VIP 狀態與 `ContractValidUntil` 來自 Customer reference data，
但本 feature 不正式建立 Customer BC，也不建 Customer Aggregate。

Phase 1 `vip-rate-and-contract` 會擴張既有 `DiscountPolicy`，
新增 `ContractValidUntil` Value Object，補上 BR-005~008，
並在 implementation task 中清理 `OrderList.aspx.cs` 既有 `isVip * 0.93` dead code。
該清理是 legacy debt resolution，不寫成 BR。
```

完整文件範例：
[`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md)

### Current BR Snapshot

Bob 要求 Dflow 先唸一次 BR：

```text
Bob:
BR-005 到 BR-008 先唸一次。
```

Dflow 產生：

```markdown
| BR-ID | Current Rule |
|---|---|
| BR-005 | CustomerTier 含 VIP eligibility 且 ContractValidUntil >= OrderDate 時，訂單額外套用 VIP 7% off。 |
| BR-006 | VIP 客戶合約已過期時不套用 VIP 7% off，但仍依 BR-002~BR-004 評估一般滿額折扣與客戶等級折扣。 |
| BR-007 | VIP 折扣與其他折扣可 stack；順序為先套滿額折扣，再套 VIP 折扣，最後套 Senior customer-tier 折扣。 |
| BR-008 | VIP eligibility 與 Senior customer-tier 可以同時存在；若同一客戶同時符合 VIP 合約與 Senior 條件，業務允許依 BR-007 stack。 |
```

BR 編號不從 001 重來，因為它們仍屬於同一個 Order BC。這是 cumulative
domain rule index，不是每個 feature 各自重編。

## Step 4 — Phase spec 把新需求變成可驗收行為

phase spec 的 Problem Description 會明確區分新需求與 dead code：

```markdown
## Problem Description

業務經理 Daniel 提出新的 VIP loyalty program：
VIP 客戶的訂單若落在 VIP 合約有效期內，需額外套用 7% off；
合約過期則回到一般折扣規則。
Daniel 同時確認 `OrderList.aspx.cs` 舊有 `isVip * 0.93` 是五年前促銷殘留，可以刪除。

本 phase 不把 legacy `isVip * 0.93` 寫成 BR。
正式 BR 只描述新業務需求：VIP eligibility、合約有效期、折扣 stack order，
以及 VIP 與 Senior 是否可同時享有折扣。
Legacy dead code removal 只列為 implementation cleanup task，
並回寫 `tech-debt.md` resolved note。
```

完整文件範例：
[`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/phase-spec-2026-05-05-vip-rate-and-contract.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/phase-spec-2026-05-05-vip-rate-and-contract.md)

### Behavior Scenarios

phase spec 的主情境：

```gherkin
Scenario: VIP 客戶在合約有效期內套用 VIP 7% off
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 為 2026-12-31
  And OrderDate 為 2026-05-05
  And 訂單折扣前總額為 NT$60,000
  When DiscountPolicy evaluates the order
  Then 先依 BR-002 套用滿額折扣 multiplier 0.9
  And 再依 BR-005 套用 VIP discount multiplier 0.93
  And 若該客戶也符合 Senior 條件，最後再依 BR-003 套用 multiplier 0.95
```

替代情境：

```gherkin
Scenario: VIP 客戶合約已過期時回到一般折扣規則
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 為 2026-05-04
  And OrderDate 為 2026-05-05
  And 訂單折扣前總額為 NT$60,000
  When DiscountPolicy evaluates the order
  Then 不套用 VIP discount multiplier 0.93
  And 仍依 BR-002~BR-004 評估滿額折扣與 Senior customer-tier 折扣
```

到期日邊界：

```gherkin
Scenario: 合約到期日當天仍視為有效
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 為 2026-05-05
  And OrderDate 為 2026-05-05
  When DiscountPolicy evaluates VIP eligibility
  Then VIP contract 視為有效
  And 可套用 VIP discount multiplier 0.93
```

VIP + Senior stack：

```gherkin
Scenario: VIP 與 Senior 同時符合時允許 stack
  Given customer reference data 顯示客戶具備 VIP eligibility
  And ContractValidUntil 大於或等於 OrderDate
  And customer 同時符合 Senior customer-tier discount
  And 訂單折扣前總額大於或等於 NT$50,000
  When DiscountPolicy calculates the final discount
  Then discount order 為 full-threshold -> VIP -> Senior
  And total discount rate 為 `1 - (1 - fullRate) * (1 - vipRate) * (1 - tierRate)`
```

Bob 問：

```text
Bob:
stack order 為什麼 VIP 放 Senior 前面？
如果乘法，其實數學上結果一樣。
```

Dflow 解釋：

```text
Dflow:
數學上乘法可交換，但 spec 仍要定 order，原因有三個：

- UI discount breakdown 需要穩定顯示順序。
- 後續若加入 capped discount、rounding step 或不可 stack promotion，順序會影響結果。
- 測試案例需要一個 business-readable order，避免每個頁面自行排序。

Daniel 的語意是「合約內 VIP 額外 7% off，且可與 Senior stack」。
我建議 order 寫成 full-threshold -> VIP -> Senior，
因為滿額折扣是 order amount 條件，
VIP 是 loyalty contract，
Senior 是 customer-tier discount。
```

這是本篇第三個關鍵 lesson：**公式結果現在相同，不代表順序可以不寫。**

Spec 不是只描述今天的算式，也要讓 UI、tests、後續規則演進有穩定語意。

## Step 4 — Delta from prior phases

Bob 特別要求：

```text
Bob:
也請寫清楚不要回頭改 SPEC-001 的 BR。
BR-001~004 是已 ship baseline，
新需求只新增 BR-005~008。
```

Dflow 在 phase spec 裡寫：

```markdown
## Delta from prior phases

首 phase，無前置 Delta。本 feature 是 Order BC 的第二個 feature，
但不是 `SPEC-20260430-001` 的 phase 2；
它建立獨立 feature directory，並以 Order BC 既有 BR-001~004 為互動基準。

### ADDED - BR / behavior added in this phase

- BR-005 VIP contract-valid discount
- BR-006 Expired VIP contract fallback
- BR-007 VIP discount stacking order
- BR-008 VIP and Senior can stack

### UNCHANGED - explicitly unaffected

- BR-001 pre-discount total calculation 不變。
- BR-002 full-threshold discount threshold 與 rate 不變。
- BR-003 Senior customer-tier 5% off 不變。
- BR-004 原本的 full-threshold -> Senior compound formula 保留；
  當 VIP 不適用時仍產生相同結果。
```

這段對 reviewer 很有用。它讓 reviewer 可以檢查兩件事：

1. 新 feature 是否真的只新增 VIP behavior。
2. 既有 BR-001~004 是否被 regression tests 保護，沒有被 VIP path 破壞。

## Step 4 — Domain docs 如何更新

新 feature 不只寫 phase spec。它也會更新 Order BC 的 cumulative documents。

### `rules.md` 新增 BR-005~008

重點片段：

```markdown
| BR-ID | Rule summary | Behavior anchor | Status | Last updated |
|---|---|---|---|---|
| BR-005 | 2026-05-05 SPEC-002 ADDED：VIP 客戶且 `ContractValidUntil >= OrderDate` 時，額外套用 VIP 7% off。 | [BR-005](./behavior.md#br-005-vip-contract-valid-discount) | active | 2026-05-05 |
| BR-006 | 2026-05-05 SPEC-002 ADDED：VIP 合約過期時不套用 VIP 7% off，但仍依一般折扣規則計算。 | [BR-006](./behavior.md#br-006-expired-vip-contract-fallback) | active | 2026-05-05 |
| BR-007 | 2026-05-05 SPEC-002 ADDED：多折扣 stack order 為 full-threshold -> VIP -> Senior，並以乘法累積。 | [BR-007](./behavior.md#br-007-vip-discount-stacking-order) | active | 2026-05-05 |
| BR-008 | 2026-05-05 SPEC-002 ADDED：VIP eligibility 與 Senior customer-tier 可以同時存在，業務允許同時 stack。 | [BR-008](./behavior.md#br-008-vip-and-senior-can-stack) | active | 2026-05-05 |
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)

補充：完整文件範例的 lifecycle note 也提醒：BR-001~004 由
`SPEC-20260430-001` completion finalized，BR-005~008 仍由 active
`SPEC-20260505-002` 擁有。

### `models.md` 新增 `ContractValidUntil` 與 repository seam

重點片段：

```markdown
| Value Object | Responsibility | Equality Components | Code Mapping | Notes |
|---|---|---|---|---|
| ContractValidUntil | 表示 VIP 合約有效期限，封裝到期日 inclusive comparison。 | Date | `OrderManager.Domain.Order.ContractValidUntil` | 2026-05-05 SPEC-002 ADDED；必須是合法日期，且不得超過目前日期 10 年以上。 |
```

`DiscountPolicy` 也被擴張：

```markdown
| Service | Responsibility | Inputs / Outputs | Code Mapping | Notes |
|---|---|---|---|---|
| DiscountPolicy | 判斷滿額折扣、VIP 合約折扣與客戶等級折扣，並以正確公式累積折扣率。 | `Money preDiscountTotal`, `CustomerTier tier`, `ContractValidUntil? contractValidUntil`, `DateOnly orderDate` -> `DiscountRate totalDiscount` | `OrderManager.Domain.Order.DiscountPolicy` | 2026-05-05 SPEC-002 ADDED：擴張 VIP 計算路徑；保留既有 BR-001~004 行為。 |
```

Customer reference data 透過 repository seam 表達：

```markdown
| Repository | Aggregate / Entity | Query Responsibility | Code Mapping | Notes |
|---|---|---|---|---|
| CustomerReferenceRepository | Customer reference data | 依 `customerId` 取得 `CustomerTier`、VIP eligibility 與 `ContractValidUntil`。 | `OrderManager.Domain.Order.Interfaces.ICustomerReferenceRepository` | 2026-05-05 SPEC-002 ADDED；Order BC 只消費 reference data，不建立 Customer Aggregate。 |
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/models.md`](outputs/dflow/specs/domain/Order/models.md)

### `context-map.md` 標出 Customer 是 reference data

重點片段：

```markdown
| Bounded Context | Responsibility | Owner / Team | Primary Code Area | Notes |
|---|---|---|---|---|
| Customer | 客戶資料、付款條件、啟用狀態、VIP eligibility、合約有效期與信用額度。 | 業務 / 客戶資料 owner | `OrderManager.Web/Pages/Customer/` / Customer repositories | Candidate BC；2026-05-05 起 partially referenced via reference data，未正式建 BC。 |
```

完整文件範例：
[`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md)

這裡 Dflow 不是忽略 Customer，而是把它的狀態寫清楚：

- Candidate BC：未來可能正式建模。
- Reference data：本 feature 只讀所需資料。
- Not owned here：不在本 feature 建 Customer Aggregate 或合約維護流程。

### `tech-debt.md` 把 `isVip` unknown 標成 resolved

`walkthrough-03` 留下的 debt 在本篇有了結論：

```markdown
| Item | Location | Description | Severity | Migration impact | Status |
|---|---|---|---|---|---|
| OrderList isVip multiplier 0.93 規則來源不明 | `OrderManager.Web/Pages/Order/OrderList.aspx.cs` method `BindGrid()` | `if (customer.IsVip) { discountedTotal *= 0.93m; }` 沒有註解或 ticket reference，且可能與 BR-003 Senior customer 5% off 互斥。Resolved note: 2026-05-05 業務確認為 dead code，由 SPEC-20260505-002 phase 1 implement task 移除。 | Medium | 不寫成 BR；移除作為 `SPEC-20260505-002` 的 implementation cleanup task，避免把 legacy promotion 殘留帶入 ASP.NET Core migration。 | resolved |
```

完整文件範例：
[`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

這段能讓未來 reviewer 看懂：dead code removal 不是突然刪 legacy 行為，而是有
Daniel 的業務確認與 SPEC-002 task trace。

## Step 5 — Implementation plan：擴張 `DiscountPolicy`，不是重寫

Spec 寫完後，Dflow 停下來：

```text
Dflow:
Spec is drafted - behavior scenarios, business rules, and edge cases are captured.
Ready to plan the implementation?

/dflow:next or reply OK to continue.
```

Bob 回：

```text
Bob:
/dflow:next
```

Dflow 規劃 Domain layer：

```text
Dflow:
Domain layer first:

- CustomerTier reference value 加入 VIP，但保留 Senior eligibility 的既有判斷。
- 新增 ContractValidUntil Value Object。
- 擴張 DiscountPolicy，新增 VIP 路徑與 stack order；
  不要改既有 BR-001~004 method 的 observable behavior。
- 新增 Customer reference repository query：
  GetVipContractInfo(customerId)。
```

Code-Behind 維持薄 adapter：

```text
Dflow:
Code-Behind thin layer:

- OrderEntry.aspx.cs 讀 customer reference data，map 成 Domain input。
- OrderEntry.aspx.cs 不直接判斷 VIP 折扣。
- OrderList.aspx.cs 移除 legacy isVip * 0.93 dead code，作為 cleanup task。
```

Bob 補測試要求：

```text
Bob:
測試要把合約日期邊界補足。
到期日當天 inclusive，前一秒過期，後一秒有效。
```

Dflow 寫入 task list：

```markdown
## Implementation Tasks

- [ ] DOMAIN-1: 將 `CustomerTier` reference value 加入 `VIP`，並保留 `Senior` customer-tier discount 判斷。
- [ ] DOMAIN-2: 建立 `ContractValidUntil` Value Object，實作合法日期、10 年外 suspicious date、inclusive boundary validation。
- [ ] DOMAIN-3: 擴張 `DiscountPolicy`，新增 VIP discount path，保留既有 BR-001~004 方法與行為。
- [ ] DOMAIN-4: 實作 full-threshold -> VIP -> Senior stacking order，並覆蓋 VIP 與 Senior 同時符合的組合。
- [ ] WEBFORMS-1: 在 `OrderEntry.aspx.cs` 讀取 Customer reference data，將 VIP eligibility 與 `ContractValidUntil` map 成 Domain input。
- [ ] WEBFORMS-2: 移除 `OrderList.aspx.cs` 的 legacy `isVip * 0.93` dead code；此清理對應 `tech-debt.md` resolved item，不寫成 BR。
- [ ] INFRA-1: 在 Customer reference repository 增加 `GetVipContractInfo(customerId)` 或等價 query。
- [ ] TEST-1: 新增 BR-005 到 BR-008 的 Domain unit tests。
- [ ] TEST-2: 新增 `ContractValidUntil` 到期日當天、前一秒、後一秒與 invalid/far-future validation tests。
- [ ] TEST-3: 新增 stacking order tests，確認 VIP 不會破壞 BR-001~004 的既有結果。
```

本篇停在 spec 與 implementation plan。沒有真的修改 WebForms code，也沒有跑 tests。

## Step 6 — Branch ready，但 implementation 尚未開始

Dflow 建議 branch：

```text
feature/SPEC-20260505-002-vip-discount-policy
```

Bob 決定先停在 review point：

```text
Bob:
可以。這段 tutorial 到這裡就好，後續 implementation 不在本段範圍。
我要先把 spec 和 BC boundary decision 給同事 review。
```

Dflow 回應：

```text
Dflow:
Step 7 implementation 尚未開始，所以 Step 8 completion checklist 不執行。

這段會落地 documentation artifacts：

- 新 feature _index.md
- phase-spec vip-rate-and-contract
- 更新 Order BC 的 context.md、models.md、rules.md、behavior.md
- 更新 glossary.md、context-map.md
- 更新 tech-debt.md，把 OrderList isVip multiplier 0.93 標成 resolved

下一步是 Bob 開 branch 並進入 implementation；
完成後才觸發 Step 7 -> Step 8 completion checklist。
```

這裡的保護和前兩篇一致：沒有 implementation，就不要假裝完成。
`SPEC-20260505-002` 仍留在 `features/active/`。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md) | 第二個 Order feature 的 goals、BR-005~008、resume pointer。 |
| 新建 | [`outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/phase-spec-2026-05-05-vip-rate-and-contract.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/phase-spec-2026-05-05-vip-rate-and-contract.md) | VIP 合約折扣情境、Delta、edge cases、implementation tasks。 |
| 修改 | [`outputs/dflow/specs/domain/Order/context.md`](outputs/dflow/specs/domain/Order/context.md) | Order BC 新增 VIP 合約折扣責任，但 Customer BC 仍 out of scope。 |
| 修改 | [`outputs/dflow/specs/domain/Order/models.md`](outputs/dflow/specs/domain/Order/models.md) | `ContractValidUntil`、擴張後的 `DiscountPolicy`、Customer reference repository。 |
| 修改 | [`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md) | BR-005~008 加入 Order BC cumulative rule index。 |
| 修改 | [`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md) | VIP discount policy 的 Given/When/Then 與 edge cases。 |
| 修改 | [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | `VIP`、`ContractValidUntil`、`VIP discount policy` 等 ubiquitous language。 |
| 修改 | [`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) | Customer 標為 candidate BC / reference data supplier。 |
| 修改 | [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | `isVip * 0.93` 從 unknown debt 變成 resolved dead code cleanup。 |
| 故意不改 | `SPEC-20260430-001-order-discount-calculation/` | 已 ship 的 feature history 不因新 VIP program 回改。 |
| 故意不建 | Customer BC directory | 本 feature 只用 Customer reference data，不建立 Customer Aggregate。 |
| 故意不建 | `events.md` | 本 feature 不引入 Domain Events。 |

上表連到完整文件範例；本篇的 `SPEC-20260505-002` 仍然是 active feature。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Brownfield track | 新需求建立在已抽出的 Order BC 上，不要求 WebForms 全面重寫。 |
| Spec-first development | Bob 先得到 feature spec、BR、edge cases、implementation tasks，還沒改 production code。 |
| Hybrid workflow control | Bob 明確使用 `/dflow:new-feature`，Dflow 仍先處理 legacy unknown disposition 與 BC 判斷。 |
| DDD semantic backbone | VIP / ContractValidUntil / Customer reference data 的邊界被寫進 models、context-map、glossary。 |
| 三層文件分工 | feature `_index.md` 管本 feature，phase spec 管本次實作計畫，domain docs 管 cumulative Order behavior。 |
| Drift verification readiness | UNCHANGED section 與 TEST tasks 明確要求 BR-001~004 regression 保護。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| dead code 被誤當現役需求 | 看到 `isVip * 0.93` 就直接包進新 policy。 | Dflow 先做 disposition，確認它是 cleanup task，不是 BR。 |
| Customer BC 過早建立 | 因為 VIP / 合約資料在 Customer，就順手建 Customer Aggregate。 | 本 feature 只用 Customer reference data，Customer BC 留給 Customer-owned feature。 |
| 破壞既有折扣規則 | VIP path 直接改掉 `DiscountPolicy`，導致 Senior / 滿額折扣 regression。 | Delta 寫 UNCHANGED，tasks 要求保護 BR-001~004。 |
| feature history 混亂 | 回改 SPEC-001，把新需求塞進已 ship baseline。 | 新建 SPEC-002，BR-005~008 接在 Order BC cumulative rules 後面。 |
| UI / tests 各自排序折扣 | 乘法結果相同就不寫 stack order。 | Spec 明定 full-threshold -> VIP -> Senior，提供 stable display / test order。 |

## 對不熟 Brownfield new-feature 的讀者的讀法

讀這篇時，可以抓四個問題：

1. **這是新 feature、bug fix，還是 legacy cleanup？**
   本篇答案是新 feature，另帶一個 dead code cleanup task。

2. **新行為由哪個 bounded context 擁有？**
   本篇答案是 Order BC，因為 owner 是折扣計算與 stack order。

3. **外部資料怎麼進來？**
   本篇答案是 Customer reference data，透過 repository seam 提供
   `CustomerTier`、VIP eligibility、`ContractValidUntil`。

4. **既有規則怎麼保護？**
   本篇答案是 BR-001~004 明列 UNCHANGED，並在 test strategy 中要求 regression。

Brownfield 的難點不是「能不能新增功能」，而是新增功能時不要把既有 legacy noise、
不完整 schema、未確認 owner 全部拉進同一個模型。Dflow 在這裡的價值，是讓每個邊界
決策都有文字 trace。

## Key takeaways

- Brownfield 已有 BC 後，下一個 `/dflow:new-feature` 應沿用 cumulative domain docs，不重建模型。
- 舊 code 數字剛好相同，不代表它是新需求來源；dead code cleanup 不能寫成 BR。
- VIP / 合約有效期可以是 Customer reference data，但折扣計算 owner 仍可屬於 Order BC。
- BR-ID 在同一 BC 內連續累積；BR-005~008 接在 BR-001~004 後面。
- Stack order 即使目前乘法可交換，也應寫進 spec，支援 UI、tests 與未來規則演進。
- 沒有 implementation，就不執行 completion checklist，也不把 feature 標成 completed。

## 下一個 walkthrough

下一個 Brownfield walkthrough 可接 [〈Walkthrough 05 — `/dflow:bug-fix` 修正跨頁 rounding inconsistency〉](walkthrough-05-bug-fix.md)：
Bob 在 Order BC 已有 BR 與 behavior baseline 後，處理 production bug 或段 3 發現的
rounding inconsistency。那一篇會展示 bug-fix flow 如何維持 expected-versus-actual
邊界、補 regression check，並避免把 bug fix 膨脹成另一個無邊界重構。
