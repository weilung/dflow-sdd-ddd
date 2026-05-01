# Project: {系統名稱} — ASP.NET Core + DDD

**重要：所有開發工作都必須遵循本文件定義的流程。**

---

## System Context

> 技術棧、架構、業務領域、目錄結構

### Background

這是一個使用 Clean Architecture 和 Domain-Driven Design 的 ASP.NET Core 系統。
採用 SDD 流程，所有開發工作必須遵循本文件定義的流程。

### Architecture (Clean Architecture)

```
Presentation → Application → Domain ← Infrastructure
```

依賴方向永遠朝內。Domain 層是核心，不依賴任何外部套件。

**各層職責**

| 層 | 職責 | 不可以做的事 |
|---|---|---|
| Domain | 業務規則、Aggregate、Value Object、Domain Event | 依賴外部套件、存取資料庫、處理 HTTP |
| Application | 編排領域操作、CQRS、驗證、DTO | 包含業務邏輯、直接存取資料庫 |
| Infrastructure | EF Core、外部 API、檔案存取 | 包含業務邏輯 |
| Presentation | HTTP 端點、Request/Response | 包含業務邏輯、直接操作 Domain 物件 |

### Project Structure

```
dflow/specs/
├── shared/                   # 專案級治理文件（由 npx dflow-sdd-ddd init 寫入）
│   ├── _overview.md          # 系統現況與遷移策略
│   └── _conventions.md       # 規格撰寫慣例
├── domain/
│   ├── glossary.md
│   ├── context-map.md
│   └── {context}/
│       ├── context.md
│       ├── models.md
│       ├── rules.md
│       └── events.md          # Domain Events 目錄
├── features/
│   ├── active/               # 進行中的 feature
│   │   └── {SPEC-ID}-{slug}/ # 一個 feature 一個目錄
│   │       ├── _index.md     # Feature dashboard：Goals & Scope / Phase Specs / Current BR Snapshot / Lightweight Changes / Resume Pointer
│   │       ├── phase-spec-YYYY-MM-DD-{slug}.md   # T1 Heavy：每 phase 一份
│   │       └── lightweight-YYYY-MM-DD-{slug}.md  # T2 Light（或 BUG-NNN-{slug}.md）
│   ├── completed/            # 整個 feature 目錄 git mv 到這裡
│   └── backlog/
│   # SPEC-ID 格式：SPEC-YYYYMMDD-NNN；slug 跟隨討論語言（中文/英文皆可）
│   # T3 無獨立檔，只在 _index.md Lightweight Changes 寫一列
└── architecture/
    ├── decisions/              # ADR
    └── tech-debt.md

src/
├── {Project}.Domain/
├── {Project}.Application/
├── {Project}.Infrastructure/
└── {Project}.WebAPI/

tests/
├── Domain.UnitTests/
├── Application.UnitTests/
└── Integration.Tests/
```

---

## Development Workflow

> SDD 流程、Git 整合、Domain 層規範、AI 協作

### Core Principles
1. **Spec Before Code** — 沒有規格就不寫實作
2. **Domain at the Center** — 業務邏輯只存在於 Domain 層
3. **Ubiquitous Language** — 使用 `dflow/specs/domain/glossary.md` 中定義的術語
4. **One Aggregate per Transaction** — 單一操作只修改一個 Aggregate
5. **Dependency Inversion** — Domain 定義介面，Infrastructure 實作

### Three Ceremony Tiers

不是每次修改都要跑完整流程。AI 依下列判準選 tier：

- **T1 Heavy** — 新功能、新 phase、新 Aggregate / BC、新增 BR、新 Domain Event →
  建獨立 phase-spec，走 `/dflow:new-feature` 或 `/dflow:new-phase`
- **T2 Light** — bug fix（邏輯錯誤）、UI 輸入驗證、流程分支修改（有 BR Delta
  但無 Aggregate / 資料結構動）→ 建獨立 lightweight spec 置於 feature 目錄內
- **T3 Trivial** — 按鈕顏色、文案修正、typo、排版、純註解（無 BR 變動、
  無 Domain 概念動、無資料結構動、只改 UI 表層 / 註解 / 格式化）→
  只在 `_index.md` Lightweight Changes inline 寫一列

純 typo / 純格式化 commit（`dotnet format` / `prettier` 自動整理）**低於 T3**：
直接 `git commit`，不走 Dflow。

### New Feature
1. 建 feature 目錄 `dflow/specs/features/active/{SPEC-ID}-{slug}/`
2. 建 `_index.md`（feature dashboard）+ 第一份 `phase-spec-YYYY-MM-DD-{slug}.md`
3. 設計 Aggregate（不變條件、狀態變更方法、Domain Events）
4. 實作順序：Domain → Application → Infrastructure → Presentation
5. 撰寫測試：Domain 單元測試 → Application 測試 → 整合測試

### New Phase
1. 在已啟動的 active feature 上新增一份 phase-spec（含 Delta-from-prior-phases）
2. 更新 `_index.md` 的 Phase Specs 表 + regenerate Current BR Snapshot
3. 嚴格只適用於 active feature；completed 的 feature 不接受新 phase

### Modify Existing
1. AI 依 T1 / T2 / T3 判準分流
2. 若偵測到改動與 completed feature 相關，主動詢問是否為 follow-up
   （follow-up 走新建 feature + `follow-up-of` 鏈回原 feature；不把 T2/T3
   寫回 completed 目錄）
3. 確認 fix 在正確的 Clean Architecture 層

### Bug Fix
1. 建立輕量規格
2. 若 bug 不附掛既有 feature，先建最小 feature 目錄再放 lightweight-spec
3. 找到問題所在的層
4. 在正確的層修復

### Feature Closeout
1. 驗證 feature 目錄內所有 phase-spec `status: completed`
2. 把 `_index.md` Current BR Snapshot 同步到 BC 層 `rules.md` /
   `behavior.md` / `events.md` / `context-map.md`
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

> `/dflow:bug-fix` 不綁定任何分支策略；採 Git Flow 的專案可選擇把緊急修復
> 放在 `hotfix/` 分支，但這是專案決策，Dflow 不代為規定。

### Domain Layer Rules

- ❌ 不可有任何 NuGet 套件依賴（純 .NET 類型）
- ❌ 不可有 ORM 屬性（[Table], [Column] 等）
- ❌ 不可有序列化屬性（[JsonProperty] 等）
- ❌ 不可有 DbContext、IConfiguration、HttpClient
- ✅ Entity 使用 private setter，透過方法改變狀態
- ✅ Value Object 使用 record，建構式驗證
- ✅ Aggregate Root 管理 DomainEvents 集合
- ✅ 其他 Aggregate 只透過 ID 引用

### AI Collaboration Notes

- 開發者提出任何需求時，先引導建立 spec 和 Aggregate 設計
- 確認實作順序：Domain → Application → Infrastructure → Presentation
- 發現業務邏輯在錯誤的層時，指出並建議搬移
- 每次開發循環結束時，提醒更新術語表、models.md、events.md
- Review 時檢查 Domain 層的純淨度（零外部依賴）
