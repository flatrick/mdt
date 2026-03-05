---
paths:
  - "**/*.cs"
  - "**/*.vb"
---
# .NET Patterns

> This file extends [common/patterns.md](../common/patterns.md) with .NET specific content.

## Repository Pattern

```csharp
public interface IUserRepository
{
    Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default);
    Task<User> SaveAsync(User user, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public class EfUserRepository : IUserRepository
{
    private readonly AppDbContext _db;

    public EfUserRepository(AppDbContext db) => _db = db;

    public async Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default)
        => await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct);
}
```

## Result Pattern

```csharp
public record Result<T>(T? Value, string? Error, bool IsSuccess)
{
    public static Result<T> Ok(T value) => new(value, null, true);
    public static Result<T> Fail(string error) => new(default, error, false);
}
```

## Options Pattern

```csharp
public class MyOptions
{
    public const string SectionName = "MyFeature";
    public string ApiUrl { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}

// Registration
builder.Services.Configure<MyOptions>(
    builder.Configuration.GetSection(MyOptions.SectionName));
```

## Reference

See skill: `dotnet-patterns` for comprehensive patterns including DI, async, EF Core, and testing.
