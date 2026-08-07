<!-- Seeded by Dflow. -->

# Spec Writing Conventions — {System Name}

> Created: {YYYY-MM-DD}
> Dflow Version: {dflow-version}
> Scope: how spec documents are authored and named in this project.
> Audience: engineers writing specs; AI assistants producing spec drafts.

This file captures **project-level** conventions only. Template shapes
and Ceremony criteria are defined by Dflow itself (the Ceremony tier criteria
live in `AI-AGENT-GUIDE.md` § Ceremony Scaling; template shapes live in the
workflow bundle); here we just record how *this* project fills them in.

---

## Where Specs Live

All spec documents live under `dflow/specs/`. The feature directory pattern
and file names follow Dflow (see `AI-AGENT-GUIDE.md` § Source of Truth
for the full tree):

```
dflow/specs/features/active/{SPEC-ID}-{slug}/
├── _index.md                              # Feature dashboard
├── phase-spec-{YYYY-MM-DD}-{slug}.md      # T1 Heavy (one per phase)
└── lightweight-{YYYY-MM-DD}-{slug}.md     # T2 Light (or BUG-{NUMBER}-{slug}.md)
```

T3 Trivial changes do **not** produce a separate file — they are
recorded as one row in `_index.md` Lightweight Changes.

### SPEC-ID Format

- Pattern: `SPEC-YYYYMMDD-NNN` (e.g. `SPEC-20260421-001`)
- Per-day counter `NNN` resets daily, starts at `001`
- Once assigned, the SPEC-ID is immutable — it appears in the feature
  directory name, the first phase-spec filename, and the git branch
  name (see `Git-principles-*.md`)
- **Minimal (zero-phase) host exception.** A host that records a small
  standalone or follow-up change — or a baseline capture — carries **no
  phase-spec**, so there is no phase-spec filename for the SPEC-ID to appear
  in; the directory name and the branch carry it. A **functional bug** host
  goes one step further: its branch is `bugfix/BUG-{NUMBER}-{slug}`, so it
  carries the BUG-NUMBER and not the SPEC-ID at all. In every case the host
  `_index.md` `branch:` field is authoritative, and the SPEC-ID itself stays
  immutable. Do not create a phase-spec, or rename a branch, to make the
  three-name rule above hold.

### Slug Conventions (Project-Specific Fill-In)

- **Language**: follow the language the feature is discussed in (Dflow
  skill policy); no translation is forced. Both Chinese and English
  slugs are valid.
- **Project-specific term list**: {fill in project-specific abbreviation
  conventions here, e.g. "payroll → pr", "expense report → exp-rpt"
  if your team has house-style shortenings; otherwise leave this
  section empty}
- **Length target**: 2–4 English words or 2–6 Chinese characters
  (Dflow skill guidance)

## Prose Language

Project prose language: `{prose-language}`

Dflow templates keep canonical English structural language: headings,
table headers, fixed labels, placeholders, IDs, anchors, and code-facing
terms remain English.

Free prose written inside those sections should follow the project prose
language:

- `en`: write free prose in English.
- `zh-TW`: write free prose in Traditional Chinese.
- `{xx-XX}`: write free prose in that explicit BCP-47 language.

Do not translate code identifiers, DDD pattern names, BR IDs, SPEC IDs,
file paths, branch names, anchors, or inline code only to satisfy the
prose-language setting.

---

## Filling the Templates

Dflow ships these templates (do **not** re-inline their content here
— always read the canonical template from the skill):

| Template | Used when |
|----------|-----------|
| `templates/_index.md`          | Creating a feature directory (every feature) |
| `templates/phase-spec.md`      | T1 Heavy |
| `templates/lightweight-spec.md`| T2 Light — classic BR-delta form, or one of the no-BR family variants (presentation, non-breaking contract, operational / security, performance, implementation defect, intentional change) |
| `templates/context-definition.md` | When a new Bounded Context is introduced |
| `templates/behavior.md`        | BC-level consolidated behavior spec |

Which tier applies is decided by the cascade in `AI-AGENT-GUIDE.md` § Ceremony
Scaling, never by this table — these rows only say which template a tier uses.

Project-specific guidance when filling these templates:

- {e.g. "Always reference existing BRs in the BR Snapshot inherited
  column if the feature extends existing rules. Check `dflow/specs/domain/
  {context}/rules.md` first."}
- {e.g. "For financial scenarios, currency and precision must be
  explicit in every Given/When/Then."}
- {e.g. "When a phase-spec touches the Expense context, mention
  Payroll integration in Delta if the rule affects month-end
  processing."}

---

## Ceremony Scaling (Project Application)

Dflow defines three tiers — **T1 Heavy / T2 Light / T3 Trivial** — plus a
below-workflow level. See `AI-AGENT-GUIDE.md` § Ceremony Scaling for the
full ordered cascade. We do not re-define the tier criteria here; this
section records how *this* project applies them in borderline
situations.

**The cascade result is a floor: rows in this section may only escalate a
tier, never lower it.** A row may take a change Dflow would call T2 and
make it T1 for this project; no row may lower a T1, and no row may move a
tracked change below workflow.

Write `T<n> (project convention)` in the Tier column when this project raises the
tier, and `cascade result` when it adds an obligation but no tier change. Do not
write a bare tier — that restates the cascade instead of recording a decision,
and it is how the two drift apart.

| Situation (project-specific) | Tier we default to | Why |
|------------------------------|--------------------|-----|
| {e.g. Year-end reporting tweak without BR change} | cascade result + a `lightweight-spec.md` trace | No tier change — we want the trace even when the cascade would not require a spec file, because the reporting logic path is where our defects hide |
| {e.g. Pure label / display text wording polish on one screen} | cascade result + note in the extraction log | No tier change — we add the note so the delivery-layer sweep can find it later |
| {e.g. UI refresh across multiple entrypoints} | T1 (project convention) | We escalate multi-entrypoint UI/API refresh above whatever the cascade returns, because these changes often leak into business logic embedded in delivery/entrypoint code (presentation/UI layer, controllers, handlers, jobs, message consumers, data pipelines, or stored procedures) |

If the team disagrees on tier classification for a specific change,
run through the ordered cascade (in `AI-AGENT-GUIDE.md` §
Ceremony Scaling) and record the decision here the first time it arises.

---

## Glossary Consistency

All business terms in spec documents must use names defined in
`dflow/specs/domain/glossary.md`. When a new term appears:

1. Check glossary first
2. If missing, add it **before** using the term in a spec
3. Cross-reference the BC the term belongs to

This rule is enforced by the Dflow skill during `/dflow:new-feature`
and `/dflow:new-phase` flows; the project-level convention is simply
"don't bypass the glossary update."

---

## Related Documents

- [System overview](_overview.md)
- [Git principles](Git-principles-{gitflow|trunk}.md)
- [Glossary](../domain/glossary.md)
- `AI-AGENT-GUIDE.md` — canonical source for Ceremony Scaling, flow
  selection, and template shapes.
