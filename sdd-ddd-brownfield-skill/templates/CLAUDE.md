<!-- Dflow reference example — legacy full CLAUDE.md layout. NOT an init source:
     `dflow init` writes a thin CLAUDE.md shim pointing to `AI-AGENT-GUIDE.md`.
     Kept as a complete-layout example. Canonical workflow logic (decision
     routing, Ceremony Scaling, per-flow steps) lives in `AI-AGENT-GUIDE.md`
     and the workflow bundle. -->

# Project: {系統名稱} — {Framework}

**重要：所有開發工作都必須遵循本文件定義的流程。**

---

## System Context

> 技術棧、業務領域、目錄結構

### Background

這是一個運行中的既有系統，使用 {Framework} / {Language}，目前持續新增與修改功能。
目前採用 SDD 流程，同時為 DDD 與 target architecture 做準備。

### Project Structure

```
dflow/specs/
├── shared/                   # 專案級治理文件（由 dflow init 寫入）
│   ├── _overview.md          # 系統現況與 target architecture
│   └── _conventions.md       # 規格撰寫慣例與模板
├── domain/                   # 領域知識
│   ├── glossary.md           # 術語表（Ubiquitous Language）
│   └── {context}/            # 按 Bounded Context 分
│       ├── context.md        # Context 邊界與職責
│       ├── models.md         # 領域模型定義
│       └── rules.md          # 業務規則目錄
├── features/
│   ├── active/               # 進行中的 feature
│   │   └── {SPEC-ID}-{slug}/ # 一個 feature 一個目錄
│   │       ├── _index.md     # Feature dashboard：Goals & Scope / Phase Specs / Current BR Snapshot / Lightweight Changes / Resume Pointer
│   │       ├── phase-spec-YYYY-MM-DD-{slug}.md   # T1 Heavy：每 phase 一份
│   │       └── lightweight-YYYY-MM-DD-{slug}.md  # T2 Light（或 BUG-NNN-{slug}.md）
│   ├── completed/            # 整個 feature 目錄 git mv 到這裡
│   └── backlog/              # 待處理
│   # SPEC-ID 格式：SPEC-YYYYMMDD-NNN；slug 跟隨討論語言（中文/英文皆可）
│   # T3 無獨立檔，只在 _index.md Lightweight Changes 寫一列
└── migration/
    └── tech-debt.md          # 技術債與遷移備忘

src/
├── Domain/                   # 抽離的領域邏輯（framework-pure）
│   ├── {Context}/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Services/
│   │   └── Interfaces/
│   └── SharedKernel/
└── Delivery/                 # delivery-layer code（entrypoints, controllers, handlers）
```

> **目錄命名說明**：上方 `src/Domain/` / `src/Delivery/` 是 Clean
> Architecture 通用示意，不限 stack。請依專案實際慣例對應（例：Java/Spring 用
> `src/main/java/com/example/domain/`、Node/TS 用 `src/domain/` /
> `src/routes/`、Python 用 `domain/` package、Go 用 `internal/domain/` /
> `internal/handler/`、.NET 用 `src/{Project}.Domain/` + `.csproj` 分層）。
> 完整 per-stack 範例見 `docs/examples-by-stack.md`。重點是
> `src/Domain/`（或對應命名）保持與 delivery/entrypoint code 獨立。

---

## Development Workflow

> SDD 流程、Git 整合、Domain 層規範、術語表、AI 協作

### Core Principles
1. **Spec Before Code** — 沒有規格就不寫實作
2. **Domain Extraction** — 業務邏輯屬於 `src/Domain/`，不屬於 delivery/entrypoint code（presentation/UI layer、controllers、handlers、jobs、message consumers、data pipelines、stored procedures）
3. **Ubiquitous Language** — 使用 `dflow/specs/domain/glossary.md` 中定義的術語
4. **Migration Awareness** — 每個決策都要考慮 target architecture

### Three Ceremony Tiers

AI 依 **T1 Heavy / T2 Light / T3 Trivial** 三層判準選擇 ceremony 強度。
完整判準表與 T3 四條件見 `dflow/specs/shared/AI-AGENT-GUIDE.md` §
Ceremony Scaling，此處不重述以免與 canonical 定義漂移。純 typo / 純格式化
commit（`dotnet format` / `prettier` 自動整理）**低於 T3**：直接 `git commit`，
不走 Dflow。

### New Feature
1. 建 feature 目錄 `dflow/specs/features/active/{SPEC-ID}-{slug}/`
2. 建 `_index.md`（feature dashboard）+ 第一份 `phase-spec-YYYY-MM-DD-{slug}.md`
3. 識別涉及的領域概念，更新 `dflow/specs/domain/` 下的對應文件
4. 盡可能將業務邏輯實作在 `src/Domain/` 中（語言純粹的 class，不依賴 delivery framework）
5. Delivery/entrypoint code 僅負責輸入解析、協調流程與輸出綁定，呼叫 Domain 層處理邏輯
6. 撰寫測試驗證 Domain 層行為符合規格

### New Phase
1. 在已啟動的 active feature 上新增一份 phase-spec（含 Delta-from-prior-phases）
2. 更新 `_index.md` 的 Phase Specs 表 + regenerate Current BR Snapshot
3. 嚴格只適用於 active feature；completed 的 feature 不接受新 phase

### Modify Existing
1. AI 依 T1 / T2 / T3 判準分流
2. 若偵測到改動與 completed feature 相關，主動詢問是否為 follow-up
   （follow-up 走新建 feature + `follow-up-of` 鏈回原 feature；不把 T2/T3
   寫回 completed 目錄）
3. 如果該功能的邏輯還在 delivery/entrypoint code 中，評估是否值得先抽離到 Domain 層
4. 在 `dflow/specs/migration/tech-debt.md` 記錄發現的技術債

### Bug Fix
1. 建立輕量規格（問題 + 現有行為 + 預期行為 + 修復方式）
2. 若 bug 不附掛既有 feature，先建最小 feature 目錄再放 lightweight-spec
3. 修 Bug 時順便記錄發現的技術債

### Feature Closeout
1. 驗證 feature 目錄內所有 phase-spec `status: completed`
2. 把 `_index.md` Current BR Snapshot 同步到 BC 層 `rules.md` / `behavior.md`
3. `git mv` 整個 feature 目錄從 `active/` 搬到 `completed/`
4. 產出 Integration Summary（Git-strategy-neutral；不自動 merge）

### Git Integration

> 本流程只規定 SDD 必要的最小 Git 耦合（feature branch per feature、
> `git mv`、commit 對應 SPEC-ID）。實際採用的分支策略（Git Flow /
> GitHub Flow / trunk-based / 單一 main）由專案決定，不在此強制。
> 若採用 Git Flow，可參考 `scaffolding/Git-principles-gitflow.md` 範本。

**分支命名**
```
feature/{SPEC-ID}-{short-description}    # 新功能（SDD 必須）
bugfix/{BUG-ID}-{short-description}      # Bug 修復（SDD 必須）
```

**Commit Message**
```
[SPEC-ID] 簡述變更
```

**分支規則**
- **feature/** — 必須先有 spec 才能開始編碼
- **bugfix/** — 至少要有輕量 spec
- **`/dflow:bug-fix`** 不綁定任何分支策略；採 Git Flow 的專案可選擇把
  緊急修復放在 `hotfix/` 分支，但這是專案決策，Dflow 不代為規定

### Domain Layer Rules (`src/Domain/`)

此目錄中的程式碼必須遵守：
- ❌ 不可引用任何 delivery-framework 命名空間（例：HTTP 請求/回應物件、Session/Cookie context、job runner context、CLI flag parser、ViewState 類等）
- ❌ 不可直接存取資料庫（使用 interface + Repository pattern）
- ❌ 不可使用 delivery-framework runtime context（例：HTTP request/response、session/cookie、job runner state、CLI args）
- ❌ 不可有 UI / entrypoint 相關邏輯（格式化顯示、controller/page/handler 引用）
- ✅ 語言純粹的 class（不依賴 delivery framework），可直接搬到 target architecture
- ✅ 所有公開行為都能在沒有 delivery infrastructure 的情況下測試

### Glossary

所有業務術語必須使用 `dflow/specs/domain/glossary.md` 中定義的名稱。
遇到新術語時，先新增到術語表再使用。

### AI Collaboration Notes

- 開發者提出任何功能需求時，先引導建立 spec
- 在回答 Domain 相關問題時，優先參考 `dflow/specs/domain/` 中的文件
- 發現 delivery/entrypoint code 中的業務邏輯時，建議抽離到 `src/Domain/`
- 每次開發循環結束時，提醒更新術語表和技術債記錄
- 建立分支前，確認命名符合規範且對應 spec 存在
