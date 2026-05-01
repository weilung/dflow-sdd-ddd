# Project: OrderManager — ASP.NET WebForms

**重要：所有開發工作都必須遵循本文件定義的流程。**

---

## System Context

> 技術棧、業務領域、目錄結構

### Background

OrderManager 是一個運行中的 ASP.NET WebForms 系統，負責 B2B 訂單管理、
庫存查詢、出貨追蹤與發票流程。系統服務約 200 家活躍經銷商，也支援
內部業務、倉儲、財務與客服團隊日常作業。

團隊採用 Dflow（SDD/DDD workflow guardian skill）引導開發流程，
同時為未來遷移到 ASP.NET Core 做準備。這是 brownfield adoption：
現有業務不能停機，也不做 big-bang rewrite。

### Project Structure

```
dflow/specs/
├── shared/                   # 專案級治理文件（由 npx dflow-sdd-ddd init 寫入）
│   ├── _overview.md          # 系統現況與遷移策略
│   ├── _conventions.md       # 規格撰寫慣例
│   └── Git-principles-gitflow.md
├── domain/                   # 領域知識
│   ├── glossary.md           # 術語表（Ubiquitous Language）
│   └── {context}/            # 首個 BC 由 modify-existing / new-feature 建立
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
└── Domain/                   # 抽離的領域邏輯（純 C#，逐步建立）

OrderManager.Web/
└── Pages/                    # 既有 WebForms 頁面與 Code-Behind
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
引導，請參考 Dflow skill 的 Primary triggers：

- `npx dflow-sdd-ddd init` — 專案初始化（建立 `dflow/specs/` 結構；本專案已執行過）
- `/dflow:new-feature` — 新功能開發
- `/dflow:new-phase` — 在 active feature 內新增階段
- `/dflow:modify-existing` — 修改既有功能（OrderManager 最常用入口）
- `/dflow:bug-fix` — 輕量修復
- `/dflow:finish-feature` — feature 收尾
- `/dflow:pr-review` — PR 審查
- `/dflow:verify` — rules.md ↔ behavior.md 漂移檢查
- `/dflow:status` / `/dflow:next` / `/dflow:cancel` — 狀態管理

### Project-Level Supplemental Rules

- **Git 分支策略**：本專案採 Git Flow，見 `dflow/specs/shared/Git-principles-gitflow.md`
- **規格撰寫慣例**：見 `dflow/specs/shared/_conventions.md`
- **系統現況與遷移**：見 `dflow/specs/shared/_overview.md`
- **Tech debt backlog**：見 `dflow/specs/migration/tech-debt.md`
- **Brownfield baseline**：修改既有功能前，先讀相關 WebForms page、
  Code-Behind、Repository 與 Stored Procedure，記錄 current behavior
  再提出 changed behavior。

### Domain Layer Rules (`src/Domain/`)

此目錄中的程式碼必須遵守（與 Dflow skill 的 Domain Layer Rules 一致）：

- 不可引用 `System.Web` 或任何 WebForms 命名空間
- 不可直接存取資料庫（使用 interface + Repository pattern）
- 不可使用 `HttpContext`、`Session`、`ViewState`
- 不可有 UI 相關邏輯
- 必須是純 C# 類別，可直接搬到 ASP.NET Core 專案
- 所有公開行為都能在沒有 Web 基礎設施的情況下測試

### AI Collaboration Notes

- 遇到開發需求時，優先判斷是 `/dflow:modify-existing`、`/dflow:new-feature`
  或 `/dflow:bug-fix`，並等待開發者確認後再進入 flow。
- 回答 Domain 相關問題時，優先參考 `dflow/specs/domain/` 中的文件。
- 發現 Code-Behind 中的業務邏輯時，建議抽離到 `src/Domain/`，
  但不要做無 spec 的大重構。
- 建立分支前，確認命名符合 Git Flow 規範且對應 spec 存在。
- 詳細 Git 操作規則見 `dflow/specs/shared/Git-principles-gitflow.md`。
