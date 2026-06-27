# 為什麼用 Dflow（即使 AI 已經會 DDD）

> **繁體中文** | [English](why-dflow.en.md)

如果你的直覺是「現在的 AI 已經會 DDD，叫它『用 DDD 建一個 feature』，aggregate、value object、event 都出得來，再加一層 spec-first 工具是不是過度工程？」——這份文件是寫給你的。它不打算說服你，而是把 Dflow 的價值、證據與限制攤平，讓你自己判斷。

## Dflow 是什麼

Dflow 不是教 AI 什麼是 DDD——它是一層 scaffold（鷹架）：強迫 AI 把每個設計決策的取捨完整留檔，並補上「AI 自己補細節時容易漏、而 review 又難一眼看出」的盲區。

把「AI 會 DDD」拆成兩件事，就懂為什麼還需要它：

1. **AI 能不能說出對的 DDD 答案？** 能。模型讀過教科書，aggregate 邊界、不變式、ubiquitous language 都答得出來。
2. **AI 在你 review 時會不會留下夠完整的紀錄（它考慮過哪些、為何這樣選、哪裡還沒確定）讓你 audit、會不會主動 catch 它自己容易漏的陷阱？** 不一定，要看你怎麼問。

所以真正該比的不是「AI 工具 vs process」，而是：

- **AI alone** 的產出 = AI 知識 × 隱含的 prompt 結構 × 你 review 它的能力
- **AI + Dflow** 的產出 = AI 知識 × **明確的 elicitation scaffold** × **可審查的決策紀錄（取捨、否決的方案、open questions）** × 你 review 它的能力

差異不是「更聰明的 AI」，是「**更可審查的 AI**」。

## Dflow 的 DDD 引導是「長出來的」，不是抄教科書

Dflow 的價值有一部分在於：它的引導是從真實盲區回灌的，而且補上之後，模型真的會在後續主動沿用。一個具體、可檢查的例子——

**盲區**：模型自己建模時，把「一個充電槍同時只能有一筆進行中 session」這條唯一性規則，只用 aggregate 內 `if Status == InUse throw` 的 in-memory check 保護。DDD 教科書角度這是對的，但並發下兩個請求各自讀到 `Available`、各自通過檢查、各自 save → 不變式被破壞（modeling-correct、production-broken）。

**回灌**：把這個盲區寫成一段引導，補進 Dflow 的 `ddd-modeling-guide.md`——「Set-Based / Uniqueness Invariants」：這類「同 X 只能有一筆 active」的規則，無論怎麼切 aggregate，in-memory check 在並發下永遠不夠，要加 DB unique / partial index 或 concurrency token，並把衝突 translate 成 HTTP 409。

**沿用**：換一個 domain（冷鏈感測器「一個 sensor 同時最多掛在一個 carton」，結構平行）、且讓模型不知道自己在被測，它就**主動引用那段**、補上完整三層保護（in-memory guard + concurrency token + DB partial unique index + 409）。

這證明的是一件具體的事：**Dflow 把「AI 自己會漏的盲區」固化成可重用、會被遵循的引導。** 這不是「跑幾次就證明 AI+process 全面勝出」那種大結論（樣本很小）；它是 Dflow 引導迴路有效的證據——**盲區 → 補引導 → 模型沿用**。你也能自己複現（見文末）。

> 補充誠實度：兩次 run 之間 domain 與 framing 也不同，但都不利於「不是引導的功勞」這個反方——兩個 domain 在模型的 pre-training 裡都不是高頻並發設計題材；framing 在第二次更純（不知被測），若它是主因，結果該更差而非更好。把這兩條的可能性壓低後，最能解釋這個翻轉的就剩那段引導在不在。

## 其他幾個「Dflow 強制留檔、AI 自己容易漏」

同一輪觀察裡還看到（每點都是「Dflow 做了什麼 → 沒它會怎樣」）：

- **強迫寫否決理由**：aggregate 設計模板一句 prompt，誘出「選這個邊界 + 理由 + 考慮過哪些替代 + 為何否決」的完整決策段；AI 自己通常只給你一個方案，review 時你無法 audit「它想過 X 嗎」。
- **Step gate 把決策變成 reviewable moment**：模型在命名、模型 spike 等節點自然停下等確認；AI 自己一路寫到 code、tests 都好了你才有機會 review，這時 aggregate 邊界已經沒有商量空間。
- **Open Question 留檔給 domain expert**：模型把不確定的點列成 OQ 等人答，而不是「不確定就猜一個合理的」把假設藏進 code。
- **Ubiquitous language 不漂移**：術語表 + code mapping 讓 spec / model / code 用同一組名詞；AI 自己一段話內就能混用 Sensor / Device / Tracker。
- **規則可被查詢**：每條 business rule 有 ID、status、所屬 aggregate、behavior 連結；AI 自己把規則散在 prose 裡，「BR-003 影響哪些測試」只能用 grep 推敲。

## 誠實的取捨

不掩蓋限制，反而是這套論點的可信來源：

- **scope**：目前觀察只跑在單一模型 × 幾個中等複雜度 domain × lightweight modeling scope（到領域建模、不含 implementation phase）。implementation 階段的引導是否同樣有效、換不同模型會不會一樣，**未驗**。
- **先驗**：被測模型本來就對 DDD 有 pre-training 先驗。Dflow 證明的是「能讓『會、但不一定每次仔細想』變成『仔細想』」，**不是**「能讓完全不懂 DDD 的 AI 變會」。
- **採用即承諾遵循**：Dflow 是 spec-first 工具，只在被遵循時有效；AI 或人故意走偏的情境不在宣稱範圍內。這是工具屬性，不是 bug。

對需要 audit 的場景——醫療、金融、合規、安全敏感、或任何「上線出包代價高 / 個人責任重」的領域——這個 reviewability 差異是 deal-breaker。成本要分兩塊看：**產出** DDD 文件已經不是徒手做 DDD 的高人力年代——AI 幫你生規格、決策紀錄與領域模型，邊際成本主要是多花一些 token 與走一遍流程；而且光是「生成時被領域模型約束」就已讓產出更穩（如上面那個並發盲區），這層就算你沒深讀紀錄也拿得到。Dflow 的 DDD 也刻意務實裁剪（不是學院派全套）、適合一般公司的中型系統，採用門檻不高（不需要團隊先是 DDD 專家）。但要再兌現「可審查」這份價值，得有人實際去 review 那份紀錄——那才是人力與紀律的關鍵成本。所以取捨仍在、值得討論：高風險、需 audit、要長期維護時，這筆投資明顯划算；你不會去 review、失敗成本低、迭代又快時，AI alone 仍可能是更實際的選擇，不是 Dflow 一定贏。

## 自己驗證

不用相信任何說法，自己跑一次（約 10–30 分鐘）：

```bash
npm install -g dflow-sdd-ddd
mkdir dflow-test && cd dflow-test
git init && git commit --allow-empty -m "init"
dflow init           # 選 greenfield + 你的 AI 工具 + 你的 stack
```

接著在你的 AI coding agent 裡跑 `/dflow:new-feature`，指派一個含「跨實例唯一」型不變式的 feature，例如「同帳號同時最多一個 active session」。看模型走到領域建模時，會不會寫到「Set-Based / Uniqueness Invariants」段（Dflow 的 `ddd-modeling-guide.md`）、cite 它、並補上 DB unique / partial index + concurrency token + 409。注意：裝最新版能驗證的是「引導在場時模型確實會用它」這一半；「引導不在場時模型會漏」那一半是上面那段在加入引導之前建立的，不是你在最新版上能切換的——最新版一律含這段。

---

Dflow 不宣稱讓 AI 更聰明，它讓 AI 更可審查：規格優先、領域語義顯式化、把決策與否決理由留檔、在實作前約束、完成前驗證漂移（drift）。為什麼領域語義本身在 AI 時代更關鍵，見 [為什麼 AI 時代 DDD 更重要](why-ddd-for-ai.md)。
