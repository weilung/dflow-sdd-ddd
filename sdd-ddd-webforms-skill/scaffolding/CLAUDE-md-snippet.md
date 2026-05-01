<!-- Scaffolding template maintained alongside Dflow skill. See archive/proposals/PROPOSAL-010 for origin. -->

# CLAUDE.md Snippet — Dflow Adoption

> This file is a **snippet**, not a standalone `CLAUDE.md`. Its purpose
> is to be merged into your project's root `CLAUDE.md`:
>
> - If your project does **not** yet have a `CLAUDE.md`, the
>   `npx dflow-sdd-ddd init` flow will create one using this snippet as
>   the starting content.
> - If your project **already has** a `CLAUDE.md`, the init flow will
>   copy this file into your repo and prompt you to merge the
>   sections below into the appropriate places in your existing
>   `CLAUDE.md`. No auto-merge — you keep editorial control.

The snippet follows the Dflow `templates/CLAUDE.md` H2 segmentation
(established in PROPOSAL-007c): **System Context** (what the system is)
and **Development Workflow** (how we work). Keep those two H2 sections as the backbone
when merging into an existing `CLAUDE.md`.

---

## Snippet to merge into `CLAUDE.md`

```markdown
# Project: {系統名稱} — ASP.NET WebForms

**重要：所有開發工作都必須遵循本文件定義的流程。**

---

## System Context

> 技術棧、業務領域、目錄結構

### Background

這是一個運行中的 ASP.NET WebForms 系統，{一句話描述業務領域：例如
「提供員工費用報銷」/「處理 HR 人事流程」/「訂單管理」}。採用 Dflow
（SDD/DDD workflow guardian skill）引導開發流程，同時為未來遷移到
ASP.NET Core 做準備。

{選填：補上團隊規模、使用者規模、主要 stakeholders 等 context，
1-3 行即可。完整內容放在 `dflow/specs/shared/_overview.md`。}

### Project Structure

```
dflow/specs/
├── shared/                   # 專案級治理文件（由 npx dflow-sdd-ddd init 寫入）
│   ├── _overview.md          # 系統現況與遷移策略
│   ├── _conventions.md       # 規格撰寫慣例
│   └── Git-principles-*.md   # Git 規範（gitflow 或 trunk 版）
├── domain/                   # 領域知識
│   ├── glossary.md           # 術語表（Ubiquitous Language）
│   └── {context}/            # 按 Bounded Context 分
│       ├── context.md
│       ├── models.md
│       ├── rules.md
│       └── behavior.md
├── features/
│   ├── active/
│   │   └── {SPEC-ID}-{slug}/
│   │       ├── _index.md
│   │       ├── phase-spec-YYYY-MM-DD-{slug}.md
│   │       └── lightweight-YYYY-MM-DD-{slug}.md
│   ├── completed/
│   └── backlog/
└── migration/
    └── tech-debt.md

src/
├── Domain/                   # 抽離的領域邏輯（純 C#）
│   ├── {BoundedContext}/
│   └── SharedKernel/
└── Pages/                    # 既有 WebForms 頁面
```

---

## Development Workflow

> SDD 流程、Git 整合、Domain 層規範、術語表、AI 協作

### Core Principles

1. **Spec Before Code** — 沒有規格就不寫實作（依 Ceremony Scaling 調整嚴謹度）
2. **Domain Extraction** — 業務邏輯屬於 `src/Domain/`，不屬於 Code-Behind
3. **Ubiquitous Language** — 使用 `dflow/specs/domain/glossary.md` 中定義的術語
4. **Migration Awareness** — 每個決策都要考慮未來 ASP.NET Core 遷移

### Dflow Skill — Canonical Decision Logic Lives in the Skill

AI 的完整決策樹、Workflow Transparency、Ceremony Scaling 三層判準
（T1/T2/T3）、各 `/dflow:` 命令的具體流程，**全部定義於 Dflow skill
本體**（`sdd-ddd-webforms-skill/SKILL.md` 與 `references/*.md`）。
本 `CLAUDE.md` 不重述這些內容，避免雙份維護。

當你作為 AI assistant 被呼叫時，若偵測到使用者需要 SDD/DDD 工作流
引導，請參考 Dflow entry points：

- `npx dflow-sdd-ddd init` — 專案初始化（建立 `dflow/specs/` 結構）
- `/dflow:new-feature` — 新功能開發
- `/dflow:new-phase` — 在 active feature 內新增階段
- `/dflow:modify-existing` — 修改既有功能
- `/dflow:bug-fix` — 輕量修復
- `/dflow:finish-feature` — feature 收尾
- `/dflow:pr-review` — PR 審查
- `/dflow:verify` — rules.md ↔ behavior.md 漂移檢查
- `/dflow:status` / `/dflow:next` / `/dflow:cancel` — 狀態管理

### Project-Level Supplemental Rules

（本 `CLAUDE.md` 只記這一層——Dflow skill 不管的專案決策）

- **Git 分支策略**：見 `dflow/specs/shared/Git-principles-{gitflow|trunk}.md`
- **規格撰寫慣例**：見 `dflow/specs/shared/_conventions.md`
- **系統現況與遷移**：見 `dflow/specs/shared/_overview.md`
- {其他專案特有規則，例如「JPY 金額必須以最小貨幣單位（yen）儲存」/
  「所有費用報銷需主管審核」/「跨時區行程以 UTC 記錄」}

### Domain Layer Rules (`src/Domain/`)

此目錄中的程式碼必須遵守（與 Dflow skill 的 Domain Layer Rules 一致）：

- ❌ 不可引用 `System.Web` 或任何 WebForms 命名空間
- ❌ 不可直接存取資料庫（使用 interface + Repository pattern）
- ❌ 不可使用 `HttpContext`、`Session`、`ViewState`
- ❌ 不可有 UI 相關邏輯
- ✅ 純 C# 類別，可直接搬到 ASP.NET Core 專案
- ✅ 所有公開行為都能在沒有 Web 基礎設施的情況下測試

### AI Collaboration Notes

- 遇到開發需求時，優先引導使用 `/dflow:` 命令
- 回答 Domain 相關問題時，優先參考 `dflow/specs/domain/` 中的文件
- 發現 Code-Behind 中的業務邏輯時，建議抽離到 `src/Domain/`
- 建立分支前，確認命名符合規範且對應 spec 存在
- 詳細 Git 操作規則見 `dflow/specs/shared/Git-principles-{gitflow|trunk}.md`
```

---

## Merge Guidance

When merging this snippet into an existing `CLAUDE.md`:

1. **Keep the two H2 sections** (`System Context` / `Development Workflow`) as the
   backbone. This alignment with the Dflow skill's
   `templates/CLAUDE.md` is important — AI assistants navigate by
   these headings.
2. **Under `System Context`**: merge the background paragraph and the
   directory tree. If your project already documents directory
   structure elsewhere, keep the tree pointing to `dflow/specs/` and
   `src/Domain/` at minimum (those are Dflow-specific).
3. **Under `Development Workflow`**: merge the core principles, the Dflow skill
   pointer, and the project-level supplementary rules. The Domain
   layer rules and AI collaboration rules can be kept here or
   cross-referenced from the scaffolding `Git-principles-*.md`.
4. **Avoid duplication**: do not re-inline the Dflow skill's decision
   tree, Workflow Transparency rules, or Ceremony Scaling criteria
   into `CLAUDE.md`. Let `CLAUDE.md` point to the skill, not
   duplicate it.

If you are starting from scratch (no existing `CLAUDE.md`), the
`npx dflow-sdd-ddd init` flow will install this snippet as-is and you
can refine from there.
