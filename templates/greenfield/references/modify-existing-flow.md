# Modify Existing Feature Workflow — Greenfield Clean Architecture

Step-by-step guide for changing or fixing existing functionality.

Triggered by `/dflow:modify-existing` or `/dflow:bug-fix` (or natural language implying a modification task — see AI-AGENT-GUIDE.md § Workflow Transparency for the auto-trigger safety net).

**Step Gates** in this flow (stop-and-confirm before proceeding):
- Step 2 → Step 3 (baseline captured → assess DDD impact)
- Step 3 → Step 4 (DDD impact decision → implement)
- Step 4 → Step 5 (implementation done → update documentation)

Crossing any step gate above also updates the host feature's `_index.md` Resume Pointer cursor (Active Workflow / Current Step / Gates Passed / Awaiting) once the host feature directory exists — fold it into that gate's existing `_index.md` / Resume Pointer edit, no separate ceremony (see the `_index.md` template's Resume Pointer notes).

All other step transitions are **step-internal**: announce "Step N complete, entering Step N+1" and proceed without waiting. See AI-AGENT-GUIDE.md § Workflow Transparency for the full transparency protocol and confirmation signals.

**Note on step count**: Greenfield edition has 5 steps (Brownfield has
6) because Clean Architecture's layered structure already separates
concerns — there's no delivery/entrypoint extraction step to perform.

**Ceremony when triggered by `/dflow:bug-fix`**: the command does **not** set a tier — run the same ordered cascade as any other modification (Part A below). Most functional defects land **T2**, so the Lightweight Spec Template (`templates/lightweight-spec.md`) is the usual outcome, and Step 3 may default to "no DDD impact, fix in place" unless the bug itself is in Domain logic; T2 still generates a concise `Implementation Tasks` checklist (see Step 3). That is the usual landing, not a fixed set: the cascade also puts defects below T2 and above it, through any of its steps — not only via a Domain structural redesign. Let the cascade decide.

## Step 1: Assess the Change — Ceremony Tier + Feature Linkage + Layer

Before producing any spec prose, read `dflow/specs/shared/_conventions.md`
and apply the `## Prose Language` setting. If the setting is missing or not
an explicit language tag, ask the developer to update `_conventions.md`
before continuing. This requirement also applies when this flow is entered
through `/dflow:bug-fix`.

This step has three parallel concerns:

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

- **T3** → still do Part B (host) and Part C (layer), then **skip the Domain /
  DDD-impact work**: go to the branch gate, implement, and record the inline
  `_index.md` row. Do **not** create or update any spec file, do **not** run the
  Step 2 baseline Domain-file check, and do **not** run the Step 2 → Step 3
  DDD-impact gate.
- **T2** → a lightweight-spec at the depth the change needs; run the Domain /
  layer steps only where the change actually touches them.
- **Observation-only (tier-exempt, cascade step 0)** → recording existing
  behaviour or a decision **without changing output** carries no tier. Capture
  it in the relevant Domain document (`models.md` / `rules.md` /
  `behavior.md` / `events.md` — greenfield carries `events.md` as a
  first-class Domain document, so an observation about an existing Domain Event
  lands there) and stop — do not read the cascade's "below
  workflow" as permission to skip the record. Greenfield has no
  baseline-capture host of its own (that hosted baseline flow is a Brownfield
  concern); a greenfield observation lands in the Domain docs that already
  exist.
- **T1** → escalate to `/dflow:new-phase` (extending an active feature) or
  `/dflow:new-feature` (a truly new concern); full ceremony via that flow.

**Part B — Locate the Feature this Change Belongs To**

Walk through these in order to **classify** the change. Do **not** jump to
Step 1.5 / 1.7 mid-list: the in-flight overlap scan (item 4) and the hotfix
check below both run first, and the actual routing to Step 1.5 / 1.7 / 1.8 /
Step 2 happens at this step's closing transition.

1. **Active features**: scan `dflow/specs/features/active/*/_index.md`. Does
   the change belong inside an existing active feature directory? If
   yes, use that as the host (T1 → `/dflow:new-phase`; T2 → place
   lightweight-spec inside; T3 → inline row in that `_index.md`).
   **Exception — a minimal (zero-phase) host that has already taken its
   implementation checkpoint is not an eligible host.** A minimal host is fixed
   at two commits and **every** Lightweight Changes row must belong to the first
   one (Step 1.7), so once that checkpoint has landed it can accept nothing
   further, however well it fits. It does **not** become this change's host, and
   for the rest of this walk it does not count as one — keep scanning, and let
   the routing at this step's closing transition proceed as if it were not
   there. (Item 4 still surfaces it as an overlap; that is information for the
   developer, not a host.) **Before** that checkpoint lands the host is still
   open, and a compound request legitimately records more than one **T2 / T3**
   artifact under it ("minimal means zero-phase, not one-artifact", Step 1.7) —
   but **never a phase**: a minimal host is *defined* by carrying no
   `phase-spec-*`, so it is not an eligible host for a **T1** at any point,
   before or after that checkpoint. Keep scanning, exactly as above.
   **Exception — an already-merged T2 / T3 emergency fix** (the callout
   below): it is already on the mainline, so an in-flight host cannot hold
   it. It takes **Step 1.8** and gets a host of its own there, however well
   a related active feature seems to fit — Step 1.8 says why. A **T1**
   post-hoc is unaffected and uses this route normally.
2. **Completed features**: scan `dflow/specs/features/completed/*/_index.md`
   Goals & Scope sections. If the change description is semantically
   related to a completed feature, this is the **completed-feature-reopen**
   case (Step 1.5, routed to at the closing transition) — **unless** this is a
   **T2 / T3** already-merged emergency fix you are documenting after the fact.
   That one never reaches the Step 1.5 A/B/C prompt: it takes **Step 1.8** (the
   callout below), which picks its own host — follow-up or standalone — itself.
   This scan still runs for it: Step 1.8 needs to know whether a related
   completed feature exists. (A **T1** post-hoc is not a Step 1.8 case at all
   and does reach Step 1.5 normally.)
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
   unaffected and uses this route normally.
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
   post-hoc is unaffected and waits normally.

> **Why scan completed too?** Completed features are frozen history
> and **cannot accept** any T2 / T3 directly
> (would break the "completed = frozen" semantic). Reopen routes through
> a new follow-up feature instead — see Step 1.5, or Step 1.8 when the
> reopen is a **T2 / T3** post-hoc hotfix (it reaches the same follow-up host
> without the A/B/C prompt).

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

**Part C — Identify the Affected Layer (Clean Architecture)**

This still matters for picking the right fix location:
- Domain invariant broken → Domain fix
- Application orchestration issue → Application fix
- Infrastructure bug (DB, external service) → Infrastructure fix
- API contract change → Presentation fix (the tier comes from the cascade's contract axis, not from "behaviour changed" — classify in the guide, as Part A says)

**→ Transition (step-internal)**: Step 1 complete. Announce "Step 1 complete (tier {T1/T2/T3} decided, host feature {SPEC-ID-slug / new / follow-up} identified, layer {Domain/Application/Infrastructure/Presentation}). Entering Step 1.5 / 1.7 / 1.8 / Step 2 as appropriate." and continue.

## Step 1.5: Completed-Feature Reopen Detection (only if Step 1 found a related completed feature — and this is a normal modification, not a T2 / T3 post-hoc hotfix)

If Step 1 Part B identified a semantically related completed feature, AI
must explicitly disambiguate the user's intent **before** writing any
files. **Skip this step entirely for a T2 / T3 post-hoc hotfix** — Step 1.8
picks its own host (follow-up or standalone) without this prompt, and asking it
anyway lets Option B file a related hotfix as an independent standalone, losing
the `follow-up-of` lineage and both reverse-link transitions. (A **T1**
post-hoc is a normal reopen and belongs in this prompt.)

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

## Step 1.6: Create Follow-up Feature (Step 1.5 Option A, or the follow-up linkage chosen at Step 1.8)

**Open `references/modify-existing-follow-up.md` and follow it there.** This
step's rules live in that file and are not repeated here.


## Step 1.7: Open a Standalone Minimal Host (no active feature hosts this change, and no completed feature is being taken as its follow-up)

A standalone T2 / T3 — one with no active host and no completed feature
taken as its follow-up — has no feature that will host it, yet the
host-ledger invariants — SPEC-ID, branch, Checkpoint Log, and the
`_index.md` as the authoritative record — still apply. Open a **minimal
host**: a feature directory that carries the change's lightweight
artifacts and **never a phase-spec**. The lifecycle is
**open → record → close, two commits** (implementation, then closeout).

**"Minimal" means zero-phase, not one-artifact.** A compound standalone
request is split into its atomic changes, each run through the cascade, with
the **highest tier governing the host** and **each lower-tier part still
recording its own artifact under that same host** (`AI-AGENT-GUIDE.md`
§ Ceremony Scaling, Unit of classification). So one minimal host may carry a
T2 lightweight-spec **and** one or more T3 inline rows — that is the correct
shape, not a reason to open a second standalone host, and never a reason to
drop the T3 evidence.

**Open — do this here, before writing the change:**

1. **Confirm it is standalone.** The test is a **condition**, not a list of
   routes: *no active feature hosts this change, and no completed feature is
   being taken as its follow-up.* Whatever brought you here — Part B item 3
   (nothing related found), Step 1.5 **Option B** (a related completed feature
   the developer settled as an independent concern), Step 1.8's standalone
   linkage, or a route added later — it belongs here exactly when that
   condition holds. If an **active** feature genuinely hosts this change, stop
   and record it there instead — do not open a redundant host. If a
   **completed** feature is the right home, that is a follow-up (Step 1.6),
   not a standalone. Do **not** re-run Step 1.5 to decide: an Option B arrival
   already answered there, and Step 1.8 made its choice itself.

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
   - Goals & Scope: one or two sentences. A standalone change need not
     touch a bounded context; if it does not, say so plainly in Goals &
     Scope rather than inventing one.
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
   collision-checked in step 2. **Otherwise** — a standalone non-bug **T2 / T3** — cut
   `feature/{SPEC-ID}-{slug}`. The
   `_index.md` `branch:` field must equal the branch cut here. (See
   `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI
   Commits.)

**Record + commit — rejoin the normal flow.** Follow this flow's
tier-aware routing (Part A): a **T2** writes its lightweight-spec (classic
BR form or the matching no-BR family variant — shapes are defined in
`templates/lightweight-spec.md`) and runs the Step 2–5 record **to the depth
Part A set** — that range names the route, not an instruction to run every item
in it. In particular a **no-BC** T2 — one whose host Goals & Scope says it
touches no bounded context — does not acquire one by walking Step 2: it does no
Domain-file work there (Step 2 carries the same guard at its own site), so
closeout's no-BC branch has nothing fictitious to skip past. A **T3**
skips the Domain / DDD-impact work and records an inline row in
`_index.md` Lightweight Changes — **one row per atomic T3 change**, so a
compound request records each of them here (see "minimal means zero-phase,
not one-artifact" above). The **implementation commit is checkpoint
1** — the Step 4 → Step 5 commit checkpoint records it in the Checkpoint
Log. (For a **post-hoc** host, Step 4 is skipped and checkpoint 1 is the
**documentation** commit instead; see Step 1.8 and Step 4's guard.)

**Every artifact gets a Lightweight Changes row, and every row is written
*before* checkpoint 1.** A **T3**'s row *is* its whole record; a **T2**'s row is
the outbound link to its lightweight-spec — both are rows, and closeout requires
one per artifact. Write them now, carrying the tier, the description and the
implementation paths. The **only** part that may appear afterwards is the
`Commit` cell, which cannot exist until its commit does: closeout's allow-list
admits that cell and no other change **to the row**, so a row added after
checkpoint 1 **blocks**. (The allow-list separately admits the Checkpoint Log
rows, the Resume Pointer and the Current BR Snapshot — the finalization edits
this step makes next.)

**Name the implementation paths in the artifact.** Closeout's evidence checks
assert that a commit *touches the implementation paths this change describes* —
which is only mechanical if the artifact actually declares them. So a **T2**'s
lightweight-spec names the source paths it changes, and a **T3**'s row
Description names them alongside its one-line description and tag. Paths, not a
diff — enough to compare a commit against. An artifact that declares none
leaves that check nothing to compare, and finish-feature treats a missing
declaration as a **block**, not a pass.

**Finalize + close.** Before `/dflow:finish-feature`, run the Step 5
completion checklist's minimal-host finalization. For **every** T2: set the
lightweight-spec `status: completed`, record its commit evidence, and advance
the Resume Pointer to the closeout-ready state. **Only when that T2 is
BC-bearing**, additionally refresh the host's Current BR Snapshot — a no-BC T2
has no snapshot to refresh, but still owes the commit evidence and the Resume
Pointer. A **T3** has no spec file — record its inline row's commit evidence
and advance the Resume Pointer.

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

**A declined checkpoint still owes its hash.** If the developer answered **N**
at the checkpoint-1 offer and made that commit themselves, the Checkpoint Log
row was written `skipped` honestly — the AI did not commit — but it is now
**incomplete, not final**: complete it here to `committed ({hash})` with the
developer's actual hash. **That completion is for a normal checkpoint 1.** On a
**post-hoc** host the Result stays
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

In every case leave the host `status: in-progress` until
closeout — do not flip the host to `completed` early and do not invent a spec
file for a T3. Then `/dflow:finish-feature` performs the zero-phase closeout,
and its **closeout commit is checkpoint 2** — it includes the `git mv`
archival. The two checkpoints each record their own Checkpoint Log row
(implementation, then closeout); they are asserted separately, never merged
into one.

## Step 1.8: Hotfix T2 / T3 Post-Hoc (documenting an already-merged emergency change that Part A classified T2 or T3)

**Open `references/modify-existing-post-hoc-hotfix.md` and follow it there.**
This step's rules live in that file and are not repeated here.

⚠ Do not record a post-hoc hotfix from this heading alone. That file carries the
host-linkage choice, the `reconciled ({merged-hotfix-hash})` checkpoint Result,
the identity citation an **uncited** hash blocks closeout for, and the per-tier
hotfix trace. Reconstructed from this heading, post-hoc mode collapses into
re-implementing a fix that is already on the mainline — which Step 4's guard
forbids and closeout inspects that checkpoint's changed paths for.

## Step 2: Check Documentation

- Spec in `dflow/specs/features/completed/`?
- Domain model in `dflow/specs/domain/{context}/models.md`?
- Business rules in `rules.md`?
- Domain events in `events.md`?

If no documentation exists, capture current behavior BEFORE changing — use the **Delta** format below.

> **No-BC guard — never manufacture a bounded context to satisfy this step.**
> The creations below apply only when the change actually touches one. A
> **no-BC** change — a standalone appearance sweep, say, whose host Goals &
> Scope states it touches no bounded context — records **N/A** here and moves
> on. Inventing a `{context}` it does not have plants fictitious Domain files
> that finish-feature's no-BC closeout branch **skips past rather than
> removes**, so they survive into the archive as permanent fiction. Same rule
> as Step 5.3's tier-conditional note: state the verdict, do not manufacture
> the artifact an item names.

If baseline domain docs are missing **for a change that does touch a bounded context**, create them from templates before filling content:
- `dflow/specs/domain/glossary.md` → `templates/glossary.md`
- `dflow/specs/domain/{context}/models.md` → `templates/models.md`
- `dflow/specs/domain/{context}/rules.md` → `templates/rules.md`
- `dflow/specs/domain/{context}/behavior.md` → `templates/behavior.md`
- `dflow/specs/domain/{context}/events.md` → `templates/events.md`
- `dflow/specs/domain/context-map.md` (when cross-context mapping is needed) → `templates/context-map.md`
- `dflow/specs/architecture/tech-debt.md` (if missing) → `templates/tech-debt.md`

### Delta Spec Format (for modifications)

Use ADDED / MODIFIED / REMOVED / RENAMED + an optional UNCHANGED section. Keep Given/When/Then for each rule; the Delta section lives inside the spec and does not accumulate into `dflow/specs/domain/{context}/behavior.md` (git history already covers the trail).

```markdown
## Behavior Delta

### ADDED - BR / behavior added
#### Rule: BR-NN {規則名稱}
Given {Aggregate 初始狀態}
When {呼叫的 Command 或 Aggregate 方法}
Then {新的 Aggregate 狀態}
And {產生的 Domain Event}

### MODIFIED - BR / behavior modified
#### Rule: BR-NN {規則名稱}
**Before**: Given … When … Then {old result} / {old event}
**After**: Given … When … Then {new result} / {new event}
**Reason**: {why this change}

### REMOVED - BR removed
#### Rule: BR-NN {規則名稱}
**Reason**: {why removed}

### RENAMED - BR renamed
#### Rule: {old name} -> {new name}
**Reason**: {why renamed — e.g. terminology evolution / Aggregate split / glossary alignment}

### UNCHANGED - explicitly unaffected (optional)
- BR-003 金額上限
- BR-005 提交後不可修改
```

**Section rules**:
- Use **ADDED / MODIFIED / REMOVED / RENAMED** for every behavioral change; skip a sub-section if it has no entries.
- `MODIFIED` must keep the "原本 / 改為" pair so reviewers see the before/after without guessing.
- `RENAMED` is only about naming (e.g., 「簽核」→「審批」、「Order → CustomerOrder」). If the behavior also changed, split into RENAMED + MODIFIED entries.
- `UNCHANGED` is **recommended but optional**; fill it when regression risk is high or MODIFIED entries are many.
- Always pair with `## Reason for Change` (why this PR exists — ticket / stakeholder ask).
- For Aggregate state transitions and Domain Events, include them in the Given/When/Then — this is how `/dflow:pr-review` Step 0 understands the intent.

**→ Step Gate: Step 2 → Step 3**

Announce to developer:
> "Baseline captured — existing documentation reviewed, current behavior is documented and the proposed change is marked. Ready to assess the DDD impact (Aggregate design, Domain Events, Value Objects)? `/dflow:next` or reply 'OK' to continue."

Wait for confirmation before entering Step 3.

## Step 3: Assess DDD Impact

### Is the Aggregate design still correct?

Changes that require Aggregate redesign:
- New invariant that spans objects currently in different Aggregates
- Performance issue from too-large Aggregate
- Concurrency conflict from too-large Aggregate
- Business rule that now crosses Aggregate boundary

```
"This change affects [invariant]. Does the current Aggregate
boundary still make sense, or do we need to split/merge?"
```

**Established-model re-read.** When the change extends an existing
Aggregate, re-read that Aggregate's recorded Design Decisions — its
`aggregate-design.md` worksheet in the feature directory that introduced it
(usually under `features/completed/`). If this change matches a recorded
re-evaluation condition ("revisit when …") or trips a model-resistance
signal, follow `references/ddd-modeling-guide.md` § "Revising an
Established Model": record one short passage in the spec's Design
Decisions / Open Questions — proceed as-is, split, or rename, with the
reason. Deciding to keep the current model, recorded, is a valid outcome;
extending silently is not.

### Do we need new Domain Events?

If the behavior change means other parts of the system need to react differently:
- Add new events
- Modify event payloads (careful: backward compatibility)
- Add new event handlers

### Are Value Objects still valid?

If constraints change:
- Update Value Object validation
- Check all usages of the Value Object

### Generate Implementation Tasks List

For a phase-spec modification, AI generates a concrete task list and writes it into the spec's `Implementation Tasks` section using `[LAYER]-[NUMBER]：description` (DOMAIN / APP / INFRA / API / TEST).

For a lightweight-spec (T2), AI still generates a concise `Implementation Tasks` checklist instead of skipping task generation.

If the lightweight checklist looks larger than a short-fix checklist, AI must pause and ask the developer whether to keep T2 or upgrade to T1. Do not auto-upgrade based on task count alone.

**→ Step Gate: Step 3 → Step 4**

Announce to developer:
> "DDD impact analysis done — {Aggregate boundary OK / needs redesign}, {no new events / new events needed}. Ready to implement? `/dflow:next` to proceed, or adjust the design first."

> Branch gate (policy-aware): a feature branch is mandatory for every tier (T1 / T2 / T3) under both Git policies (`_conventions.md` § Git Policy). If you are already on this work's `feature/{SPEC-ID}-{slug}` (or `bugfix/{BUG-ID}-{slug}`) branch — e.g. the change belongs to the active feature you are already in — the gate is satisfied and nothing new is created. Otherwise (on the base branch the project cuts from, or an unrelated branch) the AI offers to create/switch to the correct branch, switch to an existing matching one, or override and record it in the `_index.md` Checkpoint Log. Dflow does not need to know which branch is your base. **Minimal-host exception (Step 1.6 follow-up variant / Step 1.7 standalone / Step 1.8 post-hoc): the override is not available.** Those hosts assert branch equality against the `_index.md` `branch:` value they cut by change class, so working them on an unrelated branch would falsify the host's own authoritative field — switch to the host's branch instead. See `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI Commits.

Wait for confirmation before entering Step 4.

## Step 4: Implement

> **Post-hoc hotfix (Step 1.8) — skip this step.** The implementation already
> landed on the mainline before any ceremony ran; that is the whole premise of
> post-hoc mode, and Step 1.8 item 2 forbids redoing it. There is nothing to
> implement here. Go straight to the Step 4 → Step 5 gate and commit
> **documentation only** — the T2 spec or T3 row plus this host's `_index.md`,
> and no source. Re-implementing the fix on this branch would satisfy the letter
> of the checkpoint while breaking §8's reconciliation contract, which is why
> closeout inspects that commit's changed paths.

Follow the layer order: Domain → Application → Infrastructure → Presentation.

Even for bug fixes, verify:
- [ ] Fix is in the correct layer
- [ ] Aggregate invariants still hold
- [ ] Domain Events still fire correctly
- [ ] Tests updated to cover the fix
- [ ] No business logic leaked to wrong layer

**→ Step Gate: Step 4 → Step 5**

Announce to developer:
> "Implementation appears complete. Ready to update documentation (spec, models.md, rules.md, events.md, glossary, tech-debt)? `/dflow:next` to proceed."

> Commit checkpoint (per `references/git-integration.md` § Commit Checkpoints, Branch Gate & AI Commits): offer to commit, then record the result in the `_index.md` Checkpoint Log. Tier sets the count — T2 commits the merged spec+implementation here (closeout is the second checkpoint); T3 is a single implementation commit, and its `_index.md` rows ride along on the host's next commit (see `references/git-integration.md` § Commit checkpoints). **Minimal host exception (Step 1.7 standalone *and* the Step 1.6 follow-up variant)**: a minimal host has no later host commit for a T3 row to ride along on, so **the row rides checkpoint 1 itself** — write it into `_index.md` *before* this commit, alongside the implementation, because finish-feature Step 1 reads **checkpoint 1's committed `_index.md`** for it. Only what cannot exist until the commit does — the row's `Commit` cell and the Checkpoint Log Result — is backfilled later and rides the closeout commit. And a minimal host takes a second **closeout** checkpoint too: **every** minimal host records **two** checkpoints (implementation, then closeout), for T3 as well as T2. **Post-hoc hotfix (Step 1.8) — the same two checkpoints, but the first carries no implementation**: the fix is already on the mainline, so checkpoint 1 is the **documentation** commit (spec / row + `_index.md`, no source), and its Checkpoint Log Result is `reconciled ({merged-hotfix-hash})` rather than `committed`. "Commits the merged spec+implementation" above describes a normal host and does **not** apply here.

Wait for confirmation before entering Step 5. This step gate is where the completion checklist is triggered — do not skip.

## Step 5: Update Documentation

Triggered by the Step 4 → Step 5 Step Gate. AI runs the completion checklist in the order below; do **not** skip a section. `Implementation Tasks` checks apply to both `phase-spec.md` and `lightweight-spec.md` (T3 inline-only has no task section).

> **Tier-conditional (matches the Part A routing — the checklist must not undo it).** A **T3** produces no spec file and no Domain-document updates: for a T3, 5.1's spec and Domain items and all of 5.3 are **N/A** except the `_index.md` row — which is **already written** (Step 1.7 for a minimal host, at record time otherwise), so this checklist **re-verifies** it and never creates it — record them as N/A, and do not create a spec or a Domain file to make an item pass. A **no-BR family T2** has a spec but no BR delta: its **BR-derived** items are N/A (5.1 says the same). "No BR delta" is **not** "no Domain delta" — decide each Domain document from the actual change, not from the BR line. A family (b) contract change that adds an event field still updates `events.md`; a family (e) defect in an Aggregate still updates `models.md` if the shape moved. "Do not skip a section" means work through every section and state each verdict — including N/A — not manufacture the artifact an item names.

### 5.1 Verification — AI runs independently

Items marked *(post-5.3)* are re-verified after the documentation merge in 5.3 lands:

- [ ] Every ADDED / MODIFIED / REMOVED / RENAMED entry in the Delta section is covered by implementation or tests
- [ ] **No-BR family evidence** — when the spec's Behavior Delta is a `BR:` / `BR Delta:` none line instead of delta entries, verify *that family's* evidence is present and substantive: (a) `Output Footprint`; (b) `Contract Delta` + `**Downstream consumers**`; (c) `Operational Rationale` + `**Trace**`; (d) `Performance Delta` + `**SLA / resource context**`; (e) `Governing BR-IDs` + root cause + a regression check; (f) `Change Rationale` with `**Before**` / `**After**` + `**Regression**`. For such a spec the **BR-derived** items in this checklist are **N/A** — say so explicitly rather than passing them on an empty delta set, and never add a BR or a `behavior.md` anchor just to make an item pass. Domain documents are **not** automatically N/A: judge each from the actual change (a family (b) event-field addition still updates `events.md`). When a change matches more than one family (an operational refactor that also shifts SLA), **every** matching family's evidence must be present — one BR line, all matching evidence sections. A spec written in the classic BR-delta form, or a bug spec written with the older single `BR:` line, is accepted as-is
- [ ] The fix is in the correct layer (Domain / Application / Infrastructure / Presentation)
- [ ] Domain layer/package has **no** external package-manager dependencies beyond the language/runtime baseline
- [ ] Aggregate invariants still hold; state changes go through methods
- [ ] Any new / changed Domain Events are raised in the implementation
- [ ] ORM / persistence mapping is kept outside Domain entities (no persistence attributes/annotations on Domain entities)
- [ ] `Implementation Tasks` section (`phase-spec.md` or `lightweight-spec.md`): all tasks checked, or unchecked items explicitly labelled as follow-up
- [ ] *(post-5.3)* `dflow/specs/domain/{context}/behavior.md` has a section anchor for every `BR-*` in ADDED / MODIFIED entries; REMOVED entries' anchors have been deleted (mechanical input for `/dflow:verify`)
- [ ] *(post-5.3)* every ADDED / MODIFIED / RENAMED BR's `Last updated` in `dflow/specs/domain/{context}/rules.md` is **not earlier than** this spec's `created` date (mechanical drift guard). ⚠ **Not earlier**, not *later*: `Last updated` is set to **today**, so a spec created and swept on the same day — the modal case for this tier — gives `Last updated == created`. Requiring *later* blocks it with no legitimate escape (post-dating the row fabricates a record). Same operator as `new-feature-flow.md` § 8.1; the two must not diverge.

If any item fails, report the gap and pause — don't proceed to 5.2.

### 5.2 Verification — needs developer confirmation

- [ ] Does the fix faithfully express the **intent** of the Delta entries? (AI lists delta → impl location; developer judges fit)
- [ ] Is the Aggregate boundary still correct after this change (especially for MODIFIED / RENAMED entries)?
- [ ] Are Domain Event payloads and handler placements still correct?
- [ ] Did we miss any tech debt worth recording?
- [ ] Do the scenarios merged into `behavior.md` (incl. Aggregate transitions + Events) faithfully express the Delta's final-state behavior? (AI lists updated anchors; developer judges)
- [ ] Should the `Implementation Tasks` section in the spec be collapsed / removed now that it's complete? (team convention — developer decides; applies to both phase-spec and lightweight-spec)

Ask these one-by-one.

### 5.3 Documentation updates

> **Table-cell formatting**: keep table cells concise — separate multiple short items with `<br>` (never chain them into one line with ；/; separators), and move long narrative detail out of the cell into a document section (full convention: the formatting comment at each spec doc's head).

- [ ] Update or create the feature / bug spec; set `status: completed` — **T3: N/A** (no spec file exists; the `_index.md` inline row is the record, and the host's own status is not touched)
- [ ] The items below are the Domain sweep — **N/A for a T3**. For a **no-BC change** (one whose host Goals & Scope says it touches no bounded context) the **BC-scoped** items are N/A — everything under `dflow/specs/domain/{context}/` plus `context-map.md`: there is no `{context}` to sweep, and inventing one plants the fiction Step 2's no-BC guard refuses. The **global** documents are *not* covered by that: `glossary.md` and `architecture/tech-debt.md` belong to no bounded context, and a no-BC operational T2 can genuinely rename a term or discover architecture debt — judge those two from the actual change, as always. For a no-BR family T2 only the *BR-derived* items are N/A; run each remaining item where this change actually touches that document (an added event field still lands in `events.md`)
- [ ] `dflow/specs/domain/{context}/models.md` — Aggregate structure updates
- [ ] `dflow/specs/domain/{context}/rules.md` — business rule updates
- [ ] `dflow/specs/domain/{context}/events.md` — Domain Event updates
- [ ] `dflow/specs/domain/glossary.md` — new / renamed terms (mirror any RENAMED delta entries here)
- [ ] `dflow/specs/domain/{context}/behavior.md` — update scenarios to reflect Delta result (merge final state, not Delta markup). Sub-steps:
      - Promote any Activity 3 (Spec Writing) draft sections (from B3 mid-sync) to formal sections
      - Update the corresponding `rules.md` anchor's `last-updated` date (B4)
- [ ] `behavior.md` draft cleanup — if the Delta was abandoned mid-way, keep the `## 提案中變更` section's history or explicitly REMOVE it
- [ ] `dflow/specs/domain/context-map.md` — updated if cross-context interaction changed
- [ ] `dflow/specs/architecture/tech-debt.md` — findings recorded

### 5.4 Archival

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
above (or the Step 5.3 docs sweep) is done.
