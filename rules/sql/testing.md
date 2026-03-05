---
paths:
  - "**/*.sql"
  - "**/*.tsql"
---
# SQL Testing

> This file extends [common/testing.md](../common/testing.md) with SQL specific content.

## SQL Server: tSQLt Framework

```sql
-- Install tSQLt (https://tsqlt.org/)
-- Run tests:
EXEC tSQLt.RunAll;

-- Create test class
EXEC tSQLt.NewTestClass 'UserTests';
GO

-- Test stored procedure
CREATE PROCEDURE UserTests.[test usp_GetUser returns user when found]
AS
BEGIN
    -- Arrange
    EXEC tSQLt.FakeTable 'dbo.Users';
    INSERT INTO dbo.Users (UserId, Email) VALUES (1, 'test@example.com');

    -- Act
    EXEC tSQLt.ResultSetFilter 1, 'EXEC dbo.usp_GetUser @UserId = 1';

    -- Assert
    DECLARE @expected TABLE (UserId INT, Email NVARCHAR(254));
    INSERT INTO @expected VALUES (1, 'test@example.com');
    EXEC tSQLt.AssertEqualsTable '@expected', '#RsFilter1';
END;
```

## PostgreSQL: pgTAP Framework

```sql
-- pgTAP test
SELECT plan(3);

SELECT ok(
    (SELECT COUNT(*) FROM users WHERE email = 'test@example.com') = 1,
    'User exists'
);

SELECT is(
    (SELECT email FROM users WHERE user_id = 1),
    'test@example.com',
    'Email matches'
);

SELECT finish();
```

## Reference

See skill: `sqlserver-patterns` for T-SQL testing and `postgres-patterns` for PostgreSQL testing patterns.
