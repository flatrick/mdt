---
paths:
  - "**/*.rs"
  - "**/Cargo.toml"
---
# Rust Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Rust specific content.

## PostToolUse Hooks

Configure in `~/.claude/settings.json`:

- **cargo fmt**: Auto-format `.rs` files after edit
- **cargo check**: Fast compilation check after changes
- **cargo clippy**: Linting after changes

## Warnings

- Warn about `unwrap()` and `expect()` in non-test code — use proper error handling with `?`
- Warn about `clone()` on large data structures — review if necessary
- Warn about `unsafe` blocks added without SAFETY comment
- Warn about `.to_string()` in hot paths — consider `&str` or `Cow<str>`
