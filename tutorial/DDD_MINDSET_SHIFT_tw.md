# 給資深工程師的 DDD 觀念翻轉指南

> 你有多年的 .NET 開發經驗，對設計模式、SOLID 原則、分層架構都很熟。
> DDD 不會推翻這些知識，但有幾個地方會讓你覺得「這跟我平常的做法不一樣」。
>
> 這份指南只講這些「不一樣」的地方。讀完大約 10-15 分鐘。
> 不需要記住所有細節——之後在實作中遇到時，Claude Code 會提醒你。

---

## 觀念一：行為放在 Entity 裡，不是 Service 裡

### 你的直覺

Entity 負責裝資料（一堆 property + getter/setter），邏輯放在 Service 裡操作這些資料。
這種模式叫 **Anemic Domain Model**（貧血模型），在大部分 .NET 專案中很常見：

```csharp
// 你習慣的做法：Entity 只有資料
public class ExpenseReport
{
    public int Id { get; set; }
    public string Status { get; set; }
    public List<LineItem> LineItems { get; set; }
    public decimal TotalAmount { get; set; }
}

// 邏輯在 Service 裡
public class ExpenseReportService
{
    public void Submit(ExpenseReport report)
    {
        if (report.Status != "Draft")
            throw new Exception("只有草稿可以提交");
        if (!report.LineItems.Any())
            throw new Exception("不可提交空報銷單");

        report.Status = "Submitted";
        report.TotalAmount = report.LineItems.Sum(x => x.Amount);
    }
}
```

這種寫法你寫了很多年，也能動。但有個問題：**任何人都可以繞過 Service 直接改 Entity 的狀態**。

```csharp
// 任何地方都能這樣寫，而且編譯器不會攔你
report.Status = "Submitted";  // 繞過所有檢查
report.TotalAmount = -999;    // 完全合法
```

### DDD 的做法

Entity 自己保護自己的狀態。邏輯和資料在一起，外部不能直接改：

```csharp
// DDD 的做法：Entity 有行為，也保護自己的狀態
public class ExpenseReport
{
    public ExpenseReportId Id { get; private set; }          // ← private set
    public ReportStatus Status { get; private set; }         // ← private set
    private readonly List<LineItem> _lineItems = new();      // ← private

    public IReadOnlyList<LineItem> LineItems => _lineItems.AsReadOnly();

    // 總金額是計算出來的，不是存的
    public Money TotalAmount =>
        _lineItems.Aggregate(Money.Zero(Currency.TWD), (sum, item) => sum.Add(item.Amount));

    // 狀態只能透過方法改變
    public void Submit()
    {
        if (Status != ReportStatus.Draft)
            throw new DomainException("只有草稿可以提交");
        if (!_lineItems.Any())
            throw new DomainException("不可提交空報銷單");

        Status = ReportStatus.Submitted;
    }
}
```

現在沒有人能繞過規則了：

```csharp
report.Status = "Submitted";           // ❌ 編譯錯誤：private set
report.Submit();                        // ✅ 唯一的方式，必須通過所有檢查
```

### 為什麼

不是因為 Service 模式「不好」，而是因為**規則離資料越近，越不容易被繞過**。
在一個多人開發的專案中，你沒辦法確保每個人都記得要先呼叫 Service。
但如果 Entity 的 setter 是 private 的，編譯器會幫你擋。

### 判斷原則

如果一段邏輯只需要用到 **Entity 自己的資料** 就能完成，它應該是 Entity 的方法。
如果它需要**跨多個 Aggregate 的資料**或**外部資訊**，那才用 Domain Service。

---

## 觀念二：Aggregate 的邊界不是「相關的放一起」

### 你的直覺

設計資料模型時，你會把相關的東西放在一起。報銷單有審批，
所以 ApprovalTask 是 ExpenseReport 的子物件，載入報銷單時一起載入：

```csharp
// 你習慣的做法：相關的放一起
public class ExpenseReport
{
    public List<LineItem> LineItems { get; set; }
    public ApprovalTask Approval { get; set; }       // ← 審批是報銷單的一部分
    public List<Comment> Comments { get; set; }      // ← 留言也是
    public AuditLog AuditLog { get; set; }           // ← 稽核紀錄也是
}
```

這在 CRUD 系統中運作良好。但當系統變複雜，你會遇到兩個問題：

1. **效能**：每次載入報銷單都要把審批、留言、稽核全載入，越來越慢
2. **並行衝突**：主管在審批、員工在加留言、系統在寫稽核——三個人改同一個物件，互相擋

### DDD 的做法

Aggregate 的邊界由**一致性需求**決定，不是由「相關性」決定：

```
問自己：這兩個東西必須在同一個交易裡保持一致嗎？

ExpenseReport + LineItem
→ 必須。新增 LineItem 時要檢查總額上限，這要在同一個交易裡。
→ ✅ 同一個 Aggregate

ExpenseReport + ApprovalTask
→ 不必。員工修改報銷單和主管審批是獨立操作，不需要同一個交易。
→ ❌ 不同的 Aggregate，透過 ID 引用
```

```csharp
// DDD 的做法：只把「必須一致」的東西放在一起
public class ExpenseReport    // Aggregate 1
{
    private readonly List<LineItem> _lineItems = new();  // ← 必須一起管理
    // 沒有 ApprovalTask、沒有 Comment、沒有 AuditLog
}

public class ApprovalTask     // Aggregate 2（獨立）
{
    public ExpenseReportId ReportId { get; }  // ← 只存 ID，不存物件
}
```

### 為什麼

Aggregate 越大，並行衝突越多、效能越差、越難理解。
Aggregate 越小，越靈活、越容易測試、越容易獨立部署。

經驗法則：**如果你覺得這個 Aggregate 太大了，它通常真的太大了**。

### 那不同 Aggregate 之間怎麼溝通？

用 **Domain Event**。報銷單提交後，發出一個事件，審批任務收到事件後自動建立。
這叫「最終一致性」——不是即時同步，但通常幾毫秒內就完成了。

```
ExpenseReport.Submit()
    → 發出 ExpenseReportSubmittedEvent
    → Event Handler 收到
    → 建立 ApprovalTask
```

延伸到你熟悉的概念：這跟 message queue 的思維是一樣的，
只是規模更小（進程內）、延遲更低（毫秒級）。

---

## 觀念三：Value Object 不只是 DTO

### 你的直覺

你很熟悉 DTO（Data Transfer Object）——一個單純裝資料的物件，
沒有行為，用來在層之間傳遞資料。當你第一次聽到 Value Object 時，
直覺反應可能是「這不就是 DTO 嗎？」

```csharp
// 你習慣的做法：金額就用 decimal
public class LineItem
{
    public decimal Amount { get; set; }
    public string Currency { get; set; }   // "TWD", "JPY"
}

// 到處都要記得一起處理
decimal total = items.Sum(x => x.Amount);  // 如果混了不同幣別呢？
```

### DDD 的做法

Value Object 是**有行為、會自我驗證**的物件。它的定義是「由值決定身份」：
兩個 Money(100, TWD) 是相等的，不管它們是不是同一個 instance。

```csharp
public record Money
{
    public decimal Amount { get; }
    public Currency Currency { get; }

    public Money(decimal amount, Currency currency)
    {
        if (amount <= 0)
            throw new DomainException("金額必須為正數");   // 自我驗證

        Amount = currency.Round(amount);                   // 建構時就四捨五入
        Currency = currency;
    }

    // 有行為：知道怎麼相加
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new CurrencyMismatchException();         // 不讓你加錯
        return new Money(Amount + other.Amount, Currency);
    }

    // 有行為：知道怎麼轉換幣別
    public Money ConvertTo(Currency target, ExchangeRate rate)
    {
        return new Money(rate.Convert(Amount), target);
    }
}
```

### 為什麼

差異不在語法，在於**誰負責保證正確性**：

| | DTO 模式 | Value Object 模式 |
|---|---|---|
| 驗證 | 呼叫端自己記得檢查 | 建構式強制執行，不合法就建不出來 |
| 相加 | 呼叫端自己記得檢查幣別 | Add() 方法自動檢查，不同幣別直接拋錯 |
| 四捨五入 | 到處都要記得呼叫 Round | 建構時就做了，拿到就是合法值 |
| 出錯機率 | 隨專案變大而上升 | 不會，因為規則在物件裡面 |

經驗法則：**如果你發現同一組資料（如 amount + currency）總是一起出現、
一起被驗證、一起被操作，它就應該是一個 Value Object**。

### 常見的 Value Object 候選人

在你的專案中，這些很可能適合做成 Value Object：

- **Money**（金額 + 幣別）
- **DateRange**（開始日 + 結束日，不允許開始晚於結束）
- **EmailAddress**（格式驗證在建構式裡）
- **EmployeeId**（強型別 ID，避免把 int 的員工 ID 傳成部門 ID）

---

## 觀念四：Domain 層不依賴任何外部東西

### 你的直覺

在典型的 .NET 分層架構中，各層之間的依賴關係通常是：

```
Controller → Service → Repository → Database
```

Service 層直接 new 一個 Repository 來存取資料，或者透過 DI 注入具體的實作類別。
這種做法很直觀，但 Domain 層（你的業務邏輯）就被綁死在特定的基礎設施上了。

```csharp
// 你習慣的做法：Domain 層知道 EF Core
public class ExpenseReport
{
    [Table("ExpenseReports")]           // ← 知道資料表名稱
    public int Id { get; set; }

    [Column("total_amount")]            // ← 知道欄位名稱
    public decimal TotalAmount { get; set; }

    [JsonIgnore]                        // ← 知道序列化方式
    public virtual List<LineItem> LineItems { get; set; }
}
```

### DDD 的做法

Domain 層的 .csproj 裡面**零 NuGet 套件**。它不知道 EF Core 的存在，
不知道 JSON 序列化，不知道 HTTP，不知道任何框架：

```csharp
// Domain 層：純 C#，零依賴
public class ExpenseReport : AggregateRoot
{
    public ExpenseReportId Id { get; private set; }    // 沒有 [Table]
    public Money TotalAmount => CalculateTotal();       // 沒有 [Column]
    // 沒有 [JsonIgnore]，因為 Domain 根本不知道 JSON 是什麼
}

// Domain 層只定義介面
public interface IExpenseReportRepository
{
    Task<ExpenseReport?> GetByIdAsync(ExpenseReportId id, CancellationToken ct);
    Task AddAsync(ExpenseReport report, CancellationToken ct);
}
```

EF Core 的設定放在 Infrastructure 層：

```csharp
// Infrastructure 層：這裡才知道 EF Core
public class ExpenseReportConfiguration : IEntityTypeConfiguration<ExpenseReport>
{
    public void Configure(EntityTypeBuilder<ExpenseReport> builder)
    {
        builder.ToTable("ExpenseReports");
        builder.OwnsOne(x => x.Period);            // Value Object 的 EF 設定
        builder.OwnsMany(x => x.LineItems, ...);   // 子 Entity 的 EF 設定
    }
}
```

### 為什麼

這不是潔癖，是實際利益：

1. **可測試性**：Domain 層的單元測試不需要資料庫、不需要 mock HTTP、不需要設定檔。直接 new 就能測。
2. **可遷移性**：哪天想從 EF Core 換成 Dapper，只改 Infrastructure 層，Domain 完全不動。
3. **可理解性**：打開 Domain 層的程式碼，你看到的全部都是業務規則，沒有技術噪音。

### 一個常見的疑問

> 「那 Domain 層怎麼存取資料？」

Domain 層只定義 **interface**（「我需要有人幫我查資料」），
Infrastructure 層提供 **implementation**（「我用 EF Core 幫你查」）。
Application 層負責把它們接起來（透過 DI）。

這就是 **Dependency Inversion**——你以前在 SOLID 裡學過，DDD 只是把它貫徹到底。

---

## 觀念五：async 不屬於 Domain 層

### 你的直覺

在 .NET 裡，`async/await` 幾乎是預設寫法。你可能會自然地把 Domain 方法也寫成 async：

```csharp
// 你的直覺
public async Task Submit()
{
    Status = ReportStatus.Submitted;
}
```

### DDD 的做法

Domain 層的方法是**同步的**。不需要 `async`，不需要 `Task`：

```csharp
// DDD 的做法
public void Submit()
{
    if (Status != ReportStatus.Draft)
        throw new DomainException("只有草稿可以提交");

    Status = ReportStatus.Submitted;
    AddDomainEvent(new ExpenseReportSubmittedEvent(Id));
}
```

### 為什麼

`async` 的存在是因為 I/O 操作（讀資料庫、呼叫 API、存檔案）。
但 Domain 層做的事情是：**檢查規則、改變狀態、發出事件**——全部都是記憶體內的操作，不涉及 I/O。

如果你的 Domain 方法需要 async，通常代表它在做不該由 Domain 做的事
（例如在 Entity 裡面呼叫 Repository），這時候應該把 I/O 操作移到 Application 層。

```csharp
// ❌ Domain 層不該做 I/O
public async Task Submit(INotificationService notifier)
{
    Status = ReportStatus.Submitted;
    await notifier.NotifyManager(this);    // 這不是 Domain 的事
}

// ✅ Domain 只改狀態和發事件，Application 層處理 I/O
// Domain 層
public void Submit()
{
    Status = ReportStatus.Submitted;
    AddDomainEvent(new ExpenseReportSubmittedEvent(Id));
}

// Application 層
public async Task Handle(SubmitCommand cmd, CancellationToken ct)
{
    var report = await _repo.GetByIdAsync(cmd.ReportId, ct);   // I/O 在這裡
    report.Submit();                                             // Domain 是同步的
    await _unitOfWork.SaveChangesAsync(ct);                     // I/O 在這裡
    // Event Handler 會處理通知                                  // I/O 也在外層
}
```

### 速記

Domain 層的方法簽名看起來永遠是這樣的：

```csharp
public void DoSomething(...)           // 改變狀態
public Money Calculate(...)            // 回傳結果
public bool CanDoSomething(...)        // 檢查條件
```

不會是：

```csharp
public async Task DoSomething(...)     // ❌ 不需要 async
public async Task<Money> Calculate(...)// ❌ 不需要 async
```

---

## 閱讀建議

這五個觀念不需要一次全部內化。建議的學習路徑：

1. **現在**：讀完這份指南，知道有這些觀念翻轉就好
2. **開始使用 Skill**：讀對應版本的使用教學（WebForms 版或 Core 版），在情境中看到這些觀念的實際應用
3. **實作時**：遇到違反直覺的地方，回來翻這份指南找對應的段落
4. **做完第一個功能後**：這些觀念會自然變成你的新直覺

Claude Code 在引導你的過程中，會在適當的時機提醒你這些原則。
你不需要「先學完 DDD 才能開始」——邊做邊學是最有效的方式。

---

## 對照表：這份指南 ↔ 使用教學中的情境

| 觀念 | WebForms 教學情境 | Core 教學情境 |
|---|---|---|
| 行為放 Entity 裡 | 情境一：Money.Round() 取代分散的計算 | 情境二：ExpenseReport.Submit() |
| Aggregate 邊界 | — | 情境三：ApprovalTask 拆分決策 |
| Value Object 不只是 DTO | 情境一：Money Value Object | 情境一：Money 建構式驗證 |
| Domain 零依賴 | 情境三：PR Review 檢查 System.Web | 情境四：PR Review 檢查 async |
| async 不在 Domain | — | 情境四：PR Review 發現 async |
