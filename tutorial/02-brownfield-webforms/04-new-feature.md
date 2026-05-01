# /dflow:new-feature — VIP discount policy 與 Customer reference data 邊界

## 劇情背景

2026-05-05 週二上午，Bob 回到 office。前一天他已完成 `SPEC-20260430-001-order-discount-calculation` phase 1 的 Domain extraction，`Order`、`OrderLine`、`Money`、`DiscountRate`、`DiscountPolicy` 已 merge 到 develop，BR-001~004 的 unit tests 全綠，團隊也穩定試用了一天。

業務經理 Daniel 早上找到 Bob，帶來新的 VIP loyalty program 需求：

> 「我們想為 VIP 客戶推出新折扣規則。VIP 客戶 + 在合約有效期內的訂單，才能套用 7% 折扣，合約過期就回到一般規則。  
> 對了，我看 `OrderList` 的 code 有 `isVip * 0.93` 那段，跟我們現在說的不是同一回事，那是 5 年前一檔促銷的殘留，可以直接刪掉。」

Bob 記下 Daniel 的需求，也確認段 3 的 unknown legacy behavior 已經有答案：`OrderList.aspx.cs` 的 `isVip` multiplier `0.93` 是 dead code，可以移除。但 Bob 沒把新 VIP 折扣當成既有 feature 的小修改；它涉及新 BR、新 `ContractValidUntil` Value Object、Customer reference data，以及與 phase 1 已 ship 的 BR-001~004 互動，所以他決定觸發 `/dflow:new-feature`，建立第二個 Order BC feature。

## 完整對話

> **Bob**：Daniel 剛提出新需求。VIP 客戶如果訂單在合約有效期內，要額外套用 7% off；合約過期就回一般規則。  
> 同時，他確認段 3 的 `OrderList.aspx.cs` 裡 `isVip * 0.93` 是五年前促銷殘留，可以刪掉。這次我判斷不是 bug fix，也不是修改舊 BR；這是新的 VIP discount policy。`/dflow:new-feature`

> **Dflow**：收到。這是 `/dflow:new-feature`，預設 T1 Heavy。這次會建立新的 feature directory，而不是回改 `SPEC-20260430-001`。
>
> 先做 Step 0 — legacy unknown disposition。你剛補上的業務確認很重要：段 3 的 `isVip * 0.93` unknown 已解決，但它不是新 VIP feature 的 BR source。
>
> 我會這樣處理：
>
> - `isVip * 0.93` removal 標為 phase 1 implementation task 的 cleanup step。
> - 不把它寫成 BR，因為它是 dead code，不是 accepted behavior。
> - `tech-debt.md` 該 entry status 從 `open` 改成 `resolved`。
> - resolved note 引用本 feature：`2026-05-05 業務確認為 dead code，由 SPEC-20260505-002 phase 1 implement task 移除`。

> **Bob**：對。新需求剛好也是 7% off，所以很容易讓人誤會那段 legacy code 是現役規則。但 Daniel 說得很明確：舊 code 跟這次 VIP program 不是同一件事。

> **Dflow**：我會把這個 distinction 寫進 spec。Step 1 — Intake。
>
> 我先整理 What / Who / Why：
>
> - What：VIP 客戶折扣特例規則。
> - Who：業務團隊 Daniel，以及具備 VIP loyalty program eligibility 的客戶。
> - Why：推出 VIP loyalty program；合約有效期內的 VIP 訂單額外 7% off，合約過期回一般規則。
>
> 我也掃描既有 assets：
>
> - `dflow/specs/domain/Order/rules.md` 已有 BR-001~004，處理折扣前總額、滿額折扣、Senior 折扣與 compound formula。
> - `dflow/specs/domain/Order/models.md` 已有 `DiscountPolicy`，可擴張，不需要重寫。
> - `dflow/specs/domain/glossary.md` 已有 `CustomerTier`，目前只明確列 `Senior`。
> - `dflow/specs/domain/context-map.md` 已把 Customer 列為候選 BC / upstream reference data。
>
> 這個需求看起來是擴張 Order discount policy，而不是修 OrderList legacy bug。Step 1 complete（intake）。Entering Step 2: Identify the Bounded Context.

> **Bob**：這裡我想先確認 BC。VIP status 和合約日期明顯是 Customer 的資料，但折扣計算又在 Order。你會放哪裡？

> **Dflow**：Step 2 — Identify the Bounded Context。這正是本段最重要的 boundary decision。
>
> 我看到兩種切法：
>
> 1. 放 Customer BC：因為 VIP status、合約有效期、客戶分類都屬於 Customer 概念。
> 2. 放 Order BC：因為真正改變的是訂單折扣計算，會和 BR-002~BR-004 的折扣公式互動。
>
> 我建議本 feature 放 **Order BC**，理由是：
>
> - BR 的 owner 是 `DiscountPolicy`，不是 Customer 主檔維護。
> - 新規則要決定 full-threshold、VIP、Senior 的 stack order，這是 Order 折扣計算語境。
> - Customer 只提供 reference data：`CustomerTier`、VIP eligibility、`ContractValidUntil`。
> - 若現在正式建立 Customer BC，scope 會從一條折扣規則擴張成客戶主檔、合約管理、owner workflow，超出這個 feature。

> **Bob**：所以 Customer BC 先不建。那 `context-map.md` 要怎麼寫，才不會讓人以為我們忽略 Customer？

> **Dflow**：我會把 Customer 標成「partially referenced via reference data，未正式建 BC」。也就是：
>
> - Customer BC 已在 context-map 中列為候選 BC。
> - 本 feature 只用 Customer 概念，不正式建立 Customer Aggregate 或 Customer BC directory。
> - `GetVipContractInfo(customerId)` 類似 reference repository query，提供 Order BC 計算所需資料。
> - 真正建立 Customer BC 應由 Customer-owned feature 觸發，例如合約維護、付款條件或信用額度規則。
>
> Step 2 complete（BC identified: Order；Customer partially referenced via reference data）。Entering Step 3: Domain Concept Discovery.

> **Dflow**：Step 3 — Domain Concept Discovery。
>
> 新 nouns：
>
> - `VIP`
> - `CustomerTier`
> - `ContractValidUntil`
> - `VIP discount policy`
>
> 新 verbs / behaviors：
>
> - 判斷 VIP contract 是否在有效期內。
> - 將 VIP 7% off 放進既有 `DiscountPolicy`。
> - 決定 full-threshold、VIP、Senior 的 stack order。
>
> 新 constraints：
>
> - `ContractValidUntil >= OrderDate` 視為有效，等於到期日當天仍可套用。
> - `ContractValidUntil` 必須是合法日期，且不能是 10 年外這種 suspicious future value。
> - `OrderList isVip * 0.93` 是 dead code cleanup，不是 BR。

> **Bob**：`CustomerTier` 已經有 `Senior`。這次要不要加 `VIP`？還是 VIP 另外當 `IsVip`？

> **Dflow**：我建議在 glossary 與 models 裡把 `CustomerTier` enum values 擴到 `Senior` + `VIP`，但 Domain input 要允許 VIP eligibility 與 Senior discount 同時存在。這裡要避免被 legacy schema 限制住：
>
> - Legacy 可能是 `CustomerTier`、`IsVip`、合約表或 SP 組出來。
> - Domain 語意上，VIP 是 loyalty program eligibility，Senior 是 customer-tier discount eligibility。
> - Daniel 確認 VIP + Senior 同時出現是合理組合，不互斥。
>
> 所以 BR-008 會寫：VIP eligibility 與 Senior customer-tier 可以同時存在，業務允許 stack。

> **Bob**：同意。不要因為資料庫欄位長得像 enum，就把業務規則硬設成互斥。

> **Dflow**：Domain concepts captured。Before I create any files, let me confirm the SPEC-ID, slug, feature directory, and branch name with you（Step 3.5）。

> **Bob**：今天用第二個 spec：`SPEC-20260505-002`。slug 用 `vip-discount-policy`。phase slug 用 `vip-rate-and-contract`。

> **Dflow**：確認如下：
>
> - SPEC-ID: `SPEC-20260505-002`
> - slug: `vip-discount-policy`
> - feature directory: `dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/`
> - first phase file: `phase-spec-2026-05-05-vip-rate-and-contract.md`
> - git branch: `feature/SPEC-20260505-002-vip-discount-policy`
>
> 這樣可以嗎？

> **Bob**：可以。

> **Dflow**：Step 3.5 complete（slug confirmed）。Entering Step 4: Write the Spec.

> **Dflow**：Step 4 — Write the Spec。
>
> 我會建立第二個 feature directory：
>
> ```text
> dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/
> ├── _index.md
> └── phase-spec-2026-05-05-vip-rate-and-contract.md
> ```
>
> `_index.md` 會有 6 sections 與 `dflow:section` anchors，Phase Specs 第一列是：
>
> ```text
> | 1 | 2026-05-05 | vip-rate-and-contract | in-progress | phase-spec-2026-05-05-vip-rate-and-contract.md |
> ```
>
> Current BR Snapshot 會列 BR-005~008。BR 編號不從 001 重來，因為它們仍屬於同一個 Order BC，BR-ID 應在 BC 內唯一。

> **Bob**：BR-005 到 BR-008 先唸一次。

> **Dflow**：我會這樣寫：
>
> - BR-005：VIP 客戶且 `ContractValidUntil >= OrderDate` 時，額外套用 VIP 7% off（multiplier 0.93）。
> - BR-006：VIP 合約過期時不套用 VIP 7% off，但仍依一般折扣規則計算。
> - BR-007：多折扣 stack order 為 full-threshold -> VIP -> Senior；公式為 `1 - (1 - fullRate) * (1 - vipRate) * (1 - tierRate)`。
> - BR-008：VIP eligibility 與 Senior customer-tier 可以同時存在，業務允許同時 stack。

> **Bob**：stack order 為什麼 VIP 放 Senior 前面？如果乘法，其實數學上結果一樣。

> **Dflow**：數學上乘法可交換，但 spec 仍要定 order，原因有三個：
>
> - UI discount breakdown 需要穩定顯示順序。
> - 後續若加入 capped discount、rounding step 或不可 stack promotion，順序會影響結果。
> - 測試案例需要一個 business-readable order，避免每個頁面自行排序。
>
> Daniel 的語意是「合約內 VIP 額外 7% off，且可與 Senior stack」。我建議 order 寫成 full-threshold -> VIP -> Senior，因為滿額折扣是 order amount 條件，VIP 是 loyalty contract，Senior 是 customer-tier discount。這也保留 phase 1 的 full-threshold -> Senior 行為：當 VIP 不適用時，BR-004 結果不變。

> **Bob**：可以。也請寫清楚不要回頭改 SPEC-001 的 BR。BR-001~004 是已 ship baseline，新需求只新增 BR-005~008。

> **Dflow**：會。`SPEC-20260430-001` 的 `_index.md` 不回改；本 feature 只在 Order BC 的 current docs 補新增規則，並在新 phase-spec 的 Delta 裡列 `UNCHANGED`：BR-001~004 不變。
>
> Spec is drafted — behavior scenarios, business rules, and edge cases are captured. Ready to plan the implementation（Domain layer design, interfaces, thin Code-Behind）？`/dflow:next` or reply OK to continue.

> **Bob**：`/dflow:next`

> **Dflow**：Step 5 — Plan the Implementation。
>
> Domain layer first：
>
> - `CustomerTier` reference value 加入 `VIP`，但保留 Senior eligibility 的既有判斷。
> - 新增 `ContractValidUntil` Value Object。
> - 擴張 `DiscountPolicy`，新增 VIP 路徑與 stack order；不要改既有 BR-001~004 method 的 observable behavior。
> - 新增 Customer reference repository query：`GetVipContractInfo(customerId)`。
>
> Code-Behind thin layer：
>
> - `OrderEntry.aspx.cs` 讀 customer reference data，map 成 Domain input。
> - `OrderEntry.aspx.cs` 不直接判斷 VIP 折扣。
> - `OrderList.aspx.cs` 移除 legacy `isVip * 0.93` dead code，作為 cleanup task。

> **Bob**：測試要把合約日期邊界補足。到期日當天 inclusive，前一秒過期，後一秒有效。

> **Dflow**：會放進 TEST tasks。Implementation Tasks 我會寫成：
>
> - DOMAIN-1：`CustomerTier` 加 `VIP`
> - DOMAIN-2：建立 `ContractValidUntil`
> - DOMAIN-3：擴張 `DiscountPolicy`
> - DOMAIN-4：實作 full-threshold -> VIP -> Senior stacking
> - WEBFORMS-1：`OrderEntry.aspx.cs` map VIP contract info
> - WEBFORMS-2：移除 `OrderList.aspx.cs` dead code
> - INFRA-1：Customer reference repository 增加 `GetVipContractInfo(customerId)`
> - TEST-1~3：BR-005~008、VO boundary、stacking order tests
>
> Step 5 complete（implementation plan + task list ready）。Entering Step 6: Git Branch.

> **Dflow**：Step 6 — Git Branch。
>
> 依 Bob 在段 0 選的 Git Flow，從 `develop` 開 feature branch：
>
> ```text
> feature/SPEC-20260505-002-vip-discount-policy
> ```
>
> 這段 tutorial 不會真的建立 branch，也不會 commit。Branch `feature/SPEC-20260505-002-vip-discount-policy` ready as planned. Ready to start implementation? `/dflow:next` to proceed, or discuss implementation order / scope first.

> **Bob**：可以。這段 tutorial 到這裡就好，後續 implementation 不在本段範圍。我要先把 spec 和 BC boundary decision 給同事 review。

> **Dflow**：Step 7 implementation 尚未開始，所以 Step 8 completion checklist 不執行。這段會落地 documentation artifacts：
>
> - 新 feature `_index.md`
> - phase-spec `vip-rate-and-contract`
> - 更新 Order BC 的 `context.md`、`models.md`、`rules.md`、`behavior.md`
> - 更新 `glossary.md`、`context-map.md`
> - 更新 `tech-debt.md`，把 `OrderList isVip multiplier 0.93` 標成 resolved
>
> 下一步是 Bob 開 branch 並進入 implementation；完成後才觸發 Step 7 -> Step 8 completion checklist。

## 本段產出的檔案

**新增**
- [`dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/_index.md)
- [`dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/phase-spec-2026-05-05-vip-rate-and-contract.md`](outputs/dflow/specs/features/active/SPEC-20260505-002-vip-discount-policy/phase-spec-2026-05-05-vip-rate-and-contract.md)

**修改**
- [`dflow/specs/domain/Order/models.md`](outputs/dflow/specs/domain/Order/models.md)
- [`dflow/specs/domain/Order/rules.md`](outputs/dflow/specs/domain/Order/rules.md)
- [`dflow/specs/domain/Order/behavior.md`](outputs/dflow/specs/domain/Order/behavior.md)
- [`dflow/specs/domain/Order/context.md`](outputs/dflow/specs/domain/Order/context.md)
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md)
- [`dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md)
- [`dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

**故意不建 / 不改**
- 不動 `SPEC-20260430-001-order-discount-calculation/` — phase 1 已 ship，不因新 feature 回改既有 feature history。
- 不建 `aggregate-design.md` — WebForms 版用 `models.md` 描述 Aggregate / VO / Domain Service。
- 不建 `events.md` — 本 feature 不引入 Domain Events。
- 不動 `sdd-ddd-*-skill/`、`proposals/`、`reviews/`、`planning/`、`CHANGELOG.md` 或其他 tutorial 舊檔。
- 不 commit、不 push、不建 worktree。

## 觀察重點

- **unknown legacy behavior 轉成正式 intake**：段 3 的 `isVip * 0.93` 先被記為 unknown；Daniel 於本段確認它是 dead code，因此進 implementation cleanup task 與 `tech-debt.md` resolved note，不升格成 BR。
- **第二個 feature 的 BC 邊界討論**：VIP status 與合約日期是 Customer 概念，但折扣計算與 stack order 屬 Order BC；本段用 Customer reference data 模式，避免為一條折扣規則正式建立 Customer BC。
- **擴張既有 `DiscountPolicy`，不是重寫**：BR-001~004 已 ship，新的 VIP path 必須以新增 method / internal branch 擴張，並以 regression tests 保護既有滿額與 Senior 規則。
- **VIP 與 Senior 的 stack 決策**：Bob 與 Dflow 討論 mutex vs stack，最後依 Daniel 的 business policy 寫成 BR-008：VIP eligibility 與 Senior customer-tier 可同時存在並允許 stack。
- **新 SPEC 與 phase 1 已 ship 規則的互動**：BR-005~008 連續接在 Order BC 的 BR-001~004 後面；`SPEC-20260430-001` 不回改，歷史 feature 保持穩定，新需求由 `SPEC-20260505-002` 承接。

## 下一個劇情段

→ [`05-bug-fix.md`](05-bug-fix.md)：brownfield bug-fix 場景，示範已建立 Order BC 後，如何用 `/dflow:bug-fix` 處理 production bug 或獨立修正段 3 發現的 rounding inconsistency。
