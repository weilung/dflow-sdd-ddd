# Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Brownfield track 最核心的價值：不是把 legacy 系統一次重寫，
而是在一次真實修改需求中，先捕捉 current behavior，再決定哪些業務邏輯值得抽成
可測試、可遷移的 Domain logic。

本篇把 Bob 與 Dflow 的互動整理成一份可教學、可 review 的讀物，讓讀者看懂：

- 為什麼入口是 `/dflow:modify-existing`
- 為什麼 Dflow 判定這不是一行 bug fix，而是 T1 Heavy
- 為什麼沒有 host feature 時要升級成 `/dflow:new-feature`
- Brownfield baseline capture 怎麼避免把錯誤程式碼當成 business rule
- `OrderEntry.aspx.cs` 如何逐步變薄，而不是被一次重寫
- 這一步會產生哪些 feature-level 與 system-level 文件

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Brownfield 劇情跑完後的
最終狀態；本篇內嵌 code block 則代表本步驟結束當下的重點片段。只讀本篇也能看懂
第一段 Order Domain logic 如何被抽出；若想看完整文件家族的讀法，再讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Legacy code 很亂，Dflow 會不會要求先重構？ | Dflow 只處理 `OrderEntry.aspx.cs` 的折扣計算路徑，其他頁面先記 tech debt。 |
| bug fix 和 domain extraction 怎麼分？ | 入口是 bug-like 客訴，但 Dflow 判定為建立第一個 Order BC 的 T1 work。 |
| Brownfield baseline 是不是等於照抄現有錯誤行為？ | 本篇展示 buggy code result 作為 contrast，而 business rule 寫業務期望。 |
| 沒有現成 feature directory 時怎麼辦？ | `/dflow:modify-existing` 掃描 active / completed features 後，升級到 `/dflow:new-feature`。 |
| DDD 在 WebForms 裡能做什麼？ | 先抽 `Order`、`OrderLine`、`Money`、`DiscountRate`、`DiscountPolicy`，不碰整頁重寫。 |

## 先釐清 Brownfield 的目標

Greenfield 的 Alice 可以從乾淨的 ASP.NET Core 專案開始，直接建立第一個 bounded context。
Brownfield 的 Bob 不行。OrderManager 已上線多年，業務規則散在：

```text
OrderManager.Web/Pages/Order/OrderEntry.aspx.cs
OrderManager.Web/Pages/Order/OrderList.aspx.cs
OrderManager.Web/Pages/Order/OrderDetail.aspx.cs
OrderManager.DataAccess/
Stored Procedures
```

Bob 的目標不是「把 WebForms 改成 Clean Architecture」。那太大，也太危險。

這一步的目標更務實：

1. 針對一個已重現的折扣計算問題建立 spec。
2. 捕捉 `OrderEntry.aspx.cs` 的現有折扣行為。
3. 把正確的 business rule 寫進 `Order` BC 文件。
4. 把可測試的折扣計算抽成 pure C# Domain logic。
5. 把尚未處理的重複規則與頁面責任記進 tech debt。

這就是 Brownfield track 的主張：不要假裝 legacy 不存在，也不要被 legacy 綁死。
每次修改都讓 domain knowledge 多一點、風險少一點。

## 劇情背景

Bob 維護的 OrderManager 是 ASP.NET WebForms 系統。某天下午，客服團隊轉來經銷商
「華昕貿易」的客訴：

```text
CustomerTier = Senior
訂單折扣前總額 = NT$60,000

業務期望：
先套滿 NT$50,000 的 9 折，再套 Senior 客戶 5% off
60000 * 0.9 * 0.95 = 51300

系統實際：
只套滿額 9 折
60000 * 0.9 = 54000
```

Bob 追到 `OrderEntry.aspx.cs` 的 `btnSubmit_Click`，看到折扣計算混在 UI input、
EF query、`decimal` 計算與 DB write 之間。

這時他可以選擇快速補一行：

```csharp
discount += seniorDiscount;
```

但那樣會留下幾個問題：

- 這條折扣規則還是只存在 Code-Behind。
- 沒有 spec 說明 Senior + 滿額折扣的正確累積方式。
- 沒有 unit test 保護 NT$51,300 這個案例。
- 其他頁面可能仍有同樣或類似的折扣邏輯。
- 未來 .NET Core migration 時還是要重新挖一次。

所以 Bob 決定用 Dflow 正式處理：

```text
Bob:
客服剛轉一張客訴。華昕貿易上週一筆訂單符合滿 NT$50,000 9 折，
也符合老客戶 5% off，但系統只套了 9 折。

我在 dev 用同條件重現了，問題在 OrderEntry.aspx.cs 的折扣計算。
這段目前黏在 btnSubmit_Click 裡，我想用這次修改正式開始抽 Order BC。

/dflow:modify-existing
```

## Step 1 — Dflow 先判斷這是哪種修改

Dflow 沒有立刻改 code。它先進入 modify-existing flow 的 Step 1：
Assess the Change。

這一步有兩個判斷：

| 判斷 | 問題 |
|---|---|
| Ceremony tier | 這是 T1 Heavy、T2 Light、T3 Trivial，還是低於 Dflow tracking？ |
| Feature linkage | 這個修改應該放進哪個 active / completed feature？如果沒有 host feature 怎麼辦？ |

Dflow 的判定：

```text
Dflow:
Part A — Tier 判定：

- T1 Heavy？是。這次不是單純修一個判斷式，
  會建立第一個 Order BC structure，包含 Order Aggregate Root、
  OrderLine Entity、Money / Quantity / DiscountRate Value Objects、
  DiscountPolicy，而且會新增多條 BR。

- T2 Light？否。光是建立首個 Aggregate，加上從 OrderEntry.aspx.cs
  抽出 handler 裡的核心計算，已經超過 lightweight bug fix。

- T3 Trivial？否。這不是 copy、button color、註解或格式調整；
  它會改變訂單金額。

結論：T1 Heavy。
```

Bob 確認這個判定：

```text
Bob:
同意。這如果硬寫成 bug fix，
後面團隊會看不出我們其實建立了第一個 Domain model。
```

這是 Brownfield tutorial 很重要的一點：**使用者的入口不一定等於最終 flow**。
Bob 以 `/dflow:modify-existing` 進來，因為他確實在修改既有 WebForms 行為。
但 Dflow 判斷這次修改的實際重量已經是 T1，而且沒有現有 host feature 可以承接。

## Step 1 Part B — 沒有 host feature，所以升級到 new-feature

Dflow 掃描 features：

```text
Dflow:
我掃描目前 specs baseline：

- dflow/specs/features/active/ 還沒有 active feature
- completed/ 也沒有可以 reopen 的 feature

這是 brownfield 專案第一次正式修改 Order 行為，所以沒有 host feature。

根據 modify-existing-flow Step 1：
T1 Heavy 如果沒有 host active feature，而且不是 completed feature follow-up，
就要升級到 /dflow:new-feature。
```

Dflow 建議新的 feature：

```text
SPEC-20260430-001-order-discount-calculation
```

第一個 phase 叫：

```text
baseline-and-fix
```

包含三件事：

1. baseline capture 既有 `OrderEntry.aspx.cs` 折扣行為
2. 修正滿額折扣 + Senior 客戶折扣的累積 bug
3. 抽出 Order BC 的第一段 Domain logic

Bob 同意：

```text
Bob:
好。這個 bug 是入口，但本質是第一個 Order feature。
切到 /dflow:new-feature。
```

對讀者來說，這段展示的是 Dflow 的 workflow control：它不是死板地照使用者打的命令走，
而是先做 scope 判斷。這能避免兩種常見錯誤：

| 常見錯誤 | Dflow 的處理 |
|---|---|
| 把建立第一個 Domain model 包裝成一行 bug fix | 升級成 T1 feature，保留設計與文件。 |
| 在沒有 host feature 時硬把修改塞進空目錄 | 建立新的 feature directory，讓後續 BR / tests / tech debt 可追蹤。 |

## Step 2 — Identify the Bounded Context

Dflow 轉入 new-feature 後，先做 intake，再判斷 BC：

```text
Dflow:
這個 feature 涉及訂單明細、訂單總額、折扣與提交流程。
從 context-map.md 來看，這應該落在 Order Bounded Context。

Customer 目前只提供 CustomerTier reference data；
Inventory、Shipment、Invoice 都不是本 phase 的 owner。

我建議建立第一個 BC directory：

dflow/specs/domain/Order/
```

Bob 確認：

```text
Bob:
放 Order。CustomerTier 先當 reference value，
不要在這裡順手建 Customer BC。
```

這是 Brownfield DDD 的務實取捨。Bob 不否認 Customer 是一個可能的 bounded context，
但本次折扣計算只需要 `CustomerTier` 作為 reference value。若現在順手建立 Customer BC，
scope 會膨脹，且不一定有足夠業務資訊支撐模型。

本步驟的 boundary decision：

| 決策 | 結果 |
|---|---|
| 新建 BC | Order |
| 不建 BC | Customer、Inventory、Shipment、Invoice |
| Customer 資訊 | 只用 `CustomerTier` reference value |
| 本 phase owner | Order discount calculation |

## Step 3 — Baseline capture：讀錯誤程式碼，但不把錯誤當規則

Dflow 讀到的 Code-Behind 片段：

```csharp
var customer = db.Customers.Single(c => c.Id == customerId);
var lines = BuildLinesFromGrid(gvOrderLines);

decimal gross = 0m;
foreach (var row in lines)
{
    gross += row.UnitPrice * row.Quantity;
}

decimal discount = 0m;
if (gross >= 50000m)
{
    discount += 0.10m;
}

if (customer.CustomerTier == "Senior")
{
    seniorDiscount = 0.05m;
    // seniorDiscount 沒有進入 total discount
}

var total = Math.Round(gross * (1 - discount), 0, MidpointRounding.AwayFromZero);
db.Orders.Add(new OrderEntity { GrossAmount = gross, NetAmount = total });
db.SaveChanges();
```

Dflow 先指出它看到的事實：

- `gross` 是訂單折扣前總額。
- `50000m` 是滿額門檻。
- `CustomerTier == "Senior"` 是老客戶折扣判斷。
- `seniorDiscount` 被算出來，但沒有累積到 `discount`。
- 同一個 handler 還有 EF 寫回與狀態設定，本 phase 不應全部拆掉。

Bob 問了一個 Brownfield 很常見、也很關鍵的問題：

```text
Bob:
baseline 是要寫 code 實際行為，也就是「Senior 沒套 5%」，
還是寫業務期望，也就是「應該先 9 折再 0.95」？
```

Dflow 的回答：

```text
Dflow:
我建議分兩層記錄：

- rules.md、behavior.md 與 feature 的 Current BR Snapshot 寫業務期望的 current behavior，
  也就是客訴確認後要成為 source of truth 的規則。

- phase-spec 的 Behavior Scenarios 保留一個 Baseline Contrast Scenario，
  明確寫「既有 Code-Behind 實際算出 NT$54,000，
  與業務期望 NT$51,300 不一致」。

- Open Questions 記錄這個決策：
  本 phase 的 baseline 以業務期望為準，
  buggy code result 作為修正對照，
  而不是把錯誤實作提升成業務規則。
```

Bob 確認：

```text
Bob:
這個取捨合理。buggy implementation 要留下證據，
但 source of truth 不能寫錯。
```

這段是本篇最重要的 brownfield lesson。

Baseline capture 不是照抄 legacy code。它要分辨：

| 類型 | 寫在哪裡 |
|---|---|
| 業務確認後的正確規則 | `rules.md`、`behavior.md`、Current BR Snapshot |
| 既有錯誤實作的重現結果 | phase spec 的 Baseline Contrast Scenario |
| 為什麼這樣取捨 | Open Questions / Implementation Notes |

如果把「Senior 沒套 5%」寫成 active business rule，未來 AI 會誤以為錯誤行為是需求。
Dflow 在這裡的價值，就是把 legacy observation 和 business truth 分開。

## Step 3 — Domain concepts

Dflow 建議初始 domain concepts：

| Concept | Type | 為什麼需要 |
|---|---|---|
| `Order` | Aggregate Root | 持有 order lines，計算折扣前總額與折扣後總額。 |
| `OrderLine` | Entity | 訂單中的單一品項明細。 |
| `Money` | Value Object | 避免裸 `decimal` 到處傳，封裝金額語意。 |
| `Quantity` | Value Object | 封裝數量合法性。 |
| `DiscountRate` | Value Object | 保護折扣率合法範圍 `[0.0, 1.0]`。 |
| `DiscountPolicy` | Domain Service | 封裝滿額折扣與 customer-tier 折扣的判定、順序與累積公式。 |
| `CustomerTier` | External reference value | 本 phase 只讀值，不建立 Customer BC。 |

初始 invariants：

```text
INV-01: Order.LineItems 必須至少含 1 個 OrderLine
INV-02: 每個 OrderLine 的 Money.Amount 必須 > 0
INV-03: DiscountRate 必須在 [0.0, 1.0]
INV-04: 多折扣用乘法累積，不用簡單相減或遺漏某個折扣
```

跟 Greenfield 不同，這裡沒有 `aggregate-design.md`。Brownfield track 以 `models.md`
和 phase spec 記錄抽離出來的 model，避免在第一個修改點就建立過重的設計文件。

## Step 3.5 — SPEC-ID、slug、目錄與 branch

Dflow 停下來確認命名：

```text
Dflow:
確認如下：

- SPEC-ID: SPEC-20260430-001
- slug: order-discount-calculation
- feature directory:
  dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/
- first phase file:
  phase-spec-2026-04-30-baseline-and-fix.md
- git branch:
  feature/SPEC-20260430-001-order-discount-calculation

這樣可以嗎？
```

Bob 回：

```text
Bob:
可以。
```

這個 gate 和 Greenfield 第一篇相同：Dflow 在真正建檔前確認 SPEC-ID、slug、
feature directory 與 branch。Brownfield 不代表流程鬆散；它只是更重視 baseline
與 extraction scope。

## Step 4 — Feature `_index.md` 當下長什麼樣

`_index.md` 是 feature dashboard。這一步結束當下，它會記錄 Goals & Scope、
phase spec、Current BR Snapshot 與 Resume Pointer。

重點片段：

```markdown
---
spec-id: SPEC-20260430-001
slug: order-discount-calculation
status: in-progress
created: 2026-04-30
branch: feature/SPEC-20260430-001-order-discount-calculation
---

# Order Discount Calculation

## Goals & Scope

本 feature 建立 Order BC 的第一個正式修改入口，
處理經銷商「華昕貿易」回報的訂單折扣計算錯誤：
滿 NT$50,000 的 9 折與老客戶額外 5% off 必須依業務期望累積，
而不是只套用滿額折扣。

Phase 1 baseline-and-fix 同時包含三件事：
1. baseline capture OrderEntry.aspx.cs 的折扣行為
2. 修正折扣累積 bug
3. 把折扣計算抽出為可測試的 src/Domain/Order/ Domain logic

本 feature 的邊界刻意限制在 OrderEntry.aspx.cs 的折扣計算路徑。
OrderList.aspx.cs、OrderDetail.aspx.cs 或其他頁面若也有相同規則，
先記為 tech debt，不在本 phase 擴張。

## Current BR Snapshot

| BR-ID | Current Rule | Status |
|---|---|---|
| BR-001 | 訂單折扣前總金額等於所有 OrderLine.UnitPrice * Quantity 的加總。 | draft |
| BR-002 | 訂單折扣前總金額 >= NT$50,000 時，套用滿額 10% off。 | draft |
| BR-003 | CustomerTier = Senior 時，額外套用 5% off。 | draft |
| BR-004 | 多個折扣率以乘法累積。 | draft |
```

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md)

補充：完整文件範例已包含後續 baseline capture、BUG-001 rounding inconsistency、
closeout integration summary；上方內嵌片段才是本步驟當下的 `_index.md` 重點。

## Step 4 — Phase spec 把 bug 修正變成可驗收行為

phase spec 是本步驟的主要 execution surface。它不只寫「修折扣 bug」，
而是把現有錯誤、業務期望、domain extraction 設計、test strategy 都放在同一個文件。

重點片段：

```markdown
# Baseline and Fix Order Discount Calculation

## Problem Description

客服團隊轉來經銷商「華昕貿易」的客訴：
一筆訂單符合滿 NT$50,000 9 折與老客戶額外 5% off，
但系統最後只套用滿額 9 折。

這不是單純一行 hotfix。折扣計算目前黏在 btnSubmit_Click event handler 中，
混合 UI 讀值、EF query、金額計算與 DB 寫回，缺少 spec 與 unit test。

## Behavior Scenarios

Scenario: Senior customer 同時套用滿額折扣與客戶等級折扣
  Given 經銷商 "華昕貿易" 的 CustomerTier 為 "Senior"
  And 訂單折扣前總額為 NT$60,000
  When Bob 在 OrderEntry 提交訂單
  Then 先套用滿額折扣 multiplier 0.9
  And 再套用客戶等級折扣 multiplier 0.95
  And 稅務處理前的最終金額為 NT$51,300

Scenario: 既有 Code-Behind 只套用滿額折扣
  Given 本 phase 前的 OrderEntry.aspx.cs 實作
  And Senior 客戶訂單的折扣前總額為 NT$60,000
  When btnSubmit_Click 計算最終金額
  Then code 寫入 NT$54,000，因為只套用 multiplier 0.9
  And 此結果與業務期望 NT$51,300 不一致
```

這兩個 scenario 的並列很關鍵：

- Main Success Scenario 是未來系統應該滿足的規則。
- Baseline Contrast Scenario 是舊 code 的錯誤證據。

完整文件範例：
[`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md)

## Step 4 — Business rules 與折扣公式

Dflow 把折扣規則寫成 BR：

```markdown
| BR-ID | Rule |
|---|---|
| BR-001 | 訂單折扣前總金額等於所有 OrderLine.UnitPrice * Quantity 的加總。 |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off。 |
| BR-003 | CustomerTier = 'Senior' 的老客戶可額外套用客戶等級折扣率 5% off。 |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣。 |
```

Bob 特別要求公式要寫清楚：

```text
Bob:
折扣公式要寫清楚。
不是 10% + 5% 直接變 15%，而是 60000 * 0.9 * 0.95。
```

Dflow 寫成：

```text
Total discount rate = 1 - (1 - fullThresholdRate) * (1 - customerTierRate)
```

所以滿額 10% 加 Senior 5% 的總折扣率不是 15%，而是：

```text
1 - 0.9 * 0.95 = 0.145
```

最終金額：

```text
60000 * 0.9 * 0.95 = 51300
```

這就是 spec-first 對 brownfield 的價值：修 bug 的同時，把容易被寫錯的公式變成
可 review、可測試、可遷移的 domain rule。

## Step 5 — Implementation plan：讓 Code-Behind 變薄

Spec 寫完後，Dflow 停下來：

```text
Dflow:
Spec is drafted — behavior scenarios, business rules, and edge cases are captured.
Ready to plan the implementation?

/dflow:next or reply OK to continue.
```

Bob 回：

```text
Bob:
/dflow:next
```

Dflow 規劃 Domain extraction：

```text
src/Domain/Order/
├── Order.cs
├── OrderLine.cs
├── Money.cs
├── Quantity.cs
├── DiscountRate.cs
└── DiscountPolicy.cs
```

`OrderEntry.aspx.cs` 不會被整頁重寫。它的責任縮小為：

1. 從 WebForms controls 與 EF entity 讀資料
2. map 成 `Order` / `OrderLine` / `Money` / `Quantity`
3. 呼叫 `DiscountPolicy`
4. 把結果寫回既有 `OrderEntity`

也就是說，Dflow 沒有要求 Bob 立刻建立完整 Application layer、repository abstraction、
controller 或全新資料庫模型。這是 Brownfield 和 Greenfield 的差異。

Bob 特別確認：

```text
Bob:
這段不要引入 Application layer。
Brownfield track 先 Domain + Code-Behind adapter + tests 就好。
```

Dflow 接受，並產生 Brownfield 適合的 task list：

```markdown
## Implementation Tasks

- [ ] DOMAIN-1: 建立 Order Aggregate Root
- [ ] DOMAIN-2: 建立 OrderLine 與 Money / Quantity / DiscountRate
- [ ] DOMAIN-3: 建立 DiscountPolicy
- [ ] WEBFORMS-1: 把 OrderEntry.aspx.cs input map 成 Domain objects
- [ ] WEBFORMS-2: 用 DiscountPolicy 取代 inline discount arithmetic
- [ ] TEST-1: 補 BR-001~BR-004 unit tests
- [ ] TEST-2: 補 INV 與 NT$50,000 boundary tests
```

這段展示 Dflow 的 pragmatic DDD：不是要求 legacy code 立刻符合理想 Clean Architecture，
而是先抽出一段可測試的核心規則。

## Step 6 — Branch ready，但本篇停在文件與計畫

Dflow 提出 branch：

```text
feature/SPEC-20260430-001-order-discount-calculation
```

Bob 決定今天先停在 spec 與 baseline docs：

```text
Bob:
今天先不實作。我想把 spec 和 baseline docs 先給同事 review。
明天接著實作 Domain extraction 與 unit tests。
```

Dflow 不執行 completion checklist，因為 implementation 尚未完成：

```text
Dflow:
Step 7 Implementation 不在這段 tutorial 範圍內。
這段我只產生 documentation artifacts，保留 phase-spec status = in-progress。

Step 8 只開頭說明，不執行 completion checklist：
因為 implementation 尚未完成，所以不能把 feature 標成 completed，
也不能歸檔到 completed/。
```

這也是 Dflow 對 brownfield 很重要的保護：沒有實作、測試與文件同步驗證，就不要假裝完成。

## 文件片段 1 — `domain/Order/context.md`

`context.md` 是 Order BC 的長期說明。這一步建立的當下版本大致如下：

```markdown
# Order Bounded Context

## Responsibilities

Order BC 負責接單流程中的訂單主體、訂單明細、金額計算與提交前後的訂單規則。
第一個已確認範圍是 OrderEntry 的折扣前總額與折扣計算。

## Boundaries

### In Scope
- 訂單主體與 OrderLine 明細的基本一致性
- 折扣前總金額計算
- 滿額折扣與客戶等級折扣的套用順序與累積規則
- OrderEntry.aspx.cs 中可抽離為純 C# 的折扣計算

### Out of Scope
- 客戶主檔、付款條件與信用額度 -> Customer
- 庫存量、預留與 AvailableToPromise -> Inventory
- 出貨流程、物流狀態與出貨條件 -> Shipment
- 發票、稅務、應收帳款與財務狀態 -> Invoice
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/context.md`](outputs/dflow/specs/domain/Order/context.md)

## 文件片段 2 — `domain/Order/rules.md`

`rules.md` 把折扣規則變成 BR-ID index：

```markdown
# Business Rules

| BR-ID | Rule summary | Status |
|---|---|---|
| BR-001 | 訂單折扣前總金額等於所有 OrderLine.UnitPrice * Quantity 的加總。 | active |
| BR-002 | 訂單折扣前總金額大於或等於 NT$50,000 時，套用滿額折扣率 10% off。 | active |
| BR-003 | CustomerTier = 'Senior' 的老客戶可額外套用客戶等級折扣率 5% off。 | active |
| BR-004 | 多個折扣率以乘法累積，順序為先套滿額折扣、再套客戶等級折扣。 | active |
```

完整文件範例：
[`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)

補充：完整文件範例還包含後續 `SPEC-20260505-002` 加入的 VIP discount BR-005~008。
本篇 step 02 當下只建立 BR-001~004。

## 文件片段 3 — `migration/tech-debt.md`

Bob 要求記下兩個 tech debt：

```text
Bob:
tech debt 記兩個重點。

第一，OrderList / OrderDetail 可能也有同樣折扣規則，但這 phase 不擴張。
第二，OrderEntry.aspx.cs 折扣抽出去後，handler 還有 EF query 和 DB write 沒拆。
```

Dflow 記錄的意思是：

```markdown
## Tech Debt

- [ ] OrderList / OrderDetail 可能有重複折扣規則
      Severity: Medium
      本 phase 只抽 OrderEntry.aspx.cs；後續 baseline capture 再確認其他頁面。

- [ ] OrderEntry event handler 仍混合資料存取與流程控制
      Severity: Medium
      折扣計算抽出後，UI parsing、EF query、DB write 仍在 Code-Behind。
```

完整文件範例：
[`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

這裡的重點是：Dflow 沒有把 tech debt 當成失敗，而是讓 Bob 明確記錄「本次不做什麼」。
這對 brownfield 特別重要，因為每個修改都可能誘惑你順手擴張。

## 本步驟的文件地圖

| 狀態 | Path | 讀者看什麼 |
|---|---|---|
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/_index.md) | Feature dashboard、BR snapshot、scope boundary、resume pointer。 |
| 新建 | [`outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md`](outputs/dflow/specs/features/completed/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md) | Baseline contrast、behavior scenarios、BR、implementation tasks。 |
| 新建 | [`outputs/dflow/specs/domain/Order/context.md`](outputs/dflow/specs/domain/Order/context.md) | Order BC responsibilities、scope、out-of-scope。 |
| 新建 | [`outputs/dflow/specs/domain/Order/models.md`](outputs/dflow/specs/domain/Order/models.md) | Order、OrderLine、Money、Quantity、DiscountRate、DiscountPolicy。 |
| 新建 | [`outputs/dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md) | BR-001~004 的 rule index。 |
| 新建 | [`outputs/dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md) | 折扣行為的 Given/When/Then。 |
| 修改 | [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | Order / OrderLine / DiscountPolicy 等 ubiquitous language。 |
| 修改 | [`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) | Order 與 Customer / Inventory / Shipment / Invoice 的邊界。 |
| 修改 | [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | 本次不擴張的頁面與剩餘 Code-Behind debt。 |
| 故意不建 | `events.md` | 本 phase 不引入 Domain Events。 |
| 故意不建 | `aggregate-design.md` | Brownfield step 以 phase spec + models.md 承載抽離設計。 |

上表連到完整文件範例；本篇關注的是 step 02 建立這些文件的第一個版本。

## 本篇展示的 Dflow 能力

| Dflow 能力 | 本篇可看到的證據 |
|---|---|
| Greenfield and Brownfield tracks | 同樣是 Dflow，但 Brownfield 從既有 WebForms 修改需求切入，不要求重寫。 |
| Spec-first development | Bob 先得到 phase spec、BR、baseline contrast、tasks，還沒改 production code。 |
| Hybrid workflow control | `/dflow:modify-existing` 進入後，Dflow 判斷 tier 與 host feature，再升級 flow。 |
| DDD semantic backbone | Order BC、Order Aggregate、Value Objects、DiscountPolicy 不是憑空命名，而是從現有 code 與客訴抽出。 |
| 三層文件分工 | phase spec 捕捉本次修改；feature `_index.md` 捕捉 snapshot；domain docs 捕捉長期 Order rules。 |
| Drift verification readiness | BR、behavior、implementation tasks、tech debt 都為後續 verify / PR review 提供依據。 |

## 這一段帶來的實際好處

| 風險 | 沒有 Dflow 時的常見狀況 | 本篇如何降低 |
|---|---|---|
| 快速 hotfix 掩蓋 domain 建模需求 | 補一行 discount arithmetic，但沒留下規則與測試。 | 升級成 T1 feature，建立 Order BC 與 BR。 |
| 錯誤 legacy behavior 被寫成規則 | 覺得「系統現在就是這樣算」，就把 NT$54,000 當規則。 | Baseline contrast 保留錯誤，rules 寫業務期望 NT$51,300。 |
| scope 膨脹 | 順手重寫 OrderEntry / OrderList / OrderDetail。 | 本 phase 只抽 OrderEntry 折扣計算，其他頁面記 tech debt。 |
| primitive obsession | 折扣、金額、數量都用 decimal / int 到處傳。 | Money、Quantity、DiscountRate 把語意包進型別。 |
| migration 沒有累積資產 | 每次修改仍綁死 WebForms。 | 抽出 pure C# Domain logic，未來可搬到 ASP.NET Core。 |

## 對不熟 Brownfield DDD 的讀者的讀法

讀這篇時，不需要先追求「完整 DDD 架構」。Brownfield 的重點是逐步。

可以抓四個問題：

1. **這次修改碰到哪條真正的業務規則？**
   本篇答案是滿額折扣與 Senior 折扣的累積公式。

2. **現有 code 的行為和業務期望是否一致？**
   本篇答案是不一致；NT$54,000 是 buggy result，NT$51,300 才是業務期望。

3. **這段規則能不能先抽成純 C#？**
   本篇答案是可以；`DiscountPolicy` 與 Value Objects 不需要 WebForms。

4. **哪些東西先不要碰？**
   本篇答案是 Customer BC、Inventory、Shipment、Invoice、其他頁面、完整 Application layer。

這種克制正是 Brownfield DDD 的價值：每次只抽出足夠小、但足夠有價值的一段。

## Key takeaways

- `/dflow:modify-existing` 不是只做小修改；它會先判斷 tier 與 host feature。
- Brownfield 第一次碰到核心業務規則時，可能需要升級成 `/dflow:new-feature` 建立第一個 BC。
- Baseline capture 要分清楚「buggy code result」和「business source of truth」。
- Dflow 可以讓 WebForms Code-Behind 逐步變薄，不需要一次大重寫。
- Tech debt 是 scope control 工具：把這次不做的東西記下來，避免悄悄擴張。

## 下一個 walkthrough

下一個 Brownfield walkthrough 可接 [〈Walkthrough 03 — baseline capture 跨頁面折扣顯示行為〉](walkthrough-03-baseline-capture.md)：
同一個 Order BC 後續需要跨頁面確認 rounding / display 行為，這會展示 Brownfield
baseline capture 如何在不立即改 code 的情況下，先建立跨頁面的 confirmed behavior。
