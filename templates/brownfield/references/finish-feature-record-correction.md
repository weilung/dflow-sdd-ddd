# Correcting Checkpoint 1's Own Record — Brownfield Progressive Extraction

Branch file of `references/finish-feature-minimal-host.md`. It **adds** the
repair for one case that file's working-tree check blocks; it does not restate
or override anything in that file.

**You are here because** that file's `nothing that constitutes the change
itself is still uncommitted` check blocked on a correction to checkpoint 1's
own record — it owns that judgement — or because
`references/modify-existing-post-hoc-hotfix.md` item 6 found that a post-hoc
record names a different fix.

The correction belongs in checkpoint 1 itself, and whether it can go there
depends on where checkpoint 1 stands now. Report the case that is true and give
the developer its repair:

- **Not pushed, and checkpoint 1 is `HEAD`** (`git rev-parse HEAD` prints
  checkpoint 1's hash) — first set every entry that holds checkpoint 1's hash
  back to what checkpoint 1 has (`git show HEAD:{path}`); the refill below
  writes them again. Then stage the correction alone (in `_index.md`, `git add
  -p` only its hunk: the Resume Pointer rides the closeout commit), check that
  `git diff --cached` shows nothing else, and `git commit --amend`. Then write
  the new hash into every entry that names checkpoint 1 — the Checkpoint Log
  `committed (...)` and each row's `Commit` cell. An entry left on the old hash
  fails hash evidence (b).
- **Not pushed, but a later commit sits on top of checkpoint 1** — stop:
  rewriting an earlier commit is the developer's to do.
- **Already pushed** — stop and leave it to the developer. Rewriting a pushed
  commit is the team's call (refill the entries as above if they do). The other
  way is to commit the correction on its own: add no Checkpoint Log row for it
  (a second row blocks), and ask for it to be named in the PR description — it
  departs from the two-commit lifecycle, and
  `references/pr-review-checklist.md`'s whole-history item sees it only when it
  touches this host's directory.

**A post-hoc host's `reconciled (...)`** names the hotfix, not checkpoint 1, so
refilling after an amend leaves it as it is — **unless the correction changes
which fix the record names** (`references/modify-existing-post-hoc-hotfix.md`
item 6, "The record names a different fix"). Then `reconciled (...)` names the
wrong fix too. Item 3 wrote it before checkpoint 1, so checkpoint 1 carries it:
correct it to the right fix's commit — the one item 3 says to record — as part
of the same correction, whichever way that lands (the amend, the developer's
rewrite, or the correction's own commit). Put that commit through item 6's test
before closeout continues; that item gives the repair if (b) fails for it as
well.
