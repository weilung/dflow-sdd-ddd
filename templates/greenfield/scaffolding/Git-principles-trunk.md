<!-- Seeded by Dflow. -->

# Git Principles — Trunk-based / GitHub Flow edition

> Created: {YYYY-MM-DD}
> Scope: project Git conventions. This project adopts a **single-`main`
> trunk-based / GitHub Flow** branching strategy.
> Audience: engineers + AI assistants performing Git operations.

Dflow itself is branching-strategy-neutral — it only requires the
feature-branch-per-feature convention (see the Dflow skill's
`references/git-integration.md`). This file records the trunk-based
conventions chosen by this project.

If your project adopts Git Flow (develop / release / hotfix branches),
use `Git-principles-gitflow.md` instead.

---

## 1. Branch Structure

Single-trunk model:

| Branch | Naming | Cut from | Merges to |
|--------|--------|----------|-----------|
| `main` | `main` | — | — (protected; feature branches merge in) |
| feature | `feature/{SPEC-ID}-{slug}` | `main` | `main` |
| bugfix | `bugfix/{BUG-ID}-{slug}` | `main` | `main` |

No `develop`, no `release/*`, no `hotfix/*` branches. Hotfixes are just
small, fast feature branches cut from `main`.

The `feature/{SPEC-ID}-{slug}` pattern is a **Dflow requirement** (not
a trunk-based requirement). It ties each feature branch to its
corresponding `dflow/specs/features/active/{SPEC-ID}-{slug}/` directory.

A **`bugfix/{BUG-ID}-{slug}`** branch is the same shape as a feature branch and
follows the same topology — cut from the same base, pushed the same way,
integrated the same way, and **closed out the same way**. It is used when a
defect owns its own host rather than being picked up by a feature already in
flight. Its host is a **minimal (zero-phase) host**, so it carries no
phase-spec: the SPEC-ID lives in the directory name while the branch name
carries the BUG-NUMBER, and the host `_index.md` `branch:` field is
authoritative for both. Closeout is not optional because the branch prefix
differs — `/dflow:finish-feature` runs and the directory is archived to
`completed/` before the branch merges, exactly as for `feature/`.

### Feature Branch Workflow

```bash
# 1. Start from latest main
git checkout main
git pull origin main
git checkout -b feature/{SPEC-ID}-{slug}

# 2. Stay in sync with main during development (rebase preferred)
git fetch origin
git rebase origin/main

# 3. Commit as you go (see § 2 below)
git add .
git commit -m "[{SPEC-ID}] {short description}"

# 4. Push + open PR
git push -u origin feature/{SPEC-ID}-{slug}
gh pr create --base main --fill
```

### Key trunk-based practices

- **Short-lived feature branches**: typically hours to a few days, not
  weeks. Encourage splitting large features into multiple phase-specs
  and merging each phase to `main` (see `AI-AGENT-GUIDE.md` § Ceremony Scaling +
  `/dflow:new-phase`)
- **Main is always releasable**: feature flags or dark launches for
  incomplete functionality; CI must be green on `main` at all times
- **Rebase, don't merge, during development**: keep history linear on
  the feature branch by rebasing against `main`; use squash / rebase
  merge (not `--no-ff`) when merging into `main`

---

## 2. Commit Message Format

Commits must tie back to a SPEC-ID. Conventional Commits style is
recommended but not strictly required:

```
{type}({scope}): {short description}

[{SPEC-ID}] {longer description, optional}
```

### Type prefix (Conventional Commits)

| Type | Meaning |
|------|---------|
| feat | new feature |
| fix | bug fix |
| refactor | internal refactor (no behavior change) |
| docs | documentation only |
| style | formatting only |
| test | tests only |
| chore | build / tooling |

### Scope (optional)

Scope is typically a bounded context or module name, e.g.
`feat(expense): introduce ExpenseReport submission invariants`.

### Example

```
feat(expense): add ExpenseReport submission invariants

[SPEC-20260421-001] Introduce ExpenseReport Aggregate with submission
state machine; enforces non-negative Amounts and requires at least one
ExpenseItem before submission.
```

---

## 3. Merge Strategy Options

Trunk-based projects typically pick **one** of the three below as the
default. Document which one your team uses:

### Option A — Squash merge (most common)

All commits on the feature branch are squashed into a single commit on
`main`. Clean history; each feature is one commit.

- Pro: Linear, easy-to-read history
- Pro: Cherry-picks and reverts are trivial
- Con: Loses intermediate commit context (though it's still available
  via the PR)

**This project uses**: {Yes / No / Default — fill in}

### Option B — Rebase merge

Each commit on the feature branch is rebased onto `main` as-is. Linear
history, but more commits than squash.

- Pro: Preserves commit-by-commit history
- Pro: Each phase-spec can map to its own commit (trace SPEC-ID by
  phase)
- Con: Noisier history

**This project uses**: {Yes / No / Default — fill in}

### Option C — Fast-forward only

Only merges when the feature branch is a direct descendant of `main`.
Equivalent to rebase merge when used consistently.

- Pro: Perfectly linear
- Con: Requires strict rebase discipline; can be inconvenient

**This project uses**: {Yes / No / Default — fill in}

---

## 4. Integration Commit Message Conventions

`/dflow:finish-feature` emits a **Git-strategy-neutral Integration
Summary** (see `references/finish-feature-flow.md` in the Dflow skill).
This section specifies how to turn that Summary into the actual
commit message under each trunk-based merge style.

### 4.1 Squash merge commit format

When squash-merging, the single resulting commit should look like this:

```
feat({scope}): {title from Integration Summary}

{Feature Goal block, copied from Integration Summary}

Change Scope:
- BC: {context-name}
- Aggregate(s) touched: {Aggregate names}
- Phase Count: {N}
- Lightweight Changes: {n_t2} T2 + {n_t3} T3

Related BR-IDs:
- ADDED: BR-NN, BR-NN
- MODIFIED: BR-NN
- REMOVED: (none)

Domain Events introduced / modified: {Event names, or "(none)"}

Related SPEC-IDs: {SPEC-ID}{, follow-up SPEC-IDs if any}
```

**Zero-phase (minimal host) form.** A minimal host has no phases and may have
no bounded context, so its Change Scope block carries the values that are
actually true rather than padded ones:

```
Change Scope:
- BC: none                          # or the real context, when the change has one
- Aggregate(s) touched: none
- Phase Count: 0
- Lightweight Changes: 1 T2 + 0 T3  # at least one row, always

Related BR-IDs: {empty, or the per-family no-BR marker this change carries}

Domain Events introduced / modified: (none)
```

`none` and `0` are the honest values here, not placeholders waiting to be
filled. **`Related BR-IDs` is the exception — never force it to `none`.**
It reports what this change's own record carries, not what was synced, so it
takes the same values a BC-bearing host would: empty, or the per-family no-BR
marker when the T2 carries one. Writing `none` there erases the marker the
zero-phase shape requires (`references/finish-feature-flow.md` Step 5 states
the rule). A minimal host that genuinely touches a bounded context
reports that context and its real BR delta exactly as a phase-bearing feature
would — the zero is the **phase count**, not the significance.

GitHub PR editor can be pre-filled with this body; the merge button
then produces the squash commit.

### 4.2 Rebase merge (per-commit, multi-phase feature)

If the feature has N phase-specs, you can produce N commits (one per
phase) on `main`:

- Each commit retains its original `[{SPEC-ID}][Phase-N]` prefix from
  development
- **The last commit** of the rebased chain should carry the Integration
  Summary as its extended body, so a reader scanning the last commit
  sees the feature-level summary:

```
feat({scope}): {Phase N title} — closes {SPEC-ID}

[{SPEC-ID}][Phase-N] {phase-level description}

--- Feature integration summary ---
{Feature Goal block}
Change Scope: ... (as in §4.1)
Related BR-IDs: ...
Domain Events: ...
```

### 4.3 Fast-forward (feature has 1 commit total)

For trivial features consisting of a single commit (often a T3
triaged later to one small refactor / fix), the commit body itself
IS the integration message — use the §4.1 format.

**A minimal (zero-phase) host is never this case.** It records **exactly two**
commits — the implementation checkpoint, then the closeout commit that carries
the archival `git mv` — so it does not arrive here with one. A minimal host
showing a single commit has not closed out: run `/dflow:finish-feature` first
rather than fast-forwarding it as it stands.

---

## 5. Gate Checks

Before making key Git operations:

### Before `git commit`

- [ ] If the change corresponds to a phase-spec, that phase-spec's
      `Implementation Tasks` section items are checked (or remaining items have
      justification in the spec's notes section)
- [ ] `_index.md` status reflects the current work (Phase Specs row
      updated, `Resume Pointer` refreshed if the commit reaches a meaningful
      checkpoint). A **minimal (zero-phase) host** has no Phase Specs row to
      update — its record is the Lightweight Changes row, and that row must
      already be written **before** this commit, not after it. Refresh the
      Resume Pointer as usual.
- [ ] Clean Architecture layer rules hold (Domain has no external
      package deps, no business logic leaked into handlers /
      controllers)

### Before merging a feature branch to `main` (opening / merging the PR)

- [ ] `/dflow:finish-feature` has run (or the equivalent Step 8.4
      manual archival is complete)
- [ ] `_index.md` status = `completed`, feature directory moved to
      `dflow/specs/features/completed/` via `git mv`
- [ ] BC layer synced: `dflow/specs/domain/{context}/rules.md`,
      `behavior.md`, `events.md`, and (if cross-context)
      `context-map.md` reflect the feature's net changes
- [ ] `dflow/specs/domain/glossary.md` updated with any new terms
- [ ] `dflow/specs/architecture/tech-debt.md` updated with any debt discovered
- [ ] Domain project has zero external package dependencies
- [ ] No ORM / serialization attributes on Domain entities
- [ ] Domain unit tests pass (invariants + value object equality)
- [ ] CI is green (all required checks passing)

> **Minimal (zero-phase) host.** The items about this host's own record —
> `/dflow:finish-feature` having run, `_index.md` status `completed`, and the
> archival move — apply **unchanged**: they are what stops a host merging with
> its record still open. Every item naming a **Domain or bounded-context
> artifact** applies only to what this change **actually touched**: a **no-BC**
> host has no context to sync or document, and a **T3** does no Domain work at
> all, so for those they read N/A. **Bounded-context-scoped only** —
> `glossary.md` and the tech-debt file belong to no bounded context, stay in a
> no-BC host's sweep, and are **not** N/A for it. **Code invariants are not
> artifacts** — the items here that state a rule about the **source** rather
> than name a document to update are **never N/A**: they hold for any change
> that touches code at all, and a host wrongly claiming to be no-BC is exactly
> what they catch. Record the N/A; do not create a context, a Domain document,
> or a BR row to tick a box.

---

## 6. AI Collaboration Rules (Project Policy)

Three categories:

### Must-confirm operations (AI asks before running)

| Operation | Why |
|-----------|-----|
| `git commit` | Stage needs human review |
| `git push` | Publishing to shared remote |
| `gh pr merge` (squash / rebase) | Shared-branch impact |
| Any `git rebase` that rewrites shared history | Force-push risk |

### Forbidden operations

| Operation | Reason |
|-----------|--------|
| `git push -f` to `main` | Overwrites other people's work |
| `git reset --hard` to a remote branch | Irreversible |
| `git commit --amend` on a pushed commit | Rewrites public history |
| Deleting `main` | Protected branch |

### Allowed without asking

| Operation |
|-----------|
| `git status` / `git diff` / `git log` / `git show` |
| `git fetch` (no merge) |
| `git stash` (local-only) |
| `git branch` (listing only) |
| `gh pr status` / `gh pr view` |

### AI commit authorship

How AI-made commits are marked is chosen once at `dflow init` and recorded in
`dflow/specs/shared/_conventions.md` § AI Commit Policy:

- `none` — AI commits carry no extra marker.
- `co-authored-by` — a `Co-Authored-By: dflow-ai <noreply@dflow.local>` trailer
  (teams may customize the name / email).
- `prefix` — an `[ai-assisted]` commit-subject prefix.

This recorded setting is authoritative and the runtime does not re-ask. The AI
offers commits at lifecycle checkpoints (see `references/git-integration.md`
§ Commit Checkpoints, Branch Gate & AI Commits) using your Git identity, and you
can always decline. If your team also wants vendor attribution, appending the
assistant's documented line (e.g. `Co-Authored-By: Claude
<noreply@anthropic.com>`) is an independent, optional convention on top.

---

## 7. Hotfixes under Trunk-based

There is no separate `hotfix/*` branch. A hotfix is:

1. A (small) feature branch cut from `main`
2. Named by the normal Dflow branch scheme, chosen by severity: a
   bug-type hotfix (T2 lightweight) uses `bugfix/{BUG-ID}-{slug}`; a
   hotfix that warrants full ceremony uses `feature/{SPEC-ID}-{slug}`
   (see `references/git-integration.md` § Branch Naming Convention)
3. Merged back to `main` via the team's chosen merge strategy
4. Deployed via the same pipeline as any other change

**Hotfix spec requirement (team convention)**: Hotfixes often skip the
upfront SDD cycle for speed. This project commits to documenting the fix
within **24 hours** after it lands. Run `/dflow:modify-existing` in
**post-hoc mode** (`references/modify-existing-flow.md` Step 1.8): it opens a
minimal host of its own for the fix, records the implementation checkpoint as
`reconciled ({merged-hotfix-hash})`, and reconciles rather than re-running work
that is already on the mainline.
What gets written is whatever the cascade's tier calls for — a **T2** lands a
lightweight spec (root cause + fix + a `dflow/specs/architecture/tech-debt.md` entry
if the bug reveals a systemic issue); a **T3** lands one `_index.md` Lightweight
Changes row and no spec file. Step 1.8 admits **T2 / T3 only**: a **T1**
post-hoc keeps the normal phase-bearing route and documents the merged work
there.
This is a **human-to-human commitment** — Dflow / AI cannot track the
24-hour clock; the team enforces it in retros.

---

## 8. Release & Versioning

Trunk-based does not impose a release branch. Two common patterns:

### Pattern A — Tag-based release (recommended)

Each deploy-worthy state of `main` is tagged:

```bash
git tag -a v{major}.{minor}.{patch} -m "{release summary}"
git push origin --tags
```

### Pattern B — Release branches (only if regulatory / LTS needs)

Cut `release/{version}` from `main` only when you must maintain an
older version. Use sparingly; avoid if possible.

### `CHANGELOG.md`

Detailed version history lives in `CHANGELOG.md` at the repo root. One
section per release tag; link back to the SPEC-IDs included in that
release.

---

## 9. CI / CD

{Fill in this project's CI/CD pipeline shape: trigger (push to main,
tag), stages (build → test → deploy), environments
(dev / staging / prod). Reference the pipeline config file if one
exists, e.g. `.github/workflows/ci.yml` or `azure-pipelines.yml`.}

### Suggested CI gates for Clean Architecture

- Verify Domain project has zero (or allow-listed) external package deps
- Run Domain unit tests + Application tests on every PR
- Run Integration tests on `main` and pre-deploy
- Verify EF migrations build cleanly

---

## Related Documents

- `references/git-integration.md` in the Dflow skill — canonical
  source for feature-branch-per-feature, `git mv` mandate, Gate Checks
- [System overview](_overview.md)
- [Spec conventions](_conventions.md)
- `CHANGELOG.md` at repo root
