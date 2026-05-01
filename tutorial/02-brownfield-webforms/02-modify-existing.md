# /dflow:modify-existing — Bob 第一次從 OrderEntry 抽離折扣 Domain logic

## 劇情背景

2026-04-30 週四下午，客服團隊轉給 Bob 一張客訴。經銷商「華昕貿易」回報上週一筆訂單的最終金額算錯：他們預期同時套用「滿 NT$50,000 9 折」與「老客戶額外 5% off」，但 OrderManager 最後只套了滿額 9 折。

Bob 在 dev 環境用相同條件重現：`CustomerTier = 'Senior'`、訂單折扣前總額 NT$60,000。業務期望結果應該是先算 9 折再套 0.95，也就是 NT$51,300；系統卻存成 NT$54,000。Bob 追到 `OrderEntry.aspx.cs`，看到折扣計算黏在 `btnSubmit_Click` event handler 裡，前後混著 EF query、UI grid 讀值、`decimal` 計算與 DB 寫回。

這次 Bob 沒有把它當一行 hotfix。他判斷這是 Order BC Day 0 抽離的好機會：先 capture baseline，修掉折扣累積 bug，再把 Order 的第一段 Domain logic 抽到純 C#，讓後面遷移 ASP.NET Core 時有可測試的起點。

## 完整對話

> **Bob**：客服剛轉一張客訴。華昕貿易上週一筆訂單符合滿 NT$50,000 9 折，也符合老客戶 5% off，但系統只套了 9 折。我在 dev 用同條件重現了，問題在 `OrderEntry.aspx.cs` 的折扣計算。這段目前黏在 `btnSubmit_Click` 裡，我想用這次修改正式開始抽 Order BC。`/dflow:modify-existing`

> **Dflow**：收到。這是 modify-existing flow。我先跑 Step 1：Assess the Change。這一步同時判斷 Ceremony Tier 與 Feature Linkage。
>
> Part A — Tier 判定：
>
> - T1 Heavy？是。這次不是單純修一個判斷式，會建立第一個 Order BC structure，包含 `Order` Aggregate Root、`OrderLine` Entity、`Money` / `Quantity` / `DiscountRate` Value Objects、`DiscountPolicy`，而且會新增多條 BR。
> - T2 Light？否。光是建立首個 Aggregate，加上從 `OrderEntry.aspx.cs` 抽出約 80 行 handler 裡的核心計算，已經超過 lightweight bug fix。
> - T3 Trivial？否。這不是 copy、button color、註解或格式調整；它會改變訂單金額。
>
> 結論：**T1 Heavy**。

> **Bob**：同意。這如果硬寫成 bug fix，後面團隊會看不出我們其實建立了第一個 Domain model。

> **Dflow**：Part B — Feature Linkage。
>
> 我掃描目前 specs baseline：`dflow/specs/features/active/` 還沒有 active feature；`completed/` 也沒有可以 reopen 的 feature。這是 brownfield 專案第一次正式修改 Order 行為，所以沒有 host feature。
>
> 根據 modify-existing-flow Step 1 的規則：T1 Heavy 如果沒有 host active feature，而且不是 completed feature follow-up，就要升級到 `/dflow:new-feature`。我建議在這裡切到 new-feature flow，建立：
>
> ```text
> SPEC-20260430-001-order-discount-calculation
> ```
>
> 第一個 phase 可以叫 `baseline-and-fix`，內容包含三件事：
>
> 1. baseline capture 既有 `OrderEntry.aspx.cs` 折扣行為
> 2. 修正滿額折扣 + 老客戶折扣的累積 bug
> 3. 抽出 Order BC 的第一段 Domain logic

> **Bob**：好。這個 bug 是入口，但本質是第一個 Order feature。切到 `/dflow:new-feature`。

> **Dflow**：Step 1 complete（tier T1 decided, no host feature found, escalated to `/dflow:new-feature`）。  
> Step 1.5 — Completed-feature reopen detection：**skip**。
>
> 跳過理由：沒有 related completed feature；這不是 reopen，也不是 follow-up。
>
> Step 1.6 — Create Follow-up Feature：**skip**。
>
> 跳過理由：沒有 Step 1.5 Option A。接下來我會明確切到 new-feature flow。

> **Dflow**：現在進入 `/dflow:new-feature` Step 1：Intake。
>
> 我先整理需求：
>
> - Stakeholder：經銷商「華昕貿易」、客服團隊、接單維運團隊
> - Problem：Senior customer 的訂單符合兩個折扣，但系統只套滿額 9 折
> - Why now：客訴已重現，且這段規則目前沒有 spec / unit tests
> - Brownfield goal：不要大改整個 OrderEntry，先抽折扣計算這段可測試 Domain logic
>
> Step 1 complete（intake）。Entering Step 2: Identify the Bounded Context.

> **Dflow**：Step 2 — Identify the Bounded Context。
>
> 這個 feature 涉及訂單明細、訂單總額、折扣與提交流程。從 `context-map.md` 來看，這應該落在 **Order** Bounded Context。Customer 目前只提供 `CustomerTier` reference data；Inventory、Shipment、Invoice 都不是本 phase 的 owner。
>
> 我建議建立第一個 BC directory：
>
> ```text
> dflow/specs/domain/Order/
> ```
>
> 其中包含 `context.md`、`models.md`、`rules.md`、`behavior.md`。這樣 Order 的折扣規則以後不會只藏在 feature spec 裡。

> **Bob**：放 Order。CustomerTier 先當 reference value，不要在這裡順手建 Customer BC。

> **Dflow**：Step 2 complete（BC identified: Order）。Entering Step 3: Domain Concept Discovery.

> **Dflow**：Step 3 — Domain Concept Discovery。因為這是 brownfield 首次抽 Domain logic，我先做 baseline capture，再提 Domain concepts。
>
> 我讀到的既有 Code-Behind 路徑是：
>
> ```text
> OrderManager.Web/Pages/Order/OrderEntry.aspx.cs
> class OrderEntry
> method btnSubmit_Click(object sender, EventArgs e)
> approximate lines 142-187
> ```
>
> 相關片段大概長這樣：
>
> ```csharp
> var customer = db.Customers.Single(c => c.Id == customerId);
> var lines = BuildLinesFromGrid(gvOrderLines);
>
> decimal gross = 0m;
> foreach (var row in lines)
> {
>     gross += row.UnitPrice * row.Quantity;
> }
>
> decimal discount = 0m;
> if (gross >= 50000m)
> {
>     discount += 0.10m;
> }
>
> if (customer.CustomerTier == "Senior")
> {
>     seniorDiscount = 0.05m;
>     // seniorDiscount 沒有進入 total discount
> }
>
> var total = Math.Round(gross * (1 - discount), 0, MidpointRounding.AwayFromZero);
> db.Orders.Add(new OrderEntity { GrossAmount = gross, NetAmount = total });
> db.SaveChanges();
> ```
>
> 我看到幾個要 capture 的點：
>
> - `gross` 是訂單折扣前總額。
> - `50000m` 是滿額門檻，現在是 magic number。
> - `CustomerTier == "Senior"` 是老客戶折扣判斷。
> - `seniorDiscount` 被算出來但沒有累積到 `discount`，這就是重現結果只套 9 折的原因。
> - 同一個 handler 後面還有 EF 寫回與狀態設定，本 phase 不應全部拆掉。

> **Bob**：這裡有個 baseline 問題。baseline 是要寫 code 實際行為，也就是「Senior 沒套 5%」，還是寫業務期望，也就是「應該先 9 折再 0.95」？

> **Dflow**：這是 brownfield 很重要的切點。
>
> 我建議分兩層記錄：
>
> - `rules.md`、`behavior.md` 與 feature 的 Current BR Snapshot 寫 **業務期望的 current behavior**，也就是客訴確認後要成為 source of truth 的規則。
> - phase-spec 的 Behavior Scenarios 保留一個 **Baseline Contrast Scenario**，明確寫「既有 Code-Behind 實際算出 NT$54,000，與業務期望 NT$51,300 不一致」。
> - Open Questions 記錄這個決策：本 phase 的 baseline 以業務期望為準，buggy code result 作為修正對照，而不是把錯誤實作提升成業務規則。
>
> 這樣可以避免未來讀 `behavior.md` 的人以為「只套 9 折」是正確規則。

> **Bob**：這個取捨合理。buggy implementation 要留下證據，但 source of truth 不能寫錯。

> **Dflow**：Domain concepts 我會這樣建：
>
> - Aggregate Root：`Order`
> - Entity：`OrderLine`
> - Value Objects：`Money`、`Quantity`、`DiscountRate`
> - Domain Service / Policy：`DiscountPolicy`
> - Reference value：`CustomerTier`
>
> 初始 invariants：
>
> - INV-01：`Order.LineItems` 必須至少含 1 個 `OrderLine`
> - INV-02：每個 `OrderLine` 的 `Money.Amount` 必須 > 0
> - INV-03：`DiscountRate` 必須在 `[0.0, 1.0]`
> - INV-04：總折扣率 = `1 - (1 - 滿額折扣率) * (1 - 客戶等級折扣率)`，不是 `1 - 滿額折扣率 - 客戶等級折扣率`
>
> Domain concepts captured. Before I create any files, let me confirm the SPEC-ID, slug, feature directory, and branch name with you（Step 3.5）.

> **Bob**：用今天第一個 spec：`SPEC-20260430-001`。slug 用 `order-discount-calculation`。phase slug 用 `baseline-and-fix`。

> **Dflow**：確認如下：
>
> - SPEC-ID: `SPEC-20260430-001`
> - slug: `order-discount-calculation`
> - feature directory: `dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/`
> - first phase file: `phase-spec-2026-04-30-baseline-and-fix.md`
> - git branch: `feature/SPEC-20260430-001-order-discount-calculation`
>
> 這樣可以嗎？

> **Bob**：可以。

> **Dflow**：Step 3.5 complete（slug confirmed）。Entering Step 4: Write the Spec.

> **Dflow**：Step 4 — Write the Spec。
>
> 我會建立 feature-level `_index.md`，並在 Phase Specs 表新增第一列：
>
> ```text
> | 1 | 2026-04-30 | baseline-and-fix | in-progress | phase-spec-2026-04-30-baseline-and-fix.md |
> ```
>
> Current BR Snapshot 先列四條：
>
> - BR-001：訂單折扣前總金額 = Σ(`OrderLine.UnitPrice * Quantity`)
> - BR-002：折扣前總額 ≥ NT$50,000 時套用滿額 10% off
> - BR-003：`CustomerTier = 'Senior'` 時額外套用 5% off
> - BR-004：折扣以先滿額、再客戶等級的順序乘法累積
>
> phase-spec 的 Behavior Scenarios 會有三種：
>
> - Main Success：Senior + NT$60,000 → NT$51,300
> - Baseline Contrast：既有 Code-Behind → NT$54,000，標記為 bug
> - Alternatives：非 Senior 只套滿額、Senior 未滿門檻只套 customer-tier

> **Bob**：折扣公式要寫清楚。不是 10% + 5% 直接變 15%，而是 `60000 * 0.9 * 0.95`。

> **Dflow**：我會把 BR-004 寫成：
>
> ```text
> Total discount rate = 1 - (1 - fullThresholdRate) * (1 - customerTierRate)
> ```
>
> 所以滿額 10% 加 Senior 5% 的總折扣率是 `1 - 0.9 * 0.95 = 0.145`，折扣後金額是 NT$51,300。
>
> Spec is drafted — behavior scenarios, business rules, and edge cases are captured. Ready to plan the implementation（Domain layer design, thin Code-Behind）？`/dflow:next` or reply OK to continue.

> **Bob**：`/dflow:next`

> **Dflow**：Step 5 — Plan the Implementation。
>
> Domain layer first：
>
> ```text
> src/Domain/Order/
> ├── Order.cs
> ├── OrderLine.cs
> ├── Money.cs
> ├── Quantity.cs
> ├── DiscountRate.cs
> └── DiscountPolicy.cs
> ```
>
> `OrderEntry.aspx.cs` 的責任會縮小成：
>
> 1. 從 WebForms controls 與 EF entity 讀資料
> 2. map 成 `Order` / `OrderLine` / `Money` / `Quantity`
> 3. 呼叫 `DiscountPolicy`
> 4. 把結果寫回既有 `OrderEntity`
>
> 它不再自己決定折扣門檻、折扣率與累積公式。

> **Bob**：這段不要引入 Application layer。WebForms 版先 Domain + Code-Behind adapter + tests 就好。

> **Dflow**：同意。這是 WebForms skill，不是 Core skill。Implementation Tasks 我會用 WebForms 適合的分類：
>
> - DOMAIN-1：建立 `Order` Aggregate Root
> - DOMAIN-2：建立 `OrderLine` 與 `Money` / `Quantity` / `DiscountRate`
> - DOMAIN-3：建立 `DiscountPolicy`
> - WEBFORMS-1：把 `OrderEntry.aspx.cs` input map 成 Domain objects
> - WEBFORMS-2：用 `DiscountPolicy` 取代 inline discount arithmetic
> - TEST-1：補 BR-001~BR-004 unit tests
> - TEST-2：補 INV 與 NT$50,000 boundary tests
>
> Step 5 complete（implementation plan + task list ready）。Entering Step 6: Git Branch.

> **Dflow**：Step 6 — Git Branch。
>
> 依 Git Flow conventions，建議 branch：
>
> ```text
> feature/SPEC-20260430-001-order-discount-calculation
> ```
>
> 這段 tutorial 不會真的建立 branch，也不會 commit。Branch `feature/SPEC-20260430-001-order-discount-calculation` ready as planned. Ready to start implementation? `/dflow:next` to proceed, or discuss implementation order / scope first.

> **Bob**：今天先不實作。我想把 spec 和 baseline docs 先給同事 review。明天接著實作 Domain extraction 與 unit tests。

> **Dflow**：OK。Step 7 Implementation 不在這段 tutorial 範圍內。這段我只產生 documentation artifacts，保留 phase-spec status = `in-progress`，Implementation Tasks 都不勾選。
>
> Step 8 只開頭說明，不執行 completion checklist：因為 implementation 尚未完成，所以不能把 feature 標成 completed，也不能歸檔到 `completed/`。
>
> 我會落地以下文件：
>
> - feature `_index.md`
> - phase-spec `baseline-and-fix`
> - Order BC 的 `context.md`、`models.md`、`rules.md`、`behavior.md`
> - 更新 glossary、context-map、tech-debt

> **Bob**：tech debt 記兩個重點。第一，OrderList / OrderDetail 可能也有同樣折扣規則，但這 phase 不擴張。第二，`OrderEntry.aspx.cs` 折扣抽出去後，handler 還有 EF query 和 DB write 沒拆。

> **Dflow**：會記錄。我也會加一條低 severity 的設計提醒：如果未來折扣規則變多，再評估 `DiscountPolicy` 是否拆成 PolicyChain 或 Strategy pattern；本 phase 不過度設計。
>
> Documentation package ready。明天接著進 Step 7：實作 Domain extraction 與 unit tests；實作完成後再觸發 Step 7 → Step 8 completion checklist。

## 本段產出的檔案

**新增**
- [`dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md`](outputs/dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/_index.md)
- [`dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md`](outputs/dflow/specs/features/active/SPEC-20260430-001-order-discount-calculation/phase-spec-2026-04-30-baseline-and-fix.md)
- [`dflow/specs/domain/Order/context.md`](outputs/dflow/specs/domain/Order/context.md)
- [`dflow/specs/domain/Order/models.md`](outputs/dflow/specs/domain/Order/models.md)
- [`dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)
- [`dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md)

**修改**
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md)
- [`dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md)
- [`dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

**故意不建 / 不改**
- 不建 `aggregate-design.md` — WebForms 版用 `models.md` 描述 Aggregate，`aggregate-design.md` 是 Core 劇情慣例。
- 不建 `events.md` — 本 phase 不引入 Domain Events。
- 不動 `sdd-ddd-*-skill/`、`proposals/`、`CHANGELOG.md` 或劇情 1 檔案。
- 不 commit、不 push、不建 worktree。

## 觀察重點

- **no host feature → escalate to new-feature**：雖然 Bob 入口是 `/dflow:modify-existing`，但 Step 1 判定為 T1 Heavy，且沒有 active/completed host feature，所以依 WebForms modify-existing flow 轉入 `/dflow:new-feature`。
- **baseline capture 的範圍策略**：Systematic Baseline Capture 要讀相關頁面，不只盯單一 bug 行；本案為控制 scope，只正式 baseline `OrderEntry.aspx.cs` 的折扣計算，`OrderList` / `OrderDetail` 可能重複規則先記到 tech-debt。
- **baseline 寫業務期望 vs code 實際行為**：`rules.md` / `behavior.md` 寫客訴確認後的業務期望；phase-spec 另寫 Baseline Contrast Scenario 保存 buggy code result。
- **首個 BC 的設計取捨**：Order 建 Aggregate Root，Money / Quantity / DiscountRate 處理 primitive obsession，DiscountPolicy 包裝折扣累積；CustomerTier 先當 reference value，不急著建立 Customer BC。
- **WebForms 與 Core 的差異**：Core greenfield 可以從乾淨 BC 開始；WebForms brownfield 必須先 capture 現有 Code-Behind、控制 extraction scope，再逐步把可攜 Domain logic 抽出。

## 下一個劇情段

→ [`03-baseline-capture.md`](03-baseline-capture.md)：深入示範 baseline capture 的另一個 brownfield 場景，可能是跨頁面的折扣規則 capture，或同一個 Order BC 的 baseline 版本管理技巧。
