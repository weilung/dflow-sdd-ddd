<!-- Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. -->
# Baseline Capture — Brownfield Progressive Extraction

Branch file of `references/modify-existing-flow.md` (brownfield only). It
**adds** the baseline-capture rules; it does not restate or override anything
in that flow.

**You are here because** that flow's pointer after Step 1 Part A sent you: Part
A routed this change as a baseline capture. Keep this file open through Step 6.
It adds to that flow's Steps 1.6 and 1.7, Steps 2 to 4 and Step 6.2, and the
places there that differ for a capture point back here.

Other brownfield flows send you to § Preserve pending confirmations when their
work depends on, rewrites or settles what a capture left unconfirmed. Then read
that section and the sections it names.

A **capture destination** is a document Part A's observation-only routing lists.

## Follow-up or standalone

This decides, for a capture with no active host, whether a completed feature
relates (Step 1.6) or none does (Step 1.7). Decide it yourself; do not ask the
developer (Step 1.5 does not run for a capture).

- **What relates.** A completed feature relates when the area this capture
  covers is exactly what that feature's Goals & Scope says it delivered or
  changed. When the area is exactly the union of what several completed
  features delivered, each of them relates. One entry that touches the area,
  the same bounded context or the same term does **not** make a feature relate.
- **Larger than all of them.** When the area also covers parts no completed
  feature delivered, the capture is standalone. Name in its Goals & Scope the
  completed features whose topics it covers, and open no reverse link to them.
- **Confirmation lines are not a topic.** A completed baseline host delivered
  the capture scope stated in the one or two sentences that open its Goals &
  Scope. The confirmation lines that follow them (§ Where confirmations are
  recorded) are never part of what a feature delivered — on a baseline host, or
  on a phase-bearing feature that hosted a capture. Neither are the questions
  a capture left pending: a capture that answers some of a larger capture's
  questions does not relate to it for that reason.
- **Every one that relates.** List every completed feature that relates in
  `follow-up-of` (a YAML array when there are several); Step 1.6 gives each its
  reverse link.
- **Say what it costs.** When you open a follow-up host, tell the developer:
  each original feature gets a reverse-link row, and closeout ends with one
  tracking commit.

## Step 2 — the capture

- **No spec.** Part A says so. The capture is the record: write it into the
  capture destinations.
- **Scope.** Capture the area the developer asked you to capture, not the
  modified feature and its immediate neighbors. Run Systematic Baseline Capture
  items 1–6 on that area; where item 1 says "the modified entrypoint", read the
  entrypoints of that area.
- **Create only what the capture writes.** Create a document from Step 2's
  create-if-missing list only when this capture writes into it, and declare it
  in the `Tier = baseline` row. On a baseline minimal host, closeout's baseline
  check (`references/finish-feature-minimal-host.md`) blocks a BC-layer
  document the row does not declare.
- **`context-map.md`** records how two contexts integrate: which one is
  upstream, and what data passes between them; its External Systems section
  records each exchange the captured area's contexts have with an external
  system. To write it, declare it in the `Tier = baseline` row. Brownfield
  `init` does not create it: create it from `templates/context-map.md` the
  first time there is something to record. The declaration admits the file,
  not particular rows: which relationships the capture changed is for its
  scope and for review to hold.
- **Another context's documents.** When the capture also writes another
  bounded context's documents — aligning a term across contexts, say — declare
  them in the `Tier = baseline` row before checkpoint 1. A capture carries no
  tier, so aligning a term raises no tier question.
- **Knowledge already written in another Dflow document** is not moved: follow
  `templates/analysis.md`, which leaves that text in place and gives it an
  entry that says where to read it. When the developer insists on moving it,
  first tell them why the template does not: readers of the original document
  would no longer find it. When they still insist:
  - the original is a capture destination → the move changes that document too:
    write both, and declare both in the `Tier = baseline` row;
  - the original is not a capture destination (`_conventions.md`, say) → leave
    its text; this capture adds only the entry, and changing the original is a
    separate commit after the capture merges, outside the workflow
    (`Git-principles-*.md` § 2);
  - the original is in a completed feature's record → never move it; add the
    entry only.
- **A deviation from a confirmed rule.** When the code does not follow a BR
  that `rules.md` holds as `active` — a deviation recorded the old way
  included — write the deviation's records now, as
  `references/confirmed-rule-vs-code.md` § Scope and recording and § Analysis
  records say. These records are a draft until 6.2's **Business rules**
  question: keep them when the developer answers "The code is wrong"; on any
  other answer, undo them and record what that answer settles.
  When the developer defers that question (§ Deferring 6.2 questions), undo
  only the deviation records this capture drafted — the `Known deviations`
  entry, the `> Known deviation:` lines and the debt row or payload it wrote —
  and write what the code does as a passage without a BR-ID with a pending
  question (§ Draft basis and current observations, § Deferred confirmation
  records). Keep every deviation record and debt row that was valid before this
  capture. When the confirmed rule, the decision to defer its fix and their
  records all exist already, keep them, and give a new observation this capture
  made a question of its own. A deferral is no reason to rewrite an `active`
  rule, withdraw a confirmation or decide that a fix is deferred, and it is
  never a `confirmed by` in an observation's evidence.

## Step 3

Step 3 applies to a capture as written.

## Step 4 — no extraction decision

A capture changes nothing, so it makes no extract-now decision.

- Record each extraction opportunity in `tech-debt.md`, as Step 4's decision
  framework says to do even when deferring.
- **Aggregate emergence check**: record the observation in `tech-debt.md`. Do
  not suggest escalating to T1, and do not mark an Aggregate Root in
  `models.md` — that is a modeling decision for a later change.
- **A context with no Subdomain Type**: N/A — the question serves only the
  extraction decision.
- **Established-model re-read**: N/A — the capture extends no model.

## Step 6.2 — the questions a capture asks

6.2's question 1 (the Delta's intent) and question 5 (collapsing the
Implementation Tasks) are N/A: a capture has no Delta and no spec. Ask the
other three and the five this file adds in this order — one by one, or, for
the questions the developer explicitly defers, as § Deferring 6.2 questions
says:

1. 6.2's question 2 — tech debt the Step 3 pass missed — as written.
2. 6.2's question 3, for the extraction opportunities Step 4 recorded.
3. **Inferred and assumed entries.** For every `analysis.md` entry this
   capture wrote or changed whose Evidence is `inferred` or `assumed`, say what
   it was inferred from or rests on, and ask the developer to confirm or
   correct it.
4. **Business rules.** For every BR this capture wrote or changed — its
   `rules.md` row and its `behavior.md` scenarios — give the BR-ID, a summary
   and the code it was read from, and let the developer judge it:
   - "This is the rule" → the `rules.md` row is `active`.
   - "The code is wrong; the rule is …" → a capture fixes no code, so the fix
     is deferred: record the rule, what the code does, the deviation and its
     debt row as `references/confirmed-rule-vs-code.md` § Scope and recording
     and § Analysis records say. Its Goals & Scope line names the BR's context
     and ID, what was confirmed and the debt Item.
   - "I cannot confirm it either" → the `rules.md` row is `draft`. Record the
     question as § Deferred confirmation records says, with an `unresolved`
     Decision, and give the BR its Draft basis (§ Draft basis and current
     observations).
5. **6.2's question 4, baseline form.** For every passage of `behavior.md`
   this capture wrote or changed, with a BR-ID or without one, ask the
   developer to confirm it is right, each for what it states: a BR-ID's
   scenarios state the rule the **Business rules** answer confirmed, a
   `Known deviation` line states what the code was observed to do and its
   evidence, and a passage without a BR-ID states the observed behavior
   itself. Do not ask every passage as "this is what the system does now".
6. **Differences that change an existing document's meaning** — a document
   that is wrong, a term used two ways. Ask, one by one, whether to change it:
   - in a capture destination → change it now, in the capture's own commit
     (`spec-baseline`); a BC-layer document is declared in the row (§ Step 2);
   - in a completed feature's record → do not correct it: a completed feature
     is frozen. Write the corrected knowledge into a capture destination, and
     note which completed record (by SPEC-ID) says otherwise. A follow-up
     capture's closeout admits an original's `_index.md` only for its
     reverse-link row;
   - in any other file of the spec tree (`_conventions.md`, say) → a separate
     commit after the capture merges, outside the workflow
     (`Git-principles-*.md` § 2).
7. **Terms.** For a term this capture used that `glossary.md` does not have
   yet, ask the developer to settle the primary term.
8. **Models and context relationships.** For every `models.md` passage and
   `context-map.md` row this capture added or changed, ask the developer to
   confirm it.

When an answer to **Business rules**, to the baseline form of question 4 or to
**Differences** concerns a BR the host's Current BR Snapshot carries, it lands
as § A BR the Current BR Snapshot carries says.

Record every answer as § Where confirmations are recorded says, and fill the
`Last updated` of each `rules.md` row this capture wrote or changed as
§ `Last updated` in `rules.md` says.

## Deferring 6.2 questions

The developer may defer all of this capture's 6.2 questions, or named ones, to
be answered later.

- Defer a question only when the developer explicitly authorizes it, naming
  the questions or the whole capture. No answer, a developer who is away, a
  general "continue" or your own confidence is not an authorization to defer,
  and it is not a confirmation.
- Go through the eight questions in order. Apply an answer you have and can
  apply, and record it as § Where confirmations are recorded says. Give each
  question you defer its pending records (§ Deferred confirmation records).
  When the developer still cannot confirm a deferred question, add an
  `unresolved` Decision to it.
- Within what the developer authorized, first assemble the complete list for
  one review, grouped: items that rest on `inferred` or `assumed`, items whose
  sources conflict, and the rest. Give every item its question id. Show the
  list to the developer in the conversation; it goes into no document — in
  the documents, each question has only its own records.
- A batch answer confirms only the items the developer could see with their
  ids and explicitly named as accepted. Completing the capture, approving a
  format or approving a commit confirms nothing.
- A deferred new rule candidate stays `draft`, with its Draft basis (§ Draft
  basis and current observations) and its question. A different view of an
  existing `active` rule is only a question: keep that rule and its status.
- Write each question's deferred scope, the role that authorized it, the date
  and the role assigned to answer it only in its Deferred confirmation record.
- An answer given before checkpoint 1 — a debt question's included — goes into
  checkpoint 1 in its final form (§ Applying an answer).
- Before checkpoint 1, check the list, every Draft basis and every unconfirmed
  status, and that no two questions ask about the same thing (keep one and
  narrow or remove the other), then offer checkpoint 1 and closeout as usual. An answer given after
  checkpoint 1 follows the host's own checkpoint contract, and a change to the
  capture's documents never rides the closeout commit. After the capture
  closes, a later capture answers it, or, once the capture has merged,
  `references/modify-existing-baseline-confirmation.md` answers it with no host
  (§ Where confirmations are recorded).
- Deferring replaces only answering the named 6.2 questions now. It does not
  lift a Step Gate, the branch gate, the commit policy, merge or push
  permission, or the two checkpoints. A completed host means only that the
  capture is closed.
- A Step Gate the developer has not answered stays where it is; keep its
  result where the workflow keeps it.

## Where confirmations are recorded

- **Goals & Scope.** Record every 6.2 confirmation as one line in the host's
  Goals & Scope: what it settled, and where that landed (BR-ID, `analysis.md`
  entry id, tech-debt item, term). On a baseline minimal host the lines follow
  the one or two sentences that state the capture's scope. A capture on a
  phase-bearing host writes them into that host's Goals & Scope. Record only
  confirmations actually given: never a deferral, its authorization, a pending
  state or a list of pending questions. An answer to a deferred question is
  recorded in the host where it was given — the capture that deferred it while
  that host is open, or a later capture — under that host's SPEC-ID, never the
  SPEC-ID in the question's id. One given with no host is recorded as **An
  answer with no host** below says.
- **`analysis.md`.** A confirmed entry's Evidence reads
  `confirmed by {role} - {SPEC-ID} Goals & Scope ({date})`. Cite the host by
  SPEC-ID, never by path. An `assumed` entry's question row becomes a resolved
  row, as the template says.
- **`Known deviation` records.** When 6.2 confirms what a `Known deviation`
  line says the code does, append
  `; confirmed by {role} - {SPEC-ID} Goals & Scope ({date})` to that
  observation's evidence in every record that carries it: the `behavior.md`
  and `analysis.md` lines and the debt row's `Code evidence`. Keep the
  evidence before it (`references/confirmed-rule-vs-code.md` § Scope and
  recording).
- **`glossary.md`.** The confirmed term's Notes cell carries the same SPEC-ID.
- **`rules.md` and `migration/tech-debt.md`** take no confirmation note — not
  in a Description, not in § Follow-up Notes. A `rules.md` row's `active` is
  its confirmation; who confirmed a rule or a debt item is in the Goals & Scope
  line that names its BR-ID or item. One exception is the `Rule evidence`
  line of a debt row that records a confirmed-rule deviation: write
  `confirmed by {role} - {SPEC-ID} Goals & Scope ({date})` there, pointing to
  that line, and do not repeat what was confirmed. The other is what
  **`Known deviation` records** appends to its `Code evidence`.
- **An answer with no host.** An answer that
  `references/modify-existing-baseline-confirmation.md` applies has no host and
  no Goals & Scope to cite. Where the bullets above write
  `confirmed by {role} - {SPEC-ID} Goals & Scope ({date})` — an `analysis.md`
  entry's Evidence, a `glossary.md` term's Notes, the `Rule evidence` line of a
  confirmed-rule deviation's debt row — write
  `confirmed by {role} - version history ({date})`. To the evidence of an
  observation it confirms, append `; confirmed by {role} - version history ({date})`
  in every record that carries it, keeping the evidence before it.
  `version history` means the commit that writes the cell. The form names no
  host, no question id and no Decision, and it never cites the capture's Goals
  & Scope. Every other answer is recorded in a host.
- **Resume Pointer.** Current Progress stays a one- or two-sentence cursor and
  carries no confirmation. Add no section to `_index.md`.

## A BR the Current BR Snapshot carries

On a phase-bearing host, the Current BR Snapshot may carry a BR this capture
touches — inherited from `rules.md` when a follow-up opened, or set by the
feature's own spec. Decide by whether the capture changes that rule's meaning:
its text, or the outcome of one of its scenarios.

- **The meaning stays** — another scenario, more evidence, another source
  page. Write it as usual, confirm it in 6.2, and declare it in the row as
  usual.
- **The meaning changes** — do not make that change in this capture. Leave the
  `rules.md` row and its `behavior.md` scenarios as they are. Record what was
  confirmed as an item in that context's `rules.md` `## Open Questions`: the
  BR-ID, the confirmed rule, the host whose Snapshot carries it (SPEC-ID), and
  who confirmed it on which date. Add a Goals & Scope line, and tell the
  developer. The change that later alters that BR — this feature's next phase
  included — goes through the ordinary spec flow and removes the item.
- 6.2's answers about such a BR land by these two bullets. "This is the rule"
  with different text, "the code is wrong" with a rule whose meaning differs
  from the row's, and a difference that changes its meaning are each a change
  of meaning. "The code is wrong" with the rule the row already states keeps
  the meaning: its deviation records change no rule, so write them as usual.
- When "the code is wrong" changes the meaning, still write its debt row now:
  it does not change the `rules.md` row. Leave the `Known deviations` cell and
  the `behavior.md` and `analysis.md` deviation lines to the change that later
  alters that BR; until then they could only point at the old text. Do not
  refresh the Snapshot to get around the spec, and do not write the new rule
  into the `Known deviations` cell.
- When the answer to a deferred question changes that meaning, write it as
  the question's `not-applied` Decision (§ Deferred confirmation records): the
  confirmed rule in `answer`, who answered on which date in `confirmed by`, and
  in `applied to` the SPEC-ID of the host whose Snapshot carries the BR and
  that the ordinary spec flow applies it. That Decision is the `## Open
  Questions` item the second bullet asks for: do not write another. Write the
  Goals & Scope line and any debt row as above.
- A different view of an `active` rule never turns its scenarios into a
  candidate: it gets no Draft basis.
- A BR the Snapshot does not carry changes as usual.

## `Last updated` in `rules.md`

When this capture adds a `rules.md` row or changes the rule a row states — its
BR-ID, Rule summary, Behavior anchor or Status — set that row's `Last updated`
to the date the capture wrote it. Otherwise, leave `Last updated` as it is,
including when the capture changes only the `Known deviations` column, columns
the project added, or any combination of them.

## Draft basis and current observations

A BR this capture wrote or substantively rewrote that is still `draft` when 6.2
ends carries one Draft basis line in `behavior.md`: directly under its
`### BR-NNN: ...` heading, before anything else in that section — its first
Given/When/Then included — as its own paragraph with a blank line before and
after it.

```text
> Draft basis: {kind} - {what to open to re-check} ({YYYY-MM-DD}) — confirmation: {question link labelled with SPEC-ID/QNN} — observation: {observation link | same-scenario}
```

For example (the project fills in its real locations and dates):

```text
> Draft basis: code - ReceiptsController.Create and Edit, invoice-number checks (2026-10-16) — confirmation: [SPEC-20261016-001/Q01](./rules.md#open-questions) — observation: same-scenario

> Draft basis: inferred - Review.cshtml shows Submit only for draft; Submit handler has no status guard (2026-10-16) — confirmation: [SPEC-20261016-001/Q02](./rules.md#open-questions) — observation: [Submission entry observation](#submission-entry-observation)
```

- `{kind}` is `code`, `data`, `document`, `inferred` or `assumed`. Its meaning,
  `{what to open to re-check}` and the date follow the Evidence convention at
  the head of `templates/analysis.md`.
- A Draft basis does not take that whole convention: it never takes
  `confirmed by {role}`. It records where an unconfirmed candidate came from; a
  confirmation lands as § Where confirmations are recorded says.
- When the sources are mixed, or the conclusion goes beyond what a source
  states directly, use `inferred` and name its `code`, `data` or `document`
  sources. With no source a reader can open, use `assumed`.
- `code` means only that the named entry points apply that condition
  directly. `data` is an observation of stored data, and `document` a written
  claim. None of them is the developer confirming a business rule.
- An `inferred` BR has a separate passage on what the system does now: a
  passage without a BR-ID, under a heading of its own, outside that BR's
  section. Its Draft basis links to that passage in `observation`.
- An `assumed`, `document` or `data` BR also gets such a passage, saying what
  was checked and what was not. When nothing was checked, say so; do not write
  an observation you did not make.
- `code` takes `observation: same-scenario` only when the scenarios state, one
  by one, the conditions the named entry points apply directly.
- A `draft` BR's Given/When/Then is a candidate rule, and a passage without a
  BR-ID is what the system does now. A difference between them before the rule
  is confirmed is not a `Known deviation`.
- A Draft basis does not turn a deviation recorded the old way into a
  deviation: `references/confirmed-rule-vs-code.md` § A deviation recorded the
  old way decides that conversion, and the debt Item it keeps.

When an answer is applied (§ Applying an answer):

- Before you remove or convert a passage without a BR-ID, find what still
  points at it: the `target` of a pending Question, the `basis` of a
  Provisional and the `observation` of another candidate's Draft basis. Remove
  or convert only what belongs to the answer being applied. Content still
  needed stays in the passage, or moves to a new passage, and every link to it
  is updated in the same change. Never leave a pending question or a candidate
  pointing at a passage you removed.
- The candidate is confirmed and the code follows it: remove its Draft basis,
  and remove from the passage what belonged to this answer, as the first
  bullet says. The confirmed rule and its scenarios remain.
- The candidate is confirmed, the code differs and the developer explicitly
  defers the fix: remove its Draft basis, and turn what the passage says for
  this answer into the records of `references/confirmed-rule-vs-code.md`
  § Scope and recording and § Analysis records, creating or reusing the debt
  Item. Do not keep the candidate's passage beside them; handle what other
  questions or candidates still need as the first bullet says.
- The developer confirms there is no such rule: remove the `draft` row, that
  BR's scenario section, its Draft basis and the question's whole record. What
  the code does stays as an ordinary passage without a BR-ID, as
  `references/confirmed-rule-vs-code.md` § A deviation recorded the old way
  says. Update direct references: no link or anchor may still name the
  rejected BR-ID.
- A rejected candidate whose Draft basis had `same-scenario`: first turn what
  was actually observed into an ordinary passage without a BR-ID, then delete
  the candidate's scenarios. What was not checked stays marked as not checked.
- Confirming a rule does not confirm what the code does, and neither does
  deciding to defer a fix. A part that still lacks its answer stays pending; do
  not declare a deviation established or fixed. A confirmed rule is applied as
  if it had been confirmed at 6.2 and loses its Draft basis; its other
  questions stay pending, and the rule does not go back to `draft`.

## Preserve pending confirmations

Read this section before work depends on, rewrites or settles a `draft` BR
that carries a `> Draft basis:` line, or a question that has a question id
(§ Deferred confirmation records).

- A Draft basis and a question's records are metadata. They never go into a
  Rule summary, a spec's BR text or a Current BR Snapshot's Current Rule.
- A follow-up host inherits only `active` rules into its Current BR Snapshot.
  In-scope `draft` rules and their questions stay in their documents: read them
  before work starts to depend on them. Its Goals & Scope says nothing about
  deferrals or pending questions.
- Never fill a Snapshot row as `active` from a `draft` rule. A baseline minimal
  host's Snapshot stays empty, a follow-up baseline's included.
- Before new work depends on a `draft` candidate, get the developer's
  confirmation of that content, and record it where that work records its
  decisions and spec. Then follow the ordinary Delta and Snapshot procedure.
- At closeout, when a Snapshot row is `active` and the Domain documents still
  hold that rule as pending, first check this host's spec and the recorded
  confirmation. When they do not settle it, stop syncing that row and ask the
  developer.
- A Snapshot `active`, a completed spec or a verify pass is not, on its own,
  evidence of a confirmation.
- Before rewriting a scenario that is still `draft`, read its Draft basis and
  its question. When the meaning stays, keep them; when the evidence changes,
  update the basis and its date.
- When the meaning changes, or the basis no longer supports the candidate,
  remove the question records that no longer apply and open a replacement
  question with a new number and basis. When the deferred scope does not cover
  the new question, get an explicit authorization before deferring it; do not
  reuse the old one. An acceptance of the old candidate never applies to its
  new meaning.
- When an ordinary spec confirms and applies that rule, remove its Draft basis
  and the whole record of each question the spec answered, and handle the
  passage on current behavior as § Draft basis and current observations says.
  The confirmation is recorded where that spec records its decisions. A
  `Known deviation` still calls `references/confirmed-rule-vs-code.md`
  § Preserve during merge.
- When a BR is renamed, update the living targets and links, and keep each
  question's number and the SPEC-ID in its id. When a BR is deleted, remove the
  records of questions it settled or that no longer apply; an open question
  that still applies moves, under a new number, to where its knowledge belongs.
  Leave no BR-ID that points at nothing.
- A change that opens a question, or removes or replaces a question's records,
  numbers it and writes its commit message as § Deferred confirmation records
  says.
- Changing a scenario does not fix a deviation: finish-feature Step 3 still
  clears it.

## Deferred confirmation records

This section is the one definition of these records: templates, flows and
`dflow render` follow it. They hold a question while it is pending and nothing
else; an answered question leaves no record.

- A question's id is the capturing host's SPEC-ID, `/Q` and a number of at
  least two digits: `SPEC-20261016-001/Q01`. Within one SPEC-ID a number is
  never reused, even after its record is removed. Number a new question one
  above the highest number already used for that SPEC-ID: search version
  history, commit messages included, for `{SPEC-ID}/Q`, and count the numbers
  the change not yet committed has given, removed ones included. A number is
  given once a record in that change carried it: one you only planned, and
  never wrote into a record, is not. Never number it from the highest number
  still in the documents.
  A question asks about one item that 6.2 asks about on its own — a BR, an
  `analysis.md` entry, a `behavior.md` passage, a term, a `models.md` passage
  or a `context-map.md` row, say — so that it can be answered by itself. When
  the rule, what the code does and whether to defer a fix need different
  answers, give each its own question.
- A commit that removes or replaces a question's records names each such
  question id in its message — a question opened and removed before that
  commit included — and, for an answer it applies, who gave it on which date
  and what it changed. How the answer was reached, the deferral and any
  provisional answer included, is kept there, never in the documents.
- Put a question with the knowledge its answer changes, as
  `templates/analysis.md` § Open Questions and Hotspots routes it: a business
  rule in that context's `rules.md`, a term in `glossary.md`, a context
  boundary or integration responsibility in `context-map.md`, other
  system-level knowledge in the right copy of `analysis.md`.
- Where that section has a question table, keep the table and its row ids, and
  add no row only to defer a question. Put the records after the table, with
  the same row's id in `target`. Where the section has no table, put them in
  its list.
- A question about a model goes after the `models.md` table that holds it —
  Entities, Value Objects, Domain Services or Repository Interfaces — or after
  the passage of the Context or Code Mapping Notes section it concerns, found
  by the model's name and the question id. Add no section and no column.
- A question about a debt item itself goes in `tech-debt.md`'s
  `## Follow-up Notes`, found by the full Item name and the question id. When
  what is really undecided is which business rule is right, the question stays
  in `rules.md` and only links the debt item.
- The two placements above are added here: the `models.md` and `tech-debt.md`
  templates have no Open Questions section. Every other question goes where it
  went before.
- A Question, a Deferred confirmation, a Provisional and a Decision are
  pending-question records, not confirmation notes. That `rules.md` and
  `tech-debt.md` take no confirmation note still holds.
- When you have no provisional answer, leave out the Provisional. Keep the
  question and its deferral; do not invent an answer to fill the format.

Each record is its own paragraph with a blank line before and after it. The
Question is a list item. The others are block quotes that follow it directly, in
this order, each only when it applies:

```text
- Question: {SPEC-ID}/QNN — target: {document path and BR-ID / entry ID / term / model / debt Item} — asks: {one question}

> Deferred confirmation: {SPEC-ID}/QNN — state: pending — scope: {6.2 subject explicitly deferred} — assigned to: {role} — authorized by: {role} ({YYYY-MM-DD})

> Provisional: {SPEC-ID}/QNN — answer: {AI's provisional answer} — basis: {kind} - {what to open to re-check} ({YYYY-MM-DD})

> Decision: {SPEC-ID}/QNN — outcome: {unresolved | not-applied | conflicting} — answer: {answer and what remains pending} — confirmed by: {role} ({YYYY-MM-DD}) — applied to: not-applied with reason: {reason and next action}
```

- The keywords, their case, the field order and the separators ` — ` and
  ` - ` are fixed. A date is a valid `YYYY-MM-DD`, and no field is empty. A
  field holds no line break and no ` — `: link a longer explanation to an
  ordinary passage. A Markdown link is fine.
- `basis` takes the five kinds of § Draft basis and current observations. A
  Question's `target` names a BR by its context's path and its BR-ID —
  `domain/billing/rules.md BR-003` — never by a bare `BR-003`.
- Leave out the Decision while nobody has answered. Write one current Decision
  only when an answer cannot be applied yet: `unresolved` when it still cannot
  be confirmed, `not-applied` when the ordinary spec flow has to apply it,
  `conflicting` when answers conflict.
- A Decision's `confirmed by` says only that this role gave the recorded
  answer. It does not say that the rule or the code is confirmed, or that the
  answer was applied.
- A later answer updates what is still pending; never add a Decision as
  history. When answers given on the same day conflict, or their order cannot
  be told, keep the question pending with one `conflicting` Decision: its
  `answer` gives each answer with its role and date, its `confirmed by` names
  the roles, and its date is the day you recorded it. Ask the developer to
  settle it; never pick an answer by line order.

### Applying an answer

- When an answer can be applied, apply it and, in the same change, remove the
  question's Question, Deferred confirmation, Provisional and Decision, remove
  the candidate's Draft basis, and handle the passage on current behavior as
  § Draft basis and current observations says. Write no completed state and
  keep no record of the decision.
- When only part of a question can be applied, first split what is undecided
  into new questions by subject, with the authorization and basis they still
  need, and remove the records of the part applied. What the undecided part
  still needs from a passage on current behavior stays, or is split out with
  its links updated. An applied answer never stays behind as pending history.
- When a scenario's new meaning makes a question no longer apply, replace its
  records with a question under a new number, and check the authorization for
  it (§ Preserve pending confirmations).
- Beside a question table, keep only the rows a confirmation at 6.2 would have
  left. Settle an existing hotspot or `assumed`-entry question row as
  `templates/analysis.md` and § Where confirmations are recorded say, with the
  real confirmation in its Evidence. Once the answer is applied, remove a row
  added only for this deferral, and its links. Never leave the deferral or a
  question id in a settled row.
- A `resolved` in an `analysis.md` question table is the state of that
  knowledge or hotspot, not of these records. These records exist only while
  their question is pending: they have no completed or replaced state.

The answer decides what the documents become. A host records the confirmation
as § Where confirmations are recorded says; the documents must end exactly as
they would have if the developer had given the same answer at 6.2. An answer
applied with no host differs only in the cells that section gives it.

| The developer's answer | What the documents become | What it does not mean |
|---|---|---|
| Accepts the candidate | `draft` → `active`; remove the Draft basis and the question's whole record; handle the passage on current behavior as § Draft basis and current observations says | That every entry point of the code follows it: confirming the rule and confirming the code are separate answers |
| Corrects it, then confirms | Update the candidate and its scenarios, then `active`; remove the question's whole record and the Draft basis; handle the passage on current behavior | A change to an established `active` rule, or to the meaning another `active` Snapshot carries |
| Confirms the rule and explicitly defers fixing the code | Write the records of `references/confirmed-rule-vs-code.md` § Scope and recording and § Analysis records from the passage on current behavior, creating or reusing the debt Item; remove the question's whole record and the Draft basis | That what the code does is confirmed: confirming the rule, confirming the code and deferring a fix are separate answers, and one still missing stays pending |
| Confirms what a `Known deviation` says the code does | Append the confirmation to that observation's evidence in every record that carries it, keeping the evidence before it (§ Where confirmations are recorded); remove the question's whole record | A confirmation of the rule |
| Confirms a term, a model, a context relationship or a debt item's description | Update what the question names and the direct references its answer needs; remove the question's whole record. A term's Notes takes the confirmation as § Where confirmations are recorded says; a model, a context relationship or a debt item's description ends as a 6.2 confirmation leaves it | A domain redesign, a project-wide rename or new business design; a debt item gets no confirmation note |
| Cannot confirm it, or allows only a provisional record | A Decision with outcome `unresolved`; a Deferred confirmation stays pending; the rule stays `draft` | `active`, a governing BR or a `Known deviation` |
| Says there is no such rule | Remove the rejected `draft` row, its scenario section, its Draft basis and the question's whole record; keep an ordinary passage without a BR-ID; update direct references so no BR-ID or anchor of the candidate is left | Removing an `active` rule, or that the code is fixed |
| Changes the meaning a Current BR Snapshot carries | Keep the whole pending record with a `not-applied` Decision (§ A BR the Current BR Snapshot carries); the host still records the answer and any debt row there; remove the records once the spec flow has applied it | Refreshing the Snapshot around the spec, or changing that row's rule or scenarios |
| Answers that conflict on the same day, or whose order cannot be told | One `conflicting` Decision with each answer, its role and date, and what must be settled; the question stays pending; apply the answer and remove the records only once it is settled | An answer picked by line order, or the conflict treated as settled |
