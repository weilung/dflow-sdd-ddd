# When a confirmed rule and the code disagree

> [繁體中文](confirmed-rule-vs-code.md) | **English**

> This page tracks the source `main` branch, so it can describe behavior the changelog still lists under `## Unreleased`. Your project runs the flows in its own workflow bundle: if `dflow/specs/shared/dflow-workflows/references/` has no `confirmed-rule-vs-code.md`, your project does not have these records yet — upgrade the CLI and run `dflow configure-agents` once.

A developer confirms a business rule that the code does not follow, and decides not to fix the code this time — for example, the rule says a qualification is released only after approval, while the code releases it on submission. If the documents record only what the code does, new work inherits the bug as if it were the specification; if they record only the rule, whoever looks up the current behavior believes the code already complies. Dflow records the two apart: the rule as confirmed, and what the code actually does as a **deviation**, linked to a technical-debt row. Once the code is fixed, `/dflow:finish-feature` removes the deviation at closeout.

This page explains what each document records, when the records are written, how closeout removes them, and what this approach does not cover. The procedure the AI follows is in your project's workflow bundle (`dflow/specs/shared/dflow-workflows/references/confirmed-rule-vs-code.md`); this page does not copy it. To learn why one of its rules is the way it is, ask your AI assistant: it looks up the `R-CRVC-` entries in `flow-rationale-registry.md` in the same directory.

## What each document records

| Document | What it records |
|---|---|
| `rules.md` | The rule as confirmed. Its last column, `Known deviations`, links the technical-debt row that records a deferred deviation; with none, it holds `—`. |
| `behavior.md` | The Given/When/Then scenarios state only the confirmed rule. What the code actually does goes in a `> Known deviation:` line under that rule's heading: what was observed, the evidence, and the debt link. |
| `analysis.md` | The tables record what the code actually does; a transition's Guard names the rule that should decide it, not the condition in the code. A row that violates a rule gets a `> Known deviation:` line beside it that names the rule it violates. |
| Technical debt (`migration/tech-debt.md` in brownfield, `architecture/tech-debt.md` in greenfield) | One row per deviation, named like `Qualification BR-007: release timing`: which rule, a summary of the confirmed rule, what the code does, the evidence for the rule and for the code, and why the fix was deferred. |
| This work's spec | A deviation confirmed and deferred while a flow is running gets a `> Deferred deviation:` line under the spec's title. When a rule that carries a deviation is deleted, its REMOVED entry gets a `**Recorded deviation**:` line, so closeout can still find it. |

Two limits:

- **`—` means only that no deviation is recorded in this format; it never means someone checked the code.** No deviation record does not mean the code follows the rule.
- **A deviation is neither a rule nor a legitimate edge case.** It does not go into the rule text or into the feature's BR Snapshot, and it gets no EC-ID.

## When the records are written

- Only when **you have confirmed the rule and decided to defer the fix**. The AI does not declare a rule confirmed because it read the code; a rule nobody can confirm stays `draft`, with its open question.
- Only where the work at hand may already change that context's documents: a change that declares that bounded context, or an observation-only record the flow permits (a baseline capture in brownfield; `/dflow:modify-existing`'s observation-only record in greenfield). A T3 change, or one that declares no bounded context, writes none — the AI tells you what it found and what is not recorded yet.
- A deviation confirmed while a flow is running gets its spec line first; `rules.md`, `behavior.md` and the debt row follow at the step of that flow that writes those documents. `/dflow:new-phase` does not write them, so they follow at closeout.
- When verification or PR review meets a spec with a deferral line, it counts that one deviation as a known exception and cites the debt row. It is no exception when the spec itself adds, changes or fixes that behavior — in its Delta, in a rule it introduces, as the defect a family (e) spec fixes, or in a task to repair that deviation: the deferral line is never edited once written, so a spec that later takes on the fix must still deliver it. Every other gap still fails.
- A deviation recorded the old way (for example as an edge case) is not converted automatically: the AI converts it when later work touches that rule and you confirm that it is a deferred defect.

## Who removes a deviation once it is fixed

A deviation is removed at `/dflow:finish-feature`'s closeout Step 3 and nowhere else: rewritten scenarios, a BR Delta in a spec, or a spec marked `completed` are not evidence of a fix.

- **Only with a signal.** Step 3 reads the closeout procedure only when the host's specs (a host is the directory that records the change, not a code directory) name a rule that carries a deviation, link a debt row, or carry a deferral line. With none of these, it prints one line: `Debt reconciliation: no signal`.
- **Only with evidence.** The AI opens this feature's test results and implementation and checks them against the conditions the record states. When the data is not enough, one rule has several entry points, or the scope is unclear, it asks you: "Which entry points did this feature fix, and which deviations remain?"
- **Fixed**: the `rules.md` cell goes back to `—`, every deviation line pointing at it is removed (other contexts' `analysis.md` included), the debt row is set to `done`, and the row records which spec fixed it.
- **Not fixed, or fixed in part**: kept, with its remaining scope and evidence updated. After the closeout sync, the AI checks that the `rules.md` cell and the `behavior.md` line are both still there, and adds whichever is missing. When nothing in this host repairs it after the deferral, the deferral line itself is the evidence that it was not fixed: it is kept, and you are not asked again.
- **No longer applying because the rule was removed or changed**: closed as it is, recorded as `Closed by rule change`, never as a tested repair.
- Ordinary debt that this work repaid, and that a spec links, is also set to `done` in this step.
- Step 3 ends by printing `Resolved deviations: …; debt done: …; retained: …`.

## The diagrams draw only the tables

`dflow render` draws state and flow diagrams from the tables in `analysis.md`: the Trigger is the observed action, and the Guard is the rule that decides it. A diagram marks no transition as breaking a rule — the deviation is in the text beside the diagram. Someone who sees only the diagram (a screenshot, say) will take every drawn transition as permitted. To tell whether a transition follows the rule, read the whole page.

## Upgrading existing documents

Both tracks' `rules.md`, `behavior.md`, `tech-debt.md` and `lightweight-spec.md` templates moved to a new shape number, so `dflow doctor` reports existing documents as an older shape. For two of the changes — the new `rules.md` column and the `behavior.md` Purpose note — doctor prints a migration of their own: existing rows get `—` (not `{TBD}`), and the Purpose is replaced with the template's. The reasons are in "Changes that carry their own migration" in [Upgrading an Existing Dflow Project](upgrading.en.md).

## What is left open

Each of these was considered and deliberately not guarded further: guarding it would cost every run (or every adopter) more than the error it prevents, or it is a judgement a person has to make. Each says who carries it and what would make us reconsider.

- **Reading only the diagram, and taking every drawn transition as permitted.** The diagram follows the tables: the Trigger is the observed action, and the Guard is the rule that decides it; the deviation is in the text beside it, and the CLI does no reasoning about rules. *Who carries it*: whoever shares or reads the diagram. *Reconsidered when*: a real misreading is reported, or the diagram is needed on its own.
- **A guide not refreshed after the upgrade, or an AI that read only old templates and never these records.** Upgrading and comparing by hand cannot guarantee that every tool reads the new instructions. *Who carries it*: the adopter. *Reconsidered when*: different ways of recording keep appearing after an upgrade.
- **One deviation recorded inconsistently across documents, or a closeout done without `/dflow:finish-feature`.** No check compares meaning across documents; closeout Step 3 and review compare the evidence. *Who carries it*: the feature's owner and the reviewer. *Reconsidered when*: real cases of repeated missed or wrong removals appear, to consider mechanical help.
- **A spec that names no related rule and links no debt gives closeout no signal.** The signal comes only from the specs; no signal does not mean the code has no defect. *Who carries it*: the spec's author and the reviewer. *Reconsidered when*: the standard way of writing still misses it often.
- **This work repaid some ordinary debt, but no spec links it.** Closeout does not scan all debt, so that row stays `open` until someone sets it to `done`. *Who carries it*: the developer and the reviewer. *Reconsidered when*: it is common enough to be worth a scan at every closeout.
- **The same feature deferred a deviation and fixed it later, but the fix is not in the specs closeout reads** (it names neither the rule nor the debt row). At closeout the deferral line is evidence: with no work found that repairs it, the record is kept and you are not asked. The wrong direction is a record kept that should have gone, never an unfixed one removed — removal still needs evidence first. *Who carries it*: the developer and the reviewer — name the rule or link the debt row in the spec when fixing it, or tell the AI at closeout. *Reconsidered when*: this gap is common enough to be worth asking at every closeout.
- **The code is fixed, but the data is not backfilled yet, or other entry points are still wrong.** One fix is a candidate, not proof of completion; a partial fix keeps the record, and one test does not close the whole row. *Who carries it*: the developer, confirming the scope of the fix. *Reconsidered when*: data repairs and code repairs keep being confused.
- **Fixed before closeout, while the deviation record is still there.** The record carries the date of its observation, which shows when it was observed; the record is removed only at closeout Step 3. *Who carries it*: whoever reads the documents while the feature is in progress. *Reconsidered when*: it causes misuse across many phases over a long time — measured first, then the presentation reviewed, without quietly moving where records are removed.
- **A deviation confirmed and deferred during `/dflow:new-phase` lives only in the phase spec until closeout**; `rules.md` and `behavior.md` do not show it yet. new-phase's write scope is not changed for it; verification and review accept the spec line, and closeout Step 3 completes the records from it. *Who carries it*: whoever reads only `rules.md` or `behavior.md` before closeout. *Reconsidered when*: features with many phases close late and this causes misuse.
- **A deviation recorded the old way before the upgrade (for example as an edge case) shows `—` under `Known deviations`.** Existing rows all get `—`; what `—` means is stated in the column's comment and on this page. *Who carries it*: whoever reads only one row of `rules.md`; the record is converted when later work touches that rule. *Reconsidered when*: adopters report misreading it — then a to-be-confirmed value, or a one-time inventory, would be considered.
- **A brownfield baseline capture rides on a feature with phases, and what it confirms would change the meaning of a rule that feature's BR Snapshot carries.** The rule is not changed in this capture — otherwise the closeout sync would write the Snapshot's old text back over the rule just confirmed. What was confirmed goes into `rules.md`'s `## Open Questions` and the host's Goals & Scope, and the debt row is written as usual; the `rules.md` cell and the in-place deviation lines wait for the change that later alters that rule, because until then they could only point at the old text. *Who carries it*: the change that later alters the rule. *Reconsidered when*: a reproducible case stays stuck for a long time.
- **An old edge case that is really a defect, which the AI treats as legitimate.** There is no automatic conversion; you judge it when work touches that rule. *Who carries it*: the adopter. *Reconsidered when*: a one-time inventory is asked for — then instructions for it would be provided.
- **After a rule is renamed, the debt row's name still shows the old BR-ID.** The name never changes once the row exists — the spec's deferral lines and the links find the row by it; which rule the row tracks now is its `BR:` line. *Who carries it*: whoever reads only the name. *Reconsidered when*: someone looks up the wrong rule because of it.
- **A `rules.md` or `behavior.md` that was renamed or moved off the path its flow creates it at, and has no shape marker doctor can read, gets no migration from doctor.** Following the general add-the-shape steps, the new column may get `{TBD}` and the old Purpose may stay. doctor prints a migration only for a document whose template it can tell: by the marker when there is one, by the path when there is none or it cannot be read; and such documents are outside Dflow's flows too — closeout cannot find them. *Who carries it*: you and the AI, handling those documents — the migrations say the two things "Upgrading existing documents" above says. *Reconsidered when*: renamed or moved documents are common and reports of the general steps going wrong appear.

**Passing checks do not mean a deviation is fixed.** `/dflow:verify` passing its BR and anchor checks, `dflow doctor` passing its shape checks and `dflow check-closeout` passing do not prove that a deviation is fixed; closeout Step 3's evidence, the AI and you decide that.
