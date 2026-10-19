# Brownfield baseline capture: answering 6.2's questions later

> [繁體中文](baseline-deferred-confirmation.md) | **English**

> This page follows the source's `main` branch and may describe behavior the changelog still lists under `## Unreleased`. If `dflow render --help` has no `Confirmation records:` paragraph, the CLI you installed does not read these records yet. `@latest` installs the latest **published** CLI and does not promise that what this page describes has been published — what a published version contains is in its changelog.

A brownfield baseline capture (recording what an existing system does now, without changing code) asks the developer at Step 6.2 to confirm each item: is this the rule, is this observation right, should this term be settled. When the developer is away, or there are enough questions that they want one list to review at once, they can **explicitly authorize** answering named questions later.

Deferring is not confirming. The AI records each unconfirmed question in the document its answer will change, until the developer answers it. Once an answer is given and applied, the whole question record goes, and the documents end **word for word** as they would have if the developer had confirmed on the spot. How the answer was reached, and who gave it on which day, is in the message of the commit that applies it, not in the documents.

The detailed rules are in the workflow bundle's `references/modify-existing-baseline.md` (§ Deferring 6.2 questions, § Draft basis and current observations, § Preserve pending confirmations, § Deferred confirmation records), which the AI reads when it runs; this page explains how to use it, what you will see, and what it cannot do.

## When questions can be deferred

- **Only a baseline capture's 6.2 questions.** Every other Step Gate, the branch gate, the commit policy, merge and push permission, and the capture's two checkpoints still need a person. Running the whole workflow with nobody present is outside this page.
- **The developer must authorize it explicitly**, naming the questions or the whole capture. No answer, a developer who is away, a general "continue", or the AI's own confidence is not an authorization, and none of them is a confirmation.
- The deferred scope, who authorized it, the date and who is to answer are written only in each question's `Deferred confirmation` line. The host's Goals & Scope records only **confirmations actually given** — no deferral and no list of pending questions.
- Once authorized, the AI first assembles the complete list within that scope for one review, grouped: items resting on inference (`inferred`) or assumption (`assumed`), items whose sources conflict, and the rest, each with its question id. A batch answer confirms only the items the developer could see with their ids and explicitly named as accepted; closing the capture, approving a format or approving a commit confirms nothing.

## What the documents gain

### A BR not yet confirmed: `Draft basis`

When a BR the capture wrote is still `draft` at the end of 6.2, `behavior.md` gains one `Draft basis` line directly under that BR's heading, before anything else in its section (its first Given/When/Then included), saying where the candidate rule came from:

```text
> Draft basis: code - ReceiptsController.Create and Edit, invoice-number checks (2026-10-16) — confirmation: [SPEC-20261016-001/Q01](./rules.md#open-questions) — observation: same-scenario
```

- There are five kinds — `code`, `data`, `document`, `inferred`, `assumed` — with the meanings of `analysis.md`'s Evidence convention. `code` means only that the named entry points apply that check directly: not that every entry point of the system does, and never that the developer confirmed the business rule.
- A `Draft basis` takes no `confirmed by`: it records where a candidate that is **not yet confirmed** came from.
- An `inferred` BR also has a passage on what the system does now: no BR-ID, a heading of its own, outside that BR's section, linked from `observation`. When the page shows Submit only for drafts but the server does not check the status, "only a draft can be submitted" is an inference; what the system does is two observations, of the page and of the server, and until the rule is confirmed the difference between them is not a deviation (`Known deviation`).

### Pending questions: four records

A question goes in the document its answer will change, routed as `analysis.md` § Open Questions and Hotspots already routes questions:

| The question is about | It goes in |
|---|---|
| A business rule | That context's `rules.md` § Open Questions |
| A term | `glossary.md` § Open Questions |
| A context boundary, an integration responsibility | `context-map.md` § Open Questions |
| A flow, a lifecycle, a derived figure, a mechanism, role reach | The right copy of `analysis.md` § Open Questions and Hotspots (after its HS table) |
| A model | `models.md`, after the table that holds that model (or after the Context or Code Mapping Notes passage) |
| A debt item itself | `tech-debt.md` § Follow-up Notes |

Each record is its own paragraph with a blank line before and after it. The `Question` is a list item; the other three are block quotes that follow it directly, in this order, each only when it applies:

```text
- Question: SPEC-20261016-001/Q02 — target: domain/billing/rules.md BR-004 — asks: May only a draft be submitted for review?

> Deferred confirmation: SPEC-20261016-001/Q02 — state: pending — scope: Business rules — assigned to: Finance lead — authorized by: Dev lead (2026-10-16)

> Provisional: SPEC-20261016-001/Q02 — answer: Yes, only drafts — basis: inferred - Review.cshtml shows Submit only for draft (2026-10-16)

> Decision: SPEC-20261016-001/Q02 — outcome: unresolved — answer: cannot confirm yet; the auditor decides — confirmed by: Finance lead (2026-10-17) — applied to: not-applied with reason: ask the auditor, then apply
```

- `Provisional` is the AI's provisional answer and **not a confirmation**; with no provisional answer there is no such line.
- A `Decision` exists only while an answer cannot be applied yet, and there is only one: `unresolved` when it still cannot be confirmed, `not-applied` when the ordinary spec flow has to apply it, `conflicting` when answers conflict. Its `confirmed by` says only that this role gave this answer — not that the rule or the code is confirmed, and not that the answer was applied.
- A question id is the capturing host's SPEC-ID, `/Q` and a number of at least two digits. Within one SPEC-ID a number is **never reused**, even after its record is removed: a new question is numbered above the highest number already used for that SPEC-ID — in version history, commit messages included, and in the change not yet committed — not above the numbers still visible in the documents.

## Answering later

| When | How |
|---|---|
| Before the capture's checkpoint 1 | Apply the answer; checkpoint 1 commits the final form, and the confirmation is recorded in this capture's Goals & Scope as usual |
| After checkpoint 1, before closeout | Follow that host's checkpoint contract; a change to the capture's documents never rides the closeout commit |
| After the capture closed | Open an ordinary baseline capture (`/dflow:modify-existing`) to answer them; the confirmations are recorded in **that** host, under its SPEC-ID. Answering some questions of a larger capture does not make the new capture a follow-up of it |

A route that answers an existing list without opening a host is not available yet; today, once the capture has closed, an ordinary capture answers its questions.

## Once an answer is applied

When an answer can be applied, one change applies it, removes that question's whole record, removes the candidate's `Draft basis` and handles the passage on what the system does now. It writes no "done" and keeps no history of the decision. The commit that carries such a change names in its message each question id whose records it removes or replaces — a question opened and removed before that commit included — with who gave the answer on which date and what it changed. How the answer was reached (the deferral, a provisional answer) is kept there, not in the documents; it is also how a later question finds every number already used.

| The developer's answer | The documents become |
|---|---|
| Accepts the candidate rule | `draft` becomes `active`; the `Draft basis` and the question record go; when the code follows the rule, what the observation passage says for this question goes |
| Confirms the rule, the code differs, and explicitly defers the fix | The deviation records and debt item of [When a confirmed rule and the code disagree](confirmed-rule-vs-code.en.md) are written, and the observation passage becomes those records |
| Says there is no such rule | The `draft` row, that BR's scenario section, its `Draft basis` and the question record go; what the code does stays as an ordinary passage without a BR-ID, and no link to the rejected BR-ID is left |
| Still cannot confirm | One `unresolved` `Decision` is added; the rule stays `draft` |
| Would change the rule a running feature's Current BR Snapshot carries | The question stays, with a `not-applied` `Decision`, for the ordinary spec flow; its records go only once that spec has applied it |
| Answers on the same day conflict, or their order cannot be told | One `conflicting` `Decision` records each answer; the question stays pending until the developer settles it, and no answer is picked by line order |

When an observation passage is still used by another question or candidate, only what belongs to this question goes; the rest stays, or moves to a new passage with its links updated, and no pending question is left pointing at a removed passage.

## How five places read

- **A `rules.md` row**: `draft` means not yet confirmed, with or without a `Draft basis`. The basis is found by following the Behavior anchor into `behavior.md`; the question is in Open Questions. No column is added for it, on purpose.
- **Goals & Scope**: only confirmations actually given, and where they landed. A closed capture (`completed`) means only that the capture ended, not that every question was answered.
- **Current BR Snapshot**: empty on a baseline capture's host. A follow-up host inherits only `active` rules from `rules.md`; a `draft` rule and its questions stay in their documents. A `Draft basis` and question records never go into rule text or the Snapshot.
- **`dflow render`**: see the next section.
- **The next session**: before depending on a `draft` rule, or rewriting a scenario that has a `Draft basis`, it reads the questions still pending and the answers not yet applied; an applied answer is already in the documents. An old `draft` with no mark is not `active` either.

## What `dflow render` shows

- A record written exactly to the format gets a badge at the start of its line: "待確認題目" (pending question) for a `Question`, "待確認" (pending) for a `Deferred confirmation`, "AI 暫定・不是確認" (AI provisional, not a confirmation) for a `Provisional`, "答覆已記錄・尚未套用" (answer recorded, not yet applied) with its outcome for a `Decision`, and "draft 依據・未確認" (draft basis, unconfirmed) for a `Draft basis`. A page holding any of them opens with one summary line. (The rendered pages are in Chinese.)
- A badge says only that **the format was read**: roles, authorizations, code and rules are not checked, and no badge means "confirmed". No badge does not mean nothing is pending either: an answered question leaves no record, and a question written in free text is not read.
- A line that starts with `Question`, `Deferred confirmation`, `Provisional` or `Decision` (in `behavior.md`, also `Draft basis`) — case, colon, indentation, list or quote written differently still count — and holds a question id (`SPEC-YYYYMMDD-NNN/QNN`), but is not exactly the format, gets a notice on its page and is counted as undetermined in the summary; stdout lists each one under a `confirmation records:` line with its file, its line, what is wrong, the expected format and how to fix it. The line keeps its text and gets no badge. Rendering still completes and the exit code is unchanged.
- What is reported: a missing field or fields out of order, a separator other than " — ", a date that is not a valid `YYYY-MM-DD`, a malformed question id, a `Question` that is not an item of a top-level list or another record that is not a top-level block quote, a record without a blank line before and after it (two records on adjacent lines, say), a record in a file or section that does not take it, a `Draft basis` that is not directly under its BR's heading, a record not directly after its question's `Question`, and the same kind of record for the same question defined more than once anywhere in the specs (every copy is reported).
- Not read: a line with no question id (for example `Decision: whether invoices may be cancelled is still an open question.`), code blocks, HTML comments, and examples in inline code.
- To fix: open the line and the questions around it and compare them with the format in `references/modify-existing-baseline.md`; keep the answer and the evidence and rewrite them in the standard format; if the line is only ordinary text, remove the question id or the leading keyword. Until then, do not conclude from that line that anything is confirmed. When the project's specs have no brownfield workflow bundle, the notice points at this page instead.

## Upgrading existing documents

In this release the brownfield templates `behavior.md` move to shape 3 and `_index.md` to shape 4, and `dflow doctor` says so:

- Replace `behavior.md`'s Purpose and Maintenance notes with the new template's. Existing `draft` scenarios and observations remain valid; **do not infer their basis or confirmation from their text**. Add a `Draft basis` to a `draft` BR only when a capture next writes or substantively revises it.
- Compare `_index.md`'s Current BR Snapshot notes with the new template's, and follow the follow-up rules when inheriting rules. Do **not** rewrite existing Snapshot rows or completed records as a shape migration; resolve a conflict between a `draft` and a confirmation in the running workflow before syncing it.

`dflow configure-agents` does not change documents you wrote.

## Risks that remain

| What can go wrong | Why it is not prevented | Who carries it | When to reconsider |
|---|---|---|---|
| A `code` basis checked only some entry points and missed a bypass | Format and links cannot prove every entry point was read; no code-semantics checker is added | Whoever confirms, later developers, reviewers | Wrong implementation actually follows from a misread basis, or missed entry points keep recurring |
| The AI takes "go ahead" as accepting every rule, or a rule's confirmation as a confirmation of the code | No mechanical check can prove what a conversation meant; the AI and review tell them apart | The running AI, the developer, reviewers | A wrong `active`, or a wrong confirmation of what the code does, turns up |
| The developer never comes back and questions stay pending | No notification, deadline or escalation is added | The project's maintainers and whoever takes over | The backlog gets in the way of work |
| An AI provisional answer written in free text is not caught by `dflow render` | Only the standard format and close variants with a question id are read; free natural language is not | Document authors and readers | A common phrasing keeps being missed |
| A reader of a `rules.md` row alone cannot tell an inference from code | No column is added, on purpose; the basis is behind the Behavior anchor | Readers who check only that row | Reading only that row actually causes a misuse |
| An old `draft` has no basis and the next AI guesses one | No automatic migration; the original basis may be unrecoverable | The original author and the next developer to touch it | Misuse of old drafts becomes the main report |
| With many questions and long records, the developer approves a batch without reading a high-risk inference | Grouping and per-item ids cannot guarantee anyone read them | Whoever confirms, and later users | Confirmations given without reading keep happening |
| With incomplete version history (a shallow clone, say), a new question number repeats a removed one | Numbers come from version history; the documents keep no list of used numbers (they record the current state only) | The AI and developer opening the question | A repeated number actually misleads someone tracing it |
| Reading only the documents does not show how an answer was reached | The process lives only in version history, a deliberate documentation principle | Readers who need it: read the message and diff of the commit that applied the answer | When version history is unavailable, revisit the project's retention policy |
| With nobody present, other Step Gates still stop the workflow | Only 6.2 can be deferred; there is no general consent to move on | Adopters who want unattended runs | When general consent to advance is addressed |
| An older release already carried a `draft` into the Snapshot as `active` | The new rules do not rewrite existing hosts; they stop and ask when they meet the conflict | That project and whoever closes the feature | Reproducible misrecords turn up in numbers |

The design reasons — why a candidate and what the system does are written apart, why a record goes once its answer is applied, why a question sits with its knowledge — are in the workflow bundle's `references/flow-rationale-registry.md`; look up `R-ME-BLDEFER-`.
