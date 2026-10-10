# Confirmed Rule vs Code

A developer can confirm a business rule that the current code does not follow,
and decide to fix the code later. This reference says how each document records
that difference, how merges keep the record, and how closeout removes it once
the code is fixed.

Read only the section a call names. Each section is complete for the calls that
name it.

Terms used below:

- **Deviation**: a confirmed rule and the observed implementation differ. A
  deviation record is not a rule and not a legitimate edge case.
- **Qualified BR reference**: `domain/{context}/rules.md` plus the BR-ID. The
  `BR-001` of one context is not the `BR-001` of another. Inside a context's own
  documents the bare BR-ID refers to that context.
- **Item**: the technical-debt row that tracks a deviation.

## Scope and recording

### When this applies

- Record a deviation only when the developer has confirmed the rule and has
  decided to defer the fix. Do not declare a rule confirmed because you read the
  code.
- Record it only where the running work may already update that context's
  Domain documents: a change that declares that bounded context, or an
  observation-only record the local flow permits.
- In a T3 change, or a change that declares no bounded context, write no
  deviation record. Tell the developer what you found and what is not yet
  recorded, and point to the local observation-only route. Do not commit that
  record on this host's branch: record it after the host merges, or on another
  branch.
- If the fix concerns a BR of some context while the host declares no bounded
  context, correct the scope first. Do not record the deviation as global debt
  to get around the scope rule.
- Without a confirmed rule, do not invent a governing BR. Keep the existing
  `draft` and open-question handling.
- No deviation record does not mean the code follows the rule.

### The records

Read the local `templates/tech-debt.md` and its `Confirmed-rule deviations`
comment for the debt file and its columns. Create the debt file from that
template the first time it is needed.

The step of the running workflow that writes a document writes that document's
record. A document the workflow writes only at closeout gets its record at
closeout. Until the debt row exists, write the Item name where a record says
`tech-debt:`; once it exists, replace the name with the link in the `rules.md`
cell and in the `behavior.md` and `analysis.md` lines.

**`rules.md`** — the `Known deviations` column of the BR's row holds:

```text
Known deviation — tech-debt: {Item}
```

`{Item}` is a Markdown link to the debt file's `#debt-items`, labelled with the
full Item name. Separate several Items with `<br>`. A row with no unresolved
recorded deviation holds `—`; a blank cell means the same as `—`. Put no
deviation text in the Rule summary, BR-ID, Status or Behavior anchor. Changing
only this column is not a BR Delta and does not change `Last updated`.

Rows that predate this column hold `—`. A deviation recorded before this column
existed is converted as § A deviation recorded the old way says.

**`behavior.md`** — after the `### BR-NNN: ...` heading and before the first
Given/When/Then, one line per deviation, as its own paragraph with a blank line
before and after it:

```text
> Known deviation: {BR-ID} — observed: {what the code does} — evidence: {evidence} — tech-debt: {Item link}
```

The scenarios and the legitimate Edge cases state only the confirmed rule. Do
not give a deviation an EC-ID, and do not put it inside a scenario block.
`{evidence}` has the shape `{code | data | document | inferred | assumed} -
{where to re-check} ({date})`. When the developer has confirmed what the record
says the code does, and that confirmation is recorded where a reader can open
it, keep the evidence and append
`; confirmed by {role} - {where it is recorded} ({date})`. The evidence that
confirmed the rule is not evidence about the code: neither the rule's
confirmation nor the decision to defer is appended. A reader who takes only the
Given/When/Then reads the rule; what the code does now needs the adjacent
deviation records and their dates.

**`analysis.md`** — see § Analysis records.

**The debt row** — when you create the row, name the Item
`{context} {BR-ID}: {difference}`, for example
`Qualification BR-007: release timing`. The name is fixed once the row exists.
When the BR is renamed later, update the row's `BR:` line and the live
references to the BR, and keep the name: the `BR:` line, not the name, says
which BR the Item tracks now. Write this payload in the column the local mapping
names, its items separated by `<br>`:

```text
BR: {domain/{context}/rules.md BR-ID}
Confirmed rule: {concise confirmed intent; refer to the rule for its full text}
Observed code: {actual behavior and scope}
Rule evidence: {re-checkable confirmation reference and date}
Code evidence: {evidence}
Deferred: {why the developer deferred this fix}
```

One Item may list several failing entry points of the same BR. Where they are
already split into several Items, keep each Item and reconcile by context and
BR. Link every deviation record to its matching Item, never to the bare debt
file. `Confirmed rule` is a short summary that identifies the difference, not a
second copy of the rule to edit. With no re-checkable confirmation, write
`assumed` and hand the confirmation back to the developer; a chat is not
evidence anyone can open.

### A deviation recorded the old way

A deviation recorded before these records existed — for example as an edge
case — does not appear in the `Known deviations` column. Convert it when later
work touches that BR and the developer confirms that it is a deferred defect:
write the records above in place of the old form. When a debt row already
records it, that row becomes its Item: keep the row's name and write the
payload into it.

When the developer instead says that no confirmed rule covers what the old
record describes, it is not a deviation. In place of the old form, write what
the code does in `behavior.md` as a passage without a BR-ID, outside that BR's
section. Record what is still undecided with the existing `draft` and
open-question handling (§ When this applies). Do not give its debt row a `BR:`
line.

### A deferral recorded in the spec

When the developer, during a flow, confirms that an existing BR this work
affects deviates and defers its fix, write one line in this work's spec:

```text
> Deferred deviation: {qualified BR reference} — observed: {what the code does} — evidence: {evidence} — deferred: {reason}; confirmed by {role} ({date}) — tech-debt: {Item name, or its link once the debt row exists}
```

- Write it before the first check of that flow that requires this BR, its
  scenarios or its invariants to be implemented. If the spec does not exist yet,
  write it when the flow creates the spec.
- When this spec covers a BR that already carries a deviation record and this
  work does not fix it, write one line too, linking the existing Item.
- Place each line after the spec's `#` title and before its first `##` heading,
  as its own paragraph with a blank line before and after it. Do not put it
  under `## Implementation Tasks`.
- A record made without a spec — a capture, or an observation-only record — has
  no such line. Write its records directly.
- The line records a decision, not rule text. It does not enter a Delta, the
  Business Rules or the Current BR Snapshot, and it replaces none of the
  records above.
- Never edit the line afterwards. It records the BR and the Item as they were
  when it was written. If a spec of the same host later renames that BR, use the
  renamed BR when you complete or reconcile its records. If the line cannot be
  matched to a current BR or Item, ask the developer; do not create a second
  Item.

### Completing the records of a deferral line

The step that writes that context's `rules.md` — the flow's document sweep, or
closeout's Step 3 for a flow that leaves that sync to closeout — completes each
deferral line's records, one observation at a time:

1. Read the debt row the line names. If the row does not exist, create it from
   the line's Item name and content.
2. If the row exists but does not record this line's observation, add the
   observation and its evidence to the payload.
3. If the BR's `Known deviations` cell does not link the Item yet, link it.
4. Add this observation's line to the BR's section in `behavior.md`.
5. In `analysis.md` deviation lines already written for it, replace the Item
   name with the link.

Items 3 and 4 need the BR's `rules.md` row and `behavior.md` section:

- If this step will rename the BR, its row and section still carry the old
  BR-ID: write items 3 and 4 there before renaming them, so that § Preserve
  during merge keeps them through the rename.
- If the BR has no row or section yet, do not add one only to hold the record.
  Write items 3 and 4 after the step that adds them: later in this sweep when
  the sweep adds them, or, when closeout's sync adds them, through
  § Closeout reconciliation item 9 after that sync.

### A rule confirmed now and deferred entirely

A rule this work confirms and whose whole fix it defers is not a change this
work makes. Do not write it into this spec's Delta or Business Rules. It has no
BR-ID yet, so it gets no deferral line.

When this work's document sweep writes that context's `rules.md`, add the rule
there as `active`, with its `Known deviations` cell, its `behavior.md` section
and its debt row, and set `Last updated` to the day it is written. When the
sweep cannot add it — a T3 change, a change that declares no bounded context,
another context's `rules.md`, or a step that only syncs `rules.md` from the
Snapshot — handle it as § When this applies says. This limit is on adding a
row: filling the deviation column of a row that already exists is allowed,
because the column is outside the Snapshot.

### The coverage exception

A check that requires a BR, its scenarios or its invariants to be implemented
counts that BR as covered except for one deviation only when this spec carries
a Deferred deviation line for it and this spec does not add, change or fix that
behavior — none of its Delta entries, the Business Rules it introduces, the
defect a family (e) spec fixes, or a task it carries to repair that deviation.
Report the exception and cite the debt Item.
The exception stops at what that line observed: another entry point, another
scenario, and any gap without such a line still fail the check.

## Analysis records

- Record in the entry what the code actually does. A cell that refers to a rule
  still holds only the BR reference. Do not copy the confirmed rule's text into
  `analysis.md`.
- A rule reference says which rule should govern what the entry records there;
  it does not say that the observed behavior complies. When the code violates a
  rule the entry refers to — in a row, or in a sentence outside the entry's
  tables — put a `Known deviation` line next to the entry that names that BR.
  Do not write "the code does not enforce it" as "no rule decides it". Do not
  add a wrong condition, a warning or evidence to the Guard.
- `LC`: From, Trigger and To record the observed states - or `[*]` - and
  trigger. Write the Trigger as the template's placeholder asks: the actual
  actor and action. Put the BR-ID that decides the transition in Guard. Give
  each entry point of the same BR its own row, told apart by its Trigger. A
  transition the rule expects but the code does not implement stays in
  `behavior.md`; do not draw it as an observed edge.
- Place the line:
  - `LC` and `FL`: after the entry's last table.
  - `FN` and `HS`: after the section's table.
  - `RM`: after the content, before the closing `Evidence:` line.
  - `MX`: after the content and the `Affects:` line, before the closing
    `Evidence:` line.
- Do not create an entry, a table or a Guard only to hold a deviation line. If
  no analysis knowledge is affected, write nothing here.
- `at:` names the place: for `LC`, the entry ID, From → To and the Trigger; for
  `FL`, the entry ID and the step `#`; for `FN` and `HS`, the row's entry ID;
  for `RM` and `MX`, the entry ID. For a sentence outside the tables of an `LC`
  or `FL` entry, name the transition or step that sentence is about in the same
  way, or the entry ID alone when it is about none of them.
- `Evidence:` stays the subsection's last line, and a table row keeps its own
  Evidence cell. The line cites evidence about the code; the evidence that
  confirmed the rule stays in the debt row's `Rule evidence`.
- In the context's own `analysis.md` a bare BR-ID is enough. In the domain
  root's `analysis.md`, or another context's, use the qualified BR reference.

The line, with the blank lines that are part of its format:

```text
{the entry's last table, or its content and Affects: line}

> Known deviation: {qualified BR reference} — at: {entry ID and row locator} — observed: {actual behavior and violated condition} — evidence: {evidence} — tech-debt: {Item link}

{the entry's closing Evidence: line, when it has one}
```

Keep both blank lines. Without them the next line — an `Evidence:` line here, a
`Given` line in `behavior.md` — is read as part of the blockquote.

Example — submission releases the qualification, violating BR-007; approval
releases it, complying:

```text
| From | Trigger | To | Guard | Evidence |
|---|---|---|---|---|
| `held` | Applicant submits (`QualificationService.Submit()`) | `released` | BR-007 | code - QualificationService.Submit() ({date}) |
| `held` | Reviewer approves (`QualificationService.Approve()`) | `released` | BR-007 | code - QualificationService.Approve() ({date}) |

> Known deviation: BR-007 — at: LC-01 `held` → `released`, Trigger "Applicant submits" — observed: submission releases the qualification while approval is pending, violating BR-007 — evidence: code - QualificationService.Submit() ({date}) — tech-debt: {Item link}
```

The rendered diagram uses table cells; it does not mark a transition as a
rule violation. Read the adjacent Known deviation records before treating a
drawn transition as permitted behavior.

## Preserve during merge

1. The `Known deviations` column and every `Known deviation` line are metadata.
   They never enter a phase spec's or a lightweight spec's BR text, and never
   enter the Current BR Snapshot. Describing a root cause with a code
   Before/After is not a BR Delta.
2. A follow-up inherits only the rule fields the Snapshot defines, such as the
   Rule summary. Read the source row's `Known deviations` cell to know what the
   code does now; do not copy it, and do not fold it into the summary.
3. When you merge a `rules.md` row, update its rule fields and keep its
   `Known deviations` cell. Give a new row the value § Scope and recording
   gives. A Snapshot without the column is not an instruction to clear it.
4. Before you rewrite a BR's scenarios in `behavior.md`, or rebuild an
   `analysis.md` entry, collect its deviation records. After the merge, put them
   back at the placements § Scope and recording and § Analysis records give.
5. When an entry or a BR is renamed, update every live reference to the old name
   and anchor, and the debt row's `BR:` line, in the same change. Keep the Item
   name: spec lines and links find the row by it.
6. Updated scenarios, a non-empty BR Delta and a completed spec are not evidence
   that a deviation is fixed. Only `finish-feature-flow.md` Step 3 decides that,
   through § Closeout reconciliation.
7. When a BR is REMOVED, or a new rule accepts what the code does, leave the
   matching debt and records for closeout to decide whether they lapsed. Do not
   report "no longer applies" as "the code was fixed". If other BRs or entry
   points are still affected, move the record to the identity that still
   applies; do not delete unpaid debt.
8. Before a flow's sweep deletes a REMOVED BR's `rules.md` row or `behavior.md`
   section that carries a deviation record, write one line per debt Item that
   record links, under that BR's REMOVED entry in this spec, after its
   `**Reason**:` line:

   ```text
   **Recorded deviation**: tech-debt: {Item link}
   ```

   Then delete as the flow says. Closeout's own sync does not write this line.

These rules do not widen who may change a rule. Whether a rule changes is still
decided by the spec process.

## Closeout reconciliation

`finish-feature-flow.md` Step 3 calls this section when the host's specs carry a
debt signal.

1. **Candidates.** Start from the signals Step 3 collected.
   - For each signalled BR, read every spec of this host that names it — its
     Delta, a family (e) spec's `Governing BR-IDs`, its Business Rules, its Fix
     Approach and its Implementation Tasks — and the debt rows its
     `Known deviations` cell links.
   - For each signalled debt Item, read its row and every spec of this host that
     links it, in the same sections. The BR on the row's `BR:` line is
     signalled too.
   - An Item that a deferral line names and that has no debt row yet is a
     pending candidate: hold the line's BR, Item name and observation. After the
     completion before the sync creates the row, read it in the same Step 3 and
     continue.
   - For a post-hoc host, read the reconciled hotfix and its regression
     evidence. No code diff on the documentation branch does not mean nothing
     was fixed.
2. **Records.** For each candidate BR, search the live `domain/**/rules.md` and
   `behavior.md`, and the context's and the domain root's `analysis.md`, for
   every deviation record of that BR, by its qualified BR reference. A search hit
   finds a candidate; it does not prove a deviation is fixed. A BR-ID that
   appears in ordinary rule text is not a deviation record.
3. **Scope.**
   - A record a host wrote while only observing, without changing code, is not a
     repair. Where the host also carries other work, judge by what that work
     repaired.
   - A `Deferred deviation` line of this host's specs is evidence, not an
     exclusion: it records that, when it was written, the host decided not to
     fix the observation it records. It excludes neither the Item's other
     observations nor this one. If any spec of this host — the one carrying the
     line included — has work among the inputs of item 1 that repairs this
     observation, or changes or removes the rule it violates with MODIFIED or
     REMOVED, take it to item 4; a changed or removed rule goes to item 8. With
     no such work, the line is the evidence that the observation was not
     repaired: keep the record, and neither prove it again nor ask the
     developer.
   - A host that declares no bounded context may close global debt it repaid. It
     may not change a BC's deviation records; if it needs to, correct the scope
     first.
4. **Proof.** For each candidate, open the regression or test results, the
   implementation location and the conditions the record states, and check
   that this feature removed the deviation. `Governing BR-IDs`, the Delta and
   `completed` only name candidates. When the data is insufficient, one BR has
   several entry points, or the scope is unclear, ask the developer, per item:
   "Which entry points did this feature fix, and which deviations remain?"
   Record the re-checkable answer and the repairing SPEC-ID in the debt row.
5. **Unknown or partial.** Leave an unconfirmed record unchanged and do not
   report it cleared. After a partial repair, keep the BR's open deviation and
   update its remaining scope and evidence. One passing regression for a BR does
   not set every debt row of that BR to `done`. If an old record does not
   separate the scopes, ask; do not split it into a done part on your own.
6. **Cleanup.** For a BR whose recorded deviations this feature removed — all of
   them — search the live documents of item 2. Set its `Known deviations` cell
   to `—`, remove every `Known deviation` line pointing at it, and set the
   matching debt rows' `Status` to `done`, including lines in other contexts'
   and the domain root's `analysis.md`. Keep an `analysis.md` observation that
   the sync already corrected. Correct or remove, as the proof shows, a table
   row that still records the wrong behavior; do not remove only the warning.
   When one BR's deviations are split over several Items, a repaid Item may be
   set `done` on its own.
7. **General debt.** Set debt this work repaid that records no confirmed-rule
   deviation to `done`; leave it if any part is unpaid. Append
   `Resolved by: {SPEC-ID} — {evidence} ({date})` in the column the local
   mapping uses for the payload. A debt entry with no `Status` column — for
   example a one-line checklist item — is marked done by checking it, with the
   same sentence. Never delete a debt row's history.
8. **Lapsed.** When an approved REMOVED or changed rule makes a deviation lapse,
   close it as it is and write
   `Closed by rule change: {SPEC-ID} — {decision reference} ({date})`; never
   record it as a tested repair. If part of it still applies, keep it or move it
   to the identity that applies. Report it apart from repairs.
9. **Kept deviations.** After the sync, check each deviation this procedure
   keeps under items 3, 5 and 8: its BR's `Known deviations` cell links its
   Item, and the BR's `behavior.md` section holds the observation's line. Add
   whichever is missing, as § Scope and recording says; that completes the
   record and does not change what it records.
10. **Output.** In Step 3's conversation output, report
    `Resolved deviations: {qualified BRs | none}; debt done: {Items | none}; retained: {Items and reasons | none}`,
    then follow Step 3's existing gate to Step 4. Add no host registry and no
    `_index.md` field. Step 4 stages these reconciliation edits with the rest.

Clean only live deviation records. Do not delete completed specs, repair
evidence or a debt row's history, and do not clear the same BR-ID of another
context.

`/dflow:verify` passing its BR and anchor checks, `dflow doctor` passing its
shape checks and `dflow check-closeout` passing do not prove that a deviation
is fixed. This procedure, the evidence and the developer decide it.
