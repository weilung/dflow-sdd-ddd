# Walkthrough 01 — `dflow init` 建立 Greenfield baseline

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Alice 如何把 Greenfield 專案接上 Dflow。它把一次完整的 CLI
init 互動整理成可教學、可 review 的讀物，讓讀者看懂：

- `dflow init` 和 `/dflow:*` commands 的分工
- init 如何先掃描 repo，再判斷 Greenfield setup
- Dflow 為什麼要問 project type、tech stack、migration context、prose language
- file-list preview 如何在寫檔前建立 step gate
- baseline files、optional starter files、AI tool shims 各自負責什麼
- 為什麼 Day 0 不建立 `behavior.md` 或空的 ADR

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Greenfield 劇情跑完後的
最終狀態；本篇內嵌片段則說明 init 當下的重點。若想先理解 walkthrough excerpt 和
`outputs/` snapshot 的分工，可讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Dflow 是 npm CLI 還是 slash command？ | init 是 `dflow init`（全域安裝）；日常 workflow 才是 `/dflow:*`。 |
| init 會不會覆寫既有檔案？ | 它先列 will-create / will-skip / not-creating，等人確認才寫。 |
| Greenfield baseline 會建哪些 spec 檔？ | shared、domain、architecture、features workspace 與 AI guide。 |
| optional starter 怎麼選？ | Alice 選 `_overview.md` 與 trunk-based Git principles。 |
| AI tool 支援怎麼維持一致？ | 建 canonical `AI-AGENT-GUIDE.md`，root tool files 只當 thin shim。 |

## 前情提要

Alice 已經完成 [〈Walkthrough 00 — Greenfield setup：Alice / ExpenseTracker 的起點〉](walkthrough-00-setup.md) 的準備：

```text
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

此時還沒有 `dflow/specs/`。Alice 的目標不是打開第一個 feature，而是先建立 Dflow
baseline，讓後續 `/dflow:new-feature` 有固定的 spec governance、project overview、
language convention 與 AI collaboration guide 可讀。

## Step 1 — Alice 執行 CLI init

Alice 已全域安裝 Dflow（`npm install -g dflow-sdd-ddd`），在 repo root 執行：

```bash
dflow init
```

若你尚未全域安裝，可改用 `npx dflow-sdd-ddd init`；效果完全相同，
但後續所有 CLI 命令也必須使用 `npx dflow-sdd-ddd <subcommand>` 形式。

Dflow CLI 不會直接寫檔。它先做 current-state inventory：

```text
Dflow CLI:
Step 1: current-state inventory.

Repo inventory:
- .git: present
- dflow/specs/: not yet present
- src/: Clean Architecture layout detected
- tests/: Domain / Application / Integration test projects detected
- AGENTS.md / CLAUDE.md / .github/copilot-instructions.md: not present

判定：Greenfield Dflow setup。
```

這個判定很重要。Greenfield setup 代表：

| 判定 | 後續行為 |
|---|---|
| `dflow/specs/` 不存在 | 建立全新 baseline，而不是 merge 到既有 spec tree。 |
| Clean Architecture layout 已存在 | `_overview.md` 可以描述既有架構方向。 |
| 沒有 root tool files | AI shims 可以直接建立，不需要產 merge snippet。 |
| 沒有 legacy code 需要保護 | 不進 baseline capture；第一個 feature 才建 domain model。 |

## Step 2 — 最小必要問題

Dflow 接著問六類問題。這不是表單填寫，而是用來決定 baseline files 的內容與邊界。

| 問題 | Alice 的回答 | 影響 |
|---|---|---|
| project type | Greenfield | 使用 Greenfield scaffolding。 |
| tech stack | .NET 9 / C# 13 / ASP.NET Core 9 / EF Core 8 / MediatR 12 / xUnit | 填入 `_overview.md` stack table。 |
| migration context | 純新 build | 不加 migration note。 |
| prose language | `zh-TW` | `_conventions.md` 記錄 `## Prose Language`。 |
| optional starter | `_overview.md`、`Git-principles-trunk.md` | 建 project overview 與 trunk-based Git guide。 |
| AI agents | AGENTS、CLAUDE、GitHub Copilot 全選 | 建 canonical AI guide 與三個 thin shims。 |

Alice 特別選 trunk-based，不選 gitflow。Dflow 會重新確認這個二擇一：

```text
Dflow CLI:
確認一下：你只挑 trunk-based、不挑 gitflow 對嗎？
這兩份只能挑一份，挑兩份通常是誤勾。
```

這個小 gate 避免 Git guide 自相矛盾。它也示範 init 不是盲目把所有 template 都丟進 repo。

## Step 3 — File-list preview 是 init 的 step gate

Dflow 在寫檔前列出 preview：

```text
Will create (15 files):
- dflow/specs/features/active/.gitkeep
- dflow/specs/features/completed/.gitkeep
- dflow/specs/features/backlog/.gitkeep
- dflow/specs/domain/glossary.md
- dflow/specs/domain/context-map.md
- dflow/specs/architecture/tech-debt.md
- dflow/specs/architecture/decisions/README.md
- dflow/specs/shared/_conventions.md
- dflow/specs/shared/_overview.md
- dflow/specs/shared/Git-principles-trunk.md
- dflow/specs/shared/AI-AGENT-GUIDE.md
- AGENTS.md
- CLAUDE.md
- .github/copilot-instructions.md

Will skip (0 files already present)

Not creating:
- dflow/specs/domain/{context}/behavior.md
- dflow/specs/architecture/decisions/ADR-*.md
```

Dflow 停下來等 Alice：

```text
Dflow CLI:
這樣 OK 嗎？輸入 yes 我就開工，要調整就告訴我。
```

Alice 回覆：

```text
Alice:
yes，開工。
```

這就是 init 的安全邊界：在 filesystem 改動前，Dflow 先讓人看清楚「會建什麼、不會建什麼、為什麼不建」。

## Step 4 — Baseline files 寫入 repo

Alice 確認後，Dflow 寫入 baseline。重要分組如下。

**features workspace**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/features/active/.gitkeep`](outputs/dflow/specs/features/active/.gitkeep) | 進行中的 feature 目錄。 |
| [`outputs/dflow/specs/features/completed/.gitkeep`](outputs/dflow/specs/features/completed/.gitkeep) | 已完成 feature 的歸檔區。 |
| [`outputs/dflow/specs/features/backlog/.gitkeep`](outputs/dflow/specs/features/backlog/.gitkeep) | 尚未開工的 feature backlog。 |

**domain / architecture baseline**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | Ubiquitous Language 起點，等第一個 feature 補核心術語。 |
| [`outputs/dflow/specs/domain/context-map.md`](outputs/dflow/specs/domain/context-map.md) | Bounded Context 關係圖起點，contexts 先留 TODO。 |
| [`outputs/dflow/specs/architecture/tech-debt.md`](outputs/dflow/specs/architecture/tech-debt.md) | Greenfield 架構債 backlog。 |
| [`outputs/dflow/specs/architecture/decisions/README.md`](outputs/dflow/specs/architecture/decisions/README.md) | ADR home，說明何時建立 ADR。 |

**shared governance**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/shared/_conventions.md`](outputs/dflow/specs/shared/_conventions.md) | spec writing conventions，含 `## Prose Language: zh-TW`。 |
| [`outputs/dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md) | ExpenseTracker overview、tech stack、stakeholder TODO。 |
| [`outputs/dflow/specs/shared/Git-principles-trunk.md`](outputs/dflow/specs/shared/Git-principles-trunk.md) | trunk-based / GitHub Flow 慣例。 |
| [`outputs/dflow/specs/shared/AI-AGENT-GUIDE.md`](outputs/dflow/specs/shared/AI-AGENT-GUIDE.md) | AI tool-neutral canonical guide。 |

**AI tool shims**

| Path | 用途 |
|---|---|
| [`outputs/AGENTS.md`](outputs/AGENTS.md) | Codex / coding agent shim。 |
| [`outputs/CLAUDE.md`](outputs/CLAUDE.md) | Claude Code shim，指向 canonical guide。 |
| [`outputs/.github/copilot-instructions.md`](outputs/.github/copilot-instructions.md) | GitHub Copilot repository instruction shim。 |

**optional command adapters**

`dflow init` 先建立 canonical guide 與 root shims；若團隊想讓工具 UI 顯示 Dflow
命令入口，Alice 會在 init 後再執行 opt-in 設定：

```bash
dflow configure-agents --command-adapters
```

選擇 AGENTS、Claude Code、GitHub Copilot 後，叫法依工具不同：

| 工具 | 產生 / 使用方式 |
|---|---|
| Claude Code | 產生 `.claude/commands/dflow/<id>.md`，在 Claude 中輸入 `/dflow:<id>`，例如 `/dflow:new-feature`。 |
| GitHub Copilot | 產生 `.github/prompts/dflow-<id>.prompt.md`；chat 文字可說 `/dflow:<id>`，VS Code prompt 選單用 `/dflow-<id>`。 |
| Codex CLI | 不產生命令檔；在 `AGENTS.md` / snippet 中強化文字 trigger，實際輸入不帶斜線的 `dflow:<id>`。 |

這個差異是因為各工具 `/` parser 行為不同；canonical `/dflow:*` 仍是
`AI-AGENT-GUIDE.md` 中的共同詞彙。

## 為什麼有些檔故意不建

Dflow 在 preview 階段明說不建立兩類檔：

| 不建立 | 理由 |
|---|---|
| `dflow/specs/domain/{context}/behavior.md` | Day 0 還沒有真正 bounded context。第一個 feature 收尾或 baseline capture 後才建立。 |
| `dflow/specs/architecture/decisions/ADR-*.md` | 目前沒有具體 trade-off。預建空 ADR 只會留下假文件。 |

這是 Greenfield track 的一個 DDD guardrail：**不要在沒有 feature pressure 前假裝模型已經存在。**

Alice 知道 Expense 很可能是第一個 BC，但 Dflow 仍然等到
[〈Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature〉](walkthrough-02-new-feature.md) 才正式建立
`dflow/specs/domain/Expense/`。這讓第一個 BC 由真需求推導，而不是由專案名稱或資料表猜測。

## Step 5 — Results and next step

最後 Dflow 回報：

```text
Dflow CLI:
Init complete.

Next-step recommendation (greenfield):
跑 /dflow:new-feature 啟動第一個 feature。
第一個 feature 會建立 active feature directory，
並在第一個 bounded context 真的成形時建立 domain docs。
```

Alice 接下來會先補 `_overview.md` 中幾個 project-specific placeholder：

| Placeholder | Alice 會補的內容 |
|---|---|
| stakeholders | 員工、部門主管、財務、平台維護團隊。 |
| user scale | 內部使用者規模與提交量級。 |
| DB | PostgreSQL 16。 |
| Auth | Company SSO via OIDC。 |
| Hosting | Azure App Service。 |

這些 placeholder 不急著在 init 時硬填。Dflow 把「已知資訊」與「待補資訊」分開，讓 baseline
可以先落地，又不把缺資訊的地方偽裝成已決策。

## Dflow feature / benefit mapping

| Dflow 行為 | 讀者應該看到的 benefit |
|---|---|
| current-state inventory | 不靠 prompt 猜 repo 狀態，先讀 filesystem。 |
| project type 問答 | Greenfield / Brownfield scaffolding 分流。 |
| prose language baseline | 後續 specs 自由敘述用 `zh-TW`，固定結構保留 English。 |
| file-list preview | 寫檔前先建立人類確認 gate。 |
| AI guide + shims | 多 tool 使用同一份 Dflow rules，不讓規則分岔。 |
| not-creating 區塊 | 避免 Day-0 空殼文件污染 domain truth。 |

## 下一個劇情段

→ [〈Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature〉](walkthrough-02-new-feature.md)：Alice
啟動第一個 feature「員工提交費用單」，由真需求建立 Expense BC、ExpenseReport Aggregate
與第一批 feature specs。
