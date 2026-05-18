# 為什麼 AI 時代 DDD 更重要

> **繁體中文** | [English](why-ddd-for-ai.en.md)

AI 輔助開發改變了軟體設計的失敗模式。團隊能更快產出更多程式碼，但不清晰的領域語義也會以同樣的速度擴散。

當專案缺乏共同語言與明確邊界時，細小的不一致便會蔓延：

- 同一個概念以 `Order`、`Booking`、`Transaction` 三種名稱出現
- API 對相似動作賦予不同語義
- 業務規則分散在 handler、UI 程式碼、腳本與測試之中
- 沒有人能確定哪一個行為才是權威的

AI 程式碼代理預設不了解業務領域。當 prompt 資訊不完整時，它會以看似合理的邏輯填補缺漏。這些邏輯可能通過編譯、通過表面測試，卻依然是錯的。AI 最危險的錯誤往往不是語法錯誤，而是外觀合理的領域錯誤。

DDD 為規格提供語義骨幹：

| DDD 概念 | AI 時代的價值 |
|---|---|
| **Ubiquitous Language（通用語言）** | 讓名稱與語義在 prompt、規格、程式碼與 review 之間保持穩定。 |
| **Bounded Context** | 定義術語或規則的有效範圍，防止語義意外洩漏。 |
| **領域模型（Domain Model）** | 讓行為有明確的所有者，而不是將規則分散在技術層之間。 |
| **領域規則（Domain Rules）** | 在程式碼生成之前，先明確指出什麼是正確的、允許的、禁止的，以及例外情況。 |

關鍵的轉變在於設計的位置。舊有的工作流程中，大量真正的設計可以隱含在程式碼裡。引入 AI 之後，這樣做已經太遲。模型需要在生成程式碼之前就取得約束條件。

```text
Without DDD:
Prompt -> AI fills gaps -> Code -> Hidden domain drift

With DDD:
Domain meaning -> Structured spec -> AI implementation -> Reviewable code
```

程式碼仍然重要，但不再是發現語義的第一現場。在 AI 協作模式下，規格成為生成前的契約，DDD 提供語言、邊界與規則，使契約具備精確性。

Dflow 正是圍繞這個理念建構：規格優先、領域語義顯式化、在實作前約束 AI，並在工作完成前驗證漂移（drift）。
