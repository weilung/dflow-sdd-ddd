<!-- Maintenance contract for Dflow. See proposals/PROPOSAL-013 §4 for origin. -->

# Template Coverage Matrix

This file is a maintenance contract for Dflow, not the runtime brain. `SKILL.md` should point to this matrix for review and maintenance work instead of duplicating the full table.

The matrix lists WebForms / Core logical template parity so reviewers can check which templates should remain aligned and which differences are intentional.

## Matrix

| Logical document | Generated / maintained path | WebForms template | Core template | Parity requirement | Allowed differences | Section anchors |
|---|---|---|---|---|---|---|
| Feature dashboard | `dflow/specs/features/{active\|completed}/{SPEC-ID}-{slug}/_index.md` | `templates/_index.md` | `templates/_index.md` | Required sections same | Core may mention Aggregate / Domain Events | `current-br-snapshot`, `lightweight-changes` |
| Phase spec | `dflow/specs/features/active/{SPEC-ID}-{slug}/phase-spec-YYYY-MM-DD-{slug}.md` | `templates/phase-spec.md` | `templates/phase-spec.md` | Lifecycle sections same | Core has layer-by-layer plan + Domain Events | `implementation-tasks`, `behavior-scenarios`, `open-questions` |
| Lightweight spec | `dflow/specs/features/active/{SPEC-ID}-{slug}/lightweight-YYYY-MM-DD-{slug}.md` or `BUG-{NUMBER}-{slug}.md` | `templates/lightweight-spec.md` | `templates/lightweight-spec.md` | T2 structure and task checklist intent same | Layer tags differ | `implementation-tasks` |
| Glossary | `dflow/specs/domain/glossary.md` | `templates/glossary.md` | `templates/glossary.md` | Same columns | none | - |
| Bounded Context definition | `dflow/specs/domain/{context}/context-definition.md` | `templates/context-definition.md` | `templates/context-definition.md` | Same purpose / structural sections | Core may reference Aggregate / Domain Service / Repository Interface | - |
| Rules index | `dflow/specs/domain/{context}/rules.md` | `templates/rules.md` | `templates/rules.md` | BR-ID / anchor / status format same | Core may include Aggregate column | `business-rules` |
| Models catalog | `dflow/specs/domain/{context}/models.md` | `templates/models.md` | `templates/models.md` | Same purpose | Core has Aggregate / Specification depth | - |
| Aggregate worksheet | `dflow/specs/domain/{context}/aggregates/{name}.md` (per Aggregate, on demand) | n/a | `templates/aggregate-design.md` | Core only | WebForms does not use the Aggregate worksheet | - |
| Behavior snapshot | `dflow/specs/domain/{context}/behavior.md` | `templates/behavior.md` | `templates/behavior.md` | BR anchor and drift-verification structure same | Core may reference Domain Events | `behavior-scenarios` |
| Events catalog | `dflow/specs/domain/{context}/events.md` | n/a | `templates/events.md` | Core only | WebForms does not require event catalog | - |
| Context map | `dflow/specs/domain/context-map.md` | `templates/context-map.md` optional | `templates/context-map.md` mandatory | Similar concept | WebForms optional / emergent | - |
| Tech debt | WebForms: `dflow/specs/migration/tech-debt.md`; Core: `dflow/specs/architecture/tech-debt.md` | `templates/tech-debt.md` | `templates/tech-debt.md` | Same backlog intent | WebForms migration focus; Core architecture focus | - |
| ADR guide | `dflow/specs/architecture/decisions/README.md` | n/a | `scaffolding/architecture-decisions-README.md` | Core only | WebForms not applicable | - |
| Project AI guide | `<project root>/CLAUDE.md` | `templates/CLAUDE.md` | `templates/CLAUDE.md` | H2 navigation and H3 structural headings aligned (canonical English, per F-01 Path A); special root-level exception outside `dflow/specs/` so AI tools can discover it | Core includes Aggregate / Architecture Decisions and other Core-specific H3 sections | - |

## Section Anchors

The `Section anchors` column is the single maintenance location for template section anchor coverage. Do not create a separate `SECTION-ANCHORS.md`.

When adding a new anchor:

1. Add the anchor definition to PROPOSAL-013 §1 "Important Dflow-updated sections" or its successor governance document.
2. Add the anchor id to the matching row in this matrix.
3. Follow the anchor naming / namespacing / versioning rules defined in PROPOSAL-013 §1.
