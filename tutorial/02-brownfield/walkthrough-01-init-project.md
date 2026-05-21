# Walkthrough 01 — `dflow init` 建立 Brownfield baseline

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 展示 Bob 如何在既有 OrderManager WebForms 系統導入 Dflow baseline。
它把一次完整的 CLI init 互動整理成可教學、可 review 的讀物，讓讀者看懂：

- `dflow init` 在 Brownfield 專案中只建立 governance files
- init 如何辨識 WebForms / EF 6 / SQL Server 既有架構
- Brownfield baseline 為什麼建立 `migration/tech-debt.md`
- 為什麼不預建 `dflow/specs/domain/{context}/`、context map 或 `src/Domain/`
- AI guide 和 root tool shim 如何在不覆寫既有規則的前提下建立

閱讀提示：本篇會連到完整文件範例（目前存放在本 tutorial 的 `outputs/` 目錄）。這些範例代表 Brownfield 劇情跑完後的
最終狀態；本篇內嵌片段則說明 init 當下的重點。若想先理解 walkthrough excerpt 和
`outputs/` snapshot 的分工，可讀
[〈如何閱讀 Dflow 規格與完整文件範例〉](../how-to-read-dflow-specs.md)。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Brownfield init 會不會修改 production code？ | 不會。它只建立 `dflow/specs/` governance files 與選定 AI shim。 |
| Dflow 會不會一開始就建 Order BC？ | 不會。第一個 BC 等 `/dflow:modify-existing` 確認真實 boundary 後才建。 |
| tech debt 在 Brownfield baseline 裡有什麼角色？ | `migration/tech-debt.md` 是 Day-0 living backlog，不是事後補記。 |
| Git Flow / trunk-based 怎麼選？ | Bob 有 release / hotfix 節奏，因此選 Git Flow。 |
| AI tool file 怎麼處理？ | Bob 只選 `CLAUDE.md`，root shim 指向 canonical guide。 |

## 前情提要

Bob 已經看完 [〈Walkthrough 00 — Brownfield setup：Bob / OrderManager 的起點〉](walkthrough-00-setup.md) 的系統背景：

```text
OrderManager/
├── OrderManager.Web/
│   └── Pages/Order/OrderEntry.aspx.cs
├── OrderManager.DataAccess/
├── tests/OrderManager.IntegrationTests/
└── (無 src/Domain/)
```

此時還沒有 `dflow/specs/`。Bob 的目標不是在 init 時抽 domain layer，而是先建立一套
spec governance，讓後續每一次修改都有地方記錄需求、current behavior、business rule、
tech debt 與 migration context。

## Step 1 — Bob 執行 CLI init

Bob 已全域安裝 Dflow（`npm install -g dflow-sdd-ddd`），在 repo root 執行：

```bash
dflow init
```

若你尚未全域安裝，可改用 `npx dflow-sdd-ddd init`；效果完全相同，
但後續所有 CLI 命令也必須使用 `npx dflow-sdd-ddd <subcommand>` 形式。

Dflow CLI 先做 current-state inventory：

```text
Dflow CLI:
Step 1: current-state inventory.

Repo inventory:
- .git: present
- dflow/specs/: not yet present
- OrderManager.Web/: ASP.NET WebForms 主專案
- OrderManager.DataAccess/: EF 6 + Stored Procedure wrappers
- tests/OrderManager.IntegrationTests/: 少量 integration tests
- src/Domain/: not present
- CLAUDE.md: not present

判定：Brownfield Dflow setup。
```

這個判定的效果和 Greenfield 不同：

| 判定 | 後續行為 |
|---|---|
| Brownfield setup | 建 baseline governance，不假設可以重構。 |
| WebForms / EF 6 / SP wrappers | `_overview.md` 要記錄 current architecture 與 migration context。 |
| `src/Domain/` 不存在 | init 不建立 code layer；後續修改才抽 domain logic。 |
| `dflow/specs/` 不存在 | 這是第一次 Dflow baseline。 |

## Step 2 — 最小必要問題

Dflow 問 Bob 六類問題：

| 問題 | Bob 的回答 | 影響 |
|---|---|---|
| project type | Brownfield | 使用 Brownfield scaffolding。 |
| tech stack | .NET Framework 4.8 / WebForms / EF 6 / SQL Server 2019 / IIS | 填入 current architecture。 |
| migration context | 長期逐步遷移到 ASP.NET Core，不做大重寫 | `_overview.md` 和 tech debt 會記錄 modernization 方向。 |
| prose language | `zh-TW` | `_conventions.md` 記錄 `## Prose Language`。 |
| optional starter | `_overview.md`、`Git-principles-gitflow.md` | 建 overview 與 Git Flow guide。 |
| AI agents | `CLAUDE.md` | 建 canonical AI guide 與 Claude shim。 |

Bob 選 Git Flow，不是因為 Git Flow 比 trunk-based 更「正確」，而是因為這個維運團隊有
release / hotfix 節奏。Dflow 在這裡只記錄專案事實，不替團隊改變 release ownership。

## Step 3 — File-list preview 是寫檔前的安全線

Dflow 在寫檔前列出 preview：

```text
Will create (10 files):
- dflow/specs/features/active/.gitkeep
- dflow/specs/features/completed/.gitkeep
- dflow/specs/features/backlog/.gitkeep
- dflow/specs/domain/glossary.md
- dflow/specs/migration/tech-debt.md
- dflow/specs/shared/_conventions.md
- dflow/specs/shared/_overview.md
- dflow/specs/shared/Git-principles-gitflow.md
- dflow/specs/shared/AI-AGENT-GUIDE.md
- CLAUDE.md

Will skip (0 files already present)

Not creating yet:
- dflow/specs/domain/{context}/
- dflow/specs/domain/context-map.md
- dflow/specs/features/active/SPEC-.../
- src/Domain/
```

Bob 確認：

```text
Bob:
yes。
```

這個 preview 是 Brownfield init 最重要的保護機制。它讓團隊明確看到 Dflow 不會：

- 搬 Code-Behind
- 建 `src/Domain/`
- 預設第一個 bounded context
- 開第一個 feature directory
- 改 release / hotfix workflow

## Step 4 — Baseline files 寫入 repo

Bob 確認後，Dflow 寫入 baseline。

**features workspace**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/features/active/.gitkeep`](outputs/dflow/specs/features/active/.gitkeep) | 進行中的 feature 工作區，目前沒有 feature 目錄。 |
| [`outputs/dflow/specs/features/completed/.gitkeep`](outputs/dflow/specs/features/completed/.gitkeep) | 已完成 feature 的歸檔區。 |
| [`outputs/dflow/specs/features/backlog/.gitkeep`](outputs/dflow/specs/features/backlog/.gitkeep) | 尚未開工或 deferred 的 feature backlog。 |

**domain / migration baseline**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/domain/glossary.md`](outputs/dflow/specs/domain/glossary.md) | Ubiquitous Language 起點，先放核心術語與 open questions。 |
| [`outputs/dflow/specs/migration/tech-debt.md`](outputs/dflow/specs/migration/tech-debt.md) | Brownfield tech debt backlog，記錄 Code-Behind、SP、測試與 migration gap。 |

**shared governance**

| Path | 用途 |
|---|---|
| [`outputs/dflow/specs/shared/_conventions.md`](outputs/dflow/specs/shared/_conventions.md) | spec writing conventions，含 Brownfield modify-existing 補充與 `zh-TW` prose language。 |
| [`outputs/dflow/specs/shared/_overview.md`](outputs/dflow/specs/shared/_overview.md) | OrderManager overview、current architecture、migration context 與 pain points。 |
| [`outputs/dflow/specs/shared/Git-principles-gitflow.md`](outputs/dflow/specs/shared/Git-principles-gitflow.md) | release / hotfix 節奏對應的 Git Flow guide。 |
| [`outputs/dflow/specs/shared/AI-AGENT-GUIDE.md`](outputs/dflow/specs/shared/AI-AGENT-GUIDE.md) | AI tool-neutral canonical guide。 |

**AI tool shim**

| Path | 用途 |
|---|---|
| [`outputs/CLAUDE.md`](outputs/CLAUDE.md) | Claude Code shim，指向 canonical AI guide。 |

**optional command adapters**

`dflow init` 只建立 root shim。若 Bob 想在 Claude Code 中看到工具原生 Dflow
命令入口，可以在 init 後執行：

```bash
dflow configure-agents --command-adapters
```

選擇 Claude Code 後，Dflow 會產生 `.claude/commands/dflow/<id>.md`，Claude Code
中的叫法是 `/dflow:<id>`，例如 `/dflow:modify-existing`。若同一專案也啟用其他
工具，GitHub Copilot 的 prompt 選單是 `/dflow-<id>`，Codex CLI 則使用不帶斜線的
`dflow:<id>`。這些都指回 `AI-AGENT-GUIDE.md` 的 canonical `/dflow:*` workflow；
差別只在各工具 `/` parser 行為。

## 為什麼 init 不建 `Order` BC

Order 是最可能先處理的候選，但 init 仍不建立 `dflow/specs/domain/Order/`。

原因是 Brownfield 的第一個風險不是「沒有 model」，而是「太早把不確定的 legacy 行為
寫成 model」。Bob 還沒有完成 baseline capture，也還沒有把第一個折扣問題拆成：

- confirmed current behavior
- buggy code result
- expected business rule
- unknown cross-page behavior
- tech debt disposition

因此 Dflow 只先建立 `glossary.md` 與 `migration/tech-debt.md`。真正的
`Order/context.md`、`Order/models.md`、`Order/rules.md`、`Order/behavior.md` 會在
[〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)
和後續 baseline-capture 中由具體 evidence 推出。

## Step 5 — Results and next step

Dflow 最後回報：

```text
Dflow CLI:
Init complete.

Next-step recommendation (brownfield):
run /dflow:modify-existing for the first concrete change.
The first flow should inspect current behavior,
record baseline facts,
and only then decide whether to create dflow/specs/domain/{context}/.
```

Bob 的下一步不是重構，而是等待第一個具體修改需求。他會從一張折扣計算客訴進來，讓 Dflow
先判斷修改重量、feature linkage 與 baseline capture 範圍。

## Dflow feature / benefit mapping

| Dflow 行為 | 讀者應該看到的 benefit |
|---|---|
| Brownfield current-state inventory | 先讀現有 repo，而不是套 Greenfield 假設。 |
| migration context 問答 | 把 modernization 目標記進 baseline，但不立即大重寫。 |
| `migration/tech-debt.md` | Day-0 就開始累積 future migration source of truth。 |
| not-creating 區塊 | 防止 init 預建假的 Order model 或空 context map。 |
| Claude shim + canonical guide | 讓 AI 協作規則集中，不散在各工具檔。 |
| next-step recommendation | 把後續入口導向具體 `/dflow:modify-existing`，不是抽象架構重畫。 |

## 下一個劇情段

→ [〈Walkthrough 02 — `/dflow:modify-existing` 從 WebForms 抽出第一段 Order Domain logic〉](walkthrough-02-modify-existing.md)：Bob
用一個真實折扣計算問題啟動 Brownfield modify-existing flow，先捕捉 current behavior，
再建立第一段 Order Domain logic。
