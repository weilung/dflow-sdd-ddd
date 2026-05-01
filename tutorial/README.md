# Dflow Tutorial

這裡是 Dflow 的人讀教學劇本。目標不是列 API reference，而是讓同事在還沒把 Dflow 用到真實專案前，就能完整 read-through 兩條端到端情境、看到對話、規格文件與 outputs 長什麼樣。

目前維護中的 tutorial 只有兩條分段劇情：

| 劇情 | 適用對象 | 技術情境 | 建議讀法 |
|---|---|---|---|
| [01-greenfield-core](01-greenfield-core/00-setup.md) | 新專案團隊、想練 Clean Architecture + DDD 的團隊 | ASP.NET Core greenfield | 從 `00-setup.md` 順讀到 `06-finish-feature.md` |
| [02-brownfield-webforms](02-brownfield-webforms/00-setup.md) | 維護既有 WebForms 系統、準備漸進抽 Domain logic 的團隊 | ASP.NET WebForms brownfield | 從 `00-setup.md` 順讀到 `06-finish-feature.md` |

已退場的早期單檔 tutorial 已刪除。不要再使用 P001 前或 P001 hybrid 版本作為目前流程依據。

## 閱讀路線圖

```mermaid
flowchart LR
  A[Start] --> B[01 Greenfield Core]
  A --> C[02 Brownfield WebForms]

  B --> B0[00 setup]
  B0 --> B1[npx dflow-sdd-ddd init]
  B1 --> B2[/dflow:new-feature]
  B2 --> B3[/dflow:new-phase]
  B3 --> B4[/dflow:modify-existing]
  B4 --> B5[/dflow:bug-fix]
  B5 --> B6[/dflow:finish-feature]

  C --> C0[00 setup]
  C0 --> C1[npx dflow-sdd-ddd init]
  C1 --> C2[/dflow:modify-existing]
  C2 --> C3[baseline capture]
  C3 --> C4[/dflow:new-feature]
  C4 --> C5[/dflow:bug-fix]
  C5 --> C6[/dflow:finish-feature]
```

## 劇情 1：Greenfield Core

Alice 從零建立 ExpenseTracker。這條線展示 Core edition 如何從 `npx dflow-sdd-ddd init` 進到第一個 feature、phase 2、輕量修改、bug fix，最後把 feature 收到 completed。

| 段落 | 重點 |
|---|---|
| [00-setup.md](01-greenfield-core/00-setup.md) | 角色、假想專案、技術棧與 before-Dflow 結構 |
| [01-init-project.md](01-greenfield-core/01-init-project.md) | CLI init 建立 Core baseline |
| [02-new-feature.md](01-greenfield-core/02-new-feature.md) | 第一個 `Expense` BC、Aggregate、phase 1 spec |
| [03-new-phase.md](01-greenfield-core/03-new-phase.md) | 在同一 feature 內新增 supervisor approval phase |
| [04-modify-existing.md](01-greenfield-core/04-modify-existing.md) | 小型規則調整與 lightweight change |
| [05-bug-fix.md](01-greenfield-core/05-bug-fix.md) | 已有規則下的 bug fix |
| [06-finish-feature.md](01-greenfield-core/06-finish-feature.md) | finish-feature、sync domain docs、archive feature |

Greenfield outputs 位於 [01-greenfield-core/outputs](01-greenfield-core/outputs/)。

## 劇情 2：Brownfield WebForms

Bob 維護既有 OrderManager。這條線展示 WebForms edition 如何避免一開始就重構，而是從具體修改需求進入、捕捉 baseline、逐步抽出 Order domain logic。

| 段落 | 重點 |
|---|---|
| [00-setup.md](02-brownfield-webforms/00-setup.md) | 角色、既有系統、痛點與 before-Dflow 結構 |
| [01-init-project.md](02-brownfield-webforms/01-init-project.md) | CLI init 建立 brownfield baseline |
| [02-modify-existing.md](02-brownfield-webforms/02-modify-existing.md) | 第一次從 `OrderEntry.aspx.cs` 抽折扣邏輯 |
| [03-baseline-capture.md](02-brownfield-webforms/03-baseline-capture.md) | 跨頁面 rounding baseline capture |
| [04-new-feature.md](02-brownfield-webforms/04-new-feature.md) | 已有 Order BC 後新增 VIP discount feature |
| [05-bug-fix.md](02-brownfield-webforms/05-bug-fix.md) | production bug fix 與 BR snapshot 邊界 |
| [06-finish-feature.md](02-brownfield-webforms/06-finish-feature.md) | 完成 SPEC-001，同時保留仍 active 的 SPEC-002 |

Brownfield outputs 位於 [02-brownfield-webforms/outputs](02-brownfield-webforms/outputs/)。

## 使用方式

閱讀 tutorial 時，建議同時打開對應 `outputs/` 目錄。每個劇情段的「本段產出的檔案」會連到實際 outputs，方便 reviewer 檢查對話是否真的收斂到可維護的 Dflow specs。

`01-init-project.md` 兩段是教學化轉寫，不是 `dflow-sdd-ddd@0.1.0` 的逐字 terminal transcript；實際 CLI prompt 較精簡，但決策點與產出物相同。
