---
paths:
  - "**/*.sql"
  - "**/*.tsql"
---
# SQL Hooks

> This file extends [common/hooks.md](../common/hooks.md) with SQL specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **sqlfluff**: SQL linter and formatter — `sqlfluff lint` / `sqlfluff fix`

```bash
pip install sqlfluff
sqlfluff lint --dialect tsql migration.sql
sqlfluff lint --dialect postgres query.sql
```

## Warnings

- Warn about `SELECT *` — list columns explicitly
- Warn about missing `WHERE` on `UPDATE`/`DELETE` statements — likely missing filter
- Warn about dynamic SQL string concatenation — use parameterized `sp_executesql`
- Warn about cursors — consider set-based alternatives
- Warn about missing transaction rollback in error handlers
