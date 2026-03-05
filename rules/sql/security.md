---
paths:
  - "**/*.sql"
  - "**/*.tsql"
---
# SQL Security

> This file extends [common/security.md](../common/security.md) with SQL specific content.

## SQL Injection Prevention

```sql
-- Good: Parameterized stored procedure
CREATE PROCEDURE dbo.usp_GetUser
    @UserId INT
AS
BEGIN
    SELECT * FROM dbo.Users WHERE UserId = @UserId;
END;

-- Bad: Dynamic SQL with concatenation
DECLARE @sql NVARCHAR(MAX) = 'SELECT * FROM Users WHERE UserId = ' + @UserIdInput;
EXEC (@sql);  -- NEVER do this

-- If dynamic SQL is unavoidable: use sp_executesql with parameters
DECLARE @sql NVARCHAR(MAX) = N'SELECT * FROM dbo.Users WHERE Status = @Status';
EXEC sp_executesql @sql, N'@Status NVARCHAR(50)', @Status = @StatusInput;
```

## Principle of Least Privilege

```sql
-- Create application-specific role
CREATE ROLE AppRole;
GRANT SELECT, INSERT, UPDATE ON dbo.Users TO AppRole;
GRANT EXECUTE ON dbo.usp_GetUser TO AppRole;
DENY DELETE ON dbo.Users TO AppRole;

-- Application connects as low-privilege user
CREATE USER AppUser WITHOUT LOGIN;  -- for Azure SQL
ALTER ROLE AppRole ADD MEMBER AppUser;
```

## Sensitive Data

```sql
-- Encrypt sensitive columns (SQL Server Always Encrypted)
CREATE TABLE dbo.Customers (
    CustomerId INT IDENTITY PRIMARY KEY,
    -- Always Encrypted
    CreditCardNumber NVARCHAR(20)
        ENCRYPTED WITH (COLUMN_ENCRYPTION_KEY = MyCEK,
                        ENCRYPTION_TYPE = Deterministic,
                        ALGORITHM = 'AEAD_AES_256_CBC_HMAC_SHA_256'),
    -- Dynamic Data Masking for non-privileged queries
    Email NVARCHAR(254)
        MASKED WITH (FUNCTION = 'email()') NOT NULL
);
```

## Reference

See skill: `sqlserver-patterns` for comprehensive SQL Server security and `postgres-patterns` for PostgreSQL security.
