# Examples by Stack

> A per-stack appendix to Dflow templates. Dflow itself is language- and
> framework-agnostic; this document shows what canonical placeholders
> (`{Language}` / `{Framework}` / `{Framework version}` / `{ORM / persistence}`
> / `{ORM version}` / `{Mediator}` / `{Test framework}`) and stack-neutral
> prose look like once filled in for common stacks.
>
> **How to use this**: after running `dflow init`, open
> `dflow/specs/shared/_overview.md` and your root `CLAUDE.md`. Replace
> placeholder rows / directory trees / dependency lists with the snippets
> from your stack's section below. Adapt as needed — these are starting
> points, not prescriptions.

## Index

- [.NET / ASP.NET Core (Greenfield)](#net--aspnet-core-greenfield)
- [.NET / ASP.NET WebForms (Brownfield)](#net--aspnet-webforms-brownfield)
- [Java / Spring Boot (Greenfield)](#java--spring-boot-greenfield) — Kotlin/Spring same pattern
- [Node.js / TypeScript / NestJS (Greenfield)](#nodejs--typescript--nestjs-greenfield)
- [Python / FastAPI (Greenfield)](#python--fastapi-greenfield) — Django/Flask similar
- [Go / Gin (Greenfield)](#go--gin-greenfield)
- [PHP / Laravel (Brownfield migration)](#php--laravel-brownfield-migration)

Each section provides:

1. **`_overview.md` stack table** — substituted canonical placeholders
2. **Project layout** — idiomatic directory / package convention
3. **Domain purity check** — the stack's equivalent of "no delivery-framework references" (used in Git-principles checklist)
4. **Test framework** — what `{Test framework}` resolves to

---

## .NET / ASP.NET Core (Greenfield)

### `_overview.md` stack table

```markdown
| Item | Choice |
|------|--------|
| Language | C# 12 |
| Framework | ASP.NET Core 9 |
| ORM / persistence | Entity Framework Core 9 |
| Mediator | MediatR 12 |
| Test framework | xUnit |
| Database | PostgreSQL 16 |
| Auth | JWT bearer / OIDC via Azure AD |
| Hosting | Azure App Service |
```

### Project layout

```
src/
├── {Project}.Domain/                   # Aggregates, Value Objects, Domain Events
│   ├── Common/                         # Entity, AggregateRoot, ValueObject base classes
│   ├── {BoundedContext}/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Services/
│   │   └── Interfaces/                 # Repository / external service interfaces
│   └── SharedKernel/
├── {Project}.Application/              # CQRS handlers, validators, DTOs
│   ├── Common/
│   └── {BoundedContext}/
│       ├── Commands/
│       ├── Queries/
│       ├── DTOs/
│       └── EventHandlers/
├── {Project}.Infrastructure/           # EF Core DbContext, repository impls
│   ├── Persistence/
│   ├── Repositories/
│   └── ExternalServices/
└── {Project}.WebAPI/                   # Presentation: HTTP endpoints

tests/
├── {Project}.Domain.UnitTests/
├── {Project}.Application.UnitTests/
└── {Project}.Integration.Tests/
```

### Domain purity check

The Domain project's `.csproj` should have **zero** package references
outside the allow-list (typically just the `SharedKernel`). Specifically
forbid:

- `Microsoft.AspNetCore.*`, `System.Web`
- `Microsoft.EntityFrameworkCore.*` (Domain declares interfaces; Infrastructure references EF Core)
- `HttpContext`, `HttpRequest`, `ISession`
- `Newtonsoft.Json` / `System.Text.Json` attributes on Domain entities

CI check example: `dotnet list package` on Domain.csproj — fail if any
disallowed dependency appears.

### Test framework

`xUnit` + `FluentAssertions` + `NSubstitute`. Run with `dotnet test`.

---

## .NET / ASP.NET WebForms (Brownfield)

### `_overview.md` stack table

```markdown
| Item | Current |
|------|---------|
| Language | C# 7 (.NET Framework 4.8) |
| Framework | ASP.NET WebForms 4.8 |
| ORM / persistence | Entity Framework 6 (or ADO.NET / Dapper) |
| Test framework | xUnit / NUnit |
| Database | SQL Server 2019 |
| UI | WebForms .aspx + Code-Behind + Bootstrap |
| Auth | Forms authentication / Windows auth |
| Hosting | IIS on-prem |
| Target architecture | ASP.NET Core 8 + Clean Architecture |
```

### Project layout

```
src/
├── Domain/                             # Extracted domain logic (framework-pure)
│   ├── {BoundedContext}/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   └── Services/
│   └── SharedKernel/
└── WebForms/                           # Existing .aspx + .aspx.cs (Code-Behind)
    └── Pages/
```

### Domain purity check

The Domain assembly must not reference:

- `System.Web.*`, `System.Web.UI.*`
- `HttpContext.Current`, `Session[…]`, `ViewState[…]`
- Page lifecycle types (`Page`, `Control`)
- EF6 attributes on Domain entities (use Fluent API in a separate
  configuration class outside Domain)

CI check: project reference analyzer on `src/Domain/Domain.csproj`.

### Test framework

`xUnit` or `NUnit`. Run with `dotnet test` or `nunit3-console`.

---

## Java / Spring Boot (Greenfield)

> Same pattern applies to Kotlin/Spring with minor syntax differences.

### `_overview.md` stack table

```markdown
| Item | Choice |
|------|--------|
| Language | Java 21 |
| Framework | Spring Boot 3.3 |
| ORM / persistence | Spring Data JPA / Hibernate 6.5 |
| Mediator | (none — direct service injection; optional: Spring Modulith) |
| Test framework | JUnit 5 + AssertJ + Mockito |
| Database | PostgreSQL 16 |
| Auth | Spring Security + OAuth2 / OIDC |
| Hosting | Kubernetes / managed app platform |
```

### Project layout

```
src/
├── main/
│   └── java/com/example/{system}/
│       ├── domain/                     # Aggregates, Value Objects, Domain Events
│       │   ├── common/                 # Base classes (Entity, AggregateRoot, ValueObject)
│       │   ├── {boundedcontext}/
│       │   │   ├── entity/
│       │   │   ├── valueobject/
│       │   │   ├── event/
│       │   │   ├── service/
│       │   │   └── repository/         # Repository interfaces (NOT implementations)
│       │   └── sharedkernel/
│       ├── application/                # Command/Query handlers, DTOs
│       │   ├── command/
│       │   ├── query/
│       │   └── dto/
│       ├── infrastructure/             # JPA repositories, external clients
│       │   ├── persistence/
│       │   └── client/
│       └── web/                        # Controllers, REST endpoints
└── test/
    └── java/com/example/{system}/
        ├── domain/                     # Unit tests
        ├── application/
        └── web/                        # @SpringBootTest integration
```

Multi-module Maven/Gradle layouts (one module per layer) are also common
and recommended for stricter dependency enforcement.

### Domain purity check

The Domain package must not import:

- `org.springframework.*` (no Spring annotations on Domain entities)
- `jakarta.persistence.*` / `javax.persistence.*` (no JPA annotations on
  Domain entities; use a separate JPA mapping class in Infrastructure)
- `jakarta.servlet.*` (no HTTP types)
- `com.fasterxml.jackson.*` (no serialization annotations on Domain)

CI check: ArchUnit rule `noClasses().that().resideInAPackage("..domain..")
.should().dependOnClassesThat().resideInAnyPackage("org.springframework..", "jakarta.persistence..")`.

### Test framework

`JUnit 5` (`org.junit.jupiter`). Run with `./mvnw test` or `./gradlew test`.

---

## Node.js / TypeScript / NestJS (Greenfield)

### `_overview.md` stack table

```markdown
| Item | Choice |
|------|--------|
| Language | TypeScript 5.4 |
| Framework | NestJS 10 |
| ORM / persistence | Prisma 5 (or TypeORM / MikroORM) |
| Mediator | (none — NestJS providers; optional: nestjs-cqrs module) |
| Test framework | Vitest (or Jest) + supertest |
| Database | PostgreSQL 16 |
| Auth | Passport (JWT, OAuth2) |
| Hosting | Containerized (Docker / Kubernetes / Fly.io) |
```

### Project layout

```
src/
├── domain/                             # Aggregates, Value Objects, Domain Events
│   ├── common/                         # Base classes
│   ├── {bounded-context}/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── events/
│   │   ├── services/
│   │   └── repositories/               # Interfaces only
│   └── shared-kernel/
├── application/                        # Use cases, command/query handlers
│   ├── commands/
│   ├── queries/
│   └── dtos/
├── infrastructure/                     # Prisma client, external API clients
│   ├── persistence/
│   └── external/
└── presentation/                       # NestJS controllers, modules
    └── http/

test/
├── domain/
├── application/
└── e2e/
```

### Domain purity check

`src/domain/` files must not import:

- `@nestjs/*` (no `@Injectable`, `@Module`, decorators on Domain)
- `@prisma/client` (Prisma generated client lives in Infrastructure only)
- `express` / `fastify` types
- `class-transformer` / `class-validator` (use plain TS types; validation
  in Application layer)

CI check: ESLint rule `no-restricted-imports` scoped to `src/domain/**` or
`dependency-cruiser` rule forbidding cross-layer imports.

### Test framework

`Vitest` (or `Jest`). Run with `npm test` or `pnpm test`.

---

## Python / FastAPI (Greenfield)

> Django and Flask follow the same layered pattern with framework-specific
> presentation conventions. Django: views/templates as presentation;
> Flask: blueprints; FastAPI: routers.

### `_overview.md` stack table

```markdown
| Item | Choice |
|------|--------|
| Language | Python 3.12 |
| Framework | FastAPI 0.115 |
| ORM / persistence | SQLAlchemy 2.0 + Alembic (or SQLModel) |
| Mediator | (none — typed dependency injection via FastAPI Depends) |
| Test framework | pytest + pytest-asyncio |
| Database | PostgreSQL 16 |
| Auth | OAuth2 via fastapi.security (PasswordBearer / JWT) |
| Hosting | Containerized (Docker / Kubernetes / Fly.io) |
```

### Project layout

```
src/
├── domain/                             # Aggregates, Value Objects, Domain Events
│   ├── common/
│   ├── {bounded_context}/
│   │   ├── entities.py
│   │   ├── value_objects.py
│   │   ├── events.py
│   │   ├── services.py
│   │   └── repositories.py             # Protocol / abstract base classes
│   └── shared_kernel/
├── application/                        # Use cases, DTOs
│   ├── commands/
│   ├── queries/
│   └── dtos/
├── infrastructure/                     # SQLAlchemy models, external clients
│   ├── persistence/
│   └── external/
└── presentation/                       # FastAPI routers
    └── api/

tests/
├── domain/
├── application/
└── integration/
```

### Domain purity check

`src/domain/` modules must not import:

- `fastapi` / `starlette`
- `sqlalchemy.*` (use Protocols / dataclasses in Domain; SQLAlchemy models
  live in Infrastructure as separate mapping classes)
- `pydantic.BaseModel` for Domain entities (use `dataclass` or plain
  classes; Pydantic models belong in DTO / API layer)

CI check: `import-linter` (`importlinter.org`) contract forbidding Domain
imports of presentation/infrastructure packages.

### Test framework

`pytest`. Run with `pytest` or `python -m pytest`.

---

## Go / Gin (Greenfield)

### `_overview.md` stack table

```markdown
| Item | Choice |
|------|--------|
| Language | Go 1.22 |
| Framework | Gin 1.10 (or Echo / Chi) |
| ORM / persistence | GORM v2 (or sqlx / pgx) |
| Mediator | (none — interface-based dispatch) |
| Test framework | go test + testify |
| Database | PostgreSQL 16 |
| Auth | JWT middleware / OAuth2 |
| Hosting | Containerized (Docker / Kubernetes / Fly.io) |
```

### Project layout

```
{module-root}/
├── cmd/
│   └── api/main.go                     # Application entrypoint
├── internal/
│   ├── domain/                         # Aggregates, Value Objects, Domain Events
│   │   ├── common/
│   │   ├── {boundedcontext}/
│   │   │   ├── entity.go
│   │   │   ├── valueobject.go
│   │   │   ├── event.go
│   │   │   ├── service.go
│   │   │   └── repository.go           # Interface only
│   │   └── sharedkernel/
│   ├── application/                    # Use cases
│   │   ├── command/
│   │   └── query/
│   ├── infrastructure/                 # GORM repo impls, external clients
│   │   ├── persistence/
│   │   └── external/
│   └── handler/                        # HTTP handlers (Gin routes)
└── go.mod
```

`internal/` enforces Go's import boundary — packages outside the module
cannot import from `internal/...`.

### Domain purity check

`internal/domain/` packages must not import:

- `github.com/gin-gonic/gin` or any HTTP router package
- `gorm.io/gorm` (Domain declares repository interfaces; GORM lives in
  Infrastructure)
- `net/http` types (`http.Request`, `http.ResponseWriter`)
- Encoding tags (e.g. `gorm:"primaryKey"`, `json:"..."`) on Domain
  entities — keep tag-free, do encoding via separate Infrastructure
  models

CI check: `go vet` plus a custom `go-arch-lint` or `golangci-lint` rule
forbidding `internal/domain` from importing the above.

### Test framework

`go test` (standard library) + `stretchr/testify` for assertions.
Run with `go test ./...`.

---

## PHP / Laravel (Brownfield migration)

> Older PHP monoliths (Symfony 2/3, CodeIgniter, custom) follow similar
> extraction patterns; the snippets below are for a modern Laravel app
> already on Laravel 10+ that wants to introduce a Domain layer.

### `_overview.md` stack table

```markdown
| Item | Current |
|------|---------|
| Language | PHP 8.3 |
| Framework | Laravel 11 |
| ORM / persistence | Eloquent ORM (Active Record pattern — see Domain note) |
| Test framework | PHPUnit 11 (or Pest 2) |
| Database | MySQL 8 / MariaDB 10 |
| UI | Blade templates / Inertia + Vue / API-only |
| Auth | Laravel Breeze / Sanctum / Passport |
| Hosting | Laravel Forge / shared hosting / containerized |
| Target architecture | Same Laravel + extracted Domain layer + repository abstractions |
```

### Project layout

```
app/
├── Domain/                             # Extracted domain logic (framework-pure)
│   ├── Common/
│   ├── {BoundedContext}/
│   │   ├── Entities/                   # Plain PHP classes (NOT Eloquent models)
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Services/
│   │   └── Repositories/               # Interfaces only
│   └── SharedKernel/
├── Application/                        # Use cases, command/query handlers
│   ├── Commands/
│   └── Queries/
├── Infrastructure/                     # Eloquent repository implementations
│   ├── Persistence/
│   │   ├── Eloquent/                   # Eloquent models live HERE, not in Domain
│   │   └── Repositories/
│   └── External/
├── Http/                               # Controllers, middleware (Laravel-managed)
│   ├── Controllers/
│   └── Middleware/
└── Providers/

tests/
├── Unit/Domain/
├── Feature/Application/
└── Feature/Http/
```

### Domain purity check

`app/Domain/` classes must not extend / use:

- `Illuminate\Database\Eloquent\Model` (Eloquent models are Infrastructure)
- `Illuminate\Http\Request` / `Response`
- `Illuminate\Support\Facades\*` (DB, Auth, Cache, etc.)
- Laravel attribute / trait magic on Domain entities

CI check: a Laravel-aware static analysis rule (Larastan / PHPStan with a
custom architecture rule) forbidding `app/Domain/` from referencing the
above.

### Test framework

`PHPUnit` (`phpunit/phpunit`) or `Pest` (`pestphp/pest`). Run with
`./vendor/bin/phpunit` or `./vendor/bin/pest`.

---

## Adding your stack

If your stack isn't listed (Rust, Ruby/Rails, Kotlin native, Elixir, etc.),
the pattern is always the same:

1. Identify your stack's **domain layer convention** (folder / package /
   namespace where pure business code lives)
2. Identify the **delivery / entrypoint layer** (controllers, handlers,
   routes, CLI commands, message consumers, job runners)
3. Identify the **persistence layer** (ORM, query builder, raw driver)
4. Domain purity check = "no imports / usings / extends from delivery,
   persistence, or framework runtime packages"
5. Express the layer separation in a CI-enforceable rule appropriate to
   the stack (ArchUnit, ESLint, import-linter, go-arch-lint, Larastan,
   etc.)

Contributions of additional stacks via PR are welcome.
