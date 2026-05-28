# 在 Codex CLI 中使用 Dflow

> **繁體中文** | [English](using-with-codex.en.md)

當你的 AI 程式設計助理是 [Codex CLI](https://developers.openai.com/codex/cli) 時，Dflow 的使用體驗 walk-through。閱讀約需 10 分鐘。

本指南專注於 Codex CLI 的具體使用體驗。工具中立的評估流程請見
[`docs/evaluating-dflow.md`](evaluating-dflow.md)。完整的 Get Started
與功能列表請見 [`README.md`](../README.md)。

## 本指南的適用對象

你正在使用或評估以 Codex CLI 作為 AI 程式設計助理的 Dflow。
本指南說明 `init` 之後 Codex 看到了什麼、`AGENTS.md` 薄 shim 是如何指向
canonical Dflow 指南的，以及幾個值得了解的 Codex 專屬指令與權限模式。

你不需要在執行 `init` 之前先讀本指南。它最適合在你執行過一次 `init` 之後、
想了解 Codex CLI 實際載入什麼內容時閱讀。

## 前置條件

- 已安裝並完成認證的 Codex CLI（見
  [developers.openai.com/codex/cli](https://developers.openai.com/codex/cli)）。
- 已具備 Node.js / npm 環境（Dflow 透過 npm 發佈）。以
  `npm install -g dflow-sdd-ddd` 全域安裝，或用 `npx dflow-sdd-ddd` 走免安裝路徑。
- 有一個你願意在其中執行 init 的專案目錄。首次嘗試建議先用 branch 或
  可拋棄的範例專案；見
  [評估者指南 Playbook](evaluating-dflow.md#30-分鐘評估-playbook)。
- Codex 從已初始化的專案根目錄啟動，或以 `codex --cd` 指向該根目錄，
  確保 Codex 的 `AGENTS.md` 探索範圍包含 Dflow shim。

執行 Dflow workflow 不需要獨立的 Dflow 服務或 API 金鑰。
這些 workflow 是 Markdown-based 的指示與專案檔案。

## `init` 之後 Codex CLI 看到了什麼

執行 `dflow init`（或免安裝路徑的 `npx dflow-sdd-ddd init`）並選擇
`AGENTS.md - Codex / Copilot coding agent` 作為目標工具後，會在專案根目錄
建立一個薄 shim：

```markdown
# AGENTS.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md`

Keep tool-specific instruction files small. The Dflow guide above is the
single source of truth for project workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
```

Codex 在這個專案中啟動時，有兩件事值得注意：

1. Codex CLI 將 `AGENTS.md` 作為專案指示讀取。這是 Codex 的
   標準 repository 指示機制。
2. Dflow shim 不含 Markdown import 那一行。與 Claude Code 的 shim 不同，
   產生的 `AGENTS.md` 不含 `@dflow/specs/shared/AI-AGENT-GUIDE.md`。

這意味著 Codex 能立即看到指標，但 canonical Dflow 指南不會由 shim 自動 inline 嵌入。
在規劃或編輯之前，Codex 應跟著指標讀取 `dflow/specs/shared/AI-AGENT-GUIDE.md`。
若 Codex 在回應 Dflow 請求時沒有提到該檔案，請明確引導它：「Before continuing,
read and follow `dflow/specs/shared/AI-AGENT-GUIDE.md`.」

canonical 指南是實際 workflow 規則的所在：專案上下文（track、技術棧、
文章語言）、Dflow workflow 表、source-of-truth 檔案路徑，以及核心 SDD/DDD 規則。
`AGENTS.md` shim 刻意保持精簡，這樣 canonical 指南就能同時服務 Codex CLI、
Claude Code、GitHub Copilot 與其他工具。

如果專案中已有 `AGENTS.md`，`init` 不會覆蓋它。若既有檔案尚未指向
`dflow/specs/shared/AI-AGENT-GUIDE.md`，`init` 會在
`dflow/specs/shared/AGENTS-md-snippet.md` 下寫入 merge snippet，
讓你手動合併。這樣可以避免破壞你已有的自訂專案指示。

若是 `dflow configure-agents --command-adapters` 情境，對應檔名為
`dflow/specs/shared/AGENTS-md-command-adapters-snippet.md`。

## 在 Codex CLI 中使用 Dflow Workflow 指令

Codex CLI 有自己的內建 slash command 層，用來控制 CLI session。
`/permissions`、`/model`、`/status`、`/diff`、`/review`、`/init` 等指令
都是 Codex CLI 控制項，不是 Dflow workflow。

Dflow 的 canonical `/dflow:*` 項目是 AI 透過 `AI-AGENT-GUIDE.md` 識別的
workflow 名稱，不是已註冊的 Codex CLI 指令。Codex 會先處理 `/` 前綴，因此
最可靠的方式是移除開頭斜線，把同一個名稱當普通文字輸入：

```text
dflow:new-feature
```

或用一句普通對話指示：

```text
Run the Dflow dflow:new-feature workflow.
```

若 Codex 回報未知 slash command，改以不帶斜線的純文字重新送出：

```text
Treat dflow:new-feature as the canonical /dflow:new-feature Dflow workflow
name. Read dflow/specs/shared/AI-AGENT-GUIDE.md and start that workflow.
```

典型的對話如下：

```text
You: dflow:new-feature

Codex CLI: I'll read dflow/specs/shared/AI-AGENT-GUIDE.md first, then use the
new-feature workflow. Please describe the user-visible capability or business
behavior you want to add.

You: Allow expense submitters to attach a receipt image when filing an
expense.

Codex CLI: I'll start by drafting a feature spec under
dflow/specs/features/active/. Before I do, I have a few clarifying questions.
```

接著這個 workflow 會引導你完成 spec 起草、行為範例、實作計畫，以及
finish-feature 漂移（drift）檢查。確切的流程取決於你進入的是哪個 workflow
（`dflow:new-feature`、`dflow:modify-existing`、`dflow:bug-fix` 等；canonical
guide 中記為 `/dflow:*`）。

可用的 workflow 入口：

| Codex 輸入 | 適用情境 |
|---|---|
| `dflow:new-feature` | 需要新增一個使用者可見的功能或業務行為。 |
| `dflow:modify-existing` | 需要修改現有行為。 |
| `dflow:bug-fix` | 可以用預期行為 vs 實際行為描述的缺陷。 |
| `dflow:new-phase` | 進行中的 feature 需要另一個實作 slice。 |
| `dflow:finish-feature` | 實作完成後需要進行漂移（drift）收尾。 |
| `dflow:verify` | 需要對 spec、領域文件、實作與測試進行一致性檢查。 |
| `dflow:pr-review` | 變更已準備好進行 SDD/DDD review。 |
| `dflow:report-dflow-feedback` | 你發現了 Dflow 的問題或改進點，想要一份清理過的上游回饋草稿。 |

如果你忘了 workflow 名稱，請 Codex 讀取 `dflow/specs/shared/AI-AGENT-GUIDE.md`
並列出可用的 Dflow workflow 即可。

### 選配 Command Adapters 的 Codex 行為

`dflow configure-agents --command-adapters` 對 Codex 採文字 trigger 強化，不會建立
Codex 命令檔，也不會新增 `.agents/skills/dflow/SKILL.md`。Codex v1 沒有與
Claude `.claude/commands` 或 Copilot `.github/prompts` 對等的 Dflow command-file
adapter。

當你在 `--command-adapters` 模式下選擇 `AGENTS.md - Codex / Copilot coding agent`
時，Dflow 會把從 canonical command registry 產生的 trigger 清單寫進 `AGENTS.md`。
這些 trigger 仍是文字提示，例如：

```text
dflow:new-feature
```

只要 `AGENTS.md` 是 Dflow 產生且未經改動的 shim（標準 `init` → `configure-agents
--command-adapters` 流程就是如此），Dflow 會把帶 marker 的 trigger 段**直接注入**
`AGENTS.md`，零手動合併；重複執行會就地重投影同一段、不會重複附加。

如果 `AGENTS.md` 在 Dflow 產生後被改過、或本來就是你自訂的檔案，Dflow 會保留既有
檔案不動，改把 trigger 段寫到 merge snippet 供你手動合併。此情況下 Codex 目標的
merge snippet 檔名是 `dflow/specs/shared/AGENTS-md-command-adapters-snippet.md`。

### 產生物的版控政策（Codex）

Codex 不產生 command 檔，所以**沒有需要 gitignore 的衍生 adapter**。Codex 端要版控的是
`AGENTS.md` shim 與 `dflow/`（canonical guide + 規格）；其中
`dflow/specs/shared/AGENTS-md-command-adapters-snippet.md` 這個 merge helper 屬 `dflow/` 的一部分，
**隨 `dflow/` 一起版控**。`--command-adapters` 對 Codex 只強化 `AGENTS.md` 的文字 trigger，
不新增任何 `.claude/`、`.github/`、`.agents/` 命令檔，因此 Claude / Copilot 那套「衍生 adapter
要不要版控」的取捨在 Codex 端不適用。其他工具的 adapter 版控政策見
[README「Init 產生的檔案」](../README.md#init-產生的檔案) 與各 per-tool 指南。

## 與其他 AI 工具的差異

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）在各工具之間是相同的。
只有根目錄層的 shim 有所不同：

| 工具 | 產生的 shim | 載入 canonical 指南的方式 |
|---|---|---|
| Claude Code | `CLAUDE.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
| Codex / Copilot coding agent | `AGENTS.md` | 專案指示載入 shim；Codex 須跟著指標讀取指南 |
| GitHub Copilot | `.github/copilot-instructions.md` | 直接讀取 repository 指示 |

你可以之後執行 `dflow configure-agents` 來新增另一個工具的 shim，而不需要重跑
`init`。若需要 Claude / Copilot 的工具原生命令 wrapper，可 opt in
`dflow configure-agents --command-adapters`。Codex 在此模式下仍是文字 trigger
only。同一個專案可以同時啟用多個工具，並透過 canonical 指南保持同步。

Codex 也有自己的專案指示分層機制。它可以從 Codex home 讀取全域指示、
從專案根目錄到當前工作目錄之間的 `AGENTS.md` 檔案讀取專案指示。
對 Dflow 而言，關鍵的實務規則很簡單：從已初始化的專案根目錄啟動 Codex，
並將 Dflow 指標保留在最近一層相關的 `AGENTS.md` 中。

如果你的團隊在同一個專案中同時使用 Claude Code 和 Codex CLI，
不需要額外的 Dflow 協調。兩個工具都讀取相同的 canonical 指南；
只有 shim 檔案與載入機制不同。

## 常見模式與注意事項

**保持 `AGENTS.md` 精簡。** 如果你發現自己在把 workflow 規則、spec 路徑或
SDD 約束加入 `AGENTS.md`，這些內容應該放到
`dflow/specs/shared/AI-AGENT-GUIDE.md`。shim 保持精簡，其他工具的 shim 才不會
與它產生漂移（drift）。

**Codex 不會從 `AGENTS.md` inline 嵌入 Dflow 指南。** 產生的 Codex shim
是以普通的 Markdown bullet 指向 canonical 指南，而非 `@...` import。
若 Codex 看起來只從 shim 工作，請要求它讀取 `AI-AGENT-GUIDE.md`。

**`/dflow:*` 不是 Codex CLI 的內建 slash command。** Codex slash command 控制
的是 Codex session 本身。當 slash 輸入被攔截或拒絕時，改用不帶斜線的普通文字
`dflow:<id>`，例如 `dflow:status`。模型會依 `AI-AGENT-GUIDE.md` 把它視為
canonical `/dflow:<id>` workflow。

**Codex 不產生命令檔。** 即使使用 `--command-adapters`，Codex 也只強化
`AGENTS.md` / merge snippet 中的文字 trigger 說明。不要期待 `.claude/commands`、
`.github/prompts` 或 `.agents/skills/dflow/SKILL.md` 形式的 Codex 專屬命令檔。

**不要混淆 Codex `/init` 與 Dflow `init`。** Codex `/init` 為 Codex 建立
通用的 `AGENTS.md` scaffold。Dflow 的設定是 `dflow init`（或免安裝路徑的
`npx dflow-sdd-ddd init`），之後新增工具 shim 則是 `dflow configure-agents`。

**Permission gates 與 Dflow workflow gates 是分開的。** Codex 可能會依其
sandbox 與 approvals 設定，詢問執行指令、workspace 外編輯或存取網路的權限。
Dflow workflow 有自己的審核關卡，例如在實作前確認 spec。兩者可能在同一個
session 中同時出現；這是預期行為。

**Codex 本機工作的常見預設是 workspace write 加上 on-request approvals。**
以目前 Codex CLI 的術語為 `--sandbox workspace-write --ask-for-approval on-request`。
在這個模式下，Codex 可在專案內工作，並在超出 sandbox 範圍（例如 workspace
外寫入或存取網路）前先詢問。

**既有的 `AGENTS.md` 會被保留。** 若 Dflow 因檔案已存在而無法安全寫入
根目錄 shim，請到 `dflow/specs/shared/` 下找 merge snippet，
手動將 Dflow 指標合併進你現有的專案指示。

**巢狀 `AGENTS.md` 可能改變 Codex 看到的內容。** Codex 沿著到當前工作目錄
的路徑分層讀取專案指示。若某個子目錄有自己的 `AGENTS.md` 或
`AGENTS.override.md`，請確認它不會遮蓋或矛盾你預期 Codex 遵循的 Dflow 指標。

## 下一步

如果你還沒有執行 `init`：

- 按照[評估者指南 Playbook](evaluating-dflow.md#30-分鐘評估-playbook)
  在可拋棄的範例專案中試用。

如果你已執行 `init` 且想查看端到端的 workflow 範例：

- 閱讀 [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md) 或
  [`tutorial/02-brownfield/`](../tutorial/02-brownfield/walkthrough-00-setup.md)。
  tutorial walk-through 展示了對話流程與產生的 `dflow/specs/` 輸出。

如果你想了解設計理念：

- 閱讀[為什麼 AI 時代 DDD 更重要](why-ddd-for-ai.md)。

如果有任何行為與描述不符：

- 開一個 docs feedback issue（見 [`CONTRIBUTING.md`](../CONTRIBUTING.md)）。
  Per-tool 文件是新內容，有關 Codex CLI 行為的具體回饋非常有價值。
