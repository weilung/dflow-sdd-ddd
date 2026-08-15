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

If your project uses Git Flow (with `develop` / `release/*` /
`hotfix/*`), use `Git-principles-gitflow.md` instead.

**If you are unsure which to pick**: choose this (trunk) template.
It is the default style of GitHub, GitLab, and most modern open
source. Git Flow is best suited to teams with formal release cycles
and long-lived release branches.

---

## 1. Branch Structure

| Branch | Naming | Cut from | Merges to |
|--------|--------|----------|-----------|
| `main` | `main` | — | — (integration branch) |
| feature | `feature/{SPEC-ID}-{slug}` | `main` | `main` |
| bugfix | `bugfix/{BUG-ID}-{slug}` | `main` | `main` |

There are no `develop`, `release/*`, or `hotfix/*` branches. All work
happens on short-lived feature / bugfix branches cut from `main` and
merged back into `main` quickly (ideally within a day, always
within a week).

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

The `feature/{SPEC-ID}-{slug}` pattern is a **Dflow requirement** (not
a trunk-based requirement). It ties each feature branch to its
corresponding `dflow/specs/features/active/{SPEC-ID}-{slug}/` directory.

### Feature Branch Workflow

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/{SPEC-ID}-{slug}

# 2. Stay in sync with main during development (rebase preferred to
#    keep history linear; merge is also fine per project taste)
git fetch origin
git rebase origin/main

# 3. Commit as you go (see § 2 below)
git add .
git commit -m "[{SPEC-ID}] {short description}"

# 4. Push
git push -u origin feature/{SPEC-ID}-{slug}

# 5. Open a PR to main when ready (or earlier as draft)
```

---

## 2. Commit Message Format

Commits must tie back to a SPEC-ID:

```
[{SPEC-ID}] {short description}

{optional detailed body}
```

### Conventional Commits style (recommended, optional)

This project {does / does not} require Conventional Commits. When
adopted, the format is:

```
{type}({scope}): {short description}

[SPEC-ID] reference in body if not in scope
```

| Type | Meaning |
|------|---------|
| feat | new feature |
| fix | bug fix |
| refactor | internal refactor (no behavior change) |
| docs | documentation only |
| style | formatting only |
| test | tests only |
| chore | build / tooling |

Example: `feat(expense): add JPY currency support` with
`[SPEC-20260424-001]` in the body.

---

## 3. Merge Strategy (Project Chooses)

Trunk-based strategies typically pick **one** merge style and stick to
it. This project uses: **{squash | rebase | fast-forward}**. Delete
the two unused options once decided, or keep all three in the table
and circle the chosen one.

| Strategy | How the feature lands on `main` | When to prefer |
|----------|--------------------------------|----------------|
| Squash merge | One commit summarising the whole feature | Default for most teams; simplest history |
| Rebase + merge | Each commit replays on `main` | Want full feature commit history on `main`, clean linear log |
| Fast-forward only | Branch pointer advances `main` | Only works when feature is 1 commit or branch has been rebased to linear history |

### Gate Checks — Before `git commit`

- [ ] If the change corresponds to a phase-spec, that phase-spec's
      `Implementation Tasks` section items are checked (or remaining items have
      justification in the spec's notes section)
- [ ] `_index.md` status reflects the current work (Phase Specs row
      updated, `Resume Pointer` refreshed if the commit reaches a meaningful
      checkpoint). A **minimal (zero-phase) host** has no Phase Specs row to
      update — its record is the Lightweight Changes row, and that row must
      already be written **before** this commit, not after it. Refresh the
      Resume Pointer as usual.

### Gate Checks — Before merging a feature PR to `main`

- [ ] `/dflow:finish-feature` has run (or the equivalent Step 8.4
      manual archival is complete)
- [ ] `_index.md` status = `completed`, feature directory moved to
      `dflow/specs/features/completed/` via `git mv`
- [ ] BC layer synced: `dflow/specs/domain/{context}/rules.md` and
      `behavior.md` reflect the feature's net BR changes
- [ ] `dflow/specs/domain/glossary.md` updated with any new terms
- [ ] `dflow/specs/migration/tech-debt.md` updated with any debt discovered
- [ ] Domain layer (`src/Domain/`) has no delivery-framework references
- [ ] CI green
- [ ] PR has at least one review approval

> **Minimal (zero-phase) host.** The items about this host's own record —
> `/dflow:finish-feature` having run, `_index.md` status `completed`, and the
> archival move — apply **unchanged**: they are what stops a host merging with
> its record still open. Every item naming a **Domain or bounded-context
> artifact** applies only to what this change **actually touched**: a **no-BC**
> host has no context to sync or document, a **T3** does no Domain work at all,
> and a **baseline capture** wrote the BC layer directly rather than syncing to
> it — so for those they read N/A. **Bounded-context-scoped only** —
> `glossary.md` and `migration/tech-debt.md` belong to no bounded context, stay
> in a no-BC host's sweep, and are a baseline capture's own capture
> destinations, so they are **not** N/A for either. **Code invariants are not
> artifacts** — the items here that state a rule about the **source** rather
> than name a document to update are **never N/A**: they hold for any change
> that touches code at all, and a host wrongly claiming to be no-BC is exactly
> what they catch. Record the N/A; do not create a context, a Domain document,
> or a BR row to tick a box.

---

## 4. Integration Commit Message Conventions

`/dflow:finish-feature` emits a **Git-strategy-neutral Integration
Summary** (see `references/finish-feature-flow.md` in the Dflow skill).
This section specifies how to turn that Summary into the actual
commit message under each trunk-based merge style.

### 4.1 Squash merge (most common)

When GitHub / GitLab squashes the feature branch into `main`, the PR
title + description becomes the squash commit. Recommended format:

```
feat({scope}): {1-line summary from Integration Summary Feature Goal}

{Integration Summary body, lightly formatted:}

Feature Goal: {copied from Integration Summary}

Change Scope:
- BC: {context-name}
- Phase Count: {N}
- Lightweight Changes: {n_t2} T2 + {n_t3} T3

Related BR-IDs:
- ADDED: BR-NN, BR-NN
- MODIFIED: BR-NN
- REMOVED: (none)

Related SPEC-IDs: {SPEC-ID}{, follow-up SPEC-IDs if any}
```

**Zero-phase (minimal host) form.** A minimal host has no phases and may have
no bounded context, so its Change Scope block carries the values that are
actually true rather than padded ones:

```
Change Scope:
- BC: none                          # or the real context, when the change has one
- Phase Count: 0
- Lightweight Changes: 1 T2 + 0 T3  # at least one row, always

Related BR-IDs: {empty, or the per-family no-BR marker this change carries}
```

`none` and `0` are the honest values here, not placeholders waiting to be
filled. **`Related BR-IDs` is the exception — never force it to `none`.**
It reports what this change's own record carries, not what was synced, so it
takes the same values a BC-bearing host would: empty, or the per-family no-BR
marker when the T2 carries one. Writing `none` there erases the marker the
zero-phase shape requires (`references/finish-feature-flow.md` Step 5 states
the rule, and a baseline host leaves the field empty). A minimal host that genuinely touches a bounded context reports that
context and its real BR delta exactly as a phase-bearing feature would — the
zero is the **phase count**, not the significance. A **baseline capture** is
the one variant that always reports a real `BC:` — capturing it is the whole
point of the host.

Example:

```
feat(expense): add JPY currency support (SPEC-20260421-001)

Feature Goal: 支援 JPY 幣別，涵蓋報銷與匯率換算。

Change Scope:
- BC: Expense
- Phase Count: 2 (phase-spec-2026-04-21-core / phase-spec-2026-04-23-ui)
- Lightweight Changes: 1 T2 (BUG-042-rounding)

Related BR-IDs:
- ADDED: BR-07, BR-08
- MODIFIED: BR-03

Related SPEC-IDs: SPEC-20260421-001
```

### 4.2 Rebase + merge (preserve feature commits on `main`)

Each commit from the feature branch lands on `main` as-is. The
Integration Summary does not become a single commit — instead, make
sure each of the feature's phase-spec completion commits already has
the right body. For the final "closeout" commit that runs
`/dflow:finish-feature`, use:

```
[{SPEC-ID}] closeout: archive feature + sync BC

{Integration Summary — same body as squash example above}
```

This lets `git log` on `main` tell the phase-by-phase story without
losing the feature-level summary.

### 4.3 Fast-forward (feature has exactly 1 commit)

If the entire feature was a single commit (a hosted T2 / T3 whose work and
record landed together), fast-forward is fine. Use the commit
message format from § 4.1 (squash) for that single commit — it already
reads as the feature's single narrative.

**A minimal (zero-phase) host is never this case.** It records **exactly two**
commits — the implementation (or `spec-baseline`) checkpoint, then the closeout
commit that carries the archival `git mv` — so it does not arrive here with
one. A minimal host showing a single commit has not closed out: run
`/dflow:finish-feature` first rather than fast-forwarding it as it stands.

```bash
git checkout main
git pull --ff-only origin main
git merge --ff-only feature/{SPEC-ID}-{slug}
git push origin main
```

---

## 5. Tags & Release Notes

Trunk-based projects typically release from `main` (continuous delivery
or on-demand tagging). If this project tags releases:

```bash
git tag -a v{major}.{minor}.{patch} -m "{release summary}"
# e.g. git tag -a v1.2.3 -m "Expense report export + JPY support"
```

Otherwise, release cadence is continuous — each merge to `main` that
passes CI is deployable.

### `CHANGELOG.md`

Whether or not tags are used, `CHANGELOG.md` at the repo root captures
the narrative of merges. See `Git-principles-gitflow.md` § 5 for the
entry format, or adopt [Keep a Changelog](https://keepachangelog.com/)
style.

---

## 6. AI Collaboration Rules (Project Policy)

Three categories:

### Must-confirm operations (AI asks before running)

| Operation | Why |
|-----------|-----|
| `git commit` | Stage needs human review |
| `git push` | Publishing to shared remote |
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
| `git rebase` on a private (not-yet-pushed) branch |

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

## 7. CI / CD

{Fill in this project's CI/CD pipeline shape. Trunk-based projects
typically run CI on every PR + every merge to `main`. Stages: build
→ test → (optional) deploy to staging → (optional) deploy to
production. Reference the pipeline config file, e.g.
`.github/workflows/ci.yml`.}

---

## Related Documents

- `references/git-integration.md` in the Dflow skill — canonical
  source for feature-branch-per-feature, `git mv` mandate, Gate Checks
- [System overview](_overview.md)
- [Spec conventions](_conventions.md)
- `CHANGELOG.md` at repo root
