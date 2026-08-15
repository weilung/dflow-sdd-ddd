# Step 1.8: Hotfix T2 / T3 Post-Hoc — Greenfield Clean Architecture

Branch file of `references/modify-existing-flow.md`. It **adds** the
post-hoc-specific rules; it does not restate or override anything in that flow.

**You are here because** that flow's Step 1.8 dispatched you — it owns whether
this route applies, and what has already been decided by the time you arrive.

Sometimes an urgent fix is merged, pushed, and its branch cleaned up
**before** any Dflow ceremony runs. When you come back to record it,
declare **post-hoc mode** and reconcile rather than re-implement.

**Admission condition — T2 / T3 only.** This step builds a *minimal
(zero-phase)* host, so it admits only a post-hoc change Part A classified
**T2 or T3**. A **T1** post-hoc keeps the normal phase-bearing route
(`/dflow:new-phase` / `/dflow:new-feature`) and documents the merged work
there — it is not routed here, and giving it a zero-phase host would be wrong.
If you arrived here with a T1, go back to Part A's routing.

1. **Host-linkage choice first.** A post-hoc hotfix is **already merged on the
   mainline**, so no in-flight feature branch can host it: documenting it into
   an unmerged `feature/...` host would strand the production fix's record on a
   branch the mainline cannot see — possibly for weeks — and would let that
   feature's Integration Summary claim work it never did. The hotfix therefore
   always gets a host of its own, and the only question is whether that host is
   linked:
   - **A related completed feature** → run it as a **follow-up** (Step 1.6
     minimal variant — keep `follow-up-of` and its two reverse-link
     transitions). A hotfix on a completed feature filed as an unlinked
     standalone loses its lineage.
   - **Otherwise** → open a **standalone** minimal host (Step 1.7). "Otherwise"
     includes *a related feature that is still in flight* — see above for why
     it cannot be the host.

   Do not skip this choice. If a feature that was in flight turns out to have
   touched the same code, that is a **merge** question, settled when the
   branches actually meet — see `finish-feature-flow.md` Step 5.
2. **Reconcile, do not re-run.** The implementation already happened on the
   (now often deleted) hotfix branch. Do **not** reopen an implementation
   branch for it or redo the work. The documentation is recorded on **this
   host's own branch**, cut by change class at Step 1.7 step 4 (or at Step
   1.6's delegation to it) like any other minimal host — that branch *is* the
   **post-hoc branch** the rest of this step names, and the value `_index.md`
   `branch:` records.
3. **Implementation checkpoint Result = `reconciled ({merged-hotfix-hash})`.**
   In the host's Checkpoint Log the implementation row's Result is
   `reconciled (...)` — the value meaning "this checkpoint documents an
   already-merged change" — carrying the merged hotfix commit's hash. It sits
   alongside the usual `committed` / `skipped` / `failed` Results (see
   `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI
   Commits). That hash belongs to the **hotfix**, so it is **not** evidence
   that this host's own first commit landed — the documentation work still owes
   checkpoint 1 a real commit of its own (item 4), made **before** closeout.
   Committing the documentation together with closeout collapses the host to
   one commit and fails finish-feature Step 1.

   **You are asserting this hash, not deriving it.** Nothing in the repository
   records which commit was the hotfix, so no check in this flow can confirm
   it — finish-feature's reconciliation gate is explicit that it tests
   plausibility only. So state the identity
   and **cite what it rests on**: the PR, incident, or tracker reference that
   identifies this fix. Record the citation alongside the per-tier trace
   (item 4). An **uncited** hash blocks closeout —
   `references/pr-review-checklist.md` is what confirms the identity, and it
   needs something to confirm against.
4. **Per-tier trace.** A **T2** records the merged-hotfix branch in its
   lightweight-spec `hotfix-branch:` field; a **T3** marks its `_index.md`
   Lightweight Changes row Description as a hotfix (no new field, no T3 spec
   file). Item 3's identity citation goes in the same place — beside
   `hotfix-branch:` for a T2, in the row Description for a T3 — so the trace
   and the thing it rests on stay together. In **both** tiers the host's
   Lightweight Changes row carries a `Commit` value, and that value is the
   **post-hoc documentation commit**
   hash (the row is produced by the documentation work) — **not** the
   merged hotfix hash, which already lives in the `reconciled (...)` checkpoint
   above; the two have different provenance and must not be conflated. This
   row hash is what finish-feature Step 1 reads to prove the documentation
   commit exists separately from closeout, so fill it in as soon as that
   commit lands.
5. **Branch equality** for the host is asserted against the **post-hoc
   documentation branch** (the `_index.md` `branch:` value), never the deleted
   hotfix branch.
