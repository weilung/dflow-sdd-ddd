# npx dflow-sdd-ddd init — Bob 為 OrderManager 建立 brownfield baseline

## 劇情背景

Bob 已經看完 OrderManager 的現況：WebForms、EF 6、SQL Server、少量 integration tests，業務規則散在 Code-Behind、Repository 與 Stored Procedures 裡。他不打算先重構，也不打算先畫一張理想架構圖；第一步只是把 Dflow 的 runtime 結構建起來，讓後續每一次修改都有 spec、glossary、context map 與 tech debt backlog 可追。

他在 OrderManager 專案 root 開啟 shell，執行 CLI init。

## 完整對話

> **Note**：本段是教學化轉寫，用來說明 Dflow init 的決策點與產出物；實際 `dflow-sdd-ddd@0.1.0` CLI 會以較精簡的 numbered prompts、file preview 與 `Create these files? (y/N)` confirmation 呈現，不會逐字輸出下列完整敘事。

> **Bob（shell）**：
>
> ```bash
> $ npx dflow-sdd-ddd init
> ```

> **Dflow CLI**：Dflow project initialization.
>
> Step 1: current-state inventory. I will inspect the repo before planning files.
>
> Repo inventory:
>  - `.git`: present
>  - `dflow/specs/`: not yet present
>  - `OrderManager.Web/`: ASP.NET WebForms 主專案
>  - `OrderManager.DataAccess/`: EF 6 + Stored Procedure wrappers
>  - `tests/OrderManager.IntegrationTests/`: 少量 integration tests
>  - `src/Domain/`: not present
>  - `CLAUDE.md`: not present
>
> 判定：**Brownfield Dflow setup**。這次 init 只建立 baseline governance files，不搬動既有程式碼，也不預設第一個 Bounded Context。

> **Dflow CLI**：Step 2 asks the minimum project questions needed to fill scaffolding placeholders.
>
> **Q1 project type**：greenfield 還是 brownfield？

> **Bob**：Brownfield。OrderManager 已經上線 5-7 年，現在才導入 Dflow。

> **Dflow CLI**：
>
> **Q2 edition**：要使用哪個 Dflow edition？
>
> 1. ASP.NET Core — Clean Architecture + DDD
> 2. ASP.NET WebForms — brownfield modernization

> **Bob**：ASP.NET WebForms — brownfield modernization。

> **Dflow CLI**：
>
> **Q3 tech stack**：請描述目前技術棧。

> **Bob**：.NET Framework 4.8、ASP.NET WebForms、Entity Framework 6、SQL Server 2019、IIS。前端還有 jQuery 跟 Bootstrap 3。

> **Dflow CLI**：
>
> **Q4 migration context**：是否有 modernization 或 migration 目標？

> **Bob**：有。長期目標是逐步遷移到 ASP.NET Core，但短期不能停機，也不能先大重寫。Dflow 先拿來保護每次修改，順便抽出可遷移的 Domain logic。

> **Dflow CLI**：
>
> **Q5 prose language**：請選擇專案的 prose language。這只影響 spec 內的自由敘述文字；headings、table headers、fixed labels、placeholders、IDs、anchors、file paths 與 code-facing terms 仍保留 canonical English structural language。
>
> - `en`
> - `zh-TW`
> - other BCP-47 tag

> **Bob**：`zh-TW`。需求討論和 legacy 行為說明主要用繁體中文，固定結構維持英文。

> **Dflow CLI**：記下來。`dflow/specs/shared/_conventions.md` 會包含 `## Prose Language`，值為 `zh-TW`。
>
> **Q6 optional starter files**（多選）：除了 mandatory baseline，還想 seed 哪些 optional starter 檔？`_conventions.md` 是 mandatory，因為它要記錄 prose language，不在 optional 清單內。
>
>   - [ ] `dflow/specs/shared/_overview.md`
>   - [ ] Git principles —— Git Flow 或 trunk-based 二擇一
>   - [ ] `CLAUDE.md` snippet

> **Bob**：`_overview.md` 要。Git 我們有 release / hotfix 節奏，所以選 `Git-principles-gitflow.md`。`CLAUDE.md` snippet 也要，repo root 目前沒有。

> **Dflow CLI**：Step 2 的答案整理如下：
>
> | Q | Answer |
> |---|---|
> | Q1 project type | brownfield |
> | Q2 edition | ASP.NET WebForms — brownfield modernization |
> | Q3 tech stack | .NET Framework 4.8 / WebForms / EF 6 / SQL Server 2019 / IIS |
> | Q4 migration | long-term ASP.NET Core modernization; no big-bang rewrite |
> | Q5 prose language | `zh-TW` |
> | Q6 optional | `_overview.md` ✓ / `Git-principles-gitflow.md` ✓ / `CLAUDE.md` snippet ✓ |
>
> Step 2 complete. Entering Step 3: File-list preview.

> **Dflow CLI**：Step 3 我先把要寫 / 要跳過 / 故意不建的檔案列清楚，請你確認後才動手寫。
>
> **Will create (9 files):**
>
> | Path | Source |
> |---|---|
> | `dflow/specs/features/active/.gitkeep` | directory placeholder |
> | `dflow/specs/features/completed/.gitkeep` | directory placeholder |
> | `dflow/specs/features/backlog/.gitkeep` | directory placeholder |
> | `dflow/specs/domain/glossary.md` | mandatory baseline |
> | `dflow/specs/migration/tech-debt.md` | mandatory baseline |
> | `dflow/specs/shared/_conventions.md` | mandatory — records project prose language and spec writing conventions |
> | `dflow/specs/shared/_overview.md` | optional — Bob selected |
> | `dflow/specs/shared/Git-principles-gitflow.md` | optional — Bob selected |
> | `CLAUDE.md` (repo root) | optional — repo has no existing `CLAUDE.md` |
>
> **Will skip (0 files already present):**
>
> | Path | Reason |
> |---|---|
> | (none) | first Dflow setup in this repo |
>
> **Not creating yet:**
> - `dflow/specs/domain/{context}/` — first Bounded Context will be created when `/dflow:modify-existing` confirms the real boundary.
> - `dflow/specs/domain/context-map.md` — WebForms edition treats context-map as optional / emergent; it is created later only when real cross-context relationships need to be documented.
> - `dflow/specs/features/active/SPEC-.../` — no feature is open during init.
> - `src/Domain/` — init creates spec governance files only; code extraction happens during a later modify-existing flow.
>
> Placeholder replacement:
> - `{System Name}` → **OrderManager**
> - `{business domain}` → **B2B 訂單管理**
> - `{tech stack}` → **.NET Framework 4.8 / WebForms / EF 6 / SQL Server 2019 / IIS**
> - `{migration context}` → **long-term ASP.NET Core modernization**
> - `{prose-language}` → **zh-TW**
> - `{YYYY-MM-DD}` → **2026-04-29**
>
> 這樣 OK 嗎？輸入 `yes` 我就開工。

> **Bob**：yes。

> **Dflow CLI**：Init complete. Summary:
>
> ```
> Created:
>   dflow/specs/features/active/.gitkeep
>   dflow/specs/features/completed/.gitkeep
>   dflow/specs/features/backlog/.gitkeep
>   dflow/specs/domain/glossary.md
>   dflow/specs/migration/tech-debt.md
>   dflow/specs/shared/_conventions.md
>   dflow/specs/shared/_overview.md
>   dflow/specs/shared/Git-principles-gitflow.md
>   CLAUDE.md
> ```
>
> Next-step recommendation (brownfield): run `/dflow:modify-existing` for the first concrete change. The first flow should inspect current behavior, record baseline facts, and only then decide whether to create `dflow/specs/domain/{context}/`.

> **Bob**：好。先不碰程式碼，讓 baseline 到位。下一段我用 modify-existing 處理第一個訂單提交規則修改。

## 本段產出的檔案

`npx dflow-sdd-ddd init` 在 Bob 的 OrderManager repo 寫入 baseline outputs。Tutorial 對應檔案位於 [`outputs/`](outputs/)：

**features/ 三個工作區**
- [`dflow/specs/features/active/.gitkeep`](outputs/dflow/specs/features/active/.gitkeep)
- [`dflow/specs/features/completed/.gitkeep`](outputs/dflow/specs/features/completed/.gitkeep)
- [`dflow/specs/features/backlog/.gitkeep`](outputs/dflow/specs/features/backlog/.gitkeep)

**domain/ living document**
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md)

**migration/**
- [`dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md)

**shared/**
- [`dflow/specs/shared/_conventions.md`](outputs/dflow/specs/shared/_conventions.md) — `## Prose Language` 設為 `zh-TW`
- [`dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md)
- [`dflow/specs/shared/Git-principles-gitflow.md`](outputs/dflow/specs/shared/Git-principles-gitflow.md)

**repo root**
- [`CLAUDE.md`](outputs/CLAUDE.md)

## 觀察重點

- **CLI init 不修改 production code**。Bob 的情境是 brownfield，因此 init 只建立治理結構與 baseline documents，不建立 `src/Domain/`、不搬 Code-Behind、不抽 Stored Procedure。
- **`_conventions.md` 是 mandatory baseline**。它記錄 `## Prose Language`，讓後續 specs 的自由敘述使用 `zh-TW`，但固定結構語言仍保持 canonical English。
- **第一個 Bounded Context 與 context map 延後到真需求出現**。Order / Customer / Inventory 等候選不在 init 時預先固定；真正的 `dflow/specs/domain/{context}/` 與 `dflow/specs/domain/context-map.md` 由後續 `/dflow:modify-existing` 或 `/dflow:new-feature` 根據實際修改建立。

## 下一個劇情段

→ [02-modify-existing.md](02-modify-existing.md)：Bob 用 modify-existing flow 處理第一個 brownfield modification。
