# Step 6: Reverse-Update Follow-up Tracking — Greenfield Clean Architecture

Branch file of `references/finish-feature-flow.md`. It **adds** the follow-up
closing rules; it does not restate or override anything in that flow.

**You are here because** that flow's Step 6 dispatched you — it owns whether
this route applies.

For features that were created as follow-ups of an earlier completed
feature, update the Follow-up Tracking table of **every** original this host's
`follow-up-of` names — one parent, or several when the field is a YAML array.
For each of them:

1. Locate `dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
2. Find the Follow-up Tracking section's row for this feature's SPEC-ID
3. Flip Status → `completed`

```bash
# The AI makes the edit and may offer to commit it (Y / N), per the AI commit policy
```

This flip is a **sanctioned post-completion mutation, not a checkpoint** —
the follow-up host is already closed out and archived, so it is recorded in
**no** Checkpoint Log (neither this original feature's nor the follow-up
host's). It **must still be committed**, though: the flip is a real edit to
the original feature's `_index.md`. Require the tracking commit — the AI offers
it (Y / N); if the developer declines or the commit fails, **stop and do not
declare closeout complete** until the flip is committed. After it commits,
verify **per original** with
`git show HEAD:dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md`
that the Follow-up Tracking row now reads `completed` in the **committed** blob,
and that `git status --short` is clean. **Then check the commit itself, two ways
— neither replaces the other.**
**(1) Its full path set** (`git show --stat HEAD`) contains **only** the
`_index.md` of the originals this host's `follow-up-of` names: nothing under the
archived follow-up host — that would be a third host-mutating commit, which the
two-checkpoint lifecycle does not allow — and nothing else at all.
**(2) Its patch per original** (`git show HEAD -- {that path}`) carries **that
row's own transition** — the `in-progress` line removed, the `completed` line
added — and **no Checkpoint Log change**: this flip enters *neither* ledger, so
a Checkpoint Log row appearing in a parent is a violation even when the flip
itself is correct.
Why both: the blob proves the final state, not who wrote it — a commit that
merely edits other text in parent A while flipping parent B leaves both blobs
reading `completed` with the flips split across two commits — and the patch in
(2) is **path-filtered**, so it cannot see what else the commit touched. Only
(1) can. The commit message references the
follow-up host's SPEC-ID. Where there are several originals, flip them **in one
commit** — for a minimal follow-up host that keeps this the single post-closeout
tracking commit named in `modify-existing-flow.md` Step 1.6's minimal variant.

After the update:
> "Follow-up Tracking row updated to Status = `completed` in
> `{原 SPEC-ID}-{原 slug}/_index.md` (and every other original listed).
> Closeout complete."

The connection is bidirectional and weakly redundant: the new feature's
`follow-up-of` field is the authoritative source; the old feature's
Follow-up Tracking row is a derived index. If they ever disagree, trust
`follow-up-of`.
