# Post-Hoc Hotfix Reconciliation — Brownfield Progressive Extraction

Branch file of `references/finish-feature-flow.md`. It **adds** the
reconciliation rules; it does not restate or override anything in that flow.

**Two different places in `references/finish-feature-flow.md` send you here, at
two different times. Read only the section that matches the one that sent you.**

- **Step 1's pre-checklist callout** — the branches met while this host was
  still open → § Before closeout.
- **Step 5** — Step 4 has already archived and committed this host → § After
  closeout.

## Before closeout

**You are here when** `references/finish-feature-flow.md` Step 1's hotfix
callout sent you — it states the condition; this file does not restate it.

**What you classify here is the merge-resolution delta, not the hotfix.** The
hotfix records itself in its **own** minimal host through Step 1.8 — follow-up
or standalone, never an in-flight feature — and that host is where
`reconciled ({merged-hotfix-hash})`, the identity citation and the per-tier
trace live. If the hotfix has not been documented yet, run Step 1.8 for it
first and come back; do **not** absorb it into this feature, whose ordinary
checkpoints would record none of that. What is left for this host is only what
*choosing between the two versions* changed. **Classify that by the cascade,
then record what the classification calls for:**

- **No tracked delta** — the cascade's **below workflow** level. It stays in
  the integration commit message; do **not** manufacture a row or a document.
  Nothing to validate, so nothing changes below. This is the common case.
- **A tracked delta (T3 or above), phase-bearing host** — record it in this
  host and let it ride the normal checkpoints, then run
  `references/finish-feature-flow.md` Step 1's checklist against the result. A
  phase-bearing host has no fixed commit count, so an extra checkpoint is
  ordinary.
- **A tracked delta (T3 or above), minimal (zero-phase) host** — it does
  **not** go into this host: the two-commit lifecycle has one implementation
  (or `spec-baseline`) checkpoint and one closeout, and every Lightweight
  Changes row must belong to that first commit. This host closes on what it
  already carries, and the delta is routed **after** Step 4 archives it — by
  the **A tracked delta (T3 or above)** bullet of § After closeout, the same
  route every post-closeout leftover takes.
  Do **not** route it now: you are mid-closeout, and routing would open a
  second host before this one is sealed. Note it, finish the closeout, then
  take § After closeout's route — back through `/dflow:modify-existing`, which
  picks the host the way it always does. Do not decide that here: by then this feature
  is *completed*, so the normal completed-feature disambiguation applies and
  the answer may be a follow-up or a standalone host.

Classification decides, never "is it worth writing down". After closeout the
host is frozen — § After closeout says what is left over, and applies the same
cascade.

## After closeout

**You are here when** `references/finish-feature-flow.md` Step 5 sent you.

**A mainline hotfix that overlapped this feature.** A T2 / T3 post-hoc hotfix
(`modify-existing-flow.md` Step 1.8) records itself in its own host, so when
this feature's branch finally meets the mainline both may have touched the same
code, and whoever merges picks between two existing versions. By the time you
read this, **Step 4 has already archived and committed this feature — its host
is frozen.** Classify whatever is left by the cascade (`AI-AGENT-GUIDE.md`
§ Ceremony Scaling), never by "is it worth writing down":

- **No conflict, or a resolution with no tracked delta** — it stays in the
  integration commit message. That is the cascade's **below workflow** level:
  do not manufacture a document, and do not reopen this feature.
- **A tracked delta (T3 or above)** — completed features are frozen, so it goes
  where every post-completion change goes: back through
  `/dflow:modify-existing`, which opens a follow-up or standalone host for it.
  Do **not** edit the archived `_index.md`.
- **The resolution moves system state** — if choosing between the two versions
  changes a business rule, a documented behaviour, or an extracted model, the
  owning document (`rules.md` / `behavior.md` / `models.md`) **must** be
  updated. That update is itself a tracked change and takes the route above;
  system-state truth is never below workflow.
- **It is bigger than a merge** — if resolving it means *new or changed*
  behaviour rather than choosing between two that already exist, it is not a
  merge question at all: run it through the cascade and open the flow its tier
  calls for.

**Reconciling before closeout is simpler.** If the branches meet while this
feature is still in flight — a rebase onto the mainline, say — handle it then
as ordinary in-flow work — but **which host takes it depends on this host's
shape**. A **phase-bearing** host absorbs a tracked delta (T3 or above) and
rides the normal checkpoints; a **minimal (zero-phase)** host **cannot** once
checkpoint 1 has landed, because every Lightweight Changes row must belong to
that commit — it closes on what it carries and the delta is routed afterwards.
No tracked delta stays below workflow, in the integration commit message.
§ Before closeout states that whole side in full, minimal-host branch
included. The four bullets above decide it whichever side of closeout you are on —
they are principles, not a checklist; the situation is rare and varied, so use
judgement.
