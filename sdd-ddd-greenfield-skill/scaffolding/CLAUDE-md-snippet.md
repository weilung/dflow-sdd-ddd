<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# CLAUDE.md Snippet — Dflow Adoption (Greenfield track)

> Source: `scaffolding/CLAUDE-md-snippet.md`
> Purpose: a minimal block you paste into (or replace with) your
> project's root `CLAUDE.md` when adopting Dflow.
> For the Greenfield track, the full reference template lives in the
> in-project bundle at
> `dflow/specs/shared/dflow-workflows/templates/CLAUDE.md` (projected by
> `dflow init`) — if you want the complete legacy Claude-specific version,
> use that instead. New CLI init output uses `AI-AGENT-GUIDE.md` plus a
> generated `CLAUDE.md` shim.

---

## How to use this snippet

- New Dflow CLI init output (`dflow init`, or `npx dflow-sdd-ddd init` when
  using the no-install path) uses `dflow/specs/shared/AI-AGENT-GUIDE.md` as
  the canonical guide and creates a thin `CLAUDE.md` shim that points back to it.
- Use this legacy snippet only if you intentionally want the older
  Claude-specific two-H2 layout in your project's root `CLAUDE.md`.

The two-H2 structure (`System Context` / `Development Workflow`) is intentional and must be
preserved — it matches the Dflow skill's `templates/CLAUDE.md` and
keeps every project's `CLAUDE.md` scannable for AI in the same shape.

---

## Snippet to merge into `CLAUDE.md`

```markdown
# Project: {系統名稱} — Clean Architecture + DDD

**重要：所有開發工作都必須遵循本文件定義的流程。**

---

## System Context

> 技術棧、架構、業務領域、目錄結構

### Background

- **Business Domain**: {業務領域概述，e.g. "企業差旅費用申報與核銷"}
- **Users / Customers**: {使用者 / 客戶描述}
- **Team**: {團隊組成；e.g. "全端工程團隊，3-5 人；DDD 經驗中等"}
- **Dflow Adoption Context**: {新專案 greenfield / 既有系統導入 / 遷移等}
- **Tech Stack**: {Framework} {Framework version}；{ORM / persistence} {ORM version} / {Mediator} / {其他};
  {Language}

### Architecture (Clean Architecture)

```
Presentation → Application → Domain ← Infrastructure
```

依賴方向永遠朝內。Domain 層是核心，不依賴任何外部套件。

| Layer | Responsibilities | Must NOT |
|---|---|---|
| Domain | 業務規則、Aggregate、Value Object、Domain Event | 依賴外部套件、存取資料庫、處理 HTTP |
| Application | 編排領域操作、CQRS、驗證、DTO | 包含業務邏輯、直接存取資料庫 |
| Infrastructure | {ORM / persistence}、外部 API、檔案存取 | 包含業務邏輯 |
| Presentation | HTTP 端點、Request/Response | 包含業務邏輯、直接操作 Domain 物件 |

### Project Structure

完整 specs 目錄結構見 Dflow skill `SKILL.md` § "Project Structure"。
以下只列本專案當前狀態（Dflow CLI init 建立後可能還未全填）：

```
dflow/specs/
├── domain/
│   ├── glossary.md
│   ├── context-map.md
│   └── {context}/  # 首個 bounded context 被 P007a 建立時會補齊
│       ├── context.md
│       ├── models.md
│       ├── rules.md
│       ├── behavior.md
│       └── events.md
├── features/{active,completed,backlog}/
└── architecture/
    ├── decisions/
    └── tech-debt.md
```

---

## Development Workflow

> SDD 流程、Git 整合、Domain 層規範、AI 協作

### Dflow Skill — Canonical Decision Logic Lives in the Project

AI 的完整決策樹、Workflow Transparency、Ceremony Scaling 三層判準
（T1 Heavy / T2 Light / T3 Trivial）、所有 slash command 的 step-by-step
流程 **不在此重述**，請以本專案內的 Dflow 工件為準（init 時投影）：

- `dflow/specs/shared/AI-AGENT-GUIDE.md`（決策樹 + Slash Commands 總表 + 路由規則）
- `dflow/specs/shared/dflow-workflows/references/` 內各 flow 文件（執行步驟定義）

本專案採用的 Dflow entry points：
- Dflow CLI init command (`dflow init`, or `npx dflow-sdd-ddd init` when using the no-install path) — 專案初始化（一次性，已執行過）
- `/dflow:new-feature` — 新功能
- `/dflow:new-phase` — 既有 active feature 加新 phase
- `/dflow:modify-existing` — 修改既有行為
- `/dflow:bug-fix` — Bug 修復
- `/dflow:finish-feature` — Feature 收尾 + 整合摘要
- `/dflow:pr-review` — PR 審查檢查點
- `/dflow:report-dflow-feedback` — 草擬給 Dflow upstream 的已清理回饋，不自動送出
- `/dflow:status` / `/dflow:next` / `/dflow:cancel` — 狀態管理

### Core Principles (Project Reaffirmed)

1. **Spec Before Code** — 沒有規格就不寫實作
2. **Domain at the Center** — 業務邏輯只存在於 Domain 層
3. **Ubiquitous Language** — 使用 `dflow/specs/domain/glossary.md` 中定義的術語
4. **One Aggregate per Transaction** — 單一操作只修改一個 Aggregate
5. **Dependency Inversion** — Domain 定義介面，Infrastructure 實作

### Domain Layer Rules (Hard Invariants)

- ❌ 不可有任何外部套件依賴（語言純粹 types）
- ❌ 不可有 ORM 屬性（`[Table]`、`[Column]` 等）
- ❌ 不可有序列化屬性（`[JsonProperty]` 等）
- ❌ 不可有 `DbContext`、`IConfiguration`、`HttpClient`
- ✅ Entity 使用 `private set;`，透過方法改變狀態
- ✅ Value Object 使用 `record`，建構式驗證
- ✅ Aggregate Root 管理 `DomainEvents` 集合
- ✅ 其他 Aggregate 只透過 ID 引用

### Project-Level Supplemental Rules

{此段由專案自行填入。例如：}

- **本專案使用 {Mediator} 做 Command / Query dispatch（若適用）**，Application 層
  Command / Query Handler 命名為 `{Name}CommandHandler` /
  `{Name}QueryHandler`
- **整合測試使用 {Testcontainers / WebApplicationFactory / 其他}**；
  CI 流程中自動跑
- **{其他團隊協議}**

### Git Branching Strategy

本專案採用：{填寫 Git Flow / trunk-based / GitHub Flow / 自訂}
詳見 `dflow/specs/shared/Git-principles-{gitflow|trunk}.md`。

### AI Collaboration Notes

- 開發者提出任何需求時，先引導建立 spec 和 Aggregate 設計
- 確認實作順序：Domain → Application → Infrastructure → Presentation
- 發現業務邏輯在錯誤的層時，指出並建議搬移
- 每次開發循環結束時，提醒更新術語表、models.md、events.md
- Review 時檢查 Domain 層的純淨度（零外部依賴）
```

---

## Notes

- This snippet is intentionally lighter than the in-project bundle
  template at `dflow/specs/shared/dflow-workflows/templates/CLAUDE.md`. If
  you want the full version (with detailed flow descriptions per slash
  command), use that template instead
- The snippet does NOT re-copy the Dflow decision tree, Ceremony
  Scaling criteria, or per-flow step details — those live in the
  skill and change when the skill evolves
- Re-running the Dflow CLI init command (`dflow init`, or `npx dflow-sdd-ddd init`
  when using the no-install path) will NOT overwrite an existing `CLAUDE.md`;
  if you want to re-sync, merge manually
