---
paths:
  - "**/*.sql"
  - "**/*.tsql"
---
# SQL Patterns

> This file extends [common/patterns.md](../common/patterns.md) with SQL specific content.

## Repository Pattern (in application code)

Use parameterized queries in your application layer — never concatenate user input into SQL.

```sql
-- Good: Parameterized stored procedure
CREATE PROCEDURE dbo.usp_GetUserByEmail
    @Email NVARCHAR(254)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        UserId,
        Email,
        DisplayName,
        CreatedAt
    FROM dbo.Users
    WHERE Email = @Email
      AND IsActive = 1;
END;
```

## Pagination Pattern

```sql
-- SQL Server: Efficient keyset pagination (prefer over OFFSET/FETCH for large tables)
SELECT
    UserId,
    Email,
    CreatedAt
FROM dbo.Users
WHERE CreatedAt < @LastSeenCreatedAt
   OR (CreatedAt = @LastSeenCreatedAt AND UserId < @LastSeenUserId)
ORDER BY CreatedAt DESC, UserId DESC
FETCH NEXT @PageSize ROWS ONLY;

-- OFFSET/FETCH for simple cases
SELECT UserId, Email
FROM dbo.Users
ORDER BY CreatedAt DESC
OFFSET @Offset ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

## Upsert Pattern

```sql
-- SQL Server MERGE for upsert
MERGE dbo.Users AS target
USING (VALUES (@UserId, @Email, @DisplayName)) AS source (UserId, Email, DisplayName)
ON target.UserId = source.UserId
WHEN MATCHED THEN
    UPDATE SET Email = source.Email, DisplayName = source.DisplayName
WHEN NOT MATCHED THEN
    INSERT (UserId, Email, DisplayName) VALUES (source.UserId, source.Email, source.DisplayName);
```

## Reference

See skill: `sqlserver-patterns` for T-SQL patterns and `postgres-patterns` for PostgreSQL patterns.
