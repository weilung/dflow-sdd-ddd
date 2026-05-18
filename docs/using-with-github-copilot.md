# 在 GitHub Copilot 中使用 Dflow

> **繁體中文** | [English](using-with-github-copilot.en.md)

當你的 AI 程式設計助理是 GitHub Copilot（IDE chat + inline completions）時，Dflow 的使用體驗 walk-through。閱讀約需 10 分鐘。

本指南專注於 GitHub Copilot 的具體使用體驗。工具中立的評估流程請見
[`docs/evaluating-dflow.md`](evaluating-dflow.md)。完整的 Get Started
與功能列表請見 [`README.md`](../README.md)。

## 本指南的適用對象

你正在使用或評估以 GitHub Copilot 作為 AI 程式設計助理的 Dflow。
本指南說明 `init` 之後 Copilot 看到了什麼、repository shim 的位置、
如何從 IDE 呼叫 Dflow workflow，以及幾個值得了解的 Copilot 專屬使用模式
與 permission 行為。

## 前置條件

- 在你的 IDE（VS Code、JetBrains 或 GitHub.dev）中已啟用 GitHub Copilot。
- 已具備 Node.js / npm 環境（Dflow 透過 npm 發佈）。以
  `npm install -g dflow-sdd-ddd` 全域安裝，或用 `npx dflow-sdd-ddd init`
  走免安裝路徑，確保 repository shim 存在。
- 已具備 Dflow canonical 指南的基本認識：`dflow/specs/shared/AI-AGENT-GUIDE.md`。

## `init` 之後 GitHub Copilot 看到了什麼

`init` 為 Copilot 在以下路徑寫入一個小型的工具專屬薄 shim：

- `.github/copilot-instructions.md`（注意：位於 `.github/` 目錄內，非專案根目錄）

生成的 shim 範例：

```markdown
# GitHub Copilot Repository Instructions

This project uses Dflow for spec-first AI-assisted development.

Before planning or editing code, read and follow:

- `dflow/specs/shared/AI-AGENT-GUIDE.md`
```

重點說明：

- Copilot shim 位於 `.github/copilot-instructions.md`（見 `lib/init.js` mapping）。
- Copilot shim 不含 Markdown `@` import。它只透過路徑指向 canonical 指南，讀取
  `dflow/specs/shared/AI-AGENT-GUIDE.md` 時需明確開啟該檔案。

## 在 GitHub Copilot 中使用 Dflow Workflow 指令

Copilot 是 IDE 優先的助理（chat panel + inline completions），不是 CLI 工具。
請把 Dflow workflow 名稱當成普通的對話指示，而非 CLI slash command：

- 在 Copilot Chat 中：「Run the Dflow /dflow:new-feature workflow」—— Copilot
  應讀取 canonical 指南並繼續執行。
- 在程式碼 comment 或 editor chat 中，以普通文字描述 workflow：
  `Run the Dflow /dflow:new-feature workflow.`

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

### 對話範例

典型的 Copilot Chat workflow 如下：

```text
You: I'd like to use the /dflow:new-feature workflow. We need to add the
     ability for users to export their data as CSV.

Copilot: I'll help you structure this as a new feature. Let me start by
         reviewing the AI-AGENT-GUIDE to understand the spec format.

         Before drafting the feature spec, I need to understand the scope:

         1. Should the CSV include all user data fields or a selected subset?
         2. Which user roles should be able to trigger the export?
         3. Are there any compliance or performance constraints I should know?

You: All fields, only admin users, and exports should complete within 30 seconds
     for datasets up to 1 million rows.

Copilot: Got it. I'll create the feature spec at dflow/specs/features/active/
         with these constraints. Let me also outline the implementation phases...
```

### 既有的 Repository 指示

如果你的專案中已有 `.github/copilot-instructions.md`，`init` 不會覆蓋它。
它改為在 `dflow/specs/shared/` 下寫入 merge snippet，讓你手動審閱後貼入
既有檔案。這樣可以避免破壞你已有的自訂 Copilot 指示。

到 `dflow/specs/shared/COPILOT-INSTRUCTIONS-MERGE-SNIPPET.md` 找到 merge
snippet，再把相關段落貼入你現有的 `.github/copilot-instructions.md`。

### Slash Command Passthrough 說明

Copilot 是否會直通（passthrough）原始的 `/dflow:*` slash command，取決於
IDE 整合方式與 Copilot 版本。若 Copilot 無法識別以 slash 為前綴的 workflow
名稱，以普通文字重新送出請求：

```text
You: Instead of /dflow:new-feature, try: "Please help me start a new Dflow
     feature workflow. Read dflow/specs/shared/AI-AGENT-GUIDE.md first."
```

## 與其他 AI 工具的差異

canonical 指南（`dflow/specs/shared/AI-AGENT-GUIDE.md`）在各工具之間是相同的。
只有根目錄層的 shim 有所不同：

| 工具 | 產生的 shim | 載入 canonical 指南的方式 |
|---|---|---|
| GitHub Copilot | `.github/copilot-instructions.md` | 直接讀取 repository 指示 |
| Claude Code | `CLAUDE.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
| Gemini CLI | `GEMINI.md` | `@dflow/specs/shared/AI-AGENT-GUIDE.md` Markdown import |
| Codex / Copilot coding agent | `AGENTS.md` | 啟動時直接讀取檔案內容 |

- Shim 路徑：Copilot 使用 `.github/copilot-instructions.md`（不是 `AGENTS.md`
  或 `CLAUDE.md`）。
- Markdown import：Copilot shim 不含 `@dflow/specs/shared/AI-AGENT-GUIDE.md`
  import。這點與 Claude Code / Gemini CLI 的 shim 透過 `@` import inline 嵌入不同。
- 工具模型：Copilot 是 IDE-based（chat panel + inline completions）；
  Codex / Claude Code 是 CLI-based agent。Copilot 透過編輯器 UI 互動，而非
  command-line session。
- Workflow 呼叫：使用 CLI agent 時可對 agent process 輸入 `/dflow:*`；使用
  Copilot 時，建議在 Copilot Chat 或 editor comment 中使用普通文字描述。
- Permission 模型：Copilot 依賴 IDE 的 permission 與 extension sandbox。它可能
  受 editor-level approvals 管理；CLI 工具通常有明確的 sandbox flags 與獨立的
  permission gates。

## 常見模式與注意事項

- 保持 `.github/copilot-instructions.md` 精簡。Canonical Dflow 指南
  （`dflow/specs/shared/AI-AGENT-GUIDE.md`）才是 source of truth。
- 若 Copilot 看起來只從 shim 文字工作，請明確要求它開啟或讀取
  `dflow/specs/shared/AI-AGENT-GUIDE.md` 後再繼續。
- Copilot 的 inline completions 可能在未走 Dflow workflow 的情況下直接建議程式碼；
  需要 spec-driven 輸出時，請明確要求執行 workflow。
- Copilot Chat context 不一定會在所有 IDE 版本中自動包含 `.github/` 目錄下的
  repository 指示檔；行為因 Copilot / IDE 版本而異（見頁尾說明）。
- 當 slash-prefixed forms 被 IDE 拒絕時，改用普通文字描述 workflow 名稱。

## 下一步

如果你還沒有執行 `init`：

- 執行 `dflow init`（安裝後）或 `npx dflow-sdd-ddd init`，選擇 Copilot 目標
  以建立 `.github/copilot-instructions.md`。參考
  [評估者指南 Playbook](evaluating-dflow.md#30-分鐘評估-playbook) 在可拋棄的
  範例專案中試用。

如果你已執行 `init` 且想查看端到端的 workflow 範例：

- 閱讀 [`dflow/specs/shared/AI-AGENT-GUIDE.md`](../sdd-ddd-greenfield-skill/scaffolding/AI-AGENT-GUIDE.md)
  （或 brownfield 等效版本）後再開始 workflow。
- 閱讀 [`tutorial/01-greenfield/`](../tutorial/01-greenfield/walkthrough-00-setup.md)，
  其中有展示 Copilot chat flow 的對話範例。

如果你想了解設計理念：

- 閱讀[為什麼 AI 時代 DDD 更重要](why-ddd-for-ai.md)。

---

IDE 行為說明：Slash command passthrough 與 `.github/` 指示檔的自動包含行為，
會因 Copilot / IDE 版本而異。依賴確切語意前請向 maintainer 確認。
