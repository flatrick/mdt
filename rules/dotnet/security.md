---
paths:
  - "**/*.cs"
  - "**/*.vb"
---
# .NET Security

> This file extends [common/security.md](../common/security.md) with .NET specific content.

## Secret Management

```csharp
// Use environment variables
var apiKey = Environment.GetEnvironmentVariable("API_KEY")
    ?? throw new InvalidOperationException("API_KEY not configured");

// Use .NET Secret Manager (development)
// dotnet user-secrets set "ApiKey" "my-secret"
var apiKey = configuration["ApiKey"];

// Use Azure Key Vault or AWS Secrets Manager in production
builder.Configuration.AddAzureKeyVault(vaultUri, credential);
```

## SQL Injection Prevention

```csharp
// Good: Parameterized query
var user = await db.Users
    .Where(u => u.Email == email)
    .FirstOrDefaultAsync();

// Good: EF Core raw SQL with parameters
var users = await db.Database
    .SqlQuery<User>($"SELECT * FROM Users WHERE Email = {email}")
    .ToListAsync();

// Bad: String concatenation
var sql = "SELECT * FROM Users WHERE Email = '" + email + "'";
```

## XML Security

```csharp
// Always prohibit DTD processing
var settings = new XmlReaderSettings
{
    DtdProcessing = DtdProcessing.Prohibit,
    XmlResolver = null
};
using var reader = XmlReader.Create(stream, settings);
```

## Security Scanning

```bash
dotnet list package --vulnerable
# Install and run security scanner
dotnet tool install --global security-scan
security-scan .
```

## Reference

See skill: `dotnet-patterns` for authentication, authorization, and data protection patterns.
