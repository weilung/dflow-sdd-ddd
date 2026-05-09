# Dflow Tutorial

These tutorials are read-through walkthroughs, not required setup after
running `npx dflow-sdd-ddd init`. You can read them without installing
anything; the goal is to see what a Dflow-driven feature flow looks like
end to end before trying it on a real project. The detailed scenario
dialogue is written in Traditional Chinese, while this English entry
gives non-Chinese readers a navigable path through the steps and
outputs.

For the evaluator decision aid — track choice, safe trial, language
compatibility, and what `init` creates — see
[`docs/evaluating-dflow.md`](../docs/evaluating-dflow.md). For the
tool-specific surface, use the per-tool guides:
[Using Dflow with Claude Code](../docs/using-with-claude-code.md) and
[Using Dflow with Codex CLI](../docs/using-with-codex.md).

## Two Scenarios

**Greenfield: Alice / ExpenseTracker.** Alice is starting a new ASP.NET
Core system and wants Dflow to shape Clean Architecture and DDD tactical
patterns from the first feature. This track fits readers who want to
inspect how a new bounded context, aggregate, value objects, and feature
lifecycle emerge from a clean project.

**Brownfield: Bob / OrderManager.** Bob maintains a legacy ASP.NET
WebForms system where business rules already live in code-behind,
repositories, and stored procedures. This track fits readers who want
to inspect how Dflow supports incremental domain extraction without
treating modernization as an upfront rewrite.

## Workflow Map

```mermaid
flowchart LR
  A[Start] --> B[01 Greenfield]
  A --> C[02 Brownfield]

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

## Greenfield: Alice / ExpenseTracker

### Reading Order

[`00-setup.md`](01-greenfield/00-setup.md) introduces Alice, the
ExpenseTracker project, the .NET 9 technical shape, and the before-Dflow
repository structure. It establishes why the first useful slice is
employee expense submission and where the worked outputs can be
inspected later.

[`01-init-project.md`](01-greenfield/01-init-project.md) shows Alice
creating the Greenfield Dflow baseline for ExpenseTracker. The result
is the initial `dflow/specs/` workspace and AI collaboration guide that
future feature work will build on.

[`02-new-feature.md`](01-greenfield/02-new-feature.md) starts the first
feature: employees submit expense reports. The step produces the first
Expense bounded context shape, the core aggregate and supporting model
decisions, and the phase 1 feature spec for submission.

[`03-new-phase.md`](01-greenfield/03-new-phase.md) adds supervisor
approval as the next phase of the same feature. The feature stays
continuous while new approval behavior, rules, and implementation
scope are recorded as an additional phase.

[`04-modify-existing.md`](01-greenfield/04-modify-existing.md) handles
a small rule change around reject reason length. The point of the step
is to show a lightweight adjustment that updates the relevant spec and
rule context without reopening the whole feature design.

[`05-bug-fix.md`](01-greenfield/05-bug-fix.md) follows a bug where
emoji input is truncated under an existing rule. The step records the
expected behavior, the defect boundary, and the regression check needed
to protect the agreed rule.

[`06-finish-feature.md`](01-greenfield/06-finish-feature.md) closes the
first feature. The completed work is synchronized into durable domain
documents, the feature snapshot is finalized, and the feature moves
into the completed outputs.

### Curated Outputs Tour

Use the Greenfield outputs tour at
[`01-greenfield/outputs-tour.md`](01-greenfield/outputs-tour.md) as the
short path through the most important files in the full
[`01-greenfield/outputs/`](01-greenfield/outputs/) tree. The tour
points to the key project, domain, feature, phase, and finish-feature
artifacts without requiring readers to inspect every generated file
first.

## Brownfield: Bob / OrderManager

### Reading Order

[`00-setup.md`](02-brownfield/00-setup.md) introduces Bob, the
OrderManager WebForms system, the production constraints, and the
before-Dflow structure. It explains why the scenario begins from
existing behavior and migration risk rather than from a clean
architecture model.

[`01-init-project.md`](02-brownfield/01-init-project.md) shows Bob
creating the Brownfield Dflow baseline for OrderManager. The result is
an initial spec workspace with project context, conventions, glossary,
tech debt, and AI collaboration guidance, but no premature domain
subdirectory.

[`02-modify-existing.md`](02-brownfield/02-modify-existing.md) starts
from a specific change in `OrderEntry.aspx.cs`: extracting discount
logic from code-behind. The step captures current behavior, narrows
the modification scope, and begins turning confirmed Order rules into
maintainable domain knowledge.

[`03-baseline-capture.md`](02-brownfield/03-baseline-capture.md)
records rounding behavior that crosses more than one page or code
path. The output is a baseline artifact that lets later changes
compare against observed production behavior before refactoring or
moving logic.

[`04-new-feature.md`](02-brownfield/04-new-feature.md) adds a VIP
discount feature after the Order context has enough shape to support
it. The scenario shows new feature work building on extracted
brownfield knowledge rather than bypassing it.

[`05-bug-fix.md`](02-brownfield/05-bug-fix.md) follows a production
bug fix with an explicit expected-versus-actual boundary. The step
keeps the fix narrow, preserves the relevant business-rule snapshot,
and records the regression check.

[`06-finish-feature.md`](02-brownfield/06-finish-feature.md) completes
the first Order modification feature while leaving later VIP discount
work active. The result is an archived completed feature plus an
explicit record of what remains in progress.

### Curated Outputs Tour

Use the Brownfield outputs tour at
[`02-brownfield/outputs-tour.md`](02-brownfield/outputs-tour.md) as
the short path through the most important files in the full
[`02-brownfield/outputs/`](02-brownfield/outputs/) tree. The tour
points to the baseline, tech debt, domain extraction, feature, and
finish-feature artifacts that matter most when evaluating brownfield
adoption.

## Where To Next

Start with [`01-greenfield/00-setup.md`](01-greenfield/00-setup.md) to
follow Alice through a new ExpenseTracker feature from baseline to
completed specs. Start with
[`02-brownfield/00-setup.md`](02-brownfield/00-setup.md) to follow Bob
through incremental domain extraction in an existing OrderManager
system.

## 中文導讀

這裡是 Dflow 的人讀教學劇本。目標不是列 API reference，而是讓同事在還沒把 Dflow 用到真實專案前，就能完整 read-through 兩條端到端情境、看到對話、規格文件與 outputs 長什麼樣。

目前維護中的 tutorial 只有兩條分段劇情：

| 劇情 | 適用對象 | 技術情境 | 建議讀法 |
|---|---|---|---|
| [01-greenfield](01-greenfield/00-setup.md) | 新專案團隊、想練 Clean Architecture + DDD 的團隊 | ASP.NET Core greenfield | 從 `00-setup.md` 順讀到 `06-finish-feature.md` |
| [02-brownfield](02-brownfield/00-setup.md) | 維護既有 WebForms 系統、準備漸進抽 Domain logic 的團隊 | ASP.NET WebForms brownfield | 從 `00-setup.md` 順讀到 `06-finish-feature.md` |

已退場的早期單檔 tutorial 已刪除。不要再使用 P001 前或 P001 hybrid 版本作為目前流程依據。

### 劇情 1：Greenfield

Alice 從零建立 ExpenseTracker。這條線展示 Greenfield track 如何從 `npx dflow-sdd-ddd init` 進到第一個 feature、phase 2、輕量修改、bug fix，最後把 feature 收到 completed。

| 段落 | 重點 |
|---|---|
| [00-setup.md](01-greenfield/00-setup.md) | 角色、假想專案、技術棧與 before-Dflow 結構 |
| [01-init-project.md](01-greenfield/01-init-project.md) | CLI init 建立 greenfield baseline |
| [02-new-feature.md](01-greenfield/02-new-feature.md) | 第一個 `Expense` BC、Aggregate、phase 1 spec |
| [03-new-phase.md](01-greenfield/03-new-phase.md) | 在同一 feature 內新增 supervisor approval phase |
| [04-modify-existing.md](01-greenfield/04-modify-existing.md) | 小型規則調整與 lightweight change |
| [05-bug-fix.md](01-greenfield/05-bug-fix.md) | 已有規則下的 bug fix |
| [06-finish-feature.md](01-greenfield/06-finish-feature.md) | finish-feature、sync domain docs、archive feature |

Greenfield outputs 位於 [`01-greenfield/outputs/`](01-greenfield/outputs/)。

### 劇情 2：Brownfield

Bob 維護既有 OrderManager。這條線展示 Brownfield track 如何避免一開始就重構，而是從具體修改需求進入、捕捉 baseline、逐步抽出 Order domain logic。

| 段落 | 重點 |
|---|---|
| [00-setup.md](02-brownfield/00-setup.md) | 角色、既有系統、痛點與 before-Dflow 結構 |
| [01-init-project.md](02-brownfield/01-init-project.md) | CLI init 建立 brownfield baseline |
| [02-modify-existing.md](02-brownfield/02-modify-existing.md) | 第一次從 `OrderEntry.aspx.cs` 抽折扣邏輯 |
| [03-baseline-capture.md](02-brownfield/03-baseline-capture.md) | 跨頁面 rounding baseline capture |
| [04-new-feature.md](02-brownfield/04-new-feature.md) | 已有 Order BC 後新增 VIP discount feature |
| [05-bug-fix.md](02-brownfield/05-bug-fix.md) | production bug fix 與 BR snapshot 邊界 |
| [06-finish-feature.md](02-brownfield/06-finish-feature.md) | 完成 SPEC-001，同時保留仍 active 的 SPEC-002 |

Brownfield outputs 位於 [`02-brownfield/outputs/`](02-brownfield/outputs/)。

### 使用方式

閱讀 tutorial 時，建議同時打開對應 `outputs/` 目錄。每個劇情段的「本段產出的檔案」會連到實際 outputs，方便 reviewer 檢查對話是否真的收斂到可維護的 Dflow specs。

`01-init-project.md` 兩段是教學化轉寫，不是 `dflow-sdd-ddd@0.1.0` 的逐字 terminal transcript；實際 CLI prompt 較精簡，但決策點與產出物相同。
