# Baseline Capture — Brownfield Progressive Extraction

Branch file of `references/modify-existing-flow.md` (brownfield only). It
**adds** the baseline-capture rules; it does not restate or override anything
in that flow.

**You are here because** that flow's pointer after Step 1 Part A sent you: Part
A routed this change as a baseline capture. Keep this file open through Step 6.
It adds to that flow's Steps 1.6 and 1.7, Steps 2 to 4 and Step 6.2, and the
places there that differ for a capture point back here.

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
  on a phase-bearing feature that hosted a capture.
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
  upstream, and what data passes between them. To write it, declare it in the
  `Tier = baseline` row. Brownfield `init` does not create it: create it from
  `templates/context-map.md` the first time there is something to record. The
  declaration admits the file, not particular rows: which relationships the
  capture changed is for its scope and for review to hold.
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
other three and the five this file adds, one by one, in this order:

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
     question where `templates/analysis.md` § Open Questions and Hotspots
     routes it.
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

## Where confirmations are recorded

- **Goals & Scope.** Record every 6.2 confirmation as one line in the host's
  Goals & Scope: what it settled, and where that landed (BR-ID, `analysis.md`
  entry id, tech-debt item, term). On a baseline minimal host the lines follow
  the one or two sentences that state the capture's scope. A capture on a
  phase-bearing host writes them into that host's Goals & Scope.
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
- A BR the Snapshot does not carry changes as usual.

## `Last updated` in `rules.md`

When this capture adds a `rules.md` row or changes the rule a row states — its
BR-ID, Rule summary, Behavior anchor or Status — set that row's `Last updated`
to the date the capture wrote it. Otherwise, leave `Last updated` as it is,
including when the capture changes only the `Known deviations` column, columns
the project added, or any combination of them.
