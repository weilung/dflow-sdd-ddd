# npx dflow-sdd-ddd init — Alice 為 ExpenseTracker 啟動 Dflow

## 劇情背景

接續 [00-setup.md](00-setup.md)，Alice 已經建立好 **ExpenseTracker** 的 Clean Architecture solution，準備在第一個 feature 開始前導入 Dflow。

技術選型已經拍板：**ASP.NET Core 9 + EF Core 8 + MediatR 12 + xUnit**，採 Clean Architecture 四層結構。此時專案骨架如下：

```
ExpenseTracker/
├── .git/
├── ExpenseTracker.sln
├── src/
│   ├── ExpenseTracker.Domain/
│   ├── ExpenseTracker.Application/
│   ├── ExpenseTracker.Infrastructure/
│   └── ExpenseTracker.WebAPI/
└── tests/
    ├── ExpenseTracker.Domain.Tests/
    ├── ExpenseTracker.Application.Tests/
    └── ExpenseTracker.Integration.Tests/
```

下午她準備開始第一個 feature（員工提交費用單）之前，想先把 Dflow 的 spec 治理結構建起來——畢竟團隊接下來會圍著 `dflow/specs/` 開發，骨架不先就位，後面亂七八糟。她在專案 root 開啟 shell，執行 CLI init。

## 完整對話

> **Note**：本段是教學化轉寫，用來說明 Dflow init 的決策點與產出物；實際 `dflow-sdd-ddd@0.1.0` CLI 會以較精簡的 numbered prompts、file preview 與 `Create these files? (y/N)` confirmation 呈現，不會逐字輸出下列完整敘事。

> **Alice（shell）**：
>
> ```bash
> $ npx dflow-sdd-ddd init
> ```

> **Dflow CLI**：Dflow project initialization.
>
> Step 1: current-state inventory. I will inspect the repo before planning files.
>
> Repo inventory:
>  - `.git`: present → repo 已初始化
>  - `dflow/specs/`: not yet present → **greenfield Dflow setup**
>  - `src/`: 含 `ExpenseTracker.Domain` / `ExpenseTracker.Application` / `ExpenseTracker.Infrastructure` / `ExpenseTracker.WebAPI` → Clean Architecture layout 已就位
>  - `tests/`: 含 Domain / Application / Integration 三組測試專案
>  - `CLAUDE.md`: not present → 沒有既有的 AI 協作規則檔，等等可選擇直接在 root 建一份
>
> 判定：**Greenfield Dflow setup**。Step 1 的結論是要建立完整 baseline，不會踩到任何既有檔。
>
> Step 1 complete (current-state inventory). Entering Step 2: Project Information.

> **Dflow CLI**：Step 2 asks the minimum project questions needed to fill scaffolding placeholders.
>
> **Q1 project type**：greenfield（全新專案導入 Dflow）還是 brownfield（既有系統現在才導入 Dflow）？

> **Alice**：Greenfield。今天早上 `dotnet new` 出來的，沒有任何 legacy code。

> **Dflow CLI**：了解。
>
> **Q2 edition**：要使用哪個 Dflow edition？
>
> 1. ASP.NET Core — Clean Architecture + DDD
> 2. ASP.NET WebForms — brownfield modernization

> **Alice**：ASP.NET Core — Clean Architecture + DDD。

> **Dflow CLI**：收到。這次會使用 Core 版 scaffolding。
>
> **Q3 tech stack**：ASP.NET Core 版本？ORM？Mediator？測試框架？.NET / C# 版本？

> **Alice**：ASP.NET Core 9、EF Core 8、MediatR 12、xUnit。.NET 9 / C# 13。

> **Dflow CLI**：收到。`_overview.md` 的 stack table 會填 .NET 9 / C# 13 / ASP.NET Core 9 / EF Core 8 / MediatR 12 / xUnit。
>
> **Q4 migration context**：這個專案是從別的 stack 移植過來，還是純新 build？如果是移植，`_overview.md` 會加 migration context note。

> **Alice**：純新 build，沒有 migration 包袱。

> **Dflow CLI**：那就跳過 migration note。
>
> **Q5 prose language**：請選擇專案的 prose language。這只影響 spec 內的自由敘述文字；headings、table headers、fixed labels、placeholders、IDs、anchors、file paths 與 code-facing terms 仍保留 canonical English structural language。
>
> - `en`
> - `zh-TW`
> - other BCP-47 tag

> **Alice**：`zh-TW`。團隊討論需求時主要用繁體中文，但結構標題和 code terms 保持英文。

> **Dflow CLI**：記下來。`dflow/specs/shared/_conventions.md` 會包含 `## Prose Language`，值為 `zh-TW`。
>
> **Q6 optional starter files**（多選）：除了 mandatory baseline，還想 seed 哪些 optional starter 檔？`_conventions.md` 是 mandatory，因為它要記錄 prose language，不在 optional 清單內。
>
>   - [ ] `dflow/specs/shared/_overview.md` — 系統 overview 範本
>   - [ ] Git principles —— **二擇一**（如果不確定，挑 trunk-based；那是 GitHub / GitLab 預設。只有當你有正式 release 週期、需要 release / hotfix 分支時才挑 Git Flow）：
>     - [ ] `dflow/specs/shared/Git-principles-gitflow.md`
>     - [ ] `dflow/specs/shared/Git-principles-trunk.md`
>   - [ ] `CLAUDE.md` snippet —— 你 repo root 沒有 `CLAUDE.md`，所以我會直接建一份；如果之前有，我會放成獨立檔讓你手動 merge

> **Alice**：`_overview.md` 要。Git 我們已經決定採 trunk-based 了（單一 main + 短命 feature branch + squash merge），所以挑 `Git-principles-trunk.md`，gitflow 那份不要。`CLAUDE.md` snippet 也勾——既然 repo 沒有就直接幫我建在 root。

> **Dflow CLI**：清楚。確認一下：你只挑 trunk-based、不挑 gitflow 對嗎？（這兩份只能挑一份，挑兩份通常是誤勾。）

> **Alice**：對，只要 trunk-based 那份。

> **Dflow CLI**：好，記下來。Step 2 的答案整理如下：
>
> | Q | 答案 |
> |---|---|
> | Q1 project type | greenfield |
> | Q2 edition | ASP.NET Core — Clean Architecture + DDD |
> | Q3 tech stack | .NET 9 / C# 13 / ASP.NET Core 9 / EF Core 8 / MediatR 12 / xUnit |
> | Q4 migration | 純新 build，無 migration 包袱 |
> | Q5 prose language | `zh-TW` |
> | Q6 optional | `_overview.md` ✓ / `Git-principles-trunk.md` ✓ / `CLAUDE.md` snippet ✓ |
>
> Step 2 complete (project information captured). Entering Step 3: File-list preview.

> **Dflow CLI**：Step 3 我先把要寫 / 要跳過 / 故意不建的檔案列清楚，請你看過再確認，然後我才動手寫。
>
> **Will create (11 files):**
>
> | Path | Source |
> |---|---|
> | `dflow/specs/features/active/.gitkeep` | (directory placeholder) |
> | `dflow/specs/features/completed/.gitkeep` | (directory placeholder) |
> | `dflow/specs/features/backlog/.gitkeep` | (directory placeholder) |
> | `dflow/specs/domain/glossary.md` | `templates/glossary.md` (mandatory baseline) |
> | `dflow/specs/domain/context-map.md` | `templates/context-map.md` (mandatory baseline) |
> | `dflow/specs/architecture/tech-debt.md` | `templates/tech-debt.md` (mandatory baseline) |
> | `dflow/specs/architecture/decisions/README.md` | `scaffolding/architecture-decisions-README.md` (mandatory baseline) |
> | `dflow/specs/shared/_conventions.md` | mandatory — records project prose language and spec writing conventions |
> | `dflow/specs/shared/_overview.md` | optional — 你勾選 |
> | `dflow/specs/shared/Git-principles-trunk.md` | optional — 你勾選 |
> | `CLAUDE.md` (repo root) | optional — repo 無 `CLAUDE.md`，由 snippet 建立 |
>
> **Will skip (0 files — already present):**
>
> | Path | Reason |
> |---|---|
> | (none) | greenfield 沒有任何檔需要保護 |
>
> **Not creating (per F-05 design):**
> - 不建 `dflow/specs/domain/{context}/behavior.md`。這些檔由 `/dflow:new-feature` Step 8.3（feature 收尾）或 P007a baseline-capture 在第一個 bounded context 真的成形時建立。Day-0 建空殼會留下過時 placeholder。
> - 不建 `dflow/specs/architecture/decisions/ADR-*.md`。等真有架構決策再寫；現在還沒有任何 trade-off 需要記錄。
>
> **Placeholder 替換策略**（Step 4 寫檔時會套用）：
> - `{System Name}` / `{系統名稱}` → **ExpenseTracker**
> - `{業務領域}` → **企業差旅費用申報與核銷**（依 Alice 的專案背景描述）
> - `{ASP.NET Core version}` → **9**；`{EF Core version}` → **8**；`{MediatR version}` → **12**；`{Test framework}` → **xUnit**
> - `{prose-language}` → **zh-TW**；`_conventions.md` 會保留 canonical English structural language 說明
> - `{YYYY-MM-DD}` → **2026-04-28**（今天）
> - 其他需要你後續填的 placeholder（stakeholders / user scale / DB / Auth / hosting 等）保留 `{...}` token + 加 `<!-- TODO: ... -->` 註記，方便你下次 review 看到
>
> 這樣 OK 嗎？輸入 `yes` 我就開工，要調整就告訴我。

> **Alice**：yes，開工。

> **Dflow CLI**：收到。Phase Gate 通過，Step 3 → Step 4。
>
> Step 4: writing files (placeholder fill-in + existing-file protection)。
>
> 4.1 directories：
> - 建 `dflow/specs/features/active/` + `.gitkeep`
> - 建 `dflow/specs/features/completed/` + `.gitkeep`
> - 建 `dflow/specs/features/backlog/` + `.gitkeep`
>
> 4.2 mandatory baseline：
> - 寫 `dflow/specs/domain/glossary.md`（從 `templates/glossary.md`，標題改 ExpenseTracker，table 留結構，加 TODO 註記第一個 feature 進來時補核心術語）
> - 寫 `dflow/specs/domain/context-map.md`（從 `templates/context-map.md`，標題改 ExpenseTracker Core architecture，contexts/relationships 留 placeholder + TODO）
> - 寫 `dflow/specs/architecture/tech-debt.md`（從 `templates/tech-debt.md`，標題改 ExpenseTracker，欄位用 Core 版 layer 標籤）
> - 寫 `dflow/specs/architecture/decisions/README.md`（從 `scaffolding/architecture-decisions-README.md`，這份本來就無需替換）
> - 寫 `dflow/specs/shared/_conventions.md`（從 `scaffolding/_conventions.md`，{System Name} → ExpenseTracker、{prose-language} → zh-TW、SPEC-ID 範例改 `SPEC-20260428-001`、Git principles 連結指向 trunk 那份）
>
> 4.3 optional starter：
> - 寫 `dflow/specs/shared/_overview.md`（從 `scaffolding/_overview.md`，{System Name} → ExpenseTracker、{business domain} → 企業差旅費用申報與核銷、tech stack table 填 .NET 9 / EF Core 8 / MediatR 12 / xUnit、project layout 把 `{Project}` 換成 ExpenseTracker；stakeholders / user scale / DB / Auth / hosting 留 placeholder + TODO）
> - 寫 `dflow/specs/shared/Git-principles-trunk.md`（從 `scaffolding/Git-principles-trunk.md` 完整複製，trunk-based 版本）
>
> 4.4 special — `CLAUDE.md`：
> - repo root 沒有 `CLAUDE.md` → 直接在 **repo root** 建一份（不放到 `dflow/specs/shared/`）
> - 內容從 `scaffolding/CLAUDE-md-snippet.md` 抽出 snippet body（去掉外層 "How to use this snippet" wrapper）
> - 替換 placeholder：標題改 ExpenseTracker、Business Domain 填「企業差旅費用申報與核銷」、Tech Stack 填 ASP.NET Core 9 / EF Core 8 / MediatR 12 / xUnit / .NET 9、Team 填「全端工程團隊，3-5 人；DDD 經驗中等」、Dflow Adoption Context 填「新專案 greenfield，無 migration 包袱」、Git Branching Strategy 填「trunk-based / GitHub Flow（單一 main）」+ 連到 `dflow/specs/shared/Git-principles-trunk.md`
> - Project-Level Supplemental Rules 段落留 placeholder + TODO（等第一個 phase-spec 跑完才知道實際採用哪些 handler 命名 / 整合測試框架）
>
> 寫檔過程：
> - ✓ `dflow/specs/features/active/.gitkeep`
> - ✓ `dflow/specs/features/completed/.gitkeep`
> - ✓ `dflow/specs/features/backlog/.gitkeep`
> - ✓ `dflow/specs/domain/glossary.md` — 套 ExpenseTracker 標題
> - ✓ `dflow/specs/domain/context-map.md` — 套 ExpenseTracker 標題、contexts 留 TODO
> - ✓ `dflow/specs/architecture/tech-debt.md` — 套 ExpenseTracker 標題
> - ✓ `dflow/specs/architecture/decisions/README.md` — scaffolding 原樣
> - ✓ `dflow/specs/shared/_conventions.md` — placeholder 替換完成，`## Prose Language` 設為 `zh-TW`
> - ✓ `dflow/specs/shared/_overview.md` — placeholder 替換完成，stakeholders / user scale / DB / Auth / hosting 留 TODO
> - ✓ `dflow/specs/shared/Git-principles-trunk.md` — scaffolding 原樣（trunk-based）
> - ✓ `CLAUDE.md` （repo root） — snippet body + 替換 placeholder
>
> Step 4 complete (files written). Entering Step 5: Results + next steps.

> **Dflow CLI**：Init complete. Summary:
>
> ```
>   Created (11 files):
>     ✓ dflow/specs/features/active/.gitkeep
>     ✓ dflow/specs/features/completed/.gitkeep
>     ✓ dflow/specs/features/backlog/.gitkeep
>     ✓ dflow/specs/domain/glossary.md
>     ✓ dflow/specs/domain/context-map.md
>     ✓ dflow/specs/architecture/tech-debt.md
>     ✓ dflow/specs/architecture/decisions/README.md
>     ✓ dflow/specs/shared/_conventions.md
>     ✓ dflow/specs/shared/_overview.md
>     ✓ dflow/specs/shared/Git-principles-trunk.md
>     ✓ CLAUDE.md (seeded from scaffolding snippet at repo root)
>
>   Skipped (0 files already present):
>     - (none this run)
>
>   Deferred (not created here by design):
>     - dflow/specs/domain/{context}/behavior.md — 由 /dflow:new-feature Step 8.3
>       或 P007a baseline capture 在首個 bounded context 成形時建立
>     - dflow/specs/architecture/decisions/ADR-*.md — 真有架構決策時再寫，
>       不在 Day-0 預先填空殼
> ```
>
> **Next-step recommendation (greenfield)**：
> Structure ready。建議下一步：
>
>  - 跑 `/dflow:new-feature` 啟動你的第一個 feature（會建 `dflow/specs/features/active/{SPEC-ID}-{slug}/`，並引導你走 spec → Aggregate design → implementation plan）
>  - 第一個 feature 同時會建立你的第一個 bounded context；Step 8.3 收尾時會把 `dflow/specs/domain/{context}/` baseline 起來
>
> **Placeholder review 提醒**：以下檔還留有 `{placeholder}` token，等你下次 review 補：
>
>  - `dflow/specs/shared/_overview.md`：stakeholders 細節、user scale、Validation 套件、DB 選型、Auth 方案、Hosting 環境
>  - `dflow/specs/shared/_conventions.md`：slug 縮寫慣例（等 Aggregate 命名落地後）；`## Prose Language` 已設為 `zh-TW`
>  - `dflow/specs/domain/glossary.md`：核心術語（ExpenseReport / ExpenseItem / Approver / Reimbursement…）
>  - `dflow/specs/domain/context-map.md`：contexts 與 relationships
>  - `CLAUDE.md`：Project-Level Supplemental Rules（等第一個 phase-spec 跑完）
>
> 這些都不急，跑第一個 feature 時自然會逼出答案，邊跑邊補就好。

> **Alice**：好，這結構長得很乾淨。我先去掃一遍 `_overview.md`，把 stakeholders 跟 DB 那幾欄填一填，然後就跑 `/dflow:new-feature` 開「員工提交費用單」這個 feature。

## 本段產出的檔案

`npx dflow-sdd-ddd init` Step 4 在 Alice 的 ExpenseTracker repo 寫入了 **11 個檔**，按目錄分組如下：

**features/ 三個工作區（空目錄 + .gitkeep）**
- [`dflow/specs/features/active/.gitkeep`](outputs/dflow/specs/features/active/.gitkeep) — 進行中的 feature 目錄
- [`dflow/specs/features/completed/.gitkeep`](outputs/dflow/specs/features/completed/.gitkeep) — 已完成的 feature 歸檔區
- [`dflow/specs/features/backlog/.gitkeep`](outputs/dflow/specs/features/backlog/.gitkeep) — 還沒開工的 feature backlog

**domain/ 兩份 living document**
- [`dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) — Ubiquitous Language 術語表（templates/glossary.md 結構，留 TODO 等首個 feature 補術語）
- [`dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) — Bounded Context 關係圖（contexts / relationships 留 placeholder）

**architecture/ tech debt + ADR home**
- [`dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md) — 架構債 backlog（templates/tech-debt.md，Core 版 layer 標籤）
- [`dflow/specs/architecture/decisions/README.md`](outputs/dflow/specs/architecture/decisions/README.md) — ADR 命名慣例 + 何時寫 ADR 的指引（不預建任何 ADR）

**shared/ 三份專案級治理檔（Q5 全選）**
- [`dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md) — 系統 overview，stack table 填 .NET 9 / EF Core 8 / MediatR 12 / xUnit；business domain 填「企業差旅費用申報與核銷」；其餘 stakeholder / DB / Auth 留 TODO
- [`dflow/specs/shared/_conventions.md`](outputs/dflow/specs/shared/_conventions.md) — spec 撰寫慣例，SPEC-ID 範例改 SPEC-20260428-001，`## Prose Language` 設為 `zh-TW`，slug 縮寫段留 TODO
- [`dflow/specs/shared/Git-principles-trunk.md`](outputs/dflow/specs/shared/Git-principles-trunk.md) — trunk-based / GitHub Flow Git 慣例（gitflow 那份依 Alice 選擇不建）

**repo root**
- [`CLAUDE.md`](outputs/CLAUDE.md) — 從 scaffolding snippet body 抽出，二段式 H2（System Context / Development Workflow）；business domain、tech stack、team、git strategy 都填好；Project-Level Supplemental Rules 段留 TODO

## 觀察重點

- **CLI init 是 shell entry point**。Alice 在專案 root 執行 `npx dflow-sdd-ddd init`，init 不再是 skill slash command；後續開 feature 才回到 `/dflow:new-feature`。
- **Step 3 file-list preview 明確 stop-and-confirm**。Dflow CLI 列出 will-create / will-skip / not-creating 三張表後，等 Alice 回 `yes` 才動手寫，符合 CLI init 的保護原則。
- **Q6 全選反映「team 全選」情境**，可以一次展示 optional starter 的 placeholder 替換策略。同時 Dflow 在 Alice 勾完 trunk-based 後特別「reconfirm 不要 gitflow」，讓同事看到 CLI 對「容易誤勾」的選項會主動把關。
- **Prose Language 是專案 baseline 的一部分**。`_conventions.md` 不再是 optional starter；CLI 必定建立它，並把 `## Prose Language` 設為 `zh-TW`，同時保留 canonical English structural language。
- **Placeholder 替換有清楚的兩種策略**：Alice 提供的資訊（System Name → ExpenseTracker、Business Domain → 企業差旅費用申報與核銷、tech stack）直接填入；Alice 沒提供的（stakeholders、user scale、DB、Auth、hosting、slug 縮寫慣例）保留 `{placeholder}` token 並加 `<!-- TODO: ... -->` 註記。Step 5 results report 也有 placeholder review 提醒區段對應每份檔的待填項。
- **CLAUDE.md special handling**：repo 沒既有 `CLAUDE.md` → 走「直接建在 repo root」分支（而不是放到 `dflow/specs/shared/CLAUDE-md-snippet.md` 等手動 merge）。Step 4 announce 時明確區分這兩條路徑，方便同事理解 init-project-flow.md §4.3 的兩條分支。
- **不建 `behavior.md` 與 ADR-* 的設計理由**被明確 announce（per F-05、Day-0 too early），對應 init-project-flow.md §3.1 的 Key Core-edition notes 第四點與 §3.3 not-creating 區塊。這是同事最容易困惑的「為什麼有些檔故意不建」，對話直接點明來由，不留疑問。

## 下一個劇情段

→ [02-new-feature.md](02-new-feature.md)：Alice 啟動 ExpenseTracker 第一個 feature「員工提交費用單」（會建立第一個 bounded context、第一個 Aggregate、走完 T1 Heavy 八步流程）
