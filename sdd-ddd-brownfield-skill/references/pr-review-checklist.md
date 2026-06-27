# PR Review Checklist

When reviewing code changes or discussing PRs, use this checklist to ensure
the SDD/DDD workflow was followed.

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
      - A new phase-spec being introduced (T1) — read in full
      - An existing phase-spec being marked `completed` — verify its
        Delta-from-prior-phases section reads correctly relative to the
        prior phase
      - A new lightweight-spec (T2) — read in full
      - Just T3 inline rows added to `_index.md` Lightweight Changes (no
        spec file changed) — confirm the row description is precise
- [ ] If a `Behavior Delta` / Delta-from-prior-phases section exists,
      read **ADDED / MODIFIED / REMOVED / RENAMED**; note any
      **UNCHANGED** scope declaration
- [ ] State in one sentence: "This PR intends to {change} because
      {reason}." (If you can't, pause and ask the author.)
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
- [ ] **Spec matches code** — implementation matches Given/When/Then
- [ ] **Business rules covered** — all BR-* rules in this spec
      implemented
- [ ] **Edge cases handled** — EC-* in this spec addressed
- [ ] **Delta integrity** (phase 2+ only) — the Delta-from-prior-phases
      section's ADDED / MODIFIED / REMOVED / RENAMED entries actually
      match the diff against the prior phase-spec's BR set

If the closeout commit is in this PR (`/dflow:finish-feature` was run):
- [ ] **BC layer sync landed** — `dflow/specs/domain/{context}/rules.md` and
      `behavior.md` reflect the feature's net effect (compare against
      `_index.md` Current BR Snapshot)
- [ ] **Whole feature directory `git mv`'d** to `completed/` — git
      shows `renamed:` (not `deleted:` + `new file:`)
- [ ] **Integration Summary** was emitted to the conversation (not
      written to a file — it's ephemeral)

If the spec is missing or incomplete:
```
"I notice this PR doesn't have a matching feature directory / _index.md.
Let's create one retroactively — it'll help with documentation and
the target architecture. Can you describe what this change does?"
```

## Domain Layer Quality

- [ ] **No delivery-framework references in Domain** — `src/Domain/` must have zero dependencies on HTTP request/response objects, session/cookie context, job-runner context, CLI flag parsers, or ViewState equivalents
- [ ] **No direct DB access in Domain** — All data access through interfaces
- [ ] **No delivery-framework runtime context in Domain** — Pure business logic only
- [ ] **Testable without delivery infrastructure** — Could you unit test this without the web server, job runner, message broker, or CLI runtime?

Common violations to flag:
```text
// BAD: Domain code depending on delivery framework runtime
deliveryFramework.request.currentUser
deliveryFramework.session["key"]
jobRunnerContext.retryState
cliFlags["mode"]

// BAD: Direct DB in Domain
databaseClient.openConnection(connectionString)

// GOOD: Interface-based
public class ExpenseService
{
    private readonly IExpenseRepository _repo;
    public ExpenseService(IExpenseRepository repo) => _repo = repo;
}
```

## Delivery/Entrypoint Thickness

Evaluate whether business logic embedded in delivery/entrypoint code
(presentation/UI layer, controllers, handlers, jobs, message consumers, data
pipelines, or stored procedures) has been kept appropriately thin:

**Acceptable delivery/entrypoint responsibilities:**
- Parse inputs (UI controls, HTTP payloads, message payloads, job parameters, CLI args)
- Call Domain layer services
- Bind or return results
- Handle delivery-specific events (page load, route handler, message received, job started)
- Delivery-level validation (required fields, request shape, command syntax)

**Should be in Domain layer instead:**
- Calculations (math, conversions, aggregations)
- Business validation (rules, constraints, limits)
- State transitions (status changes, workflow steps)
- Data transformations (business meaning, not UI formatting)

If delivery/entrypoint code is too thick:
```
"This delivery/entrypoint code has [calculation/validation/transformation] logic
that could be extracted to src/Domain/{Context}/. Since we're already
reviewing this, should we extract it now or record it in tech-debt.md
for later?"
```

## Glossary Consistency

- [ ] **New terms documented** — Any new business concept added to glossary.md?
- [ ] **Naming matches the Ubiquitous Language** — for each **domain-facing**
      class / method / variable the diff introduces (skip DTO / test / framework
      names), is there a matching term in `glossary.md`? The `Code Mapping` column
      maps each term to its `{Namespace/Class/Member}` — a domain name with no
      glossary term, or a term whose Code Mapping is now stale, is the signal.
- [ ] **No synonym drift** — is the code naming a concept with a different word
      than the glossary? Align it. (Judgment call, not a string match.)
- [ ] **No ambiguous terms** — Are domain-specific terms used precisely?

Example check:
```
"I see you're using 'reimbursement' in the code but the glossary
uses '報銷 (Expense Claim)'. Should we align the naming?"
```

## Domain Documentation Updates

- [ ] **models.md updated** — New entities/VOs/services documented?
- [ ] **rules.md updated** — New or changed business rules recorded?
- [ ] **context.md boundaries respected** — Does this change stay within its context?

## Tech Debt Awareness

- [ ] **New debt recorded** — Any shortcuts or compromises documented in tech-debt.md?
- [ ] **Existing debt not worsened** — Did this change make existing tech debt worse?
- [ ] **Debt reduced** — Did this change fix any existing tech-debt.md items? If so, check them off.

## Migration Readiness Score

Rate the PR on a quick migration readiness scale:

- **A**: New business logic entirely in Domain layer, fully testable, spec complete
- **B**: Mostly in Domain layer, some minor coupling, spec exists
- **C**: Mixed — some extraction done, some logic still in delivery/entrypoint code
- **D**: All logic in delivery/entrypoint code, but at least documented in spec/tech-debt
- **F**: No spec, no extraction, no documentation — push back

Share the score with the developer constructively:
```
"This PR is a solid B — the exchange rate logic is cleanly extracted
to Domain, and the spec covers the key scenarios. One thing that would
make it an A: the date parsing logic in the delivery/entrypoint layer could
move to a DateRange value object. Want to do that now or add it to tech-debt?"
```
