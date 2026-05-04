<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Domain Models

> DDD model catalog for one bounded context.

## Context

- **Bounded Context**: {Context name}
- **Source Code Area**: `{project/path/or/namespace}`
- **Last Updated**: {YYYY-MM-DD}

## Aggregates

| Aggregate | Root Entity | Invariants | Code Mapping | Notes |
|---|---|---|---|---|
| {AggregateName} | {RootEntityName} | {核心不變量} | `{Namespace.Class}` | {optional notes} |

## Entities

| Entity | Responsibility | Key Identity | Aggregate | Code Mapping |
|---|---|---|---|---|
| {EntityName} | {核心職責} | {Id / composite key} | {AggregateName} | `{Namespace.Class}` |

## Value Objects

| Value Object | Responsibility | Equality Components | Code Mapping | Notes |
|---|---|---|---|---|
| {ValueObjectName} | {代表的概念} | {fields} | `{Namespace.Class}` | {optional notes} |

## Domain Services

| Service | Responsibility | Inputs / Outputs | Code Mapping | Notes |
|---|---|---|---|---|
| {ServiceName} | {跨 aggregate/entity/value object 的 domain operation} | {inputs -> outputs} | `{Namespace.Class}` | {optional notes} |

## Specifications

| Specification | Rule / Invariant | Used By | Code Mapping | Notes |
|---|---|---|---|---|
| {SpecificationName} | {規則或查詢條件} | {use case / aggregate} | `{Namespace.Class}` | {optional notes} |

## Repository Interfaces

| Repository | Aggregate | Query Responsibility | Code Mapping | Notes |
|---|---|---|---|---|
| {RepositoryName} | {AggregateName} | {查詢或保存責任} | `{Namespace.Interface}` | {optional notes} |
