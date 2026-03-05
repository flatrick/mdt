---
paths:
  - "**/*.sql"
  - "**/*.tsql"
---
# SQL Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with SQL specific content.

## Standards

- Use **UPPERCASE** for SQL keywords: `SELECT`, `FROM`, `WHERE`, `JOIN`
- Use **PascalCase** for table and column names: `UserProfile`, `CreatedAt`
- Always use **schema prefixes**: `dbo.Users`, not just `Users`
- Never use `SELECT *` in production code — list columns explicitly

## Formatting

```sql
-- Good: Readable formatting
SELECT
    u.UserId,
    u.Email,
    u.CreatedAt,
    COUNT(o.OrderId) AS OrderCount
FROM dbo.Users AS u
LEFT JOIN dbo.Orders AS o
    ON u.UserId = o.UserId
WHERE
    u.IsActive = 1
    AND u.CreatedAt >= '2024-01-01'
GROUP BY
    u.UserId,
    u.Email,
    u.CreatedAt
ORDER BY
    u.CreatedAt DESC;
```

## Naming Conventions

```sql
-- Tables: PascalCase, plural
CREATE TABLE dbo.Users ( ... );
CREATE TABLE dbo.OrderItems ( ... );

-- Columns: PascalCase
UserId INT NOT NULL,
CreatedAt DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),

-- Stored Procedures: usp_ prefix + Verb + Noun
CREATE PROCEDURE dbo.usp_GetUserById ...
CREATE PROCEDURE dbo.usp_CreateOrder ...

-- Functions: ufn_ prefix
CREATE FUNCTION dbo.ufn_GetAge ...

-- Indexes: IX_ prefix
CREATE INDEX IX_Users_Email ON dbo.Users (Email);

-- Primary Keys: PK_ prefix
CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),

-- Foreign Keys: FK_ prefix
CONSTRAINT FK_Orders_Users FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId)
```

## SQL Server vs PostgreSQL Differences

| Feature | SQL Server (T-SQL) | PostgreSQL |
|---|---|---|
| Auto-increment | `IDENTITY(1,1)` | `SERIAL` / `GENERATED ALWAYS AS IDENTITY` |
| String concat | `+` or `CONCAT()` | `\|\|` or `CONCAT()` |
| Top N rows | `SELECT TOP 10` | `LIMIT 10` |
| Get date | `GETDATE()` / `SYSUTCDATETIME()` | `NOW()` / `CURRENT_TIMESTAMP` |
| String length | `LEN()` | `LENGTH()` |
| Conditional | `CASE WHEN` / `IIF()` | `CASE WHEN` |
| JSON | `FOR JSON`, `JSON_VALUE()` | `->`, `->>`, `jsonb` |

## Reference

See skills: `sqlserver-patterns` and `postgres-patterns` for database-specific idioms and patterns.
