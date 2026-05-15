# Dflow

**繁體中文** | [English](README.en.md)

Dflow 是一套 spec-first 的工作流程工具集，專為 AI 輔助軟體開發設計。它為你的 AI 程式設計助理提供具體流程，把變更需求轉成結構化規格、領域語言、實作計畫、漂移檢查、與可審查的程式碼，而不是從 prompt 直接跳到程式碼。

AI 加速交付，但同時放大了領域知識模糊帶來的風險。Dflow 把 DDD 的概念（ubiquitous language、bounded context、domain rules、model ownership）當作 SDD 的語意骨幹，讓 AI 在產生程式碼之前先有約束。目標不是流程本身，而是讓軟體變更可重複、語意更清楚、規則更不散落、行為更不依賴 prompt。

## 主要特點

| 特點 | 對工程團隊的幫助 |
|---|---|
| **Spec-first 開發** | 每個有意義的變更都先建立明確規格、驗收行為、實作計畫，再開始改程式碼。 |
| **Greenfield 與 Brownfield 雙軌** | 在新專案乾淨起步，或在既有 codebase 中以漸進的領域抽出與更安全的逐步變更引入 Dflow。 |
| **混合式工作流程控制** | 以命令為主的明確進入點、自動偵測安全網、透明的階段閘門，讓開發者保持主導。 |
| **DDD 語意骨幹** | 紀錄領域語言、上下文邊界、業務規則、模型決策，讓 AI 輸出受到專案語意約束。 |
| **三層文件模型** | 短期 phase delta、feature snapshot、長期 system-level 分開存放，規格不會變成大雜燴。 |
| **漂移驗證** | 檢查規格、領域文件、實作、測試、技術債紀錄是否仍在描述同一個系統。 |

## 開始使用

前置需求：已安裝 Node.js / npm，且全域 npm bin 目錄已加入 `PATH`。

於要採用 Dflow 的專案根目錄執行：

```bash
npm install -g dflow-sdd-ddd
dflow init
```

init 流程會詢問是 greenfield 或 brownfield，接著預覽即將建立的檔案。既有檔案不會被覆寫。Init 只建立 workflow 文件與 AI 指示檔，**不會**檢查、重構、或遷移你的應用程式碼。

若專案已初始化、之後又要加入另一個 AI 程式設計工具，執行：

```bash
dflow configure-agents
```

此指令只設定 AI 指示檔，不會重跑專案初始化，也不會動到既有 specs。

### 替代路徑：不安裝直接試用

若無法或不想全域安裝（沒有管理員權限、暫時性環境、或只想試一次），Dflow 每個 CLI 指令都可透過 `npx` 執行：

```bash
npx dflow-sdd-ddd init
npx dflow-sdd-ddd doctor
npx dflow-sdd-ddd configure-agents
```

走這條路徑時，同一個 session 內所有指令都要用完整的 `npx dflow-sdd-ddd <subcommand>` 形式；裸 `dflow` 別名只有全域安裝後才能用。

要檢查專案內是否仍有 legacy 或 pre-V1 artifacts（如根目錄的 `specs/` 或舊版的 `_共用/`），執行：

```bash
dflow doctor
```

`doctor` 是唯讀健康檢查；不會修改任何檔案，只報告找到的問題並指向 migration guide。

完成 init 之後，透過 AI 程式設計助理走 Dflow workflow：

```text
/dflow:new-feature
/dflow:modify-existing
/dflow:bug-fix
/dflow:new-phase
/dflow:finish-feature
/dflow:verify
/dflow:pr-review
```

若你的工具不支援自訂 slash command，把同名指令當成普通對話訊息輸入即可。Dflow 是 Markdown-based 的 workflow 材料加一個 scaffolding CLI，能與任何可讀專案指示與 repo 上下文的 AI 程式設計助理一起運作。

第一次採用建議用 branch 或一次性試用專案，讓團隊先檢視產生的 `dflow/specs/` 工作區，再把流程引入正式程式碼。

完整評估流程（init 產生哪些檔案、AI 工具支援、track 選擇、30 分鐘試用 playbook）見 [Evaluating Dflow](docs/evaluating-dflow.md)。Greenfield 與 Brownfield 端到端劇情走完與規格範例見 [`tutorial/`](tutorial/README.md) 索引。

## 專案 Track

| Track | 何時用 | 主要產出 |
|---|---|---|
| **Greenfield** | 新系統或新 bounded area，有空間早期塑形架構與領域模型 | 乾淨的規格 baseline、領域模型歸屬、feature-by-feature SDD 實作 |
| **Brownfield** | 在既有 codebase 增加或修改行為，業務規則可能已散落各處 | 漸進的領域抽出、更安全的變更規劃、可遷移的領域知識 |

兩條 track 描述的是採用風格，不是 framework 品牌。Dflow 本質是給「希望 AI 協助、又不願放棄領域清晰度」的軟體團隊使用的 workflow 系統。

## Workflow 模型

Dflow 採用混合設計：

| 層 | 用途 |
|---|---|
| **命令進入** | 開發者主動以 `/dflow:new-feature`、`/dflow:modify-existing` 等命令開始工作。 |
| **自動偵測安全網** | 當對話明顯指向某個 feature、phase、bug fix、verification、review 時，AI 應主動建議對應的 Dflow flow。 |
| **透明閘門** | AI 宣告 flow 進入、phase 轉換、重要內部步驟，讓開發者在工作擴張前確認方向。 |

Dflow 也依變更風險縮放 ceremony：

| Tier | 典型用途 | 預期份量 |
|---|---|---|
| **T1 Lightweight** | 小 bug fix 或窄幅修改 | 最小規格、聚焦驗證 |
| **T2 Standard** | 一般 feature 工作 | Feature 規格、行為例子、實作計畫、收尾檢查 |
| **T3 Full** | 跨多處變更、新 bounded context、高風險架構工作 | 完整領域建模、phase 規劃、更廣的 drift verification、更嚴格的 review gate |

透明閘門與 T1/T2/T3 tier 有關但獨立：透明閘門控制 AI 如何溝通 workflow；tier 控制變更需要多少規格與驗證。

## 文件模型

Dflow 依 lifecycle 分開文件：

| 層 | 形式 | 用途 |
|---|---|---|
| **Phase Delta** | 短期 phase 規格 | 紀錄此 phase 改了什麼、為什麼、怎麼驗證 |
| **Feature Snapshot** | Feature 等級摘要與行為 | 在 phase 完成後保留接受的行為與實作決策 |
| **System State** | 共用的 domain 與 architecture 文件 | 維持長期知識：術語表、context map、規則、模型、慣例、技術債 |

這讓 AI 協作有依據。Phase 層給 agent 即時執行 context、feature 層紀錄交付了什麼、system 層成為未來 prompt 與 review 的長期 source of truth。

## Init 產生的檔案

典型初始化專案會建立 `dflow/` workspace：

```text
dflow/
└── specs/
    ├── shared/
    │   ├── _overview.md
    │   ├── _conventions.md
    │   └── Git-principles-*.md
    ├── domain/
    │   ├── glossary.md
    │   └── context-map.md
    ├── architecture/
    │   └── tech-debt.md
    └── features/
        ├── active/
        └── completed/
```

Dflow 也會為你的 AI 程式設計助理建立或提供可合併的專案指示檔；確切檔名取決於目標工具與既有專案設定。Dflow 不覆寫既有專案指示。

選擇 AI agent 設定時，Dflow 把 `dflow/specs/shared/AI-AGENT-GUIDE.md` 作為 canonical 專案指南，並建立指回它的小型工具特定 shim：

| 目標工具 | 產生檔案 |
|---|---|
| Codex / Copilot coding agent | `AGENTS.md` |
| Claude Code | `CLAUDE.md` |
| Gemini CLI | `GEMINI.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

若這些檔案已存在，Dflow 不會覆蓋，改寫 merge snippet 到 `dflow/specs/shared/`。專案指南保持單一 source of truth，團隊就能用多個 AI 工具而不必維護多份 workflow 規則。

之後團隊採用新 AI 程式設計助理時，可隨時跑 `dflow configure-agents` 新增 shim。

特定工具的 init 寫入內容與 Dflow workflow 命令呈現方式，見 `docs/` 內的 per-tool 指南：

- [Using Dflow with Claude Code](docs/using-with-claude-code.md)
- [Using Dflow with Codex CLI](docs/using-with-codex.md)
- [Using Dflow with Gemini CLI](docs/using-with-gemini-cli.md)
- [Using Dflow with GitHub Copilot](docs/using-with-github-copilot.md)

Init 不會把 `tutorial/` 目錄複製進你的專案。[`tutorial/`](tutorial/README.md) 目錄存放在本 source repository，作為理解 Dflow 如何在 Greenfield / Brownfield 劇情中運作的評估材料。

## 主要 Flow

| Flow | 何時用 | 典型產出 |
|---|---|---|
| `/dflow:new-feature` | 新的使用者可見能力或業務行為 | Feature 規格、行為例子、phase 計畫、領域更新 |
| `/dflow:modify-existing` | 修改系統內既有行為 | 影響分析、更新後的規格、調整後的領域規則、必要時遷移筆記 |
| `/dflow:bug-fix` | 可清楚陳述預期行為的 defect | 輕量規格、重現、修復計畫、regression check |
| `/dflow:new-phase` | feature 需要再一個實作切片 | Phase delta、驗收檢查、聚焦的實作計畫 |
| `/dflow:finish-feature` | 實作完成、需要收尾 | Drift verification、feature snapshot、技術債更新、review checklist |
| `/dflow:verify` | 需要確認文件與程式碼仍一致 | 跨規格、領域文件、實作、測試、債務紀錄的 drift report |
| `/dflow:pr-review` | 變更已準備好接受審查 | SDD/DDD 合規 review，含風險、缺口、後續項目 |
| `/dflow:report-dflow-feedback` | 你或 AI 在使用 workflow 時發現 Dflow 本身的問題或可改善處 | sanitized 的本地 feedback 草稿，給 GitHub issue 或未來 PR；不自動送出 |

## 為什麼 DDD 在 AI 時代更重要

AI 助理擅長填補空白。當缺少的細節是機械式的，這是優點；但當缺少的細節是業務意義時就有風險。如果 prompt 沒有定義語言、邊界、允許的行為，模型可能會發明合理但難以在 review 中察覺的規則。

Dflow 把 DDD 當成規格背後的語意結構：ubiquitous language 讓命名一致、bounded context 防止語意跨領域漏氣、領域規則在實作開始之前先定義什麼是正確、允許、禁止。

在 code-first workflow 裡，設計常常在類別、handler、測試完成後才浮現。在 AI-assisted workflow 裡，規格必須成為產生程式碼的前置條件。實務流程變成：

```text
領域意義 → 結構化規格 → AI 實作 → 程式碼即產出
```

更詳細的說明見 [Why DDD Matters More with AI](docs/why-ddd-for-ai.md)。

## Repo 結構

| 路徑 | 用途 |
|---|---|
| `bin/` | CLI 進入點 |
| `lib/` | Init runtime 實作 |
| `templates/` | init 指令複製的檔案 |
| `test/` | 產出物的 smoke test |
| `tutorial/` | 引導式學習劇情與預期產出 |
| `sdd-ddd-*-skill/` | AI 程式設計助理消化的 workflow 來源材料 |

## 貢獻與發布

issue 與 pull request 指引見 [CONTRIBUTING.md](CONTRIBUTING.md)。Pull request 會在 review 前跑 GitHub 上自動 verification workflow。Maintainer-facing 的 release 規則見 [Release and Versioning Policy](docs/release-versioning-policy.md)；手動 npm flow 見 [npm Publish Checklist](docs/npm-publish-checklist.md)。

## 狀態

Dflow 目前以 `dflow-sdd-ddd` 名稱發佈於 npm。最新發佈版本為 `0.2.0`，涵蓋專案初始化、workflow 文件、多 AI agent 設定、AI agent 可讀的 SDD/DDD 指引、公開 migration tooling（手動 migration guide 與 `dflow doctor` 唯讀健康檢查）、公開 onboarding（evaluator 指南與 Claude Code / Codex CLI 的 per-tool walkthrough）、僅驗證的 CI workflow。

GitHub 上的 source 可能包含 `0.2.0` 之後尚未發佈的 repo 變更。完整 release history 見 [CHANGELOG.md](CHANGELOG.md)。

## 授權

MIT License，見 [LICENSE](LICENSE)。
