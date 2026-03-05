---
name: dotnet-patterns
description: Idiomatic C# and VB.NET patterns, best practices, and conventions for .NET Framework 4.8 and modern .NET (5/6/7/8+). Covers async/await, LINQ, EF Core, DI, records, and enterprise patterns.
origin: ECC
---

# .NET Development Patterns

Idiomatic C# and VB.NET patterns and best practices for building robust, efficient, and maintainable applications on .NET Framework 4.8 and modern .NET (5/6/7/8+).

## When to Activate

- Writing new C# or VB.NET code
- Reviewing .NET code
- Refactoring existing .NET code
- Designing class libraries or APIs
- Migrating from .NET Framework 4.8 to modern .NET

## Core Principles

### 1. Nullable Reference Types (C# 8+)

Enable nullable reference types project-wide to catch null dereferences at compile time.

```xml
<!-- In .csproj -->
<PropertyGroup>
  <Nullable>enable</Nullable>
  <WarningsAsErrors>nullable</WarningsAsErrors>
</PropertyGroup>
```

```csharp
// With #nullable enable, the compiler tracks nullability
public class UserService
{
    // Non-nullable: compiler ensures this is never null
    private readonly IUserRepository _repository;

    // Nullable: must be checked before use
    private string? _cachedToken;

    public UserService(IUserRepository repository)
    {
        _repository = repository; // OK: non-nullable assigned in constructor
    }

    public async Task<User?> FindUserAsync(Guid id, CancellationToken ct = default)
    {
        // Returns User? — callers must handle null
        return await _repository.FindByIdAsync(id, ct);
    }

    public async Task<User> RequireUserAsync(Guid id, CancellationToken ct = default)
    {
        var user = await _repository.FindByIdAsync(id, ct);
        // Null-forgiving operator — use only when you are certain it is non-null
        return user ?? throw new InvalidOperationException($"User {id} not found");
    }
}
```

```csharp
// Null-conditional and null-coalescing operators
string? name = user?.Profile?.DisplayName;
string displayName = name ?? "Anonymous";
int length = name?.Length ?? 0;

// Null-conditional with method calls
user?.SendNotification("Welcome");

// Pattern matching for null
if (user is not null)
{
    Console.WriteLine(user.Name);
}

// Null check with guard clause (C# 10+)
ArgumentNullException.ThrowIfNull(user);
```

### 2. Async/Await Best Practices

Async/await is the foundation of modern .NET I/O. Follow these patterns rigorously.

```csharp
// Good: All the way async — propagate async up the call stack
public async Task<Order> PlaceOrderAsync(
    OrderRequest request,
    CancellationToken cancellationToken = default)
{
    // Pass CancellationToken to every awaitable
    var user = await _userService.GetUserAsync(request.UserId, cancellationToken);
    var order = Order.Create(user, request.Items);
    await _orderRepository.SaveAsync(order, cancellationToken);
    await _eventBus.PublishAsync(new OrderPlaced(order.Id), cancellationToken);
    return order;
}

// Bad: Blocking on async — causes deadlocks in ASP.NET or WPF
public Order PlaceOrder(OrderRequest request)
{
    var user = _userService.GetUserAsync(request.UserId).Result; // DEADLOCK RISK
    var order = _orderRepository.SaveAsync(order).GetAwaiter().GetResult(); // DEADLOCK RISK
    return order;
}

// Good: async Task, never async void (except event handlers)
public async Task ProcessAsync() { /* ... */ }

// Acceptable: async void ONLY for event handlers
private async void OnButtonClick(object sender, EventArgs e)
{
    try
    {
        await ProcessAsync();
    }
    catch (Exception ex)
    {
        // Must catch here — exceptions in async void cannot be observed
        _logger.LogError(ex, "Button click handler failed");
    }
}

// Good: ConfigureAwait(false) in library code to avoid context capture
// (Not needed in ASP.NET Core applications — no SynchronizationContext)
public async Task<string> ReadFileAsync(string path, CancellationToken ct = default)
{
    using var stream = File.OpenRead(path);
    using var reader = new StreamReader(stream);
    return await reader.ReadToEndAsync(ct).ConfigureAwait(false); // Library code
}

// Good: Parallel async with Task.WhenAll
public async Task<(User user, IReadOnlyList<Order> orders)> GetDashboardDataAsync(
    Guid userId,
    CancellationToken ct = default)
{
    // Run both requests in parallel
    var userTask = _userService.GetUserAsync(userId, ct);
    var ordersTask = _orderService.GetOrdersByUserAsync(userId, ct);

    await Task.WhenAll(userTask, ordersTask);
    return (await userTask, await ordersTask);
}

// Good: Fire-and-forget with explicit handling
_ = Task.Run(async () =>
{
    try
    {
        await SendAnalyticsEventAsync(eventData);
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Analytics event failed — non-critical");
    }
});
```

### 3. Records and Immutable Types (C# 9+)

Use records for immutable data transfer objects and value objects.

```csharp
// C# 9+ record (immutable reference type with value semantics)
public record User(Guid Id, string Name, string Email);

// Usage
var user = new User(Guid.NewGuid(), "Alice", "alice@example.com");
var updated = user with { Name = "Alice Smith" }; // Non-destructive mutation

// Record struct (C# 10+) — value type, stack-allocated for small types
public readonly record struct Money(decimal Amount, string Currency)
{
    // Validation in compact constructor
    public Money
    {
        if (Amount < 0) throw new ArgumentOutOfRangeException(nameof(Amount));
        if (string.IsNullOrWhiteSpace(Currency))
            throw new ArgumentException("Currency required", nameof(Currency));
    }

    public static Money Zero(string currency) => new(0m, currency);
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot add different currencies");
        return this with { Amount = Amount + other.Amount };
    }
}

// Init-only setters for mutable classes with immutable construction
public class OrderConfig
{
    public string ApiUrl { get; init; } = string.Empty;
    public int TimeoutSeconds { get; init; } = 30;
    public bool EnableRetries { get; init; } = true;
}

// Usage
var config = new OrderConfig
{
    ApiUrl = "https://api.example.com",
    TimeoutSeconds = 60
};
// config.ApiUrl = "other"; // Compile error — init-only
```

### 4. LINQ Patterns and EF Core Query Optimization

Write efficient LINQ that translates well to SQL and avoids common pitfalls.

```csharp
// Good: Deferred execution — query not run until enumerated
IQueryable<User> activeUsers = _db.Users
    .Where(u => u.IsActive)
    .OrderBy(u => u.Name);

// Apply additional filters before materializing
if (!string.IsNullOrEmpty(searchTerm))
{
    activeUsers = activeUsers.Where(u => u.Name.Contains(searchTerm));
}

// Materialize only when needed
var page = await activeUsers
    .Skip((pageNumber - 1) * pageSize)
    .Take(pageSize)
    .AsNoTracking()         // Read-only: skip change tracking
    .ToListAsync(ct);       // Single DB round trip

// Good: Eager loading related entities (avoid N+1)
var orders = await _db.Orders
    .Include(o => o.Items)
        .ThenInclude(i => i.Product)
    .Include(o => o.Customer)
    .Where(o => o.Status == OrderStatus.Pending)
    .AsNoTracking()
    .ToListAsync(ct);

// Bad: N+1 — one query per order
foreach (var order in orders)
{
    var items = await _db.OrderItems.Where(i => i.OrderId == order.Id).ToListAsync(); // N queries!
}

// Good: Projection — select only needed columns
var summaries = await _db.Orders
    .Where(o => o.CustomerId == customerId)
    .Select(o => new OrderSummary(o.Id, o.CreatedAt, o.Total))
    .AsNoTracking()
    .ToListAsync(ct);

// Good: Use HashSet for O(1) lookup in LINQ
var allowedRoles = new HashSet<string> { "Admin", "Manager" };
var authorized = users.Where(u => allowedRoles.Contains(u.Role)).ToList();

// Bad: O(n) lookup per user
var badRoles = new List<string> { "Admin", "Manager" };
var slow = users.Where(u => badRoles.Contains(u.Role)).ToList(); // O(n*m)

// Good: Batch operations instead of LINQ in loops
var userIds = orders.Select(o => o.UserId).Distinct().ToList();
var usersById = await _db.Users
    .Where(u => userIds.Contains(u.Id))
    .ToDictionaryAsync(u => u.Id, ct);

foreach (var order in orders)
{
    var user = usersById[order.UserId]; // O(1) dictionary lookup
}
```

### 5. Dependency Injection with Microsoft.Extensions.DependencyInjection

Standard DI patterns for ASP.NET Core and general .NET applications.

```csharp
// Registration in Program.cs / Startup.cs
var builder = WebApplication.CreateBuilder(args);

// Transient: new instance every time
builder.Services.AddTransient<IEmailSender, SmtpEmailSender>();

// Scoped: one instance per HTTP request (or scope)
builder.Services.AddScoped<IUserRepository, EfUserRepository>();
builder.Services.AddScoped<IOrderService, OrderService>();

// Singleton: one instance for the lifetime of the app
builder.Services.AddSingleton<ICacheService, RedisCacheService>();

// Named/keyed services (NET 8+)
builder.Services.AddKeyedScoped<IPaymentGateway, StripeGateway>("stripe");
builder.Services.AddKeyedScoped<IPaymentGateway, PayPalGateway>("paypal");

// Options pattern for configuration
builder.Services.Configure<SmtpOptions>(
    builder.Configuration.GetSection(SmtpOptions.SectionName));

// HttpClient factory — avoids socket exhaustion
builder.Services.AddHttpClient<IWeatherClient, WeatherClient>(client =>
{
    client.BaseAddress = new Uri(builder.Configuration["WeatherApi:BaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Constructor injection — preferred approach
public class OrderService : IOrderService
{
    private readonly IOrderRepository _orders;
    private readonly IUserRepository _users;
    private readonly ILogger<OrderService> _logger;

    // DI injects all dependencies
    public OrderService(
        IOrderRepository orders,
        IUserRepository users,
        ILogger<OrderService> logger)
    {
        _orders = orders;
        _users = users;
        _logger = logger;
    }
}

// Primary constructor (C# 12)
public class OrderService(
    IOrderRepository orders,
    IUserRepository users,
    ILogger<OrderService> logger) : IOrderService
{
    public async Task<Order> CreateAsync(OrderRequest request, CancellationToken ct)
    {
        logger.LogInformation("Creating order for user {UserId}", request.UserId);
        // ...
    }
}
```

### 6. Result Pattern (Instead of Exceptions for Expected Failures)

Use Result types for expected failures; reserve exceptions for truly exceptional cases.

```csharp
// Generic Result type
public readonly record struct Result<T>
{
    public T? Value { get; }
    public string? Error { get; }
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    private Result(T? value, string? error, bool isSuccess)
    {
        Value = value;
        Error = error;
        IsSuccess = isSuccess;
    }

    public static Result<T> Ok(T value) => new(value, null, true);
    public static Result<T> Fail(string error) => new(default, error, false);

    // Functional map: transform the value if successful
    public Result<TOut> Map<TOut>(Func<T, TOut> mapper) =>
        IsSuccess ? Result<TOut>.Ok(mapper(Value!)) : Result<TOut>.Fail(Error!);

    // Bind: chain Results
    public Result<TOut> Bind<TOut>(Func<T, Result<TOut>> binder) =>
        IsSuccess ? binder(Value!) : Result<TOut>.Fail(Error!);
}

// Non-generic Result for void operations
public readonly record struct Result
{
    public string? Error { get; }
    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    private Result(string? error, bool isSuccess) { Error = error; IsSuccess = isSuccess; }

    public static Result Ok() => new(null, true);
    public static Result Fail(string error) => new(error, false);
}

// Usage in service
public async Task<Result<User>> RegisterUserAsync(
    RegisterRequest request,
    CancellationToken ct = default)
{
    if (string.IsNullOrWhiteSpace(request.Email))
        return Result<User>.Fail("Email is required");

    var existing = await _repository.FindByEmailAsync(request.Email, ct);
    if (existing is not null)
        return Result<User>.Fail($"Email {request.Email} is already registered");

    var user = User.Create(request.Name, request.Email);
    await _repository.SaveAsync(user, ct);
    return Result<User>.Ok(user);
}

// Usage in controller
public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
{
    var result = await _userService.RegisterUserAsync(request, ct);
    return result.IsSuccess
        ? Ok(result.Value)
        : BadRequest(result.Error);
}
```

### 7. Repository Pattern with EF Core

Encapsulate data access behind a consistent interface.

```csharp
// Interface — define what the domain needs, not what the database provides
public interface IUserRepository
{
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default);
    Task<User?> FindByEmailAsync(string email, CancellationToken ct = default);
    Task<IReadOnlyList<User>> FindActiveAsync(CancellationToken ct = default);
    Task<User> SaveAsync(User user, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

// EF Core implementation
public class EfUserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public EfUserRepository(AppDbContext db) => _db = db;

    public async Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id, ct);

    public async Task<User?> FindByEmailAsync(string email, CancellationToken ct = default)
        => await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task<IReadOnlyList<User>> FindActiveAsync(CancellationToken ct = default)
        => await _db.Users
            .Where(u => u.IsActive)
            .OrderBy(u => u.Name)
            .AsNoTracking()
            .ToListAsync(ct);

    public async Task<User> SaveAsync(User user, CancellationToken ct = default)
    {
        var entry = _db.Entry(user);
        if (entry.State == EntityState.Detached)
            _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return user;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await _db.Users
            .Where(u => u.Id == id)
            .ExecuteDeleteAsync(ct); // EF Core 7+ bulk delete — no load required
    }
}

// DbContext configuration
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Apply all IEntityTypeConfiguration<T> in this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}

// Entity configuration — keep model builder logic in dedicated classes
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.Name).HasMaxLength(100).IsRequired();
    }
}
```

### 8. .NET Framework 4.8 vs .NET 5+ Differences

Key differences to keep in mind when targeting both or migrating.

```csharp
// .NET Framework 4.8: Use Task.Run for CPU-bound work on thread pool
// .NET 5+: Same, but also has improved thread pool heuristics

// .NET Framework 4.8: ConfigureAwait(false) is REQUIRED in library code
//   to avoid ASP.NET's SynchronizationContext deadlock
public async Task<string> LibraryMethodAsync()
{
    var data = await GetDataAsync().ConfigureAwait(false); // Required on .NET Fx 4.8
    return Process(data);
}

// .NET 5+: No SynchronizationContext in ASP.NET Core — ConfigureAwait(false) optional
// but still good practice in library code for portability

// .NET Framework 4.8: BinaryFormatter (deprecated, security risk — never use)
// .NET 5+: BinaryFormatter throws NotSupportedException by default
// Both: Use System.Text.Json or Newtonsoft.Json instead
var json = JsonSerializer.Serialize(myObject);
var obj = JsonSerializer.Deserialize<MyClass>(json);

// .NET Framework 4.8: HttpClient should be shared (static or injected)
// .NET 5+: Use IHttpClientFactory — avoids socket exhaustion
// Bad (both targets):
using var client = new HttpClient(); // Creates a new socket every time

// Good (.NET 5+):
public class MyService(IHttpClientFactory factory)
{
    public async Task<string> FetchAsync(string url, CancellationToken ct)
    {
        using var client = factory.CreateClient("MyService");
        return await client.GetStringAsync(url, ct);
    }
}

// String handling differences
// .NET Framework 4.8: string.IsNullOrEmpty, string.IsNullOrWhiteSpace
// .NET 5+: Same + string.IsNullOrEmpty(span), Span<char> APIs for zero-alloc

// File I/O
// .NET Framework 4.8: File.ReadAllText, File.ReadAllLines
// .NET 5+: Same + File.ReadAllTextAsync, File.ReadAllLinesAsync
var text = await File.ReadAllTextAsync(path, ct); // .NET 5+ only

// Top-level statements and minimal hosting (.NET 6+)
// .NET Framework 4.8 requires Program.cs with Main method and Startup.cs
// .NET 6+: minimal API style
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<IUserService, UserService>();
var app = builder.Build();
app.MapGet("/users/{id}", async (Guid id, IUserService svc, CancellationToken ct) =>
    await svc.GetUserAsync(id, ct) is { } user ? Results.Ok(user) : Results.NotFound());
app.Run();
```

### 9. Modern C# Features (C# 10-12)

Use modern language features to write cleaner, safer code.

```csharp
// C# 10: File-scoped namespaces — remove one level of indentation
namespace MyApp.Services; // Applies to entire file

public class UserService { }

// C# 10: Global usings — put in a dedicated GlobalUsings.cs
global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Threading;
global using System.Threading.Tasks;
global using Microsoft.Extensions.Logging;

// C# 8+: Switch expressions
var description = status switch
{
    OrderStatus.Pending   => "Awaiting payment",
    OrderStatus.Confirmed => "Processing",
    OrderStatus.Shipped   => "On the way",
    OrderStatus.Delivered => "Delivered",
    _                     => throw new ArgumentOutOfRangeException(nameof(status))
};

// C# 9+: Pattern matching enhancements
if (shape is Circle { Radius: > 10 } bigCircle)
{
    Console.WriteLine($"Large circle: {bigCircle.Radius}");
}

// C# 9+: List patterns (C# 11)
if (values is [var first, var second, ..])
{
    Console.WriteLine($"First two: {first}, {second}");
}

// C# 10+: Constant string interpolation
const string prefix = "APP";
const string separator = "_";
// const string key = $"{prefix}{separator}KEY"; // C# 10 allows this

// C# 11: Raw string literals — no escape sequences needed
var json = """
    {
        "name": "Alice",
        "email": "alice@example.com"
    }
    """;

// C# 11: Required members — enforce initialization
public class PersonRequest
{
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
    public string? MiddleName { get; init; }
}
// var req = new PersonRequest(); // Compile error — FirstName and LastName required

// C# 12: Primary constructors for classes (not just records)
public class UserService(IUserRepository repository, ILogger<UserService> logger)
{
    public async Task<User?> GetUserAsync(Guid id, CancellationToken ct)
    {
        logger.LogDebug("Getting user {Id}", id);
        return await repository.FindByIdAsync(id, ct);
    }
}

// C# 12: Collection expressions
List<int> numbers = [1, 2, 3, 4, 5];
int[] moreNumbers = [.. numbers, 6, 7, 8];
```

### 10. VB.NET Idiomatic Patterns

VB.NET-specific patterns where they differ from C#.

```vb
' VB.NET uses Nothing instead of C#'s null
Dim user As User = Nothing

' Null check
If user Is Nothing Then
    Throw New InvalidOperationException("User not found")
End If

' String comparison — use = operator, not ReferenceEquals
If userName = "Alice" Then ' Value comparison
    ' ...
End If

' VB.NET With blocks — useful for object initialization
Dim order As New Order() With {
    .CustomerId = customerId,
    .CreatedAt = DateTime.UtcNow,
    .Status = OrderStatus.Pending
}

' Async/Await — same semantics as C#
Public Async Function GetUserAsync(id As Guid, ct As CancellationToken) As Task(Of User)
    Return Await _repository.FindByIdAsync(id, ct)
End Function

' LINQ — same as C#, can use query syntax
Dim activeUsers = From u In _db.Users
                  Where u.IsActive
                  Order By u.Name
                  Select u

' Or method syntax
Dim activeUsers = _db.Users _
    .Where(Function(u) u.IsActive) _
    .OrderBy(Function(u) u.Name) _
    .AsNoTracking()

' Using statement — same as C#
Using stream As New FileStream(path, FileMode.Open)
    ' stream is disposed automatically
End Using

' Exception handling — matches C# Try/Catch/Finally
Try
    Dim result = Await ProcessAsync()
Catch ex As InvalidOperationException
    _logger.LogError(ex, "Operation failed")
    Throw ' Re-throw without losing stack trace
Finally
    Cleanup()
End Try

' Interfaces and implementation
Public Interface IUserRepository
    Function FindByIdAsync(id As Guid, Optional ct As CancellationToken = Nothing) As Task(Of User)
End Interface

Public Class EfUserRepository
    Implements IUserRepository

    Private ReadOnly _db As AppDbContext

    Public Sub New(db As AppDbContext)
        _db = db
    End Sub

    Public Async Function FindByIdAsync(id As Guid, Optional ct As CancellationToken = Nothing) _
        As Task(Of User) Implements IUserRepository.FindByIdAsync
        Return Await _db.Users.AsNoTracking().FirstOrDefaultAsync(Function(u) u.Id = id, ct)
    End Function
End Class
```

## Testing with xUnit and Moq

```csharp
// Test project setup
// dotnet add package xunit
// dotnet add package xunit.runner.visualstudio
// dotnet add package Moq
// dotnet add package FluentAssertions
// dotnet add package Microsoft.AspNetCore.Mvc.Testing

// Naming convention: MethodName_StateUnderTest_ExpectedBehavior
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _mockRepo;
    private readonly Mock<ILogger<UserService>> _mockLogger;
    private readonly UserService _sut; // System Under Test

    public UserServiceTests()
    {
        _mockRepo = new Mock<IUserRepository>();
        _mockLogger = new Mock<ILogger<UserService>>();
        _sut = new UserService(_mockRepo.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task GetUserAsync_WithExistingId_ReturnsUser()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var expectedUser = new User(userId, "Alice", "alice@example.com");
        _mockRepo.Setup(r => r.FindByIdAsync(userId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(expectedUser);

        // Act
        var result = await _sut.GetUserAsync(userId);

        // Assert
        result.Should().NotBeNull();
        result!.Name.Should().Be("Alice");
        _mockRepo.Verify(r => r.FindByIdAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetUserAsync_WithNonExistentId_ReturnsNull()
    {
        // Arrange
        _mockRepo.Setup(r => r.FindByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync((User?)null);

        // Act
        var result = await _sut.GetUserAsync(Guid.NewGuid());

        // Assert
        result.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("   ")]
    public async Task RegisterUserAsync_WithInvalidEmail_ReturnsFailure(string? invalidEmail)
    {
        // Act
        var result = await _sut.RegisterUserAsync(
            new RegisterRequest { Email = invalidEmail!, Name = "Alice" });

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("Email");
    }
}

// Integration tests with WebApplicationFactory (ASP.NET Core)
public class UserEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public UserEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace real services with test doubles
                services.AddScoped<IUserRepository, InMemoryUserRepository>();
            });
        }).CreateClient();
    }

    [Fact]
    public async Task GetUser_WithValidId_Returns200()
    {
        // Arrange
        var userId = Guid.NewGuid();
        // (seed test data if needed)

        // Act
        var response = await _client.GetAsync($"/users/{userId}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var user = await response.Content.ReadFromJsonAsync<User>();
        user.Should().NotBeNull();
    }
}

// Test data builder pattern — avoids brittle object construction
public class UserBuilder
{
    private Guid _id = Guid.NewGuid();
    private string _name = "Test User";
    private string _email = "test@example.com";
    private bool _isActive = true;

    public UserBuilder WithName(string name) { _name = name; return this; }
    public UserBuilder WithEmail(string email) { _email = email; return this; }
    public UserBuilder Inactive() { _isActive = false; return this; }

    public User Build() => new User(_id, _name, _email) { IsActive = _isActive };
}

// Usage in tests
var user = new UserBuilder().WithName("Alice").Inactive().Build();
```

## Anti-Patterns

```csharp
// Anti-pattern: Catching Exception and swallowing
try
{
    await ProcessAsync();
}
catch (Exception) { } // Swallows ALL errors — bugs become invisible

// Fix: Either handle specifically or log and rethrow
try
{
    await ProcessAsync();
}
catch (OperationCanceledException)
{
    throw; // Propagate cancellation — never swallow this
}
catch (Exception ex)
{
    _logger.LogError(ex, "Processing failed");
    throw; // Rethrow to preserve stack trace — use throw, not throw ex
}

// Anti-pattern: Returning null from collections
public List<User> GetUsers() => null!; // Forces null checks on every caller

// Fix: Return empty collection
public List<User> GetUsers() => [];
public async Task<IReadOnlyList<User>> GetUsersAsync(CancellationToken ct)
    => await _db.Users.AsNoTracking().ToListAsync(ct);

// Anti-pattern: Static mutable state
public static class Cache
{
    public static Dictionary<string, object> Items = new(); // Not thread-safe
}

// Fix: Use ConcurrentDictionary or IMemoryCache via DI
public class CacheService(IMemoryCache cache)
{
    public T? Get<T>(string key) => cache.TryGetValue(key, out T? value) ? value : default;
}

// Anti-pattern: new HttpClient() in a method
public async Task<string> FetchAsync(string url)
{
    using var client = new HttpClient(); // Socket exhaustion over time
    return await client.GetStringAsync(url);
}

// Fix: Inject IHttpClientFactory
public class ApiClient(IHttpClientFactory factory)
{
    public async Task<string> FetchAsync(string url, CancellationToken ct)
    {
        using var client = factory.CreateClient();
        return await client.GetStringAsync(url, ct);
    }
}

// Anti-pattern: God class
public class OrderService // 2000 lines — does everything
{
    public void CreateOrder() { }
    public void SendEmail() { }   // Not an order concern
    public void GeneratePdf() { } // Not an order concern
    public void CalculateTax() { } // Maybe a separate concern
}

// Fix: Single Responsibility — delegate to focused services
public class OrderService(IEmailService email, IInvoiceService invoice, ITaxService tax)
{
    public async Task<Order> CreateAsync(OrderRequest request, CancellationToken ct)
    {
        var order = Order.Create(request);
        var taxAmount = await tax.CalculateAsync(order, ct);
        order.ApplyTax(taxAmount);
        await _repository.SaveAsync(order, ct);
        await email.SendOrderConfirmationAsync(order, ct);
        return order;
    }
}
```

## Quick Reference

| Topic | Guidance |
|-------|----------|
| Null handling | Enable `#nullable enable`, use `?` types, `??`, `?.`, `is not null` |
| Async | Always `await`, never `.Result`/`.Wait()`, pass `CancellationToken` |
| Immutability | Use `record`, `init` setters, `readonly` fields |
| LINQ/EF Core | `AsNoTracking()` for reads, `Include()` for relations, project with `Select()` |
| DI | Constructor injection, scoped per request, `IHttpClientFactory` for HTTP |
| Errors | `Result<T>` for expected failures, exceptions for unexpected |
| Collections | Return empty list not null, use `HashSet<T>` for lookups |
| Strings | `StringBuilder` in loops, `string.IsNullOrWhiteSpace()`, interpolation |
| Resources | `using` for `IDisposable`, `await using` for `IAsyncDisposable` |
| Logging | `ILogger<T>`, structured logging, never `Console.WriteLine` in production |
| Modern C# | File-scoped namespaces, global usings, primary constructors, switch expressions |
| Testing | xUnit + Moq + FluentAssertions, `Fact`/`Theory`, AAA pattern, builder pattern |
| Security | Parameterized queries, `DtdProcessing.Prohibit`, no hardcoded secrets |
| Performance | `Span<T>`/`Memory<T>` for hot paths, `ArrayPool<T>`, avoid boxing |

**Remember**: .NET code should be readable, type-safe, and take full advantage of the language's strong static typing and async model. When in doubt, let the compiler and nullable reference types guide you.
