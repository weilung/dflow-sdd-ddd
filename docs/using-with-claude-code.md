# 在 Claude Code 中使用 Dflow

> **繁體中文** | [English](using-with-claude-code.en.md)

當你的 AI 程式設計助理是 [Claude Code](https://claude.com/claude-code) 時，Dflow 的使用體驗 walk-through。閱讀約需 10 分鐘。

本指南專注於 Claude Code 的具體使用體驗。工具中立的評估流程請見
[`docs/evaluating-dflow.md`](evaluating-dflow.md)。完整的 Get Started
與功能列表請見 [`README.md`](../README.md)。

## 本指南的適用對象

你正在使用或評估以 Claude Code 作為 AI 程式設計助理的 Dflow。
本指南說明 `init` 之後 Claude Code 看到了什麼、Dflow 的 slash
commands 是如何被識別的，以及幾個值得了解的 Claude Code 專屬使用模式。

你不需要在執行 `init` 之前先讀本指南。它最適合在你執行過一次 `init` 之後、
想了解 Claude Code 實際載入什麼內容時閱讀。

## 前置條件

- 已安裝 Claude Code CLI（見 [claude.ai/code](https://claude.com/claude-code)）。
- 已具備 Node.js / npm 環境（Dflow 透過 npm 發佈）。以
  `npm install -g dflow-sdd-ddd` 全域安裝，或用 `npx dflow-sdd-ddd` 走免安裝路徑。
- 有一個你願意在其中執行 init 的專案目錄。首次嘗試建議先用 branch 或
  可拋棄的範例專案；見
  [評估者指南 Playbook](evaluating-dflow.md#30-分鐘評估-playbook)。

你不需要付費的 Claude Code 方案就能閱讀本文件。執行 `/dflow:*` workflow
需要 Claude Code 本身；這些 workflow 都是文字形式，不需要 Claude Code 授權以外的
額外 API 金鑰。

## `init` 之後 Claude Code 看到了什麼

執行 `dflow init`（或免安裝路徑的 `npx dflow-sdd-ddd init`）並選擇 Claude Code
作為目標工具後，會在專案根目錄建立一個薄 shim：

```markdown
# CLAUDE.md - Dflow Project Instructions

This project uses Dflow for spec-first AI-assisted development.

For spec-impacting work — a new feature, a change to product, user-facing, or
domain behavior, a new requirement, or a bug-fix workflow — read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md` — command registry, routing rules, and project context.
- `dflow/specs/shared/dflow-workflows/` — vendored workflow bundle with executable step definitions.

For routine work (refactors, renames, chores, formatting, dependency bumps, or
general code questions), proceed normally; you need not read the guide first.

Keep tool-specific instruction files small. The guide and workflow bundle are
the authoritative sources for Dflow workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.
```

Claude Code 在這個專案中啟動時，會發生兩件事：

1. Claude Code 自動從專案根目錄載入 `CLAUDE.md` 到它的 context 中。
   這是 Claude Code 的標準專案指示機制。
2. `CLAUDE.md` 是一份薄指標，只指向 canonical 指南、不把它 inline 進來。
   指南改為按需載入——`dflow` skill 在相關工作自動觸發時把它讀進來，或由
   AI 在做 spec-impacting 工作時跟著指標讀取。指南因此不會被塞進每個 session 的
   context（progressive disclosure），而非每次強制載入。

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）是**命令登錄表與路由器**：
專案上下文（track、技術棧、文章語言）、`/dflow:*` workflow 表、source-of-truth
檔案路徑，以及核心 SDD/DDD 規則。可執行的 workflow 步驟（Step 1→N、step gates、
completion checklists）則放在 `init` 投影進專案的 **vendored workflow bundle**
（`dflow/specs/shared/dflow-workflows/`）。兩者都是純 Markdown，隨 repo
一起 commit，任何 clone 都能直接讀取，不需要 Dflow source 或 package 在本機安裝。
`CLAUDE.md` shim 刻意保持精簡，這樣 canonical 指南就能在不需要 Claude Code
專屬修改的情況下持續演進。

如果專案中已有 `CLAUDE.md`，`init` 不會覆蓋自訂內容。已是 Dflow-generated shim
的檔案會原地刷新；其他已指向 `dflow/specs/shared/AI-AGENT-GUIDE.md` 的檔案會
略過，不會新增第二個指標。否則 Dflow 會在確認 preview 顯示並於檔案末尾附加帶有
`<!-- dflow-generated: agent-shim START/END -->` markers 的 Dflow block；重跑
會原地更新同一段，不會重複。只有遇到衝突或 malformed Dflow markers 時，
才會改寫 `dflow/specs/shared/CLAUDE-md-snippet.md` fallback merge snippet 讓你手動處理。

## 在 Claude Code 中使用 Dflow Slash Commands

Dflow 的 canonical `/dflow:*` 名稱是跨工具共用的 workflow 詞彙；各工具的
`/` parser 行為不同，Claude Code 需要註冊過的 slash command 才能接受
`/dflow:<id>` 形式。建議先安裝下方的 command adapters，然後以 Claude Code
實際註冊的名稱輸入：

```text
/dflow:new-feature
```

安裝 adapter 後，Claude Code 會把 `.claude/commands/dflow/<id>.md` 註冊成
`/dflow:<id>`。Wrapper 會指回 `AI-AGENT-GUIDE.md` 中的 canonical workflow。
一次典型的對話如下：

```text
You: /dflow:new-feature

Claude Code: Entering new-feature workflow. Please describe the user-facing
capability or business behavior you want to add.

You: Allow expense submitters to attach a receipt image when filing an
expense.

Claude Code: I'll start by drafting a feature spec under
dflow/specs/features/active/. Before I do, I need a short answer on:
[clarifying questions about scope, owner, priority]
```

接著這個 workflow 會引導你完成 spec 起草、行為範例、實作計畫，以及
finish-feature 漂移（drift）檢查。確切的流程取決於你進入的是哪個 workflow
（`/dflow:new-feature`、`/dflow:modify-existing`、`/dflow:bug-fix` 等）。
可執行的步驟定義（Step 1→N、step gates、completion checklists）存放在
`dflow/specs/shared/dflow-workflows/` 的 vendored bundle 中；`init` 會把這個
bundle 投影進每個初始化的專案，因此 workflow 步驟是 self-contained 且可達的，
不需要任何外部 source dependency。

可用的 workflow 入口：

| 指令 | 適用情境 |
|---|---|
| `/dflow:new-feature` | 需要新增一個使用者可見的功能或業務行為。 |
| `/dflow:modify-existing` | 需要修改現有行為。 |
| `/dflow:bug-fix` | 可以用預期行為 vs 實際行為描述的缺陷。 |
| `/dflow:new-phase` | 進行中的 feature 需要另一個實作 slice。 |
| `/dflow:finish-feature` | 實作完成後需要進行漂移（drift）收尾。 |
| `/dflow:verify` | 需要對 spec、領域文件、實作與測試進行一致性檢查。 |
| `/dflow:pr-review` | 變更已準備好進行 SDD/DDD review。 |
| `/dflow:report-dflow-feedback` | 你發現了 Dflow 的問題或改進點，想要一份清理過的上游回饋草稿。 |

如果你忘了指令名稱，問 Claude Code「what dflow workflows are available?」
即可 —— 答案會從它已載入的 workflow 表中給出。

若尚未安裝 command adapters，或 Claude Code 將 slash-prefixed 輸入判定為
Unknown command，請改用普通文字，例如 `dflow:new-feature` 或
`Run the Dflow /dflow:new-feature workflow.`，讓模型依 canonical guide 執行。

### 選配 Command Adapters

如果想讓 Claude Code 看到工具原生的命令入口，可在已初始化的專案中執行：

```bash
dflow configure-agents --command-adapters
```

選擇 Claude Code 後，Dflow 會從 canonical guide 內的 command registry
投影產生薄 wrapper：

- `.claude/commands/dflow/<id>.md`

這些 wrapper 使用 Claude Code 的目錄 namespace 命名，例如
`/dflow:new-feature`。Wrapper 內容只指向 canonical `/dflow:new-feature`
workflow 與 `dflow/specs/shared/AI-AGENT-GUIDE.md`，不複製 workflow 步驟。
從 Dflow 0.5.0 升級的專案可能仍保留舊檔
`.claude/commands/dflow/dflow-*.md`，會讓 Claude Code 同時顯示舊的
`/dflow:dflow-<id>` 與新的 `/dflow:<id>`。重跑
`dflow configure-agents --command-adapters` 時，Dflow 會**自動偵測並清除**這些
0.5.0 產生的 stale wrapper：待刪檔會列在確認 preview 中（標為 `remove`），由你
確認後才刪除。Dflow 只會刪除**內容與 0.5.0 產生物完全相符**的檔；若該檔被你改過、
或是你自己放在同 namespace 的檔，Dflow 不會刪除，只會印出 warning 提示你自行確認。

### 產生物的版控政策與升級

`.claude/commands/dflow/<id>.md` 是從 canonical guide 投影出來的**衍生物**。Dflow 的
**建議預設**是不版控、由 clone 後重跑 `dflow configure-agents --command-adapters` 重生成；
團隊若想 clone 後立即有原生命令選單，也可改為**版控**。重點是同一專案對所有工具採一致策略
（政策總覽與 ignore-vs-track 取捨見 [README「Init 產生的檔案」](../README.md#init-產生的檔案)）。

採 gitignore 預設時，在專案 `.gitignore` 加入（**僅在你保留 `.claude/commands/dflow/`
namespace 給 Dflow 時**）：

```gitignore
.claude/commands/dflow/
```

注意：此規則會一併 ignore 你放在同一目錄下的自訂 command。若該目錄**已被版控**，新增 ignore
規則不會自動把它移出版控，需先：

```bash
git rm --cached -r .claude/commands/dflow/
```

（`--cached` 只移出版控、保留工作目錄檔案。）

升級 dflow 後重跑 `dflow configure-agents --command-adapters`，adapter 會用**新版 registry**
重投影；但既有 `dflow/specs/shared/AI-AGENT-GUIDE.md` **不會**被覆寫——「重投影 adapter」不等於
「升級 canonical guide」。請以**相同的 dflow CLI 版本**重投影，避免 registry 與 guide 版本錯位。

### Skill Adapter（自然語言自動觸發，init 預設安裝）

Command adapter 提供 `/` 選單入口，但**不會自動觸發**——你得主動打命令。自動觸發
來自 project-level skill，而它現在是**預設安裝**：`dflow init` 有選 AI 工具時就會裝
（互動模式問一題、直接按 Enter = 裝；非互動不多讀答案、直接預設裝），
`dflow configure-agents` 對「新選且尚無 skill」的工具也補問同一題。若當時答 `n`
略過、或想強制重生成（例如升級 Dflow 後刷新），執行：

```bash
dflow configure-agents --skills
```

選擇 Claude Code 後（init 或 configure-agents 皆同），Dflow 會產生一份薄 skill：

- `.claude/skills/dflow/SKILL.md`

這份 skill 不複製 workflow 步驟，body 指向 canonical
`dflow/specs/shared/AI-AGENT-GUIDE.md`（命令登錄表與路由規則）以及
`dflow/specs/shared/dflow-workflows/`（含可執行步驟定義的 vendored bundle）。

同一份 edition-neutral skill source，也會為 Codex
（`.agents/skills/dflow/SKILL.md`）與 GitHub Copilot（`.github/skills/dflow/SKILL.md`）
投影 project-level skill，三家沿用相同的跨工具 agentskills.io 標準。

它的行為：

- **自動觸發於** feature / bug-fix workflow、product/domain behavior 變更、新需求、
  spec-impacting 的 architecture / domain-model 決策。
- **不會觸發於** 純 refactor、infra chore、formatting、一般 code 問題。
- 由自然語言觸發時，**不會直接進 workflow**：它會判斷意圖、**建議對應的 `/dflow:`
  命令並等待你確認**，再進入流程。

**四種組合**（command adapter 維持 opt-in；skill 預設安裝，可在 init 答 `n`
略過或事後刪除）：

| 安裝組合 | 入口行為 |
|---|---|
| 都沒有（skill 題答 `n`、未裝 adapters） | 只有根目錄 shim（CLAUDE.md 指向 guide）；無 `/` 選單、無自動觸發 |
| 只有 command adapters | `/dflow:*` 出現在 `/` 選單；無自然語言自動觸發 |
| 只有 skill（init 預設結果） | 自然語言自動觸發（suggest-and-wait）；無 `/` 選單 |
| 兩者都有 | `/` 選單 + 自然語言 safety net **可共存** |

**兩者可共存、無需互斥**（已在真實 Claude Code 環境驗證）：skill 名稱 `dflow` 與
command adapter 的 `dflow:<id>` 不撞名，明確命令各自精準載入、不會雙觸發；skill 當
自然語言 safety net，command adapters 當 `/` 選單。

安裝後用 `/skills` 或詢問「What skills are available?」確認 skill 已被探索到。注意：
新增頂層 skills 目錄可能需**重啟 Claude Code** 才會被 watch 到。另外，位於
`~/.claude/skills/dflow` 的 personal / enterprise skill 可能會 **override** 專案層級
skill（依 Claude 官方文件），用 `/skills` 可檢查目前生效的是哪一份。

**版控政策**：`.claude/skills/dflow/SKILL.md` 與 command adapter 一樣是**衍生物**，
沿用相同預設——不版控、由 clone 後重跑 `dflow configure-agents --skills` 重生成
（`.claude/skills/dflow/` 已列入建議的 gitignore 集合）；clone-ready 團隊也可選擇版控。
重跑 `--skills` 是 idempotent 的：帶 marker 的既有 skill 會被乾淨重寫；若 `.claude/skills/dflow/SKILL.md`
**不是** Dflow 產生的（無 `<!-- dflow-generated: skill-adapter -->` marker），Dflow 不會覆蓋它，
只會印出 warning 提示你移除或改名。

## 與其他 AI 工具的差異

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）在各工具之間是相同的。
只有根目錄層的 shim 有所不同：

| 工具 | 產生的 shim | 載入 canonical 指南的方式 |
|---|---|---|
| Claude Code | `CLAUDE.md` | 啟動時直接讀取檔案內容 |
| Codex / Copilot coding agent | `AGENTS.md` | 啟動時直接讀取檔案內容 |
| GitHub Copilot | `.github/copilot-instructions.md` | 直接讀取檔案內容 |

你可以之後執行 `dflow configure-agents` 來新增另一個工具的 shim，而不需要重跑
`init`。同一個專案可以同時啟用多個工具，並透過 canonical 指南保持同步。

如果你的團隊在同一個專案中同時使用 Claude Code 和 Codex CLI（這是一種常見的
配置），不需要額外的協調。兩個工具都讀取相同的 canonical 指南；只有 shim
檔案不同。

## 常見模式與注意事項

**保持 `CLAUDE.md` 精簡。** 如果你發現自己在把 workflow 規則、spec 路徑或
SDD 約束加入 `CLAUDE.md`，這些內容應該放到
`dflow/specs/shared/AI-AGENT-GUIDE.md`。shim 保持精簡，其他工具的 shim 才不會
與它產生漂移（drift）。

**`/dflow:*` 命令名不等於 skill。** init 預設會在 Claude Code 的 skill 系統
裝一份自動觸發 skill（`.claude/skills/dflow/SKILL.md`，skill 題答 `n` 可略過），
但 `/dflow:*` 這組**命令名**本身不是 skill——未安裝 command adapters 時，它們
只是 AI 從 workflow 表識別的文字 trigger；安裝
`dflow configure-agents --command-adapters` 後，新增的是薄 command wrapper，
不是 workflow 的第二份定義。

**legacy Claude skill 與 installed adapter 擇一。** 如果專案仍保留舊的
`.claude/skills/sdd-ddd-*` skill，請在 legacy skill 與 `--command-adapters`
之間擇一使用。若必須暫時共存，請用 Claude Code 的 skill override /
`disable-model-invocation` 設定避免 legacy skill 自動觸發，否則同一個
`/dflow:*` 意圖可能同時觸發 legacy skill 與 installed adapter。Installed
adapter wrapper 必須保持薄指標，不應複製 workflow 語義。

**Permission gates 與 Dflow workflow gates 是分開的。** Claude Code 可能會詢問
執行某個工具的權限（例如寫入檔案）。Dflow 的 workflow 有自己的審核關卡（例如
「我已起草 spec —— 你要我繼續進入實作嗎？」）。兩者可能在同一個動作上同時觸發；
這是預期行為，不代表設定有誤。

**指南的引用不會被一次全部載入。** `CLAUDE.md` 指向 `AI-AGENT-GUIDE.md`；而
`AI-AGENT-GUIDE.md` 引用的其他檔案（例如 feature spec）也是按需載入 —— Claude
Code 會在進入對應 workflow 時才讀取它們。這樣可以讓 context 用量與正在進行的
工作保持比例。

**既有的 `CLAUDE.md` 會被保留。** `init` 不會覆蓋你現有的自訂專案指示；已是
Dflow-generated shim 會原地刷新，其他已指向 `AI-AGENT-GUIDE.md` 的檔案會略過，
否則會在確認 preview 顯示要附加的 marked Dflow block，寫入後重跑會原地更新同一段。
若你刪除該 block，下一次 `init` / `configure-agents` 會再附加它；只有 marker
conflict 時才需要到 `dflow/specs/shared/` 找 fallback merge snippet 手動處理。

**跨機器專案可正常運作。** `dflow/specs/` 是純 Markdown，已 check in 到你的
repo。任何人 clone 該 repo 並在其中使用 Claude Code，都會透過已 commit 的
`CLAUDE.md` shim 與 canonical 指南自動看到相同的 Dflow 設定。

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
  Per-tool 文件是新內容，有關 Claude Code 行為的具體回饋非常有價值。
