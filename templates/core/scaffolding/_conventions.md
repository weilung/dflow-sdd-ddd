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
and file names follow Dflow (see the Dflow skill § "Project Structure"
for the full tree):

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
  conventions here, e.g. "bounded context name shortenings",
  "Aggregate name → slug rules"; otherwise leave empty}
- **Length target**: 2–4 English words or 2–6 Chinese characters
  (Dflow skill guidance)

---

## Filling the Templates

Dflow ships these templates (do **not** re-inline their content here
— always read the canonical template from the skill):

| Template | Used when |
|----------|-----------|
| `templates/_index.md`           | Creating a feature directory (every feature) |
| `templates/phase-spec.md`       | T1 Heavy — new feature / new phase / architectural change |
| `templates/lightweight-spec.md` | T2 Light — bug fix / small tweak with BR Delta |
| `templates/context-definition.md` | When a new Bounded Context is introduced |
| `templates/aggregate-design.md` | When a new Aggregate is introduced |
| `templates/behavior.md`         | BC-level consolidated behavior spec |

Project-specific guidance when filling these templates:

### DDD-specific spec conventions

- **Aggregate identification**: every phase-spec that introduces new
  behavior should explicitly name the Aggregate involved. If the
  change spans Aggregates, call that out in the spec's "Domain
  Modeling" section and explain the integration strategy (Domain
  Event? Query? ACL?).
- **Domain Events documentation**: events belong in
  `dflow/specs/domain/{context}/events.md`. When a phase-spec introduces or
  modifies an event, update `events.md` during Step 8.3 sync — do not
  only update it in the feature-level spec.
- **Aggregate state transitions**: for phase-specs that change
  Aggregate state, include explicit "state-before → state-after"
  descriptions (Mermaid state diagram or Given / When / Then + "And
  the Aggregate is in state X").
- **CQRS split**: commands (write) vs queries (read) should be
  identified during Phase 4 (Implementation Planning). Commands
  generally map 1:1 to an Aggregate method; queries bypass the
  Domain layer and read projections.

### Project-specific fill-ins

- {e.g. "All Money amounts use the `Money` value object with explicit
  currency; do not use `decimal` for money in the Domain layer."}
- {e.g. "Every Aggregate has a `CreatedAt` / `LastModifiedAt`
  shadow property; this is implemented in the Infrastructure layer
  EF configuration, not in the Domain."}
- {e.g. "Pagination for queries uses `PagedResult<T>` defined in
  SharedKernel."}

---

## Ceremony Scaling (Project Application)

The Dflow skill defines three tiers — **T1 Heavy / T2 Light / T3
Trivial**. See the Dflow skill § "Ceremony Scaling" for the full
criteria table. We do not re-define the tier criteria here; this
section records how *this* project applies them in borderline
situations.

| Situation (project-specific) | Tier we default to | Why |
|------------------------------|--------------------|-----|
| {e.g. New Aggregate} | T1 + `aggregate-design.md` | Crosses Aggregate boundary and needs invariant documentation |
| {e.g. Adding a Query only (no write)} | T2 | No Aggregate state change, but goes through Application layer; trace via lightweight-spec |
| {e.g. EF configuration tweak in Infrastructure} | T3 if no Domain change | Infra-only; inline row in `_index.md` |
| {e.g. Domain Event payload extension} | T1 | Event contract change affects cross-context consumers |

### DDD Modeling Depth (Dflow skill § Ceremony Scaling)

The Dflow skill further distinguishes:

- **Full** (new Aggregate / new BC): use `templates/aggregate-design.md`
  + update `context-map.md` + define events in `events.md`
- **Standard** (feature within existing BC, existing Aggregate):
  confirm Aggregate ownership + update `models.md` / `rules.md`
- **T2 / T3**: confirm the fix lands in the correct layer; no
  design-level updates required

Use this table to record project-specific interpretation if needed.

---

## Glossary Consistency

All business terms in spec documents must use names defined in
`dflow/specs/domain/glossary.md`. When a new term appears:

1. Check glossary first
2. If missing, add it **before** using the term in a spec
3. Cross-reference the BC the term belongs to
4. If the term maps to a code construct (Aggregate / VO / Event), add
   the `Code Mapping` column value

This rule is enforced by the Dflow skill during `/dflow:new-feature`
and `/dflow:new-phase` flows; the project-level convention is simply
"don't bypass the glossary update."

---

## Related Documents

- [System overview](_overview.md)
- [Git principles](Git-principles-{gitflow|trunk}.md)
- [Context map](../domain/context-map.md)
- [Glossary](../domain/glossary.md)
- Dflow skill `SKILL.md` — canonical source for Ceremony Scaling, flow
  selection, and template shapes.
- Dflow skill `references/ddd-modeling-guide.md` — DDD tactical
  pattern reference.
