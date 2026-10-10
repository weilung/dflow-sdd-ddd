<!-- dflow-shape: greenfield/analysis.md 2 — keep this line: dflow doctor reads it -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->
<!-- Placement: this template fills two paths. Cross-Context Flows and Function / Role Index are always written in the domain-root copy, `dflow/specs/domain/analysis.md`, whoever owns what they describe, and left as they are in a per-context copy - including in a project that has only one context. A hotspot row goes in the copy that holds the knowledge it is stuck on, and a question row in the copy that will hold its answer, as Open Questions and Hotspots says. For every other entry, ask who owns what the entry describes. A status field is owned by the context whose domain model holds it - an attribute of an entity that context's models.md defines, or will define. The database table the value is stored in does not decide it. A derived figure is owned by the context that computes it, not the ones it reads from. A mechanism is owned by the context whose behavior it explains. One context owns it: the entry goes in that context's `dflow/specs/domain/{context}/analysis.md`, and it stays there even when another context reads the field, triggers a transition or supplies data it reads. No one context owns it - two contexts own it equally, or a mechanism explains behavior in several contexts equally: it goes in the domain-root copy. -->
<!-- Entry ids: every entry carries one. The prefix is the section's - `FL` flows, `LC` lifecycles, `RM` read models, `MX` mechanisms, `FN` function rows, `HS` hotspot rows - and the number is sequential within this copy and never reused; an entry keeps its id for as long as it stays in this copy. A subsection carries its id in its heading (`### LC-01: {name}`); in the two tables that have an ID column, each row carries it there. Cite an entry in this file by its id alone. Cite one in the other copy, or from any other document, as path then id: `domain/{context}/analysis.md LC-01`. Until what a citation points at has an entry of its own, write its name instead of an id; whenever you update this file, replace any such name whose entry now exists. A Handed over cell is not a citation: it names what passes between the contexts and keeps that name; to point a reader at the entry that describes it, cite that entry below the table. An entry that moves to the other copy takes a new id there: update whatever cited the old one - search for its path and id together, and for the bare id in the file it left. -->
<!-- Referring to a rule: a cell that names what a business rule decides refers to that rule and holds nothing else; a cell decided by no rule holds the value itself. In a cell written one line per role - the role, a colon, then text - everything this convention says about a cell applies to each line's text instead. Refer to a rule by its BR-ID alone only from the copy of the context whose rules.md holds it; anywhere else - always in the domain-root copy - write its path then its id: `domain/{context}/rules.md BR-001`. A cell holding a BR-ID, alone or after its path, is a reference; anything else is a recorded value. Until a rule has a BR-ID, write the rule's name; whenever you update this file, replace any rule name whose BR-ID now exists. -->
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

<!-- One subsection per status field: name the field and where it is stored, list every value it can hold, then one row per transition. List the values even when the code admits more than the workflow uses: a value seen only in stored data is still a state. A value that cannot be written as itself - an empty string, spaces only, no value at all, or the stored text `[*]` - gets a short name in State, and the `Evidence: ` line after the tables says what each such name stands for. Before the entity that holds the field exists, and after it is removed for good, there is no value to list: a transition that creates the entity has `[*]` in From, and one that removes it for good has `[*]` in To, in backticks like the values. A value the entity stays in for good, or a soft delete that keeps the entity, is a state like any other. A transition triggered from another context stays here - name that flow in Cross-Context Flows and cite it rather than restating the handover (from a per-context copy: `domain/analysis.md FL-01`). Whether a single transition is allowed to happen is a business rule: it belongs in rules.md and the Guard cell carries its BR-ID. One scenario played out end to end belongs in behavior.md. The entity that holds the field is defined in models.md. The Means cell says what the state allows or blocks next; when the value's name is also a term the business uses elsewhere, its definition belongs in glossary.md and this cell stays short. Evidence sits on the transitions. Where the list of values was taken from - and why any value in it has no transition, such as being seen only in stored data - goes in one line after the tables that reads `Evidence: ` followed by it. A value whose transitions nobody has looked for yet is a question: record it where Open Questions and Hotspots says. -->

### LC-01: ExpenseReport.Status（`ExpenseReports.Status`）

| State | Means |
|---|---|
| `Draft` | 員工還在填、還沒送出 |
| `Submitted` | 已送出、等主管審核 |
| `Approved` | 主管已核准，是財務可處理的正式單據；之後的財務處理尚未建模 |
| `Rejected` | 主管已退回，等員工照原因重編 |

| From | Trigger | To | Guard | Evidence |
|---|---|---|---|---|
| `[*]` | 員工建立費用單（`ExpenseReport.Create()`） | `Draft` |  | code - ExpenseReport.Create() (2026-05-07) |
| `Draft` | 員工送出（`ExpenseReport.Submit()`） | `Submitted` | BR-001 | code - ExpenseReport.Submit() (2026-05-07) |
| `Submitted` | 主管核准（`ExpenseReport.Approve()`） | `Approved` | BR-005<br>BR-006 | code - ExpenseReport.Approve() (2026-04-29) |
| `Submitted` | 主管退回（`ExpenseReport.Reject()`） | `Rejected` | BR-005<br>BR-006<br>BR-007 | code - ExpenseReport.Reject() (2026-04-29) |
| `Rejected` | 員工第一次重編（`AddItem()`／`RemoveItem()`／`ModifyItem()`） | `Draft` | BR-002 | code - ExpenseReport.AddItem()／RemoveItem()／ModifyItem() (2026-04-29) |

Evidence: code - ExpenseReportStatus enum (2026-05-07)

## Read Models and Derived Figures

<!-- One subsection per figure or read model: its definition, which records or states it counts, and the point at which an amount moves from one figure to another. A stored entity or value object is defined in models.md; this section holds what is computed from them. Say what a missing, duplicated or stale record does to the figure. -->

### RM-01: 送出總額（ExpenseReportSubmitted 的 TotalAmount）

送出那一刻，這份單所有 ExpenseItem 的 Money.Amount 加總。不存成欄位，只隨 ExpenseReportSubmitted 帶出去（payload 見 `events.md`）。MVP 幣別固定 TWD（見 `models.md` 的 Money）。重複的收據擋在 BR-004，不會被算兩次。

Evidence: code - ExpenseReport.Submit() (2026-05-07)

## Mechanisms

<!-- One subsection per mechanism: how the system produces a behavior that no single rule explains - versioned records, deferred updates, recalculation on read. A behavior that one rule or one Given/When/Then scenario can state belongs in rules.md / behavior.md instead. The Affects line lists what this mechanism changes the meaning of - BR-IDs and entry ids, each cited as Entry ids and Referring to a rule say. -->

### MX-01: 每次送出一筆審核決定（SubmitAttemptNo）

每次 `Submit()` 成功，SubmitAttemptNo 加 1。ApprovalDecision 用 (ExpenseReportId, SubmitAttemptNo) 對上那一次送出，一次送出最多一筆 decision（見 `models.md` 的 ApprovalDecision；資料庫另有 unique index 補強）。退回的單重編後再送出，就是新的一次送出、新的一筆 decision；前一筆原樣保留，審核軌跡不會被覆寫。事件那一側見 `events.md` 的 Event Flow Notes。

Affects: BR-002, LC-01
Evidence: code - ExpenseReport.Submit()、ApprovalDecision.CreateApproved()／CreateRejected() (2026-04-29)

## Function / Role Index

<!-- Global file only. One row per function: which roles reach it, the data scope each one sees, and what some of them can do there that not every listed role can. When the listed roles see different data, write Data scope one line per role: the role, a colon, what that role sees. Write Role-specific actions one line per role and action: the role, a colon, then one action not every listed role can do there - read-only for one role and editable for another counts - or a reference to the business rule that decides it, which may cover several actions. A role can have several lines, and an action two roles share gets a line for each. Where more than one role reaches the function, write `—` once you have checked and every listed role can do the same there; an empty cell means nobody has checked. A function one role reaches leaves it empty. When a business rule decides who may use the function, what a role sees or what a role may do, that rule is the source of truth: refer to it as Referring to a rule says instead of restating it. Write roles, a data scope or actions directly only where no rule decides them - a menu entry every role sees, a report anyone can run. When no bounded context recorded so far fits the function, write `—` in Bounded Context and record the question of which context it belongs to where Open Questions and Hotspots sends a question about a context boundary, naming the function's ID; do not leave the cell empty. -->

| Function | ID | Entry point | Bounded Context | Roles | Data scope | Role-specific actions | Evidence |
|---|---|---|---|---|---|---|---|
| {功能名稱} | FN-01 | `{route / page / job}` | {Context name；沒有合適的 context 就寫 —} | {角色，或決定它的 BR-ID（帶路徑）} | {看得到的資料範圍，或決定它的 BR-ID（帶路徑）；各角色不同時一行一個角色：`{角色}：{範圍}`} | {一行一個角色與動作：`{角色}：{不是每個角色都能做的一個動作，或決定它的 BR-ID（帶路徑）}`；多個角色進得去、查過都一樣就寫 —，還沒查就留空；只有一個角色進得去就留空} | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |

## Open Questions and Hotspots

<!-- One row per hotspot: a spot in the knowledge above this project keeps working around until a domain decision settles it. It goes in whichever copy of this file holds the knowledge it is stuck on - or, when that is a business rule or knowledge not recorded yet, the copy the Placement question gives it - and the Affects column names that knowledge by id, cited as Entry ids and Referring to a rule say. Also one row per question that comes up while writing an entry here and whose own answer will be a cross-context flow, a lifecycle, a derived figure, a mechanism or role reach. A question the current feature must answer before it can finish stays in that feature's spec, and a question whose answer belongs to another document's subject stays in that document's own Open Questions section - a term in glossary.md, a business rule in the owning context's rules.md, and a context boundary, an integration responsibility or the question of which context owns a rule in context-map.md. A question that stays in this file goes in the copy that will hold its answer - the copy Placement gives that answer - whichever copy the entry that raised it is in. When a code change would settle an item - a missing check, a known shortcut - it is tech debt: record it in tech-debt.md instead. A hotspot whose pending decision is recorded elsewhere links to it. A settled item stays as a resolved row that says what settled it, with the settling decision in its Evidence cell. -->

| Item | ID | Affects | Why it matters | Status | Evidence |
|---|---|---|---|---|---|
| {待確認事項或熱點} | HS-01 | {FL-／LC-／RM-／MX-／FN- 編號或 BR-ID（照檔頭的引用規則帶路徑；還沒有編號的寫名稱）} | {影響} | open / resolved | {code｜data｜confirmed by {role}｜document｜inferred｜assumed} - {複查入口} ({date}) |
