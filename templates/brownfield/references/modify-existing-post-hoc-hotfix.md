# Step 1.8: Hotfix T2 / T3 Post-Hoc — Brownfield Progressive Extraction

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

   Make the choice here, and **act on it only after item 2's branch-base
   check**: on either route, nothing is opened, linked or cut before that
   check.

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

   **Branch-base check — run it before Step 1.7 step 3 creates anything**
   (on the follow-up route: before Step 1.6 opens the host and writes the
   reverse link). It settles which base branch this host's branch is cut
   from. Closeout requires the commit item 3 records to be an ancestor of
   this branch, so a branch cut from a base that does not contain that commit
   yet passes every step until closeout and is blocked there. Settle that
   commit with the developer first (item 3), then:
   1. Settle the base branch and fetch it. The developer decides which
      branch is the base — Dflow does not know it, though the project may
      record it under `_conventions.md` § Git Policy — and it is the branch
      Step 1.7 step 4 cuts from anyway. `{base-ref}` is that branch's latest
      ref (for example `origin/develop`). Fetch the remote it belongs to
      (`git fetch origin` for `origin/develop`; `git fetch --all` when
      unsure): a bare `git fetch` updates only the default remote, so a base
      on another remote stays stale and the steps below misjudge it. The fix
      is merged and pushed by now, and it often reached the base on the
      server — a PR merge or a squash — that this clone has not fetched yet.
   2. Run `git cat-file -t {hash}`. It must print `commit`. If it prints
      anything else or fails, and step 1's fetch failed, the commit may only
      be missing from this clone: stop, say the check needs the fetch, and
      run it again once the remote is reachable. Otherwise the hash is
      mistyped, names an object that is not a commit, or names a commit that
      remote does not have — stop and ask the developer. Do not guess.
   3. Run `git show --stat {hash}`. At least one path it lists must be an
      implementation path this record will declare. If none is, stop and
      settle the commit with the developer — closeout's (c) would block it.
      A last commit that touches only tests does this. Then run
      `git rev-list --parents -n 1 {hash}`: more than two hashes means a
      merge commit — for example the one a PR page shows as its merged
      commit. Item 3 never records one, and a merge usually passes the path
      check above, so stop here and settle the commit with the developer.
   4. Run `git merge-base --is-ancestor {hash} {base-ref}`:
      - **Exit `0`** — cut this host's branch from `{base-ref}` at Step 1.7
        step 4. Do **not** let the new branch track the base: run
        `git checkout -b {branch} --no-track {base-ref}`, or update the local
        base branch the way the project normally does and cut from that. A
        branch that tracks `origin/develop` can, under some push settings,
        push its documentation commits straight to `develop`.
      - **Exit `1`** — the fix is not in that base yet. Tell the developer
        both causes. **The fix has not been merged back yet**: merge it back
        first (under GitFlow, into `develop`). **The recorded commit is not
        the one item 3 names**: under a squash or rebase merge, or a
        cherry-pick into the base, the fix's own commits never reach it —
        record the commit the fix landed as (item 3).
        ⚠ Do **not** cut from `main` instead to make the check pass: the
        documentation branch would carry `main`'s merge commits into
        `develop` when it merges, and its documents would start from
        `main`'s older Domain documents and conflict there.
      - **Any other exit code** — a mistyped ref or a failed command. Stop
        and show the developer the output.
      - **If step 1's fetch failed** (offline): exit `0` is still
        trustworthy — the ref you cut from does contain the commit. Exit `1`
        may only mean the local ref is behind; treat it as provisional and
        say so.
3. **Implementation checkpoint Result = `reconciled ({merged-hotfix-hash})`.**
   In the host's Checkpoint Log the implementation row's Result is
   `reconciled (...)` — the value meaning "this checkpoint documents an
   already-merged change" — carrying the hash of **one of the fix's own
   commits**, or of **the commit the fix landed as** when it reached the base
   branch by a squash, a rebase or a cherry-pick — a commit on the base
   branch this host's branch is cut from (item 2).
   It sits alongside the usual `committed` / `skipped` / `failed` Results (see
   `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI
   Commits). That hash belongs to the **hotfix**, so it is **not** evidence
   that this host's own first commit landed — the documentation work still owes
   checkpoint 1 a real commit of its own (item 4), made **before** closeout.
   Committing the documentation together with closeout collapses the host to
   one commit and fails finish-feature Step 1.

   **Which commit that is depends on how the fix reached the base branch:**

   | The fix reached the base branch by | Record |
   |---|---|
   | a merge (under GitFlow, merging the hotfix branch back into `develop`) or a fast-forward | the last of **the fix's own commits** that touches a declared implementation path — never a merge commit, and under GitFlow never the tagged merge commit on `main`, which the back-merge does not bring into `develop` |
   | a squash merge | the squash commit on the base branch |
   | a rebase merge or a cherry-pick | the last of the fix's commits **as they landed on the base branch** that touches a declared implementation path |

   When the fix's own commits are on the base branch, record one of them even if
   a copy of the fix got there first. Closeout accepts a commit that touches only
   some of the declared paths: it asks for at least one. The hotfix branch's own
   name still goes in `hotfix-branch:` (item 4).

   **You are asserting this hash, not deriving it.** Nothing in the repository
   records which commit was the hotfix, so no check in this flow can confirm
   it — finish-feature's reconciliation gate is explicit that it tests
   plausibility only. So state the identity
   and **cite what it rests on**: the PR, incident, or tracker reference that
   identifies this fix. **Cite the source, not the hash** — a corrected hash
   (item 6) then never has to touch the citation. Record the citation
   alongside the per-tier trace
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
6. **Closeout: (b) fails on the `reconciled (...)` hash.**
   `references/finish-feature-minimal-host.md`'s `Minimal host, hotfix
   post-hoc only` check sends you here. Report which cause it is — never only
   "not an ancestor" — and give the developer the repair for that cause. First
   fetch the remote `{base-ref}` belongs to (item 2 step 1) and find the
   commit item 3 says to record, then test where it is. If the fetch fails, a
   result that depends on `{base-ref}`, or on a commit this clone does not
   have, is provisional — say so, as item 2 does:
   - **It is already on this branch** (`git merge-base --is-ancestor
     {its-hash} HEAD` exits `0`) — the record names the right fix but the
     wrong commit — for example the tagged merge commit on `main`. Correct
     only the Checkpoint Log hash. The citation (item 3 cites the source, not
     the hash), `hotfix-branch:` and the declared paths stay as they are, so
     the correction rides the closeout commit — closeout's closed list admits
     Checkpoint Log rows. Checkpoint 1 is not touched.
   - **It is on the base branch but not on this branch** (`git merge-base
     --is-ancestor {its-hash} {base-ref}` exits `0`) — this branch was cut
     before the fix reached the base, so correcting the hash is not enough.
     Merge `{base-ref}` into this branch — or, if nothing is pushed yet,
     rebase this branch onto it and refill every Lightweight Changes row's
     `Commit` cell — then record that commit. Set closeout's uncommitted
     finalization edits aside first with `git stash push --include-untracked`
     (a plain `git stash` leaves newly created files behind), check that
     `git status --porcelain` prints nothing, and restore them afterwards
     with `git stash pop`: `git rebase` refuses to run over uncommitted
     edits, and `git merge` refuses when the base changed the same files. If
     `git stash pop` reports a conflict — it can when the base changed the
     same part of a file those edits touch — resolve it before closeout
     continues.
   - **It is not on the base branch either** — the fix was never merged back.
     Merge it back first (under GitFlow, into `develop`), then take the case
     above.
   - ⚠ **Never merge `main` or the tag into this branch to make (b) pass.** It
     lets the wrongly recorded commit pass unchanged, and it carries `main`'s
     commits into `develop` when this branch merges.
   - **The record names a different fix** (the citation, the hotfix branch and
     the declared paths are all wrong) — checkpoint 1's own record is wrong,
     and closeout cannot repair that. Follow
     `references/finish-feature-record-correction.md`: it says when
     checkpoint 1 can be amended and when to stop for the developer, and it
     covers `reconciled (...)`, which names the wrong fix too.
