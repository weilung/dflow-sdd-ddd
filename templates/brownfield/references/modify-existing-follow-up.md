# Step 1.6: Create Follow-up Feature — Brownfield Progressive Extraction

Branch file of `references/modify-existing-flow.md`. It **adds** the
follow-up-specific rules; it does not restate or override anything in that flow.

**You are here because** that flow's Step 1.6 dispatched you — it owns whether
this route applies, and what has already been decided by the time you arrive.

Build the follow-up feature using the same machinery as
`/dflow:new-feature` (see `new-feature-flow.md` Steps 3.5 and 4), with
these follow-up-specific differences. **Use the tier Part A already decided.**
This is the same change Part A classified, and re-running the cascade on it can
return a second answer to one question. Re-enter Part A **only** when the
Step 1.5 A/B/C discussion materially changed the scope (work added or dropped);
say so explicitly when you do, and let that re-run **replace** the earlier tier
rather than stand beside it. On that tier: a **T1** follow-up
takes the full new-feature machinery below; a **T2 / T3** follow-up — or a
**baseline capture**, which is **tier-exempt** (observation-only, no cascade
tier, and reaches here via Part A's observation-only routing rather than the
Step 1.5 A/B/C prompt) — takes the **minimal (zero-phase) variant** described
after the reverse-link step, which does **not** delegate new-feature Step 4's
unconditional first phase-spec. A **post-hoc hotfix** whose host linkage
Step 1.8 resolved to *follow-up* also arrives here (likewise without the
Step 1.5 prompt, and always T2 / T3, so always the minimal variant); its
first checkpoint keeps the `implementation` name but carries Result
`reconciled (...)` per Step 1.8.

- **New SPEC-ID** (today's date sequence — do NOT reuse the original
  SPEC-ID): e.g. original `SPEC-20260201-003-訂單折扣` → follow-up
  `SPEC-20260424-002-訂單折扣-匯率擴充` (or any new slug)
- **New slug**: not required to equal the original slug; pick whatever
  best describes the follow-up scope
- **`_index.md` Metadata**: `follow-up-of: {原 SPEC-ID}` is REQUIRED
  (uncomment the optional line in the template; can be a YAML array if
  the follow-up spans multiple originals)
- **`_index.md` Goals & Scope** auto-prepended note:
  ```
  > 本 feature 為 `{原 SPEC-ID}-{原 slug}` 的 follow-up，原 feature
  > 完成於 `{date}`，詳見 `completed/{原 SPEC-ID}-{原 slug}/_index.md`。
  ```
- **`_index.md` Current BR Snapshot baseline** (**BC-bearing follow-up only**):
  if the follow-up touches a bounded context, AI reads the BC's
  `dflow/specs/domain/{context}/rules.md` and inherits the BRs that are
  in-scope for this follow-up. Mark each inherited row with First Seen
  = `inherited from rules.md` and Last Updated = (empty until the new
  feature's first phase Delta — or, for a minimal follow-up, its
  lightweight-spec's delta — touches it). For a **no-BC follow-up** (the
  minimal variant on a completed no-BC host), leave the Current BR Snapshot
  **empty** — do not read or fabricate a BC's `rules.md`.
  **A baseline capture is the other exception**, and it names a real bounded
  context, so state it rather than leaving it to the BC-bearing rule: a
  completed-only baseline host is tier-exempt and observation-only — it carries
  no BR delta, and the capture may be the very thing that creates that BC's
  `rules.md`. Leave its Current BR Snapshot **empty**, exactly as the
  no-feature baseline route does (Step 1.7 step 3, "fill it only if the change
  carries a BR delta"). The capture writes the BC layer directly, so the host's
  snapshot is not its record and closeout has nothing to sync. **Both baseline
  routes behave identically here** — lineage decides the host shape, never the
  snapshot policy.

**Reverse-link into the old `_index.md`**: AI also updates
`dflow/specs/features/completed/{原 SPEC-ID}-{原 slug}/_index.md` —
uncomment the Follow-up Tracking section (if not already present) and
add a row. When `follow-up-of` names **more than one** original (it may be a
YAML array), do this in **every** one of them; a parent left without its row
never gets the `absent → in-progress → completed` transition the contract
requires, and on a **minimal** follow-up host finish-feature Step 1 blocks
closeout on it (that check is scoped "Minimal host (zero-phase), follow-up
only" and proves the *opening* half; on a phase-bearing follow-up Step 6 still
flips and verifies the closing half, but nothing checks that the row was ever
opened as `in-progress`):

```
| {新 SPEC-ID} | {新 slug} | {today} | in-progress |
```

This update is **part of the same change set** as opening the host. For a
**T1** follow-up the AI may offer to commit the new host and this initial
`absent → in-progress` reverse-link together (commit message should mention
"Add follow-up reference to `{新 SPEC-ID}`"). For the **minimal (T2 / T3, or
baseline) variant** the AI does **not** offer a separate host-open commit — the
initial reverse-link edit rides along in the first host checkpoint
(implementation, or `spec-baseline` for a baseline follow-up; see the variant
paragraph below), keeping the follow-up at exactly two host checkpoints. The reverse link is a derived index — the new feature's
`follow-up-of` field is the authoritative source.

After a **T1** follow-up feature is set up, this flow hands off to the
`/dflow:new-phase` flow (or stays in this flow at Step 2 for the first
phase's content).

**Minimal (zero-phase) follow-up variant (T2 / T3 / baseline).** When the
follow-up change is itself lightweight — or is an observation-only **baseline
capture**, which is tier-exempt rather than lightweight and reaches this
variant from Step 1.6's opening paragraph — do **not** delegate new-feature
Step 4 (which would create an unconditional first phase-spec). Instead treat
the follow-up host exactly like a standalone minimal host — open it via
**Step 1.7's
mechanics, steps 2–4 only** (assign identifiers + collision check, create the
minimal `_index.md` with an empty Phase Specs table, branch gate **by change
class**: `bugfix/BUG-{NUMBER}-{slug}` for a functional bug,
`feature/{SPEC-ID}-{slug}` otherwise — this **overrides** new-feature's
hardcoded `feature/` branch). Step 1.7's **step 1 does not apply**: it is the
standalone-classification gate, and this caller has already been classified as
a follow-up. Everything Step 1.7 states **after** step 4 *does* apply
unchanged — every artifact's row written before checkpoint 1, the
implementation-path declaration, tier-aware "Finalize + close", and the two
commit-evidence surfaces — because finish-feature reads for all of it on a
follow-up host exactly as on a standalone one. Then record the change's
artifacts — a T2 lightweight-spec, one
or more T3 inline rows, or both for a compound follow-up (Step 1.7's "minimal
means zero-phase, not one-artifact") — or, for a **completed-only baseline
capture**, record it per Step 1.7's baseline mechanics (the `spec-baseline`
checkpoint and a `Tier = baseline` row) — and close with
`/dflow:finish-feature`. The lifecycle is **two host checkpoints**
(implementation — or `spec-baseline` for a baseline follow-up — then closeout)
**plus one post-closeout reverse-link flip tracking commit** — the flip (the original feature's Follow-up Tracking row
`in-progress → completed`, done by `/dflow:finish-feature` Step 6) is a
**sanctioned post-completion mutation, not a host checkpoint**, and is
recorded in **neither** the follow-up host's Checkpoint Log **nor** the
original feature's. Option C of Step 1.5 ("a follow-up containing only one
T3 row") lands here.
