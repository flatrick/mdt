---
paths:
  - "**/*.rs"
---
# Rust Security

> This file extends [common/security.md](../common/security.md) with Rust specific content.

## Secret Management

```rust
// Use environment variables
let api_key = std::env::var("API_KEY")
    .expect("API_KEY environment variable must be set");

// Use config crate for structured config
use config::Config;
let settings = Config::builder()
    .add_source(config::Environment::with_prefix("APP"))
    .build()?;
```

## Unsafe Code Guidelines

```rust
// Document every unsafe block with SAFETY comment
unsafe {
    // SAFETY: ptr is guaranteed non-null and aligned by the caller,
    // and the memory it points to is valid for 'a.
    &*ptr
}
```

- Every `unsafe` block **must** have a `// SAFETY:` comment explaining why it's sound
- Minimize the scope of `unsafe` blocks
- Prefer safe abstractions over raw `unsafe`

## Dependency Auditing

```bash
# Check for known vulnerabilities
cargo audit

# Check for outdated dependencies
cargo outdated
```

## SQL Injection Prevention

```rust
// Good: sqlx parameterized queries
let user = sqlx::query_as!(User,
    "SELECT * FROM users WHERE email = $1",
    email
).fetch_optional(&pool).await?;

// Bad: String formatting into SQL
let sql = format!("SELECT * FROM users WHERE email = '{}'", email);
```

## Reference

See skill: `rust-patterns` for secure async patterns and error handling.
