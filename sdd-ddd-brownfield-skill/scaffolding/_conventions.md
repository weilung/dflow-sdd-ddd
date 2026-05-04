<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# Spec Writing Conventions — {System Name}

> Created: {YYYY-MM-DD}
> Scope: how spec documents are authored and named in this project.
> Audience: engineers writing specs; AI assistants producing spec drafts.

This file captures **project-level** conventions only. Template shapes
and Ceremony criteria are defined by the Dflow skill; here we just
record how *this* project fills them in.

---

## Where Specs Live

All spec documents live under `dflow/specs/`. The feature directory pattern
and file names follow Dflow (see the Dflow skill § "Project Structure
Reference" for the full tree):

```
dflow/specs/features/active/{SPEC-ID}-{slug}/
├── _index.md                              # Feature dashboard
├── phase-spec-{YYYY-MM-DD}-{slug}.md      # T1 Heavy (one per phase)
└── lightweight-{YYYY-MM-DD}-{slug}.md     # T2 Light (or BUG-{NUMBER}-{slug}.md)
```

T3 Trivial changes do **not** produce a separate file — they are
recorded as one row in `_index.md` Lightweight Changes.

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

### SPEC-ID Format

- Pattern: `SPEC-YYYYMMDD-NNN` (e.g. `SPEC-20260421-001`)
- Per-day counter `NNN` resets daily, starts at `001`
- Once assigned, the SPEC-ID is immutable — it appears in the feature
  directory name, the first phase-spec filename, and the git branch
  name (see `Git-principles-*.md`)

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

---

## Filling the Templates

Dflow ships these templates (do **not** re-inline their content here
— always read the canonical template from the skill):

| Template | Used when |
|----------|-----------|
| `templates/_index.md`          | Creating a feature directory (every feature) |
| `templates/phase-spec.md`      | T1 Heavy — new feature / new phase / architectural change |
| `templates/lightweight-spec.md`| T2 Light — bug fix / small tweak with BR Delta |
| `templates/context-definition.md` | When a new Bounded Context is introduced |
| `templates/behavior.md`        | BC-level consolidated behavior spec |

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

The Dflow skill defines three tiers — **T1 Heavy / T2 Light / T3
Trivial**. See the Dflow skill § "Ceremony Scaling" for the full
criteria table. We do not re-define the tier criteria here; this
section records how *this* project applies them in borderline
situations.

| Situation (project-specific) | Tier we default to | Why |
|------------------------------|--------------------|-----|
| {e.g. Year-end reporting tweak without BR change} | T2 | Touches logic path even though no new BR; extract to `lightweight-spec.md` for trace |
| {e.g. Pure label / display text translation} | T3 | No BR change; inline row in `_index.md` |
| {e.g. UI refresh across multiple pages} | T1 (project convention) | We treat multi-page UI refresh as T1 for this project even though Dflow default would be T2, because our WebForms UI changes often leak into Code-Behind |

If the team disagrees on tier classification for a specific change,
run through the T3 four-criteria checklist (in the Dflow skill) and
record the decision here the first time it arises.

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
- Dflow skill SKILL.md — canonical source for Ceremony Scaling, flow
  selection, and template shapes.
