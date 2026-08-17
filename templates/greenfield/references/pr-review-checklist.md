# PR Review Checklist — Greenfield Clean Architecture

`/dflow:pr-review` enters this checklist starting from **Step 0**. Do not skip Step 0 — reviewing code without first understanding spec intent breaks the SDD feedback loop (all the upstream spec work loses its verification mechanism).

## Step 0: Understand the Change Intent (before code review)

Ground yourself in the spec *before* looking at the diff. A feature
directory may contain multiple spec files; identify which ones this PR
touches and read them all.

- [ ] Locate the feature directory at
      `dflow/specs/features/active/{SPEC-ID}-{slug}/` (or
      `dflow/specs/features/completed/{SPEC-ID}-{slug}/` if the PR is the
      closeout commit and the dir was already `git mv`d)
- [ ] Read `_index.md` first — it gives you the feature-level overview,
      Current BR Snapshot, list of phase-specs, and Resume Pointer (where the
      author left off)
- [ ] Identify which **phase-spec(s)** and / or **lightweight-spec(s)**
      this PR diff touches. There may be:
      - A new phase-spec being introduced (T1) — read in full,
        including Aggregate state transitions and Domain Events
      - An existing phase-spec being marked `completed` — verify its
        Delta-from-prior-phases section reads correctly relative to the
        prior phase
      - A new lightweight-spec (T2) — read in full
      - Just T3 inline rows added to `_index.md` Lightweight Changes (no
        spec file changed) — confirm the row description is precise
- [ ] If a `Behavior Delta` / Delta-from-prior-phases section exists,
      read **ADDED / MODIFIED / REMOVED / RENAMED** — pay attention to
      any Aggregate state transitions and Domain Events listed in the
      Delta; note any **UNCHANGED** scope declaration
- [ ] State in one sentence: "This PR intends to {change} because
      {reason}." (If you can't, pause and ask the author.)
- [ ] Cross-reference `dflow/specs/domain/{context}/behavior.md` if it exists
      — confirm the Delta has been reflected or is scheduled to be
      (draft vs finalized; finalisation usually happens at
      `/dflow:finish-feature` time)
- [ ] Only then proceed to the code-review sections below

If the PR has no spec or no `_index.md`:
```
"I don't see a feature directory or _index.md for this PR. Before I
review the code, can you point me to the host feature? SDD relies on
the recorded change being the review anchor.

If this change belongs to a feature that already exists, run
/dflow:modify-existing or /dflow:bug-fix against it — the cascade
decides what gets recorded (a T2 lands a lightweight spec; a T3 lands
one inline row in that feature's _index.md and no spec file). If it is
genuinely new work, run /dflow:new-feature.

If no feature exists to host it at all, that is the standalone case and
it has a defined route: /dflow:modify-existing opens a minimal
(zero-phase) host for it — Step 1.7, or Step 1.6's minimal variant when
the change is a follow-up on a completed feature. Send it there rather
than inventing a home by hand."
```

## Spec Compliance

Per-feature checks:
- [ ] **Feature directory exists** with `_index.md` + at least one
      phase-spec (or one lightweight-spec for a T2-only feature).
      **Exception — a host whose whole record is inline.** A **T3-only**
      minimal host has no spec file by design: a T3 never produces one.
      What it must have instead is at least one `_index.md` Lightweight
      Changes row. Check for that, and do **not** ask the author to add a
      spec to satisfy this line — that manufactures the artifact the tier
      forbids and the flow refuses to write.
- [ ] **`_index.md` Current BR Snapshot is up to date** — reflects
      the cumulative effect of all phase-specs / lightweight-specs in
      the directory
- [ ] **`_index.md` Phase Specs table** — every row's referenced
      phase-spec file exists and its `status` matches the row's claim
- [ ] **For follow-up features**: `_index.md` Metadata has `follow-up-of:
      {原 SPEC-ID}` AND the original feature's `_index.md`
      Follow-up Tracking row references this feature. **`follow-up-of` may
      be a YAML array** — when it names several originals, *each* of them
      must carry the row; checking the first one is not checking the field.

Per-phase-spec / lightweight-spec checks (run for **each** spec file the
PR touches, not just one):
- [ ] Spec matches code
- [ ] Implementation matches Given/When/Then scenarios (including
      Aggregate state transitions and Domain Events)
- [ ] All business rules (BR-*) in this spec implemented
- [ ] Edge cases (EC-*) in this spec handled
- [ ] **No-BR family evidence** — for a lightweight-spec whose Behavior
      Delta is a `BR:` / `BR Delta:` none line, check that family's
      evidence instead: (a) `Output Footprint`; (b) `Contract Delta` +
      `**Downstream consumers**`; (c) `Operational Rationale` +
      `**Trace**`; (d) `Performance Delta` + `**SLA / resource
      context**`; (e) `Governing BR-IDs` + root cause + a regression
      check; (f) `Change Rationale` with `**Before**` / `**After**` +
      `**Regression**`. The BR / scenario / Domain items above are
      **N/A** for these specs — record them as N/A rather than passing
      them on an empty rule set, and never fabricate a BR or a
      `behavior.md` anchor to make one pass. Domain documents are not
      automatically N/A: an added event field still belongs in
      `events.md`. A spec in the
      classic BR-delta form, or a bug spec with the older single `BR:`
      line, is accepted as-is. A change matching more than one family
      must carry **every** matching family's evidence, not just the one
      its BR line names
- [ ] **Delta integrity** (phase 2+ only) — the Delta-from-prior-phases
      section's ADDED / MODIFIED / REMOVED / RENAMED entries actually
      match the diff against the prior phase-spec's BR set

If the closeout commit is in this PR (`/dflow:finish-feature` was run):
- [ ] **BC layer sync landed** — `dflow/specs/domain/{context}/rules.md` /
      `behavior.md` / `events.md` / `context-map.md` reflect the
      feature's net effect (compare against `_index.md` Current BR
      Snapshot). **N/A for a no-BC host** — one whose Goals & Scope
      declares no bounded context has nothing to sync, and a `{context}`
      document invented to satisfy this line is a fiction, never a pass.
      ⚠ **Do not read that as "closeout already blocks it" without qualifying
      where.** Closeout blocks it in the commits it actually reads — checkpoint
      1, and only on a **minimal** host, plus the closeout commit on any host.
      A fiction committed by a **phase-bearing** no-BC host anywhere in between
      passes every closeout check. That range is the *"A no-BC host committed no
      BC-scoped Domain material"* item in the delegated block below, and it is
      yours to run. **N/A for a T3**, which does no Domain work at all.
      Record the N/A rather than ticking it against an empty comparison — but
      note `glossary.md` and the tech-debt file belong to no bounded context
      and stay in a no-BC host's sweep, so this N/A does not reach them.
- [ ] **Whole feature directory `git mv`'d** to `completed/` — git
      shows `renamed:` (not `deleted:` + `new file:`)
- [ ] **Integration Summary** was emitted to the conversation (not
      written to a file — it's ephemeral)
- [ ] **Every Lightweight Changes row now carries a `Commit` hash.**
      Before closeout an empty cell can be legitimate: on a **hosted** row
      the cell is filled by the host's *next* commit, and closeout is
      allowed to be that commit. (A **minimal** host is stricter — its rows
      are written before checkpoint 1, and closeout already refuses an empty
      cell there.) After closeout there is no next commit, so an empty cell
      will never be filled. That is why closeout does not assert this for a
      phase-bearing host, and why it is checkable here.
      ⚠ **A placeholder is not a hash.** `{hash}`, `{pending}`, `（待 commit）` —
      anything that is not a resolvable commit — counts as **unfilled**, not as
      carrying one. It is the harder case to catch precisely because the cell is
      **non-empty**: every rule downstream is written against empty / non-empty,
      so a placeholder reads as filled to all of them. Resolve each value
      (`git cat-file -t {value}`) rather than checking the cell is populated.

**Delegated to review by `finish-feature-flow.md`.** Closeout states at each
of these sites that it does *not* prove them. They are not optional extras:
skip one and the boundary is a hole rather than a division of labour.

- [ ] **Whole history — no stray host-open commit.** Closeout validates the
      hashes the record names and cannot see the rest of the branch. List
      this branch's commits that touch the host directory:
      `git log --oneline {base}..HEAD -- 'dflow/specs/features/active/{SPEC-ID}-{slug}/' 'dflow/specs/features/completed/{SPEC-ID}-{slug}/'`
      For a **minimal (zero-phase) host** there must be exactly two —
      checkpoint 1 and closeout. A third, typically a host opened in its own
      commit before the work landed, breaks the two-commit lifecycle while
      every closeout check still passes, because those read only the hashes
      the record points at. **This count applies to a minimal host only**: a
      phase-bearing feature has no fixed number of host commits, so there is
      nothing to count there and this item is N/A.
      This is also where closeout's minimal-host **selector** boundary is
      settled: that selector reads the host's persisted shape today and
      cannot know it was opened minimal and *stayed* minimal. The commit walk
      is what shows that.
- [ ] **Hotfix identity — confirm it against the cited source** (post-hoc
      host only). Closeout tests **plausibility only**, and says so: which
      commit was *the* merged hotfix is not derivable from inside the flow,
      so the developer asserts it and cites what the claim rests on —
      `hotfix-identity:` beside `hotfix-branch:` in a **T2**'s
      lightweight-spec frontmatter, or in the row Description for a **T3**.
      **Open that source** — PR, incident, or tracker — and confirm it names
      this fix and this commit. Closeout already checked that a citation is
      *present*; only review can check that it *matches*.
- [ ] **Hosted `Commit` cell identity — confirm each hash is *that row's own*
      implementation commit** (phase-bearing host only). `finish-feature-flow.md`
      Step 4 instruction 1 orders the value ("each row's own implementation
      hash, never the closeout hash") and its post-commit verification **states
      that it cannot decide it**: the hash-evidence test is minimal-host-only
      and lives in `finish-feature-minimal-host.md`, so on a phase-bearing host
      no closeout check reads the value at all. The presence item above asserts the cell is **non-empty**;
      this one asserts it is **right**, and the two are not interchangeable.
      For each Lightweight Changes row, take its `Commit` hash and run
      `git show --stat {hash}`. **Take the row's declaration if it has one and
      require the commit to touch it** — a **T2**'s own spec file
      (`lightweight-*.md` / `BUG-*.md`), a **T3**'s Description implementation
      paths.
      **If the row declares nothing, that is by design on a hosted row — with
      one exception.** A **T2** links to its own spec file on *every* host shape:
      `finish-feature-flow.md` Step 1 carries two `Tier = T2` checks that no
      host shape escapes — one of them says so in as many words — and
      `finish-feature-minimal-host.md`'s phase-bearing exemption note confirms
      those hosts keep them. A T2 row with
      no such link is **malformed, not exempt** — find the spec file or flag the
      row. For a **T3** the absence is the sanctioned state.
      ⚠ The record then gives you nothing to compare against, and that is
      deliberate: `finish-feature-minimal-host.md` exempts phase-bearing hosts
      from its `Commit` cell path check for exactly this reason
      (`references/flow-rationale-registry.md`, `R-FF-COMMITCELL-02`:
      "demanding it would reject every hosted T3"), and `templates/_index.md`
      calls declaring them good
      practice with no gate behind it. **Do not read "touches nothing declared"
      as a pass.** What remains checkable is weaker and is worth stating as
      such: the hash is **not** the closeout commit, is **not** any other row's
      hash, and is a commit on this host's branch — or on a branch this host
      recorded a `branch-override` for. Past that, ask the developer which
      commit carried the row. If identity matters for this change, say so and
      have the row declare its paths — that is what makes the comparison above
      available.
      ⚠ **Do not let tier decide that a declaration must exist.** Tier says what
      the declaration would have been; the one hosted row required to carry one
      is a T2, and that requirement lives in Step 1, not here. Keying this check
      on tier produced three successive versions that each named an input some
      row was not required to carry.
      A cell holding the **closeout** hash, or another row's hash, is what this
      exists to catch: both are non-empty, both pass every closeout check, and
      neither is what instruction 1 ordered.
      **N/A for a minimal host** — there `finish-feature-minimal-host.md`'s
      hash-evidence test already runs (a)–(c) against every row before closeout
      may proceed.
- [ ] **A recorded branch override still matches where the closeout landed**
      (only when the host carries a `branch-override` row). Closeout passes its
      branch check on any such row naming the branch it ran on, and **states
      that it cannot decide** whether that override was still the current
      intent — nothing expires a row once the developer returns to the host's
      own branch. You can see what closeout cannot: which branch the closeout
      commit sits on, and whether the work had already been integrated by then.
      Two cases to reject, both instances of one rule — **the branch this
      closeout landed on is not where this host's work was finished**: a closeout
      committed onto the **base** branch *after* the feature branch was merged
      (that puts the closeout commit outside the review this checklist is part
      of), and a closeout committed onto a branch an override named earlier but
      which the work has since **left** — a superseded spike, say. Closeout
      distinguishes neither, because it accepts any branch this host ever
      recorded an override for.
- [ ] **The closeout commit carries only this host's delta.** Closeout's spill
      check derives its permitted set from Step 4 instruction 2, which defines
      one for **every** host shape — so there is a permitted-file list to read
      against on a phase-bearing feature too. What that does not change is what
      the check proves: it is a **path-level spill check**, so it proves no
      unpermitted *file* entered the commit, never that the permitted ones carry
      only this change. An unrelated BR edit inside `rules.md`, or another
      feature's term in `glossary.md`, passes it untouched. Read each
      permitted file's diff against the intended delta in the spec / row.
- [ ] **A follow-up's reverse link was opened, not only closed.** The
      original's Follow-up Tracking row must have existed as `in-progress`
      before the flip to `completed` — `absent → in-progress → completed`,
      never created straight as `completed`. Closeout verifies this for a
      **minimal** host only, from checkpoint 1's committed blob; a
      **phase-bearing** follow-up has no single commit required to carry the
      row, so closeout has nothing equivalent to read and the opening half
      arrives here unchecked. Confirm it from the branch history
      (`git log -p {base}..HEAD -- <original feature>/_index.md`), for
      **each** SPEC-ID in `follow-up-of`.
- [ ] **A no-BC host committed no BC-scoped Domain material** — **every no-BC
      host, not only phase-bearing ones.** Closeout inspects only **checkpoint
      1's** diff on a minimal host, and a phase-bearing host has no single
      checkpoint to inspect at all. **Neither is a branch-range proof**, and
      closeout cannot take a range — it needs a base branch and Dflow
      deliberately does not know yours. **You have it.** Run
      `git diff --name-status {base}..HEAD -- 'dflow/specs/domain/'` and confirm
      no BC-scoped Domain document — **the set this track's own no-BC closeout
      check names**, `context-map.md` included — was **added, modified, deleted
      or renamed**. A no-BC host is one whose Goals & Scope declares no bounded
      context, the same identification the BC-layer-sync item above uses.
      ⚠ **The path filter is deliberately wider than the prohibited set, so read
      the output before flagging.** `context-map.md` sits at `domain/` top level
      rather than under `{context}/`, and the filter has to reach up there to
      catch it — which means it also lists `domain/glossary.md`. `glossary.md`
      belongs to no bounded context and stays legitimate for a no-BC host:
      **seeing it here is not a finding.** The tech-debt file is outside the
      filter entirely and never appears.

If the spec is missing or incomplete:
```
"I notice this PR doesn't have a matching feature directory / _index.md.
Can you describe what this change does? If it only records existing
behaviour or a decision without changing output, it is observation-only
and wants no host at all — it is captured in the relevant Domain
document (models.md / rules.md / behavior.md / events.md) and stops
there. Otherwise: if it belongs to a feature we already have, we can
record it there retroactively — the tier decides what gets written
(T2: a lightweight spec; T3: one inline _index.md row). If it's
genuinely new work, it wants /dflow:new-feature. If
there's no feature it could belong to, that's the standalone case and
it has a defined route: /dflow:modify-existing opens a minimal
(zero-phase) host for it — Step 1.7, or Step 1.6's minimal variant when
it's a follow-up on a completed feature. Let's send it there rather
than inventing a home by hand."
```

## Risk-Triggered Modeling Review

Use the spec and diff to identify these risks; do not use a keyword-only scan.
Only when a signal matches, read the named section in
`dflow/specs/shared/dflow-workflows/references/ddd-modeling-guide.md`. If no
signal matches, skip this section's guide lookup, create no artifact, and
continue with the existing checklist below.

| Risk signal | Read in the modeling guide |
|---|---|
| One use case mutates / saves multiple Aggregate roots, or adds a multi-root Unit of Work | Aggregate Design Rules; Domain Services |
| The diff crosses Bounded Contexts or changes an event payload, handler, or delivery expectation | Domain Events; Event Handling Guidelines |
| Deadline, retry, out-of-order callback, compensation, business-visible progress, or a claim that local persistence and an external provider / service fact form one atomic outcome | Aggregate Design Rules; Long-Running Processes; failure-path guidance under Event Handling Guidelines |
| `unique`, `only one active`, or another set-based invariant | Set-Based / Uniqueness Invariants |
| A Domain Service is added or changed | Domain Services; Long-Running Processes when the flow has state |

For every matched risk, record one disposition in the review:

- **Finding** — identify the violated guarantee at the boundary named by the
  matched risk, its severity, and merge disposition. For a match involving an
  external provider / service fact, state that a local transaction cannot make
  that fact atomic with local state; implementing or repairing a local
  transaction / Unit of Work alone is not sufficient closure.
- **Accepted with rationale** — state why the boundary / transaction / service
  role is sound and when to revisit it. For such an exception, the rationale
  must already exist or be added to the feature's `aggregate-design.md` Design
  Decisions; the PR conversation points to that decision and is not its only
  home. This disposition evaluates the rationale's adequacy, not only its
  existence: it must explain how it answers every matched risk. For a
  match involving an external provider / service fact, acknowledge that a local
  transaction cannot make that fact atomic with local state and explain how the
  outcome progresses across the boundary, including idempotency and retry /
  compensation (or a justified equivalent). For a Domain Service match, name
  the actual domain rule or decision the accepted operation carries; an
  operation that only orders root calls is Application-layer orchestration and
  remains a Finding, even when another operation of the same service holds a
  real rule. If the rationale does not cover the matched risk, use Finding
  rather than this disposition.
- **Not applicable** — explain from the spec and diff why the match is only
  superficial.

Multiple signals for the same design decision may share one disposition, but
every matched risk must have an auditable disposition. This is not a per-signal
form.

### Closing a blocking modeling finding

A DDD / domain-correctness blocker must state:

- the code boundary or enforcement needed to restore the guarantee;
- the existing durable surfaces that must change, as applicable — the spec,
  `aggregate-design.md`, domain `context-map.md` / `events.md` / `behavior.md`,
  or `architecture/tech-debt.md`;
- the automated tests or observable evidence that re-verify the guarantee; and
- that the unimplemented guarantee must not remain marked `completed` before
  re-review.

If the review offers defer as an option, it must list the owner, known risk,
exit criteria, and `architecture/tech-debt.md` landing surface as closure
conditions. If the team defers the finding, record those items on that surface;
rationale, a re-evaluation condition, or "future refactor" alone is not
closure. The reviewer defines the evidence needed to unblock, not the author's
implementation. Use the existing PR comment / conversation surface; do not
create a separate review report.

## Domain Layer Quality

- [ ] **Zero external dependencies** — check the Domain package/module manifest; no external dependencies beyond the language/runtime baseline
- [ ] **No ORM attributes** — no [Table], [Column], [Key] on domain classes
- [ ] **No serialization attributes** — no [JsonProperty], [JsonIgnore]
- [ ] **Private setters** — state changes through methods only
- [ ] **Invariants enforced** — constructor and methods reject invalid state
- [ ] **Value Objects immutable** — using `record` or readonly properties
- [ ] **Domain Events raised** — significant state changes produce events
- [ ] **Other Aggregates referenced by ID** — not by direct object reference

## Application Layer Quality

- [ ] **No business logic** — handlers only orchestrate, not decide
- [ ] **CQRS respected** — Commands for writes, Queries for reads
- [ ] **Validation in Validator** — not in handler or controller
- [ ] **No Domain objects in DTOs** — proper mapping between layers
- [ ] **Event handlers are idempotent** — safe to replay

## Infrastructure Layer Quality

- [ ] **EF config in Fluent API** — not attributes on Domain entities
- [ ] **Repository only for Aggregate Roots** — not for child entities
- [ ] **No business logic in SQL/LINQ** — complex filtering via Specifications
- [ ] **External service behind interface** — mockable for tests

## Presentation Layer Quality

- [ ] **Thin controllers** — parse, dispatch, respond
- [ ] **No domain objects exposed** — only DTOs/ViewModels in API
- [ ] **Proper status codes** — 201 Created, 404 Not Found, 422 Unprocessable
- [ ] **No business logic** — not even validation beyond format checking

## Cross-Cutting

- [ ] **Glossary consistency** — any new business concept added to `glossary.md`?
- [ ] **Naming matches the Ubiquitous Language** — for each **domain-facing** type
      or member the diff introduces (skip DTO / test / framework names), is there a
      matching term in `glossary.md`? The `Code Mapping` column maps each term to
      its `{Namespace/Class/Member}` — a domain name in the diff with no glossary
      term, or a term whose Code Mapping is now stale, is the signal.
- [ ] **No synonym drift** — is the code naming a concept with a different word than
      the glossary (e.g. "reimbursement" in code vs "報銷 / Expense Claim" in the
      glossary)? Align it. (Judgment call, not a string match.)
- [ ] **Context boundaries respected** — no reaching into another context's internals
- [ ] **Domain Events documented** — events.md updated?
- [ ] **Tests cover invariants** — not just happy path

## Architecture Score

- **A**: Clean layer separation, Domain-first design, full spec, comprehensive tests
- **B**: Mostly clean, minor layer bleed, spec exists, good test coverage
- **C**: Some business logic in wrong layer, spec exists
- **D**: Working code but architecture concerns, needs refactoring
- **F**: Business logic in controller/infrastructure, no spec — push back
