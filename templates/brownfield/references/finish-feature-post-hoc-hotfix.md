# Post-Hoc Hotfix Reconciliation — Brownfield Progressive Extraction

Branch file of `references/finish-feature-flow.md`. It **adds** the
reconciliation rules; it does not restate or override anything in that flow.

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
  host and let it ride the normal checkpoints, then run the checklist below
  against the result. A phase-bearing host has no fixed commit count, so an
  extra checkpoint is ordinary.
- **A tracked delta (T3 or above), minimal (zero-phase) host** — it does
  **not** go into this host: the two-commit lifecycle has one implementation
  (or `spec-baseline`) checkpoint and one closeout, and every Lightweight
  Changes row must belong to that first commit. This host closes on what it
  already carries, and the delta is routed **after** Step 4 archives it — by
  Step 5's second bullet, the same route every post-closeout leftover takes.
  Do **not** route it now: you are mid-closeout, and routing would open a
  second host before this one is sealed. Note it, finish the closeout, then
  take Step 5's route — back through `/dflow:modify-existing`, which picks the
  host the way it always does. Do not decide that here: by then this feature
  is *completed*, so the normal completed-feature disambiguation applies and
  the answer may be a follow-up or a standalone host.

Classification decides, never "is it worth writing down". After closeout the
host is frozen — Step 5 says what is left over, and applies the same cascade.
