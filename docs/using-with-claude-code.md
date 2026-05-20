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

Before planning or editing code, read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md`

Keep tool-specific instruction files small. The Dflow guide above is the
single source of truth for project workflow rules, slash-command behavior,
spec locations, and SDD/DDD constraints.

If your tool supports Markdown imports, the canonical guide is imported
below:

@dflow/specs/shared/AI-AGENT-GUIDE.md
```

Claude Code 在這個專案中啟動時，會發生兩件事：

1. Claude Code 自動從專案根目錄載入 `CLAUDE.md` 到它的 context 中。
   這是 Claude Code 的標準專案指示機制。
2. 末尾的 `@dflow/specs/shared/AI-AGENT-GUIDE.md` 這行使用 Claude Code 的
   Markdown import 語法，將 canonical Dflow 指南 inline 嵌入。因此 Claude Code
   等效於把兩個檔案當成一組指示來讀取。

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）是實際 workflow
規則的所在：專案上下文（track、技術棧、文章語言）、`/dflow:*` workflow 表、
source-of-truth 檔案路徑，以及核心 SDD/DDD 規則。`CLAUDE.md` shim 刻意保持精簡，
這樣 canonical 指南就能在不需要 Claude Code 專屬修改的情況下持續演進。

如果專案中已有 `CLAUDE.md`，`init` 不會覆蓋它。它改為在
`dflow/specs/shared/` 下寫入 merge snippet，讓你手動貼入現有的 `CLAUDE.md`。
這樣可以避免破壞你已有的自訂專案指示。

## 在 Claude Code 中使用 Dflow Slash Commands

預設情況下，Dflow 的 canonical `/dflow:*` slash commands 是 AI 透過
`AI-AGENT-GUIDE.md` 中的 workflow 表識別的 workflow 名稱，不是 Claude Code
內建的 slash command 系統。你以普通對話方式輸入它們：

```text
/dflow:new-feature
```

Claude Code 將此視為輸入。由於它已透過 `CLAUDE.md` import 載入了 workflow 表，
它會識別這個前綴並進入對應的 workflow。一次典型的對話如下：

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
所有 workflow 定義都存放在 Dflow skill source 中；Claude Code 在需要時讀取
skill 檔案來執行它們。

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

### 選配 Command Adapters

如果想讓 Claude Code 看到工具原生的命令入口，可在已初始化的專案中執行：

```bash
dflow configure-agents --command-adapters
```

選擇 Claude Code 後，Dflow 會從 canonical guide 內的 command registry
投影產生薄 wrapper：

- `.claude/commands/dflow/dflow-<id>.md`

這些 wrapper 使用 adapter-native 命名，例如 `/dflow-new-feature`。Wrapper
內容只指向 canonical `/dflow:new-feature` workflow 與
`dflow/specs/shared/AI-AGENT-GUIDE.md`，不複製 workflow 步驟。Dflow v1 不承諾
Claude Code 選單中一定會出現 exact `/dflow:new-feature` colon 形式；canonical
名稱仍保留在 guide 與 wrapper body 中。

## 與其他 AI 工具的差異

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）在各工具之間是相同的。
只有根目錄層的 shim 有所不同：

| 工具 | 產生的 shim | 載入 canonical 指南的方式 |
|---|---|---|
| Claude Code | `CLAUDE.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
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

**預設 `/dflow:*` 不是安裝 Claude Code Skill。** `init` 不會在 Claude Code 的
skill 系統中安裝任何東西。Slash commands 是 AI 從 workflow 表識別的純文字模式。
若你之後執行 `dflow configure-agents --command-adapters`，新增的是薄 command
wrapper，不是 workflow 的第二份定義。

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

**`@` import 不是遞迴的。** `CLAUDE.md` import 了 `AI-AGENT-GUIDE.md`，但如果
`AI-AGENT-GUIDE.md` 引用了其他檔案（例如 feature spec），那些檔案不會被自動
載入 —— Claude Code 會在進入對應 workflow 時按需讀取它們。這樣可以讓 context
用量與正在進行的工作保持比例。

**既有的 `CLAUDE.md` 會被保留。** `init` 不會覆蓋你現有的專案指示。請到
`dflow/specs/shared/` 下找 `init` 寫入的 merge snippet，並手動將相關段落貼入
你現有的 `CLAUDE.md`。

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
