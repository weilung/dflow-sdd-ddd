# Init Project Flow — Brownfield Track

Internal flow spec for `npx dflow-sdd-ddd init` after the CLI selects the
Brownfield track. It also serves as the manual reference for environments
where Node.js/npm is unavailable.

This is not a skill slash command. Do not describe or invoke it as one.

This is a **one-time project bootstrap** flow. It sets up the `dflow/specs/`
directory structure, seeds project-level governance files from the packaged
`scaffolding/` template set, and points the developer at `/dflow:new-feature`
as the natural next command.

The V1 CLI clean cut does not migrate or dual-read a legacy root `specs/`
directory. If root `specs/` exists, warn that new Dflow files will be created
under `dflow/specs/`.

**Confirmations** in this flow:
- Step 2 → Step 3: information collected → present file-list preview
- Step 3 → Step 4: file-list confirmed → write

In the CLI, use ordinary yes/no confirmation. In the manual AI fallback,
ask for explicit confirmation in natural language; do not require
the workflow next command for init.

**Ceremony**: this flow is **meta-level** — it sets up the infrastructure
that subsequent T1 / T2 / T3 work will live in. It does not itself produce
a SPEC-ID, feature directory, or branch. It does not count against Ceremony
Scaling.

---

## Step 1: Current-State Inventory

The CLI inspects the project root before prompting.

**Read** (using the Read / Glob / LS tools):
- Is there a `.git` directory? → repo exists
- Is there an existing non-empty `dflow/specs/` directory? → Dflow already initialized; abort
- Is there an empty `dflow/specs/` directory? → continue with existing-file protection
- Is there an existing root `specs/` directory? → legacy / other-tool warning only; do not read, copy, move, or rewrite it
- Is there an existing `CLAUDE.md` at the repo root? → project already
  has AI-collab rules

Report findings plainly:

> "Repo inventory:
>  - `.git`: present
>  - `dflow/specs/`: not yet present → greenfield Dflow setup
>  - `specs/`: present → legacy / other-tool directory; Dflow V1 will not
>    migrate or modify it
>  - `CLAUDE.md`: present → I'll append a marked Dflow block (shown in
>    the preview); a merge snippet only if there's a marker conflict"

Or:

> "Repo inventory:
>  - `dflow/specs/`: already contains files
>  - `CLAUDE.md`: not present
>
>  Dflow already appears initialized here. I will stop rather than risk
>  mixing bootstrap versions."

Classify the scenario:
- **Greenfield**: no `dflow/specs/` at all → create full baseline
- **Empty Dflow namespace**: `dflow/specs/` exists but contains no files → continue
- **Already initialized**: non-empty `dflow/specs/` exists → abort cleanly

**→ Transition (step-internal)**: Step 1 complete. Announce
> "Step 1 complete (current-state inventory). Entering Step 2: Project
> Information."

and continue.

---

## Step 2: Project Information (track-specific intake)

Ask these questions naturally — not as a checklist dump. Skip any
question where Step 1 already gave a confident answer.

### Q1. Project type

> "Is this project greenfield (fresh start with Dflow) or brownfield
> (existing code, now adopting Dflow)?"

Used to seed `_overview.md`'s "現有問題" section (brownfield typically
has backlog issues to document).

### Q2. Tech stack confirmation

> "Confirm the tech stack so I populate the right scaffolding
> variables: current presentation framework or entrypoint stack?
> language? database / ORM / persistence approach?"

Used to substitute `{Framework}` / `{Framework version}` / `{Language}` /
`{ORM / persistence}` / `{ORM version}` placeholders in `_overview.md`.

### Q3. Migration plan

> "Is there an existing plan to migrate this Brownfield project to
> a target architecture?"

If yes → `_overview.md` "Target Architecture Strategy" section is emphasised and
`migration/tech-debt.md` is prioritised. If no → the scaffolding still
mentions the principles (Migration Awareness / Domain Extraction /
Dual-Track Parallel / Pragmatic First) but framed as forward-option. Either
way the answer is recorded in the `Migration / legacy context` row of the AI
agent guide's `## Project Context` table.

### Q4. Project prose language

> "Project prose language for generated spec content? Choose an explicit
> language tag: `zh-TW`, `en`, `ja-JP`, or another BCP-47 tag."

Used to write `dflow/specs/shared/_conventions.md` under `## Prose
Language`. This value is required. Do not accept `any`, `skip`, `later`,
blank input, or prose descriptions such as "Traditional Chinese". Dflow
templates keep canonical English structural language; this setting controls
free prose inside generated spec sections.

### Q5. Git policy (mandatory — pick one)

> "Which Git policy does the team follow? This drives the runtime branch gate
> and the finish-stage merge guidance, so it is required:
>
>   1. GitFlow — long-lived develop / release branches
>   2. Trunk / GitHub Flow — short-lived feature branches (lightest; the
>      default for most GitHub / GitLab teams)"

Required — do not accept a skip. Both policies use feature branches; the choice
only changes finish-stage merge guidance. The selected policy seeds exactly one
`dflow/specs/shared/Git-principles-{gitflow|trunk}.md` (**mandatory, not
optional**) and is recorded in `_conventions.md` under `## Git Policy`.

### Q6. AI commit marker (mandatory — default None)

> "How should AI-made commits be marked? The AI offers to commit at lifecycle
> checkpoints (you can always decline); this sets how those commits are tagged:
>
>   1. None (default) — AI commits look like any other commit
>   2. Co-Authored-By trailer (`dflow-ai <noreply@dflow.local>`) — filterable
>   3. `[ai-assisted]` commit-subject prefix — visible at a glance"

Recorded in `_conventions.md` under `## AI Commit Policy`; the runtime does not
re-ask.

### Q7. Optional starter files (multi-select)

> "Besides the mandatory baseline, which optional starter files do you want me
> to seed?
>
>   - [ ] `dflow/specs/shared/_overview.md` — system overview template"

Wait for answers.

### Q8. AI coding agents (multi-select)

> "Which AI coding agents should Dflow configure?
>
>   - [ ] `AGENTS.md` — Codex / Copilot coding agent
>   - [ ] `CLAUDE.md` — Claude Code
>   - [ ] `.github/copilot-instructions.md` — GitHub Copilot
>
> If you select any agent, Dflow will create
> `dflow/specs/shared/AI-AGENT-GUIDE.md` as the canonical guide. Root-level
> tool files stay thin and point back to that guide. Existing user content is
> never overwritten; Dflow appends a marked Dflow block (shown in the preview)
> and refreshes it in place on re-run. Merge snippets under
> `dflow/specs/shared/` are used only if Dflow markers conflict."

Wait for answers.

### Q9. Project-level skill (agent-gated, default yes)

Asked only when Q8 selected at least one agent — with no agents there is no
projection target and this question is skipped entirely.

> "Install the project-level Dflow skill for natural-language auto-trigger?
> (Y/n)
>
> The skill is what makes requests like 'I want to add a feature' surface the
> matching workflow automatically; without it, triggering relies on the
> instruction files alone and degrades in long sessions. Skill files are
> Dflow-generated derivatives — the recommended default is to gitignore them
> and re-project after cloning."

Wait for the answer. **Blank defaults to yes.** On `n`, tell the developer:

> "Skipped the project-level skill; add it later with
> `dflow configure-agents --skills`."

CLI note: the CLI asks this question only on an interactive terminal. A
non-interactive (piped) `dflow init` never reads an extra stdin answer for it
— existing scripted answer sequences keep their structure and keep working —
and installs the skill for the selected agents by default.

**→ Transition (step-internal)**: Step 2 complete. Announce
> "Step 2 complete (project information captured). Entering Step 3:
> File-list preview."

and continue.

---

## Step 3: File-list Preview

Compute the full list of files that will be created / skipped, based on
Step 1 (current state) + Step 2 (developer choices).

### 3.1 Mandatory baseline (Brownfield track)

These files / directories are **always part of the baseline** — they
are what every Dflow-adopting Brownfield project is expected to have
before `/dflow:new-feature` runs cleanly:

```
dflow/specs/
├── features/
│   ├── active/               # directory (empty)
│   ├── completed/            # directory (empty)
│   └── backlog/              # directory (empty)
├── domain/
│   └── glossary.md           # ← templates/glossary.md
├── shared/
│   └── _conventions.md       # ← scaffolding/_conventions.md (mandatory)
└── migration/
    └── tech-debt.md          # ← templates/tech-debt.md
```

Key Brownfield-track notes:
- `dflow/specs/migration/tech-debt.md` (not `dflow/specs/architecture/tech-debt.md`)
  — Brownfield projects use `migration/` as the cross-cutting directory
  for migration-era concerns. The Greenfield track uses `architecture/`
  instead; this split is an F-05 decision from R7 review.
- **`behavior.md` is NOT generated here.** Per F-05, per-context
  `behavior.md` files are created by `/dflow:new-feature` Step 8.3
  (completion flow) or by the P007a baseline-capture flow at the moment
  the first bounded context is established. Creating empty
  `behavior.md` files here would create stale placeholders.
- `domain/context-map.md` is **not** mandatory in the Brownfield track
  (contexts emerge organically during domain extraction; the Greenfield
  track makes this file mandatory because BCs are usually planned
  up-front).

### 3.2 Optional files (from Step 2 Q7)

Use the packaged scaffolding templates listed below; their project-local
outputs are under `dflow/specs/shared/` (the scaffolding root, not the
vendored workflow bundle). Compute the destination path:

| Scaffolding source | Destination in project |
|---|---|
| `scaffolding/_overview.md` | `dflow/specs/shared/_overview.md` |
| `scaffolding/_conventions.md` | `dflow/specs/shared/_conventions.md` (mandatory baseline) |
| `scaffolding/Git-principles-gitflow.md` | `dflow/specs/shared/Git-principles-gitflow.md` |
| `scaffolding/Git-principles-trunk.md` | `dflow/specs/shared/Git-principles-trunk.md` |
| `scaffolding/AI-AGENT-GUIDE.md` | `dflow/specs/shared/AI-AGENT-GUIDE.md` when at least one AI agent is selected |
| generated tool shim | `AGENTS.md`, `CLAUDE.md`, or `.github/copilot-instructions.md` when selected and missing |
| marked Dflow block | appended to a selected existing tool file unless it already points to `AI-AGENT-GUIDE.md`; refreshed in place on re-run |
| fallback merge snippet | `dflow/specs/shared/*-snippet.md` only when the selected tool file has conflicting or malformed Dflow markers |

### 3.3 Present the preview

Present the complete file list as two tables, separating create / update vs
skip, and wait for developer confirmation:

> "Based on Step 1 inventory + Step 2 answers, here is what I'll do:
>
> **Will create / update ({N} files):**
>
> | Path | Source |
> |---|---|
> | `dflow/specs/features/active/.gitkeep` | (directory placeholder) |
> | `dflow/specs/features/completed/.gitkeep` | (directory placeholder) |
> | `dflow/specs/features/backlog/.gitkeep` | (directory placeholder) |
> | `dflow/specs/domain/glossary.md` | `templates/glossary.md` (mandatory baseline) |
> | `dflow/specs/shared/_conventions.md` | `scaffolding/_conventions.md` (mandatory baseline) |
> | `dflow/specs/migration/tech-debt.md` | `templates/tech-debt.md` (mandatory baseline) |
> | `dflow/specs/shared/_overview.md` | optional (you picked it) |
> | `dflow/specs/shared/Git-principles-trunk.md` | mandatory (selected Git policy) |
> | `dflow/specs/shared/AI-AGENT-GUIDE.md` | selected AI agent guide |
> | `CLAUDE.md` | marked Dflow block appended to existing CLAUDE.md (shown in preview) |
>
> **Will skip ({M} files — already present):**
>
> | Path | Reason |
> |---|---|
> | `dflow/specs/domain/glossary.md` | already exists (47 lines) |
>
> **Not creating** (per F-05 decision):
> - No `dflow/specs/domain/{context}/behavior.md` files. These are created
>   later by `/dflow:new-feature` Step 8.3 or P007a when the first
>   bounded context is established.
> - No `dflow/specs/domain/context-map.md`. Brownfield track treats BCs as
>   emergent from domain extraction; this file becomes relevant later,
>   typically when 2+ contexts coexist.
>
> Looks good? Reply 'yes' to proceed with the writes, or tell me what to
> adjust."

**→ Step Gate: Step 3 → Step 4**

Wait for explicit confirmation. If the developer asks to change the
selection, go back to the relevant Step 2 question (Q5–Q9) and re-run Step 3.

---

## Step 4: Write Files (placeholder fill-in + existing-file protection)

Execute the write plan agreed in Step 3. Use the Write tool (or
mkdir-equivalent for directories).

### 4.1 Existing-file protection (strict)

Before every single write, re-check: does the target path already
exist? If yes, **skip** — do not overwrite. Announce the skip:

> "Skipped `dflow/specs/domain/glossary.md` — already exists (unchanged)."

Only overwrite if the developer said explicitly "overwrite X" in
Step 2 (rare; usually a conscious reset during early adoption).

### 4.2 Placeholder substitution

When writing from `scaffolding/` sources, substitute the placeholders
captured in Step 2:

| Placeholder | Substitution source |
|---|---|
| `{YYYY-MM-DD}` | Today's date (ISO format) |
| `{System Name}` / `{系統名稱}` | From Step 2 or repo folder name |
| `{業務領域}` | From Step 2 Q1 / Q2 context |
| `{Language}` | From Step 2 Q2 |
| `{Framework}` | From Step 2 Q2 |
| `{Framework version}` | From Step 2 Q2 |
| `{ORM / persistence}` | From Step 2 Q2 |
| `{ORM version}` | From Step 2 Q2 |
| `{prose-language}` | From Step 2 Q4 |

For placeholders the developer did not provide, keep the `{placeholder}`
token in the emitted file and add a one-line TODO comment so they
notice:

```markdown
<!-- TODO: fill in 業務領域 on next review -->
```

### 4.3 Special case — AI agent instruction files

If the developer selected any AI coding agent in Q8, create
`dflow/specs/shared/AI-AGENT-GUIDE.md` as the canonical Dflow project
guide.

For each selected tool-specific file (`AGENTS.md`, `CLAUDE.md`,
`.github/copilot-instructions.md`):

(checked in this order — the first matching rule wins):

- if the target file does not exist, create a small shim at the target
  path that points to `dflow/specs/shared/AI-AGENT-GUIDE.md`
- if the target file contains conflicting or malformed Dflow markers, do not
  edit it; write a fallback merge snippet under `dflow/specs/shared/` and
  report that the developer should merge it manually
- if the target file already contains a single well-formed Dflow marked block,
  replace that block in place (idempotent refresh) and keep the rest of the
  file unchanged
- if the target file is an existing whole-file Dflow-generated shim, refresh it
  in place
- if the target file already points to the guide through the developer's own
  pointer (and has no Dflow marked block), leave it untouched
- otherwise preserve the existing content and append a marked Dflow block at
  the end of the file, keeping the file's dominant line ending; show that block
  in the preview, and refresh that same block on re-run. If the developer later
  deletes the block, a later `init` / `configure-agents` run appends it again

If the developer chose to install the project-level skill (Q9), the CLI also
creates the skill file for each selected tool at its native project-level
path:

- `.claude/skills/dflow/SKILL.md` — Claude Code
- `.agents/skills/dflow/SKILL.md` — Codex
- `.github/skills/dflow/SKILL.md` — GitHub Copilot

All three are the same edition-neutral thin skill projected from the single
canonical source in the npm package. An existing file at one of those paths
that is **not** Dflow-generated (missing the
`<!-- dflow-generated: skill-adapter -->` marker) is left unchanged with a
warning. Manual AI fallback (no npm available): do **not** hand-write SKILL.md
content — report that the skill install is deferred and the developer should
run `dflow configure-agents --skills` once npm is available.

### 4.4 Directory-only entries

For directories that Git otherwise wouldn't track (empty `active/` /
`completed/` / `backlog/`), seed a `.gitkeep` file so the directory
persists across clones.

**→ Transition (step-internal)**: Step 4 complete. Announce
> "Step 4 complete (files written). Entering Step 5: Results + next
> steps."

and continue.

---

## Step 5: Results Report + Next-step Recommendation

Summarise what actually happened and point at the next command.

### 5.1 Summary report

```
Init complete. Summary:

  Created / Updated ({N} files):
    ✓ dflow/specs/features/active/.gitkeep
    ✓ dflow/specs/features/completed/.gitkeep
    ✓ dflow/specs/features/backlog/.gitkeep
    ✓ dflow/specs/domain/glossary.md
    ✓ dflow/specs/shared/_conventions.md
    ✓ dflow/specs/migration/tech-debt.md
    ✓ dflow/specs/shared/_overview.md
    ✓ dflow/specs/shared/Git-principles-trunk.md
    ✓ CLAUDE.md (marked Dflow block appended)

  Skipped ({M} files already present):
    - (none this run)

  Deferred (not created here by design):
    - dflow/specs/domain/{context}/behavior.md — created by /dflow:new-feature
      Step 8.3 or P007a baseline capture
    - dflow/specs/domain/context-map.md — created organically when you have
      ≥2 bounded contexts
```

### 5.2 Next-step recommendation

Tailor the recommendation to the Step 1 scenario:

**Greenfield**:

> "Structure is ready. Recommended next step:
>  - Run `/dflow:new-feature` to start your first feature
>    (this will create `dflow/specs/features/active/{SPEC-ID}-{slug}/` and
>    walk you through spec → domain concepts → implementation plan)"

**Brownfield**:

> "Structure is ready. Recommended next step:
>  - First, open `dflow/specs/shared/_overview.md` and fill in the 'Current
>    System State' and 'Known Issues' sections — this gives Dflow
>    context when you triage existing behavior later.
>  - Then run `/dflow:modify-existing` to work from an incoming change
>    request (most common Brownfield entry), or `/dflow:new-feature`
>    for a fresh piece of work.
>  - When you touch a domain concept for the first time, the completion
>    flow will prompt you to baseline it into
>    `dflow/specs/domain/{context}/` — don't try to pre-fill everything
>    up front."

**Already fully set up (Step 1 showed nothing to do)**:

> "Your project already has a complete Dflow layout — nothing to do.
> If you were expecting changes, let me know which file you wanted
> refreshed and I'll skip the safety-net."

### 5.3 Optional: review project-level files

Remind the developer to review files that have `{placeholder}` tokens
still in them:

> "A few files still have `{placeholder}` tokens that need your input:
>  - `dflow/specs/shared/_overview.md`: the Business Domain and Technical
>    Architecture fields (e.g. primary domain, stakeholders, user scale, stack)
>
>  These are fine to leave for now; fill them in during your next
>  review pass."

---

## Notes & references

- Scaffolding templates: packaged in the Dflow tarball; project-local
  outputs land under `dflow/specs/shared/`
- `_index.md` feature template: `dflow/specs/shared/dflow-workflows/templates/_index.md`
  (used by `/dflow:new-feature`, NOT by this flow)
- Git integration rules: `dflow/specs/shared/dflow-workflows/references/git-integration.md`
