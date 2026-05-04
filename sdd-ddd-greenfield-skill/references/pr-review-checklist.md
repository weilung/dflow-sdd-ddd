# PR Review Checklist — ASP.NET Core

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
review the code, can you point me to it, or run /dflow:new-feature
(or /dflow:bug-fix for a small fix) to create the feature directory
and at least a lightweight spec? SDD relies on the spec being the
review anchor."
```

## Spec Compliance

Per-feature checks:
- [ ] **Feature directory exists** with `_index.md` + at least one
      phase-spec (or one lightweight-spec for a T2-only feature)
- [ ] **`_index.md` Current BR Snapshot is up to date** — reflects
      the cumulative effect of all phase-specs / lightweight-specs in
      the directory
- [ ] **`_index.md` Phase Specs table** — every row's referenced
      phase-spec file exists and its `status` matches the row's claim
- [ ] **For follow-up features**: `_index.md` Metadata has `follow-up-of:
      {原 SPEC-ID}` AND the original feature's `_index.md`
      Follow-up Tracking row references this feature

Per-phase-spec / lightweight-spec checks (run for **each** spec file the
PR touches, not just one):
- [ ] Spec matches code
- [ ] Implementation matches Given/When/Then scenarios (including
      Aggregate state transitions and Domain Events)
- [ ] All business rules (BR-*) in this spec implemented
- [ ] Edge cases (EC-*) in this spec handled
- [ ] **Delta integrity** (phase 2+ only) — the Delta-from-prior-phases
      section's ADDED / MODIFIED / REMOVED / RENAMED entries actually
      match the diff against the prior phase-spec's BR set

If the closeout commit is in this PR (`/dflow:finish-feature` was run):
- [ ] **BC layer sync landed** — `dflow/specs/domain/{context}/rules.md` /
      `behavior.md` / `events.md` / `context-map.md` reflect the
      feature's net effect (compare against `_index.md` Current BR
      Snapshot)
- [ ] **Whole feature directory `git mv`'d** to `completed/` — git
      shows `renamed:` (not `deleted:` + `new file:`)
- [ ] **Integration Summary** was emitted to the conversation (not
      written to a file — it's ephemeral)

## Domain Layer Quality

- [ ] **Zero external dependencies** — check .csproj, no NuGet beyond base .NET
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

- [ ] **Glossary consistency** — new terms documented?
- [ ] **Context boundaries respected** — no reaching into another context's internals
- [ ] **Domain Events documented** — events.md updated?
- [ ] **Tests cover invariants** — not just happy path

## Architecture Score

- **A**: Clean layer separation, Domain-first design, full spec, comprehensive tests
- **B**: Mostly clean, minor layer bleed, spec exists, good test coverage
- **C**: Some business logic in wrong layer, spec exists
- **D**: Working code but architecture concerns, needs refactoring
- **F**: Business logic in controller/infrastructure, no spec — push back
