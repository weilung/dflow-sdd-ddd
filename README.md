# AI-Guided SDD/DDD Development Skills

AI 引導的規格驅動開發（SDD）與領域驅動設計（DDD）工作流程規範，設計用於 Claude Code 協作開發。

## 這是什麼

這套 Skill 讓 AI 在開發過程中擔任**流程守衛（Workflow Guardian）**的角色。開發者不需要熟悉 SDD 或 DDD 的所有細節——AI 會在對的時機問對的問題，引導開發者自然地產出規格文件、領域模型、和技術債記錄。

適用場景：
- 團隊導入 SDD/DDD 但成員經驗不一
- 希望在開發過程中保持架構紀律
- ASP.NET WebForms 專案準備遷移到 ASP.NET Core
- 學習 DDD 並透過模擬專案練習

## 目錄結構

```
├── bin/                           # dflow CLI entrypoint
├── lib/                           # init runtime implementation
├── templates/                     # npm package template source
├── test/                          # smoke tests
├── tutorial/                      # 人讀教學劇本與範例 outputs
├── planning/                      # handoff / contract / planning notes
├── proposals/                     # active Proposal 工作區；歷史紀錄在 archive/proposals/
├── reviews/                       # active review 工作區；歷史紀錄在 archive/reviews/
├── archive/                       # implemented proposals / completed reviews 等歷史材料
├── sdd-ddd-webforms-skill/        # WebForms 版 Skill（英文，供 AI 使用）
└── sdd-ddd-core-skill/            # ASP.NET Core 版 Skill（英文，供 AI 使用）
```

---

## 兩套 Skill 的差異

| | WebForms Skill | Core Skill |
|---|---|---|
| **適用階段** | 目前：在運行中的 WebForms 專案開發 | 未來：ASP.NET Core 新專案 / 模擬練習 |
| **架構** | Domain 層 + Code-Behind（兩層） | Clean Architecture 四層 |
| **DDD 深度** | 準備性——術語表、Context 識別、基本抽離 | 完整戰術模式——Aggregate、Domain Events、CQRS |
| **核心引導** | 「Code-Behind 盡量薄」 | 「每一層各司其職，業務邏輯只在 Domain」 |
| **遷移意識** | 每次開發都產出可遷移的資產 | 從頭設計乾淨架構 |
| **附加內容** | — | DDD 建模指南、Aggregate 設計工作表、模擬練習計畫 |

---

## WebForms Skill 檔案說明

### SKILL.md — 主文件
AI 的決策樹和核心規範。定義了五個核心原則、流程嚴謹度對照表、專案目錄結構、各階段引導問題、Domain 層規範。

### references/ — 流程參考
| 檔案 | 內容 |
|---|---|
| `init-project-flow.md` | `npx dflow-sdd-ddd init` 的 internal flow / manual fallback，定義 project bootstrap 問答和 scaffolding 行為 |
| `new-feature-flow.md` | 新功能 8 步驟流程：需求理解 → Context 識別 → 概念發掘 → 撰寫規格 → 實作規劃 → 分支 → 實作 → 完成 |
| `modify-existing-flow.md` | 修改既有功能流程，重點在趁機從 Code-Behind 抽離業務邏輯到 Domain 層 |
| `new-phase-flow.md` | 在既有 feature 下新增 phase 的規格與實作流程 |
| `finish-feature-flow.md` | 完成功能時的 drift 檢查、文件收斂與 tech-debt 收尾 |
| `drift-verification.md` | 規格、模型、實作與文件間的 drift verification 檢查 |
| `git-integration.md` | Git principles 與 SDD 階段對齊，每個 gate 有具體檢查項目 |
| `pr-review-checklist.md` | PR 審查時的合規檢查和遷移準備度 A~F 評分 |

### scaffolding/ — init 建立的基線文件
| 檔案 | 用途 |
|---|---|
| `_overview.md` | Dflow-owned spec tree 的總覽 |
| `_conventions.md` | 專案 convention，包含 `Prose Language` |
| `Git-principles-*.md` | Git Flow / Trunk-Based Development 原則模板 |

### templates/ — 模板
| 檔案 | 用途 |
|---|---|
| `_index.md` | feature / phase 索引與 integration summary |
| `phase-spec.md` | phase 級規格模板 |
| `behavior.md` | Given/When/Then 行為規格模板 |
| `lightweight-spec.md` | Bug 修復用的輕量規格模板 |
| `context-definition.md` | 新 Bounded Context 定義模板 |
| `CLAUDE.md` | init 用的 AI 協作規範模板來源；採用時由 `npx dflow-sdd-ddd init` 處理 |
| `context-map.md`、`glossary.md`、`models.md`、`rules.md`、`tech-debt.md` | domain / migration 文件模板 |

---

## Core Skill 檔案說明

### SKILL.md — 主文件
在 WebForms 版基礎上新增：Clean Architecture 四層架構圖、各層不可妥協的規範、DDD 戰術模式的引導問題。

### references/ — 流程參考
| 檔案 | 內容 |
|---|---|
| `init-project-flow.md` | `npx dflow-sdd-ddd init` 的 internal flow / manual fallback，定義 project bootstrap 問答和 scaffolding 行為 |
| `new-feature-flow.md` | 新功能流程，新增逐層實作順序（Domain → Application → Infrastructure → Presentation） |
| `modify-existing-flow.md` | 修改流程，新增 Aggregate 設計重新評估 |
| `new-phase-flow.md` | 在既有 feature 下新增 phase 的規格與實作流程 |
| `finish-feature-flow.md` | 完成功能時的 drift 檢查、文件收斂與 tech-debt 收尾 |
| `drift-verification.md` | 規格、模型、實作與文件間的 drift verification 檢查 |
| `ddd-modeling-guide.md` | **核心新增**：DDD 建模完整指南，涵蓋 Aggregate 設計規則、Value Object、Domain Events、Specification、Domain Service、Bounded Context 關係、常見錯誤 |
| `git-integration.md` | Git principles 與 SDD 階段對齊，閘門檢查新增 Aggregate 設計和 Domain Events |
| `pr-review-checklist.md` | PR 審查，四層各自的檢查項目 |

### scaffolding/ — init 建立的基線文件
| 檔案 | 用途 |
|---|---|
| `_overview.md` | Dflow-owned spec tree 的總覽 |
| `_conventions.md` | 專案 convention，包含 `Prose Language` |
| `architecture-decisions-README.md` | architecture decisions 目錄說明 |
| `Git-principles-*.md` | Git Flow / Trunk-Based Development 原則模板 |

### templates/ — 模板
| 檔案 | 用途 |
|---|---|
| `_index.md` | feature / phase 索引與 integration summary |
| `phase-spec.md` | phase 級規格模板，支援 Domain Events 和逐層實作計畫 |
| `behavior.md` | Given/When/Then 行為規格模板 |
| `lightweight-spec.md` | 輕量規格模板 |
| `context-definition.md` | Bounded Context 定義模板 |
| `aggregate-design.md` | **核心新增**：Aggregate 設計工作表（不變條件、狀態變更方法、Events、引用關係） |
| `CLAUDE.md` | init 用的 AI 協作規範模板來源；採用時由 `npx dflow-sdd-ddd init` 處理 |
| `events.md`、`context-map.md`、`glossary.md`、`models.md`、`rules.md`、`tech-debt.md` | domain / architecture 文件模板 |

### PRACTICE_PLAN_tw.md — 模擬練習計畫
7 個 Phase 的 DDD 學習路線，使用費用報銷系統作為模擬專案，預估 15-22 小時：

| Phase | 內容 | 學到的 DDD 概念 |
|---|---|---|
| 1 | 建立基礎、識別 Bounded Context | Context Map、Ubiquitous Language |
| 2 | 第一個 Aggregate + Value Objects | Aggregate Root、不變條件、Private Setter |
| 3 | Domain Events | 事件驅動、最終一致性 |
| 4 | 第二個 Aggregate + 跨 Aggregate 溝通 | Reference by ID、狀態機 |
| 5 | CQRS + Application 層 | Command/Query 分離 |
| 6 | Infrastructure 整合 | EF Core 設定、Repository、Event Dispatching |
| 7 | 回顧 + Skill 檢視 | 流程改善 |

---

## How to adopt Dflow in your project

Dflow is the AI-guided SDD/DDD workflow contained in this repo (see `sdd-ddd-webforms-skill/` and `sdd-ddd-core-skill/`). In V1, project bootstrap is npm CLI first: the default entry is `npx dflow-sdd-ddd init`, which seeds `dflow/specs/` and keeps Dflow-owned documents under the `dflow/` namespace.

The npm package is published as `dflow-sdd-ddd` because the unscoped `dflow` package name is already occupied on npm. The installed CLI still exposes the `dflow` binary for global installs.

Adopting Dflow in a project takes 4 steps:

1. In your project root, run `npx dflow-sdd-ddd init`.
2. Answer the intake questions. Dflow will ask for the edition, project context, optional starter files, and the required project prose language for generated spec content.
3. Review the file-list preview and confirm the writes. Existing files are never overwritten.
4. Start your first feature with `/dflow:new-feature`, or for an existing codebase, `/dflow:modify-existing` to work from an incoming change request.

The generated baseline lives under `dflow/specs/`, for example `dflow/specs/shared/_conventions.md`, `dflow/specs/domain/glossary.md`, and `dflow/specs/features/active/`. The project AI guide is the one special root-level exception: `CLAUDE.md` stays at the project root so AI tools can discover it normally. If a root `CLAUDE.md` already exists, Dflow writes a mergeable snippet instead of overwriting it.

Dflow keeps template structure stable in English: headings, table headers, labels, anchors, IDs, placeholders, file paths, and code-facing terms remain canonical English. Free prose inside those sections follows the project's `Prose Language` setting in `dflow/specs/shared/_conventions.md`.

Advanced usage: `npm install -g dflow-sdd-ddd` may be useful for users who want a fixed global CLI, then run `dflow init`. This is not the V1 default. `npm create dflow-sdd-ddd` is not implemented in V1 and remains a V2 evaluation item.

For what gets created at init time, how scaffolding templates are chosen, and how to re-run safely, see `sdd-ddd-webforms-skill/references/init-project-flow.md` (or the Core equivalent).

### V2 Starter Kit and Dflow — division of labour

Dflow is distributed alongside a sister project, **V2 Starter Kit** (`SDD-Starter-Kit`), which plays a complementary role:

| | V2 Starter Kit | Dflow (this repo) |
|---|---|---|
| **Format** | Complete distributable starter kit (flat files + tutorial docs) | AI-guided skill (read and executed by Claude Code at runtime) |
| **Onboarding documents** | Ships full onboarding pack (e.g. `SDD-AI協作開發模式介紹.md`, `使用說明.md`) | Ships minimal scaffolding templates only (`scaffolding/`) |
| **Primary audience** | Humans reading + copying files manually | AI running slash commands in a live project |
| **Typical use** | Teams evaluating SDD/DDD or wanting a human-readable reference | Teams who want the workflow enforced at development time |

The two are designed to coexist: you can start with V2's onboarding docs for reading/training, then adopt Dflow in the project itself for enforcement. Dflow's `scaffolding/` is intentionally a **minimal** template set; if you want the full V2 onboarding documents, copy them from V2 separately (V2's Tutorial rebuild is tracked as Closeout C2 of this repo's work plan).

---

## 如何使用

### 在專案中採用 Dflow

1. 在專案根目錄執行 `npx dflow-sdd-ddd init`
2. 依提示選擇 edition、starter files、project prose language
3. 預覽並確認寫入清單；Dflow 不會覆寫既有檔案
4. 啟動 AI coding agent，從 `/dflow:new-feature` 或 `/dflow:modify-existing` 開始

### 在 Claude Code 中進行 DDD 模擬練習

1. 在練習專案根目錄執行 `npx dflow-sdd-ddd init`，選擇 Core edition
2. 啟動 Claude Code，輸入：
```
我要開始一個 DDD 模擬練習專案：員工費用報銷系統（ExpenseTracker）。
請依照 Skill 中定義的流程引導我，從 Phase 1 開始。
```

---

## 設計理念

### Spec Before Code（先規格、後程式碼）
每一次程式碼變更都應該有對應的規格文件。規格不是額外的負擔，而是思考的工具——在寫程式之前先想清楚要做什麼。

### AI 作為流程守衛
AI 不只是回答問題的工具，它主動引導開發流程：在你開分支前確認規格存在、在你寫 Code-Behind 時提醒業務邏輯應該在 Domain 層、在 PR 時檢查架構合規性。

### 漸進式 DDD
不需要一次到位。WebForms 階段先累積術語表和領域知識，ASP.NET Core 階段再完整落地 DDD 戰術模式。現在寫的每一份規格和每一段 Domain 層程式碼，都是未來遷移的資產。

### 三份資產
每次開發循環都產出：**規格文件**（未來的需求文件）、**Domain 層程式碼**（可直接遷移）、**技術債記錄**（遷移指南）。

---

## 授權

MIT License. See [LICENSE](LICENSE).
