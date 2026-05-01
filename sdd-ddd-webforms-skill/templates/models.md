<!-- Template maintained by Dflow. See archive/proposals/PROPOSAL-013 for origin. -->

# Domain Models

> Domain model catalog for one bounded context.

## Context

- **Bounded Context**: {Context name}
- **Source Code Area**: `{project/path/or/namespace}`
- **Last Updated**: {YYYY-MM-DD}

## Entities

| Entity | Responsibility | Key Identity | Code Mapping | Notes |
|---|---|---|---|---|
| {EntityName} | {核心職責} | {Id / composite key} | `{Namespace.Class}` | {optional notes} |

## Value Objects

| Value Object | Responsibility | Equality Components | Code Mapping | Notes |
|---|---|---|---|---|
| {ValueObjectName} | {代表的概念} | {fields} | `{Namespace.Class}` | {optional notes} |

## Domain Services

| Service | Responsibility | Inputs / Outputs | Code Mapping | Notes |
|---|---|---|---|---|
| {ServiceName} | {跨 entity/value object 的 domain operation} | {inputs -> outputs} | `{Namespace.Class}` | {optional notes} |

## Repository Interfaces

| Repository | Aggregate / Entity | Query Responsibility | Code Mapping | Notes |
|---|---|---|---|---|
| {RepositoryName} | {EntityName} | {查詢或保存責任} | `{Namespace.Interface}` | {optional notes} |

## Code Mapping Notes

- {domain concept} maps to `{existing WebForms / EF / service code}`.
