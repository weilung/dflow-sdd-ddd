# Walkthrough 00 — Greenfield setup：Alice / ExpenseTracker 的起點

> 語言版本：繁體中文 canonical draft。
> English adaptation 會在中文版定稿後另建。

這份 walkthrough 是 Greenfield 線的入口。它不展示任何 Dflow command，而是讓讀者先看懂
Alice 為什麼適合從 Greenfield track 開始，以及第一個 feature 還沒出現前，哪些
技術與 domain 判斷已經影響後續 Dflow 對話。

如果直接從 [〈Walkthrough 02 — `/dflow:new-feature` 建立第一個 Expense feature〉](walkthrough-02-new-feature.zh-TW.md)
開始讀，讀者會看到 Dflow 建立 Expense BC、Aggregate 與 feature spec；但不一定知道
為什麼 Alice 沒有 baseline capture、沒有 legacy regression risk、也沒有先處理
主管審核或財務核銷。本篇補的是這個入口上下文。

## 本篇適合誰讀

| 你關心的問題 | 本篇會展示的部分 |
|---|---|
| Greenfield track 適合什麼專案？ | 新建 ASP.NET Core 專案，尚未有 production legacy code。 |
| Dflow 介入前要先準備什麼？ | repo、solution、Clean Architecture 目錄、測試專案與第一個業務入口。 |
| Day 0 要不要先設計完整 Domain？ | 不要。Alice 只先保留 ExpenseTracker 的業務方向，第一個 BC 會由第一個 feature 長出來。 |
| Greenfield 和 Brownfield 的核心差異是什麼？ | Alice 可以從第一個 feature 建立 model；Bob 必須先保護既有行為。 |
| 本篇是否會產生 `outputs/`？ | 不會。setup 是 Dflow 前的 project state，outputs 從 `dflow init` 後才開始。 |

## 劇情背景

Alice 是新成立「差旅費用平台」小組的 PO + 全端工程師。團隊準備從零建立
ExpenseTracker，目標是讓員工提交費用申報單，主管審核後交給財務核銷。

她不是想把 DDD 當成一套龐大 upfront design。第一天她只想做到三件事：

1. 建好 ASP.NET Core solution。
2. 讓專案有清楚的 Clean Architecture 分層。
3. 在第一個真正 feature 開始前導入 Dflow baseline。

這個順序很重要。Dflow 不是取代專案初始化工具；它也不是要 Alice 在沒有需求前先畫完
所有 bounded context。它會在 repo 已存在、技術方向已大致確定後，開始建立 spec
governance，接著用第一個 feature 逼出 domain model。

## Step 0 — 專案還沒進 Dflow，但已經有形狀

Alice 已經先建立一個 Clean Architecture solution：

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

這個 tree 告訴 Dflow 幾件事：

| 觀察 | 對 Dflow 的意義 |
|---|---|
| `.git/` 已存在 | 可以在 init 時建立治理文件，但不需要初始化 Git repo。 |
| `src/` 已有 Domain / Application / Infrastructure / WebAPI | Greenfield track 可以假設 Clean Architecture 方向已就位。 |
| `tests/` 已分 Domain / Application / Integration | 後續 feature 可以把 business rules 對到測試層級。 |
| 還沒有 `dflow/specs/` | 這會是第一次 Dflow baseline。 |

這也是 Greenfield track 和 Brownfield track 最直接的差異。Alice 的 repo 還沒有 production
code，也沒有散落在 UI event handler 裡的舊規則；因此她不需要先跑 baseline capture。
她需要的是把未來 AI 協作的 spec backbone 建起來。

## Alice 的第一個 domain 直覺

ExpenseTracker 的核心不是 CRUD，而是一條跨角色流程：

```text
員工建立費用單
→ 員工提交
→ 主管審核
→ 財務核銷 / 付款
```

但 Alice 不會在 setup 階段就決定所有 bounded context。她只先記下幾個可能的方向：

| 概念 | setup 階段的處理 |
|---|---|
| ExpenseReport / ExpenseItem | 很可能屬於第一個 Expense BC，但等 `/dflow:new-feature` 再確認。 |
| Supervisor approval | 是後續 phase 候選，不在第一個 setup 階段拆 BC。 |
| Reimbursement / payment | 明顯是下游流程，不塞進第一個 feature。 |
| Employee identity | 可能由公司 SSO / Identity context 提供，只用 reference ID。 |

這是 DDD 在 Greenfield 的務實落點：**不預先固定所有 boundary，但也不把第一個 feature
寫成沒有語意的 CRUD。**

## 技術與流程假設

Alice 和團隊已經拍板這些 baseline 假設：

| Item | Choice |
|---|---|
| Runtime | .NET 9 / C# 13 |
| Web | ASP.NET Core 9 Web API |
| ORM | EF Core 8 |
| Mediator | MediatR 12 |
| Test | xUnit |
| Database | PostgreSQL 16 |
| Auth | Company SSO via OIDC |
| Hosting | Azure App Service |
| Git style | trunk-based / GitHub Flow |
| Spec prose language | `zh-TW` |

這些不是全部都會在 setup file 裡變成最終文件。真正的 Dflow baseline 會在
[〈Walkthrough 01 — `dflow init` 建立 Greenfield baseline〉](walkthrough-01-init-project.zh-TW.md) 中由
`dflow init` 詢問、確認並寫入 `_overview.md`、`_conventions.md`、
Git principles 與 AI agent guide。

## Before Dflow speaks

如果沒有 Dflow，Alice 可能會直接叫 AI 產生第一批 Controller、Command、Entity、
EF migration。這看起來很快，但風險是：

| 風險 | 後果 |
|---|---|
| 先寫 code，後補 spec | 後續 AI session 只能猜 business rules。 |
| 第一個 feature scope 太大 | 主管審核、財務核銷、員工身份一起被塞進 MVP。 |
| Aggregate 邊界由資料表形狀決定 | ExpenseItem 是 Entity 還是 Value Object 沒有被討論。 |
| 文件散落在 prompt history | 新 teammate 無法從 repo 讀出決策理由。 |

Dflow 的角色是把這些風險移到對話前面：init 建 baseline，第一個 feature 再建立
Expense BC 與第一個 Aggregate。

## 本段沒有產出 Dflow 文件

Walkthrough 00 是 setup context，因此沒有新增 `outputs/` 檔案。讀者可以把它理解成
`dflow init` 前的 repo state。

| 位置 | 狀態 |
|---|---|
| `dflow/specs/` | 尚未存在。 |
| `dflow/specs/domain/Expense/` | 尚未存在；第一個 feature 後才會建立。 |
| `dflow/specs/features/active/` | 尚未存在；init 會建立空工作區。 |
| root AI tool files | 尚未存在；init 會依 Alice 選擇建立 shims。 |

## Dflow feature / benefit mapping

| 這一步建立的理解 | 後續 Dflow benefit |
|---|---|
| Greenfield repo，無 legacy behavior | init 可以建立 baseline，不需要先做 baseline capture。 |
| Clean Architecture 目錄已存在 | `/dflow:new-feature` 可把 Aggregate / tests 對到合理層級。 |
| 第一個業務入口是 expense submission | first feature 自然長出 Expense BC。 |
| `zh-TW` 是團隊需求討論語言 | `_conventions.md` 會記錄 prose language，避免文件語言漂移。 |
| 多 AI tool 團隊 | init 可建立 canonical AI guide 與多 tool shim。 |

## 下一個劇情段

→ [〈Walkthrough 01 — `dflow init` 建立 Greenfield baseline〉](walkthrough-01-init-project.zh-TW.md)：Alice
在 repo root 執行 `dflow init`，建立 ExpenseTracker 的 Dflow baseline。
