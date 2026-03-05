---
paths:
  - "**/*.rs"
---
# Rust Testing

> This file extends [common/testing.md](../common/testing.md) with Rust specific content.

## Framework

Use Rust's built-in test framework. Add **tokio-test** for async tests.

```toml
[dev-dependencies]
tokio = { version = "1", features = ["test-util"] }
assert_matches = "1"
```

## Test Organization

```rust
// Unit tests: in the same file as the code
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_total() {
        let result = calculate_total(&[10, 20, 30]);
        assert_eq!(result, 60);
    }

    #[tokio::test]
    async fn test_fetch_user() {
        let repo = MockUserRepository::new();
        let result = repo.find_by_id(Uuid::new_v4()).await;
        assert!(result.is_ok());
    }
}
```

```
// Integration tests: in tests/ directory
tests/
├── integration_test.rs
└── common/
    └── mod.rs  # Shared test helpers
```

## Coverage

```bash
# Install and run tarpaulin
cargo install cargo-tarpaulin
cargo tarpaulin --out Xml
```

## Reference

See skill: `rust-patterns` for property-based testing with proptest and mock strategies.
