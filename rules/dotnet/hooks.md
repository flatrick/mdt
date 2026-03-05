---
paths:
  - "**/*.cs"
  - "**/*.vb"
  - "**/*.csproj"
  - "**/*.vbproj"
---
# .NET Hooks

> This file extends [common/hooks.md](../common/hooks.md) with .NET specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **dotnet format**: Auto-format C# files after edit
- **dotnet build**: Incremental build after significant changes
- **dotnet test**: Run affected tests after changes

## Warnings

- Warn about `.Result` or `.Wait()` on Tasks — potential deadlock in async contexts
- Warn about `BinaryFormatter` — removed in .NET 5+, use `System.Text.Json`
- Warn about `new HttpClient()` in loops — use `IHttpClientFactory` instead
- Warn about connection strings in appsettings.json — use Secret Manager or environment variables
