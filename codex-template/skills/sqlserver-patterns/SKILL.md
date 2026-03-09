---
name: sqlserver-patterns
description: T-SQL and SQL Server best practices, query optimization, stored procedures, indexing strategies, security, and administration patterns for SQL Server 2016+ and Azure SQL Database.
---

# SQL Server / T-SQL Patterns

Quick reference for SQL Server and T-SQL best practices. For detailed guidance, use the `database-reviewer` agent.

## When to Activate

- Writing T-SQL queries, stored procedures, or functions
- Designing SQL Server schemas or migrations
- Troubleshooting slow queries or high I/O
- Implementing error handling or transaction management
- Reviewing indexing strategy or query plans
- Working with Azure SQL Database
- Migrating from or to PostgreSQL

---

## Core Principles

### 1. Parameterized Queries and sp_executesql

Never concatenate user input into SQL strings. Always use parameters.

```sql
-- Good: Parameterized stored procedure
CREATE PROCEDURE dbo.usp_GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        UserId,
        Email,
        DisplayName,
        CreatedAt
    FROM dbo.Users
    WHERE UserId = @UserId
      AND IsActive = 1;
END;
GO

-- Good: sp_executesql when dynamic SQL is genuinely required
DECLARE @TableName   SYSNAME       = N'dbo.Orders';
DECLARE @StatusFilter NVARCHAR(50) = N'Shipped';
DECLARE @sql         NVARCHAR(MAX);

SET @sql = N'
    SELECT OrderId, CustomerId, TotalAmount
    FROM ' + QUOTENAME(@TableName) + N'
    WHERE Status = @Status';

EXEC sp_executesql
    @sql,
    N'@Status NVARCHAR(50)',
    @Status = @StatusFilter;

-- Bad: string concatenation — SQL injection risk
DECLARE @badSql NVARCHAR(MAX) =
    'SELECT * FROM Users WHERE Name = ''' + @UserInput + '''';
EXEC (@badSql);  -- NEVER do this
```

**Rules for dynamic SQL:**
- Use `QUOTENAME()` for identifiers (table/column names)
- Always pass values as parameters to `sp_executesql`, never embed them
- Validate identifier inputs against a whitelist when possible

---

### 2. SET-Based Operations over Cursors

SQL Server is optimized for set operations. Row-by-row cursors are rarely necessary.

```sql
-- Bad: cursor to update a discount column
DECLARE @OrderId INT, @Total DECIMAL(10,2);
DECLARE cur CURSOR FOR SELECT OrderId, TotalAmount FROM dbo.Orders;
OPEN cur;
FETCH NEXT FROM cur INTO @OrderId, @Total;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF @Total > 1000
        UPDATE dbo.Orders SET Discount = 0.10 WHERE OrderId = @OrderId;
    FETCH NEXT FROM cur INTO @OrderId, @Total;
END;
CLOSE cur; DEALLOCATE cur;

-- Good: single SET-based UPDATE
UPDATE dbo.Orders
SET Discount = 0.10
WHERE TotalAmount > 1000;

-- Good: batch processing with TOP to avoid long-running transactions
DECLARE @BatchSize INT = 1000;
DECLARE @Rows INT = 1;

WHILE @Rows > 0
BEGIN
    UPDATE TOP (@BatchSize) dbo.Orders
    SET ArchivedAt = SYSUTCDATETIME()
    WHERE CreatedAt < DATEADD(YEAR, -5, SYSUTCDATETIME())
      AND ArchivedAt IS NULL;

    SET @Rows = @@ROWCOUNT;
    WAITFOR DELAY '00:00:01';  -- brief pause between batches
END;

-- Acceptable cursor use: sending one email per row, calling external proc per row
-- These are inherently row-by-row operations — document the reason
```

---

### 3. Indexing Strategy

#### Clustered vs Non-Clustered

```sql
-- Clustered index: physical row order — one per table, usually the PK
CREATE TABLE dbo.Orders (
    OrderId    INT            IDENTITY(1,1) NOT NULL,
    CustomerId INT            NOT NULL,
    CreatedAt  DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    Status     NVARCHAR(20)   NOT NULL DEFAULT N'Pending',
    Total      DECIMAL(12, 2) NOT NULL,
    CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (OrderId)
);

-- Non-clustered index for frequent lookup by CustomerId
CREATE NONCLUSTERED INDEX IX_Orders_CustomerId
    ON dbo.Orders (CustomerId)
    INCLUDE (CreatedAt, Status, Total);  -- covering index avoids key lookup

-- Composite index — equality predicates first, range predicates last
CREATE NONCLUSTERED INDEX IX_Orders_Status_CreatedAt
    ON dbo.Orders (Status, CreatedAt DESC);
-- Supports: WHERE Status = 'Pending' AND CreatedAt >= '2024-01-01'

-- Partial / filtered index — smaller, faster for sparse predicates
CREATE NONCLUSTERED INDEX IX_Orders_Pending
    ON dbo.Orders (CreatedAt)
    WHERE Status = N'Pending';

-- Unique index (enforces uniqueness without making it the PK)
CREATE UNIQUE NONCLUSTERED INDEX UIX_Users_Email
    ON dbo.Users (Email)
    WHERE IsActive = 1;  -- filtered unique — allows multiple inactive rows with same email
```

#### Index Maintenance

```sql
-- Check index fragmentation
SELECT
    OBJECT_NAME(ips.object_id)      AS TableName,
    i.name                          AS IndexName,
    ips.avg_fragmentation_in_percent,
    ips.page_count
FROM sys.dm_db_index_physical_stats(
        DB_ID(), NULL, NULL, NULL, 'LIMITED') AS ips
JOIN sys.indexes AS i
    ON i.object_id = ips.object_id
   AND i.index_id  = ips.index_id
WHERE ips.avg_fragmentation_in_percent > 5
  AND ips.page_count > 100
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- Rebuild (heavy — locks table in older compat levels; ONLINE available in Enterprise)
ALTER INDEX IX_Orders_CustomerId ON dbo.Orders REBUILD WITH (ONLINE = ON);

-- Reorganize (light — always online, good for 5–30% fragmentation)
ALTER INDEX IX_Orders_CustomerId ON dbo.Orders REORGANIZE;

-- Update statistics after large data loads
UPDATE STATISTICS dbo.Orders WITH FULLSCAN;
```

#### Missing Index Hints from Query Plans

```sql
-- Find missing indexes suggested by the query optimizer
SELECT
    dm_mid.statement                                     AS TableName,
    dm_migs.avg_total_user_cost * dm_migs.avg_user_impact
        * (dm_migs.user_seeks + dm_migs.user_scans)     AS ImprovementMeasure,
    'CREATE INDEX IX_' +
        REPLACE(dm_mid.statement, '.', '_') + '_' +
        REPLACE(REPLACE(ISNULL(dm_mid.equality_columns, ''), '[', ''), ']', '')
        AS SuggestedIndexName,
    dm_mid.equality_columns,
    dm_mid.inequality_columns,
    dm_mid.included_columns
FROM sys.dm_db_missing_index_group_stats  AS dm_migs
JOIN sys.dm_db_missing_index_groups       AS dm_mig
    ON dm_migs.group_handle = dm_mig.index_group_handle
JOIN sys.dm_db_missing_index_details      AS dm_mid
    ON dm_mig.index_handle = dm_mid.index_handle
WHERE dm_mid.database_id = DB_ID()
ORDER BY ImprovementMeasure DESC;
```

---

### 4. Transaction Handling and Isolation Levels

#### Explicit Transactions with Error Handling

```sql
BEGIN TRY
    BEGIN TRANSACTION;

    INSERT INTO dbo.Orders (CustomerId, Total, Status)
    VALUES (@CustomerId, @Total, N'Pending');

    DECLARE @OrderId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice)
    SELECT @OrderId, ProductId, Quantity, UnitPrice
    FROM @OrderItemsTable;

    UPDATE dbo.Inventory
    SET StockQuantity -= oi.Quantity
    FROM dbo.Inventory AS inv
    JOIN @OrderItemsTable AS oi ON inv.ProductId = oi.ProductId;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    -- Re-throw with context
    DECLARE @ErrorMessage  NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT            = ERROR_SEVERITY();
    DECLARE @ErrorState    INT            = ERROR_STATE();

    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;
```

#### Isolation Levels

```sql
-- Default: READ COMMITTED — dirty reads prevented, but blocking on writers
-- Enable READ COMMITTED SNAPSHOT at database level to reduce blocking (uses tempdb versioning)
ALTER DATABASE MyDb SET READ_COMMITTED_SNAPSHOT ON;

-- SNAPSHOT isolation — readers never block writers, point-in-time consistency
ALTER DATABASE MyDb SET ALLOW_SNAPSHOT_ISOLATION ON;

-- Use SNAPSHOT for reporting queries that must not block OLTP
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;
BEGIN TRANSACTION;
    SELECT CustomerId, SUM(Total) AS TotalSpend
    FROM dbo.Orders
    WHERE CreatedAt >= '2024-01-01'
    GROUP BY CustomerId;
COMMIT;

-- NOLOCK hint — use sparingly; can read uncommitted/phantom data
-- Acceptable for approximate counts on large tables; never for financial data
SELECT COUNT(*) FROM dbo.EventLog WITH (NOLOCK);

-- UPDLOCK + HOLDLOCK — pessimistic lock for "check then insert" patterns
BEGIN TRANSACTION;
    SELECT @Existing = UserId
    FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
    WHERE Email = @Email;

    IF @Existing IS NULL
        INSERT INTO dbo.Users (Email) VALUES (@Email);
COMMIT;
```

---

### 5. Stored Procedures and Functions

#### Stored Procedure Template

```sql
CREATE OR ALTER PROCEDURE dbo.usp_CreateOrder
    @CustomerId    INT,
    @OrderItems    dbo.OrderItemType READONLY,   -- table-valued parameter
    @CreatedOrderId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;  -- auto-rollback on any error

    -- Input validation
    IF @CustomerId IS NULL OR @CustomerId <= 0
        THROW 50001, 'Invalid CustomerId.', 1;

    IF NOT EXISTS (SELECT 1 FROM dbo.Customers WHERE CustomerId = @CustomerId AND IsActive = 1)
        THROW 50002, 'Customer not found or inactive.', 1;

    IF NOT EXISTS (SELECT 1 FROM @OrderItems)
        THROW 50003, 'Order must contain at least one item.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.Orders (CustomerId, Status, CreatedAt)
        VALUES (@CustomerId, N'Pending', SYSUTCDATETIME());

        SET @CreatedOrderId = SCOPE_IDENTITY();

        INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice)
        SELECT @CreatedOrderId, ProductId, Quantity, UnitPrice
        FROM @OrderItems;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;  -- re-throw original error
    END CATCH;
END;
GO

-- User-Defined Table Type for the TVP
CREATE TYPE dbo.OrderItemType AS TABLE (
    ProductId  INT            NOT NULL,
    Quantity   INT            NOT NULL,
    UnitPrice  DECIMAL(10, 2) NOT NULL
);
GO
```

#### Inline TVF vs Multi-Statement TVF

```sql
-- Inline TVF: optimizer can use statistics — PREFER this
CREATE OR ALTER FUNCTION dbo.ufn_GetOrdersByCustomer
    (@CustomerId INT)
RETURNS TABLE
AS
RETURN (
    SELECT
        o.OrderId,
        o.CreatedAt,
        o.Total,
        o.Status
    FROM dbo.Orders AS o
    WHERE o.CustomerId = @CustomerId
);
GO

-- Usage (composable, can JOIN, filter, etc.)
SELECT u.Email, o.OrderId, o.Total
FROM dbo.Users AS u
CROSS APPLY dbo.ufn_GetOrdersByCustomer(u.UserId) AS o
WHERE o.Total > 500;

-- Multi-statement TVF: optimizer treats as black box — AVOID unless necessary
-- (use inline TVF or a stored procedure instead)
CREATE FUNCTION dbo.ufn_ComplexCalc(@Param INT)
RETURNS @Result TABLE (Col1 INT, Col2 NVARCHAR(100))
AS
BEGIN
    -- optimizer cannot look inside; leads to row estimate = 1
    INSERT INTO @Result ...
    RETURN;
END;
```

---

### 6. CTEs and Window Functions

```sql
-- CTE for readability and recursion
WITH CustomerSpend AS (
    SELECT
        CustomerId,
        SUM(Total)   AS TotalSpend,
        COUNT(*)     AS OrderCount,
        MAX(CreatedAt) AS LastOrderDate
    FROM dbo.Orders
    WHERE Status = N'Completed'
    GROUP BY CustomerId
),
RankedCustomers AS (
    SELECT
        cs.*,
        ROW_NUMBER() OVER (ORDER BY TotalSpend DESC) AS SpendRank
    FROM CustomerSpend AS cs
)
SELECT
    u.Email,
    rc.TotalSpend,
    rc.OrderCount,
    rc.SpendRank
FROM RankedCustomers AS rc
JOIN dbo.Users AS u ON rc.CustomerId = u.UserId
WHERE rc.SpendRank <= 100;

-- Window functions: running total, lag/lead, rank
SELECT
    OrderId,
    CustomerId,
    CreatedAt,
    Total,
    SUM(Total)   OVER (PARTITION BY CustomerId ORDER BY CreatedAt
                       ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                 AS RunningTotal,
    LAG(Total, 1, 0) OVER (PARTITION BY CustomerId ORDER BY CreatedAt)
                 AS PreviousOrderTotal,
    LEAD(Total, 1)   OVER (PARTITION BY CustomerId ORDER BY CreatedAt)
                 AS NextOrderTotal,
    RANK()           OVER (PARTITION BY CustomerId ORDER BY Total DESC)
                 AS RankByValue
FROM dbo.Orders
WHERE Status = N'Completed';

-- Recursive CTE: organizational hierarchy
WITH OrgTree AS (
    -- Anchor
    SELECT EmployeeId, ManagerId, Name, 0 AS Level
    FROM dbo.Employees
    WHERE ManagerId IS NULL

    UNION ALL

    -- Recursive member
    SELECT e.EmployeeId, e.ManagerId, e.Name, ot.Level + 1
    FROM dbo.Employees AS e
    JOIN OrgTree AS ot ON e.ManagerId = ot.EmployeeId
)
SELECT EmployeeId, Name, Level
FROM OrgTree
ORDER BY Level, Name
OPTION (MAXRECURSION 50);  -- safety limit

-- PIVOT: rows to columns
SELECT *
FROM (
    SELECT CustomerId, YEAR(CreatedAt) AS OrderYear, Total
    FROM dbo.Orders
) AS src
PIVOT (
    SUM(Total) FOR OrderYear IN ([2022], [2023], [2024])
) AS pvt;
```

---

### 7. Error Handling with TRY/CATCH and THROW

```sql
-- THROW (SQL Server 2012+) — preserves original error number
BEGIN TRY
    EXEC dbo.usp_CreateOrder @CustomerId = @CustomerId, @OrderItems = @Items;
END TRY
BEGIN CATCH
    -- Log to error table before re-throwing
    INSERT INTO dbo.ErrorLog (
        ErrorNumber, ErrorSeverity, ErrorState,
        ErrorProcedure, ErrorLine, ErrorMessage, LoggedAt
    )
    VALUES (
        ERROR_NUMBER(), ERROR_SEVERITY(), ERROR_STATE(),
        ERROR_PROCEDURE(), ERROR_LINE(), ERROR_MESSAGE(),
        SYSUTCDATETIME()
    );

    THROW;  -- re-throw: same error number, message, and state
END CATCH;

-- Custom error numbers (50000–2147483647 are user-defined)
IF @Quantity <= 0
    THROW 50010, 'Quantity must be greater than zero.', 1;

-- RAISERROR (legacy — use THROW for new code)
RAISERROR('Legacy error: %s', 16, 1, @Message);

-- Nested transaction save points
CREATE PROCEDURE dbo.usp_Inner
AS
BEGIN
    SET NOCOUNT ON;
    SAVE TRANSACTION SaveInner;

    BEGIN TRY
        -- ... work ...
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION SaveInner;  -- only roll back to savepoint
        THROW;
    END CATCH;
END;
```

---

### 8. Temporal Tables and Row Versioning

```sql
-- System-versioned temporal table (SQL Server 2016+)
CREATE TABLE dbo.Products (
    ProductId    INT            IDENTITY(1,1)  NOT NULL,
    Name         NVARCHAR(200)  NOT NULL,
    Price        DECIMAL(10, 2) NOT NULL,
    IsActive     BIT            NOT NULL DEFAULT 1,
    -- System-time period columns (maintained automatically)
    ValidFrom    DATETIME2(7) GENERATED ALWAYS AS ROW START NOT NULL,
    ValidTo      DATETIME2(7) GENERATED ALWAYS AS ROW END   NOT NULL,
    CONSTRAINT PK_Products PRIMARY KEY (ProductId),
    PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo)
)
WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.ProductsHistory));

-- Query current state
SELECT ProductId, Name, Price FROM dbo.Products WHERE IsActive = 1;

-- Query historical state at a point in time
SELECT ProductId, Name, Price
FROM dbo.Products
FOR SYSTEM_TIME AS OF '2024-06-01T00:00:00';

-- Query all versions of a specific product
SELECT ProductId, Name, Price, ValidFrom, ValidTo
FROM dbo.Products
FOR SYSTEM_TIME ALL
WHERE ProductId = 42
ORDER BY ValidFrom;

-- Changes between two dates
SELECT ProductId, Name, Price, ValidFrom, ValidTo
FROM dbo.Products
FOR SYSTEM_TIME BETWEEN '2024-01-01' AND '2024-12-31'
WHERE ProductId = 42;

-- Disable temporal versioning before schema changes, re-enable after
ALTER TABLE dbo.Products SET (SYSTEM_VERSIONING = OFF);
-- ... schema change ...
ALTER TABLE dbo.Products SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = dbo.ProductsHistory));
```

---

### 9. Query Plan Analysis

```sql
-- I/O statistics — rows read vs actual data needed
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT u.Email, COUNT(o.OrderId) AS OrderCount
FROM dbo.Users AS u
JOIN dbo.Orders AS o ON u.UserId = o.UserId
GROUP BY u.Email;

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;
-- Look for high "logical reads" — index tuning opportunity

-- Actual execution plan: run in SSMS with Ctrl+M, or:
SET STATISTICS PROFILE ON;
-- ... query ...
SET STATISTICS PROFILE OFF;

-- Plan cache analysis — find expensive queries
SELECT TOP 20
    qs.total_logical_reads / qs.execution_count   AS AvgLogicalReads,
    qs.total_elapsed_time  / qs.execution_count   AS AvgElapsedTime_us,
    qs.execution_count,
    SUBSTRING(qt.text, (qs.statement_start_offset/2)+1,
              ((CASE qs.statement_end_offset
                    WHEN -1 THEN DATALENGTH(qt.text)
                    ELSE qs.statement_end_offset
               END - qs.statement_start_offset)/2)+1) AS QueryText,
    qp.query_plan
FROM sys.dm_exec_query_stats AS qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) AS qt
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) AS qp
ORDER BY AvgLogicalReads DESC;

-- Query hints (use sparingly — prefer index/statistics fixes)
SELECT *
FROM dbo.Orders
WHERE CustomerId = 1
OPTION (RECOMPILE);         -- force new plan each execution (parameter sniffing workaround)

SELECT *
FROM dbo.Orders AS o
JOIN dbo.Users AS u ON o.UserId = u.UserId
OPTION (HASH JOIN, MAXDOP 4);   -- force join type, limit parallelism
```

---

### 10. Azure SQL Database vs On-Premises Differences

| Feature | SQL Server (On-Prem) | Azure SQL Database |
|---|---|---|
| Instance scope | Full SQL Server instance | Single database (Hyperscale: multi-node) |
| Authentication | Windows Auth + SQL Auth | SQL Auth, Azure AD, Managed Identity |
| High availability | Always On AG, FCI | Built-in (SLA 99.99%) |
| Backup | Manual / SQL Agent | Automatic, point-in-time restore |
| Scale | Manual hardware | DTU / vCore, serverless, auto-scale |
| Linked servers | Supported | Not supported (use Elastic Query / Fabric) |
| SQL Agent | Full | Limited (Elastic Jobs instead) |
| `xp_cmdshell` | Optional (disabled by default) | Not available |
| `BULK INSERT` | Local and network paths | Azure Blob Storage only |
| `tempdb` | Shared instance tempdb | Per-database (Hyperscale: remote) |

```sql
-- Azure SQL: Managed Identity connection (no password in connection string)
-- Application uses DefaultAzureCredential; SQL user mapped to Azure AD identity

-- Create Azure AD user in SQL Database
CREATE USER [myapp@mytenant.onmicrosoft.com] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [myapp@mytenant.onmicrosoft.com];

-- Azure SQL: Elastic query across databases (replaces linked servers)
CREATE EXTERNAL DATA SOURCE RemoteDB
WITH (
    TYPE = RDBMS,
    LOCATION = N'myserver.database.windows.net',
    DATABASE_NAME = N'OtherDatabase',
    CREDENTIAL = RemoteCredential
);

CREATE EXTERNAL TABLE dbo.RemoteOrders (
    OrderId    INT,
    CustomerId INT,
    Total      DECIMAL(12,2)
)
WITH (DATA_SOURCE = RemoteDB, SCHEMA_NAME = N'dbo', OBJECT_NAME = N'Orders');
```

---

### 11. Schema Design

```sql
-- Naming: PascalCase, plural tables, explicit constraints
CREATE TABLE dbo.Users (
    UserId       INT            IDENTITY(1,1)  NOT NULL,
    Email        NVARCHAR(254)  NOT NULL,
    DisplayName  NVARCHAR(100)  NOT NULL,
    IsActive     BIT            NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
    CreatedAt    DATETIME2(7)   NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt    DATETIME2(7)   NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Users         PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UIX_Users_Email  UNIQUE NONCLUSTERED (Email),
    CONSTRAINT CK_Users_Email   CHECK (Email LIKE '%@%.%')
);

CREATE TABLE dbo.Orders (
    OrderId    INT            IDENTITY(1,1)  NOT NULL,
    UserId     INT            NOT NULL,
    Status     NVARCHAR(20)   NOT NULL
                              CONSTRAINT DF_Orders_Status DEFAULT N'Pending',
    Total      DECIMAL(12, 2) NOT NULL,
    CreatedAt  DATETIME2(7)   NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Orders              PRIMARY KEY CLUSTERED (OrderId),
    CONSTRAINT FK_Orders_Users        FOREIGN KEY (UserId) REFERENCES dbo.Users (UserId),
    CONSTRAINT CK_Orders_Status       CHECK (Status IN (N'Pending', N'Processing', N'Shipped', N'Completed', N'Cancelled')),
    CONSTRAINT CK_Orders_Total        CHECK (Total >= 0)
);

-- Prefer DATETIME2 over DATETIME: wider range, fractional seconds precision, ANSI compliant
-- Prefer NVARCHAR over VARCHAR: Unicode support, consistent with Azure SQL defaults
-- Prefer INT IDENTITY over UNIQUEIDENTIFIER PK: smaller, clustered index friendly
-- Use UNIQUEIDENTIFIER for distributed/replicated keys, but as secondary key
ALTER TABLE dbo.Orders ADD ExternalId UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID();
CREATE UNIQUE INDEX UIX_Orders_ExternalId ON dbo.Orders (ExternalId);
```

---

### 12. T-SQL vs ANSI SQL — Portability Considerations

```sql
-- T-SQL only (no direct ANSI equivalent) — document if portability matters

-- TOP (use FETCH NEXT for ANSI)
SELECT TOP 10 * FROM dbo.Orders ORDER BY CreatedAt DESC;
-- ANSI equivalent:
SELECT * FROM dbo.Orders ORDER BY CreatedAt DESC
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;

-- ISNULL (T-SQL) vs COALESCE (ANSI — evaluates each arg; prefers COALESCE)
SELECT ISNULL(MiddleName, N'')    AS MiddleName FROM dbo.Users;  -- T-SQL
SELECT COALESCE(MiddleName, N'')  AS MiddleName FROM dbo.Users;  -- ANSI preferred

-- IIF (T-SQL shorthand for CASE WHEN)
SELECT IIF(Total > 1000, N'High', N'Normal') AS OrderTier FROM dbo.Orders;
-- ANSI:
SELECT CASE WHEN Total > 1000 THEN N'High' ELSE N'Normal' END AS OrderTier FROM dbo.Orders;

-- String functions: T-SQL vs ANSI
SELECT LEN(Email)     FROM dbo.Users;  -- T-SQL (excludes trailing spaces)
SELECT DATALENGTH(Email) FROM dbo.Users;  -- bytes

-- Date functions
SELECT GETDATE();          -- local time (avoid in new code)
SELECT SYSUTCDATETIME();   -- UTC DATETIME2(7) — prefer this
SELECT SYSDATETIMEOFFSET(); -- UTC with offset info

-- DATEADD / DATEDIFF (T-SQL — ANSI uses interval syntax not supported in SQL Server)
SELECT DATEADD(DAY, 30, SYSUTCDATETIME());
SELECT DATEDIFF(DAY, CreatedAt, SYSUTCDATETIME()) AS AgeDays FROM dbo.Orders;

-- FOR JSON (T-SQL only)
SELECT UserId, Email
FROM dbo.Users
FOR JSON PATH, ROOT('users');

-- STRING_AGG (SQL Server 2017+ — also in ANSI SQL:2016)
SELECT
    CustomerId,
    STRING_AGG(CAST(OrderId AS NVARCHAR), N', ')
        WITHIN GROUP (ORDER BY CreatedAt) AS OrderIds
FROM dbo.Orders
GROUP BY CustomerId;
```

---

## Testing with tSQLt

```sql
-- Install tSQLt: https://tsqlt.org/
-- Run all tests
EXEC tSQLt.RunAll;
-- Run one class
EXEC tSQLt.Run 'UserTests';

-- Create a test class (schema)
EXEC tSQLt.NewTestClass 'UserTests';
GO

-- Test: stored procedure returns expected result set
CREATE PROCEDURE UserTests.[test usp_GetUserById returns correct user]
AS
BEGIN
    -- Arrange: fake the table so tests don't touch real data
    EXEC tSQLt.FakeTable 'dbo', 'Users';
    INSERT INTO dbo.Users (UserId, Email, DisplayName, IsActive)
    VALUES (1, 'alice@example.com', 'Alice', 1),
           (2, 'bob@example.com',   'Bob',   1);

    -- Act: capture results into temp table
    SELECT * INTO #ActualResult FROM dbo.Users WHERE 1 = 0;
    INSERT INTO #ActualResult
    EXEC dbo.usp_GetUserById @UserId = 1;

    -- Assert: compare with expected
    SELECT 1 AS UserId, 'alice@example.com' AS Email, 'Alice' AS DisplayName, 1 AS IsActive
    INTO #ExpectedResult;

    EXEC tSQLt.AssertEqualsTable '#ExpectedResult', '#ActualResult';
END;
GO

-- Test: procedure throws on invalid input
CREATE PROCEDURE UserTests.[test usp_GetUserById throws on null UserId]
AS
BEGIN
    EXEC tSQLt.FakeTable 'dbo', 'Users';

    EXEC tSQLt.ExpectException
        @ExpectedErrorNumber  = 50001,
        @ExpectedMessagePattern = '%Invalid%';

    EXEC dbo.usp_GetUserById @UserId = NULL;
END;
GO

-- Test: row count assertion
CREATE PROCEDURE UserTests.[test usp_CreateUser inserts one row]
AS
BEGIN
    EXEC tSQLt.FakeTable 'dbo', 'Users';

    EXEC dbo.usp_CreateUser
        @Email = 'new@example.com',
        @DisplayName = 'New User';

    EXEC tSQLt.AssertEquals 1, (SELECT COUNT(*) FROM dbo.Users);
END;
GO
```

---

## Anti-Patterns

| Anti-Pattern | Why It Hurts | Preferred Alternative |
|---|---|---|
| `CURSOR` for set operations | Row-by-row; orders of magnitude slower | Single `UPDATE`/`INSERT`/`DELETE` |
| `SELECT *` | Breaks on schema change; over-fetches | List columns explicitly |
| Implicit type conversion (`WHERE IntCol = '42'`) | Index scan instead of seek; silent data loss | Match parameter type to column type |
| Non-sargable predicates (`WHERE YEAR(CreatedAt) = 2024`) | Cannot use index | `WHERE CreatedAt >= '2024-01-01' AND CreatedAt < '2025-01-01'` |
| Dynamic SQL string concatenation | SQL injection; hard to cache plans | `sp_executesql` with parameters |
| `NOLOCK` everywhere | Dirty reads; phantom reads; data inconsistency | `READ_COMMITTED_SNAPSHOT` at database level |
| `FLOAT`/`REAL` for money | Floating-point rounding errors | `DECIMAL(p, s)` or `MONEY` (with caveats) |
| Missing `WHERE` on `UPDATE`/`DELETE` | Updates/deletes all rows | Always include predicate; review before running |
| Wide clustered index key (GUID) | Page splits; larger non-clustered indexes | `INT IDENTITY` or `NEWSEQUENTIALID()` |
| Multi-statement TVF | Optimizer treats as black box (1 row estimate) | Inline TVF or stored procedure |
| Implicit transactions off (`SET IMPLICIT_TRANSACTIONS ON`) | Locks held until explicit COMMIT | Use `SET IMPLICIT_TRANSACTIONS OFF` (default) |
| `GETDATE()` for UTC timestamps | Returns server local time | `SYSUTCDATETIME()` for UTC |
| Storing comma-separated values in a column | Cannot index, join, or filter efficiently | Normalize or use JSON/XML column |

---

## Quick Reference

### Common Patterns

**Upsert (MERGE):**
```sql
MERGE dbo.Settings AS target
USING (VALUES (@UserId, @Key, @Value)) AS src (UserId, [Key], Value)
    ON target.UserId = src.UserId AND target.[Key] = src.[Key]
WHEN MATCHED     THEN UPDATE SET target.Value = src.Value, target.UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (UserId, [Key], Value) VALUES (src.UserId, src.[Key], src.Value);
```

**Keyset Pagination (efficient for large tables):**
```sql
SELECT TOP (@PageSize) OrderId, CreatedAt, Total
FROM dbo.Orders
WHERE CreatedAt < @LastSeenCreatedAt
   OR (CreatedAt = @LastSeenCreatedAt AND OrderId < @LastSeenOrderId)
ORDER BY CreatedAt DESC, OrderId DESC;
```

**OFFSET/FETCH Pagination (simple cases):**
```sql
SELECT OrderId, CreatedAt, Total
FROM dbo.Orders
ORDER BY CreatedAt DESC
OFFSET (@Page - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY;
```

**Batch Delete (avoid long locks):**
```sql
DECLARE @Rows INT = 1;
WHILE @Rows > 0
BEGIN
    DELETE TOP (5000) FROM dbo.EventLog
    WHERE CreatedAt < DATEADD(DAY, -90, SYSUTCDATETIME());
    SET @Rows = @@ROWCOUNT;
END;
```

**EXISTS vs COUNT for row check:**
```sql
-- Good: stops at first match
IF EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    PRINT 'Found';

-- Bad: scans all matching rows
IF (SELECT COUNT(*) FROM dbo.Users WHERE Email = @Email) > 0
    PRINT 'Found';
```

**Safe column rename migration:**
```sql
-- Step 1: Add new column
ALTER TABLE dbo.Users ADD EmailAddress NVARCHAR(254) NULL;

-- Step 2: Backfill
UPDATE dbo.Users SET EmailAddress = Email;

-- Step 3: Add constraint, drop old column after code cutover
ALTER TABLE dbo.Users ALTER COLUMN EmailAddress NVARCHAR(254) NOT NULL;
ALTER TABLE dbo.Users DROP COLUMN Email;
```

**JSON support (SQL Server 2016+):**
```sql
-- Store JSON
CREATE TABLE dbo.Events (
    EventId   INT            IDENTITY PRIMARY KEY,
    Payload   NVARCHAR(MAX)  NOT NULL CHECK (ISJSON(Payload) = 1),
    CreatedAt DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Query JSON values
SELECT
    EventId,
    JSON_VALUE(Payload, '$.userId')          AS UserId,
    JSON_VALUE(Payload, '$.action')          AS Action,
    JSON_QUERY(Payload, '$.metadata')        AS Metadata
FROM dbo.Events
WHERE JSON_VALUE(Payload, '$.action') = N'Login';

-- Return result as JSON
SELECT UserId, Email, DisplayName
FROM dbo.Users
WHERE IsActive = 1
FOR JSON PATH, ROOT('users');
```

---

### Index Cheat Sheet

| Query Pattern | Index Strategy |
|---|---|
| `WHERE Col = @val` | Non-clustered on `Col` |
| `WHERE Col1 = @a AND Col2 > @b` | Composite `(Col1, Col2)` — equality first |
| `SELECT a, b FROM t WHERE c = @x` | Index on `c` INCLUDE `(a, b)` |
| `WHERE Status = 'Pending'` (sparse) | Filtered index `WHERE Status = 'Pending'` |
| `ORDER BY CreatedAt DESC` on large table | Include `CreatedAt` in index |
| Full-text search | `CREATE FULLTEXT INDEX` |

### Data Type Quick Reference

| Use Case | Preferred Type | Avoid |
|---|---|---|
| Surrogate PK | `INT IDENTITY` | `UNIQUEIDENTIFIER` (clustered) |
| Distributed key | `UNIQUEIDENTIFIER DEFAULT NEWSEQUENTIALID()` | `NEWID()` (random, causes splits) |
| Timestamp / audit | `DATETIME2(7)` | `DATETIME`, `SMALLDATETIME` |
| Money / finance | `DECIMAL(19, 4)` | `FLOAT`, `REAL` |
| Short string | `NVARCHAR(n)` | `VARCHAR(n)` (unless ASCII-only confirmed) |
| Large text | `NVARCHAR(MAX)` | `TEXT`, `NTEXT` (deprecated) |
| Boolean | `BIT` | `INT`, `CHAR(1)` |
| Binary data | `VARBINARY(MAX)` | `IMAGE` (deprecated) |

---

## Related

- Agent: `database-reviewer` - Full database review workflow
- Skill: `postgres-patterns` - PostgreSQL patterns and idioms
- Skill: `backend-patterns` - API and backend integration patterns
- Rules: `sql/coding-style` - SQL formatting and naming conventions
- Rules: `sql/security` - SQL injection prevention and permissions
