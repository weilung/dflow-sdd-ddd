<!-- dflow-shape: brownfield/analysis.md 1 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->
<!-- Placement: this template fills two paths. Cross-Context Flows and Function / Role Index are always written in the domain-root copy, `dflow/specs/domain/analysis.md`, whoever owns what they describe, and left as they are in a per-context copy - including in a project that has only one context. A hotspot row goes in the copy that holds the knowledge it is stuck on, and a question row in the copy that will hold its answer, as Open Questions and Hotspots says. For every other entry, ask who owns what the entry describes. A status field is owned by the context whose entity stores it - the entity that context's models.md defines, or will define. A derived figure is owned by the context that computes it, not the ones it reads from. A mechanism is owned by the context whose behavior it explains. One context owns it: the entry goes in that context's `dflow/specs/domain/{context}/analysis.md`, and it stays there even when another context reads the field, triggers a transition or supplies data it reads. No one context owns it - two contexts own it equally, or a mechanism explains behavior in several contexts equally: it goes in the domain-root copy. -->
<!-- Entry ids: every entry carries one. The prefix is the section's - `FL` flows, `LC` lifecycles, `RM` read models, `MX` mechanisms, `FN` function rows, `HS` hotspot rows - and the number is sequential within this copy and never reused; an entry keeps its id for as long as it stays in this copy. A subsection carries its id in its heading (`### LC-01: {name}`); in the two tables that have an ID column, each row carries it there. Cite an entry in this file by its id alone. Cite one in the other copy, or from any other document, as path then id: `domain/{context}/analysis.md LC-01`. Until what a citation points at has an entry of its own, write its name instead of an id; whenever you update this file, replace any such name whose entry now exists. An entry that moves to the other copy takes a new id there: update whatever cited the old one - search for its path and id together, and for the bare id in the file it left. -->
<!-- Referring to a rule: a cell that names what a business rule decides refers to that rule and holds nothing else; a cell decided by no rule holds the value itself. Refer to a rule by its BR-ID alone only from the copy of the context whose rules.md holds it; anywhere else - always in the domain-root copy - write its path then its id: `domain/{context}/rules.md BR-001`. A cell holding a BR-ID, alone or after its path, is a reference; anything else is a recorded value. Until a rule has a BR-ID, write the rule's name; whenever you update this file, replace any rule name whose BR-ID now exists. -->
<!-- Evidence convention: every entry carries its evidence in the form `{code | data | confirmed by {role} | document | inferred | assumed} - {what to open to re-check} ({date})`. A subsection ends with one line that reads `Evidence: ` followed by it; a table row puts it in its Evidence column. For `data`, the middle slot also carries the counting rule the number used. `document` is a written source outside the code - a regulation, an internal policy, a ticket, an existing spec. When you take a claim from one of these rather than re-checking it yourself, the date is the one that source gives, not the day you copied it. `inferred` is a conclusion drawn from code or data rather than read off either one: name what it was drawn from. A question nobody has answered yet is not an entry: record it where the Open Questions and Hotspots section says. A value that rests on nothing a reader can open is `assumed`: a guess, or a fact whose only home is a private note, a chat log, or one person's AI memory. Say what it rests on, and record the question of confirming it where the Open Questions and Hotspots section says. -->

# Domain Analysis

> System-level knowledge that no single bounded-context document holds: flows
> that cross contexts, the lifecycle a status field moves through, how derived
> figures are computed, the mechanisms behind observed behavior, who reaches
> which function, and the spots in them this project keeps working around.
> Where an entry relies on a rule, a model, or a context relationship, link it
> by BR-ID, model name, or section instead of restating it. Where this project
> has already written one of these somewhere else, leave that text where it is
> and give it a row or a subsection here that says where to read it.

## Cross-Context Flows

<!-- Global file only. One subsection per ordered flow whose steps are owned by more than one context; the table is the record, one row per step in order. A flow that stays inside one context is not recorded here: its scenarios belong in behavior.md. A statement about two contexts that holds without an order - which one is upstream, how they integrate, what data passes between them - belongs in context-map.md: link it instead of repeating it. A derived figure is not a flow, however many contexts it reads from - it goes in Read Models and Derived Figures. Keep one row per step and no branches: where the flow genuinely forks, either write the fork as its own flow or record the condition as a rule in rules.md and link it. -->

### FL-01: {流程名稱}

| # | From | To | Handed over | State change | Evidence |
|---|---|---|---|---|---|
| 1 | {Context A} | {Context B} | {交出去的是什麼：欄位、識別鍵或事件} | {造成什麼狀態變化} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |

## Lifecycles

<!-- One subsection per status field: name the field and where it is stored, list every value it can hold, then one row per transition. List the values even when the code admits more than the workflow uses: a value seen only in stored data is still a state. A transition triggered from another context stays here - name that flow in Cross-Context Flows and cite it rather than restating the handover (from a per-context copy: `domain/analysis.md FL-01`). Whether a single transition is allowed to happen is a business rule: it belongs in rules.md and the Guard cell carries its BR-ID. One scenario played out end to end belongs in behavior.md. The entity that stores the field is defined in models.md. The Means cell says what the state allows or blocks next; when the value's name is also a term the business uses elsewhere, its definition belongs in glossary.md and this cell stays short. Evidence sits on the transitions, not on the state list. -->

### LC-01: {狀態欄位名稱}（`{存放位置：資料表.欄位，或 Aggregate 屬性}`）

| State | Means |
|---|---|
| `{狀態值}` | {這個狀態允許或擋住接下來的什麼} |

| From | Trigger | To | Guard | Evidence |
|---|---|---|---|---|
| `{原狀態}` | {誰做了什麼} | `{新狀態}` | {決定它的 BR-ID；沒有規則決定就寫必須成立的條件，都沒有就留空} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |

## Read Models and Derived Figures

<!-- One subsection per figure or read model: its definition, which records or states it counts, and the point at which an amount moves from one figure to another. A stored entity or value object is defined in models.md; this section holds what is computed from them. Say what a missing, duplicated or stale record does to the figure. -->

### RM-01: 訂單折扣後金額（`OrderEntry` 提交時由 `DiscountPolicy` 算出）

`OrderEntry.aspx.cs` 的 `btnSubmit_Click` 在提交時呼叫 `DiscountPolicy` 算出：折扣後金額 = 折扣前總額 ×（1 − 總折扣率）。折扣前總額照 BR-001；總折扣率計入滿額折扣（BR-002）與 Senior 客戶折扣（BR-003），多個折扣怎麼累積照 BR-004。

VIP 合約折扣由進行中的 `SPEC-20260505-002` 加入：總折扣率多計入 VIP 合約折扣，什麼時候計入照 BR-005、BR-006，與其他折扣怎麼累積照 BR-007、BR-008。這一段另外讀 Customer reference data 的 VIP eligibility 與 `ContractValidUntil`（經 `CustomerReferenceRepository`）。

總折扣率本身不存：提交時寫進 `OrderEntity` 的是 `GrossAmount`（折扣前總額）與 `NetAmount`（折扣後金額）。同一個數字在明細頁與列表頁另有產出點，見 RM-02。

Evidence: document - `SPEC-20260430-001` 的 `phase-spec-2026-04-30-baseline-and-fix.md`、`SPEC-20260505-002` 的 `phase-spec-2026-05-05-vip-rate-and-contract.md`（VIP 那一段） (2026-05-05)

### RM-02: `OrderDiscountSummary`（`usp_GetOrderDiscountSummary`）與 `OrderList` 的 Discounted Total 欄

RM-01 那個折扣後金額，在明細頁與列表頁另有兩個產出點：`OrderDetail.LoadDiscountSummary()` 執行 stored procedure `usp_GetOrderDiscountSummary`，顯示它回傳的 `DiscountedTotal`；`OrderList` 的 data source 也帶著同一份 summary，但 `OrderList.BindGrid()` 的 Discounted Total 欄是以列上的 `GrossAmount` 與 `CustomerTier` 依 BR-004 的公式重算的。

兩頁的情境見 [`behavior.md`](./behavior.md#confirmed-across-pages-baseline-capture-2026-05-04)。`BindGrid()` 另對 IsVip 客戶多乘 0.93，見 HS-01。

Evidence: code - `OrderManager.Web/Pages/Order/OrderList.aspx.cs` `BindGrid()`（約 lines 48-97）、`OrderManager.Web/Pages/Order/OrderDetail.aspx.cs` `LoadDiscountSummary()`（約 lines 72-104） (2026-05-04)

## Mechanisms

<!-- One subsection per mechanism: how the system produces a behavior that no single rule explains - versioned records, deferred updates, recalculation on read. A behavior that one rule or one Given/When/Then scenario can state belongs in rules.md / behavior.md instead. The Affects line lists what this mechanism changes the meaning of - BR-IDs and entry ids, each cited as Entry ids and Referring to a rule say. -->

### MX-01: {機制名稱}

{運作方式與影響}

Affects: {BR-ID 與 FL-／LC-／RM- 編號（照檔頭的引用規則帶路徑；還沒有編號的寫名稱），逗號分隔；沒有就寫 none}
Evidence: {code | data | confirmed by {role} | document | inferred | assumed} - {要開哪一支才能複查} ({date})

## Function / Role Index

<!-- Global file only. One row per function: which roles reach it and the data scope each one sees. When a business rule decides who may use the function or what a role sees, that rule is the source of truth: write its BR-ID in that cell instead of restating the rule. Write roles or a data scope directly only where no rule decides them - a menu entry every role sees, a report anyone can run. -->

| Function | ID | Entry point | Bounded Context | Roles | Data scope | Evidence |
|---|---|---|---|---|---|---|
| {功能名稱} | FN-01 | `{route / page / job}` | {Context name} | {角色，或決定它的 BR-ID（帶路徑）} | {看得到的資料範圍，或決定它的 BR-ID（帶路徑）} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |

## Open Questions and Hotspots

<!-- One row per hotspot: a spot in the knowledge above this project keeps working around until a domain decision settles it. It goes in whichever copy of this file holds the knowledge it is stuck on - or, when that is a business rule or knowledge not recorded yet, the copy the Placement question gives it - and the Affects column names that knowledge by id, cited as Entry ids and Referring to a rule say. Also one row per question that comes up while writing an entry here and whose own answer will be a cross-context flow, a lifecycle, a derived figure, a mechanism or role reach. A question the current feature must answer before it can finish stays in that feature's spec, and a question whose answer belongs to another document's subject stays in that document's own Open Questions section - a term in glossary.md, a business rule in the owning context's rules.md, and a context boundary, an integration responsibility or the question of which context owns a rule in context-map.md. A question that stays in this file goes in the copy that will hold its answer - the copy Placement gives that answer - whichever copy the entry that raised it is in. When a code change would settle an item - a missing check, a known shortcut - it is tech debt: record it in tech-debt.md instead. A hotspot whose pending decision is recorded elsewhere links to it. A settled item stays as a resolved row that says what settled it, with the settling decision in its Evidence cell. -->

| Item | ID | Affects | Why it matters | Status | Evidence |
|---|---|---|---|---|---|
| `OrderList.BindGrid()` 對 IsVip 客戶多乘 0.93、來源不明 | HS-01 | RM-02 | 沒有註解、ticket 或對應的 BR，可能與 BR-003 互斥：業務確認前既不能寫成 BR，也不能直接刪<br>已解：業務確認是五年前促銷殘留的 dead code、不是規則，移除列為 `SPEC-20260505-002` phase 1 的 cleanup task | resolved | confirmed by 業務經理 Daniel - [`tech-debt.md`](../../migration/tech-debt.md)「OrderList isVip multiplier 0.93 規則來源不明」那一列的 resolved note (2026-05-05) |
