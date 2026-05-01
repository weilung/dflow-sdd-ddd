<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Architecture Decisions

This directory stores Architecture Decision Records (ADRs) for decisions that affect architecture, bounded contexts, cross-cutting policies, integrations, or long-term maintainability.

## ADR Naming Convention

Use a stable numeric prefix and a short kebab-case title:

```text
ADR-0001-short-decision-title.md
ADR-0002-another-decision.md
```

## When To Write An ADR

Write an ADR when a decision:

- Changes architectural boundaries, dependency direction, or layer responsibilities.
- Introduces or rejects a major technology, integration pattern, persistence strategy, or deployment approach.
- Creates a trade-off that future maintainers need to understand.
- Resolves a recurring design debate that should not be reopened without new evidence.

## Minimal ADR Fields

Each ADR should include:

- **Status**: proposed / accepted / superseded / deprecated
- **Date**: YYYY-MM-DD
- **Context**: the forces, constraints, and problem being addressed
- **Decision**: the chosen approach
- **Consequences**: expected benefits, trade-offs, and follow-up work
- **Related Specs / BR-IDs**: links to relevant specs, rules, or implementation references
