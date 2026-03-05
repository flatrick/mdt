---
paths:
  - "**/*.cs"
  - "**/*.vb"
  - "**/*.csproj"
  - "**/*.vbproj"
---
# .NET Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with .NET specific content.

## Standards

- Follow **Microsoft C# Coding Conventions**
- Enable **nullable reference types**: `<Nullable>enable</Nullable>` in `.csproj`
- Use **file-scoped namespaces** (C# 10+): `namespace MyApp;`
- Use **global usings** (C# 10+) for common namespaces

## Formatting

- **dotnet format**: Built-in formatter (`dotnet format`)
- **EditorConfig**: `.editorconfig` for consistent style across team
- 4-space indentation
- Allman-style braces (opening brace on new line) is traditional, but K&R is fine if consistent

## Naming Conventions

```csharp
// Interfaces: IPrefixed
public interface IUserRepository { }

// Classes/Structs: PascalCase
public class UserService { }

// Methods/Properties: PascalCase
public string GetUserName() { }
public string UserName { get; set; }

// Private fields: _camelCase
private readonly ILogger<UserService> _logger;

// Local variables: camelCase
var userName = "Alice";

// Constants: PascalCase (C# convention) or UPPER_CASE (both acceptable)
public const int MaxRetries = 3;
```

## Immutability

```csharp
// C# 9+ record types (immutable by default)
public record User(string Name, string Email);

// Init-only setters
public class Config
{
    public string ApiUrl { get; init; } = string.Empty;
}
```

## Reference

See skill: `dotnet-patterns` for comprehensive .NET idioms, async patterns, and EF Core usage.
