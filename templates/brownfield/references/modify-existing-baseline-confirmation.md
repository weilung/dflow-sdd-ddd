<!-- Part of Dflow (AGPL-3.0-or-later with additional permissions and terms): see LICENSE in the Dflow package, or dflow/specs/shared/dflow-workflows/LICENSE in a project. -->
# Answering a Closed Capture's Deferred Questions — Brownfield Progressive Extraction

Branch file of `references/modify-existing-flow.md` (brownfield only). It
**adds** the procedure for answering, with no host, questions a closed baseline
capture deferred; it does not restate or override anything in that flow.

**You are here because** that flow's Step 1 sent you: the developer explicitly
asked to answer questions a baseline capture deferred. This route takes no
tier, opens no host, takes no SPEC-ID of its own and records no checkpoint. It
writes the answers into the documents the questions name and ends in one
documentation commit. Tell the developer so before you start.

Keep `references/modify-existing-baseline.md` open beside this file. Its
§ Deferred confirmation records defines the records, § Applying an answer and
§ Draft basis and current observations say what an applied answer leaves, and
§ Where confirmations are recorded gives the form a confirmation takes with no
host. This file adds only what changes when there is no host.

## Before you start

1. Confirm that the request names the capture's SPEC-ID and which of its
   questions to answer: question ids, or every question of that capture still
   pending. When it names neither, ask; do not choose the questions yourself.
2. Read the capture's Goals & Scope for its capture scope, every record of the
   selected questions, each `> Draft basis:` line that links to them, the
   documents they target, and `dflow/specs/shared/_conventions.md` § Git
   Policy.
3. Confirm that the capture is closed and that its documents are on the branch
   this change starts from (§ Branch). While the capture is still open, its own
   workflow answers the questions (`references/modify-existing-baseline.md`
   § Deferring 6.2 questions): leave this route. When it is closed but not yet
   merged, finish integrating it first.
4. This route takes over no running workflow. When an active feature, or a spec
   or Snapshot change in flight, touches a rule or a document a selected
   question targets, list each overlap and ask the developer which to finish
   first. Do not sync or change that host.

## Branch

Cut the branch before you write anything.

- **gitflow** — from the integration branch that holds the capture, cut a
  branch the project allows for a documentation change, and merge it back into
  that same branch by the project's PR policy.
- **trunk** — follow the project's policy for a documentation commit.
- When the project has no convention for documentation branches, ask the
  developer which branch to use and how it is integrated. Dflow names no
  branch.
- Never assume `main`, never revive the capture's feature branch, and never
  open a host, under the capture's SPEC-ID or a new one.

## What this change may touch

Derive what this change may touch from the selected questions: the documents,
rows and passages their records name, and what their answers directly need.
Keep no other list. The change holds only:

- the records of each question it applies, and the Draft basis of each
  candidate those answers settle;
- the `draft` rules and scenarios those answers settle, and their
  `Last updated`;
- the passages on current behavior, the Evidence and the question-table rows
  those answers change;
- the terms, models, context relationships and debt descriptions those answers
  name, and the direct references they need;
- the deviation records and debt rows an answer directly needs
  (`references/confirmed-rule-vs-code.md` § Scope and recording).

It holds no new capture, no code, no unrelated tidying and no change to the
meaning of an `active` rule. A question that needs a new capture before it can
be answered stays pending: send it to an ordinary baseline capture.

## Re-check each question

The documents may have changed since the capture. For each selected question,
reopen what its answer would rest on: the sources its Draft basis and its
Provisional name, the code or data they point at, and its target.

- When a BR was renamed, a rule's meaning changed, an observed entry point
  moved, the target is gone, or another answer already settled it, show the
  developer the difference and get an answer about what the documents say now.
- When a question no longer applies, replace its records under a new number,
  as `references/modify-existing-baseline.md` § Applying an answer says.
- An acceptance of the old candidate never applies to a new version of it.

## Get the answers

Show the developer the complete list of the selected questions: each with its
id, its target, what it asks, and its Provisional when it has one. Take an
answer for each, or one answer for a set the developer names by question ids.
The developer may answer only some of them: the others stay pending. A batch
answer confirms only what `references/modify-existing-baseline.md`
§ Deferring 6.2 questions lets a batch answer confirm, and approving the diff
or the commit confirms nothing.

## Apply the answers

- Apply each answer as `references/modify-existing-baseline.md` § Applying an
  answer says: its table decides what the documents become. In the same
  change, remove the whole record of each question applied and the Draft basis
  of each candidate it settles, and handle the passages on current behavior as
  `references/modify-existing-baseline.md` § Draft basis and current
  observations says. Write a Decision only for an answer that cannot be applied
  yet.
- When an answer would change the meaning a Current BR Snapshot carries, do not
  apply it: write it as the question's `not-applied` Decision and any debt row,
  as `references/modify-existing-baseline.md` § A BR the Current BR Snapshot
  carries says, and leave the question pending for the ordinary spec flow.
  There is no Goals & Scope line to write.
- Record each confirmation as `references/modify-existing-baseline.md`
  § Where confirmations are recorded says for an answer with no host. The
  documents must end exactly as a 6.2 confirmation of the same answers on the
  same date would have left them; only the cells that section names differ.
- Fill `Last updated` as `references/modify-existing-baseline.md`
  § `Last updated` in `rules.md` says, with this change in place of the
  capture.
- A confirmation is not a fix: leave a deviation's debt row open, for
  finish-feature Step 3 to clear. Write nothing into a completed host, and add
  no Follow-up Tracking row.

## Check before the commit

Run each check. Fix what fails, or report it.

- Compare the selected questions with the actual staged and unstaged diff:
  every change traces to an answer. A path the questions name does not put
  every row of that file in scope.
- Check the capture's SPEC-ID, the question ids, the roles, the dates and where
  each answer landed against the commit message you will offer. No question
  still pending is shown as `active`.
- In each context this change touched, run the three core checks of
  `references/drift-verification.md` (BR-ID forward, anchor validity, BR-ID
  reverse). Run `dflow render` and read what it reports for the changed
  documents' remaining records. Run `dflow doctor` and handle what it reports
  for them.
- Check that the rules, scenarios, observations, deviations and debt agree.
  Every applied question's whole record and its candidate's Draft basis are
  gone, and the documents match what a 6.2 confirmation would have left except
  for the cells `references/modify-existing-baseline.md` § Where confirmations
  are recorded gives an answer with no host. List the answers not applied and
  the questions still pending.
- Run `dflow check-closeout --staged`; the project's CI may also run
  `--range <base>..<head>` on this branch. Never commit or merge around either.
  This change archives no host, so a range finds nothing to check; `--staged`
  may re-check a host the current `HEAD` archived, and that host still has to
  pass. Exit 0 says only that no archiving condition the CLI checks was broken:
  not that an answer was applied right, and not that anything is confirmed.
- Confirm that no completed host, no Checkpoint Log and no implementation file
  changed.

## The commit

Show the developer the diff and the questions still pending, then offer one
documentation commit under `dflow/specs/shared/_conventions.md` § AI Commit
Policy.

- It is a commit outside a Dflow workflow (`Git-principles-*.md` § 2): its
  subject follows the project's own convention, never `[{SPEC-ID}]` — this
  commit belongs to no host.
- Its message names the capture's SPEC-ID and each question id this change
  applied, removed or replaced, with who answered on which date, the answer and
  what it changed, as `references/modify-existing-baseline.md` § Deferred
  confirmation records says.
- When a check or the commit fails, keep the uncommitted work and what is still
  pending, and say what failed. Never report it done.
- A commit is not a merge: confirming a rule does not authorize a PR, a merge
  or a push.
