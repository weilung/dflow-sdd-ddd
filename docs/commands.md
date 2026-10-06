# Dflow 指令參考

> **繁體中文** | [English](commands.en.md)

> **一般使用不需要這一頁。** 你把想做的事講出來，AI 會判斷該走哪一條 workflow，並在每個
> 決策點停下來問你——這是 Dflow 的預設用法，見 [README「你不用先學指令」](../README.md#你不用先學指令)。
>
> 這一頁是給以下三種情況看的：你想直接指定某條 flow、AI 選錯了你要糾正它、
> 或你在盤點 Dflow 到底涵蓋哪些情境。

## 指令一覽

Dflow 指令依角色分四類。

### 入口指令（從這裡開始一個 workflow）

啟動一次 workflow run；可在沒有任何既有 feature 的狀態下使用。三者彼此獨立、不互為前置。

| Flow | 何時用 | 典型產出 |
|---|---|---|
| `/dflow:new-feature` | 完全新功能、新增一條系統要實現的業務規則 | feature 目錄 + `_index.md` + 第 1 份 phase-spec（一律 T1） |
| `/dflow:modify-existing` | 改既有行為 — **不確定改動屬於哪類**時用，AI 內部會分流 | T1 → 升 new-phase / new-feature；T2 → lightweight-spec；T3 → `_index.md` inline 一行 |
| `/dflow:bug-fix` | 可清楚陳述預期行為的 defect | AI 判 tier（多為 T2 lightweight-spec）。無所屬 feature 的 orphan bug 會開一個 minimal（zero-phase）host：**功能性 bug** 走 `bugfix/BUG-{NUMBER}-{slug}`，其餘 standalone T2／T3 走 `feature/{SPEC-ID}-{slug}` |

⚠ `/dflow:bug-fix` 與 `/dflow:modify-existing` **走的是同一份 flow 文件**；tier 由
ceremony cascade 判定，不是由你選了哪個指令決定。所以這兩個名字選錯不會有後果。

### Feature 內指令（限 active feature）

只在已啟動的 active feature 內可用。指向 `completed/` 的 feature 會被拒絕。

| Flow | 何時用 | 典型產出 |
|---|---|---|
| `/dflow:new-phase` | active feature 需要再一個實作切片 | 新一份 `phase-spec-{date}-{slug}.md` + Implementation Tasks + 程式實作 / 驗證 + phase 標記完成（一律 T1） |
| `/dflow:finish-feature` | feature 全部 phase 完成、要收尾 | `git mv` 整個 feature dir 到 `completed/`、sync BR Snapshot 到 BC 層、Integration Summary（不 auto-merge） |

### 流程控制（管理進行中的 workflow run）

| Flow | 何時用 |
|---|---|
| `/dflow:status` | 看現在在哪個 workflow / Step / 進度 |
| `/dflow:next` | 確認過 Step Gate（等同自然語言「OK」/「繼續」） |
| `/dflow:cancel` | 放棄目前 workflow run、回到自由對話。已建立的 artifacts 保留 |

### 獨立工具（任何時候可呼叫，不綁定 feature 或 workflow）

| Flow | 何時用 | 典型產出 |
|---|---|---|
| `/dflow:verify` | 需要確認文件、程式、測試、債務紀錄是否一致 | 跨規格、領域文件、實作、測試、債務的 drift report |
| `/dflow:pr-review` | 變更已準備接受審查 | SDD/DDD 合規 review 清單，含風險、缺口、後續項目 |
| `/dflow:report-dflow-feedback` | 你或 AI 在使用中發現 Dflow 本身的問題 | sanitized 的本地草稿，逐欄對齊上游 issue 表單可直接貼上；不自動送出 |

## 該選哪個指令（rule of thumb）

**不確定就不用選** —— 把事情講出來，或直接下 `/dflow:modify-existing`，AI 會分流。
下表是你想跳過那一步、直接指定時用的。

| 我要做的事 | 直接下指令 |
|---|---|
| 完全新功能（與現有 feature 無關） | `/dflow:new-feature` |
| 為 active feature 加規劃中的下一個 phase | `/dflow:new-phase` |
| 修一個明確的 bug | `/dflow:bug-fix` |
| **不確定**怎麼分類、反正是改既有的 | `/dflow:modify-existing` |
| feature 全部 phase 都完成、要收尾 | `/dflow:finish-feature` |
| 跑變更 review | `/dflow:pr-review` |
| 檢查文件與程式碼 drift | `/dflow:verify` |

## 各 AI 工具怎麼輸入

`/dflow:*` 是 Dflow 的 canonical 共同詞彙；各 AI 工具的 `/` parser 行為不同。
實際輸入方式如下：

| 工具 | 建議叫法 |
|---|---|
| Claude Code（安裝 `--command-adapters` 後） | `/dflow:<id>`，例如 `/dflow:new-feature` |
| GitHub Copilot（VS Code Chat） | 命令入口用 `/dflow-<id>`（連字號，需 `--command-adapters`）；也可自然語言自動觸發。`/dflow:<id>`（冒號）僅當文字稱呼、非命令 |
| GitHub Copilot CLI | 沒有 per-id 命令；先打 `/dflow` 喚起 skill，再用自然語言描述 workflow |
| Codex CLI | 不帶斜線的純文字 `dflow:<id>`，例如 `dflow:new-feature` |

若你的工具不支援自訂 slash command，把 workflow 名稱當成普通對話訊息輸入即可。Dflow 是
Markdown-based 的 workflow 材料加一個 scaffolding CLI，能與任何可讀專案指示與 repo
上下文的 AI 程式設計助理一起運作。

**沒裝 command adapters 也能用。** adapters 是 opt-in 的（`dflow configure-agents
--command-adapters`），它只是把這些名字變成工具原生的 `/` 選單項；自然語言觸發與純文字
輸入都不需要它。

## CLI 指令（在終端機執行，不是對 AI 講）

上面的 `/dflow:*` 是給 AI 助理的 workflow；下面五個是 `dflow` CLI 本身：

| 指令 | 用途 |
|---|---|
| `dflow init` | 在專案裡初始化 Dflow：問模式、Git policy、AI commit 標記、要設定哪些 AI 工具 |
| `dflow configure-agents` | 冪等地重新投影：加新的 AI 工具、刷新 workflow bundle；`--skills` 重生成 skill、`--command-adapters` 產生原生 `/` 命令 |
| `dflow doctor` | 唯讀健康檢查與漂移偵測 |
| `dflow render` | 把 `dflow/specs/` 轉成人類可讀的靜態 HTML |
| `dflow check-closeout` | 收尾 commit 的機械檢查：以結束碼當閘，接在 pre-commit hook 或 CI 上 |

每個指令的完整旗標見它自己的 `--help`（例如 `dflow render --help`）。
`init`、`configure-agents`、`render` 的使用情境與版控建議見 [README「開始使用」](../README.md#開始使用)；
`doctor` 報出來的東西怎麼處理，見[升級既有 Dflow 專案](upgrading.md)與[當 `dflow doctor` 說它沒有把握](doctor-uncertainty.md)；
`check-closeout` 檢查什麼、hook 與 CI 的接法範本，見[收尾 commit 的機械檢查](closeout-check.md)。

`render` 畫的狀態圖與流程圖照 `analysis.md` 的表格畫，不標出哪一條轉移違反規則；一條確認的規則程式還沒照著做時，
偏離記在圖旁邊的文字裡，見[確認的規則與程式不一致時](confirmed-rule-vs-code.md)。
