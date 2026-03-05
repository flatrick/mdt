---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
  - "**/Cargo.lock"
---
# Rust Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Rust specific content.

## Standards

- Follow **Rust API Guidelines** (https://rust-lang.github.io/api-guidelines/)
- Run **rustfmt** before every commit: `cargo fmt`
- Run **Clippy** for linting: `cargo clippy -- -D warnings`

## Naming Conventions

```rust
// Types, Traits, Enums: UpperCamelCase
struct UserProfile { }
trait Serialize { }
enum HttpMethod { Get, Post }

// Functions, methods, variables: snake_case
fn get_user_profile() { }
let user_name = "Alice";

// Constants: UPPER_SNAKE_CASE
const MAX_CONNECTIONS: u32 = 100;

// Lifetimes: short lowercase 'a, 'b
fn parse<'a>(input: &'a str) -> &'a str { input }

// Crates/modules: snake_case
mod user_service;
```

## Immutability

Rust enforces immutability by default:

```rust
// Immutable by default (preferred)
let config = Config::new();

// Mutable only when needed
let mut counter = 0;
counter += 1;
```

## Reference

See skill: `rust-patterns` for comprehensive Rust idioms, ownership patterns, and async usage.
