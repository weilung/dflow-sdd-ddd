<!-- dflow-shape: brownfield/context-map.md 3 — keep this line: dflow doctor reads it -->
<!-- This template is part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. Documents written from it are yours: do not copy this line into them. -->
<!-- Seeded by Dflow. -->
<!-- Formatting convention: keep table cells concise. When one cell holds multiple short items (invariants, rules, steps), separate them with <br> so each renders on its own line - never chain them into one line with ；/; separators. Long narrative detail does not belong in a table cell: keep the cell to a concise summary and put extended detail in an existing section of this document when one fits, or give each item its own row. -->

# Context Map

> Optional bounded context relationship map for Brownfield discovery.

## Context List

| Bounded Context | Responsibility | Subdomain Type | Owner / Team | Primary Code Area | Notes |
|---|---|---|---|---|---|
| {Context name} | {業務責任} | core / supporting / generic | {owner} | `{project/path/or/namespace}` | {optional notes} |

> **Subdomain Type** — 判別問句:「這塊功能換成現成 SaaS / 套件,系統的差異化會消失嗎?」
> (差異化不限商業競爭優勢;內部系統指獨特的營運優勢 / 任務成果。)會 → `core`;
> 不會、但需要為自家流程客製 → `supporting`(必要、常需客製、非差異化);
> 不會、且現成方案存在 → `generic`。多數 BC 是 supporting,`core` 通常只有 1–2 個;
> 全標 core = 沒分類。分類是可修訂的初判,改判時更新本欄並在 Notes 留一行理由。
> 它影響漸進抽離的取捨(`generic` 傾向整塊替換而非逐條抽離,見 modify-existing-flow
> Step 4),但**不**降低 BR 紀錄、Tier ceremony、或安全 / 測試 / 可靠性要求。

## Relationships

| Source Context | Target Context | Relationship Type | Integration Mechanism | Notes |
|---|---|---|---|---|
| {Source} | {Target} | {Customer/Supplier, Conformist, ACL, Shared Kernel, Separate Ways, Big Ball of Mud (BBoM), OHS, etc.} | {DB table, service call, file, manual process} | {optional notes} |

## External Systems

| External System | Data Exchanged | Direction | Mechanism | Timing | Used By | Notes |
|---|---|---|---|---|---|---|
| {system name} | {what passes between the two systems} | in / out / both | {API call, file transfer, shared database, message queue, manual process; which side starts it} | {on each request, nightly, yearly, on demand} | {each context that uses this exchange, and how: ACL, Conformist, ...} | {owner or contact; where the integration code lives; any value no other cell holds} |

> **External System** — a system this project does not build or deploy (another team's service, a vendor or government API, a database or file another system owns) that one of this system's bounded contexts exchanges data with. Write one row per exchange: a different direction, mechanism or timing is another row, while one exchange takes one row however many contexts use it — list every one of them in Used By. Every row names at least one context in Used By, so a change to a row is a change to those contexts; an integration no context uses (logging, monitoring, deployment tooling) is not recorded here. Direction is the way the business data moves, seen from this system; which side starts the exchange goes in Mechanism. Keep external systems out of the tables above: they name only this system's bounded contexts.

## Undecided Neighbors

| Neighbor | Exchanges | Code Area | Notes |
|---|---|---|---|
| {暫定名稱：照它在本系統裡做的事取名} | {context}：{交換什麼、往哪個方向、怎麼交換；有先後就照先後寫} | {被盤的程式呼叫或讀取它的地方：服務、資料表、頁面或排程；看不出來就寫 not located} | {還不知道的事；問它的那一題} |

> **Undecided Neighbor** — a part of this system (a page, a module, a batch job, a service this project builds) that one of this system's bounded contexts exchanges data with, and that nobody has yet decided which bounded context it belongs to — usually because no capture has read its code, though a part read in passing whose boundary is still open counts too. A part already recorded as, or decided to belong to, a bounded context is not a neighbor, even when this capture did not read its code again; nor is an external system, or a region someone decided not to model (`references/ddd-modeling-guide.md`, Big Ball of Mud). Keep neighbors out of the tables above. Give each neighbor one row and a working name taken from what it does, and use that name, unchanged, wherever a document names it — a transition's Trigger in `analysis.md`, a question; what is uncertain about it goes in Notes, never into its name. Record what passes between a neighbor and a context here, not as a step of a Cross-Context Flows table in `analysis.md`: write Exchanges one line per exchange — the context, a colon, what passes, which way and how, in order when the order matters. Every row names at least one bounded context in Exchanges, so a change to a row is a change to those contexts.
>
> A neighbor leaves this table when a change that writes this file records what it is — a bounded context of its own (a Context List row whose Notes say what is not captured yet), part of a bounded context above, or an external system. A baseline capture does it when it records it; a feature that carries phase-specs does it at `/dflow:finish-feature`, with its other relationships. That change carries every value of the row to where the neighbor now belongs — what passes between it and another context into Relationships or External Systems, and, when it is part of the very context it exchanges with, into a line of Integration Notes that names that context — removes the row, and uses the new name in the documents it writes; before it removes or rewrites anything, it shows the developer the new records and where each value went, and until they answer it changes nothing. Every other document keeps the working name, so the row or line that now holds the neighbor says "also called {working name}" in its Notes; a completed feature's record is frozen and keeps the working name too.

## Integration Notes

- {沒有先後順序也成立的跨 context 資料交換、權責邊界或 legacy coupling；有先後順序的跨 context 交手流程記在 analysis.md}

## Open Questions

- {尚未釐清的 context 邊界或整合責任}
