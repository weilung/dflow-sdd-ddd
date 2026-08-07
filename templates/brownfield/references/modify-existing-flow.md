# Modify Existing Feature Workflow

Step-by-step guide for when a developer triggers `/dflow:modify-existing` or `/dflow:bug-fix` (or natural language implying a modification task — see AI-AGENT-GUIDE.md § Workflow Transparency for the auto-trigger safety net).

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 2 → Step 3 (baseline captured → analyze business logic embedded in delivery/entrypoint code: presentation/UI layer, controllers, handlers, jobs, message consumers, data pipelines, or stored procedures)
- Step 4 → Step 5 (extraction decision → start implementation)
- Step 5 → Step 6 (implementation done → update artifacts)

Crossing any step gate above also updates the host feature's `_index.md` Resume Pointer cursor (Active Workflow / Current Step / Gates Passed / Awaiting) once the host feature directory exists — fold it into that gate's existing `_index.md` / Resume Pointer edit, no separate ceremony (see the `_index.md` template's Resume Pointer notes).

All other step transitions are **step-internal**: announce "Step N complete, entering Step N+1" and proceed without waiting. See AI-AGENT-GUIDE.md § Workflow Transparency for the full transparency protocol and confirmation signals.

**Ceremony when triggered by `/dflow:bug-fix`**: the command does **not** set a tier — run the same ordered cascade as any other modification (Part A below). Most functional defects land **T2**, so the Lightweight Spec Template (`templates/lightweight-spec.md`) is the usual outcome, and Step 4 (extraction) may default to "defer and record in tech-debt.md" unless the bug itself is in extractable logic; T2 still generates a concise `Implementation Tasks` checklist (see Step 4). That is the usual landing, not a fixed set: the cascade also puts defects below T2 and above it, through any of its steps — not only via a Domain structural redesign. Let the cascade decide.

## Mindset

Modifying existing features is your best opportunity to progressively extract domain knowledge
and business logic. Treat every modification as a chance to:
1. Document what currently exists (if no spec exists yet)
2. Extract business logic from delivery/entrypoint code to Domain layer
3. Record tech debt for the target architecture

## Step 1: Assess the Change — Ceremony Tier + Feature Linkage

Before producing any spec prose, read `dflow/specs/shared/_conventions.md`
and apply the `## Prose Language` setting. If the setting is missing or not
an explicit language tag, ask the developer to update `_conventions.md`
before continuing. This requirement also applies when this flow is entered
through `/dflow:bug-fix`.

This step has two parallel concerns:

**Part A — Determine the Ceremony Tier (T1 / T2 / T3 / below workflow)**

The tier has **one source**: `AI-AGENT-GUIDE.md` § Ceremony Scaling — the
ordered cascade, steps 0–4, where **the first step that matches wins**. **Open
that section and classify from it before going further.** Do not classify from
memory, from this flow's step headings, or from a summary: the cases that
actually decide a tier — new work versus a modification, what stays below
workflow, how far a T3 may reach, inbound contracts, compound requests — are
settled there, and a second copy of those criteria here would be a second answer
to the same question.

Two of the cascade's outcomes leave this flow entirely: genuinely new work
(`/dflow:new-feature`) and a change Dflow does not track. Take those two exits as
the guide states them rather than continuing through the steps below.

**Tier-aware routing (don't run heavier ceremony than the tier needs):**

- **T3** → locate the host, then **skip the Domain / extraction work**: go to the
  branch gate, implement, and record the inline `_index.md` row. Do **not** create
  or update any spec file, and do **not** run the Step 2 Document-Current-Behavior
  baseline capture, the Step 3 delivery-layer analysis, or the Step 4
  Evaluate-Extraction-Opportunity step (a T3 produces no baseline / extraction /
  tech-debt entries unless the request is itself about them).
- **T2** → a lightweight-spec at the depth the change needs; run the
  behavior-capture / layer steps only where the change actually touches them.
- **Observation-only (tier-exempt, step 0)** → record the capture where it belongs
  (BC-layer `behavior.md`, `tech-debt.md`, the host's Resume Pointer) and stop
  there. When the baseline capture needs its own host (no active feature to attach
  it to), open a **baseline minimal host**: a related **completed** feature makes it
  a follow-up (Step 1.6 minimal variant), otherwise it is standalone (Step 1.7) —
  both are tier-exempt, cut `feature/{SPEC-ID}-{slug}`, and record a `Tier = baseline`
  row rather than a change. Do not invent a spec for it, and do not read the
  cascade's "below workflow" as permission to skip the record.
- **T1** → escalate to `/dflow:new-phase` (extending an active feature) or
  `/dflow:new-feature` (a truly new concern); full ceremony via that flow.

**Part B — Locate the Feature this Change Belongs To**

Walk through these in order to **classify** the change. Do **not** jump to
Step 1.5 / 1.7 mid-list: the in-flight overlap scan (item 4) and the hotfix
check below both run first, and the actual routing to Step 1.5 / 1.6 / 1.7 /
1.8 / Step 2 happens at this step's closing transition.

1. **Active features**: scan `dflow/specs/features/active/*/_index.md`. Does
   the change belong inside an existing active feature directory? If
   yes, use that as the host (T1 → `/dflow:new-phase`; T2 → place
   lightweight-spec inside; T3 → inline row in that `_index.md`).
   **Exception — a minimal (zero-phase) host that has already taken its
   implementation (or `spec-baseline`) checkpoint is not an eligible host.** A
   minimal host is fixed at two commits and **every** Lightweight Changes row
   must belong to the first one (Step 1.7), so once that checkpoint has landed
   it can accept nothing further, however well it fits. It does **not** become
   this change's host, and for the rest of this walk it does not count as one —
   keep scanning, and let the routing at this step's closing transition proceed
   as if it were not there. (Item 4 still surfaces it as an overlap; that is
   information for the developer, not a host.) **Before** that checkpoint lands
   the host is still open, and a compound request legitimately records more than
   one **T2 / T3** artifact under it ("minimal means zero-phase, not
   one-artifact", Step 1.7) — but **never a phase**: a minimal host is
   *defined* by carrying no `phase-spec-*`, so it is not an eligible host for a
   **T1** at any point, before or after that checkpoint. Keep scanning, exactly
   as above.
   **Exception — an already-merged T2 / T3 emergency fix** (the callout
   below): it is already on the mainline, so an in-flight host cannot hold
   it. It takes **Step 1.8** and gets a host of its own there, however well
   a related active feature seems to fit — Step 1.8 says why. A **T1**
   post-hoc is unaffected and uses this route normally.
2. **Completed features**: scan `dflow/specs/features/completed/*/_index.md`
   Goals & Scope sections. If the change description is semantically
   related to a completed feature, this is the **completed-feature-reopen**
   case (Step 1.5, routed to at the closing transition) — with **two
   exceptions that never reach the Step 1.5 A/B/C prompt**: a **T2 / T3**
   already-merged emergency fix documented after the fact takes **Step 1.8**
   (the callout below), and an **observation-only baseline capture** takes
   **Step 1.6** directly (Part A already routed it). This scan still runs for
   both — each needs to know whether a related completed feature exists in
   order to pick its own host (follow-up when one relates, standalone
   otherwise). (A **T1** post-hoc is not a Step 1.8 case at all and does reach
   Step 1.5 normally.)
3. **Standalone**: if no related feature exists (active or completed) that can
   host this change — a host item 1 ruled **ineligible** does not count as one —
   this is a new concern. For T1, use `/dflow:new-feature`. A standalone
   T2 / T3 needs a **minimal host feature directory** to hold the change —
   its open → record → close lifecycle is the **standalone** case (Step 1.7,
   routed to at the closing transition). Do not improvise a host and do not
   leave an empty one behind. (If a related active feature genuinely fits
   after all, use it as the host instead.)
   **Exception — an already-merged T2 / T3 emergency fix** (the callout
   below): finding nothing related does **not** make it an ordinary standalone.
   It still routes through **Step 1.8**, which picks standalone itself and
   supplies what this item cannot — the `reconciled (...)` checkpoint, the
   per-tier hotfix trace, and reconcile-instead-of-re-implement. Coming to
   Step 1.7 straight from here drops all of that. A **T1** post-hoc is
   unaffected and uses this route normally. An observation-only **baseline
   capture** with nothing related also reaches Step 1.7, but by **Part A's**
   observation-only routing, not by this item — it is tier-exempt, so this
   item's "standalone T2 / T3" wording does not describe it.
4. **In-flight overlap scan (cross-branch)**: this branch's `active/` is not
   everything in flight. Run the in-flight scan (classification and dedup
   rules in `AI-AGENT-GUIDE.md` § Status / Control Commands) — `git fetch`
   when the network allows, then
   `git branch --all --list '*feature/*' --list '*bugfix/*'` — and also list
   other unfinished features in this branch's `active/` (one cursor line
   each). If a scanned branch classified as in flight elsewhere, closed out
   awaiting integration, or unknown — or an unfinished feature — semantically
   overlaps this change, surface it and wait for the developer to decide
   before creating anything new (stale branches are non-blocking).
   **Exception — an already-merged T2 / T3 emergency fix** (the callout
   below): run the scan, but a surfaced overlap is **information, not a
   blocker**. The fix is already on the mainline, so no unmerged feature branch
   can host it (Step 1.8 says why) — there is no routing choice left to wait
   for. Report the overlap as notice that a merge reconciliation is coming
   (`finish-feature-flow.md` Step 5), then let Step 1.8 proceed: do not offer
   the in-flight feature as a host and do not hold host creation on it.
   Step 1.7's overlap scan states the same rule at the point of use. A **T1**
   post-hoc is unaffected and waits normally, and so does a **baseline
   capture** — an overlapping in-flight feature may well be the right place to
   attach the capture, which is precisely the decision this item asks for.

> **Why scan completed too?** Completed features are frozen history
> and **cannot accept** any T2 / T3 directly
> (would break the "completed = frozen" semantic). Reopen routes through
> a new follow-up feature instead — see Step 1.5, or Step 1.8 (**T2 / T3**
> post-hoc hotfix) / Step 1.6 (baseline capture), which reach the same
> follow-up host without the A/B/C prompt.

> **Already-merged emergency fix?** If this change was hotfixed to production
> **before** any Dflow ceremony ran and you are now documenting it after the
> fact, **the tier Part A decided routes it**:
> - **T2 / T3 post-hoc** → **Step 1.8** (post-hoc mode) rather than opening a
>   fresh host here — it picks the host linkage and reconciles instead of
>   re-implementing.
> - **T1 post-hoc** → **not** a minimal-host case. It keeps the normal
>   phase-bearing route (`/dflow:new-phase` or `/dflow:new-feature`, as Part A
>   says), documenting the merged work there. Step 1.8 does not admit it, and
>   a T1 must never be given a zero-phase host.
>
> Every pointer to Step 1.8 below carries this same T2 / T3 restriction.

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (classification {T1/T2/T3 / baseline (tier-exempt)} decided, host feature {SPEC-ID-slug / new / follow-up} identified). Entering Step 1.5 / 1.6 / 1.7 / 1.8 / Step 2 as appropriate." and continue. An observation-only **baseline** capture carries **no tier** — announce it as `baseline (tier-exempt)`, never as T1 / T2 / T3.

## Step 1.5: Completed-Feature Reopen Detection (only if Step 1 found a related completed feature — and this is a normal modification, not a T2 / T3 post-hoc hotfix or a baseline capture)

If Step 1 Part B identified a semantically related completed feature, AI
must explicitly disambiguate the user's intent **before** writing any
files. **Skip this step entirely for a T2 / T3 post-hoc hotfix (Step 1.8) or an
observation-only baseline capture (Part A routes it straight to Step 1.6)** —
each picks its own host without this prompt (follow-up when a completed
feature relates, standalone otherwise), and asking it anyway lets Option B
file a related hotfix or capture as an independent standalone, losing the
`follow-up-of` lineage and both reverse-link transitions. (A **T1** post-hoc
is a normal reopen and belongs in this prompt.)

```
"I notice this change overlaps with completed feature
`{SPEC-ID}-{slug}` (Goals & Scope: '{first 1-2 sentences}', completed on
{date}).

Is this a follow-up to that feature, or an independent new concern?

Option A — follow-up of `{SPEC-ID}-{slug}`
  → Build a new feature with a fresh SPEC-ID and `follow-up-of:
    {SPEC-ID}` link back to the original. A BC-bearing follow-up inherits
    its BR Snapshot baseline from the BC's rules.md; a no-BC follow-up
    inherits nothing (see Step 1.6).
Option B — independent new requirement
  → Route by the tier Part A already decided: T1 → run /dflow:new-feature
    normally; T2 / T3 → this is an independent standalone change, go to
    Step 1.7 (do NOT send a T2/T3 to new-feature — its intake would bounce
    it right back here). No link to the completed feature either way.
Option C — actually I think it's just a tiny lightweight tweak, no
            new feature needed
  → Refused. Completed features are frozen — even T3 inline rows must
    live in a new follow-up feature directory. (You can still pick A
    and have the new feature contain only one T3 row in _index.md if
    that fits the change.)"
```

**Wait for the developer's explicit choice (A / B / C).**

If A (follow-up): proceed to **Step 1.6: Create Follow-up Feature**.
If B (independent): route by tier — **T1** → `/dflow:new-feature` (this flow
ends); **T2 / T3** → Step 1.7 (standalone minimal host).
If C: gently re-explain (per decision 17) that completed features
cannot accept direct T2 / T3 writes; offer Option A (follow-up with
just a T3 inline row) as the lightweight equivalent.

## Step 1.6: Create Follow-up Feature (Step 1.5 Option A, a completed-only baseline capture, or the follow-up linkage chosen at Step 1.8)

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

## Step 1.7: Open a Standalone Minimal Host (no active feature hosts this change, and no completed feature is being taken as its follow-up)

A standalone T2 / T3 — one with no active host and no completed feature
taken as its follow-up — or a **baseline capture** with no related feature
(brownfield) — has no feature that will host it, yet the host-ledger
invariants (SPEC-ID, branch, Checkpoint Log, and the `_index.md` as the
authoritative record) still apply. Open a **minimal host**: a feature
directory that carries the change's lightweight artifacts — or one baseline
capture — and **never a phase-spec**. The lifecycle is
**open → record → close, two commits** (implementation — or baseline capture
— then closeout).

**"Minimal" means zero-phase, not one-artifact.** A compound standalone
request is split into its atomic changes, each run through the cascade, with
the **highest tier governing the host** and **each lower-tier part still
recording its own artifact under that same host** (`AI-AGENT-GUIDE.md`
§ Ceremony Scaling, Unit of classification). So one minimal host may carry a
T2 lightweight-spec **and** one or more T3 inline rows — that is the correct
shape, not a reason to open a second standalone host, and never a reason to
drop the T3 evidence. A **baseline capture** is the exception: it is
observation-only and carries its own capture alone.

**Open — do this here, before writing the change:**

1. **Confirm it is standalone.** The test is a **condition**, not a list of
   routes: *no active feature hosts this change, and no completed feature is
   being taken as its follow-up.* Whatever brought you here — Part B item 3
   (nothing related found), Step 1.5 **Option B** (a related completed feature
   the developer settled as an independent concern), Step 1.8's standalone
   linkage, Part A's observation-only routing for a baseline with no related
   feature, or a route added later — it belongs here exactly when that
   condition holds. If an **active** feature genuinely hosts this change, stop
   and record it there instead — do not open a redundant host. If a
   **completed** feature is the right home, that is a follow-up (Step 1.6),
   not a standalone. Do **not** re-run Step 1.5 to decide: an Option B arrival
   already answered there, and Part A (baseline) / Step 1.8 (post-hoc hotfix)
   each made the choice themselves.

   **Overlap scan.** For every arrival except a T2 / T3 post-hoc hotfix, an
   overlap the in-flight scan (Part B item 4) surfaced must be settled before
   you create anything. For a **post-hoc hotfix** the condition above holds even when a
   related feature is in flight — the fix is already merged on the mainline, so
   no unmerged feature branch can host it (Step 1.8 says why) — and a surfaced
   overlap is **information, not a blocker**: it tells the developer a merge
   reconciliation is coming (`finish-feature-flow.md` Step 5).
2. **Assign the identifiers** per `_conventions.md` § SPEC-ID Format
   (`SPEC-YYYYMMDD-NNN`). For a **functional bug**, also assign its
   **BUG-NUMBER** here (issue-tracker number, else `max+1` over the existing
   `BUG-*` across `dflow/specs/**`, active + completed). Collision-check
   **before creating anything** in step 3: no `active/` or `completed/`
   directory and no local or remote branch already carries this SPEC-ID (or
   BUG-NUMBER) or the branch name you will cut (stale branches are non-blocking
   but are never reused).

   **What a collision means depends on who owns the number.** A SPEC-ID, and a
   **locally allocated** `max+1` BUG-NUMBER, are this flow's to hand out — a
   collision is an allocation clash and nothing more, so re-assign the day
   counter (or take the next BUG-NUMBER) and re-check. A **tracker-owned**
   BUG-NUMBER is not: the issue tracker owns that identity, and renaming
   tracker issue 42 to `BUG-43` to dodge a collision silently severs the record
   from the issue it is about. **Never renumber a tracker-owned BUG-NUMBER.**
   A collision there is reporting something real — this work is already
   recorded, or a stale branch is still carrying it — and it is settled that
   way with the developer, as duplicate / existing work or branch-history
   cleanup. All identifiers are settled here, before the host exists.
3. **Create the minimal `_index.md`** from `templates/_index.md` at
   `dflow/specs/features/active/{SPEC-ID}-{slug}/_index.md`, carrying all
   **seven required sections** that template names — the Metadata front
   matter, Goals & Scope, Phase Specs, Current BR Snapshot, Lightweight
   Changes, Checkpoint Log, Resume Pointer. (`Follow-up Tracking` is the
   template's **optional** eighth section; a standalone host gets one only if
   it later grows follow-ups of its own.) "Minimal" means the sections are
   thin, not missing:
   - Metadata `status: in-progress`; `branch:` = the branch you cut in
     step 4. This field is **authoritative** — the branch gate and any
     lightweight-spec frontmatter read their branch from it.
   - Goals & Scope: one or two sentences. A standalone change need not touch
     a bounded context; if it does not, say so plainly in Goals & Scope
     rather than inventing one. (A baseline capture names the context it
     captures — that is a real BC, not `none`.)
   - Phase Specs: **leave the table empty** — a minimal host has no
     phase-spec.
   - Current BR Snapshot: fill it only if the change carries a BR delta; a
     no-BR / T3 host leaves it empty (finish-feature Step 1 reads an
     intentionally empty snapshot as a no-BR feature, not a validation
     failure).
   - Lightweight Changes, Checkpoint Log, Resume Pointer: start them; the
     record and the two checkpoints land here as you go.
4. **Branch gate — by change class.** A **functional bug** cuts
   `bugfix/BUG-{NUMBER}-{slug}`, using the BUG-NUMBER assigned and
   collision-checked in step 2. **Otherwise** — a standalone non-bug **T2 / T3**, or a **baseline
   capture** — cut `feature/{SPEC-ID}-{slug}`. The `_index.md` `branch:` field must equal the
   branch cut here. (See `references/git-integration.md` § Commit Checkpoints,
   Branch Gate & AI Commits.)

**Record + commit — rejoin the normal flow.** Follow this flow's tier-aware
routing (Part A): a **T2** writes its lightweight-spec (classic BR form or
the matching no-BR family variant — shapes are defined in
`templates/lightweight-spec.md`) and runs the Step 2–6 record **to the depth
Part A set** — that range names the route, not an instruction to run every item
in it. In particular a **no-BC** T2 — one whose host Goals & Scope says it
touches no bounded context — does not acquire one by walking Step 2: it does no
Domain-file work there (Step 2 carries the same guard at its own site), so
closeout's no-BC branch has nothing fictitious to skip past. A **T3** skips
the Domain / extraction work and records an inline row in `_index.md`
Lightweight Changes — **one row per atomic T3 change**, so a compound request
records each of them here (see "minimal means zero-phase, not one-artifact"
above). A **baseline capture** is observation-only: it records
the captured behaviour in the BC-layer documents and one `Tier = baseline`
row in `_index.md`, and its first checkpoint is named `spec-baseline` with
Result `committed` (never `implementation` — there is no implementation
work). Otherwise the **implementation commit is checkpoint 1** — the Step 5 →
Step 6 commit checkpoint records it in the Checkpoint Log. (For a **post-hoc**
host, Step 5 is skipped and checkpoint 1 is the **documentation** commit
instead; see Step 1.8 and Step 5's guard.)

**Every artifact gets a Lightweight Changes row, and every row is written
*before* checkpoint 1.** A **T3**'s row *is* its whole record; a **T2**'s row is
the outbound link to its lightweight-spec; a **baseline** capture's is its
`Tier = baseline` row — all three are rows, and closeout requires one per
artifact. Write them now, carrying the tier, the description and the
implementation paths (for a baseline, the BC-layer documents it captured). The
**only** part that may appear afterwards is the `Commit` cell, which cannot
exist until its commit does: closeout's allow-list admits that cell and no other
change **to the row**, so a row added after checkpoint 1 **blocks**. (The
allow-list separately admits the Checkpoint Log rows, the Resume Pointer and the
Current BR Snapshot — the finalization edits this step makes next.)

**Name the implementation paths in the artifact.** Closeout's evidence checks
assert that a commit *touches the implementation paths this change describes* —
which is only mechanical if the artifact actually declares them. So a **T2**'s
lightweight-spec names the source paths it changes, and a **T3**'s row
Description names them alongside its one-line description and tag. Paths, not a
diff — enough to compare a commit against. A **baseline capture** declares the
BC-layer documents it wrote instead; that is its counterpart. An artifact that
declares none leaves that check nothing to compare, and finish-feature treats a
missing declaration as a **block**, not a pass.

**Finalize + close.** Before `/dflow:finish-feature`, run the Step 6
completion checklist's minimal-host finalization. For **every** T2: set the
lightweight-spec `status: completed`, record its commit evidence, and advance
the Resume Pointer to the closeout-ready state. **Only when that T2 is
BC-bearing**, additionally refresh the host's Current BR Snapshot — a no-BC T2
has no snapshot to refresh, but still owes the commit evidence and the Resume
Pointer. A **T3** has no spec file — record its inline row's commit evidence
and advance the Resume Pointer. A **baseline capture** likewise has no spec
file — record its `Tier = baseline` row's commit evidence and advance the
Resume Pointer.

**Commit evidence goes to two surfaces, always — every row, every tier.** They
answer different questions, so filling one is never filling the other, and
finish-feature Step 1 reads both:

- **Checkpoint Log Result** — what happened at the *lifecycle checkpoint*.
- **Lightweight Changes row `Commit`** — the commit carrying *that row's own
  artifact*. Every row needs one; a blank cell fails closeout — **and so does a
  placeholder**. `{hash}`, `{pending}`, `（待 commit）`, anything
  `git cat-file -t` cannot resolve to a commit: it counts as **unfilled**, not
  as filled. Leave the cell empty until the hash exists.

The **mode** changes only *which hash* each surface carries:

- **Normal** (T2 or T3) — Checkpoint Log Result `committed ({hash})` and the
  row's `Commit` cell both name **checkpoint 1**, the single commit that
  carried the artifact and the implementation together. Two cells, one hash;
  fill both.
- **Post-hoc hotfix** (Step 1.8; T2 or T3) — the Checkpoint Log Result stays
  `reconciled ({merged-hotfix-hash})`, **never overwrite it**, while the row's
  `Commit` cell carries the **documentation** commit's hash. This is the one
  mode where the two values genuinely differ (Step 1.8 item 4).
- **Baseline capture** — the `spec-baseline` checkpoint's Result
  `committed ({hash})` and the `Tier = baseline` row's `Commit` cell both name
  that capture commit, the one that carried the BC-layer documents. Two cells,
  one hash; fill both.

**A declined checkpoint still owes its hash.** If the developer answered **N**
at the checkpoint-1 offer and made that commit themselves, the Checkpoint Log
row was written `skipped` honestly — the AI did not commit — but it is now
**incomplete, not final**: complete it here to `committed ({hash})` with the
developer's actual hash. **That completion is for a normal checkpoint 1** (or a
`spec-baseline` one). On a **post-hoc** host the Result stays
`reconciled ({merged-hotfix-hash})` — a declined documentation commit is
completed by filling each Lightweight Changes row's `Commit` cell once the
developer's commit lands, never by overwriting the reconciliation hash, which
records a different commit entirely. A row left reading `skipped` blocks closeout, and
finish-feature cannot tell "declined then committed" from "never committed" on
your behalf. The **closeout** row is the deliberate exception — it carries no
hash at all, because a commit cannot contain its own. Its **Result is still
read** afterwards — finish-feature's post-commit gate rejects `failed` there. A
declined closeout stays `skipped` because that value records the declined offer
honestly, not because the row goes unread.

In every case leave the host `status: in-progress` until closeout — do not flip
the host to `completed` early and do not invent a spec file for a T3. Then
`/dflow:finish-feature` performs the zero-phase closeout, and its **closeout
commit is checkpoint 2** — it includes the `git mv` archival. The two
checkpoints each record their own Checkpoint Log
row (implementation or baseline capture, then closeout); they are asserted
separately, never merged into one.

## Step 1.8: Hotfix T2 / T3 Post-Hoc (documenting an already-merged emergency change that Part A classified T2 or T3)

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

## Step 2: Document Current Behavior (if no spec exists)

This is critical. Before changing anything, capture what currently exists:

```
"Before we change this, let me help you document the current behavior.
This way we have a baseline and the change is traceable."
```

Create a spec with status `in-progress` that includes:
- Current behavior description
- Current business rules (extracted from delivery/entrypoint code)
- The proposed change clearly marked — use the **Delta** format below

> **No-BC guard — never manufacture a bounded context to satisfy this step.**
> The creations below apply only when the change actually touches one. A
> **no-BC** change — a standalone appearance sweep, say, whose host Goals &
> Scope states it touches no bounded context — records **N/A** here and moves
> on. Inventing a `{context}` it does not have plants fictitious Domain files
> that finish-feature's no-BC closeout branch **skips past rather than
> removes**, so they survive into the archive as permanent fiction. Same rule
> as Step 6.3's tier-conditional note: state the verdict, do not manufacture
> the artifact an item names.

If baseline domain docs are missing **for a change that does touch a bounded context**, create them from templates before filling content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`
- `dflow/specs/migration/tech-debt.md` (if missing) → `templates/tech-debt.md`

### Delta Spec Format (for modifications)

Use ADDED / MODIFIED / REMOVED / RENAMED + an optional UNCHANGED section. Keep Given/When/Then for each rule; the Delta section lives inside the spec and does not accumulate into `dflow/specs/domain/{context}/behavior.md` (git history already covers the trail).

```markdown
## Behavior Delta

### ADDED - BR / behavior added
#### Rule: BR-NN {規則名稱}
Given {狀態}
When {操作}
Then {新的預期結果}

### MODIFIED - BR / behavior modified
#### Rule: BR-NN {規則名稱}
**Before**: Given … When … Then {old result}
**After**: Given … When … Then {new result}
**Reason**: {why this change}

### REMOVED - BR removed
#### Rule: BR-NN {規則名稱}
**Reason**: {why removed}

### RENAMED - BR renamed
#### Rule: {old name} -> {new name}
**Reason**: {why renamed — e.g. terminology evolution / glossary alignment}

### UNCHANGED - explicitly unaffected (optional)
- BR-003 金額上限
- BR-005 提交後不可修改
```

**Section rules**:
- Use **ADDED / MODIFIED / REMOVED / RENAMED** for every behavioral change; skip a sub-section if it has no entries.
- `MODIFIED` must keep the "原本 / 改為" pair so reviewers see the before/after without guessing.
- `RENAMED` is only about naming (e.g., 「簽核」→「審批」). If the behavior also changed, split into RENAMED + MODIFIED entries.
- `UNCHANGED` is **recommended but optional**; fill it when regression risk is high or MODIFIED entries are many.
- Always pair with `## Reason for Change` (why this PR exists — ticket / stakeholder ask).

### Systematic Baseline Capture (when no prior spec exists)

When the feature being modified has no existing spec, take the opportunity to do a broader baseline capture — not just the single behavior being changed. Proactively:

1. Read the related presentation-layer or entrypoint-layer code (the modified entrypoint plus nearby entrypoints that share logic)
2. Extract all business rules found (if/else conditions, calculations, validations)
3. Identify domain concepts (potential Entities, Value Objects, Services)
4. Check for duplicated logic across pages
5. Record findings in the appropriate domain docs (`models.md`, `rules.md`) and `tech-debt.md`

This is an **opportunistic** strategy — "capture while we're already here." Do not force a full codebase scan; scope it to the modified feature and its immediate neighbors. Share what you find:

```
"Since there's no spec for this feature yet, I took a broader look at
the related delivery/entrypoint code. I found:
- 3 business rules in {entrypoint file} (documented in rules.md)
- Duplicated validation logic shared with {other entrypoint} (recorded in tech-debt.md)
- A potential Money value object hiding in the calculation at line {N}
This gives us a better baseline before we make our change."
```

**→ Step Gate: Step 2 → Step 3**

Announce to developer:
> "Baseline captured — current behavior is documented and the proposed change is marked. Ready to analyze the delivery/entrypoint layer to identify business logic and tech debt? `/dflow:next` or reply 'OK' to continue."

Wait for confirmation before entering Step 3.

## Step 3: Analyze the Delivery/Entrypoint Layer

Read the existing presentation-layer or entrypoint-layer code and identify:

### Business Logic to Extract
Look for:
- **Calculations** — anything with math, comparisons, or transformations
- **Validation rules** — any if/else that checks business conditions
- **State transitions** — status changes, approval flows
- **Data transformations** — converting between formats, currencies, units

### Tech Debt to Record
Look for:
- Direct SQL queries in delivery/entrypoint code
- Business logic duplicated across multiple pages
- Magic numbers (e.g., `if (status == 3)`)
- Delivery-framework runtime context storing business state (e.g., HTTP session/cookie, job runner state, CLI args)
- Try/catch blocks swallowing exceptions silently
- String concatenation for SQL (SQL injection risk)

Record each finding in `dflow/specs/migration/tech-debt.md` with:
```markdown
- [ ] {File}:{Line} — {Description} — Severity: {High|Medium|Low}
```

**→ Transition (step-internal)**: Step 3 complete. Announce "Step 3 complete (delivery/entrypoint layer analyzed, tech debt recorded). Entering Step 4: Evaluate Extraction Opportunity." and continue.

## Step 4: Evaluate Extraction Opportunity

For the code being modified, ask:

```
"The business logic for [X] is currently in {entrypoint file}.
Since we're already touching this code, should we extract it to
src/Domain/{Context}/? This would:
- Make it testable
- Make it reusable
- Make it ready for the target architecture"
```

Decision framework:
- **Extract now** if: the logic is being significantly modified anyway
- **Extract now** if: the logic is duplicated elsewhere and we need the single source of truth
- **Defer extraction** if: the change is a one-line fix and the surrounding code is too tangled
- **Consider not extracting at all** if: the context is `generic` (per the
  context-map Subdomain Type) — a commodity capability's endgame is wholesale
  replacement with an off-the-shelf package / service, so extracting its rules
  one by one is wasted effort; record the replacement intent as the tech-debt
  entry instead
- **Always record** the extraction opportunity in tech-debt.md even if deferring

If the target context has **no Subdomain Type** (not in `context-map.md`, or
the column is absent), ask the developer once to classify it. If they'd rather
not decide now, record it as an Open Question in the spec and run the
extraction decision on the framework above — do **not** assume `generic`.

**Aggregate emergence check.** Before extracting yet another rule onto an
existing concept, look at what has already accumulated on it (in `models.md` /
`rules.md`). The signal that it has stopped being a loose entity and is
becoming an **Aggregate Root with a consistency boundary**: **2+ non-trivial
state-transition rules on the same lifecycle identity, or any invariant that
must check / update multiple fields or child records atomically.** (A
*consistency boundary* means state that must hold or change **together,
atomically** — not mere relatedness: same screen, related nouns, or local
single-field input validation do **not** count.) When you see it, continuing
to extract rules one by one as T2 will leave the boundary undrawn — surface it
and **suggest escalating to T1** (`/dflow:new-phase` inside an active feature,
else `/dflow:new-feature`) to model the Aggregate deliberately: its invariants,
what must change atomically, what it protects. For *how* to model it —
invariant classification, set-based / uniqueness rules, aggregate sizing — read
`references/ddd-modeling-guide.md` (its **Edition note** maps each recording
surface to brownfield's `models.md` / `rules.md`). In `models.md`, **mark the
existing Entity row as the Aggregate Root and note the protected invariants /
atomic-change scope in its Responsibility / Notes** — brownfield `models.md`
has no separate Aggregates section, do not invent one; update the Repository
row if one exists. If the developer defers, **record the emergence observation
in `tech-debt.md`** so the boundary decision is not silently lost.

**Established-model re-read (the emergence check's mirror).** When the rule
you are extracting lands on an **already-modeled** Aggregate / concept,
re-read what was recorded when it was shaped (its `models.md` row + Notes
and the relevant `rules.md` entries) before extending it. If this change
matches a recorded re-evaluation condition ("revisit when …") or trips a
model-resistance signal, follow `references/ddd-modeling-guide.md`
§ "Revising an Established Model": record one short passage in the spec's
design decisions / open questions — proceed as-is, split, or rename, with
the reason. Deciding to keep the current model, recorded, is a valid
outcome; extending silently is not.

If the context is **`generic`** (Subdomain Type), emergence is usually a
*replacement / adapter-boundary* debt signal, not a cue for deep T1 modeling —
record the replacement intent (consistent with the generic extraction fallback
above) rather than escalating, unless the developer explicitly chooses to
model it.

### Generate Implementation Tasks List

For a phase-spec modification, AI generates a concrete task list and writes it into the spec's `Implementation Tasks` section using `[LAYER]-[NUMBER]：description` (DOMAIN / DELIVERY / DATA / TEST).

For a lightweight-spec (T2), AI still generates a concise `Implementation Tasks` checklist instead of skipping task generation.

If the lightweight checklist looks larger than a short-fix checklist, AI must pause and ask the developer whether to keep T2 or upgrade to T1. Do not auto-upgrade based on task count alone.

**→ Step Gate: Step 4 → Step 5**

Announce to developer:
> "Extraction decision made — {extract now / defer and record}. Ready to start implementation? `/dflow:next` to proceed, or adjust the extraction scope first."

> Branch gate (policy-aware): a feature branch is mandatory for every tier (T1 / T2 / T3) under both Git policies (`_conventions.md` § Git Policy). If you are already on this work's `feature/{SPEC-ID}-{slug}` (or `bugfix/{BUG-ID}-{slug}`) branch — e.g. the change belongs to the active feature you are already in — the gate is satisfied and nothing new is created. Otherwise (on the base branch the project cuts from, or an unrelated branch) the AI offers to create/switch to the correct branch, switch to an existing matching one, or override and record it in the `_index.md` Checkpoint Log. Dflow does not need to know which branch is your base. **Minimal-host exception (Step 1.6 follow-up variant / Step 1.7 standalone / Step 1.8 post-hoc): the override is not available.** Those hosts assert branch equality against the `_index.md` `branch:` value they cut by change class, so working them on an unrelated branch would falsify the host's own authoritative field — switch to the host's branch instead. See `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI Commits.

Wait for confirmation before entering Step 5.

## Step 5: Implement the Change

> **Post-hoc hotfix (Step 1.8) — skip this step.** The implementation already
> landed on the mainline before any ceremony ran; that is the whole premise of
> post-hoc mode, and Step 1.8 item 2 forbids redoing it. There is nothing to
> implement here. Go straight to the Step 5 → Step 6 gate and commit
> **documentation only** — the T2 spec or T3 row plus this host's `_index.md`,
> and no source. Re-implementing the fix on this branch would satisfy the letter
> of the checkpoint while breaking §8's reconciliation contract, which is why
> closeout inspects that commit's changed paths.

If extracting to Domain layer:

```csharp
// BEFORE (delivery/entrypoint code)
protected void Calculate()
{
    decimal amount = decimal.Parse(txtAmount.Text);
    decimal rate = GetExchangeRate(ddlCurrency.SelectedValue);
    decimal result = Math.Round(amount * rate, 0); // JPY has no decimals
    lblResult.Text = result.ToString("N0");
}

// AFTER (Domain layer)
// src/Domain/Expense/ValueObjects/Money.cs
public record Money(decimal Amount, Currency Currency)
{
    public Money ConvertTo(Currency target, ExchangeRate rate)
    {
        var converted = Amount * rate.Rate;
        return new Money(target.Round(converted), target);
    }
}

// Delivery/entrypoint code becomes thin:
protected void Calculate()
{
    var money = new Money(decimal.Parse(txtAmount.Text), selectedCurrency);
    var rate = _exchangeRateService.GetRate(selectedCurrency, Currency.TWD, reportDate);
    var result = money.ConvertTo(Currency.TWD, rate);
    lblResult.Text = result.Amount.ToString("N0");
}
```

**→ Step Gate: Step 5 → Step 6**

Announce to developer:
> "Implementation appears complete. Ready to update artifacts (spec, rules.md, models.md, glossary, tech-debt)? `/dflow:next` to proceed."

> Commit checkpoint (per `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI Commits): offer to commit, then record the result in the `_index.md` Checkpoint Log. Tier sets the count — T2 commits the merged spec+implementation here (closeout is the second checkpoint); T3 is a single implementation commit, and its `_index.md` rows ride along on the host's next commit (see `references/git-integration.md` § Commit checkpoints). **Minimal host exception (Step 1.7 standalone *and* the Step 1.6 follow-up variant)**: a minimal host has no later host commit for a T3 row to ride along on, so **the row rides checkpoint 1 itself** — write it into `_index.md` *before* this commit, alongside the implementation, because finish-feature Step 1 reads **checkpoint 1's committed `_index.md`** for it. Only what cannot exist until the commit does — the row's `Commit` cell and the Checkpoint Log Result — is backfilled later and rides the closeout commit. And a minimal host takes a second **closeout** checkpoint too: **every** minimal host records **two** checkpoints (implementation — or `spec-baseline` for a baseline — then closeout), for T3, T2, and baseline alike. **Post-hoc hotfix (Step 1.8) — the same two checkpoints, but the first carries no implementation**: the fix is already on the mainline, so checkpoint 1 is the **documentation** commit (spec / row + `_index.md`, no source), and its Checkpoint Log Result is `reconciled ({merged-hotfix-hash})` rather than `committed`. "Commits the merged spec+implementation" above describes a normal host and does **not** apply here.

Wait for confirmation before entering Step 6. This step gate is where the completion checklist is triggered — do not skip.

## Step 6: Update Artifacts

Triggered by the Step 5 → Step 6 Step Gate. AI runs the completion checklist in the order below; do **not** skip a section. `Implementation Tasks` checks apply to both `phase-spec.md` and `lightweight-spec.md` (T3 inline-only has no task section).

> **Tier-conditional (matches the Part A routing — the checklist must not undo it).** A **T3** produces no spec file and no Domain-document updates: for a T3, 6.1's spec and Domain items and all of 6.3 are **N/A** except the `_index.md` row — which is **already written** (Step 1.7 for a minimal host, at record time otherwise), so this checklist **re-verifies** it and never creates it — record them as N/A, and do not create a spec or a Domain file to make an item pass. A **baseline capture** is tier-exempt and likewise produces **no spec file**: 6.1's spec items and 6.3's spec item are **N/A** — do not create one to make an item pass. Its **Domain documents are not N/A**, but this checklist does not create them either: the capture wrote them before checkpoint 1, so here they are **re-verified**, exactly as a T3's row is. A **no-BR family T2** has a spec but no BR delta: its **BR-derived** items are N/A (6.1 says the same). "No BR delta" is **not** "no Domain delta" — decide each Domain document from the actual change, not from the BR line. A family (b) contract change that touches a documented behavior still updates `behavior.md`; a family (e) defect in an extracted model still updates `models.md` if the shape moved. "Do not skip a section" means work through every section and state each verdict — including N/A — not manufacture the artifact an item names.

### 6.1 Verification — AI runs independently

Items marked *(post-6.3)* are re-verified after the documentation merge in 6.3 lands:

- [ ] Every ADDED / MODIFIED / REMOVED / RENAMED entry in the Delta section is covered by implementation or tests
- [ ] **No-BR family evidence** — when the spec's Behavior Delta is a `BR:` / `BR Delta:` none line instead of delta entries, verify *that family's* evidence is present and substantive: (a) `Output Footprint`; (b) `Contract Delta` + `**Downstream consumers**`; (c) `Operational Rationale` + `**Trace**`; (d) `Performance Delta` + `**SLA / resource context**`; (e) `Governing BR-IDs` + root cause + a regression check; (f) `Change Rationale` with `**Before**` / `**After**` + `**Regression**`. For such a spec the **BR-derived** items in this checklist are **N/A** — say so explicitly rather than passing them on an empty delta set, and never add a BR or a `behavior.md` anchor just to make an item pass. Domain documents are **not** automatically N/A: judge each from the actual change (a family (b) contract change that touches a documented behavior still updates `behavior.md`). When a change matches more than one family (an operational refactor that also shifts SLA), **every** matching family's evidence must be present — one BR line, all matching evidence sections. A spec written in the classic BR-delta form, or a bug spec written with the older single `BR:` line, is accepted as-is
- [ ] Domain layer has **no** delivery-framework references (grep `src/Domain/`)
- [ ] Extracted logic (if Step 4 decided "extract now") lives under `src/Domain/` as framework-pure code
- [ ] `Implementation Tasks` section (`phase-spec.md` or `lightweight-spec.md`): all tasks checked, or unchecked items explicitly labelled as follow-up
- [ ] *(post-6.3)* `dflow/specs/domain/{context}/behavior.md` has a section anchor for every `BR-*` in ADDED / MODIFIED entries; REMOVED entries' anchors have been deleted (mechanical input for `/dflow:verify`)
- [ ] *(post-6.3)* every ADDED / MODIFIED / RENAMED BR's `Last updated` in `dflow/specs/domain/{context}/rules.md` is **not earlier than** this spec's `created` date (mechanical drift guard). ⚠ **Not earlier**, not *later*: `Last updated` is set to **today**, so a spec created and swept on the same day — the modal case for this tier — gives `Last updated == created`. Requiring *later* blocks it with no legitimate escape (post-dating the row fabricates a record). Same operator as `new-feature-flow.md` § 8.1; the two must not diverge.

If any item fails, report the gap and pause — don't proceed to 6.2.

### 6.2 Verification — needs developer confirmation

- [ ] Does the fix faithfully express the **intent** of the Delta entries? (AI lists delta → impl location; developer judges fit)
- [ ] Did we miss any tech debt worth recording during the Step 3 analysis pass?
- [ ] If extraction was deferred, is the tech-debt entry in `tech-debt.md` clear enough for a future picker?
- [ ] Do the scenarios merged into `behavior.md` faithfully express the Delta's final-state behavior? (AI lists updated anchors; developer judges)
- [ ] Should the `Implementation Tasks` section in the spec be collapsed / removed now that it's complete? (team convention — developer decides; applies to both phase-spec and lightweight-spec)

Ask these one-by-one.

### 6.3 Documentation updates

> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc's head).

- [ ] Update or create the feature / bug spec; set `status: completed` — **T3 and baseline: N/A** (no spec file exists; the `_index.md` inline row — a T3 row, or a `Tier = baseline` row — is the record, and the host's own status is not touched)
- [ ] The items below are the Domain sweep — **N/A for a T3**. For a **no-BC change** (one whose host Goals & Scope says it touches no bounded context) the **BC-scoped** items are N/A — everything under `dflow/specs/domain/{context}/`: there is no `{context}` to sweep, and inventing one plants the fiction Step 2's no-BC guard refuses. The **global** documents are *not* covered by that: `glossary.md` and `migration/tech-debt.md` belong to no bounded context, and a no-BC operational T2 can genuinely rename a term or discover migration debt — judge those two from the actual change, as always. For a no-BR family T2 only the *BR-derived* items are N/A; run each remaining item where this change actually touches that document
- [ ] `dflow/specs/domain/{context}/rules.md` — business rules updated
- [ ] `dflow/specs/domain/{context}/models.md` — domain model updated
- [ ] `dflow/specs/domain/glossary.md` — new / renamed terms (mirror any RENAMED delta entries here)
- [ ] `dflow/specs/domain/{context}/behavior.md` — update scenarios to reflect Delta result (merge final state, not Delta markup). Sub-steps:
      - Promote any Activity 3 (Spec Writing) draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the Delta was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/migration/tech-debt.md` — findings recorded

### 6.4 Archival

If this modification was a **T1 new-phase** within an existing active
feature, archival happens at the *feature* level, not the *phase* level —
do NOT move individual phase-spec files. Instead:

- [ ] Mark this phase-spec's `status` field `completed` in its frontmatter
- [ ] Keep the phase-spec inside its feature directory at
      `dflow/specs/features/active/{SPEC-ID}-{slug}/` (it stays alongside
      sibling phase-specs)
- [ ] When the developer is ready to wrap the whole feature, run
      `/dflow:finish-feature` — that command does the BC-layer sync,
      `git mv`s the **whole feature directory** to `completed/`, and
      emits an Integration Summary

If this modification was a **T2 lightweight** spec, archival is
similarly at the feature level — the lightweight-spec stays in the
feature directory and `_index.md`'s Lightweight Changes row references it. No
file move at this point. The whole feature directory moves to
`completed/` when the developer eventually runs `/dflow:finish-feature`.

If this modification was a **T3 inline-only** change, no spec file
exists — archival is just leaving the row in `_index.md` Lightweight Changes.

If the modification opened a **standalone minimal host** (Step 1.7) or a
**follow-up feature** (created via Step 1.6, including its minimal
variant), the same rule applies: this flow does not archive the host
directory — the closeout `git mv` happens at `/dflow:finish-feature` time
(checkpoint 2 of the two-checkpoint minimal-host lifecycle).

Only announce "change complete" after the appropriate archival step
above (or the Step 6.3 docs sweep) is done.
